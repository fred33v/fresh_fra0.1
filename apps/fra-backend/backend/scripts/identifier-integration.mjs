// Destructive fixtures are restricted to a disposable loopback database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.IDENTIFIER_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
    url.pathname.includes('professional'),
  'Disposable professional loopback database required'
);
process.env.NODE_ENV = 'test';
const { default: identifiers } = await import('../src/routes/relationship-identifiers.ts');
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
  .route('/identifiers', identifiers)
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
try {
  const reviewer = await actor('admin'),
    provider = await actor(),
    outsider = await actor('admin'),
    employee = await actor('participant');
  process.env.PROVIDER_REVIEW_ORGANISATION_ID = reviewer.org;
  const application = await call(
    provider,
    '/providers/me',
    {
      companyName: 'Supplier Fixture',
      serviceInterest: 'both',
      trainingExperience: 'Demonstration verified for delivery',
    },
    201
  );
  const doc = await agreement(provider, reviewer.org);
  const approval = {
    revision: 0,
    status: 'approved',
    reason: 'Agreement and evidence verified',
    qualificationEvidence: 'Recorded qualification checks',
    agreementDocumentId: doc,
  };
  const approved = await call(reviewer, '/providers/' + application.id + '/review', approval);
  let refs = await call(provider, '/identifiers/me');
  assert.equal(refs.length, 2);
  let referral = refs.find((i) => i.kind === 'provider_code'),
    supplier = refs.find((i) => i.kind === 'supplier');
  assert.equal(referral.code, approved.providerCode);
  assert.match(supplier.code, /^SUP-[a-f0-9]{32}$/);
  assert(!refs.some((i) => i.kind === 'employee'));
  const { providerIdentifiersActive } = await import('../src/relationship-identifiers.ts');
  assert(await providerIdentifiersActive(pool, application.id));
  await call(outsider, '/identifiers/review?applicationId=' + application.id, undefined, 403);
  await call(
    provider,
    '/identifiers/' + referral.id + '/status',
    { revision: 1, status: 'suspended', reason: 'Candidate tries to suspend own reference' },
    403
  );
  pass(
    'approval issues distinct supplier and preserved provider references, never employee status; operator isolation holds'
  );
  const scope = await call(
    provider,
    '/professional/me/scopes',
    {
      subjectId: 'fraud-risk-awareness',
      subjectVersion: '2026-10-30',
      revision: 0,
      actions: ['deliver'],
      evidence: 'Qualifications and demonstration evidence supplied',
    },
    201
  );
  const grant = await call(reviewer, '/professional/scopes/' + scope.id + '/review', {
    revision: 1,
    status: 'approved',
    actions: ['deliver'],
    reason: 'Verified course delivery scope',
    qualificationCheck: 'Original qualifications reviewed',
    demonstrationCheck: 'Recorded demonstration reviewed',
    checksConfirmed: true,
    validFrom: new Date(Date.now() - 60000).toISOString(),
    validUntil: new Date(Date.now() + 86400000).toISOString(),
  });
  const offer = await call(reviewer, '/providers/' + application.id + '/assignments', {
    packageId: 'pkg_full',
    service: 'training',
    scopeId: scope.id,
    reference: randomUUID(),
  });
  await call(provider, '/providers/me/assignments/' + offer.id + '/decision', {
    status: 'accepted',
  });
  const session = await call(
    provider,
    '/professional/sessions',
    {
      scopeId: scope.id,
      scopeRevision: grant.revision,
      assignmentId: offer.id,
      title: 'Identifier authority class',
    },
    201
  );
  await call(provider, '/professional/sessions/' + session.id + '/participants');
  const oldCounts = (
    await pool.query(
      'SELECT (SELECT count(*) FROM provider_commission_entries)::int AS entries,(SELECT count(*) FROM provider_payouts)::int AS payouts'
    )
  ).rows[0];
  await call(reviewer, '/identifiers/' + referral.id + '/status', {
    revision: 1,
    status: 'suspended',
    reason: 'Manual sales reference suspension',
  });
  assert(!(await providerIdentifiersActive(pool, application.id)));
  await call(provider, '/professional/sessions/' + session.id + '/participants', undefined, 403);
  const { attributeProviderSale } = await import('../src/provider-commissions.ts');
  await assert.rejects(
    attributeProviderSale(pool, outsider.auth, randomUUID(), 'pkg_full', referral.code),
    /reference is unavailable/
  );

  await call(
    reviewer,
    '/providers/' + application.id + '/assignments',
    { packageId: 'pkg_full', service: 'sales', reference: randomUUID() },
    409
  );
  await call(
    reviewer,
    '/identifiers/' + referral.id + '/status',
    { revision: 1, status: 'active', reason: 'Stale reactivation request' },
    409
  );
  const race = await Promise.all(
    ['active', 'revoked'].map(async (status) => {
      const r = await app.request('http://localhost/identifiers/' + referral.id + '/status', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + reviewer.token, 'content-type': 'application/json' },
        body: JSON.stringify({
          revision: 2,
          status,
          reason: 'Concurrent controlled lifecycle decision',
        }),
      });
      return r.status;
    })
  );
  assert.deepEqual(race.sort(), [200, 409]);
  refs = await call(provider, '/identifiers/me');
  referral = refs.find((i) => i.kind === 'provider_code');
  if (referral.status !== 'revoked') {
    await call(reviewer, '/identifiers/' + referral.id + '/status', {
      revision: referral.revision,
      status: 'revoked',
      reason: 'Reference permanently withdrawn',
    });
  }
  await call(
    reviewer,
    '/identifiers/' + referral.id + '/status',
    {
      revision: referral.revision + 1,
      status: 'active',
      reason: 'Cannot revive a revoked reference',
    },
    409
  );
  // Reapproval cannot resurrect a permanently revoked code or a manually suspended supplier.
  await call(reviewer, '/identifiers/' + supplier.id + '/status', {
    revision: 1,
    status: 'suspended',
    reason: 'Manual supplier verification hold',
  });
  await call(reviewer, '/providers/' + application.id + '/review', {
    revision: 1,
    status: 'suspended',
    reason: 'Application suspended independently',
  });
  await call(reviewer, '/providers/' + application.id + '/review', { ...approval, revision: 2 });
  refs = await call(provider, '/identifiers/me');
  assert.equal(refs.find((i) => i.kind === 'provider_code').status, 'revoked');
  assert.equal(refs.find((i) => i.kind === 'supplier').status, 'suspended');
  const afterCounts = (
    await pool.query(
      'SELECT (SELECT count(*) FROM provider_commission_entries)::int AS entries,(SELECT count(*) FROM provider_payouts)::int AS payouts'
    )
  ).rows[0];
  assert.deepEqual(afterCounts, oldCounts);
  pass(
    'manual suspension, permanent revocation and optimistic concurrency work without rewriting historical finance'
  );
  const employeeDoc = await agreement(employee, reviewer.org);
  const body = {
    userId: employee.id,
    organisationId: employee.org,
    agreementDocumentId: employeeDoc,
    reason: 'Employment relationship independently verified',
    employmentVerified: true,
  };
  await call(reviewer, '/identifiers/employees', body, 400); // supplier agreement is not an employment agreement
  const employment = await agreement(employee, reviewer.org, {
    title: 'Employment agreement fixed-term fixture',
  });
  const emp = await call(
    reviewer,
    '/identifiers/employees',
    { ...body, agreementDocumentId: employment },
    201
  );
  assert.match(emp.code, /^EMP-[a-f0-9]{32}$/);
  await call(reviewer, '/identifiers/employees', { ...body, agreementDocumentId: employment }, 409);
  await call(
    reviewer,
    '/identifiers/employees',
    { ...body, userId: reviewer.id, organisationId: reviewer.org, agreementDocumentId: employment },
    403
  );
  await call(reviewer, '/identifiers/' + emp.id + '/status', {
    revision: 1,
    status: 'suspended',
    reason: 'Employment access reference suspended',
  });
  await call(reviewer, '/identifiers/' + emp.id + '/status', {
    revision: 2,
    status: 'active',
    reason: 'Employment record independently rechecked',
  });
  const history = await call(reviewer, '/identifiers/' + emp.id + '/events');
  assert.equal(history.events.length, 3);
  assert.equal(history.events[2].snapshot.actor_id, reviewer.id);
  await assert.rejects(
    pool.query(
      "UPDATE public.relationship_identifier_events SET hash='modified' WHERE identifier_id=$1",
      [emp.id]
    ),
    /Retained/
  );
  await assert.rejects(
    pool.query('DELETE FROM public.relationship_identifiers WHERE id=$1', [emp.id]),
    /Retained/
  );
  await assert.rejects(
    pool.query(
      "UPDATE public.relationship_identifiers SET code='EMP-'||repeat('a',32),revision=revision+1,status='suspended',suspension_source='manual' WHERE id=$1",
      [emp.id]
    ),
    /immutable/
  );
  pass(
    'employee issuance requires the verified signed employment dossier; events are hash-verified and retained'
  );
  // A trigger failure must roll back both lifecycle status and event append.
  await pool.query(
    `CREATE FUNCTION public.identifier_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.identifier_id='${emp.id}' THEN RAISE EXCEPTION 'injected identifier audit failure'; END IF; RETURN NEW; END $$`
  );
  await pool.query(
    'CREATE TRIGGER identifier_test_failure BEFORE INSERT ON public.relationship_identifier_events FOR EACH ROW EXECUTE FUNCTION public.identifier_test_failure()'
  );
  try {
    await call(
      reviewer,
      '/identifiers/' + emp.id + '/status',
      { revision: 3, status: 'suspended', reason: 'Injected transactional rollback verification' },
      500
    );
    assert.equal(
      (
        await pool.query('SELECT status,revision FROM relationship_identifiers WHERE id=$1', [
          emp.id,
        ])
      ).rows[0].revision,
      3
    );
  } finally {
    await pool.query(
      'DROP TRIGGER identifier_test_failure ON public.relationship_identifier_events'
    );
    await pool.query('DROP FUNCTION public.identifier_test_failure()');
  }
  await call(reviewer, '/identifiers/' + referral.id + '/events');
  await call(reviewer, '/identifiers/' + supplier.id + '/events');
  pass('audit failure rolls back the decision; provider and supplier histories verify');
  console.log(`PASS: ${count} identifier lifecycle integration scenarios`);
} finally {
  await pool.end();
  await closeDbPool();
}
