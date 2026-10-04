import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

// GovS 013 components held as records (/api/v1/compliance/records):
// 2 counter fraud strategy, 8 identified loss, 9 investigator access,
// 10 detection activity, 12 gifts, hospitality, conflicts of interest and their policies.

const logger = createLogger('CounterFraudRecords');

export type RecordKind = 'strategy' | 'loss' | 'investigator' | 'detection' | 'gift_hospitality' | 'conflict_of_interest' | 'policy' | 'reporting_route' | 'associated_person' | 'board_minute' | 'tone_statement';
type Data = Record<string, string | number | undefined>;
interface DueDiligence { required: number; done: number; complete: boolean; outstanding: string[] }
interface CounterFraudRecord {
  id: string; kind: RecordKind; data: Data; createdAt: string; updatedAt: string;
  /** Worked out by the server for associated persons */
  derived?: { dueDiligence?: DueDiligence };
}

type FieldType = 'text' | 'textarea' | 'date' | 'gbp' | 'count' | 'email' | 'url' | 'select';
interface Field { name: string; label: string; type: FieldType; required?: boolean; options?: Record<string, string>; hint?: string }
interface QuickAction { label: string; when: (d: Data) => boolean; change: (today: string) => Data }
interface Column { label: string; value: (d: Data, r: CounterFraudRecord) => React.ReactNode; numeric?: boolean }
interface KindConfig {
  kind: RecordKind; tab: string; component: string; title: string; description: string;
  fields: Field[]; columns: Column[]; actions?: QuickAction[]; addLabel: string;
}

const fmtDate = (iso?: string | number) =>
  iso ? new Date(String(iso)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtGbp = (n?: string | number) => (n === undefined || n === '' ? '—' : `£${Number(n).toLocaleString('en-GB')}`);
const label = (options: Record<string, string>) => (v?: string | number) => (v === undefined ? '—' : options[String(v)] ?? String(v));

const STRATEGY_STATUS = { draft: 'Draft', approved: 'Approved', submitted: 'Submitted to the centre' };
const LOSS_CATEGORY = { fraud: 'Fraud', bribery: 'Bribery', corruption: 'Corruption', error: 'Error' };
const LOSS_TYPE = { detected: 'Detected loss', prevented: 'Prevented loss' };
const ARRANGEMENT = { in_house: 'In-house', contracted: 'Contracted', shared_service: 'Shared service' };
const METHOD = { data_analytics: 'Data analytics', data_matching: 'Data matching', audit_sample: 'Audit sample', loss_measurement: 'Loss measurement', other: 'Other' };
const DETECTION_STATUS = { planned: 'Planned', in_progress: 'In progress', completed: 'Completed' };
const DIRECTION = { received: 'Received', offered: 'Offered' };
const DECISION = { accepted: 'Accepted', declined: 'Declined' };
const INTEREST = { financial: 'Financial', non_financial_professional: 'Non-financial professional', non_financial_personal: 'Non-financial personal', indirect: 'Indirect' };
const COI_STATUS = { active: 'Active', ended: 'Ended' };
const CHANNEL = { online_form: 'Online form', phone: 'Phone line', email: 'Email', post: 'Post', in_person: 'In person', external: 'External body' };
const AUDIENCE = { staff: 'Staff', staff_and_contractors: 'Staff and contractors', everyone: 'Everyone, including the public' };
const YES_NO = { yes: 'Yes', no: 'No' };
const ASSOCIATE_TYPE = {
  agent: 'Agent', contractor: 'Contractor', supplier: 'Supplier', subsidiary: 'Subsidiary', intermediary: 'Intermediary',
  joint_venture: 'Joint venture partner', other: 'Other',
};
const ASSOCIATE_RISK = { medium: 'Medium', low: 'Low', high: 'High' };
// "No" first, so a check is only recorded as done when someone says so
const CHECK = { no: 'No', yes: 'Yes', not_applicable: 'Not applicable' };
const BODY = { board: 'Board', audit_committee: 'Audit committee', risk_committee: 'Risk committee', senior_leadership: 'Senior leadership team' };
const AUDIENCE_TONE = { all_staff: 'All staff', staff_and_associates: 'Staff and people acting for us', everyone: 'Everyone, including the public' };
const CHANNEL_TONE = { email: 'Email', intranet: 'Intranet', staff_meeting: 'All-staff meeting', website: 'Website', other: 'Other' };
const yearAgo = () => new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
const POLICY_TYPE = {
  counter_fraud: 'Counter fraud policy', response_plan: 'Fraud response plan', gifts_hospitality: 'Gifts and hospitality',
  conflicts_of_interest: 'Conflicts of interest', whistleblowing: 'Whistleblowing',
};

const today = () => new Date().toISOString().slice(0, 10);
const docLink = (d: Data) => (typeof d.documentUrl === 'string' && d.documentUrl.startsWith('https://')
  ? <a className="underline" href={d.documentUrl} target="_blank" rel="noopener noreferrer">Document</a> : '—');

const RECORD_KINDS: KindConfig[] = [
  {
    kind: 'strategy', tab: 'Strategy', component: 'Component 2', title: 'Counter fraud strategy', addLabel: 'Add strategy',
    description: 'The approved counter fraud, bribery and corruption strategy, and when it was submitted to the centre.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'periodStart', label: 'Period starts', type: 'date', required: true },
      { name: 'periodEnd', label: 'Period ends', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: STRATEGY_STATUS },
      { name: 'approvedBy', label: 'Approved by', type: 'text', hint: 'e.g. Audit committee' },
      { name: 'approvedAt', label: 'Approved on', type: 'date' },
      { name: 'submittedToCentreAt', label: 'Submitted to the centre on', type: 'date' },
      { name: 'documentUrl', label: 'Link to the document', type: 'url' },
      { name: 'summary', label: 'Summary', type: 'textarea' },
    ],
    columns: [
      { label: 'Title', value: (d) => d.title },
      { label: 'Period', value: (d) => `${fmtDate(d.periodStart)} – ${fmtDate(d.periodEnd)}` },
      { label: 'Status', value: (d) => label(STRATEGY_STATUS)(d.status) },
      { label: 'Approved', value: (d) => (d.approvedAt ? `${fmtDate(d.approvedAt)}${d.approvedBy ? ` by ${d.approvedBy}` : ''}` : '—') },
      { label: 'Document', value: docLink },
    ],
  },
  {
    kind: 'loss', tab: 'Losses', component: 'Component 8', title: 'Identified loss and recoveries', addLabel: 'Record loss',
    description: 'Fraud, bribery and corruption losses and recoveries, reported to the centre within 30 days.',
    fields: [
      { name: 'category', label: 'Category', type: 'select', required: true, options: LOSS_CATEGORY },
      { name: 'lossType', label: 'Type', type: 'select', required: true, options: LOSS_TYPE },
      { name: 'identifiedAt', label: 'Identified on', type: 'date', required: true },
      { name: 'amountGbp', label: 'Amount (£)', type: 'gbp', required: true },
      { name: 'recoveredGbp', label: 'Recovered (£)', type: 'gbp' },
      { name: 'reportedToCentreAt', label: 'Reported to the centre on', type: 'date' },
      { name: 'description', label: 'What happened', type: 'textarea', required: true },
    ],
    columns: [
      { label: 'Identified', value: (d) => fmtDate(d.identifiedAt) },
      { label: 'Category', value: (d) => `${label(LOSS_CATEGORY)(d.category)} · ${label(LOSS_TYPE)(d.lossType)}` },
      { label: 'Description', value: (d) => d.description },
      { label: 'Amount', value: (d) => fmtGbp(d.amountGbp), numeric: true },
      { label: 'Recovered', value: (d) => fmtGbp(d.recoveredGbp), numeric: true },
      { label: 'Reported', value: (d) => (d.reportedToCentreAt ? fmtDate(d.reportedToCentreAt) : <Badge variant="outline">Not reported</Badge>) },
    ],
    actions: [{ label: 'Reported today', when: (d) => !d.reportedToCentreAt, change: (t) => ({ reportedToCentreAt: t }) }],
  },
  {
    kind: 'investigator', tab: 'Investigators', component: 'Component 9', title: 'Access to trained investigators', addLabel: 'Add investigator',
    description: 'Who investigates suspected fraud for you, their accreditation and how long the agreement runs.',
    fields: [
      { name: 'name', label: 'Investigator', type: 'text', required: true },
      { name: 'provider', label: 'Provider', type: 'text', hint: 'In-house team or firm' },
      { name: 'accreditation', label: 'Accreditation', type: 'text', required: true, hint: 'e.g. Accredited Counter Fraud Specialist' },
      { name: 'arrangement', label: 'Arrangement', type: 'select', required: true, options: ARRANGEMENT },
      { name: 'contactEmail', label: 'Contact email', type: 'email' },
      { name: 'agreementEndsAt', label: 'Agreement ends', type: 'date' },
    ],
    columns: [
      { label: 'Investigator', value: (d) => d.name },
      { label: 'Provider', value: (d) => d.provider ?? '—' },
      { label: 'Accreditation', value: (d) => d.accreditation },
      { label: 'Arrangement', value: (d) => label(ARRANGEMENT)(d.arrangement) },
      {
        label: 'Agreement', value: (d) => (!d.agreementEndsAt ? 'Open-ended'
          : String(d.agreementEndsAt) < today() ? <Badge variant="outline" className="text-destructive border-destructive/30">Ended {fmtDate(d.agreementEndsAt)}</Badge>
          : `Until ${fmtDate(d.agreementEndsAt)}`),
      },
    ],
  },
  {
    kind: 'detection', tab: 'Detection', component: 'Component 10', title: 'Detection activity', addLabel: 'Plan activity',
    description: 'Detection work in high-risk areas, such as data matching or loss measurement, and what it found.',
    fields: [
      { name: 'title', label: 'Activity', type: 'text', required: true },
      { name: 'method', label: 'Method', type: 'select', required: true, options: METHOD },
      { name: 'riskArea', label: 'Risk area', type: 'text', hint: 'e.g. Procurement' },
      { name: 'plannedFor', label: 'Planned for', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: DETECTION_STATUS },
      { name: 'completedAt', label: 'Completed on', type: 'date' },
      { name: 'issuesFound', label: 'Issues found', type: 'count' },
      { name: 'lossIdentifiedGbp', label: 'Loss identified (£)', type: 'gbp' },
      { name: 'findings', label: 'Findings', type: 'textarea' },
    ],
    columns: [
      { label: 'Activity', value: (d) => d.title },
      { label: 'Method', value: (d) => label(METHOD)(d.method) },
      { label: 'Area', value: (d) => d.riskArea ?? '—' },
      { label: 'Planned', value: (d) => fmtDate(d.plannedFor) },
      { label: 'Status', value: (d) => (d.status === 'completed' ? `Completed ${fmtDate(d.completedAt)}` : label(DETECTION_STATUS)(d.status)) },
      { label: 'Issues', value: (d) => d.issuesFound ?? '—', numeric: true },
    ],
    actions: [{ label: 'Completed today', when: (d) => d.status !== 'completed', change: (t) => ({ status: 'completed', completedAt: t }) }],
  },
  {
    kind: 'gift_hospitality', tab: 'Gifts & hospitality', component: 'Component 12', title: 'Gifts and hospitality register', addLabel: 'Add entry',
    description: 'Every gift or hospitality offered or received, its value and whether it was accepted.',
    fields: [
      { name: 'personName', label: 'Staff member', type: 'text', required: true },
      { name: 'direction', label: 'Received or offered', type: 'select', required: true, options: DIRECTION },
      { name: 'counterparty', label: 'From or to', type: 'text', required: true },
      { name: 'valueGbp', label: 'Value (£)', type: 'gbp', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'decision', label: 'Decision', type: 'select', required: true, options: DECISION },
      { name: 'approvedBy', label: 'Approved by', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
    ],
    columns: [
      { label: 'Date', value: (d) => fmtDate(d.date) },
      { label: 'Staff member', value: (d) => d.personName },
      { label: 'Gift or hospitality', value: (d) => `${label(DIRECTION)(d.direction)}: ${d.description} (${d.counterparty})` },
      { label: 'Value', value: (d) => fmtGbp(d.valueGbp), numeric: true },
      { label: 'Decision', value: (d) => label(DECISION)(d.decision) },
    ],
  },
  {
    kind: 'conflict_of_interest', tab: 'Conflicts of interest', component: 'Component 12', title: 'Conflicts of interest register', addLabel: 'Add declaration',
    description: 'Declared interests, how each is managed, and when it was last reviewed.',
    fields: [
      { name: 'personName', label: 'Staff member', type: 'text', required: true },
      { name: 'interestType', label: 'Type of interest', type: 'select', required: true, options: INTEREST },
      { name: 'declaredAt', label: 'Declared on', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: COI_STATUS },
      { name: 'reviewedAt', label: 'Last reviewed', type: 'date' },
      { name: 'description', label: 'Interest declared', type: 'textarea', required: true },
      { name: 'mitigation', label: 'How it is managed', type: 'textarea' },
    ],
    columns: [
      { label: 'Declared', value: (d) => fmtDate(d.declaredAt) },
      { label: 'Staff member', value: (d) => d.personName },
      { label: 'Interest', value: (d) => `${label(INTEREST)(d.interestType)}: ${d.description}` },
      { label: 'Managed by', value: (d) => d.mitigation ?? '—' },
      { label: 'Status', value: (d) => `${label(COI_STATUS)(d.status)}${d.reviewedAt ? ` · reviewed ${fmtDate(d.reviewedAt)}` : ''}` },
    ],
    actions: [
      { label: 'Reviewed today', when: (d) => d.status === 'active', change: (t) => ({ reviewedAt: t }) },
      { label: 'Mark ended', when: (d) => d.status === 'active', change: () => ({ status: 'ended' }) },
    ],
  },
  {
    kind: 'policy', tab: 'Policies', component: 'Components 4 and 12', title: 'Policies', addLabel: 'Add policy',
    description: 'Approved policies and their review dates. Component 4 needs a current counter fraud policy and fraud response plan; component 12 needs current gifts and hospitality and conflicts of interest policies.',
    fields: [
      { name: 'policyType', label: 'Policy', type: 'select', required: true, options: POLICY_TYPE },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'version', label: 'Version', type: 'text' },
      { name: 'approvedBy', label: 'Approved by', type: 'text' },
      { name: 'approvedAt', label: 'Approved on', type: 'date', required: true },
      { name: 'reviewDue', label: 'Review due', type: 'date', required: true },
      { name: 'documentUrl', label: 'Link to the document', type: 'url' },
    ],
    columns: [
      { label: 'Policy', value: (d) => label(POLICY_TYPE)(d.policyType) },
      { label: 'Title', value: (d) => `${d.title}${d.version ? ` (v${d.version})` : ''}` },
      { label: 'Approved', value: (d) => `${fmtDate(d.approvedAt)}${d.approvedBy ? ` by ${d.approvedBy}` : ''}` },
      {
        label: 'Review due', value: (d) => (String(d.reviewDue) < today()
          ? <Badge variant="outline" className="text-destructive border-destructive/30">Overdue {fmtDate(d.reviewDue)}</Badge>
          : fmtDate(d.reviewDue)),
      },
      { label: 'Document', value: docLink },
    ],
  },
  {
    kind: 'associated_person', tab: 'Associated persons', component: 'ECCTA principle 4', title: 'Associated persons and due diligence', addLabel: 'Add associated person',
    description: 'Everyone who provides services for or on behalf of you: agents, contractors, subsidiaries and suppliers. Low risk needs identity verified; medium also ownership, sanctions screening and contract clauses; high needs all six checks.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'associateType', label: 'Relationship', type: 'select', required: true, options: ASSOCIATE_TYPE },
      { name: 'riskLevel', label: 'Fraud risk', type: 'select', required: true, options: ASSOCIATE_RISK },
      { name: 'identityVerified', label: 'Identity verified', type: 'select', required: true, options: CHECK },
      { name: 'ownershipChecked', label: 'Ownership and control checked', type: 'select', required: true, options: CHECK },
      { name: 'sanctionsScreened', label: 'Sanctions and adverse media screened', type: 'select', required: true, options: CHECK },
      { name: 'referencesChecked', label: 'References or track record checked', type: 'select', required: true, options: CHECK },
      { name: 'contractClauses', label: 'Anti-fraud clauses in the contract', type: 'select', required: true, options: CHECK },
      { name: 'trainingProvided', label: 'Expectations communicated or trained', type: 'select', required: true, options: CHECK },
      { name: 'reviewedAt', label: 'Last reviewed', type: 'date' },
      { name: 'servicesProvided', label: 'What they do for or on behalf of you', type: 'textarea', required: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { label: 'Name', value: (d) => <>{d.name}<span className="block text-xs text-muted-foreground">{label(ASSOCIATE_TYPE)(d.associateType)}</span></> },
      { label: 'Does for you', value: (d) => d.servicesProvided },
      { label: 'Risk', value: (d) => label(ASSOCIATE_RISK)(d.riskLevel) },
      {
        label: 'Due diligence', value: (_d, r) => {
          const dd = r.derived?.dueDiligence;
          if (!dd) return '—';
          return dd.complete
            ? <Badge variant="outline" className="text-green-700 border-green-700/30">Complete</Badge>
            : <><Badge variant="outline" className="text-destructive border-destructive/30">{dd.done} of {dd.required} checks</Badge><span className="block text-xs text-muted-foreground mt-1">Outstanding: {dd.outstanding.join(', ')}</span></>;
        },
      },
      {
        label: 'Reviewed', value: (d) => (d.riskLevel !== 'low' && (!d.reviewedAt || String(d.reviewedAt) < yearAgo())
          ? <Badge variant="outline" className="text-destructive border-destructive/30">{d.reviewedAt ? `Due (last ${fmtDate(d.reviewedAt)})` : 'Review due'}</Badge>
          : fmtDate(d.reviewedAt)),
      },
    ],
    actions: [{ label: 'Reviewed today', when: () => true, change: (t) => ({ reviewedAt: t }) }],
  },
];

/** Reporting routes sit with the speak-up case log (GovS 013 component 7), not in the registers tabs. */
const REPORTING_ROUTES: KindConfig = {
  kind: 'reporting_route', tab: 'Reporting routes', component: 'Component 7', title: 'Other reporting routes', addLabel: 'Add route',
  description: 'Hotlines, mailboxes and external bodies people can report to, beside the speak-up link.',
  fields: [
    { name: 'name', label: 'Route', type: 'text', required: true, hint: 'e.g. Confidential hotline' },
    { name: 'channel', label: 'Channel', type: 'select', required: true, options: CHANNEL },
    { name: 'contact', label: 'Number, address or link', type: 'text', required: true },
    { name: 'audience', label: 'Open to', type: 'select', required: true, options: AUDIENCE },
    { name: 'anonymousAllowed', label: 'Anonymous reports', type: 'select', required: true, options: YES_NO },
    { name: 'externalBody', label: 'Run by', type: 'text', hint: 'e.g. NHS Fraud and Corruption Reporting Line' },
    { name: 'publishedAt', label: 'Published on', type: 'date' },
  ],
  columns: [
    { label: 'Route', value: (d) => d.name },
    { label: 'Channel', value: (d) => `${label(CHANNEL)(d.channel)}: ${d.contact}` },
    { label: 'Open to', value: (d) => label(AUDIENCE)(d.audience) },
    { label: 'Anonymous', value: (d) => label(YES_NO)(d.anonymousAllowed) },
    { label: 'Run by', value: (d) => d.externalBody ?? 'Us' },
  ],
};

/** ECCTA principle 1: shown under Senior management, beside the accountable managers. */
const BOARD_MINUTES: KindConfig = {
  kind: 'board_minute', tab: 'Board minutes', component: 'ECCTA principle 1', title: 'Board and committee oversight of fraud', addLabel: 'Record meeting',
  description: 'Each board or committee meeting where fraud risk was discussed, with the decisions taken. Senior leadership meetings are recorded but do not count as board oversight.',
  fields: [
    { name: 'meetingDate', label: 'Meeting date', type: 'date', required: true },
    { name: 'body', label: 'Meeting of', type: 'select', required: true, options: BODY },
    { name: 'minuteReference', label: 'Minute reference', type: 'text', hint: 'e.g. AC/2026/14' },
    { name: 'documentUrl', label: 'Link to the minutes', type: 'url' },
    { name: 'itemsDiscussed', label: 'Fraud items discussed', type: 'textarea', required: true },
    { name: 'decisions', label: 'Decisions and actions', type: 'textarea' },
  ],
  columns: [
    { label: 'Meeting', value: (d) => <>{fmtDate(d.meetingDate)}<span className="block text-xs text-muted-foreground">{label(BODY)(d.body)}{d.minuteReference ? ` · ${d.minuteReference}` : ''}</span></> },
    { label: 'Fraud items discussed', value: (d) => d.itemsDiscussed },
    { label: 'Decisions', value: (d) => d.decisions ?? '—' },
    { label: 'Minutes', value: docLink },
  ],
};

const TONE_STATEMENTS: KindConfig = {
  kind: 'tone_statement', tab: 'Tone from the top', component: 'ECCTA principle 1', title: 'Tone from the top', addLabel: 'Record statement',
  description: 'Statements by leaders that fraud will not be tolerated, including fraud that would benefit the organisation, and how they reached people. Renew at least yearly.',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'issuedBy', label: 'Issued by', type: 'text', required: true, hint: 'e.g. Chief Executive' },
    { name: 'issuedAt', label: 'Issued on', type: 'date', required: true },
    { name: 'audience', label: 'Audience', type: 'select', required: true, options: AUDIENCE_TONE },
    { name: 'channel', label: 'Shared by', type: 'select', required: true, options: CHANNEL_TONE },
    { name: 'documentUrl', label: 'Link to the statement', type: 'url' },
    { name: 'statement', label: 'What was said', type: 'textarea', required: true },
  ],
  columns: [
    { label: 'Issued', value: (d) => (String(d.issuedAt) < yearAgo()
      ? <Badge variant="outline" className="text-destructive border-destructive/30">Renew (issued {fmtDate(d.issuedAt)})</Badge>
      : fmtDate(d.issuedAt)) },
    { label: 'Statement', value: (d) => <><span className="font-medium">{d.title}</span><span className="block text-xs text-muted-foreground">{d.issuedBy} · {label(AUDIENCE_TONE)(d.audience)} · {label(CHANNEL_TONE)(d.channel)}</span></> },
    { label: 'What was said', value: (d) => d.statement },
    { label: 'Document', value: docLink },
  ],
};

/** Form values are strings; numbers are converted and empty optional fields left out. */
function toPayload(fields: Field[], values: Record<string, string>): Data {
  const out: Data = {};
  for (const f of fields) {
    const v = (values[f.name] ?? '').trim();
    if (v === '') continue;
    out[f.name] = f.type === 'gbp' || f.type === 'count' ? Number(v) : v;
  }
  return out;
}

function RecordForm({ config, onSaved }: { config: KindConfig; onSaved: () => void }) {
  const initial = useMemo(() => Object.fromEntries(config.fields
    .filter((f) => f.type === 'select' && f.options)
    .map((f) => [f.name, Object.keys(f.options!)[0]])), [config]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (name: string, value: string) => { setValues((v) => ({ ...v, [name]: value })); setError(null); };

  const save = async () => {
    const missing = config.fields.find((f) => f.required && !(values[f.name] ?? '').trim());
    if (missing) {
      setError(`Enter ${missing.label.toLowerCase()}`);
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/v1/compliance/records', { kind: config.kind, data: toPayload(config.fields, values) });
      setValues(initial);
      toast.success('Saved');
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const inputType = (t: FieldType) => (t === 'gbp' || t === 'count' ? 'number' : t === 'textarea' || t === 'select' ? 'text' : t);

  return (
    <div className="space-y-3 print:hidden">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {config.fields.filter((f) => f.type !== 'textarea').map((f) => {
          const id = `${config.kind}-${f.name}`;
          return (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={id}>{f.label}{f.required ? '' : ' (optional)'}</Label>
              {f.type === 'select' && f.options ? (
                <Select value={values[f.name]} onValueChange={(v) => set(f.name, v)}>
                  <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(f.options).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input id={id} type={inputType(f.type)} value={values[f.name] ?? ''} placeholder={f.hint}
                  min={f.type === 'gbp' || f.type === 'count' ? 0 : undefined} step={f.type === 'gbp' ? '0.01' : f.type === 'count' ? 1 : undefined}
                  onChange={(e) => set(f.name, e.target.value)} />
              )}
            </div>
          );
        })}
      </div>
      {config.fields.filter((f) => f.type === 'textarea').map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={`${config.kind}-${f.name}`}>{f.label}{f.required ? '' : ' (optional)'}</Label>
          <Textarea id={`${config.kind}-${f.name}`} rows={2} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
        </div>
      ))}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button onClick={save} disabled={busy}>{config.addLabel}</Button>
    </div>
  );
}

function RecordRegister({ config, onChange }: { config: KindConfig; onChange: () => void }) {
  const [records, setRecords] = useState<CounterFraudRecord[] | null>(null);

  const load = useCallback(() => api.get<CounterFraudRecord[]>(`/api/v1/compliance/records?kind=${config.kind}`)
    .then(setRecords)
    .catch((err: unknown) => { logger.error(`Failed to load ${config.kind} records`, err); setRecords([]); }), [config.kind]);
  useEffect(() => { load(); }, [load]);

  const changed = async () => { await load(); onChange(); };

  const apply = async (r: CounterFraudRecord, action: QuickAction) => {
    try {
      await api.patch(`/api/v1/compliance/records/${r.id}`, { data: action.change(today()) });
      toast.success('Updated');
      await changed();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const remove = async (r: CounterFraudRecord) => {
    if (!window.confirm(`Remove this entry from the ${config.title.toLowerCase()}?`)) return;
    try {
      await api.delete(`/api/v1/compliance/records/${r.id}`);
      await changed();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  const download = async () => {
    try {
      await api.download(`/api/v1/compliance/records?kind=${config.kind}&format=csv`, `${config.kind.replace(/_/g, '-')}-register.csv`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">{config.title}</CardTitle>
          <CardDescription>{config.component} of GovS 013 · {config.description}</CardDescription>
        </div>
        <Button variant="outline" size="sm" className="print:hidden" onClick={download}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <RecordForm config={config} onSaved={changed} />
        {records === null ? null : records.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Nothing recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((c) => <TableHead key={c.label} className={c.numeric ? 'text-right' : undefined}>{c.label}</TableHead>)}
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  {config.columns.map((c) => (
                    <TableCell key={c.label} className={c.numeric ? 'text-right tabular-nums' : 'max-w-sm'}>{c.value(r.data, r)}</TableCell>
                  ))}
                  <TableCell className="text-right whitespace-nowrap print:hidden">
                    {config.actions?.filter((a) => a.when(r.data)).map((a) => (
                      <Button key={a.label} variant="ghost" size="sm" onClick={() => apply(r, a)}>{a.label}</Button>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => remove(r)}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportingRoutesRegister({ onChange }: { onChange: () => void }) {
  return <RecordRegister config={REPORTING_ROUTES} onChange={onChange} />;
}

/** Board minutes and tone-from-the-top statements (ECCTA principle 1). */
export function LeadershipRegisters({ onChange }: { onChange: () => void }) {
  return (
    <div className="space-y-6">
      <RecordRegister config={TONE_STATEMENTS} onChange={onChange} />
      <RecordRegister config={BOARD_MINUTES} onChange={onChange} />
    </div>
  );
}

/** The GovS 013 registers, one tab each. `onChange` refreshes the compliance score. */
export function CounterFraudRecords({ onChange }: { onChange: () => void }) {
  return (
    <Tabs defaultValue="strategy">
      <TabsList className="mb-4 flex-wrap h-auto print:hidden" aria-label="Counter fraud registers">
        {RECORD_KINDS.map((k) => <TabsTrigger key={k.kind} value={k.kind}>{k.tab}</TabsTrigger>)}
      </TabsList>
      {RECORD_KINDS.map((k) => (
        <TabsContent key={k.kind} value={k.kind}><RecordRegister config={k} onChange={onChange} /></TabsContent>
      ))}
    </Tabs>
  );
}
