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

/** The certificate as an HTML page, A4 landscape, with a QR code that opens the verification page. */
export async function certificateHtml(details: CertificateDetails): Promise<string> {
  const url = verifyUrl(details.certificateNumber);
  const qr = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b2545', light: '#ffffff' } });
  const training = details.kind === 'training';
  const statement = training
    ? `has successfully completed the ${esc(TRAINING_TITLE)}${details.quizScore !== null ? `, with a quiz score of ${details.quizScore}%` : ''}.`
    : `has completed a fraud risk assessment covering ${details.areasAssessed} risk areas: <strong>${esc(details.title)}</strong>.`;
  const heading = training ? 'Certificate of Completion' : 'Certificate of Fraud Risk Assessment';
  const subject = training ? 'Fraud risk awareness training' : 'Fraud risk assessment';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(heading)} ${esc(details.certificateNumber)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #1b263b; }
  .page { width: 297mm; height: 210mm; padding: 12mm; }
  .frame { height: 100%; border: 3px solid #0b2545; padding: 4mm; }
  .inner { height: 100%; border: 1px solid #c9a227; padding: 12mm 16mm; display: flex; flex-direction: column; }
  .brand { font-size: 12pt; letter-spacing: 3px; font-weight: bold; color: #0b2545; }
  .subject { font-size: 10pt; color: #5c677d; margin-top: 1mm; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 30pt; color: #0b2545; margin: 12mm 0 6mm; font-weight: normal; }
  .lead { font-size: 12pt; color: #5c677d; }
  .holder { font-family: Georgia, 'Times New Roman', serif; font-size: 26pt; margin: 3mm 0 1mm; color: #1b263b; }
  .org { font-size: 13pt; color: #33415c; }
  .statement { font-size: 12pt; margin-top: 6mm; max-width: 190mm; line-height: 1.5; }
  .footer { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm; }
  .facts { display: flex; gap: 14mm; font-size: 10pt; }
  .facts .label { color: #5c677d; text-transform: uppercase; letter-spacing: 1px; font-size: 8pt; }
  .facts .value { font-size: 12pt; margin-top: 1mm; }
  .mono { font-family: 'Courier New', monospace; font-weight: bold; }
  .verify { display: flex; align-items: flex-end; gap: 5mm; font-size: 8.5pt; color: #33415c; text-align: right; max-width: 120mm; }
  .verify .qr { width: 32mm; height: 32mm; flex: none; }
  .verify .qr svg { width: 100%; height: 100%; }
  .url { word-break: break-all; color: #0b2545; }
</style></head>
<body><div class="page"><div class="frame"><div class="inner">
  <div class="brand">FRAUD-RISK.CO.UK</div>
  <div class="subject">${subject} &middot; Built for GovS 013 &amp; ECCTA 2023</div>
  <h1>${esc(heading)}</h1>
  <div class="lead">This is to certify that</div>
  <div class="holder">${esc(details.holderName)}</div>
  ${training && details.organisationName ? `<div class="org">${esc(details.organisationName)}</div>` : ''}
  <div class="statement">${statement}</div>
  <div class="footer">
    <div class="facts">
      <div><div class="label">Certificate number</div><div class="value mono">${esc(details.certificateNumber)}</div></div>
      <div><div class="label">Date issued</div><div class="value">${longDate(details.issuedAt)}</div></div>
    </div>
    <div class="verify">
      <div>Scan the code to check this certificate is genuine: the page shows the details we hold.<br>
        Or visit <span class="url">${esc(url.replace(/^https?:\/\//, '').split('?')[0])}</span> and enter the number.</div>
      <div class="qr">${qr}</div>
    </div>
  </div>
</div></div></div></body></html>`;
}

/** The certificate as a PDF file. */
export async function certificatePdf(details: CertificateDetails): Promise<Buffer> {
  return renderHtmlToPdf(await certificateHtml(details), { landscape: true });
}
