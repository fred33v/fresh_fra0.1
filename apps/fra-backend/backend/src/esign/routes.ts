import { Hono, type Context } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getDbPool } from '../db.js';
import { withTransaction, type DbExecutor } from '../db/transaction.js';
import { dbGetUserById } from '../db/users.js';
import {
  hasDatabase,
  requireAuth,
  isManagerRole,
  jsonError,
  type AuthContext,
} from '../helpers.js';
import { sendEmail, emailConfigured } from '../email.js';
import { rateLimit, getClientIp } from '../middleware.js';
import { appendAudit, verifyAudit } from './audit.js';
import { CONSENT, newToken, newCode, codeHash, equalHash, sha256 } from './crypto.js';
// Keep PDF/certificate libraries out of unrelated API startup and disabled deployments.
type PdfServices = typeof import('./finalise.js');
const checkFinalisation: PdfServices['checkFinalisation'] = async () =>
  (await import('./finalise.js')).checkFinalisation();
const finalise: PdfServices['finalise'] = async (...args) =>
  (await import('./finalise.js')).finalise(...args);

export function createEsignRoutes(
  overrides: Partial<{
    sendEmail: typeof sendEmail;
    emailConfigured: typeof emailConfigured;
    checkFinalisation: typeof checkFinalisation;
    finalise: typeof finalise;
  }> = {}
) {
  const services = { sendEmail, emailConfigured, checkFinalisation, finalise, ...overrides };
  const routes = new Hono();
  const uuid = z.string().uuid();
  const readable = z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[\x20-\x7e\u00a0-\u00ff]+$/, 'Use printable Latin characters for PDF text');
  const escape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
    );
  const page = (title: string, content: string) =>
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title><body><main><h1>${escape(title)}</h1>${content}</main></body></html>`;
  const success = (c: Context, data: unknown, status: 200 | 201 = 200) =>
    c.json({ success: true, data }, status);
  function origin(): string {
    const url = new URL(process.env.ESIGN_PUBLIC_URL ?? 'http://localhost:3000');
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    )
      throw new Error('Invalid ESIGN_PUBLIC_URL');
    return url.origin;
  }
  async function manager(c: Context): Promise<AuthContext | Response> {
    if (!hasDatabase())
      return jsonError(c, 503, 'DATABASE_REQUIRED', 'Electronic signing requires PostgreSQL');
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    if (c.get('apiKeyAuth' as never))
      return jsonError(c, 403, 'FORBIDDEN', 'Use a manager account');
    const user = await dbGetUserById(auth.userId);
    if (!user || !isManagerRole(user.role) || user.organisationId !== auth.organisationId)
      return jsonError(c, 403, 'FORBIDDEN', 'Current manager authority required');
    return { ...auth, role: user.role, email: user.email };
  }
  async function owned(c: Context, auth: AuthContext) {
    const id = c.req.param('id');
    if (!uuid.safeParse(id).success) return null;
    return (
      (
        await getDbPool().query(
          'SELECT * FROM public.esign_documents WHERE id=$1 AND organisation_id=$2',
          [id, auth.organisationId]
        )
      ).rows[0] ?? null
    );
  }
  // Do not log source documents, bearer links, codes or session cookies.
  routes.use('*', async (c, next) => {
    if (process.env.ESIGN_ENABLED !== 'true')
      return jsonError(c, 503, 'ESIGN_DISABLED', 'Electronic signing is not enabled');
    if (!hasDatabase())
      return jsonError(c, 503, 'DATABASE_REQUIRED', 'Electronic signing requires PostgreSQL');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cache-Control', 'no-store');
    if (c.req.path.startsWith('/api/v1/esign/sign/') && c.req.method === 'POST') {
      const supplied = c.req.header('origin');
      if (supplied && supplied !== origin()) {
        // Referrer-Policy:no-referrer can make browser form Origin opaque (null).
        const body = await c.req.parseBody();
        if (
          supplied !== 'null' ||
          typeof body.csrf !== 'string' ||
          !equalHash(body.csrf, csrfValue(c))
        )
          return jsonError(c, 403, 'ORIGIN_REJECTED', 'Signing origin mismatch');
      }
    }
    return next();
  });

  // Step 1: multipart fields title and file. Existing API body limit remains in force.
  routes.post('/documents', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const body = await c.req.parseBody();
    const title = z.string().trim().min(1).max(160).safeParse(body.title);
    const file = body.file;
    if (
      !title.success ||
      !(file instanceof File) ||
      file.type !== 'application/pdf' ||
      file.size > 5 * 1024 * 1024
    )
      return jsonError(
        c,
        400,
        'INVALID_PDF',
        'Provide a title and PDF file (maximum 5 MB, subject to API body limit)'
      );
    let prepared;
    const uploaded = new Uint8Array(await file.arrayBuffer());
    try {
      const { preparePdf } = await import('./finalise.js');
      prepared = await preparePdf(uploaded);
    } catch {
      return jsonError(c, 400, 'INVALID_PDF', 'Unreadable, encrypted or unsupported PDF');
    }
    const id = randomUUID();
    const hash = sha256(prepared.pdf);
    await withTransaction(async (db) => {
      await db.query(
        'INSERT INTO public.esign_documents(id,organisation_id,created_by,title,source_pdf,source_sha256,pages,original_pdf,original_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          id,
          auth.organisationId,
          auth.userId,
          title.data,
          prepared.pdf,
          hash,
          JSON.stringify(prepared.pages),
          Buffer.from(uploaded),
          sha256(uploaded),
        ]
      );
      await appendAudit(db, id, 'document.uploaded', auth.userId, {
        sourceSha256: hash,
        uploadedSha256: sha256(uploaded),
        pages: prepared.pages.length,
      });
    });
    return success(
      c,
      { id, title: title.data, sourceSha256: hash, pages: prepared.pages, status: 'draft' },
      201
    );
  });
  routes.get('/documents/:id', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc) return jsonError(c, 404, 'NOT_FOUND', 'Document not found');
    const signers = await getDbPool().query(
      'SELECT id,email,name,status,signed_at,invitation_sent_at FROM public.esign_signers WHERE document_id=$1 ORDER BY id',
      [doc.id]
    );
    const fields = await getDbPool().query(
      'SELECT * FROM public.esign_fields WHERE document_id=$1 ORDER BY id',
      [doc.id]
    );
    return success(c, {
      id: doc.id,
      title: doc.title,
      status: doc.status,
      sourceSha256: doc.source_sha256,
      pages: doc.pages,
      signers: signers.rows,
      fields: fields.rows,
      finalSha256: doc.final_sha256,
    });
  });
  routes.get('/documents/:id/source', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc) return jsonError(c, 404, 'NOT_FOUND', 'Document not found');
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'attachment; filename="prepared-document.pdf"');
    return c.body(new Uint8Array(doc.source_pdf));
  });
  // Step 2: one signer at a time; identities are frozen once sent.
  routes.post('/documents/:id/signers', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc) return jsonError(c, 404, 'NOT_FOUND', 'Document not found');
    const parsed = z
      .object({
        email: z
          .string()
          .email()
          .max(254)
          .transform((s) => s.toLowerCase()),
        name: readable,
      })
      .strict()
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid signer');
    const id = randomUUID();
    const added = await withTransaction(async (db) => {
      const current = (
        await db.query('SELECT status FROM public.esign_documents WHERE id=$1 FOR UPDATE', [doc.id])
      ).rows[0];
      if (current.status !== 'draft') return false;
      const { rows } = await db.query(
        'SELECT count(*)::int AS n FROM public.esign_signers WHERE document_id=$1',
        [doc.id]
      );
      if (rows[0].n >= 20) return false;
      const result = await db.query(
        'INSERT INTO public.esign_signers(id,document_id,email,name) VALUES($1,$2,$3,$4) ON CONFLICT(document_id,email) DO NOTHING RETURNING id',
        [id, doc.id, parsed.data.email, parsed.data.name]
      );
      if (!result.rowCount) return false;
      await appendAudit(db, doc.id, 'signer.added', auth.userId, {
        signerId: id,
        email: parsed.data.email,
      });
      return true;
    });
    return added
      ? success(c, { id, ...parsed.data }, 201)
      : jsonError(c, 409, 'CONFLICT', 'Document frozen, duplicate signer or signer limit reached');
  });
  // Step 3: replace draft layout, coordinates in PDF points from the top-left, zero-based pages.
  routes.put('/documents/:id/fields', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc) return jsonError(c, 404, 'NOT_FOUND', 'Document not found');
    const parsed = z
      .object({
        fields: z
          .array(
            z
              .object({
                signerId: uuid,
                page: z.number().int().min(0),
                x: z.number().finite().min(0),
                y: z.number().finite().min(0),
                width: z.number().finite().min(40),
                height: z.number().finite().min(20),
                kind: z.enum(['signature', 'name', 'date']),
              })
              .strict()
          )
          .min(1)
          .max(200),
      })
      .strict()
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid field layout');
    const saved = await withTransaction(async (db) => {
      const current = (
        await db.query('SELECT * FROM public.esign_documents WHERE id=$1 FOR UPDATE', [doc.id])
      ).rows[0];
      if (current.status !== 'draft') return false;
      const signers = (
        await db.query('SELECT id FROM public.esign_signers WHERE document_id=$1', [doc.id])
      ).rows;
      for (const f of parsed.data.fields) {
        const p = current.pages[f.page];
        if (
          !p ||
          f.x + f.width > p.width ||
          f.y + f.height > p.height ||
          !signers.some((s) => s.id === f.signerId)
        )
          return false;
      }
      await db.query('DELETE FROM public.esign_fields WHERE document_id=$1', [doc.id]);
      for (const f of parsed.data.fields)
        await db.query(
          'INSERT INTO public.esign_fields(id,document_id,signer_id,page,x,y,width,height,kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [randomUUID(), doc.id, f.signerId, f.page, f.x, f.y, f.width, f.height, f.kind]
        );
      await appendAudit(db, doc.id, 'fields.saved', auth.userId, { fields: parsed.data.fields });
      return true;
    });
    return saved
      ? success(c, { saved: true })
      : jsonError(c, 409, 'INVALID_LAYOUT', 'Document frozen or fields outside the page/signer');
  });

  async function invite(documentId: string, signerId: string): Promise<boolean> {
    if (!services.emailConfigured()) return false;
    // Persist only a digest, then deliver outside the transaction. A failed send is explicitly retryable.
    const token = newToken();
    const signer = await withTransaction(async (db) => {
      const doc = (
        await db.query('SELECT * FROM public.esign_documents WHERE id=$1 FOR UPDATE', [documentId])
      ).rows[0];
      if (doc.status !== 'sent' || new Date(doc.expires_at).getTime() <= Date.now()) return null;
      const s = (
        await db.query(
          'SELECT * FROM public.esign_signers WHERE id=$1 AND document_id=$2 FOR UPDATE',
          [signerId, documentId]
        )
      ).rows[0];
      if (!s || s.status !== 'pending') return null;
      await db.query(
        'UPDATE public.esign_signers SET token_hash=$2,token_expires_at=$3,session_hash=NULL,session_expires_at=NULL,otp_hash=NULL,otp_expires_at=NULL,otp_attempts=0,otp_sends=0,invitation_sent_at=NULL WHERE id=$1',
        [s.id, sha256(token), doc.expires_at]
      );
      await appendAudit(db, doc.id, 'invitation.prepared', 'system', { signerId: s.id });
      return s;
    });
    if (!signer) return false;
    const url = `${origin()}/api/v1/esign/sign/${token}`;
    try {
      await services.sendEmail({
        to: signer.email,
        subject: 'Document ready for electronic signature',
        text: `A document is ready for you. Review it and verify your email before deciding:\n${url}`,
        html: `<p>A document is ready for you.</p><p><a href="${escape(url)}">Review document</a></p>`,
      });
      await withTransaction(async (db) => {
        await db.query('SELECT id FROM public.esign_documents WHERE id=$1 FOR UPDATE', [
          documentId,
        ]);
        const changed = await db.query(
          'UPDATE public.esign_signers SET invitation_sent_at=now() WHERE id=$1 AND token_hash=$2 AND status=$3',
          [signer.id, sha256(token), 'pending']
        );
        if (changed.rowCount)
          await appendAudit(db, documentId, 'invitation.sent', 'system', { signerId: signer.id });
      });
      return true;
    } catch {
      return false;
    }
  }
  routes.post('/documents/:id/send', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc) return jsonError(c, 404, 'NOT_FOUND', 'Document not found');
    if (!services.emailConfigured())
      return jsonError(
        c,
        503,
        'EMAIL_REQUIRED',
        'Configure SMTP before sending signing invitations'
      );
    try {
      origin();
      codeHash('configuration', '000000');
      await services.checkFinalisation();
    } catch {
      return jsonError(
        c,
        503,
        'SEAL_NOT_CONFIGURED',
        'Configure the OTP secret, P12 seal certificate and dedicated S3 Object Lock bucket before sending'
      );
    }
    const signers = await withTransaction(async (db) => {
      const current = (
        await db.query('SELECT * FROM public.esign_documents WHERE id=$1 FOR UPDATE', [doc.id])
      ).rows[0];
      if (current.status !== 'draft') return null;
      const list = (
        await db.query('SELECT id FROM public.esign_signers WHERE document_id=$1 ORDER BY id', [
          doc.id,
        ])
      ).rows;
      const { rows } = await db.query(
        `SELECT s.id FROM public.esign_signers s WHERE s.document_id=$1 AND NOT EXISTS(SELECT 1 FROM public.esign_fields f WHERE f.signer_id=s.id AND f.kind='signature')`,
        [doc.id]
      );
      if (!list.length || rows.length) return null;
      await db.query(
        "UPDATE public.esign_documents SET status='sent',sent_at=now(),expires_at=now()+interval '7 days' WHERE id=$1",
        [doc.id]
      );
      await appendAudit(db, doc.id, 'document.sent', auth.userId, {
        sourceSha256: current.source_sha256,
        consent: CONSENT,
      });
      return list;
    });
    if (!signers)
      return jsonError(
        c,
        409,
        'NOT_READY',
        'Draft document needs signers and a signature field for each'
      );
    const deliveries = [];
    for (const signer of signers)
      deliveries.push({ signerId: signer.id, sent: await invite(doc.id, signer.id) });
    return success(c, { status: 'sent', deliveries });
  });
  routes.post('/documents/:id/signers/:signerId/resend', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc) return jsonError(c, 404, 'NOT_FOUND', 'Document not found');
    if (!uuid.safeParse(c.req.param('signerId')).success)
      return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid signer');
    const limited = await rateLimit('esign:resend', { windowMs: 60_000, max: 3 })(c);
    if (limited instanceof Response) return limited;
    return (await invite(doc.id, c.req.param('signerId')))
      ? success(c, { sent: true })
      : jsonError(
          c,
          503,
          'NOT_SENT',
          'Invitation not sent; check status, expiry and email delivery'
        );
  });

  async function participant(
    c: Context,
    session = false,
    lock = false,
    db: DbExecutor = getDbPool()
  ) {
    const token = c.req.param('token');
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    // Acquire locks consistently: document first, then signer, including finalisation and resend.
    const found = (
      await db.query('SELECT document_id,id FROM public.esign_signers WHERE token_hash=$1', [
        sha256(token),
      ])
    ).rows[0];
    if (!found) return null;
    const doc = (
      await db.query(
        `SELECT * FROM public.esign_documents WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
        [found.document_id]
      )
    ).rows[0];
    const s = (
      await db.query(`SELECT * FROM public.esign_signers WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [
        found.id,
      ])
    ).rows[0];
    if (
      !s ||
      s.token_hash !== sha256(token) ||
      !s.token_expires_at ||
      new Date(s.token_expires_at).getTime() <= Date.now()
    )
      return null;
    if (
      !doc ||
      doc.status !== 'sent' ||
      new Date(doc.expires_at).getTime() <= Date.now() ||
      s.status !== 'pending'
    )
      return null;
    if (session) {
      const cookie = getCookie(c, 'esign_session');
      if (
        !cookie ||
        !s.session_hash ||
        !equalHash(sha256(cookie), s.session_hash) ||
        new Date(s.session_expires_at).getTime() <= Date.now()
      )
        return null;
    }
    return { doc, s };
  }
  const csrfValue = (c: Context) =>
    codeHash(
      `csrf:${c.req.param('token') ?? c.req.path.split('/')[5]}`,
      getCookie(c, 'esign_session') ?? 'anonymous'
    );
  const csrfField = (c: Context) => `<input type="hidden" name="csrf" value="${csrfValue(c)}">`;
  const signBase = (c: Context) => `/api/v1/esign/sign/${c.req.param('token')}`;
  routes.get('/sign/:token', async (c) => {
    const p = await participant(c);
    if (!p)
      return c.html(
        page(
          'Link unavailable',
          '<p>This signing link is invalid, expired or already used. Contact the sender.</p>'
        ),
        404
      );
    const verified = await participant(c, true);
    if (!verified)
      return c.html(
        page(
          'Verify your email',
          `<p>Request a one-time code at the email address invited by the sender.</p><form method="post" action="${signBase(c)}/code">${csrfField(c)}<button>Send email code</button></form><form method="post" action="${signBase(c)}/verify">${csrfField(c)}<label>One-time code <input name="code" inputmode="numeric" pattern="[0-9]{6}" required autocomplete="one-time-code"></label><button>Verify</button></form>`
        )
      );
    return c.html(
      page(
        p.doc.title,
        `<p>Review the exact prepared PDF before signing. Source SHA-256: <code>${p.doc.source_sha256}</code></p><p><a href="${signBase(c)}/pdf">Download and review document</a></p><form method="post" action="${signBase(c)}/decision">${csrfField(c)}<label>Your full typed signature <input name="signature" required maxlength="120" value="${escape(p.s.name)}"></label><p><label><input type="checkbox" name="consent" value="yes" required> ${escape(CONSENT)}</label></p><input type="hidden" name="sourceSha256" value="${p.doc.source_sha256}"><button name="decision" value="sign">Sign document</button></form><form method="post" action="${signBase(c)}/decision">${csrfField(c)}<button name="decision" value="decline">Decline document</button></form>`
      )
    );
  });
  routes.post('/sign/:token/code', async (c) => {
    if (!services.emailConfigured())
      return jsonError(c, 503, 'EMAIL_REQUIRED', 'Email delivery is not configured');
    const limited = await rateLimit('esign:code', { windowMs: 600_000, max: 5 })(c);
    if (limited instanceof Response) return limited;
    const code = newCode();
    const p = await withTransaction(async (db) => {
      const p = await participant(c, false, true, db);
      if (!p) return null;
      if (
        p.s.otp_sends >= 5 ||
        (p.s.otp_sent_at && Date.now() - new Date(p.s.otp_sent_at).getTime() < 60_000)
      )
        return null;
      await db.query(
        "UPDATE public.esign_signers SET otp_hash=$2,otp_expires_at=now()+interval '10 minutes',otp_sent_at=now(),otp_attempts=0,otp_sends=otp_sends+1 WHERE id=$1",
        [p.s.id, codeHash(p.s.id, code)]
      );
      await appendAudit(db, p.doc.id, 'email_code.requested', p.s.id);
      return p;
    });
    if (!p)
      return jsonError(
        c,
        429,
        'CODE_UNAVAILABLE',
        'Link unavailable or code request limit reached; ask sender to resend'
      );
    try {
      await services.sendEmail({
        to: p.s.email,
        subject: 'Your document signing code',
        text: `Your code is ${code}. It expires in 10 minutes. Never share this code.`,
        html: `<p>Your document signing code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
      });
    } catch {
      return jsonError(c, 503, 'EMAIL_FAILED', 'Code delivery failed; retry after one minute');
    }
    return c.redirect(signBase(c), 303);
  });
  routes.post('/sign/:token/verify', async (c) => {
    const limited = await rateLimit('esign:verify', { windowMs: 600_000, max: 15 })(c);
    if (limited instanceof Response) return limited;
    const body = await c.req.parseBody();
    const code = typeof body.code === 'string' ? body.code : '';
    const session = newToken();
    const valid = await withTransaction(async (db) => {
      const p = await participant(c, false, true, db);
      if (
        !p ||
        !p.s.otp_hash ||
        !p.s.otp_expires_at ||
        new Date(p.s.otp_expires_at).getTime() <= Date.now() ||
        p.s.otp_attempts >= 5
      )
        return false;
      await db.query('UPDATE public.esign_signers SET otp_attempts=otp_attempts+1 WHERE id=$1', [
        p.s.id,
      ]);
      if (!/^\d{6}$/.test(code) || !equalHash(codeHash(p.s.id, code), p.s.otp_hash)) {
        await appendAudit(db, p.doc.id, 'email_code.rejected', p.s.id);
        return false;
      }
      await db.query(
        "UPDATE public.esign_signers SET otp_hash=NULL,otp_expires_at=NULL,session_hash=$2,session_expires_at=now()+interval '30 minutes' WHERE id=$1",
        [p.s.id, sha256(session)]
      );
      await appendAudit(db, p.doc.id, 'email_code.verified', p.s.id);
      return true;
    });
    if (!valid) return jsonError(c, 403, 'INVALID_CODE', 'Invalid, expired or already used code');
    setCookie(c, 'esign_session', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: signBase(c),
      maxAge: 1800,
    });
    return c.redirect(signBase(c), 303);
  });
  routes.get('/sign/:token/pdf', async (c) => {
    const p = await participant(c, true);
    if (!p) return jsonError(c, 403, 'VERIFICATION_REQUIRED', 'Verify your email');
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'attachment; filename="document-to-sign.pdf"');
    return c.body(new Uint8Array(p.doc.source_pdf));
  });
  routes.post('/sign/:token/decision', async (c) => {
    // A cross-origin form must never be allowed to submit a signer decision.
    const body = await c.req.parseBody();
    const decision = body.decision;
    if (decision !== 'sign' && decision !== 'decline')
      return jsonError(c, 400, 'VALIDATION_ERROR', 'Choose sign or decline');
    const signature = readable.safeParse(body.signature);
    if (decision === 'sign' && (body.consent !== 'yes' || !signature.success))
      return jsonError(
        c,
        400,
        'CONSENT_REQUIRED',
        'Explicit consent and a typed signature are required'
      );
    const id = await withTransaction(async (db) => {
      const p = await participant(c, true, true, db);
      if (!p) return null;
      if (decision === 'sign' && body.sourceSha256 !== p.doc.source_sha256) return null;
      await db.query(
        `UPDATE public.esign_signers SET status=$2,signature_text=$3,consent_text=$4,consent_at=$5,signed_at=now(),session_hash=NULL,session_expires_at=NULL,otp_hash=NULL,otp_expires_at=NULL WHERE id=$1`,
        [
          p.s.id,
          decision === 'sign' ? 'signed' : 'declined',
          decision === 'sign' && signature.success ? signature.data : null,
          decision === 'sign' ? CONSENT : null,
          decision === 'sign' ? new Date() : null,
        ]
      );
      await appendAudit(
        db,
        p.doc.id,
        decision === 'sign' ? 'signer.signed' : 'signer.declined',
        p.s.id,
        {
          sourceSha256: p.doc.source_sha256,
          consent: decision === 'sign' ? CONSENT : null,
          signature: decision === 'sign' && signature.success ? signature.data : null,
          ip: getClientIp(c),
          userAgent: c.req.header('user-agent')?.slice(0, 500) ?? null,
        }
      );
      if (decision === 'decline')
        await db.query("UPDATE public.esign_documents SET status='declined' WHERE id=$1", [
          p.doc.id,
        ]);
      return p.doc.id;
    });
    if (!id)
      return jsonError(
        c,
        409,
        'DECISION_UNAVAILABLE',
        'Verification expired, document changed or decision already recorded'
      );
    if (decision === 'decline')
      return c.html(page('Document declined', '<p>Your decision has been recorded.</p>'));
    try {
      await services.finalise(id);
    } catch {
      return c.html(
        page(
          'Signature recorded',
          '<p>Your signature is recorded. Final PDF sealing is pending; the sender can retry safely.</p>'
        ),
        202
      );
    }
    return c.html(
      page(
        'Signature recorded',
        '<p>Your signature is recorded. The final PDF is sealed once all signers have signed.</p>'
      )
    );
  });
  routes.post('/documents/:id/finalise', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc) return jsonError(c, 404, 'NOT_FOUND', 'Document not found');
    try {
      const object = await services.finalise(doc.id);
      return object
        ? success(c, { status: 'completed', sha256: object.sha256 })
        : jsonError(c, 409, 'NOT_READY', 'All signers must sign before finalisation');
    } catch {
      return jsonError(
        c,
        503,
        'FINALISATION_PENDING',
        'Sealing or immutable storage unavailable; signatures retained for retry'
      );
    }
  });
  routes.get('/documents/:id/audit', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc) return jsonError(c, 404, 'NOT_FOUND', 'Document not found');
    const entries = await withTransaction(async (db) => {
      await db.query('SELECT id FROM public.esign_documents WHERE id=$1 FOR UPDATE', [doc.id]);
      return verifyAudit(db, doc.id);
    });
    if (doc.status === 'completed') {
      try {
        const artifact = (
          await getDbPool().query('SELECT * FROM public.esign_artifacts WHERE document_id=$1', [
            doc.id,
          ])
        ).rows[0];
        if (!artifact) throw new Error('Missing evidence manifest');
        const client = new S3Client({ region: process.env.AWS_REGION ?? process.env.S3_REGION });
        const object = await client.send(
          new GetObjectCommand({
            Bucket: process.env.ESIGN_S3_BUCKET,
            Key: artifact.manifest_key,
            VersionId: artifact.manifest_version,
          })
        );
        const bytes = await object.Body?.transformToByteArray();
        if (!bytes) throw new Error('Missing retained manifest');
        const { verifyRetainedManifest } = await import('./finalise.js');
        verifyRetainedManifest(bytes, artifact.manifest_sha256, doc.id, entries, doc.final_sha256);
      } catch {
        return jsonError(
          c,
          503,
          'CHECKPOINT_UNVERIFIED',
          'Retained audit checkpoint could not be verified'
        );
      }
    }
    return success(c, {
      entries,
      head: entries.at(-1)?.hash ?? '0'.repeat(64),
      retainedCheckpointVerified: doc.status === 'completed',
    });
  });
  routes.get('/documents/:id/evidence', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc || doc.status !== 'completed')
      return jsonError(c, 404, 'NOT_FOUND', 'Completed evidence not found');
    const artifact = (
      await getDbPool().query('SELECT * FROM public.esign_artifacts WHERE document_id=$1', [doc.id])
    ).rows[0];
    const client = new S3Client({ region: process.env.AWS_REGION ?? process.env.S3_REGION });
    const object = await client.send(
      new GetObjectCommand({
        Bucket: process.env.ESIGN_S3_BUCKET,
        Key: artifact.manifest_key,
        VersionId: artifact.manifest_version,
      })
    );
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes || sha256(bytes) !== artifact.manifest_sha256)
      return jsonError(
        c,
        503,
        'INTEGRITY_FAILURE',
        'Stored manifest failed integrity verification'
      );
    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', 'attachment; filename="signing-evidence.json"');
    return c.body(new Uint8Array(bytes));
  });
  routes.get('/documents/:id/final', async (c) => {
    const auth = await manager(c);
    if (auth instanceof Response) return auth;
    const doc = await owned(c, auth);
    if (!doc || doc.status !== 'completed')
      return jsonError(c, 404, 'NOT_FOUND', 'Completed document not found');
    const client = new S3Client({ region: process.env.AWS_REGION ?? process.env.S3_REGION });
    const object = await client.send(
      new GetObjectCommand({
        Bucket: process.env.ESIGN_S3_BUCKET,
        Key: doc.final_key,
        VersionId: doc.final_version,
      })
    );
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes || sha256(bytes) !== doc.final_sha256)
      return jsonError(c, 503, 'INTEGRITY_FAILURE', 'Stored PDF failed integrity verification');
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'attachment; filename="signed-document.pdf"');
    return c.body(new Uint8Array(bytes));
  });
  return routes;
}
export default createEsignRoutes();
