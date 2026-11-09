// ============================================================
// Verifiable certificates
//
// Two kinds: a training certificate (one per person, issued when the
// workshop is completed with the quiz pass mark) and an assessment
// certificate (one per submitted risk assessment). Each has a unique
// number; anyone can look it up on the public verification page, which
// shows what the server holds, so a PDF that has been edited is caught.
// ============================================================

import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { getDbPool } from './db.js';
import { hasDatabase } from './helpers.js';
import { createLogger } from './logger.js';
import { renderHtmlToPdf } from './pdf-generator.js';
import { webAppUrl } from './stripe.js';
import { assessmentsById, organisationsById, usersByEmail } from './stores.js';
import { certificates, workshopProfiles, newId } from './workshop-store.js';
import { ASSESSMENT_MODULES } from './assessment-modules.js';
import { dbGetOrganisationById } from './db/index.js';
import type { Assessment } from './types.js';

const logger = createLogger('certificates');

export type CertificateKind = 'training' | 'assessment';

/** What a certificate says. The verification page and the PDF show the same fields. */
export type CertificateDetails = {
  kind: CertificateKind;
  certificateNumber: string;
  issuedAt: string;
  /** Training: the person. Assessment: the organisation. */
  holderName: string;
  organisationName: string;
  title: string;
  /** Training only: the quiz score in percent, when it was recorded. */
  quizScore: number | null;
  /** Assessment only: how many risk areas the assessment covers. */
  areasAssessed: number | null;
};

/** A certificate with who it belongs to, for access checks. Never sent to the public. */
export type CertificateRecord = CertificateDetails & {
  organisationId: string | null;
  /** Training: the holder. Assessment: the person who filled it in. */
  userId: string | null;
};

export type AssessmentCertificateRow = {
  id: string; assessment_id: string; organisation_id: string; certificate_number: string; issued_at: string;
};

/** In-memory assessment certificates (no database), keyed by assessment id. */
export const assessmentCertificates = new Map<string, AssessmentCertificateRow>();

export const TRAINING_TITLE = 'Fraud Risk Awareness Workshop';
export const ASSESSMENT_AREAS = ASSESSMENT_MODULES.length;

/** A new certificate number, e.g. FRA-1A2B-3C4D-5E6F (48 random bits, so numbers cannot be guessed). */
export function newCertificateNumber(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `FRA-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/** Accepts new numbers and the older FRA-<time>-<hex> ones, in any case, with spaces trimmed. */
export function normaliseCertificateNumber(input: string): string | null {
  const value = input.trim().toUpperCase();
  return /^FRA-[A-Z0-9]{1,16}(-[A-Z0-9]{1,16}){1,3}$/.test(value) ? value : null;
}

export function verifyUrl(certificateNumber: string): string {
  return `${webAppUrl()}/certificate/verify?n=${encodeURIComponent(certificateNumber)}`;
}

const iso = (v: string | Date) => new Date(v).toISOString();

function memUserById(id: string) {
  for (const u of usersByEmail.values()) if (u.id === id) return u;
  return undefined;
}

// ── Issuing ──────────────────────────────────────────────────

/** The certificate for a submitted assessment, issued now if it has none yet. Safe to call more than once. */
export async function issueAssessmentCertificate(a: Assessment): Promise<AssessmentCertificateRow> {
  const issuedAt = a.submittedAt ?? new Date().toISOString();
  if (!hasDatabase()) {
    const existing = assessmentCertificates.get(a.id);
    if (existing) return existing;
    const row = {
      id: newId(), assessment_id: a.id, organisation_id: a.organisationId,
      certificate_number: newCertificateNumber(), issued_at: issuedAt,
    };
    assessmentCertificates.set(a.id, row);
    return row;
  }
  const pool = getDbPool();
  await pool.query(
    `INSERT INTO assessment_certificates (assessment_id, organisation_id, certificate_number, issued_at)
     VALUES ($1, $2, $3, $4) ON CONFLICT (assessment_id) DO NOTHING`,
    [a.id, a.organisationId, newCertificateNumber(), issuedAt],
  );
  const res = await pool.query<AssessmentCertificateRow>(
    'SELECT * FROM assessment_certificates WHERE assessment_id = $1', [a.id],
  );
  const row = res.rows[0];
  return { ...row, issued_at: iso(row.issued_at) };
}

/** Issue the certificate in the background after a submission; a failure is logged and retried on the next view. */
export function issueAssessmentCertificateLater(a: Assessment): void {
  issueAssessmentCertificate(a).catch((err: unknown) => {
    logger.error('Could not issue assessment certificate', { assessmentId: a.id, error: String(err) });
  });
}

// ── Looking up ───────────────────────────────────────────────

async function trainingRecord(row: {
  user_id: string; certificate_number: string; issued_at: string; quiz_score?: number | null;
}): Promise<CertificateRecord> {
  let holderName = '';
  let organisationName = '';
  let organisationId: string | null = null;
  if (hasDatabase()) {
    const res = await getDbPool().query<{ full_name: string | null; organization_name: string | null; name: string | null; org_name: string | null; organisation_id: string | null }>(
      `SELECT wp.full_name, wp.organization_name, u.name, o.name AS org_name, u.organisation_id
         FROM users u
         LEFT JOIN workshop_profiles wp ON wp.user_id = u.id
         LEFT JOIN organisations o ON o.id = u.organisation_id
        WHERE u.id = $1 LIMIT 1`,
      [row.user_id],
    );
    const r = res.rows[0];
    holderName = r?.full_name || r?.name || '';
    organisationName = r?.org_name || r?.organization_name || '';
    organisationId = r?.organisation_id ?? null;
  } else {
    const user = memUserById(row.user_id);
    const profile = workshopProfiles.get(row.user_id);
    holderName = profile?.full_name || user?.name || '';
    organisationId = user?.organisationId ?? null;
    organisationName = (organisationId && organisationsById.get(organisationId)?.name) || profile?.organization_name || '';
  }
  return {
    kind: 'training', certificateNumber: row.certificate_number, issuedAt: iso(row.issued_at),
    holderName, organisationName, title: TRAINING_TITLE,
    quizScore: row.quiz_score ?? null, areasAssessed: null,
    organisationId, userId: row.user_id,
  };
}

async function assessmentRecord(row: AssessmentCertificateRow): Promise<CertificateRecord | null> {
  const assessment = hasDatabase()
    ? (await getDbPool().query<{ title: string; created_by_user_id: string }>(
      'SELECT title, created_by_user_id FROM assessments WHERE id = $1', [row.assessment_id],
    )).rows[0]
    : (() => {
      const a = assessmentsById.get(row.assessment_id);
      return a ? { title: a.title, created_by_user_id: a.createdByUserId } : undefined;
    })();
  if (!assessment) return null;
  const org = hasDatabase() ? await dbGetOrganisationById(row.organisation_id) : organisationsById.get(row.organisation_id);
  const organisationName = org?.name ?? '';
  return {
    kind: 'assessment', certificateNumber: row.certificate_number, issuedAt: iso(row.issued_at),
    holderName: organisationName, organisationName, title: assessment.title,
    quizScore: null, areasAssessed: ASSESSMENT_AREAS,
    organisationId: row.organisation_id, userId: assessment.created_by_user_id,
  };
}

/** Find a certificate of either kind by its number. */
export async function findCertificate(certificateNumber: string): Promise<CertificateRecord | null> {
  if (!hasDatabase()) {
    const training = [...certificates.values()].find((c) => c.certificate_number === certificateNumber);
    if (training) return trainingRecord(training);
    const assessment = [...assessmentCertificates.values()].find((c) => c.certificate_number === certificateNumber);
    return assessment ? assessmentRecord(assessment) : null;
  }
  const pool = getDbPool();
  const training = await pool.query(
    'SELECT user_id, certificate_number, issued_at, quiz_score FROM certificates WHERE certificate_number = $1 LIMIT 1',
    [certificateNumber],
  );
  if (training.rows[0]) return trainingRecord(training.rows[0]);
  const assessment = await pool.query<AssessmentCertificateRow>(
    'SELECT * FROM assessment_certificates WHERE certificate_number = $1 LIMIT 1', [certificateNumber],
  );
  return assessment.rows[0] ? assessmentRecord(assessment.rows[0]) : null;
}

/** The public fields only: who and what it certifies, never ids. */
export function publicDetails(record: CertificateRecord): CertificateDetails {
  const { organisationId: _org, userId: _user, ...details } = record;
  return details;
}

/** Who may download a certificate PDF: the holder, and the organisation's employer or admin. */
export function canDownload(
  record: CertificateRecord,
  auth: { userId: string; organisationId: string; role: string },
): boolean {
  if (record.userId === auth.userId) return true;
  return !!record.organisationId && record.organisationId === auth.organisationId
    && (auth.role === 'employer' || auth.role === 'admin');
}

// ── PDF ──────────────────────────────────────────────────────

/** Escapes text placed in the certificate HTML. API input is already escaped once on the way in (as in pdf-generator). */
function esc(value: string): string {
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function longDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
}

// The design is shared with the web page that shows the certificate
// (apps/fra-web-dashboard/src/components/certificate/): same markup, same CSS.
// Change both together.

export const TRAINING_DURATION = '30 minutes';
const ISSUER = 'fraud-risk.co.uk';

export const CERTIFICATE_CSS = `
.cert {
  container-type: inline-size;
  width: 100%;
}
.cert-sheet {
  --cert-paper: #fbf8f1;
  --cert-ink: #3b2a1a;
  --cert-title: #6b4a2b;
  --cert-muted: #6f6253;
  --cert-line: #c8b48a;
  position: relative;
  aspect-ratio: 297 / 210;
  width: 100%;
  overflow: hidden;
  background-color: var(--cert-paper);
  /* Faint guilloche-style curves, like security paper */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 297 210' preserveAspectRatio='none'%3E%3Cg fill='none' stroke='%23c8b48a' stroke-opacity='0.22' stroke-width='0.25'%3E%3Cpath d='M0 40 C60 10 120 70 180 40 S260 10 297 30'/%3E%3Cpath d='M0 46 C60 16 120 76 180 46 S260 16 297 36'/%3E%3Cpath d='M0 52 C60 22 120 82 180 52 S260 22 297 42'/%3E%3Cpath d='M0 150 C70 120 130 180 200 150 S270 125 297 140'/%3E%3Cpath d='M0 156 C70 126 130 186 200 156 S270 131 297 146'/%3E%3Cpath d='M0 162 C70 132 130 192 200 162 S270 137 297 152'/%3E%3Cpath d='M0 168 C70 138 130 198 200 168 S270 143 297 158'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 100% 100%;
  color: var(--cert-ink);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 1.25cqw;
  line-height: 1.45;
  text-align: center;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Double gold frame: the horizontal lines run past the vertical ones at each corner */
.cert-frame-h,
.cert-frame-v {
  position: absolute;
  pointer-events: none;
  border-color: var(--cert-line);
  border-style: double;
  border-width: 0;
}
.cert-frame-h { top: 3.2cqw; bottom: 3.2cqw; left: 1.8cqw; right: 1.8cqw; border-top-width: 0.45cqw; border-bottom-width: 0.45cqw; }
.cert-frame-v { top: 1.8cqw; bottom: 1.8cqw; left: 3.2cqw; right: 3.2cqw; border-left-width: 0.45cqw; border-right-width: 0.45cqw; }

.cert-body {
  position: absolute;
  inset: 5cqw 7cqw 4.6cqw;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cert-brand { display: flex; align-items: center; gap: 0.8cqw; color: var(--cert-title); }
.cert-brand svg { width: 3.4cqw; height: 3.4cqw; flex: none; }
.cert-brand-name { font-size: 1.15cqw; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; text-align: left; line-height: 1.2; }
.cert-brand-name small { display: block; font-size: 0.8cqw; font-weight: 400; letter-spacing: 0.08em; color: var(--cert-muted); }

.cert-title {
  margin: 2.4cqw 0 0;
  font-family: 'Times New Roman', Times, Georgia, serif;
  font-size: 4.8cqw;
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cert-title);
  max-width: 70cqw;
}

.cert-lead { margin: 2.4cqw 0 0; font-size: 1.35cqw; color: var(--cert-muted); }
.cert-holder {
  margin: 0.6cqw 0 0;
  font-family: 'Times New Roman', Times, Georgia, serif;
  font-size: 4cqw;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--cert-ink);
}
.cert-org { margin: 0.3cqw 0 0; font-size: 1.4cqw; color: var(--cert-muted); }
.cert-rule { width: 44cqw; height: 0; margin: 1.2cqw auto 0; border-top: 0.12cqw solid var(--cert-line); }

.cert-completed { margin: 2cqw 0 0; font-size: 1.35cqw; color: var(--cert-muted); }
.cert-course { margin: 0.4cqw 0 0; font-size: 1.7cqw; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--cert-ink); }
.cert-description { margin: 1.8cqw auto 0; max-width: 66cqw; font-size: 1.3cqw; line-height: 1.5; color: var(--cert-ink); }

.cert-footer {
  margin-top: auto;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto auto 1fr;
  align-items: end;
  gap: 3cqw;
  font-size: 1.15cqw;
}
.cert-facts { margin: 0; line-height: 1.6; }
.cert-facts div { display: flex; gap: 0.4cqw; }
.cert-facts dt { font-weight: 700; color: var(--cert-ink); }
.cert-facts dt::after { content: ':'; }
.cert-facts dd { margin: 0; color: var(--cert-ink); }
.cert-facts-left { text-align: left; justify-self: start; }
.cert-facts-right { text-align: right; justify-self: end; }
.cert-facts-right div { justify-content: flex-end; }
.cert-mono { font-family: 'Courier New', Courier, monospace; font-weight: 700; letter-spacing: 0.02em; }

.cert-qr { display: flex; flex-direction: column; align-items: center; gap: 0.4cqw; color: var(--cert-muted); font-size: 0.8cqw; line-height: 1.25; }
.cert-qr-code { width: 7cqw; height: 7cqw; background: #fff; padding: 0.4cqw; }
.cert-qr-code svg { display: block; width: 100%; height: 100%; }

.cert-issuer { display: flex; flex-direction: column; align-items: center; gap: 0.3cqw; }
.cert-seal { width: 6.4cqw; height: 6.4cqw; color: var(--cert-title); }
.cert-issuer-name { padding-top: 0.4cqw; border-top: 0.12cqw solid var(--cert-line); min-width: 14cqw; font-weight: 700; color: var(--cert-ink); }
.cert-issuer-role { font-size: 0.9cqw; color: var(--cert-muted); }

.cert-sample {
  position: absolute;
  top: 6.4cqw;
  right: 7cqw;
  padding: 0.2cqw 0.9cqw;
  border: 0.12cqw solid var(--cert-title);
  border-radius: 0.4cqw;
  font-size: 0.95cqw;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cert-title);
}
`;

const SHIELD_MARK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 6 10v12c0 11.5 7.7 20.6 18 23 10.3-2.4 18-11.5 18-23V10L24 3Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="m15.5 24.5 6 6 11-12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const SEAL = '<svg class="cert-seal" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="32" cy="32" r="25.5" fill="none" stroke="currentColor" stroke-width="0.9" stroke-dasharray="1.2 2.2"/><path d="M32 15 20 19.5v8c0 7.7 5.1 13.8 12 15.5 6.9-1.7 12-7.8 12-15.5v-8L32 15Z" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m26.5 29.5 4 4 7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><text x="32" y="51" text-anchor="middle" font-size="4.4" font-family="Helvetica, Arial, sans-serif" font-weight="700" letter-spacing="1.2" fill="currentColor">VERIFIED</text></svg>';

export function certificateHeading(kind: CertificateKind): string {
  return kind === 'training' ? 'Certificate of Training Completion' : 'Certificate of Fraud Risk Assessment';
}

/** The certificate as an HTML page, A4 landscape, with a QR code that opens the verification page. */
export async function certificateHtml(details: CertificateDetails): Promise<string> {
  const url = verifyUrl(details.certificateNumber);
  const qr = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#3b2a1a', light: '#ffffff' } });
  const training = details.kind === 'training';
  const heading = certificateHeading(details.kind);
  const issued = longDate(details.issuedAt);
  const areas = details.areasAssessed ?? ASSESSMENT_AREAS;
  const description = training
    ? 'This certificate confirms that the participant has completed fraud risk awareness training for trustees, executive leadership and budget holders, covering the UK regulatory landscape (including the Economic Crime and Corporate Transparency Act 2023 and GovS 013), common fraud types and risks, practical defence strategies and real-world case studies.'
    : `This certificate confirms that the organisation has completed a structured fraud risk assessment covering ${areas} risk areas, from governance and financial controls to whistleblowing and third-party risk, to support the reasonable fraud prevention procedures expected under the Economic Crime and Corporate Transparency Act 2023.`;
  const fact = (label: string, value: string, cls = '') => `<div><dt>${label}</dt><dd${cls ? ` class="${cls}"` : ''}>${value}</dd></div>`;
  const leftFacts = training
    ? fact('Course duration', TRAINING_DURATION) + fact('Completion date', issued)
      + (details.quizScore !== null ? fact('Quiz score', `${details.quizScore}%`) : '')
    : fact('Risk areas assessed', String(areas)) + fact('Completion date', issued);
  const verifyHost = esc(url.replace(/^https?:\/\//, '').split('?')[0]);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(heading)} ${esc(details.certificateNumber)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body > .cert { width: 297mm; }
${CERTIFICATE_CSS}
</style></head>
<body><div class="cert"><article class="cert-sheet" aria-label="${esc(heading)}">
  <div class="cert-frame-h"></div><div class="cert-frame-v"></div>
  <div class="cert-body">
    <div class="cert-brand">${SHIELD_MARK}<div class="cert-brand-name">${ISSUER}<small>Built for GovS 013 &amp; ECCTA 2023</small></div></div>
    <h1 class="cert-title">${esc(heading)}</h1>
    <p class="cert-lead">This is to certify that</p>
    <p class="cert-holder">${esc(details.holderName)}</p>
    ${training && details.organisationName ? `<p class="cert-org">${esc(details.organisationName)}</p>` : ''}
    <div class="cert-rule"></div>
    <p class="cert-completed">${training ? 'has successfully completed' : 'has completed a fraud risk assessment'}</p>
    <p class="cert-course">${esc(training ? TRAINING_TITLE : (details.title || 'Fraud Risk Assessment'))}</p>
    <p class="cert-description">${description}</p>
    <div class="cert-footer">
      <dl class="cert-facts cert-facts-left">${leftFacts}</dl>
      <div class="cert-qr"><div class="cert-qr-code">${qr}</div><span>Scan to confirm<br>it is genuine</span></div>
      <div class="cert-issuer">${SEAL}<div class="cert-issuer-name">${ISSUER}</div><div class="cert-issuer-role">Certificate issuer</div></div>
      <dl class="cert-facts cert-facts-right">
        ${fact('Certificate number', esc(details.certificateNumber), 'cert-mono')}
        ${fact('Issued', issued)}
        ${fact('Verify at', verifyHost)}
      </dl>
    </div>
  </div>
</article></div></body></html>`;
}

/** The certificate as a PDF file. */
export async function certificatePdf(details: CertificateDetails): Promise<Buffer> {
  return renderHtmlToPdf(await certificateHtml(details), { landscape: true });
}
