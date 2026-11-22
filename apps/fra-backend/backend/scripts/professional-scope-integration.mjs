// Destructive fixtures are restricted to a disposable loopback database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { addVerifiedEvidence } from './lib/verified-evidence.mjs';
const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.PROFESSIONAL_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
    url.pathname.includes('professional'),
  'Disposable professional loopback database required'
);
process.env.NODE_ENV = 'test';
const { default: routes } = await import('../src/routes/professional-scopes.ts');
const { default: providers } = await import('../src/routes/provider-applications.ts');
const { default: workshop } = await import('../src/workshop.ts');
const { jwtSecret } = await import('../src/helpers.ts');
const { closeDbPool } = await import('../src/db.ts');
const { issueTrainingCertificate, findCertificate, publicDetails, certificateHtml } =
  await import('../src/certificates.ts');
const { validProfessionalScope, verifyProfessionalAudit } =
  await import('../src/professional-authority.ts');
const pool = new pg.Pool({ connectionString: url.href });
const app = new Hono()
  .route('/professional', routes)
  .route('/providers', providers)
  .route('/workshop', workshop);
app.onError((e, c) => c.json({ error: e.message }, 500));
let count = 0;
const pass = (n) => {
  count++;
  console.log('PASS ' + n);
};
async function actor(role = 'employer', org = randomUUID()) {
  const a = { id: randomUUID(), org, email: randomUUID() + '@example.test', role };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      "INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,'Trainer Fixture','unused',$3,$4,now())",
      [a.id, a.email, role, org]
    );
    await db.query(
      "INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Fixture',$2) ON CONFLICT DO NOTHING",
      [org, a.id]
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  a.token = jwt.sign({ sub: a.id, email: a.email, role, organisationId: a.org }, jwtSecret);
  a.auth = { userId: a.id, email: a.email, role, organisationId: a.org };
  return a;
}
async function call(a, path, body, status = 200) {
  const r = await app.request('http://localhost' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(a ? { authorization: 'Bearer ' + a.token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  assert.equal(r.status, status, text);
  return JSON.parse(text).data;
}
async function agreement(
  a,
  org = a.org,
  { title = 'Provider agreement', extraSigner = false } = {}
) {
  const id = randomUUID();
  const hash = 'a'.repeat(64);
  // Completed retained fixture; normal application clients cannot insert signing evidence.
  await pool.query(
    `INSERT INTO public.esign_documents(id,organisation_id,created_by,title,
    original_pdf,original_sha256,source_pdf,source_sha256,pages,status,final_key,final_version,final_sha256)
    VALUES($1,$2,$3,$5,'fixture',encode(sha256('fixture'::bytea),'hex'),
    'fixture',encode(sha256('fixture'::bytea),'hex'),'[]','draft','retained','v1',$4)`,
    [id, org, a.id, hash, title]
  );
  // Build retained fixture in the same state order as signing, without disabling integrity triggers.
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      `INSERT INTO public.esign_signers(id,document_id,email,name,status,consent_text,consent_at,signature_text,signed_at)
      VALUES($1,$2,$3,'Recruitment test','signed','fixture',now(),'Fixture',now())`,
      [randomUUID(), id, a.email]
    );
    if (extraSigner)
      await db.query(
        `INSERT INTO public.esign_signers(id,document_id,email,name,status,consent_text,consent_at,signature_text,signed_at)
      VALUES($1,$2,$3,'Other party','signed','fixture',now(),'Fixture',now())`,
        [randomUUID(), id, `other-${id}@example.test`]
      );
    await db.query("UPDATE public.esign_documents SET status='sent' WHERE id=$1", [id]);
    await db.query("UPDATE public.esign_documents SET status='completed' WHERE id=$1", [id]);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  await pool.query(
    `INSERT INTO public.esign_artifacts(document_id,manifest_key,manifest_version,manifest_sha256)
    VALUES($1,'manifest','v1',$2)`,
    [id, hash]
  );
  return id;
}
async function progress(a, session, complete = true) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO public.workshop_progress(id,user_id,session_id,current_section,completed_sections,quiz_scores,scenario_choices,completed_at) VALUES($1,$2,$3,6,$4,$5,'{}',$6)`,
    [
      id,
      a.id,
      session,
      complete ? [0, 1, 2, 3, 4, 5, 6] : [],
      complete ? { 1: 100, 2: 100, 3: 100, 4: 100 } : {},
      complete ? new Date() : null,
    ]
  );
  if (session)
    await pool.query('INSERT INTO public.session_participants(session_id,user_id) VALUES($1,$2)', [
      session,
      a.id,
    ]);
  return id;
}
const actions = ['deliver', 'assess', 'issue_completion'];
const request = {
  subjectId: 'fraud-risk-awareness',
  subjectVersion: '2026-10-30',
  revision: 0,
  actions,
  evidence: 'Qualifications and recorded demonstration checked by reviewer.',
};
const approval = (revision) => ({
  revision,
  status: 'approved',
  actions,
  validFrom: new Date(Date.now() - 60000).toISOString(),
  validUntil: new Date(Date.now() + 86400000).toISOString(),
  reason: 'Verified for this course delivery',
  qualificationCheck: 'Qualification verified against evidence',
  demonstrationCheck: 'Demonstration independently reviewed',
  checksConfirmed: true,
});
try {
  const reviewer = await actor('admin'),
    trainer = await actor(),
    other = await actor('admin'),
    learner = await actor('participant', trainer.org),
    incomplete = await actor('participant', trainer.org);
  process.env.PROVIDER_REVIEW_ORGANISATION_ID = reviewer.org;
  await call(null, '/professional/subjects', undefined, 401);
  await call(trainer, '/professional/applications/' + randomUUID() + '/scopes', undefined, 403);
  const application = await call(
    trainer,
    '/providers/me',
    {
      companyName: 'Trainer Business',
      serviceInterest: 'training',
      trainingExperience: 'Delivered supervised training examples',
    },
    201
  );
  const scope = await call(trainer, '/professional/me/scopes', request, 201);
  await call(reviewer, '/professional/scopes/' + scope.id + '/review', approval(1), 403);
  await call(other, '/professional/scopes/' + scope.id + '/review', approval(1), 403);
  await call(trainer, '/professional/me/scopes', { ...request, subjectVersion: 'invented' }, 400);
  await call(
    reviewer,
    '/professional/scopes/' + scope.id + '/review',
    { ...approval(1), checksConfirmed: undefined },
    400
  );
  const doc = await agreement(trainer, reviewer.org);
  await addVerifiedEvidence(pool, application.id, reviewer.id);
  await call(reviewer, '/providers/' + application.id + '/review', {
    revision: 0,
    status: 'approved',
    reason: 'Evidence and agreement verified',
    qualificationEvidence: 'Qualified evidence reviewed',
    agreementDocumentId: doc,
  });
  pass(
    'subject requests do not grant authority; current operator, provider agreement and explicit checks required'
  );
  const selfApplication = await call(
    reviewer,
    '/providers/me',
    {
      companyName: 'Reviewer Business',
      serviceInterest: 'training',
      trainingExperience: 'Demonstration awaiting independent review',
    },
    201
  );
  const selfScope = await call(reviewer, '/professional/me/scopes', request, 201);
  await call(reviewer, '/professional/scopes/' + selfScope.id + '/review', approval(1), 403);
  await pool.query(
    `CREATE OR REPLACE FUNCTION public.professional_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.application_id='${application.id}' AND NEW.event='scope.approved' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`
  );
  await pool.query(
    'CREATE TRIGGER professional_test_failure BEFORE INSERT ON public.professional_audit FOR EACH ROW EXECUTE FUNCTION public.professional_test_fail()'
  );
  try {
    await call(reviewer, '/professional/scopes/' + scope.id + '/review', approval(1), 500);
    assert.equal(
      (
        await pool.query('SELECT revision FROM public.provider_professional_scopes WHERE id=$1', [
          scope.id,
        ])
      ).rows[0].revision,
      1
    );
  } finally {
    await pool.query('DROP TRIGGER professional_test_failure ON public.professional_audit');
    await pool.query('DROP FUNCTION public.professional_test_fail()');
  }
  pass('self-approval is forbidden and audit failure rolls back the entire grant');
  let grant = await call(reviewer, '/professional/scopes/' + scope.id + '/review', approval(1));
  assert.equal(grant.revision, 2);
  const authorityProbe = await pool.connect();
  try {
    for (const sql of [
      'UPDATE public.provider_applications SET revision=revision+1 WHERE id=$1',
      "UPDATE public.provider_applications SET status='suspended',revision=revision+1 WHERE id=$1",
    ]) {
      await authorityProbe.query('BEGIN');
      await authorityProbe.query(sql, [application.id]);
      await assert.rejects(
        validProfessionalScope(authorityProbe, scope.id, 'deliver'),
        /Current approved/
      );
      await authorityProbe.query('ROLLBACK');
    }
    await authorityProbe.query('BEGIN');
    await authorityProbe.query(
      "UPDATE public.professional_subjects SET active=false WHERE id='fraud-risk-awareness'"
    );
    await assert.rejects(
      validProfessionalScope(authorityProbe, scope.id, 'deliver'),
      /Current approved/
    );
    await authorityProbe.query('ROLLBACK');
  } finally {
    await authorityProbe.query('ROLLBACK');
    authorityProbe.release();
  }

  await pool.query("UPDATE public.users SET email='changed-'||email WHERE id=$1", [trainer.id]);
  await assert.rejects(validProfessionalScope(pool, scope.id, 'deliver'), /Current approved/);
  await pool.query('UPDATE public.users SET email=$2 WHERE id=$1', [trainer.id, trainer.email]);

  await call(reviewer, '/professional/scopes/' + scope.id + '/review', approval(1), 409);
  await call(trainer, '/professional/me/scopes', { ...request, revision: 2 }, 409);
  const legacy = await call(reviewer, '/providers/' + application.id + '/assignments', {
    packageId: 'pkg_full',
    reference: randomUUID(),
    service: 'training',
  });
  await call(trainer, '/providers/me/assignments/' + legacy.id + '/decision', {
    status: 'accepted',
  });
  const create = (assignmentId) => ({
    scopeId: scope.id,
    scopeRevision: grant.revision,
    assignmentId,
    title: 'Professional course test',
  });
  await call(trainer, '/professional/sessions', create(legacy.id), 403);
  let assignment = await call(reviewer, '/providers/' + application.id + '/assignments', {
    packageId: 'pkg_full',
    reference: randomUUID(),
    service: 'training',
    scopeId: scope.id,
  });
  await call(trainer, '/professional/sessions', create(assignment.id), 403);
  await call(trainer, '/providers/me/assignments/' + assignment.id + '/decision', {
    status: 'accepted',
  });
  await call(other, '/professional/sessions', create(assignment.id), 403);
  const session = await call(trainer, '/professional/sessions', create(assignment.id), 201);
  const pid = await progress(learner, session.id);
  await pool.query(
    "INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,amount_cents,currency) VALUES($1,$2,$3,'pkg_full','succeeded',100,'gbp')",
    [randomUUID(), learner.org, learner.id]
  );
  await call(
    learner,
    '/workshop/certificates',
    { sessionId: session.id, professionalIssuer: trainer.auth, assessmentRevision: 1 },
    403
  );

  await progress(incomplete, session.id, false);
  pass(
    'only the current professional can create a class using an accepted subject-bound assignment'
  );
  await call(
    trainer,
    '/professional/sessions/' + session.id + '/assessments',
    {
      learnerId: trainer.id,
      revision: 0,
      decision: 'approved',
      reason: 'Reviewed course completion',
    },
    403
  );
  await call(
    trainer,
    '/professional/sessions/' + session.id + '/assessments',
    {
      learnerId: incomplete.id,
      revision: 0,
      decision: 'approved',
      reason: 'Reviewed course completion',
    },
    409
  );
  await assert.rejects(issueTrainingCertificate(learner.auth, session.id), /authorised trainer/);
  await assert.rejects(issueTrainingCertificate(learner.auth), /authorised trainer/);
  const reviewBody = {
    learnerId: learner.id,
    revision: 0,
    decision: 'approved',
    reason: 'Reviewed completed course and exercises',
  };
  const concurrent = await Promise.all(
    [0, 1].map(async () => {
      const r = await app.request(
        'http://localhost/professional/sessions/' + session.id + '/assessments',
        {
          method: 'POST',
          headers: { authorization: 'Bearer ' + trainer.token, 'content-type': 'application/json' },
          body: JSON.stringify(reviewBody),
        }
      );
      return r.status;
    })
  );
  assert.deepEqual(concurrent.sort(), [201, 409]);
  await call(
    trainer,
    '/professional/sessions/' + session.id + '/certificates',
    { learnerId: learner.id, assessmentRevision: 2 },
    409
  );
  await pool.query(
    "UPDATE public.workshop_progress SET completed_at=completed_at+interval '1 second' WHERE id=$1",
    [pid]
  );
  await call(
    trainer,
    '/professional/sessions/' + session.id + '/certificates',
    { learnerId: learner.id, assessmentRevision: 1 },
    409
  );
  await call(
    trainer,
    '/professional/sessions/' + session.id + '/assessments',
    { ...reviewBody, revision: 1 },
    201
  );
  pass(
    'self-certification, incomplete work, stale reviews and concurrent assessment changes are blocked'
  );
  const issued = await call(trainer, '/professional/sessions/' + session.id + '/certificates', {
    learnerId: learner.id,
    assessmentRevision: 2,
  });
  assert.equal(issued.created, true);
  const number = issued.row.certificate_number;
  const record = await findCertificate(number);
  assert(record.professionalAuthority);
  assert.equal(record.professionalAuthority.assessmentRevision, 2);
  assert.equal(record.professionalDelivery.subjectVersion, '2026-10-30');
  assert(!('professionalAuthority' in publicDetails(record)));
  assert.match(await certificateHtml(publicDetails(record)), /not professional accreditation/);
  const again = await call(trainer, '/professional/sessions/' + session.id + '/certificates', {
    learnerId: learner.id,
    assessmentRevision: 2,
  });
  assert.equal(again.created, false);
  assert.equal(again.row.certificate_number, number);
  const snapshot = (
    await pool.query(
      'SELECT snapshot FROM public.certificate_records WHERE certificate_number=$1',
      [number]
    )
  ).rows[0].snapshot;
  pass(
    'authorised issuance links the existing immutable registry to exact scope, assessment and public course provenance'
  );
  const audit = await call(reviewer, '/professional/applications/' + application.id + '/audit');
  assert(audit.entries.some((e) => e.event === 'certificate.issued'));
  await assert.rejects(
    pool.query("UPDATE public.professional_audit SET event='edited' WHERE application_id=$1", [
      application.id,
    ]),
    /immutable|change|append|Retained/i
  );
  await assert.rejects(
    pool.query('DELETE FROM public.professional_completion_reviews WHERE session_id=$1', [
      session.id,
    ]),
    /immutable|change|append|Retained/i
  );
  await assert.rejects(
    pool.query('UPDATE public.workshop_progress SET provider_session_id=NULL WHERE id=$1', [pid]),
    /immutable/
  );
  await call(reviewer, '/professional/scopes/' + scope.id + '/review', {
    revision: 2,
    status: 'suspended',
    reason: 'Authority suspended for review',
  });
  await call(trainer, '/professional/sessions/' + session.id + '/participants', undefined, 403);
  await call(learner, '/workshop/sessions/' + session.id, undefined, 403);
  await call(
    trainer,
    '/professional/sessions/' + session.id + '/certificates',
    { learnerId: learner.id, assessmentRevision: 2 },
    403
  );
  assert.deepEqual(
    (
      await pool.query(
        'SELECT snapshot FROM public.certificate_records WHERE certificate_number=$1',
        [number]
      )
    ).rows[0].snapshot,
    snapshot
  );
  pass(
    'append-only evidence is verified; suspended grants block current session access while issued snapshots stay intact'
  );
  // An independently completed self-study course still uses the established learner path.
  const self = await actor('participant');
  await progress(self, null);
  assert.equal((await issueTrainingCertificate(self.auth)).created, true);
  // Reactivation creates a new revision: old assignment/session authority stays stale.
  grant = await call(reviewer, '/professional/scopes/' + scope.id + '/review', {
    ...approval(3),
    actions: ['deliver'],
  });
  await call(trainer, '/professional/sessions/' + session.id + '/participants', undefined, 403);
  assignment = await call(reviewer, '/providers/' + application.id + '/assignments', {
    packageId: 'pkg_full',
    reference: randomUUID(),
    service: 'training',
    scopeId: scope.id,
  });
  await call(trainer, '/providers/me/assignments/' + assignment.id + '/decision', {
    status: 'accepted',
  });
  const second = await call(trainer, '/professional/sessions', create(assignment.id), 201);
  await call(trainer, '/professional/sessions/' + second.id + '/assessments', reviewBody, 403);
  await call(
    trainer,
    '/professional/sessions/' + second.id + '/certificates',
    { learnerId: learner.id, assessmentRevision: 2 },
    403
  );
  await pool.query('UPDATE public.users SET email_verified_at=NULL WHERE id=$1', [trainer.id]);
  await assert.rejects(validProfessionalScope(pool, scope.id, 'deliver'), /Current approved/);
  await pool.query('UPDATE public.users SET email_verified_at=now() WHERE id=$1', [trainer.id]);
  await pool.query(
    "UPDATE public.provider_professional_scopes SET revision=revision+1,valid_from=now()-interval '2 days',valid_until=now()-interval '1 day' WHERE id=$1",
    [scope.id]
  );
  await assert.rejects(validProfessionalScope(pool, scope.id, 'deliver'), /Current approved/);
  await pool.query('UPDATE public.workshop_progress SET session_id=NULL WHERE id=$1', [pid]);
  assert.equal(
    (
      await pool.query('SELECT provider_session_id FROM public.workshop_progress WHERE id=$1', [
        pid,
      ])
    ).rows[0].provider_session_id,
    session.id
  );
  pass(
    'delivery alone cannot assess or issue; expiry, identity checks and retained progress provenance prevent bypasses; self-study remains valid'
  );
  const verified = await verifyProfessionalAudit(pool, application.id);
  assert(verified.entries.length > 5);
  console.log(`PASS: ${count} professional-authority integration scenarios`);
} finally {
  await pool.end();
  await closeDbPool();
}
