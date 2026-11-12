#!/usr/bin/env node
// End-to-end smoke test of the API in database mode. Unit tests use the in-memory stores,
// so this is what exercises the real SQL: run it against a migrated PostgreSQL with the
// backend started on API_URL (default http://localhost:3000/api/v1).
//
//   DATABASE_URL=... pnpm migrate && DATABASE_URL=... pnpm dev &
//   node scripts/db-smoke.mjs
//
// SMOKE_SKIP_PDF=1 skips the checks that need a headless browser for PDF rendering.

import crypto from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const SKIP_PDF = process.env.SMOKE_SKIP_PDF === '1';
const PASSWORD = `Smoke-${crypto.randomBytes(12).toString('base64url')}1!`;
const RUN = crypto.randomBytes(3).toString('hex');
const results = [];

async function call(method, path, body, token, { raw = false } = {}) {
  const headers = { Origin: 'http://localhost:8080' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const buf = Buffer.from(await res.arrayBuffer());
  if (raw && res.ok) return [res.status, buf];
  try { return [res.status, JSON.parse(buf.toString('utf8'))]; } catch { return [res.status, buf]; }
}

function check(name, status, expected, payload) {
  const ok = (Array.isArray(expected) ? expected : [expected]).includes(status);
  results.push({ ok, name, status, error: ok ? null : (payload?.error ?? String(payload).slice(0, 160)) });
  return ok;
}
const expect = (name, condition, detail) => check(name, condition ? 200 : 500, 200, { error: detail });
const data = (p) => (p && typeof p === 'object' ? p.data : undefined);

/** File names in a ZIP, from its central directory. */
function zipEntries(buf) {
  const files = new Map();
  let at = 0;
  while (buf.readUInt32LE(at) === 0x04034b50) {
    const method = buf.readUInt16LE(at + 8), size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26), extraLen = buf.readUInt16LE(at + 28);
    const name = buf.subarray(at + 30, at + 30 + nameLen).toString('utf8');
    const start = at + 30 + nameLen + extraLen;
    const body = buf.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(body) : body);
    at = start + size;
  }
  return files;
}

async function signup(email, name, organisationName) {
  const [s, p] = await call('POST', '/auth/signup', { email, password: PASSWORD, name, organisationName, sector: 'private' });
  check(`signup ${email}`, s, [200, 201], p);
  const [ls] = await call('POST', '/auth/login', { email, password: PASSWORD });
  check('login blocked until email confirmed', ls, 403);
  // The server runs in development here, so sign-up hands back the confirmation token
  const [vs, vp] = await call('POST', '/auth/verify-email', { token: data(p)?.verificationToken });
  check(`verify-email ${email}`, vs, 200, vp);
  return data(vp)?.accessToken;
}

async function buy(token, packageId) {
  let [s, p] = await call('POST', '/purchases', { packageId, client: 'web' }, token);
  if (!check(`purchase ${packageId}`, s, 200, p)) return;
  const { purchaseId, paymentIntentId } = data(p);
  [s, p] = await call('POST', `/purchases/${purchaseId}/confirm`, { paymentIntentId }, token);
  check(`confirm ${packageId}`, s, 200, p);
}

const today = new Date().toISOString().slice(0, 10);

// ── Accounts, packages, organisation ────────────────────────────
const ent = await signup(`smoke-ent-${RUN}@example.test`, 'Smoke Enterprise', 'Smoke Enterprise Ltd');
await buy(ent, 'pkg_full');
let [s, p] = await call('GET', '/entitlements', undefined, ent);
expect('entitlement is Enterprise', data(p)?.packageName === 'Enterprise', data(p));
[s, p] = await call('GET', '/auth/me', undefined, ent); check('auth/me', s, 200, p);
const { organisationId: orgId, userId } = data(p) ?? {};
[s, p] = await call('GET', `/organisations/${orgId}`, undefined, ent); check('organisation get', s, 200, p);
[s, p] = await call('PATCH', `/organisations/${orgId}`, { name: 'Smoke Enterprise Ltd (renamed)' }, ent); check('organisation patch', s, 200, p);
[s, p] = await call('PATCH', '/auth/profile', { department: 'Finance' }, ent); check('profile department', s, 200, p);
[s, p] = await call('GET', '/auth/me', undefined, ent); expect('department round-trips', data(p)?.department === 'Finance', data(p));

const starter = await signup(`smoke-starter-${RUN}@example.test`, 'Smoke Starter', 'Smoke Starter Ltd');
await buy(starter, 'pkg_basic');
[s, p] = await call('GET', '/compliance/report', undefined, starter); check('starter blocked from compliance', s, 403, p);
[s, p] = await call('POST', '/purchases', { packageId: 'pkg_basic' }, starter); check('one-time package cannot be re-bought', s, 409, p);

// ── Assessment ──────────────────────────────────────────────────
const answers = { 'procurement.dueDiligenceLevel': 2, 'procurement.controlMaturity': 2, 'procurement.recentFraud': 'yes', 'fraudResponse.responsePlan': 'no' };
[s, p] = await call('POST', '/assessments', { title: 'Smoke FRA', answers }, ent); check('assessment create', s, [200, 201], p);
const assessmentId = data(p)?.id;
[s, p] = await call('PATCH', `/assessments/${assessmentId}`, { answers: { ...answers, 'payroll.segregation': 2 } }, ent); check('assessment patch', s, 200, p);
[s, p] = await call('POST', `/assessments/${assessmentId}/submit`, {}, ent); check('assessment submit', s, 200, p);
[s, p] = await call('GET', `/assessments/${assessmentId}/results`, undefined, ent); check('assessment results', s, 200, p);
[s, p] = await call('GET', '/assessments', undefined, ent); check('assessments list', s, 200, p);
[s, p] = await call('GET', '/assessments/reassessment', undefined, ent); check('reassessment status', s, 200, p);
if (!SKIP_PDF) {
  [s, p] = await call('GET', `/assessments/${assessmentId}/export-pdf`, undefined, ent, { raw: true });
  if (check('assessment PDF', s, 200, p)) expect('PDF is a PDF', p.subarray(0, 4).toString() === '%PDF');
}

// ── Risk register ───────────────────────────────────────────────
[s, p] = await call('POST', '/risk-register', {
  title: 'Supplier bank detail fraud', riskArea: 'procurement', impact: 5, likelihood: 4, controlEffectiveness: 'some_gaps',
  ownerUserId: userId, actionPlan: 'Call-back checks', dueDate: '2026-12-31',
}, ent);
check('risk create', s, [200, 201], p);
const riskId = data(p)?.id;
[s, p] = await call('PATCH', `/risk-register/${riskId}`, { status: 'in_progress' }, ent); check('risk patch', s, 200, p);
[s, p] = await call('GET', '/risk-register?format=csv', undefined, ent, { raw: true }); check('risk CSV', s, 200, p);

// ── Compliance: incidents, senior management, every register kind ──
[s, p] = await call('POST', '/compliance/incidents', { type: 'fraud_incident', severity: 'high', description: 'Duplicate invoice paid' }, ent);
check('incident create', s, 201, p);
[s, p] = await call('PATCH', `/compliance/incidents/${data(p)?.id}`, { resolved: true, resolutionNotes: 'Recovered' }, ent); check('incident resolve', s, 200, p);
[s, p] = await call('POST', '/compliance/senior-management', { userId, role: 'CFO' }, ent); check('senior manager add', s, [200, 201], p);

const records = {
  strategy: { title: 'Counter fraud strategy', periodStart: '2026-01-01', periodEnd: '2028-12-31', status: 'approved', approvedAt: '2026-01-10' },
  loss: { category: 'fraud', lossType: 'detected', description: 'Duplicate invoice', identifiedAt: today, amountGbp: 1200, recoveredGbp: 1200 },
  investigator: { name: 'Counter Fraud Ltd', arrangement: 'contracted', accreditation: 'ACFS', agreementEndsAt: '2027-12-31' },
  detection: { title: 'Duplicate invoice match', method: 'data_matching', plannedFor: today, status: 'completed', completedAt: today },
  gift_hospitality: { personName: 'A Person', direction: 'received', counterparty: 'Supplier Ltd', description: 'Lunch', valueGbp: 30, date: today, decision: 'accepted' },
  conflict_of_interest: { personName: 'A Person', interestType: 'financial', description: 'Shares', declaredAt: today, status: 'active' },
  policy: { policyType: 'counter_fraud', title: 'Anti-fraud policy', approvedAt: '2026-09-01', reviewDue: '2027-09-01' },
  reporting_route: { name: 'Hotline', channel: 'phone', contact: '0800 000 000', audience: 'staff', anonymousAllowed: 'yes' },
  associated_person: { name: 'Acme Logistics', associateType: 'contractor', servicesProvided: 'Collects payments', riskLevel: 'medium', identityVerified: 'yes' },
  board_minute: { meetingDate: today, body: 'board', itemsDiscussed: 'Fraud risk register' },
  tone_statement: { title: 'Zero tolerance', issuedBy: 'Chief Executive', issuedAt: today, audience: 'all_staff', channel: 'email', statement: 'We will not tolerate fraud.' },
};
const created = {};
for (const [kind, body] of Object.entries(records)) {
  [s, p] = await call('POST', '/compliance/records', { kind, data: body }, ent);
  if (check(`record create ${kind}`, s, [200, 201], p)) created[kind] = data(p).id;
}
[s, p] = await call('POST', '/compliance/records', { kind: 'policy', data: { policyType: 'response_plan', title: 'Plan', approvedAt: '2026-09-01', reviewDue: '2027-09-01' } }, ent);
check('record create response plan', s, [200, 201], p);
[s, p] = await call('PATCH', `/compliance/records/${created.policy}`, { data: { version: '2' } }, ent); check('record patch', s, 200, p);
[s, p] = await call('DELETE', `/compliance/records/${created.gift_hospitality}`, undefined, ent); check('record delete', s, [200, 204], p);
[s, p] = await call('GET', '/compliance/records?kind=associated_person', undefined, ent); check('records list with derived due diligence', s, 200, p);

// ── Speak-up ────────────────────────────────────────────────────
[s, p] = await call('PUT', '/compliance/speak-up/intake', { enabled: true, intro: 'Reports go to the audit chair.' }, ent); check('speak-up intake on', s, 200, p);
const intakeToken = data(p)?.token;
[s, p] = await call('GET', `/speak-up/${intakeToken}`); check('speak-up public page', s, 200, p);
[s, p] = await call('POST', `/speak-up/${intakeToken}/reports`, {
  category: 'procurement', relationship: 'employee', anonymous: true, description: 'A supplier is invoicing twice for the same deliveries.',
});
check('speak-up report', s, 201, p);
const { reference, accessKey } = data(p) ?? {};
[s, p] = await call('GET', '/compliance/speak-up/reports', undefined, ent); check('case list', s, 200, p);
const caseId = (data(p) ?? []).find((r) => r.reference === reference)?.id;
[s, p] = await call('GET', `/compliance/speak-up/reports/${caseId}`, undefined, ent); check('case open', s, 200, p);
[s, p] = await call('POST', `/compliance/speak-up/reports/${caseId}/messages`, { message: 'Which supplier?' }, ent); check('handler reply', s, 201, p);
expect('reply acknowledges the case', data(p)?.status === 'triage', data(p)?.status);
[s, p] = await call('POST', '/speak-up/status', { reference, accessKey }); check('reporter follows case', s, 200, p);
[s, p] = await call('POST', '/speak-up/messages', { reference, accessKey, message: 'Acme Supplies' }); check('reporter replies', s, 201, p);
[s, p] = await call('PATCH', `/compliance/speak-up/reports/${caseId}`, { status: 'investigating', assignedUserId: userId }, ent); check('case update', s, 200, p);
[s, p] = await call('POST', `/compliance/speak-up/reports/${caseId}/incident`, { severity: 'high' }, ent); check('case to incident', s, [200, 201], p);
[s, p] = await call('GET', '/compliance/speak-up/reports?format=csv', undefined, ent, { raw: true });
if (check('case log CSV', s, 200, p)) expect('case CSV leaves out report text', !p.includes('invoicing twice'));

// ── Workshop, certificate, training evidence ────────────────────
[s, p] = await call('POST', '/workshop/progress', {}, ent); check('workshop progress start', s, [200, 201], p);
const progressId = data(p)?.id;
// Quiz answers (the chosen option per section) are marked by the server
[s, p] = await call('PATCH', `/workshop/progress/${progressId}`, { currentSection: 6, completedSections: [0, 1, 2, 3, 4, 5, 6], quizAnswers: { 1: 1, 2: 2, 3: 1, 4: 0 } }, ent);
if (check('workshop progress update', s, 200, p)) expect('quiz scored by the server', JSON.stringify(data(p).quiz_scores) === '{"1":100,"2":100,"3":100,"4":0}', data(p).quiz_scores);
// 3 of 4 right is 75%, under the 80% pass mark: not complete, and no certificate
[s, p] = await call('PATCH', `/workshop/progress/${progressId}`, { completedAt: new Date().toISOString() }, ent);
if (check('workshop under the pass mark refused', s, 400, p)) expect('refused for the quiz score', p?.error?.code === 'QUIZ_NOT_PASSED' && p?.data?.percent === 75, p);
[s, p] = await call('POST', '/workshop/certificates', {}, ent); check('no certificate under the pass mark', s, 400, p);
// Answering the missed question again passes
[s, p] = await call('PATCH', `/workshop/progress/${progressId}`, { quizAnswers: { 4: 2 }, completedAt: new Date().toISOString() }, ent); check('workshop complete', s, 200, p);
[s, p] = await call('POST', '/workshop/certificates', {}, ent);
let trainingCert;
if (check('certificate issued', s, [200, 201], p)) {
  trainingCert = data(p).certificate_number;
  expect('certificate records the quiz score', data(p).quiz_score === 100, data(p).quiz_score);
}
// Anyone can verify a certificate, without signing in
[s, p] = await call('GET', `/certificates/verify/${trainingCert}`);
if (check('training certificate verify', s, 200, p)) expect('verify shows the course', data(p).kind === 'training' && data(p).quizScore === 100, data(p));
[s, p] = await call('GET', `/assessments/${assessmentId}/certificate`, undefined, ent);
if (check('assessment certificate', s, 200, p)) {
  const number = data(p).certificateNumber;
  [s, p] = await call('GET', `/certificates/verify/${number}`);
  if (check('assessment certificate verify', s, 200, p)) expect('verify shows the assessment', data(p).kind === 'assessment' && data(p).areasAssessed === 13, data(p));
}
[s, p] = await call('GET', '/certificates/verify/FRA-0000-0000-0000'); check('unknown certificate', s, 404, p);
[s, p] = await call('POST', '/workshop/action-plans', { actionItems: [{ text: 'Review supplier changes', done: false }], commitments: ['Brief board'] }, ent);
check('action plan create', s, 201, p);
[s, p] = await call('PATCH', `/workshop/action-plans/${data(p)?.id}`, { commitments: ['Brief board', 'Quarterly review'] }, ent); check('action plan update', s, 200, p);
// Fixture-only role setup: delivery authority cannot be self-assigned through the API.
const { Pool } = await import('pg');
const rolePool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await rolePool.query("INSERT INTO public.workshop_roles (user_id, role) VALUES ($1, 'facilitator') ON CONFLICT DO NOTHING", [userId]);
} finally { await rolePool.end(); }
[s, p] = await call('POST', '/workshop/sessions', { title: 'Board briefing' }, ent); check('live session create', s, 201, p);
[s, p] = await call('PUT', '/workshop/profile', { fullName: 'Smoke Enterprise', organizationName: 'Smoke Enterprise Ltd', sector: 'private' }, ent); check('workshop profile', s, 200, p);

// ── Reports, gap analysis, exports, evidence pack ───────────────
[s, p] = await call('GET', '/compliance/report', undefined, ent);
if (check('compliance report', s, 200, p)) {
  expect('training counted from certificates', data(p).metrics.trainingCompleted === 1, data(p).metrics.trainingCompleted);
  const govs4 = data(p).govs013.requirements.find((r) => r.id === 'govs-4');
  expect('GovS 013 component 4 met from records', govs4?.status === 'met', govs4);
}
for (const path of ['/compliance/gap-analysis', '/compliance/audit-trail', '/compliance/training', '/reports/generate', '/analytics/overview', '/analytics/dashboard', '/analytics/employees']) {
  [s, p] = await call('GET', path, undefined, ent); check(`GET ${path}`, s, 200, p);
}
for (const dataset of ['assessments', 'risk_register', 'incidents', 'policy', 'board_minute']) {
  [s, p] = await call('GET', `/compliance/export?format=csv&dataset=${dataset}`, undefined, ent, { raw: true }); check(`export ${dataset}`, s, 200, p);
}
[s, p] = await call('GET', '/compliance/evidence-pack', undefined, ent, { raw: true });
if (check('evidence pack', s, 200, p)) {
  const files = zipEntries(p);
  expect('evidence pack has the 15 CSVs and a summary', files.size >= 16 && files.has('00-summary.html'), [...files.keys()]);
  if (!SKIP_PDF) expect('evidence pack has the PDF summary', files.has('00-summary.pdf'));
  expect('evidence pack holds database records', files.get('8-board-oversight/board-minutes.csv')?.includes('Fraud risk register'));
}

// ── Key-passes: create, employee joins, revoke ──────────────────
[s, p] = await call('POST', '/keypasses/generate', { quantity: 2, expiresInDays: 30 }, ent); check('key-passes generate', s, 200, p);
const codes = (data(p)?.codes ?? []).map((c) => (typeof c === 'string' ? c : c.code));
[s, p] = await call('POST', '/keypasses/validate', { code: codes[0] }); check('key-pass validate', s, 200, p);
[s, p] = await call('POST', '/keypasses/use', { code: codes[0], email: `smoke-emp-${RUN}@example.test`, password: 'Smoke-Employee-2026', name: 'Smoke Employee' }); check('key-pass redeemed', s, [200, 201], p);
[s, p] = await call('POST', '/keypasses/revoke', { code: codes[1] }, ent); check('key-pass revoke', s, [200, 204], p);

// ── API keys: create, read-only use, revoke ─────────────────────
[s, p] = await call('POST', '/api-keys', { name: 'Smoke GRC sync' }, ent); check('API key create', s, [200, 201], p);
const { key: apiKey, id: apiKeyId } = data(p) ?? {};
[s, p] = await call('GET', '/compliance/report', undefined, apiKey); check('API key reads compliance', s, 200, p);
[s, p] = await call('POST', '/compliance/incidents', { type: 'fraud_incident', severity: 'low', description: 'x' }, apiKey); check('API key cannot write', s, 403, p);
[s, p] = await call('DELETE', `/api-keys/${apiKeyId}`, undefined, ent); check('API key revoke', s, [200, 204], p);
[s, p] = await call('GET', '/compliance/report', undefined, apiKey); check('revoked API key refused', s, 401, p);

// ── Account security ────────────────────────────────────────────
[s, p] = await call('POST', '/auth/forgot-password', { email: `smoke-ent-${RUN}@example.test` }); check('forgot password', s, 200, p);
[s, p] = await call('POST', '/auth/login', { email: `smoke-ent-${RUN}@example.test`, password: 'wrong-password-123' }); check('wrong password refused', s, 401, p);

const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`FAIL  ${r.name}: HTTP ${r.status} ${JSON.stringify(r.error)}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
