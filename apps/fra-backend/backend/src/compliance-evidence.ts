// ============================================================
// Compliance evidence — gathers an organisation's data and evaluates it
// against ECCTA 2023 "reasonable procedures" and GovS 013 counter-fraud indicators.
// These are self-assessment indicators built from what Stop FRA records;
// they are not a legal opinion or certification.
// ============================================================

import type {
  Assessment, AuditEvent, ComplianceIncident, Keypass, RiskRegisterEntry, SeniorManager, User,
} from './types.js';
import { hasDatabase } from './helpers.js';
import {
  assessmentsById, auditEvents, counterFraudRecordsById, incidentsById, keypassesByCode, riskRegisterById, seniorManagersById, usersByEmail,
} from './stores.js';
import {
  dbListAssessmentsByOrganisation, dbListKeypassesByOrganisation, dbListRisks, dbListUsersByOrganisation,
} from './db/index.js';
import {
  dbListAuditEvents, dbListIncidents, dbListSeniorManagers, dbListTrainingRecords, type TrainingRecord,
} from './db/compliance.js';
import { dbListCounterFraudRecords } from './db/counter-fraud.js';
import { BOARD_BODIES, dueDiligenceStatus, recordsOf, type CounterFraudRecord } from './counter-fraud.js';
import { getIntakeByOrg, listReports } from './speak-up-store.js';
import { TRIAGE_DAYS, type SpeakUpReport } from './speak-up.js';
import { latestSubmittedByUser, scoreAssessment, type AssessmentRisk, type RiskPriority } from './assessment-risk.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (iso: string | undefined, now: number) => (iso ? (now - new Date(iso).getTime()) / DAY_MS : Infinity);

export type OrgComplianceData = {
  users: User[];
  assessments: Assessment[];
  keypasses: Keypass[];
  risks: RiskRegisterEntry[];
  incidents: ComplianceIncident[];
  seniorManagers: SeniorManager[];
  training: TrainingRecord[];
  /** Strategy, losses, investigators, detection, gifts, conflicts and policies (GovS 013 components 2, 8–10, 12) */
  records: CounterFraudRecord[];
  /** Speak-up intake and the cases received (GovS 013 component 7) */
  speakUp: { intakeEnabled: boolean; reports: SpeakUpReport[] };
  auditEventCount: number;
};

async function loadSpeakUp(orgId: string): Promise<OrgComplianceData['speakUp']> {
  const [intake, reports] = await Promise.all([getIntakeByOrg(orgId), listReports(orgId)]);
  return { intakeEnabled: !!intake?.enabled, reports };
}

export async function loadComplianceData(orgId: string): Promise<OrgComplianceData> {
  if (hasDatabase()) {
    const [users, assessments, keypasses, risks, incidents, seniorManagers, training, records, speakUp, audit] = await Promise.all([
      dbListUsersByOrganisation(orgId),
      dbListAssessmentsByOrganisation(orgId),
      dbListKeypassesByOrganisation(orgId),
      dbListRisks(orgId),
      dbListIncidents(orgId),
      dbListSeniorManagers(orgId),
      dbListTrainingRecords(orgId),
      dbListCounterFraudRecords(orgId),
      loadSpeakUp(orgId),
      dbListAuditEvents(orgId, 1, 0),
    ]);
    return { users, assessments, keypasses, risks, incidents, seniorManagers, training, records, speakUp, auditEventCount: audit.total };
  }

  const users = Array.from(usersByEmail.values()).filter((u) => u.organisationId === orgId);
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return {
    users,
    assessments: Array.from(assessmentsById.values()).filter((a) => a.organisationId === orgId),
    keypasses: Array.from(keypassesByCode.values()).filter((k) => k.organisationId === orgId),
    risks: Array.from(riskRegisterById.values()).filter((r) => r.organisationId === orgId),
    incidents: Array.from(incidentsById.values()).filter((i) => i.organisationId === orgId),
    seniorManagers: Array.from(seniorManagersById.values())
      .filter((m) => m.organisationId === orgId)
      .map((m) => ({ ...m, userName: nameById.get(m.userId) })),
    training: [], // workshop progress is only stored in the database
    records: Array.from(counterFraudRecordsById.values()).filter((r) => r.organisationId === orgId),
    speakUp: await loadSpeakUp(orgId),
    auditEventCount: auditEvents.filter((e: AuditEvent) => e.organisationId === orgId).length,
  };
}

// ── Assessment risk roll-up ─────────────────────────────────────

export type EmployeeRisk = { userId: string; name: string; email: string; department: string | null; risk: AssessmentRisk; submittedAt?: string };

export function employeeRisks(data: OrgComplianceData): EmployeeRisk[] {
  const latest = latestSubmittedByUser(data.assessments);
  return data.users.flatMap((u) => {
    const a = latest.get(u.id);
    if (!a) return [];
    return [{ userId: u.id, name: u.name, email: u.email, department: u.department ?? null, risk: scoreAssessment(a), submittedAt: a.submittedAt }];
  });
}

const PRIORITY_RANK: Record<RiskPriority, number> = { high: 3, medium: 2, low: 1 };

export type AreaRisk = { area: string; employeesFlagged: number; highestPriority: RiskPriority; averageResidual: number; titles: string[] };

export function riskByArea(employees: EmployeeRisk[]): AreaRisk[] {
  const areas = new Map<string, { flagged: Set<string>; highest: RiskPriority; residuals: number[]; titles: Set<string> }>();
  for (const e of employees) {
    for (const r of e.risk.risks) {
      if (r.area === 'Overall') continue;
      const entry = areas.get(r.area) ?? { flagged: new Set(), highest: 'low' as RiskPriority, residuals: [], titles: new Set() };
      entry.flagged.add(e.userId);
      entry.residuals.push(r.residualScore);
      entry.titles.add(r.title);
      if (PRIORITY_RANK[r.priority] > PRIORITY_RANK[entry.highest]) entry.highest = r.priority;
      areas.set(r.area, entry);
    }
  }
  return Array.from(areas.entries())
    .map(([area, v]) => ({
      area,
      employeesFlagged: v.flagged.size,
      highestPriority: v.highest,
      averageResidual: Math.round((v.residuals.reduce((s, n) => s + n, 0) / v.residuals.length) * 10) / 10,
      titles: Array.from(v.titles),
    }))
    .sort((a, b) => PRIORITY_RANK[b.highestPriority] - PRIORITY_RANK[a.highestPriority] || b.employeesFlagged - a.employeesFlagged);
}

// Assessment areas → risk register area keys used by the dashboard
export const AREA_TO_REGISTER: Record<string, string> = {
  'Procurement': 'procurement',
  'Cash & Banking': 'cash_banking',
  'Payroll & HR': 'payroll_hr',
  'Revenue': 'revenue',
  'IT Systems': 'it_systems',
  'People & Culture': 'governance',
  'Controls': 'governance',
  'Culture': 'governance',
  'Training': 'governance',
  'Monitoring': 'governance',
  'Governance': 'governance',
  'Fraud Response': 'governance',
};

// ── Framework evaluation ────────────────────────────────────────

export type RequirementStatus = 'met' | 'partial' | 'not_met';
export type Requirement = {
  id: string;
  name: string;
  status: RequirementStatus;
  evidence: string;
  recommendation?: string;
};
export type FrameworkResult = { score: number; requirements: Requirement[] };

const scoreOf = (reqs: Requirement[]) =>
  reqs.length === 0 ? 0 : Math.round((reqs.reduce((s, r) => s + (r.status === 'met' ? 1 : r.status === 'partial' ? 0.5 : 0), 0) / reqs.length) * 100);

export type ComplianceMetrics = {
  employees: number;
  employeesAssessed: number;
  assessmentCoverage: number;
  riskLevels: Record<RiskPriority | 'not_scored', number>;
  trainingCompleted: number;
  trainingCoverage: number;
  latestAssessmentAt: string | null;
  registerRisks: number;
  openHighRisks: number;
  highRisksWithoutOwnerOrPlan: number;
  registerLastUpdatedAt: string | null;
  openIncidents: number;
  openSeriousIncidents: number;
  seniorManagers: number;
  seniorManagersReviewedInYear: number;
  keypassesIssued: number;
  keypassesUsed: number;
  auditEvents: number;
  lossIdentifiedGbp: number;
  lossRecoveredGbp: number;
  lossesNotReported: number;
  activeInvestigators: number;
  detectionCompletedInYear: number;
  speakUpReportsInYear: number;
  speakUpOpen: number;
  speakUpOverdueForTriage: number;
  associatedPersons: number;
  associatedPersonsOutstanding: number;
  boardFraudItemsInYear: number;
  toneStatementsInYear: number;
};

export function computeMetrics(data: OrgComplianceData, now = Date.now()): ComplianceMetrics {
  const staff = data.users;
  const employees = employeeRisks(data);
  const riskLevels: ComplianceMetrics['riskLevels'] = { high: 0, medium: 0, low: 0, not_scored: 0 };
  for (const e of employees) riskLevels[e.risk.level ?? 'not_scored'] += 1;

  const trainedIds = new Set(data.training.filter((t) => t.completedAt || t.certificateNumber).map((t) => t.userId));
  const openRisks = data.risks.filter((r) => !['mitigated', 'accepted', 'closed'].includes(r.status));
  const openHigh = openRisks.filter((r) => r.priority === 'HIGH');
  const openIncidents = data.incidents.filter((i) => !i.resolvedAt);
  const submitted = data.assessments.filter((a) => a.status === 'submitted' || a.status === 'completed');
  const latestAssessmentAt = submitted.map((a) => a.submittedAt ?? a.updatedAt).sort().at(-1) ?? null;

  return {
    employees: staff.length,
    employeesAssessed: employees.length,
    assessmentCoverage: staff.length ? Math.round((employees.length / staff.length) * 100) : 0,
    riskLevels,
    trainingCompleted: trainedIds.size,
    trainingCoverage: staff.length ? Math.round((trainedIds.size / staff.length) * 100) : 0,
    latestAssessmentAt,
    registerRisks: data.risks.length,
    openHighRisks: openHigh.length,
    highRisksWithoutOwnerOrPlan: openHigh.filter((r) => !r.ownerUserId || !r.actionPlan).length,
    registerLastUpdatedAt: data.risks.map((r) => r.updatedAt).sort().at(-1) ?? null,
    openIncidents: openIncidents.length,
    openSeriousIncidents: openIncidents.filter((i) => i.severity === 'high' || i.severity === 'critical').length,
    seniorManagers: data.seniorManagers.length,
    seniorManagersReviewedInYear: data.seniorManagers.filter((m) => daysAgo(m.lastReviewed, now) <= 365).length,
    keypassesIssued: data.keypasses.filter((k) => k.status !== 'revoked').length,
    keypassesUsed: data.keypasses.filter((k) => k.status === 'used').length,
    auditEvents: data.auditEventCount,
    ...counterFraudMetrics(data.records, now),
    speakUpReportsInYear: data.speakUp.reports.filter((r) => withinYear(r.receivedAt, now)).length,
    speakUpOpen: data.speakUp.reports.filter((r) => r.status !== 'closed').length,
    speakUpOverdueForTriage: data.speakUp.reports.filter((r) => r.status === 'new' && daysAgo(r.receivedAt, now) > TRIAGE_DAYS).length,
    associatedPersons: recordsOf(data.records, 'associated_person').length,
    associatedPersonsOutstanding: recordsOf(data.records, 'associated_person').filter((a) => dueDiligenceOutstanding(a, now)).length,
    boardFraudItemsInYear: recordsOf(data.records, 'board_minute').filter((b) => BOARD_BODIES.includes(b.data.body) && withinYear(b.data.meetingDate, now)).length,
    toneStatementsInYear: recordsOf(data.records, 'tone_statement').filter((t) => withinYear(t.data.issuedAt, now)).length,
  };
}

const todayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const withinYear = (date: string | undefined, now: number) => !!date && daysAgo(date, now) <= 365;

function counterFraudMetrics(records: CounterFraudRecord[], now: number) {
  const today = todayOf(now);
  const losses = recordsOf(records, 'loss');
  return {
    lossIdentifiedGbp: losses.reduce((s, l) => s + l.data.amountGbp, 0),
    lossRecoveredGbp: losses.reduce((s, l) => s + l.data.recoveredGbp, 0),
    // Losses identified over 30 days ago that have not been reported to the centre
    lossesNotReported: losses.filter((l) => !l.data.reportedToCentreAt && daysAgo(l.data.identifiedAt, now) > 30).length,
    activeInvestigators: recordsOf(records, 'investigator').filter((i) => !i.data.agreementEndsAt || i.data.agreementEndsAt >= today).length,
    detectionCompletedInYear: recordsOf(records, 'detection').filter((d) => d.data.status === 'completed' && withinYear(d.data.completedAt, now)).length,
  };
}

/** ECCTA 2023 failure to prevent fraud — the six principles in the Home Office guidance on reasonable procedures. */
export function evaluateEccta(data: OrgComplianceData, m: ComplianceMetrics, now = Date.now()): FrameworkResult {
  const lastAssessmentDays = daysAgo(m.latestAssessmentAt ?? undefined, now);
  const areas = riskByArea(employeeRisks(data));
  const supplierFlagged = areas.some((a) => a.area === 'Procurement');
  const procurementInRegister = data.risks.some((r) => r.riskArea === 'procurement' && !!r.controls);
  const seriousOpenOld = data.incidents.filter(
    (i) => !i.resolvedAt && (i.severity === 'high' || i.severity === 'critical') && daysAgo(i.reportedAt, now) > 30
  ).length;

  const requirements: Requirement[] = [
    topLevelCommitmentRequirement(m),

    lastAssessmentDays <= 365
      ? { id: 'eccta-2', name: 'Risk assessment', status: 'met', evidence: `Latest fraud risk assessment submitted ${Math.floor(lastAssessmentDays)} day(s) ago; ${m.assessmentCoverage}% of staff assessed.` }
      : m.latestAssessmentAt
        ? { id: 'eccta-2', name: 'Risk assessment', status: 'partial', evidence: 'The latest fraud risk assessment is more than 12 months old.', recommendation: 'Repeat the fraud risk assessment — at least annually, and after significant change.' }
        : { id: 'eccta-2', name: 'Risk assessment', status: 'not_met', evidence: 'No fraud risk assessment has been submitted.', recommendation: 'Complete the 13-area fraud risk assessment.' },

    m.registerRisks === 0
      ? { id: 'eccta-3', name: 'Proportionate risk-based prevention procedures', status: 'not_met', evidence: 'The risk register is empty.', recommendation: 'Record identified fraud risks with controls, owners and action plans in the risk register.' }
      : m.highRisksWithoutOwnerOrPlan === 0
        ? { id: 'eccta-3', name: 'Proportionate risk-based prevention procedures', status: 'met', evidence: `${m.registerRisks} risk(s) in the register; every open high risk has an owner and an action plan.` }
        : { id: 'eccta-3', name: 'Proportionate risk-based prevention procedures', status: 'partial', evidence: `${m.highRisksWithoutOwnerOrPlan} open high risk(s) lack an owner or an action plan.`, recommendation: 'Assign an owner and an action plan to every open high risk.' },

    dueDiligenceRequirement(data, m, now, supplierFlagged, procurementInRegister),

    m.trainingCoverage >= 80
      ? { id: 'eccta-5', name: 'Communication (including training)', status: 'met', evidence: `${m.trainingCoverage}% of staff have completed fraud awareness training.` }
      : m.trainingCompleted > 0
        ? { id: 'eccta-5', name: 'Communication (including training)', status: 'partial', evidence: `${m.trainingCoverage}% of staff have completed fraud awareness training.`, recommendation: 'Extend fraud awareness training to at least 80% of staff.' }
        : { id: 'eccta-5', name: 'Communication (including training)', status: 'not_met', evidence: 'No staff have completed fraud awareness training.', recommendation: 'Run the staff fraud awareness workshop and issue certificates.' },

    lastAssessmentDays <= 120 && seriousOpenOld === 0 && daysAgo(m.registerLastUpdatedAt ?? undefined, now) <= 90
      ? { id: 'eccta-6', name: 'Monitoring and review', status: 'met', evidence: 'Assessment in the last quarter, risk register reviewed in the last 90 days, no serious incidents open over 30 days.' }
      : lastAssessmentDays <= 365
        ? { id: 'eccta-6', name: 'Monitoring and review', status: 'partial', evidence: [
            lastAssessmentDays > 120 ? 'no assessment in the last quarter' : null,
            daysAgo(m.registerLastUpdatedAt ?? undefined, now) > 90 ? 'risk register not reviewed in 90 days' : null,
            seriousOpenOld ? `${seriousOpenOld} serious incident(s) open over 30 days` : null,
          ].filter(Boolean).join('; ').replace(/^./, (c) => c.toUpperCase()) + '.', recommendation: 'Reassess quarterly, review the risk register at least every 90 days and close serious incidents promptly.' }
        : { id: 'eccta-6', name: 'Monitoring and review', status: 'not_met', evidence: 'No monitoring activity in the last 12 months.', recommendation: 'Set a quarterly reassessment and risk register review cycle.' },
  ];

  return { score: scoreOf(requirements), requirements };
}

/** GovS 013 (Counter Fraud functional standard) indicators that Stop FRA can evidence. */
export function evaluateGovS013(data: OrgComplianceData, m: ComplianceMetrics, now = Date.now()): FrameworkResult {
  const lastAssessmentDays = daysAgo(m.latestAssessmentAt ?? undefined, now);
  const registerAreas = new Set(data.risks.map((r) => r.riskArea));
  const unregistered = riskByArea(employeeRisks(data))
    .filter((a) => AREA_TO_REGISTER[a.area] && !registerAreas.has(AREA_TO_REGISTER[a.area]));

  const requirements: Requirement[] = [
    m.seniorManagers > 0
      ? { id: 'govs-1', name: 'Accountable individual and governance', status: 'met', evidence: `${m.seniorManagers} accountable senior manager(s) recorded.` }
      : { id: 'govs-1', name: 'Accountable individual and governance', status: 'not_met', evidence: 'No accountable individual recorded.', recommendation: 'Name the board-level owner for counter-fraud.' },

    lastAssessmentDays <= 365 && m.assessmentCoverage >= 50
      ? { id: 'govs-2', name: 'Fraud risk assessment', status: 'met', evidence: `Assessed within 12 months; ${m.assessmentCoverage}% of staff covered.` }
      : m.latestAssessmentAt
        ? { id: 'govs-2', name: 'Fraud risk assessment', status: 'partial', evidence: `${m.assessmentCoverage}% of staff covered; latest assessment ${Math.floor(lastAssessmentDays)} day(s) ago.`, recommendation: 'Assess at least half of staff every year, covering all business areas.' }
        : { id: 'govs-2', name: 'Fraud risk assessment', status: 'not_met', evidence: 'No assessment submitted.', recommendation: 'Complete the fraud risk assessment.' },

    m.registerRisks > 0 && unregistered.length === 0 && m.highRisksWithoutOwnerOrPlan === 0
      ? { id: 'govs-3', name: 'Risk register and action plan', status: 'met', evidence: 'Every assessed risk area is in the register and high risks have owners and plans.' }
      : m.registerRisks > 0
        ? { id: 'govs-3', name: 'Risk register and action plan', status: 'partial', evidence: [
            unregistered.length ? `Not in register: ${unregistered.map((a) => a.area).join(', ')}` : null,
            m.highRisksWithoutOwnerOrPlan ? `${m.highRisksWithoutOwnerOrPlan} high risk(s) without owner or plan` : null,
          ].filter(Boolean).join('. ') + '.', recommendation: 'Add every assessed risk area to the register with an owner and action plan.' }
        : { id: 'govs-3', name: 'Risk register and action plan', status: 'not_met', evidence: 'The risk register is empty.', recommendation: 'Start the risk register from the assessment results.' },

    policyAndResponseRequirement(data, now),

    m.trainingCoverage >= 80
      ? { id: 'govs-5', name: 'Counter-fraud training', status: 'met', evidence: `${m.trainingCoverage}% of staff trained.` }
      : { id: 'govs-5', name: 'Counter-fraud training', status: m.trainingCompleted > 0 ? 'partial' : 'not_met', evidence: `${m.trainingCoverage}% of staff trained.`, recommendation: 'Train at least 80% of staff in fraud awareness.' },

    m.auditEvents > 0
      ? { id: 'govs-6', name: 'Records and audit trail', status: 'met', evidence: `${m.auditEvents} audit event(s) retained for this organisation.` }
      : { id: 'govs-6', name: 'Records and audit trail', status: 'not_met', evidence: 'No audit events recorded.', recommendation: 'Use the platform for assessments and reviews so actions are logged.' },

    strategyRequirement(data.records, now),
    lossRequirement(data.records, m),
    investigatorRequirement(data.records, m),
    detectionRequirement(data.records, m),
    giftsAndInterestsRequirement(data.records, now),
    reportingRoutesRequirement(data, m),
  ];

  return { score: scoreOf(requirements), requirements };
}

// ── GovS 013 components held as counter-fraud records ───────────

const fmtGbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
// "2026-09-15" → "15 September 2026"; dates are calendar days, so read them in UTC
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Component 2: an approved strategy whose period covers today. */
function strategyRequirement(records: CounterFraudRecord[], now: number): Requirement {
  const today = todayOf(now);
  const strategies = recordsOf(records, 'strategy');
  const current = strategies.find((s) => s.data.status !== 'draft' && s.data.periodStart <= today && s.data.periodEnd >= today);
  const name = 'Counter fraud strategy';
  if (current) {
    return {
      id: 'govs-7', name, status: 'met',
      evidence: `"${current.data.title}" approved ${current.data.approvedAt ? fmtDay(current.data.approvedAt) : ''}, covering ${fmtDay(current.data.periodStart)} to ${fmtDay(current.data.periodEnd)}${current.data.submittedToCentreAt ? `; submitted to the centre ${fmtDay(current.data.submittedToCentreAt)}` : ''}.`,
    };
  }
  if (strategies.length > 0) {
    return {
      id: 'govs-7', name, status: 'partial',
      evidence: strategies.some((s) => s.data.status === 'draft') ? 'A strategy is in draft but not yet approved.' : 'The approved strategy does not cover today.',
      recommendation: 'Approve a counter fraud, bribery and corruption strategy for the current period and submit it to the centre where required.',
    };
  }
  return { id: 'govs-7', name, status: 'not_met', evidence: 'No counter fraud strategy recorded.', recommendation: 'Record the board-approved counter fraud, bribery and corruption strategy.' };
}

/** Component 8: losses and recoveries recorded and reported to the centre. */
function lossRequirement(records: CounterFraudRecord[], m: ComplianceMetrics): Requirement {
  const losses = recordsOf(records, 'loss');
  const name = 'Identified loss reporting';
  if (losses.length === 0) {
    return {
      id: 'govs-8', name, status: 'partial', evidence: 'No losses or recoveries recorded.',
      recommendation: 'Record identified fraud, bribery and corruption losses and recoveries, or confirm there were none.',
    };
  }
  const totals = `${losses.length} loss record(s): ${fmtGbp(m.lossIdentifiedGbp)} identified, ${fmtGbp(m.lossRecoveredGbp)} recovered`;
  return m.lossesNotReported === 0
    ? { id: 'govs-8', name, status: 'met', evidence: `${totals}; none overdue for reporting to the centre.` }
    : { id: 'govs-8', name, status: 'partial', evidence: `${totals}; ${m.lossesNotReported} not reported to the centre after 30 days.`, recommendation: 'Report identified losses and recoveries to the centre using the government definitions.' };
}

/** Component 9: an agreement giving access to trained investigators. */
function investigatorRequirement(records: CounterFraudRecord[], m: ComplianceMetrics): Requirement {
  const name = 'Access to trained investigators';
  if (m.activeInvestigators > 0) {
    return { id: 'govs-9', name, status: 'met', evidence: `${m.activeInvestigators} investigator arrangement(s) in place.` };
  }
  return recordsOf(records, 'investigator').length > 0
    ? { id: 'govs-9', name, status: 'partial', evidence: 'Every recorded investigator agreement has ended.', recommendation: 'Renew access to accredited counter fraud investigators.' }
    : { id: 'govs-9', name, status: 'not_met', evidence: 'No investigator access recorded.', recommendation: 'Agree access to investigators meeting the public sector counter fraud standard, in-house or contracted.' };
}

/** Component 10: detection activity completed in the last 12 months. */
function detectionRequirement(records: CounterFraudRecord[], m: ComplianceMetrics): Requirement {
  const name = 'Detection activity';
  if (m.detectionCompletedInYear > 0) {
    return { id: 'govs-10', name, status: 'met', evidence: `${m.detectionCompletedInYear} detection exercise(s) completed in the last 12 months.` };
  }
  return recordsOf(records, 'detection').some((d) => d.data.status !== 'completed')
    ? { id: 'govs-10', name, status: 'partial', evidence: 'Detection activity is planned or under way; none completed in the last 12 months.', recommendation: 'Complete detection work in the highest-risk areas and record what it found.' }
    : { id: 'govs-10', name, status: 'not_met', evidence: 'No detection activity recorded.', recommendation: 'Plan detection activity, such as data matching or loss measurement, in high-risk areas.' };
}

/**
 * Component 4: a counter fraud policy and a fraud response plan, both approved and within their review date,
 * with the plan shown to work: no serious incident left open for over 30 days.
 */
function policyAndResponseRequirement(data: OrgComplianceData, now: number): Requirement {
  const id = 'govs-4';
  const name = 'Fraud policy and response plan';
  const today = todayOf(now);
  const policies = recordsOf(data.records, 'policy');
  const state = (type: 'counter_fraud' | 'response_plan', label: string) => {
    const held = policies.filter((p) => p.data.policyType === type);
    const current = held.find((p) => p.data.reviewDue >= today);
    if (current) return { ok: true, held: true, text: `${label} "${current.data.title}" approved ${fmtDay(current.data.approvedAt)}, review due ${fmtDay(current.data.reviewDue)}` };
    if (held.length) {
      const latest = held.map((p) => p.data.reviewDue).sort().at(-1)!;
      return { ok: false, held: true, text: `${label} past its review date (${fmtDay(latest)})` };
    }
    return { ok: false, held: false, text: `no ${label} recorded` };
  };
  const policy = state('counter_fraud', 'counter fraud policy');
  const plan = state('response_plan', 'fraud response plan');
  const seriousOpenOld = data.incidents.filter(
    (i) => !i.resolvedAt && (i.severity === 'high' || i.severity === 'critical') && daysAgo(i.reportedAt, now) > 30,
  ).length;
  const responseOk = seriousOpenOld === 0;
  const responseText = responseOk
    ? (data.incidents.length ? `${data.incidents.length} incident(s) logged, none serious and open over 30 days` : null)
    : `${seriousOpenOld} serious incident(s) open over 30 days`;
  const sentence = (items: (string | null)[]) => items.filter(Boolean).join('; ').replace(/^./, (c) => c.toUpperCase()) + '.';

  if (policy.ok && plan.ok && responseOk) {
    return { id, name, status: 'met', evidence: sentence([policy.text, plan.text, responseText]) };
  }
  // The assessment can say a plan exists, but only a recorded, approved document evidences it
  const latest = data.assessments
    .filter((a) => a.status === 'submitted' || a.status === 'completed')
    .sort((a, b) => (a.submittedAt ?? a.updatedAt).localeCompare(b.submittedAt ?? b.updatedAt))
    .at(-1);
  // Web answers are flat ("fraudResponse.responsePlan"); mobile answers are nested by module
  const answers = (latest?.answers ?? {}) as Record<string, unknown>;
  const nested = answers.fraudResponse;
  const answer = answers['fraudResponse.responsePlan']
    ?? (nested && typeof nested === 'object' ? (nested as Record<string, unknown>).responsePlan : undefined);
  const saysPlan = answer === 'yes' || answer === true;
  const recommendation = [
    !policy.ok ? 'Record the board-approved counter fraud policy with its review date.' : null,
    !plan.ok ? 'Record the fraud response plan: who is told, who investigates, how evidence is kept and when to refer to the police or Action Fraud.' : null,
    !responseOk ? 'Follow the response plan to resolve serious incidents within 30 days.' : null,
  ].filter(Boolean).join(' ');

  if (!policy.held && !plan.held && !saysPlan) {
    return { id, name, status: 'not_met', evidence: sentence([policy.text, plan.text, responseText]), recommendation };
  }
  return {
    id, name, status: 'partial',
    evidence: sentence([
      policy.text, plan.text, responseText,
      saysPlan && !plan.held ? 'the latest assessment says a response plan exists, but it is not recorded' : null,
    ]),
    recommendation,
  };
}

/** Component 12: current gifts/hospitality and conflict of interest policies, and registers in use. */
function giftsAndInterestsRequirement(records: CounterFraudRecord[], now: number): Requirement {
  const today = todayOf(now);
  const currentPolicy = (type: 'gifts_hospitality' | 'conflicts_of_interest') =>
    recordsOf(records, 'policy').some((p) => p.data.policyType === type && p.data.reviewDue >= today);
  const policies = [currentPolicy('gifts_hospitality'), currentPolicy('conflicts_of_interest')].filter(Boolean).length;
  const registerInUse = recordsOf(records, 'gift_hospitality').some((g) => withinYear(g.data.date, now))
    || recordsOf(records, 'conflict_of_interest').some((c) => withinYear(c.data.reviewedAt ?? c.data.declaredAt, now));
  const name = 'Gifts, hospitality and conflicts of interest';

  if (policies === 2 && registerInUse) {
    return { id: 'govs-11', name, status: 'met', evidence: 'Both policies are within their review date and the registers were used in the last 12 months.' };
  }
  if (policies === 0 && !registerInUse) {
    return { id: 'govs-11', name, status: 'not_met', evidence: 'No gifts and hospitality or conflict of interest policy or register entries recorded.', recommendation: 'Record both policies and start the gifts, hospitality and conflict of interest registers.' };
  }
  return {
    id: 'govs-11', name, status: 'partial',
    evidence: [
      policies < 2 ? `${policies} of 2 policies within their review date` : null,
      registerInUse ? null : 'no register entries or reviews in the last 12 months',
    ].filter(Boolean).join('; ').replace(/^./, (c) => c.toUpperCase()) + '.',
    recommendation: 'Keep both policies within their review date and record declarations, or nil returns, at least yearly.',
  };
}

/** Component 7: routes for staff, contractors and the public, one allowing anonymous reports, and reports triaged promptly. */
function reportingRoutesRequirement(data: OrgComplianceData, m: ComplianceMetrics): Requirement {
  const routes = recordsOf(data.records, 'reporting_route');
  // The speak-up link is open to anyone who has it and accepts anonymous reports
  const audiences = new Set<string>(data.speakUp.intakeEnabled ? ['staff', 'contractors', 'public'] : []);
  for (const r of routes) {
    audiences.add('staff');
    if (r.data.audience !== 'staff') audiences.add('contractors');
    if (r.data.audience === 'everyone') audiences.add('public');
  }
  const anonymous = data.speakUp.intakeEnabled || routes.some((r) => r.data.anonymousAllowed === 'yes');
  const name = 'Reporting routes';

  if (audiences.size === 0) {
    return { id: 'govs-12', name, status: 'not_met', evidence: 'No reporting routes recorded and the speak-up link is off.', recommendation: 'Switch on the speak-up link and record your other reporting routes.' };
  }
  const missing = ['staff', 'contractors', 'public'].filter((a) => !audiences.has(a));
  const caseload = `${m.speakUpReportsInYear} report(s) received in the last 12 months, ${m.speakUpOpen} open`;
  if (missing.length === 0 && anonymous && m.speakUpOverdueForTriage === 0) {
    return { id: 'govs-12', name, status: 'met', evidence: `Routes cover staff, contractors and the public, including an anonymous route; ${caseload}.` };
  }
  return {
    id: 'govs-12', name, status: 'partial',
    evidence: [
      missing.length ? `No route recorded for ${missing.join(' or ')}` : null,
      anonymous ? null : 'no anonymous route',
      m.speakUpOverdueForTriage ? `${m.speakUpOverdueForTriage} report(s) not reviewed within ${TRIAGE_DAYS} days` : null,
    ].filter(Boolean).join('; ').replace(/^./, (c) => c.toUpperCase()) + `. ${caseload.replace(/^./, (c) => c.toUpperCase())}.`,
    recommendation: m.speakUpOverdueForTriage
      ? `Review every new report within ${TRIAGE_DAYS} days.`
      : 'Offer reporting routes to staff, contractors and the public, including an anonymous one such as the speak-up link.',
  };
}

// ── ECCTA principle 4: due diligence on associated persons ──────

/** Due diligence is outstanding when required checks are missing, or a medium or high risk relationship was not reviewed in 12 months. */
function dueDiligenceOutstanding(a: CounterFraudRecord<'associated_person'>, now: number): boolean {
  return !dueDiligenceStatus(a.data).complete || (a.data.riskLevel !== 'low' && !withinYear(a.data.reviewedAt, now));
}

function dueDiligenceRequirement(
  data: OrgComplianceData, m: ComplianceMetrics, now: number, supplierFlagged: boolean, procurementInRegister: boolean,
): Requirement {
  const name = 'Due diligence';
  const id = 'eccta-4';
  if (m.associatedPersons > 0) {
    const highRisk = recordsOf(data.records, 'associated_person').filter((a) => a.data.riskLevel === 'high').length;
    return m.associatedPersonsOutstanding === 0
      ? { id, name, status: 'met', evidence: `${m.associatedPersons} associated person(s) recorded (${highRisk} high risk); due diligence is complete for each, and medium and high risk relationships were reviewed in the last 12 months.` }
      : { id, name, status: 'partial', evidence: `${m.associatedPersonsOutstanding} of ${m.associatedPersons} associated person(s) have outstanding due diligence checks or a review older than 12 months.`, recommendation: 'Complete the checks each relationship\'s risk level requires and review medium and high risk relationships every year.' };
  }
  // No associated persons recorded: the assessment can show risk, but cannot evidence due diligence
  const record = 'Record the agents, contractors, suppliers and others who act for you, with the due diligence done on each.';
  if (m.employeesAssessed === 0) {
    return { id, name, status: 'not_met', evidence: 'No associated persons recorded and no assessment evidence on third-party controls.', recommendation: record };
  }
  if (supplierFlagged && !procurementInRegister) {
    return { id, name, status: 'not_met', evidence: 'Supplier fraud risk is flagged, but no procurement controls or associated persons are recorded.', recommendation: record };
  }
  return {
    id, name, status: 'partial',
    evidence: supplierFlagged
      ? 'Supplier fraud risk is flagged and procurement controls are recorded, but no associated persons or due diligence records are held.'
      : 'Assessments do not flag supplier fraud risk, but no associated persons or due diligence records are held.',
    recommendation: record,
  };
}

// ── ECCTA principle 1: top-level commitment ─────────────────────

/** Accountable senior managers reviewed, the board overseeing fraud, and leaders saying fraud is not tolerated, all within 12 months. */
function topLevelCommitmentRequirement(m: ComplianceMetrics): Requirement {
  const id = 'eccta-1';
  const name = 'Top-level commitment';
  const managersOk = m.seniorManagers > 0 && m.seniorManagersReviewedInYear === m.seniorManagers;
  const parts = [
    { ok: managersOk, have: `${m.seniorManagers} accountable senior manager(s), all reviewed in the last 12 months`, gap: m.seniorManagers === 0 ? 'no accountable senior managers recorded' : `${m.seniorManagers - m.seniorManagersReviewedInYear} of ${m.seniorManagers} senior manager(s) not reviewed in 12 months` },
    { ok: m.boardFraudItemsInYear > 0, have: `fraud discussed at ${m.boardFraudItemsInYear} board or committee meeting(s)`, gap: 'no board or committee minutes on fraud in 12 months' },
    { ok: m.toneStatementsInYear > 0, have: `${m.toneStatementsInYear} tone-from-the-top statement(s) issued`, gap: 'no tone-from-the-top statement in 12 months' },
  ];
  const met = parts.filter((p) => p.ok);
  const sentence = (items: string[]) => items.join('; ').replace(/^./, (c) => c.toUpperCase()) + '.';
  if (met.length === parts.length) return { id, name, status: 'met', evidence: sentence(parts.map((p) => p.have)) };
  return {
    id, name, status: met.length === 0 && m.seniorManagers === 0 ? 'not_met' : 'partial',
    evidence: sentence([...met.map((p) => p.have), ...parts.filter((p) => !p.ok).map((p) => p.gap)]),
    recommendation: 'Review each accountable senior manager yearly, minute the board\'s oversight of fraud risk, and have leaders state that fraud will not be tolerated.',
  };
}
