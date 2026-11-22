import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { withTransaction } from '../db/transaction.js';
import { recruitmentIdentity, recruitmentAudit, RecruitmentError } from '../provider-recruitment.js';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { rateLimit } from '../middleware.js';
import { createLogger } from '../logger.js';
import {
  StorageIntegrityError,
  StorageUnavailableError,
  objectStore,
  uploadTarget,
  type UploadTarget,
} from '../provider-document-storage.js';
import { ScanUnavailableError, scanRequired, scannerFromEnv } from '../provider-document-scan.js';
import type { AuthContext } from '../helpers.js';
import {
  DOCUMENT_KINDS,
  DOCUMENT_MIN_BYTES,
  DOCUMENTS_PER_APPLICATION,
  attachmentDisposition,
  detectDocumentMime,
  safeDocumentFilename,
  sha256Hex,
} from '../provider-documents.js';

/**
 * Evidence documents on a provider application. Mounted beside the application routes: the applicant manages
 * their own under /me/documents, and recruitment reviewers (same authority and MFA rules as the review queue)
 * list, download and decide them under /:id/documents.
 */
const routes: Hono = new Hono();
const logger = createLogger('provider-documents');
const id = z.string().uuid();
const kindSchema = z.enum(DOCUMENT_KINDS);
const decisionSchema = z.strictObject({
  status: z.enum(['verified', 'rejected']),
  reason: z.string().trim().min(10).max(500).optional(),
}).refine((d) => d.status !== 'rejected' || d.reason, { message: 'Give the applicant a reason', path: ['reason'] });

// What the applicant sees. Staff identifiers stay with reviewers.
const applicantView = `id, kind, filename, mime_type AS "mimeType", size_bytes AS "sizeBytes", sha256,
  uploaded_at AS "uploadedAt", status, decision_reason AS "decisionReason", decided_at AS "decidedAt"`;
const reviewerView = `${applicantView}, application_revision AS "applicationRevision", uploaded_by AS "uploadedBy",
  decided_by AS "decidedBy", scan_status AS "scanStatus", storage`;

function session(c: Context) {
  c.header('Cache-Control', 'no-store');
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never)) return jsonError(c, 403, 'FORBIDDEN', 'A personal account is required');
  if (!hasDatabase()) return jsonError(c, 503, 'SERVICE_UNAVAILABLE', 'Provider applications are temporarily unavailable');
  return auth;
}

/** Problems with where files are kept or scanned are the service being unavailable, not a mistake by the caller. */
function unavailable(c: Context, error: unknown) {
  if (error instanceof StorageUnavailableError || error instanceof ScanUnavailableError) {
    logger.error('Provider document storage or scanning unavailable', { error: error.message });
    return jsonError(c, 503, 'SERVICE_UNAVAILABLE', 'Document handling is temporarily unavailable. Please try again shortly.');
  }
  if (error instanceof StorageIntegrityError) {
    logger.error('Provider document failed its integrity check', { error: error.message });
    return jsonError(c, 500, 'INTERNAL_ERROR', 'This document could not be verified and was not served.');
  }
  return null;
}

async function respond(c: Context, action: () => Promise<unknown>, status: 200 | 201 = 200) {
  try {
    return c.json({ success: true, data: await action() }, status);
  } catch (error) {
    if (error instanceof RecruitmentError) return jsonError(c, error.status, 'RECRUITMENT_ERROR', error.message);
    const failed = unavailable(c, error);
    if (failed) return failed;
    throw error; // The global handler logs internal details and returns a safe error.
  }
}

type StoredFile = {
  filename: string;
  mime_type: string;
  sha256: string;
  size_bytes: number;
  storage: 'database' | 's3';
  storage_key: string | null;
  content: Buffer | null;
};

/** The bytes, from wherever the row says they are. A file kept in S3 is accepted only if it still matches its recorded hash. */
async function bytesOf(file: StoredFile): Promise<Buffer> {
  if (file.storage === 'database') return file.content as Buffer;
  const content = await objectStore().get(file.storage_key as string);
  if (content.length !== file.size_bytes || sha256Hex(content) !== file.sha256)
    throw new StorageIntegrityError(`Stored object ${file.storage_key} does not match its recorded size and hash`);
  return content;
}

function fileResponse(file: StoredFile, content: Buffer) {
  return new Response(new Uint8Array(content), {
    status: 200,
    headers: {
      'Content-Type': file.mime_type,
      'Content-Length': String(content.length),
      'Content-Disposition': attachmentDisposition(file.filename),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}

async function respondWithFile(c: Context, load: () => Promise<StoredFile>) {
  try {
    const file = await load();
    return fileResponse(file, await bytesOf(file));
  } catch (error) {
    if (error instanceof RecruitmentError) return jsonError(c, error.status, 'RECRUITMENT_ERROR', error.message);
    const failed = unavailable(c, error);
    if (failed) return failed;
    throw error;
  }
}

const fileColumns = 'id, application_id, filename, mime_type, sha256, size_bytes, storage, storage_key, content';

// ── Applicant ───────────────────────────────────────────────────

const mib = (bytes: number) => (bytes >= 1048576 ? `${bytes / 1048576} MiB` : `${Math.round(bytes / 1024)} KiB`);

/**
 * The application an upload would attach to, with the rules every upload must meet. Run once before the file is
 * scanned or stored (so a refused upload costs nothing) and again, under a row lock, when it is recorded.
 */
async function uploadTargetApplication(db: PoolClient, auth: AuthContext, lock: boolean) {
  await recruitmentIdentity(db, auth);
  const application = (
    await db.query(
      `SELECT id, revision, status FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2${lock ? ' FOR UPDATE' : ''}`,
      [auth.userId, auth.organisationId]
    )
  ).rows[0];
  if (!application) throw new RecruitmentError(404, 'Application not found');
  if (!['submitted', 'declined'].includes(application.status))
    throw new RecruitmentError(409, 'Evidence can be added only while the application is submitted or declined');
  const { count } = (
    await db.query('SELECT count(*)::int AS count FROM public.provider_application_documents WHERE application_id=$1', [application.id])
  ).rows[0];
  if (count >= DOCUMENTS_PER_APPLICATION)
    throw new RecruitmentError(409, `At most ${DOCUMENTS_PER_APPLICATION} evidence files per application`);
  return application as { id: string; revision: number; status: string };
}

routes.get('/me/documents/limits', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  try {
    const target = uploadTarget();
    return c.json({
      success: true,
      data: {
        minBytes: DOCUMENT_MIN_BYTES,
        maxBytes: target.maxBytes,
        maxFiles: DOCUMENTS_PER_APPLICATION,
        scanning: scannerFromEnv() !== null,
      },
    });
  } catch (error) {
    return unavailable(c, error) ?? jsonError(c, 500, 'INTERNAL_ERROR', 'Could not read the upload limits');
  }
});

routes.post('/me/documents', async (c) => {
  const limited = await rateLimit('provider:evidence', { windowMs: 60_000, max: 20 })(c);
  if (limited instanceof Response) return limited;
  const auth = session(c);
  if (auth instanceof Response) return auth;
  let target: UploadTarget;
  try {
    target = uploadTarget();
  } catch (error) {
    return unavailable(c, error) ?? jsonError(c, 500, 'INTERNAL_ERROR', 'Could not prepare the upload');
  }
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = kindSchema.safeParse(form?.get('kind'));
  if (!file || typeof file === 'string' || !kind.success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Choose a document type and a file');
  if (file.size < DOCUMENT_MIN_BYTES || file.size > target.maxBytes)
    return jsonError(c, 400, 'VALIDATION_ERROR', `Evidence files must be between 8 bytes and ${mib(target.maxBytes)}`);
  const content = Buffer.from(await file.arrayBuffer());
  const mime = detectDocumentMime(content);
  if (!mime) return jsonError(c, 400, 'VALIDATION_ERROR', 'Only PDF, PNG and JPEG evidence is accepted');
  const filename = safeDocumentFilename(file.name);
  const hash = sha256Hex(content);
  const documentId = randomUUID();
  const storageKey = target.mode === 's3' ? target.keyFor(documentId) : null;
  let storedInS3 = false;

  try {
    // Cheap refusals first: the wrong application state or a full application should not cost a scan or a write.
    await withTransaction((db) => uploadTargetApplication(db, auth, false));

    const scanner = scannerFromEnv();
    let scan: { engine: string } | null = null;
    if (scanner) {
      const verdict = await scanner.scan(content); // an unreachable scanner throws, so the file is not stored
      if (verdict.status === 'infected') {
        await withTransaction(async (db) => {
          const application = await uploadTargetApplication(db, auth, false);
          // The file itself is not kept; its hash and the signature are enough to investigate.
          await recruitmentAudit(db, application.id, auth.userId, 'document.rejected_by_scan', {
            kind: kind.data,
            sha256: hash,
            signature: verdict.signature,
            engine: verdict.engine,
          });
        }).catch((error) => logger.error('Could not record a scan rejection', { error: String(error) }));
        return jsonError(c, 422, 'FILE_REJECTED', 'This file was rejected by our virus scan and was not stored.');
      }
      scan = { engine: verdict.engine };
    }

    if (target.mode === 's3') {
      await target.objects.put(storageKey as string, content, { mimeType: mime, sha256: hash });
      storedInS3 = true;
    }

    const saved = await withTransaction(async (db) => {
      // The application row lock serialises uploads, so the per-application limit cannot be raced past.
      const application = await uploadTargetApplication(db, auth, true);
      const row = (
        await db.query(
          `INSERT INTO public.provider_application_documents
             (id, application_id, application_revision, kind, filename, mime_type, content, sha256, uploaded_by,
              storage, storage_key, size_bytes, scan_status, scanned_at, scan_engine)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING ${applicantView}`,
          [
            documentId, application.id, application.revision, kind.data, filename, mime,
            target.mode === 'database' ? content : null, hash, auth.userId,
            target.mode, storageKey, content.length,
            scan ? 'clean' : 'not_scanned', scan ? new Date() : null, scan ? scan.engine : null,
          ]
        )
      ).rows[0];
      await recruitmentAudit(db, application.id, auth.userId, 'document.uploaded', {
        documentId,
        kind: kind.data,
        sha256: hash,
        applicationRevision: application.revision,
        storage: target.mode,
        scan: scan ? 'clean' : 'not_scanned',
      });
      return row;
    });
    return c.json({ success: true, data: saved }, 201);
  } catch (error) {
    // The record was not made, so a file already written to S3 would be an orphan holding personal data: remove it.
    if (storedInS3 && target.mode === 's3') {
      await target.objects.remove(storageKey as string).catch((cleanup) =>
        logger.error('Could not remove an orphaned evidence object', { key: storageKey, error: String(cleanup) })
      );
    }
    if (error instanceof RecruitmentError) return jsonError(c, error.status, 'RECRUITMENT_ERROR', error.message);
    const failed = unavailable(c, error);
    if (failed) return failed;
    throw error;
  }
});

routes.get('/me/documents', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  return respond(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      return (
        await db.query(
          `SELECT ${applicantView} FROM public.provider_application_documents d
           WHERE application_id = (SELECT id FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2)
           ORDER BY uploaded_at DESC, id`,
          [auth.userId, auth.organisationId]
        )
      ).rows;
    })
  );
});

routes.get('/me/documents/:docId/file', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  if (!id.safeParse(c.req.param('docId')).success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid document');
  return respondWithFile(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      const file = (
        await db.query(
          `SELECT ${fileColumns} FROM public.provider_application_documents
           WHERE id=$3 AND application_id = (SELECT id FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2)`,
          [auth.userId, auth.organisationId, c.req.param('docId')]
        )
      ).rows[0];
      if (!file) throw new RecruitmentError(404, 'Document not found');
      return file;
    })
  );
});

// ── Reviewer ────────────────────────────────────────────────────

routes.get('/:id/documents', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  if (!id.safeParse(c.req.param('id')).success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid application');
  return respond(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const application = (await db.query('SELECT id FROM public.provider_applications WHERE id=$1', [c.req.param('id')])).rows[0];
      if (!application) throw new RecruitmentError(404, 'Application not found');
      return (
        await db.query(
          `SELECT ${reviewerView} FROM public.provider_application_documents WHERE application_id=$1 ORDER BY uploaded_at DESC, id`,
          [application.id]
        )
      ).rows;
    })
  );
});

routes.get('/:id/documents/:docId/file', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  if (!id.safeParse(c.req.param('id')).success || !id.safeParse(c.req.param('docId')).success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid document');
  return respondWithFile(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const file = (
        await db.query(
          `SELECT ${fileColumns} FROM public.provider_application_documents
           WHERE id=$2 AND application_id=$1`,
          [c.req.param('id'), c.req.param('docId')]
        )
      ).rows[0];
      if (!file) throw new RecruitmentError(404, 'Document not found');
      // Reading an applicant's identity documents is itself a recorded event.
      await recruitmentAudit(db, file.application_id, auth.userId, 'document.downloaded', {
        documentId: file.id,
        sha256: file.sha256,
      });
      return file;
    })
  );
});

routes.post('/:id/documents/:docId/decision', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  const parsed = decisionSchema.safeParse(await c.req.json().catch(() => null));
  if (!id.safeParse(c.req.param('id')).success || !id.safeParse(c.req.param('docId')).success || !parsed.success)
    return jsonError(c, 400, 'VALIDATION_ERROR', parsed.success ? 'Invalid document' : (parsed.error.issues[0]?.message ?? 'Invalid decision'));
  return respond(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const application = (
        await db.query('SELECT id, applicant_id FROM public.provider_applications WHERE id=$1 FOR SHARE', [c.req.param('id')])
      ).rows[0];
      if (!application) throw new RecruitmentError(404, 'Application not found');
      if (application.applicant_id === auth.userId) throw new RecruitmentError(403, 'You cannot decide evidence on your own application');
      const document = (
        await db.query('SELECT id, status, kind, sha256, scan_status FROM public.provider_application_documents WHERE id=$2 AND application_id=$1 FOR UPDATE', [
          application.id,
          c.req.param('docId'),
        ])
      ).rows[0];
      if (!document) throw new RecruitmentError(404, 'Document not found');
      if (document.status !== 'pending') throw new RecruitmentError(409, 'This document has already been decided');
      // Once scanning is required, a file that was never scanned (uploaded before it was switched on) cannot vouch for anyone.
      if (parsed.data.status === 'verified' && scanRequired() && document.scan_status !== 'clean')
        throw new RecruitmentError(409, 'This document has not been virus-scanned, so it cannot be verified. Ask the applicant to upload it again.');
      const saved = (
        await db.query(
          `UPDATE public.provider_application_documents SET status=$3, decided_by=$4, decided_at=now(), decision_reason=$5
           WHERE id=$2 AND application_id=$1 RETURNING ${reviewerView}`,
          [application.id, document.id, parsed.data.status, auth.userId, parsed.data.reason ?? null]
        )
      ).rows[0];
      await recruitmentAudit(db, application.id, auth.userId, `document.${parsed.data.status}`, {
        documentId: document.id,
        kind: document.kind,
        sha256: document.sha256,
        reason: parsed.data.reason ?? null,
      });
      return saved;
    })
  );
});

export default routes;
