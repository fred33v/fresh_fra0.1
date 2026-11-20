import {
  S3Client,
  GetObjectCommand,
  GetObjectRetentionCommand,
  GetObjectLegalHoldCommand,
} from '@aws-sdk/client-s3';
import type { DbExecutor } from '../db/transaction.js';
import { verifyAudit } from '../esign/audit.js';
import { sha256 } from '../esign/crypto.js';

/** Verify the exact retained versions, their checkpoint, retention and legal holds. No public URL. */
export async function verifyAgreementEvidence(
  db: DbExecutor,
  documentId: string,
  injectedClient?: S3Client
): Promise<Buffer> {
  const doc = (await db.query('SELECT * FROM public.esign_documents WHERE id=$1', [documentId]))
    .rows[0];
  const artifact = (
    await db.query('SELECT * FROM public.esign_artifacts WHERE document_id=$1', [documentId])
  ).rows[0];
  if (!doc || doc.status !== 'completed' || !artifact)
    throw new Error('Completed evidence required');
  const entries = await verifyAudit(db, documentId);
  const bucket = process.env.ESIGN_S3_BUCKET;
  if (!bucket || bucket === process.env.S3_BUCKET)
    throw new Error('Dedicated evidence bucket required');
  const client =
    injectedClient ??
    new S3Client({
      region: process.env.AWS_REGION ?? process.env.S3_REGION,
      maxAttempts: 2,
    });
  const get = async (key: string, version: string, hash: string) => {
    if (!key || !version || !hash) throw new Error('Exact object reference required');
    const input = { Bucket: bucket, Key: key, VersionId: version };
    const [object, retention, hold] = await Promise.all([
      client.send(new GetObjectCommand(input)),
      client.send(new GetObjectRetentionCommand(input)),
      client.send(new GetObjectLegalHoldCommand(input)),
    ]);
    const bytes = await object.Body?.transformToByteArray();
    if (
      !bytes ||
      sha256(bytes) !== hash ||
      object.VersionId !== version ||
      retention.Retention?.Mode !== 'COMPLIANCE' ||
      !retention.Retention.RetainUntilDate ||
      retention.Retention.RetainUntilDate.getTime() <= Date.now() ||
      hold.LegalHold?.Status !== 'ON'
    )
      throw new Error('Retained evidence integrity or protection failed');
    return Buffer.from(bytes);
  };
  try {
    const pdf = await get(doc.final_key, doc.final_version, doc.final_sha256);
    const manifest = await get(
      artifact.manifest_key,
      artifact.manifest_version,
      artifact.manifest_sha256
    );
    const { verifyRetainedManifest } = await import('../esign/finalise.js');
    verifyRetainedManifest(
      manifest,
      artifact.manifest_sha256,
      documentId,
      entries,
      doc.final_sha256
    );
    return pdf;
  } finally {
    if (!injectedClient) client.destroy();
  }
}
