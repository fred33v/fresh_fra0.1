import crypto from 'node:crypto';
import QRCode from 'qrcode';
import type { PoolClient } from 'pg';
import { getDbPool } from './db.js';
import { hasDatabase, type AuthContext } from './helpers.js';
import { createLogger } from './logger.js';
import { renderHtmlToPdf } from './pdf-generator.js';
import { webAppUrl } from './stripe.js';
import { assessmentsById, organisationsById, usersByEmail } from './stores.js';
import {
  certificates,
  workshopProfiles,
  workshopProgress,
  memSessionRole,
  newId,
  type CertificateRow,
  type ProgressRow,
} from './workshop-store.js';
import { ASSESSMENT_MODULES } from './assessment-modules.js';
import { auditLog } from './db/index.js';
import { withTransaction, type DbExecutor } from './db/transaction.js';
import { missingForCompletion, quizResult, QUIZ_PASS_MARK } from './workshop-quiz.js';
import type { Assessment } from './types.js';

const logger = createLogger('certificates');
export type CertificateKind = 'training' | 'assessment';
export type CertificateDetails = {
  kind: CertificateKind;
  certificateNumber: string;
  issuedAt: string;
  holderName: string;
  organisationName: string;
  title: string;
  quizScore: number | null;
  areasAssessed: number | null;
  completedAt?: string | null;
  courseId?: string;
  courseVersion?: string | null;
  snapshotOrigin?: 'issued' | 'legacy_reconstructed';
};
export type CertificateRecord = CertificateDetails & {
  organisationId: string | null;
  userId: string | null;
  status: 'valid' | 'revoked';
  revokedAt: string | null;
  sourceId: string;
  sessionId: string | null;
  trainingKey: string | null;
};
export type AssessmentCertificateRow = {
  id: string;
  assessment_id: string;
  organisation_id: string;
  certificate_number: string;
  issued_at: string;
};
export type IssuedTrainingRow = CertificateRow & {
  status: 'valid' | 'revoked';
  completed_at: string | null;
  issued_details: CertificateDetails;
};
export const assessmentCertificates = new Map<string, AssessmentCertificateRow>();
export const certificateRecords = new Map<string, CertificateRecord>();
export const TRAINING_TITLE = 'Fraud Risk Awareness Workshop';
export const TRAINING_COURSE_ID = 'fraud-risk-awareness';
export const TRAINING_COURSE_VERSION = '2026-10-30';
export const ASSESSMENT_AREAS = ASSESSMENT_MODULES.length;
export function newCertificateNumber(): string {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `FRA-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}
export function normaliseCertificateNumber(input: string): string | null {
  const value = input.trim().toUpperCase();
  return /^FRA-[A-Z0-9]{1,16}(-[A-Z0-9]{1,16}){1,3}$/.test(value) ? value : null;
}
export function verifyUrl(number: string): string {
  return `${webAppUrl()}/certificate/verify?n=${encodeURIComponent(number)}`;
}
const iso = (v: string | Date) => new Date(v).toISOString();
const memUserById = (id: string) => [...usersByEmail.values()].find((u) => u.id === id);

type StoredRecord = {
  certificate_number: string;
  kind: CertificateKind;
  source_id: string;
  user_id: string | null;
  organisation_id: string | null;
  session_id: string | null;
  training_key: string | null;
  snapshot: CertificateDetails;
  status: 'valid' | 'revoked';
  revoked_at: string | null;
};
function recordOf(row: StoredRecord): CertificateRecord {
  return {
    ...row.snapshot,
    issuedAt: iso(row.snapshot.issuedAt),
    completedAt: row.snapshot.completedAt ? iso(row.snapshot.completedAt) : null,
    sourceId: row.source_id,
    userId: row.user_id,
    organisationId: row.organisation_id,
    sessionId: row.session_id,
    trainingKey: row.training_key,
    status: row.status,
    revokedAt: row.revoked_at ? iso(row.revoked_at) : null,
  };
}
async function storeRecord(
  record: CertificateRecord,
  assessmentId: string | null,
  db: DbExecutor
): Promise<void> {
  await db.query(
    `INSERT INTO public.certificate_records
    (certificate_number,kind,source_id,user_id,organisation_id,assessment_id,session_id,training_key,snapshot)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      record.certificateNumber,
      record.kind,
      record.sourceId,
      record.userId,
      record.organisationId,
      assessmentId,
      record.sessionId,
      record.trainingKey,
      publicDetails(record),
    ]
  );
}
/** Explicit allowlist: lifecycle internals and private revocation reasons never escape. */
export function publicDetails(r: CertificateDetails): CertificateDetails {
  return {
    kind: r.kind,
    certificateNumber: r.certificateNumber,
    issuedAt: r.issuedAt,
    holderName: r.holderName,
    organisationName: r.organisationName,
    title: r.title,
    quizScore: r.quizScore,
    areasAssessed: r.areasAssessed,
    completedAt: r.completedAt ?? null,
    courseId: r.courseId,
    courseVersion: r.courseVersion ?? null,
    snapshotOrigin: r.snapshotOrigin,
  };
}
const pending = new Map<string, Promise<void>>();
async function locked<T>(key: string, work: (db?: PoolClient) => Promise<T>): Promise<T> {
  if (hasDatabase())
    return withTransaction(async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(193479, hashtext($1))', [key]);
      return work(db);
    });
  const previous = pending.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  pending.set(key, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (pending.get(key) === current) pending.delete(key);
  }
}

async function identity(userId: string, db?: DbExecutor) {
  if (!db) {
    const user = memUserById(userId),
      profile = workshopProfiles.get(userId);
    const organisationId = user?.organisationId ?? null;
    return {
      holderName: profile?.full_name || user?.name || '',
      organisationId,
      organisationName:
        (organisationId && organisationsById.get(organisationId)?.name) ||
        profile?.organization_name ||
        '',
    };
  }
  const { rows } = await db.query<{
    full_name: string | null;
    name: string;
    organisation_id: string;
    org_name: string | null;
    organization_name: string | null;
  }>(
    `SELECT wp.full_name,u.name,u.organisation_id,o.name AS org_name,wp.organization_name
      FROM public.users u LEFT JOIN public.workshop_profiles wp ON wp.user_id=u.id
      LEFT JOIN public.organisations o ON o.id=u.organisation_id WHERE u.id=$1`,
    [userId]
  );
  const r = rows[0];
  return {
    holderName: r?.full_name || r?.name || '',
    organisationId: r?.organisation_id ?? null,
    organisationName: r?.org_name || r?.organization_name || '',
  };
}
const trainingRow = (r: CertificateRecord): IssuedTrainingRow => ({
  id: r.sourceId,
  user_id: r.userId!,
  session_id: r.sessionId,
  certificate_number: r.certificateNumber,
  quiz_score: r.quizScore,
  issued_at: r.issuedAt,
  status: r.status,
  completed_at: r.completedAt ?? null,
  issued_details: publicDetails(r),
});

export class CertificateEligibilityError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: 400 | 403 | 409 = 400
  ) {
    super(message);
  }
}
/** The exact eligible progress, snapshot, original row and audit commit together. */
export async function issueTrainingCertificate(
  auth: AuthContext,
  sessionId?: string,
  request: { ipAddress?: string; userAgent?: string } = {}
): Promise<{ row: IssuedTrainingRow; created: boolean }> {
  const key = `${auth.userId}:${TRAINING_COURSE_ID}:${TRAINING_COURSE_VERSION}`;
  return locked(`training:${key}`, async (db) => {
    if (sessionId) {
      const allowed = db
        ? (
            await db.query(
              `SELECT 1 FROM public.workshop_sessions s WHERE s.id=$1
        AND (s.facilitator_id=$2 OR EXISTS (SELECT 1 FROM public.session_participants p WHERE p.session_id=s.id AND p.user_id=$2))`,
              [sessionId, auth.userId]
            )
          ).rowCount
        : memSessionRole(sessionId, auth.userId);
      if (!allowed)
        throw new CertificateEligibilityError(
          'SESSION_FORBIDDEN',
          'Not a member of this session',
          403
        );
    }
    const existing = db
      ? (
          await db.query<StoredRecord>(
            'SELECT * FROM public.certificate_records WHERE training_key=$1',
            [key]
          )
        ).rows[0]
      : [...certificateRecords.values()].find((r) => r.trainingKey === key);
    if (existing)
      return {
        row: trainingRow('snapshot' in existing ? recordOf(existing) : existing),
        created: false,
      };
    const revoked = db
      ? (
          await db.query(
            `SELECT 1 FROM public.certificate_records
      WHERE kind='training' AND user_id=$1 AND status='revoked'
      AND snapshot->>'courseId'=$2 AND (snapshot->>'courseVersion' IS NULL OR snapshot->>'courseVersion'=$3) LIMIT 1`,
            [auth.userId, TRAINING_COURSE_ID, TRAINING_COURSE_VERSION]
          )
        ).rowCount
      : [...certificateRecords.values()].some(
          (r) =>
            r.kind === 'training' &&
            r.userId === auth.userId &&
            r.status === 'revoked' &&
            r.courseId === TRAINING_COURSE_ID &&
            (!r.courseVersion || r.courseVersion === TRAINING_COURSE_VERSION)
        );
    if (revoked)
      throw new CertificateEligibilityError(
        'CERTIFICATE_REVOKED',
        'A revoked certificate cannot be replaced automatically',
        409
      );
    const rows: ProgressRow[] = db
      ? (
          await db.query<ProgressRow>(
            `SELECT * FROM public.workshop_progress wp
      WHERE user_id=$1 AND completed_at IS NOT NULL AND ($2::uuid IS NULL OR session_id=$2)
      AND (session_id IS NULL OR EXISTS (SELECT 1 FROM public.session_participants p WHERE p.session_id=wp.session_id AND p.user_id=$1)
        OR EXISTS (SELECT 1 FROM public.workshop_sessions s WHERE s.id=wp.session_id AND s.facilitator_id=$1))
      ORDER BY completed_at DESC`,
            [auth.userId, sessionId ?? null]
          )
        ).rows
      : [...workshopProgress.values()]
          .filter(
            (p) =>
              p.user_id === auth.userId &&
              p.completed_at &&
              (!sessionId || p.session_id === sessionId) &&
              (!p.session_id || memSessionRole(p.session_id, auth.userId))
          )
          .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
    const progress = rows.find((p) => {
      const missing = missingForCompletion(p.completed_sections, p.quiz_scores);
      return (
        !missing.sections.length && !missing.quizzes.length && quizResult(p.quiz_scores).passed
      );
    });
    if (!progress)
      throw new CertificateEligibilityError(
        'NOT_COMPLETED',
        `Workshop must be completed with a quiz score of at least ${QUIZ_PASS_MARK}% before generating a certificate`
      );
    const person = await identity(auth.userId, db);
    if (person.organisationId !== auth.organisationId)
      throw new CertificateEligibilityError(
        'FORBIDDEN',
        'Account organisation has changed. Sign in again.',
        403
      );
    const r: CertificateRecord = {
      kind: 'training',
      certificateNumber: newCertificateNumber(),
      issuedAt: new Date().toISOString(),
      completedAt: iso(progress.completed_at!),
      holderName: person.holderName,
      organisationName: person.organisationName,
      title: TRAINING_TITLE,
      quizScore: quizResult(progress.quiz_scores).percent,
      areasAssessed: null,
      courseId: TRAINING_COURSE_ID,
      courseVersion: TRAINING_COURSE_VERSION,
      snapshotOrigin: 'issued',
      sourceId: newId(),
      userId: auth.userId,
      organisationId: person.organisationId,
      sessionId: progress.session_id,
      trainingKey: key,
      status: 'valid',
      revokedAt: null,
    };
    const row = trainingRow(r);
    if (db) {
      await db.query(
        `INSERT INTO public.certificates (id,user_id,session_id,certificate_number,quiz_score,issued_at)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [row.id, row.user_id, row.session_id, row.certificate_number, row.quiz_score, row.issued_at]
      );
      await storeRecord(r, null, db);
    }
    await auditLog(
      {
        eventType: 'workshop.certificate_generate',
        actorId: auth.userId,
        actorEmail: auth.email,
        organisationId: auth.organisationId,
        resourceType: 'certificate',
        resourceId: r.certificateNumber,
        details: {
          courseId: TRAINING_COURSE_ID,
          courseVersion: TRAINING_COURSE_VERSION,
          progressId: progress.id,
        },
        ...request,
      },
      db
    );
    if (!db) {
      certificates.set(row.id, row);
      certificateRecords.set(r.certificateNumber, r);
    }
    return { row, created: true };
  });
}

/** Legacy memory fixtures are frozen once and clearly marked, like migration 032. */
async function memoryLegacy(number: string): Promise<CertificateRecord | null> {
  const training = [...certificates.values()].find((c) => c.certificate_number === number);
  let r: CertificateRecord;
  if (training) {
    const person = await identity(training.user_id);
    r = {
      kind: 'training',
      certificateNumber: number,
      issuedAt: iso(training.issued_at),
      completedAt: null,
      holderName: person.holderName,
      organisationName: person.organisationName,
      title: TRAINING_TITLE,
      quizScore: training.quiz_score ?? null,
      areasAssessed: null,
      courseId: TRAINING_COURSE_ID,
      courseVersion: null,
      snapshotOrigin: 'legacy_reconstructed',
      sourceId: training.id,
      userId: training.user_id,
      organisationId: person.organisationId,
      sessionId: training.session_id,
      trainingKey: null,
      status: 'valid',
      revokedAt: null,
    };
  } else {
    const old = [...assessmentCertificates.values()].find((c) => c.certificate_number === number);
    const a = old && assessmentsById.get(old.assessment_id);
    if (!old || !a) return null;
    const name = organisationsById.get(old.organisation_id)?.name ?? '';
    r = {
      kind: 'assessment',
      certificateNumber: number,
      issuedAt: iso(old.issued_at),
      completedAt: a.submittedAt ?? null,
      holderName: name,
      organisationName: name,
      title: a.title,
      quizScore: null,
      areasAssessed: ASSESSMENT_AREAS,
      courseId: 'fraud-risk-assessment',
      courseVersion: a.result?.methodVersion === undefined ? null : String(a.result.methodVersion),
      snapshotOrigin: 'legacy_reconstructed',
      sourceId: old.id,
      userId: a.createdByUserId,
      organisationId: old.organisation_id,
      sessionId: null,
      trainingKey: null,
      status: 'valid',
      revokedAt: null,
    };
  }
  const prior = certificateRecords.get(number);
  if (prior) return prior;
  certificateRecords.set(number, r);
  return r;
}
export async function findCertificate(number: string): Promise<CertificateRecord | null> {
  if (!hasDatabase()) return certificateRecords.get(number) ?? memoryLegacy(number);
  const { rows } = await getDbPool().query<StoredRecord>(
    'SELECT * FROM public.certificate_records WHERE certificate_number=$1',
    [number]
  );
  return rows[0] ? recordOf(rows[0]) : null;
}
export async function getTrainingCertificate(userId: string): Promise<IssuedTrainingRow | null> {
  if (hasDatabase()) {
    const { rows } = await getDbPool().query<StoredRecord>(
      `SELECT * FROM public.certificate_records WHERE kind='training' AND user_id=$1
      ORDER BY (snapshot->>'issuedAt')::timestamptz DESC,certificate_number LIMIT 1`,
      [userId]
    );
    return rows[0] ? trainingRow(recordOf(rows[0])) : null;
  }
  const source = [...certificates.values()]
    .filter((c) => c.user_id === userId)
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))[0];
  if (!source) return null;
  const r = await findCertificate(source.certificate_number);
  return r ? trainingRow(r) : null;
}

export async function issueAssessmentCertificate(a: Assessment): Promise<AssessmentCertificateRow> {
  return locked(`assessment:${a.id}`, async (db) => {
    const existing = db
      ? (
          await db.query<StoredRecord>(
            'SELECT * FROM public.certificate_records WHERE assessment_id=$1',
            [a.id]
          )
        ).rows[0]
      : [...certificateRecords.values()].find(
          (r) =>
            r.kind === 'assessment' &&
            assessmentCertificates.get(a.id)?.certificate_number === r.certificateNumber
        );
    if (existing) {
      const r = 'snapshot' in existing ? recordOf(existing) : existing;
      return {
        id: r.sourceId,
        assessment_id: a.id,
        organisation_id: r.organisationId!,
        certificate_number: r.certificateNumber,
        issued_at: r.issuedAt,
      };
    }
    // The server's stored assessment, not a caller-supplied title or completion claim.
    const actual = db
      ? (
          await db.query<{
            id: string;
            organisation_id: string;
            created_by_user_id: string;
            title: string;
            status: string;
            submitted_at: string | null;
            result: Assessment['result'];
          }>(
            'SELECT id,organisation_id,created_by_user_id,title,status,submitted_at,result FROM public.assessments WHERE id=$1 FOR SHARE',
            [a.id]
          )
        ).rows[0]
      : (() => {
          const x = assessmentsById.get(a.id);
          return x
            ? {
                id: x.id,
                organisation_id: x.organisationId,
                created_by_user_id: x.createdByUserId,
                title: x.title,
                status: x.status,
                submitted_at: x.submittedAt ?? null,
                result: x.result,
              }
            : null;
        })();
    if (!actual || !['submitted', 'completed'].includes(actual.status))
      throw new Error('Assessment must be submitted before certificate issuance');
    const name = db
      ? ((
          await db.query<{ name: string }>('SELECT name FROM public.organisations WHERE id=$1', [
            actual.organisation_id,
          ])
        ).rows[0]?.name ?? '')
      : (organisationsById.get(actual.organisation_id)?.name ?? '');
    const r: CertificateRecord = {
      kind: 'assessment',
      certificateNumber: newCertificateNumber(),
      issuedAt: new Date().toISOString(),
      completedAt: actual.submitted_at ? iso(actual.submitted_at) : null,
      holderName: name,
      organisationName: name,
      title: actual.title,
      quizScore: null,
      areasAssessed: ASSESSMENT_AREAS,
      courseId: 'fraud-risk-assessment',
      courseVersion:
        actual.result?.methodVersion === undefined ? null : String(actual.result.methodVersion),
      snapshotOrigin: 'issued',
      sourceId: newId(),
      userId: actual.created_by_user_id,
      organisationId: actual.organisation_id,
      sessionId: null,
      trainingKey: null,
      status: 'valid',
      revokedAt: null,
    };
    const row: AssessmentCertificateRow = {
      id: r.sourceId,
      assessment_id: a.id,
      organisation_id: actual.organisation_id,
      certificate_number: r.certificateNumber,
      issued_at: r.issuedAt,
    };
    if (db) {
      await db.query(
        `INSERT INTO public.assessment_certificates (id,assessment_id,organisation_id,certificate_number,issued_at) VALUES ($1,$2,$3,$4,$5)`,
        [row.id, row.assessment_id, row.organisation_id, row.certificate_number, row.issued_at]
      );
      await storeRecord(r, a.id, db);
    }
    await auditLog(
      {
        eventType: 'assessment.certificate_generate',
        organisationId: actual.organisation_id,
        resourceType: 'certificate',
        resourceId: r.certificateNumber,
        details: { assessmentId: a.id, automatic: true },
      },
      db
    );
    if (!db) {
      assessmentCertificates.set(a.id, row);
      certificateRecords.set(r.certificateNumber, r);
    }
    return row;
  });
}
export function issueAssessmentCertificateLater(a: Assessment): void {
  issueAssessmentCertificate(a).catch((error: unknown) =>
    logger.error('Could not issue assessment certificate', {
      assessmentId: a.id,
      error: String(error),
    })
  );
}
export function canDownload(
  r: CertificateRecord,
  auth: { userId: string; organisationId: string; role: string }
): boolean {
  return (
    r.userId === auth.userId ||
    (!!r.organisationId &&
      r.organisationId === auth.organisationId &&
      ['employer', 'admin'].includes(auth.role))
  );
}
/** Authorisation and audit are checked again under the row lock. Repeated requests preserve the first revocation. */
export async function revokeCertificate(
  number: string,
  auth: AuthContext,
  reason: string,
  request: { ipAddress?: string; userAgent?: string } = {}
): Promise<{ changed: boolean; record: CertificateRecord } | null> {
  const action = async (db?: PoolClient) => {
    const stored = db
      ? (
          await db.query<StoredRecord>(
            'SELECT * FROM public.certificate_records WHERE certificate_number=$1 FOR UPDATE',
            [number]
          )
        ).rows[0]
      : null;
    const r = db ? (stored ? recordOf(stored) : null) : await findCertificate(number);
    if (!r || auth.role !== 'admin' || r.organisationId !== auth.organisationId) return null;
    // An unexpired JWT must not retain admin authority after a role or tenant change.
    const currentAdmin = db
      ? (
          await db.query<{ role: string; organisation_id: string }>(
            'SELECT role,organisation_id FROM public.users WHERE id=$1 FOR SHARE',
            [auth.userId]
          )
        ).rows[0]
      : (() => {
          const user = memUserById(auth.userId);
          return user ? { role: user.role, organisation_id: user.organisationId } : null;
        })();
    if (
      !currentAdmin ||
      currentAdmin.role !== 'admin' ||
      currentAdmin.organisation_id !== auth.organisationId
    )
      return null;
    if (r.status === 'revoked') return { changed: false, record: r };
    const revokedAt = new Date().toISOString();
    if (db)
      await db.query(
        `UPDATE public.certificate_records SET status='revoked',revoked_at=$2,revoked_by=$3,revocation_reason=$4 WHERE certificate_number=$1`,
        [number, revokedAt, auth.userId, reason]
      );
    await auditLog(
      {
        eventType: 'certificate.revoked',
        actorId: auth.userId,
        actorEmail: auth.email,
        organisationId: auth.organisationId,
        resourceType: 'certificate',
        resourceId: number,
        details: { kind: r.kind, reason },
        ...request,
      },
      db
    );
    const updated = { ...r, status: 'revoked' as const, revokedAt };
    if (!db) certificateRecords.set(number, updated);
    return { changed: true, record: updated };
  };
  return locked(`revoke:${number}`, action);
}

// ── PDF ──────────────────────────────────────────────────────

/** Render snapshot strings literally, including entity-looking text, just as the verification UI does. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function longDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

/** The certificate as an HTML page, A4 landscape, with a QR code that opens the verification page. */
export async function certificateHtml(details: CertificateDetails): Promise<string> {
  const url = verifyUrl(details.certificateNumber);
  const qr = await QRCode.toString(url, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b2545', light: '#ffffff' },
  });
  const training = details.kind === 'training';
  const statement = training
    ? `has successfully completed the ${esc(details.title)}${details.quizScore !== null ? `, with a quiz score of ${details.quizScore}%` : ''}.`
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
  .holder { font-family: Georgia, 'Times New Roman', serif; font-size: ${details.holderName.length > 120 ? 16 : details.holderName.length > 80 ? 20 : 26}pt; margin: 3mm 0 1mm; color: #1b263b; }
  .org { font-size: 13pt; color: #33415c; }
  .holder, .org, .statement { overflow-wrap: anywhere; word-break: break-word; }
  .statement { font-size: 12pt; margin-top: 6mm; max-width: 190mm; line-height: 1.5; }
  .footer { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm; }
  .facts { display: flex; flex-wrap: wrap; gap: 5mm 10mm; font-size: 10pt; }
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
  ${details.snapshotOrigin === 'legacy_reconstructed' ? '<div class="subject">Legacy record: details reconstructed from existing records.</div>' : ''}
  <div class="footer">
    <div class="facts">
      <div><div class="label">Certificate number</div><div class="value mono">${esc(details.certificateNumber)}</div></div>
      <div><div class="label">Date completed</div><div class="value">${details.completedAt ? longDate(details.completedAt) : 'Not recorded'}</div></div>
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
