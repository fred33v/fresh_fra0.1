import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import {
  S3Client,
  GetBucketVersioningCommand,
  GetObjectLockConfigurationCommand,
  PutObjectCommand,
  GetObjectRetentionCommand,
  GetObjectLegalHoldCommand,
} from '@aws-sdk/client-s3';
import { withTransaction } from '../db/transaction.js';
import { appendAudit, verifyAudit, type AuditEntry } from './audit.js';
import { sha256 } from './crypto.js';
import { inspectSealCertificate } from './certificate.js';

export interface Field {
  id: string;
  signer_id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'signature' | 'name' | 'date';
}
export interface Signer {
  id: string;
  email: string;
  name: string;
  status: string;
  signature_text: string;
  signed_at: Date;
  consent_text: string;
}
export interface SealInput {
  id: string;
  title: string;
  source_pdf: Buffer;
  source_sha256: string;
  audit_head: string;
}
export interface LockedObject {
  key: string;
  version: string;
  sha256: string;
}
export interface EvidenceStore {
  check(): Promise<void>;
  put(key: string, body: Buffer, contentType: string): Promise<LockedObject>;
}

export function evidenceStore(injectedClient?: S3Client): EvidenceStore {
  const bucket = process.env.ESIGN_S3_BUCKET;
  if (!bucket) throw new Error('ESIGN_S3_BUCKET is required');
  // Dedicated bucket: existing general upload/download routes cannot address this prefix.
  if (bucket === process.env.S3_BUCKET)
    throw new Error('E-sign evidence requires a separate S3 bucket');
  const client =
    injectedClient ?? new S3Client({ region: process.env.AWS_REGION ?? process.env.S3_REGION });
  const days = Number(process.env.ESIGN_RETENTION_DAYS ?? 3650);
  if (!Number.isInteger(days) || days < 365 || days > 36500)
    throw new Error('Invalid e-sign retention duration');
  return {
    async check() {
      const [versioning, lock] = await Promise.all([
        client.send(new GetBucketVersioningCommand({ Bucket: bucket })),
        client.send(new GetObjectLockConfigurationCommand({ Bucket: bucket })),
      ]);
      if (
        versioning.Status !== 'Enabled' ||
        lock.ObjectLockConfiguration?.ObjectLockEnabled !== 'Enabled'
      )
        throw new Error('E-sign bucket needs versioning and Object Lock');
    },
    async put(key, body, contentType) {
      const until = new Date(Math.floor((Date.now() + days * 86400_000) / 1000) * 1000);
      const result = await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ChecksumSHA256: Buffer.from(sha256(body), 'hex').toString('base64'),
          ObjectLockMode: 'COMPLIANCE',
          ObjectLockRetainUntilDate: until,
          ObjectLockLegalHoldStatus: 'ON',
          ServerSideEncryption: 'AES256',
          IfNoneMatch: '*',
        })
      );
      if (!result.VersionId || result.VersionId === 'null')
        throw new Error('S3 did not return a retained object version');
      const input = { Bucket: bucket, Key: key, VersionId: result.VersionId };
      const [retention, hold] = await Promise.all([
        client.send(new GetObjectRetentionCommand(input)),
        client.send(new GetObjectLegalHoldCommand(input)),
      ]);
      if (
        retention.Retention?.Mode !== 'COMPLIANCE' ||
        !retention.Retention.RetainUntilDate ||
        retention.Retention.RetainUntilDate < until ||
        hold.LegalHold?.Status !== 'ON'
      )
        throw new Error('S3 retention confirmation failed');
      return { key, version: result.VersionId, sha256: sha256(body) };
    },
  };
}

/** Rebuild page content without source annotations, scripts, links or form actions. */
export async function preparePdf(
  bytes: Uint8Array
): Promise<{ pdf: Buffer; pages: { width: number; height: number }[] }> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  if (source.getPageCount() < 1 || source.getPageCount() > 100)
    throw new Error('PDF must contain 1 to 100 pages');
  const pdf = await PDFDocument.create();
  source.getForm().flatten();
  for (const page of source.getPages())
    if (!page.node.Contents()) page.drawText(' ', { opacity: 0 });
  const flattened = await source.save();
  const embedded = await pdf.embedPdf(flattened);
  const pages = [];
  for (const page of embedded) {
    if (
      !Number.isFinite(page.width) ||
      !Number.isFinite(page.height) ||
      page.width < 40 ||
      page.height < 40 ||
      page.width > 14400 ||
      page.height > 14400
    )
      throw new Error('Invalid PDF page dimensions');
    pdf.addPage([page.width, page.height]).drawPage(page);
    pages.push({ width: page.width, height: page.height });
  }
  return { pdf: Buffer.from(await pdf.save({ useObjectStreams: false })), pages };
}

export async function renderSignedPdf(
  document: SealInput,
  signers: Signer[],
  fields: Field[],
  p12: Buffer,
  passphrase: string
): Promise<Buffer> {
  if (sha256(document.source_pdf) !== document.source_sha256)
    throw new Error('Source PDF integrity failure');
  const seal = inspectSealCertificate(p12, passphrase);
  const pdf = await PDFDocument.load(document.source_pdf);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const printable = (s: string) =>
    [...s]
      .map((character) => {
        try {
          font.encodeText(character);
          return character;
        } catch {
          return '?';
        }
      })
      .join('');
  for (const field of fields) {
    const signer = signers.find((s) => s.id === field.signer_id);
    if (!signer || signer.status !== 'signed') throw new Error('Missing signer decision');
    const page = pdf.getPage(field.page);
    if (
      !page ||
      field.x + field.width > page.getWidth() ||
      field.y + field.height > page.getHeight()
    )
      throw new Error('Invalid signing field');
    const text = printable(
      field.kind === 'date'
        ? new Date(signer.signed_at).toISOString().slice(0, 10)
        : field.kind === 'name'
          ? signer.name
          : signer.signature_text
    );
    const size = Math.min(
      18,
      field.height - 8,
      (field.width - 8) / Math.max(font.widthOfTextAtSize(text, 1), 1)
    );
    page.drawRectangle({
      x: field.x,
      y: page.getHeight() - field.y - field.height,
      width: field.width,
      height: field.height,
      borderWidth: 0.5,
      borderColor: rgb(0.5, 0.5, 0.5),
    });
    page.drawText(text, {
      x: field.x + 4,
      y: page.getHeight() - field.y - field.height + 4,
      size,
      font,
    });
  }
  let certificate = pdf.addPage([595, 842]);
  let y = 800;
  const line = (s: string) => {
    if (y < 45) {
      certificate = pdf.addPage([595, 842]);
      y = 800;
    }
    certificate.drawText(printable(s).slice(0, 105), { x: 35, y, size: 9, font });
    y -= 15;
  };
  line('Electronic signing completion record — internal electronic signature');
  line('This platform seal does not assert an advanced or qualified signer certificate.');
  line(`Document: ${document.id}`);
  line(`Title: ${document.title}`);
  line(`Prepared source SHA-256: ${document.source_sha256}`);
  line(`Decision audit head: ${document.audit_head}`);
  line('Seal certificate SHA-256:');
  line(seal.fingerprint);
  for (const signer of signers) {
    line(`Signer: ${signer.name} <${signer.email}>`);
    line(`Typed signature: ${signer.signature_text}`);
    line(`Email code verified; signed at ${new Date(signer.signed_at).toISOString()}`);
    // Full consent and Unicode identities are retained without truncation in the evidence manifest.
    line('Electronic records/signature consent recorded; full evidence accompanies this PDF.');
    y -= 10;
  }
  pdflibAddPlaceholder({
    pdfDoc: pdf,
    reason: 'Seal completed signing evidence',
    contactInfo: process.env.EMAIL_FROM ?? '',
    name: 'FRA electronic signing',
    location: 'Platform seal',
    signatureLength: 16384,
  });
  const bytes = Buffer.from(await pdf.save({ useObjectStreams: false }));
  return new SignPdf().sign(bytes, new P12Signer(p12, { passphrase }));
}

export async function checkFinalisation(): Promise<void> {
  if (!process.env.ESIGN_P12_PATH) throw new Error('ESIGN_P12_PATH is required');
  inspectSealCertificate(
    await readFile(process.env.ESIGN_P12_PATH),
    process.env.ESIGN_P12_PASSPHRASE ?? ''
  );
  await evidenceStore().check();
}

/** Document lock serialises completion/retries. Failures roll back DB state, never the signer decision. */
export async function finalise(
  documentId: string,
  store = evidenceStore(),
  certificate?: { p12: Buffer; passphrase: string }
): Promise<LockedObject | null> {
  return withTransaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM public.esign_documents WHERE id=$1 FOR UPDATE', [
      documentId,
    ]);
    const doc = rows[0];
    if (!doc) throw new Error('Document missing');
    if (doc.status === 'completed')
      return { key: doc.final_key, version: doc.final_version, sha256: doc.final_sha256 };
    if (doc.status !== 'sent') return null;
    const { rows: signers } = await db.query<Signer>(
      'SELECT * FROM public.esign_signers WHERE document_id=$1 ORDER BY id',
      [documentId]
    );
    if (!signers.length || signers.some((s) => s.status !== 'signed')) return null;
    const { rows: fields } = await db.query<Field>(
      'SELECT * FROM public.esign_fields WHERE document_id=$1 ORDER BY id',
      [documentId]
    );
    await verifyAudit(db, documentId);
    await store.check();
    const p12 = certificate?.p12 ?? (await readFile(process.env.ESIGN_P12_PATH ?? ''));
    const pdf = await renderSignedPdf(
      doc,
      signers,
      fields,
      p12,
      certificate?.passphrase ?? process.env.ESIGN_P12_PASSPHRASE ?? ''
    );
    await appendAudit(db, documentId, 'document.sealed', 'system', {
      pdfSha256: sha256(pdf),
      sourceSha256: doc.source_sha256,
    });
    const audit = await verifyAudit(db, documentId);
    // Unique attempt namespace: uncertain uploads are retained; no mutable "latest" object is used.
    const prefix = `esign/${doc.organisation_id}/${doc.id}/${crypto.randomUUID()}`;
    if (sha256(doc.original_pdf) !== doc.original_sha256)
      throw new Error('Original upload integrity failure');
    const originalObject = await store.put(
      `${prefix}/uploaded.pdf`,
      doc.original_pdf,
      'application/pdf'
    );
    const sourceObject = await store.put(`${prefix}/source.pdf`, doc.source_pdf, 'application/pdf');
    const pdfObject = await store.put(`${prefix}/signed.pdf`, pdf, 'application/pdf');
    const manifest = Buffer.from(
      JSON.stringify(
        {
          version: 1,
          documentId,
          originalObject,
          sourceObject,
          pdfObject,
          signers: signers.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            signature: s.signature_text,
            signedAt: s.signed_at,
            consent: s.consent_text,
          })),
          fields,
          audit,
        },
        null,
        2
      )
    );
    const evidence = await store.put(`${prefix}/evidence.json`, manifest, 'application/json');
    await db.query(
      `UPDATE public.esign_documents SET status='completed',final_key=$2,final_version=$3,final_sha256=$4 WHERE id=$1`,
      [documentId, pdfObject.key, pdfObject.version, pdfObject.sha256]
    );
    await db.query(
      'INSERT INTO public.esign_artifacts(document_id,manifest_key,manifest_version,manifest_sha256) VALUES($1,$2,$3,$4)',
      [documentId, evidence.key, evidence.version, evidence.sha256]
    );
    return pdfObject;
  });
}

/** Compare the live ledger with the externally retained completion checkpoint. */
export function verifyRetainedManifest(
  bytes: Uint8Array,
  expectedHash: string,
  documentId: string,
  entries: AuditEntry[],
  pdfHash: string
): void {
  if (sha256(bytes) !== expectedHash) throw new Error('Retained manifest integrity failure');
  const manifest = JSON.parse(Buffer.from(bytes).toString('utf8')) as {
    documentId?: string;
    pdfObject?: { sha256?: string };
    audit?: { hash?: string }[];
  };
  if (
    manifest.documentId !== documentId ||
    manifest.pdfObject?.sha256 !== pdfHash ||
    !Array.isArray(manifest.audit) ||
    manifest.audit.length !== entries.length ||
    manifest.audit.some((e, i) => e.hash !== entries[i].hash)
  )
    throw new Error('Retained audit checkpoint mismatch');
}
