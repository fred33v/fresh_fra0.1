// ============================================================
// ECCTA 2023 evidence pack: one download holding the records an organisation
// would show to evidence "reasonable procedures" — a summary (PDF and HTML)
// of the six principles and the eight evidence items, plus the records as
// CSV, one folder per evidence item.
// ============================================================

import { hasDatabase } from './helpers.js';
import { auditEvents, organisationsById } from './stores.js';
import { dbGetOrganisationById } from './db/index.js';
import { dbListAuditEvents } from './db/compliance.js';
import {
  computeMetrics, evaluateEccta, evaluateGovS013, loadComplianceData, type OrgComplianceData, type Requirement,
} from './compliance-evidence.js';
import { dueDiligenceStatus, recordsOf, type CounterFraudKind } from './counter-fraud.js';
import { scoreAssessment } from './assessment-risk.js';
import { toCsv } from './csv.js';
import { createZip, type ZipEntry } from './zip.js';
import { renderHtmlToPdf } from './pdf-generator.js';
import { createLogger } from './logger.js';

const logger = createLogger('evidence-pack');

type Rows = Record<string, unknown>[];
type EvidenceFile = { path: string; rows: Rows; columns?: string[] };
type EvidenceItem = { number: number; title: string; folder: string; files: EvidenceFile[] };

const esc = (v: unknown) => String(v ?? '').replace(/&(?!(amp|lt|gt|quot|#39);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—');
// Names arrive entity-encoded by the input sanitiser; drop the entities from the filename
const slug = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'organisation';

function recordRows(data: OrgComplianceData, kind: CounterFraudKind): Rows {
  return data.records.filter((r) => r.kind === kind)
    .map((r) => ({ id: r.id, ...(r.data as Record<string, unknown>), createdAt: r.createdAt, updatedAt: r.updatedAt }));
}

function evidenceItems(data: OrgComplianceData, requirements: Requirement[], auditRows: Rows): EvidenceItem[] {
  const names = new Map(data.users.map((u) => [u.id, u.name]));
  return [
    {
      number: 1, title: 'Board-approved fraud prevention policy and tone-from-the-top statement', folder: '1-policy-and-tone',
      files: [{ path: 'policies.csv', rows: recordRows(data, 'policy') }, { path: 'tone-from-the-top.csv', rows: recordRows(data, 'tone_statement') }],
    },
    {
      number: 2, title: 'Fraud risk assessment, refreshed at least annually', folder: '2-risk-assessment',
      files: [
        {
          path: 'assessments.csv',
          // Answers stay in the platform; the pack shows who assessed, when, and the result
          rows: data.assessments.map((a) => ({
            id: a.id, title: a.title ?? '', assessedBy: names.get(a.createdByUserId) ?? '', status: a.status,
            submittedAt: a.submittedAt ?? '', riskLevel: scoreAssessment(a).level ?? '', updatedAt: a.updatedAt,
          })),
        },
        { path: 'risk-register.csv', rows: data.risks.map((r) => ({ ...r, owner: r.ownerUserId ? names.get(r.ownerUserId) ?? '' : '' })) },
      ],
    },
    {
      number: 3, title: 'Due diligence records for employees, agents, contractors and others acting for the organisation', folder: '3-due-diligence',
      files: [{
        path: 'associated-persons.csv',
        rows: recordsOf(data.records, 'associated_person').map((r) => {
          const dd = dueDiligenceStatus(r.data);
          return { ...r.data, dueDiligenceDone: dd.done, dueDiligenceRequired: dd.required, outstandingChecks: dd.outstanding.join('; '), id: r.id };
        }),
      }],
    },
    {
      number: 4, title: 'Training records with completion rates', folder: '4-training',
      files: [{
        path: 'training.csv',
        rows: data.users.map((u) => {
          const t = data.training.find((x) => x.userId === u.id);
          return { name: u.name, email: u.email, department: u.department ?? '', completedAt: t?.completedAt ?? '', certificateNumber: t?.certificateNumber ?? '' };
        }),
      }],
    },
    {
      number: 5, title: 'Whistleblowing and reporting routes, and case logs', folder: '5-reporting-routes',
      files: [
        { path: 'reporting-routes.csv', rows: recordRows(data, 'reporting_route') },
        {
          path: 'speak-up-case-log.csv',
          // No report text and no reporter identity leave the platform
          rows: data.speakUp.reports.map((r) => ({
            reference: r.reference, category: r.category, relationship: r.relationship, anonymous: r.anonymous, status: r.status,
            receivedAt: r.receivedAt, acknowledgedAt: r.acknowledgedAt ?? '', closedAt: r.closedAt ?? '',
            assignedTo: r.assignedUserId ? names.get(r.assignedUserId) ?? '' : '', referral: r.referral ?? '',
          })),
        },
      ],
    },
    {
      number: 6, title: 'Monitoring and audit reports', folder: '6-monitoring',
      files: [
        { path: 'compliance-scores.csv', rows: requirements as unknown as Rows, columns: ['framework', 'id', 'name', 'status', 'evidence', 'recommendation'] },
        { path: 'detection-activity.csv', rows: recordRows(data, 'detection') },
        { path: 'audit-trail.csv', rows: auditRows, columns: ['createdAt', 'eventType', 'actorEmail', 'resourceType', 'resourceId', 'details'] },
      ],
    },
    {
      number: 7, title: 'Incident logs and responses', folder: '7-incidents',
      files: [{ path: 'incidents.csv', rows: data.incidents as unknown as Rows }, { path: 'losses-and-recoveries.csv', rows: recordRows(data, 'loss') }],
    },
    {
      number: 8, title: 'Board minutes showing oversight', folder: '8-board-oversight',
      files: [
        { path: 'board-minutes.csv', rows: recordRows(data, 'board_minute') },
        { path: 'senior-management.csv', rows: data.seniorManagers.map((m) => ({ name: m.userName ?? '', role: m.role, lastReviewed: m.lastReviewed ?? '', reviewNotes: m.reviewNotes ?? '' })) },
      ],
    },
  ];
}

const STATUS_LABEL: Record<string, string> = { met: 'Met', partial: 'Partly met', not_met: 'Not met' };

function summaryHtml(args: {
  organisation: string; generatedAt: Date; generatedBy: string; eccta: { score: number; requirements: Requirement[] };
  govsScore: number; items: EvidenceItem[];
}): string {
  const { organisation, generatedAt, generatedBy, eccta, govsScore, items } = args;
  const principleRows = eccta.requirements.map((r, i) => `<tr><td>${i + 1}. ${esc(r.name)}</td><td class="s-${r.status}">${STATUS_LABEL[r.status]}</td><td>${esc(r.evidence)}${r.recommendation ? `<br/><span class="muted">Next step: ${esc(r.recommendation)}</span>` : ''}</td></tr>`).join('');
  const itemRows = items.map((it) => {
    const count = it.files.reduce((n, f) => n + f.rows.length, 0);
    return `<tr><td>${it.number}. ${esc(it.title)}</td><td class="num">${count}</td><td>${it.files.map((f) => `${esc(it.folder)}/${esc(f.path)} (${f.rows.length})`).join('<br/>')}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"/><title>ECCTA evidence pack — ${esc(organisation)}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0b0c0c; font-size: 10pt; line-height: 1.4; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; } h2 { font-size: 12.5pt; margin: 18px 0 6px; border-bottom: 2px solid #1d70b8; padding-bottom: 3px; }
  .muted { color: #505a5f; } table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  th, td { border: 1px solid #b1b4b6; padding: 4px 6px; text-align: left; vertical-align: top; } th { background: #f3f2f1; }
  tr { break-inside: avoid; } .num { text-align: right; } td[class^="s-"] { white-space: nowrap; } .s-met { color: #00703c; font-weight: 600; } .s-partial { color: #8a4a00; font-weight: 600; } .s-not_met { color: #a4211b; font-weight: 600; }
</style></head><body>
  <p class="muted">FRAUD-RISK.CO.UK · ECCTA 2023 evidence pack</p>
  <h1>${esc(organisation)}</h1>
  <p class="muted">Generated ${esc(day(generatedAt.toISOString()))} by ${esc(generatedBy)} · ECCTA readiness ${eccta.score}% · GovS 013 alignment ${govsScore}%</p>
  <h2>Reasonable procedures: the six principles</h2>
  <table><thead><tr><th>Principle</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${principleRows}</tbody></table>
  <h2>Evidence held</h2>
  <p>The records behind each item are in this pack as CSV files, one folder per item. Counts are records held on the date above.</p>
  <table><thead><tr><th>Evidence</th><th class="num">Records</th><th>Files</th></tr></thead><tbody>${itemRows}</tbody></table>
  <p class="muted">Speak-up case logs leave out report text and reporter identity. Assessment answers stay in the platform. This pack supports, but does not replace, legal advice on the Economic Crime and Corporate Transparency Act 2023 or a formal GovS 013 assurance review.</p>
</body></html>`;
}

async function auditRowsFor(orgId: string): Promise<Rows> {
  if (hasDatabase()) return (await dbListAuditEvents(orgId, 5000, 0)).events as unknown as Rows;
  return auditEvents.filter((e) => e.organisationId === orgId).slice(-5000).reverse() as unknown as Rows;
}

export type EvidencePack = { filename: string; zip: Buffer; files: string[]; pdf: boolean };

/** Builds the pack. The PDF summary is best effort: if rendering fails, the HTML summary still goes in. */
export async function buildEvidencePack(orgId: string, generatedBy: string, options: { includePdf?: boolean; now?: Date } = {}): Promise<EvidencePack> {
  const now = options.now ?? new Date();
  const [data, auditRows, org] = await Promise.all([
    loadComplianceData(orgId),
    auditRowsFor(orgId),
    hasDatabase() ? dbGetOrganisationById(orgId) : Promise.resolve(organisationsById.get(orgId) ?? null),
  ]);
  const metrics = computeMetrics(data, now.getTime());
  const eccta = evaluateEccta(data, metrics, now.getTime());
  const govs = evaluateGovS013(data, metrics, now.getTime());
  const requirements = [
    ...eccta.requirements.map((r) => ({ framework: 'ECCTA 2023', ...r })),
    ...govs.requirements.map((r) => ({ framework: 'GovS 013', ...r })),
  ] as unknown as Requirement[];

  const organisation = org?.name ?? 'Organisation';
  const items = evidenceItems(data, requirements, auditRows);
  const html = summaryHtml({ organisation, generatedAt: now, generatedBy, eccta, govsScore: govs.score, items });

  const entries: ZipEntry[] = [{ name: '00-summary.html', data: html }];
  let pdf = false;
  if (options.includePdf !== false) {
    try {
      entries.unshift({ name: '00-summary.pdf', data: await renderHtmlToPdf(html) });
      pdf = true;
    } catch (err: unknown) {
      logger.warn('Evidence pack PDF summary skipped', { error: err instanceof Error ? err.message : String(err) });
    }
  }
  for (const item of items) {
    for (const f of item.files) {
      // Leading BOM so Excel opens the UTF-8 files correctly
      const body = f.rows.length || f.columns ? toCsv(f.rows, f.columns) : 'No records held on this date\r\n';
      entries.push({ name: `${item.folder}/${f.path}`, data: '﻿' + body });
    }
  }

  const date = now.toISOString().slice(0, 10);
  return { filename: `eccta-evidence-pack-${slug(organisation)}-${date}.zip`, zip: createZip(entries, now), files: entries.map((e) => e.name), pdf };
}
