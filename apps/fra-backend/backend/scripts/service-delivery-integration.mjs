// Destructive fixtures are restricted to a disposable loopback database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.DELIVERY_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
    url.pathname.includes('professional'),
  'Disposable professional loopback database required'
);
process.env.NODE_ENV = 'test';
const { default: deliveries } = await import('../src/routes/service-delivery.ts');
const { default: routes } = await import('../src/routes/professional-scopes.ts');
const { default: fullApp } = await import('../src/index.ts');
const { default: providers } = await import('../src/routes/provider-applications.ts');
const { jwtSecret } = await import('../src/helpers.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: url.href });
const app = new Hono()
  .route('/deliveries', deliveries)
  .route('/professional', routes)
  .route('/providers', providers);
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
    customer = await actor(),
    other = await actor('admin'),
    learner = await actor('participant', customer.org),
    foreignLearner = await actor('participant');
  process.env.PROVIDER_REVIEW_ORGANISATION_ID = reviewer.org;
  const application = await call(
    provider,
    '/providers/me',
    {
      companyName: 'Delivery Trainer',
      serviceInterest: 'both',
      trainingExperience: 'Demonstration of reviewed training delivery',
    },
    201
  );
  const agreementId = await agreement(provider, reviewer.org);
  await call(reviewer, '/providers/' + application.id + '/review', {
    revision: 0,
    status: 'approved',
    reason: 'Independent provider checks complete',
    qualificationEvidence: 'Qualification and delivery demonstration checked',
    agreementDocumentId: agreementId,
  });
  const scope = await call(
    provider,
    '/professional/me/scopes',
    {
      subjectId: 'fraud-risk-awareness',
      subjectVersion: '2026-10-30',
      revision: 0,
      actions: ['deliver', 'assess', 'issue_completion'],
      evidence: 'Original qualifications and demonstration reviewed',
    },
    201
  );
  const grant = await call(reviewer, '/professional/scopes/' + scope.id + '/review', {
    revision: 1,
    status: 'approved',
    actions: ['deliver', 'assess', 'issue_completion'],
    validFrom: new Date(Date.now() - 60000).toISOString(),
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    reason: 'Reviewed current course teaching scope',
    qualificationCheck: 'Original qualification checked',
    demonstrationCheck: 'Demonstration recording reviewed',
    checksConfirmed: true,
  });
  const assignment = await call(reviewer, '/providers/' + application.id + '/assignments', {
    packageId: 'pkg_full',
    service: 'training',
    scopeId: scope.id,
    reference: randomUUID(),
  });
  await call(provider, '/providers/me/assignments/' + assignment.id + '/decision', {
    status: 'accepted',
  });
  const session = await call(
    provider,
    '/professional/sessions',
    {
      scopeId: scope.id,
      scopeRevision: grant.revision,
      assignmentId: assignment.id,
      title: 'Customer-bound class',
    },
    201
  );
  await progress(learner, session.id);
  await progress(foreignLearner, session.id);
  const create = {
    applicationId: application.id,
    assignmentId: assignment.id,
    sessionId: session.id,
    customerUserId: customer.id,
    customerOrganisationId: customer.org,
    title: 'Customer training service',
    startsAt: '2026-11-21T10:00:00Z',
    endsAt: '2026-11-21T12:00:00Z',
    reason: 'Training delivery assigned for this customer',
  };
  await call(provider, '/deliveries/records', create, 403);
  await call(other, '/deliveries/records', create, 403);
  await call(
    reviewer,
    '/deliveries/records',
    { ...create, customerUserId: provider.id, customerOrganisationId: provider.org },
    403
  );
  const delivery = await call(reviewer, '/deliveries/records', create, 201);
  const id = delivery.id;
  const options = await call(
    reviewer,
    '/deliveries/options?applicationId=' +
      application.id +
      '&customerOrganisationId=' +
      customer.org
  );
  assert(options.sessions.some((s) => s.sessionId === session.id));
  assert(options.contacts.some((u) => u.id === customer.id));
  await call(other, '/deliveries/' + id, undefined, 403);
  await call(foreignLearner, '/deliveries/' + id, undefined, 403);
  const initial = await call(customer, '/deliveries/' + id);
  assert.equal(initial.attendance.length, 0);
  assert.equal(initial.learners.length, 1);
  assert.equal(initial.learners[0].id, learner.id);
  assert.equal(initial.learners[0].completedAt !== null, true);
  assert(!('actor_id' in initial.delivery));
  assert.equal((await call(other, '/deliveries/records')).length, 0);
  assert.equal((await call(customer, '/deliveries/records')).length, 1);
  const cancelled = await call(
    reviewer,
    '/deliveries/records',
    { ...create, title: 'Cancelled planned service' },
    201
  );
  await call(
    provider,
    '/deliveries/' + cancelled.id + '/action',
    { revision: 1, action: 'cancel', reason: 'Provider cannot cancel operator planning' },
    403
  );
  await call(reviewer, '/deliveries/' + cancelled.id + '/action', {
    revision: 1,
    action: 'cancel',
    reason: 'Customer planning changed before delivery',
  });
  await call(
    reviewer,
    '/deliveries/' + cancelled.id + '/action',
    { revision: 2, action: 'resolve_rework', reason: 'Cancellation is a terminal retained record' },
    409
  );
  pass(
    'current operator binds the accepted class to an independent customer; enrolment/completion is distinct from attendance and other tenants remain private'
  );
  const close = () =>
    call(
      reviewer,
      '/providers/' + application.id + '/assignments/' + assignment.id + '/close',
      { status: 'completed', reason: 'Attempt scoped service closure' },
      409
    );
  await close();
  const attend = {
    revision: 1,
    learnerId: learner.id,
    status: 'present',
    reason: 'Trainer checked attendance during the session',
  };
  await call(customer, '/deliveries/' + id + '/attendance', attend, 403);
  await call(
    provider,
    '/deliveries/' + id + '/attendance',
    { ...attend, learnerId: foreignLearner.id },
    403
  );
  await call(
    provider,
    '/deliveries/' + id + '/action',
    {
      revision: 1,
      action: 'submit',
      reason: 'Service delivered for customer review',
      evidenceSummary: 'Completed service and delivered training evidence',
    },
    409
  );
  await call(provider, '/deliveries/' + id + '/attendance', attend, 201);
  await call(provider, '/deliveries/' + id + '/attendance', attend, 409);
  async function upload(
    a,
    revision,
    bytes = Buffer.from('%PDF-1.7\nsynthetic retained evidence\n%%EOF'),
    expected = 201
  ) {
    const form = new FormData();
    form.set('revision', String(revision));
    form.set('file', new File([bytes], 'evidence.pdf', { type: 'application/pdf' }));
    const response = await (expected === 201 ? fullApp : app).request(
      (expected === 201
        ? 'http://localhost/api/v1/service-delivery/'
        : 'http://localhost/deliveries/') +
        id +
        '/files',
      {
        method: 'POST',
        headers: { authorization: 'Bearer ' + a.token },
        body: form,
      }
    );
    const body = await response.json();
    assert.equal(response.status, expected, JSON.stringify(body));
    return body.data;
  }
  await upload(customer, 2, undefined, 403);
  await upload(provider, 2, Buffer.from('<svg>bad</svg>'), 400);
  await upload(provider, 2, Buffer.alloc(524289), 400);
  const file = await upload(provider, 2);
  assert.match(file.sha256, /^[a-f0-9]{64}$/);
  const downloaded = await app.request('http://localhost/deliveries/' + id + '/files/' + file.id, {
    headers: { authorization: 'Bearer ' + customer.token },
  });
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await downloaded.text(), /%PDF/);
  const forbidden = await app.request('http://localhost/deliveries/' + id + '/files/' + file.id, {
    headers: { authorization: 'Bearer ' + other.token },
  });
  assert.equal(forbidden.status, 403);
  const submitted = await call(
    provider,
    '/deliveries/' + id + '/action',
    {
      revision: 3,
      action: 'submit',
      reason: 'Training delivered; evidence ready for review',
      evidenceSummary: 'Reviewed course delivery with retained attendance and document',
    },
    200
  );
  assert.equal(submitted.status, 'submitted');
  const frozen = await call(customer, '/deliveries/' + id);
  assert(
    frozen.delivery.submission_manifest.files.some(
      (f) => f.id === file.id && f.sha256 === file.sha256
    )
  );
  assert(
    frozen.delivery.submission_manifest.attendance.some(
      (a) => a.learner_id === learner.id && a.status === 'present'
    )
  );

  await call(provider, '/deliveries/' + id + '/attendance', { ...attend, revision: 4 }, 409);
  await upload(provider, 4, undefined, 409);
  await call(
    provider,
    '/deliveries/' + id + '/action',
    { revision: 4, action: 'accept', reason: 'Provider cannot approve their own service' },
    403
  );
  await call(
    reviewer,
    '/deliveries/' + id + '/action',
    { revision: 4, action: 'accept', reason: 'Operator cannot replace customer acceptance' },
    403
  );
  pass(
    'explicit attendance and bounded retained evidence are required; files are scoped and immutable; submitted evidence freezes and provider/operator cannot impersonate customer acceptance'
  );
  await call(customer, '/deliveries/' + id + '/action', {
    revision: 4,
    action: 'refuse',
    reason: 'Further customer evidence and explanations required',
  });
  await close();
  await call(provider, '/deliveries/' + id + '/action', {
    revision: 5,
    action: 'reopen',
    reason: 'Reopening for additional work and proof',
  });
  await call(
    provider,
    '/deliveries/' + id + '/attendance',
    { ...attend, revision: 6, status: 'excused' },
    201
  );
  await call(
    provider,
    '/deliveries/' + id + '/action',
    {
      revision: 7,
      action: 'submit',
      reason: 'No present attendance remains in latest records',
      evidenceSummary: 'Second proposed delivery evidence and completion summary',
    },
    409
  );
  await call(
    provider,
    '/deliveries/' + id + '/attendance',
    { ...attend, revision: 7, status: 'present' },
    201
  );
  await call(provider, '/deliveries/' + id + '/action', {
    revision: 8,
    action: 'submit',
    reason: 'Rework and supporting evidence completed',
    evidenceSummary: 'Second submitted delivery with the latest correct attendance',
  });
  const action = { revision: 9, reason: 'Customer reviewed the exact submitted evidence' };
  const decisions = await Promise.all(
    ['accept', 'refuse'].map(async (a) => {
      const r = await app.request('http://localhost/deliveries/' + id + '/action', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + customer.token, 'content-type': 'application/json' },
        body: JSON.stringify({ ...action, action: a }),
      });
      return r.status;
    })
  );
  assert.deepEqual(decisions.sort(), [200, 409]);
  let current = (await call(customer, '/deliveries/' + id)).delivery;
  if (current.status === 'refused') {
    await call(provider, '/deliveries/' + id + '/action', {
      revision: current.revision,
      action: 'reopen',
      reason: 'Customer requested one final evidence review',
    });
    current = (await call(provider, '/deliveries/' + id)).delivery;
    await call(provider, '/deliveries/' + id + '/action', {
      revision: current.revision,
      action: 'submit',
      reason: 'Latest service evidence presented to customer',
      evidenceSummary: 'Revised evidence with retained proof and current attendance',
    });
    current = (await call(customer, '/deliveries/' + id)).delivery;
    await call(customer, '/deliveries/' + id + '/action', {
      revision: current.revision,
      action: 'accept',
      reason: 'Customer accepts the revised service evidence',
    });
  }
  current = (await call(customer, '/deliveries/' + id)).delivery;
  assert.equal(current.status, 'accepted');
  const counts = async () =>
    (
      await pool.query(
        'SELECT (SELECT count(*) FROM provider_commission_entries) AS ledger,(SELECT count(*) FROM provider_payouts) AS payouts,(SELECT count(*) FROM purchases) AS purchases'
      )
    ).rows[0];
  const before = await counts();
  await call(customer, '/deliveries/' + id + '/action', {
    revision: current.revision,
    action: 'dispute',
    reason: 'Customer raised a subsequent service quality dispute',
  });
  await close();
  current = (await call(customer, '/deliveries/' + id)).delivery;
  await call(
    provider,
    '/deliveries/' + id + '/action',
    {
      revision: current.revision,
      action: 'resolve_rework',
      reason: 'Provider cannot resolve its own dispute',
    },
    403
  );
  await call(
    provider,
    '/professional/sessions/' + session.id + '/assessments',
    {
      learnerId: learner.id,
      revision: 0,
      decision: 'approved',
      reason: 'Verified actual learner completion separately from service dispute',
    },
    201
  );
  const certificate = await call(
    provider,
    '/professional/sessions/' + session.id + '/certificates',
    { learnerId: learner.id, assessmentRevision: 1 }
  );
  assert.equal(certificate.created, true);
  await call(reviewer, '/deliveries/' + id + '/action', {
    revision: current.revision,
    action: 'resolve_rework',
    reason: 'Independent review requires additional delivery work',
  });
  current = (await call(provider, '/deliveries/' + id)).delivery;
  await call(provider, '/deliveries/' + id + '/action', {
    revision: current.revision,
    action: 'submit',
    reason: 'Disputed work corrected with retained proof',
    evidenceSummary: 'Corrected service completion after operator rework review',
  });
  current = (await call(customer, '/deliveries/' + id)).delivery;
  await call(customer, '/deliveries/' + id + '/action', {
    revision: current.revision,
    action: 'accept',
    reason: 'Customer independently confirms reworked service',
  });
  assert.deepEqual(await counts(), before);
  await call(
    reviewer,
    '/providers/' + application.id + '/assignments/' + assignment.id + '/close',
    { status: 'completed', reason: 'Customer-accepted delivery confirmed by operator' }
  );
  pass(
    'refusal/rework and optimistic customer decisions preserve versions; service disputes block scoped closure and independent resolution does not create financial transactions'
  );
  const history = await call(reviewer, '/deliveries/' + id + '/history');
  assert(history.verified);
  assert(history.events.some((e) => e.snapshot.status === 'refused'));
  assert(history.events.some((e) => e.snapshot.status === 'disputed'));
  const publicHistory = await call(customer, '/deliveries/' + id + '/history');
  assert(!publicHistory.events.some((e) => 'canonical' in e));
  assert(!JSON.stringify(publicHistory).includes(reviewer.id));
  await assert.rejects(
    pool.query('DELETE FROM public.service_delivery_files WHERE id=$1', [file.id]),
    /Retained/
  );
  await assert.rejects(
    pool.query("UPDATE public.service_attendance SET status='absent' WHERE delivery_id=$1", [id]),
    /Retained/
  );
  await assert.rejects(
    pool.query('DELETE FROM public.service_delivery_events WHERE delivery_id=$1', [id]),
    /Retained/
  );
  // Inject audit failure and prove customer dispute cannot partially persist.
  current = (await call(customer, '/deliveries/' + id)).delivery;
  await pool.query(
    `CREATE FUNCTION public.delivery_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.delivery_id='${id}' THEN RAISE EXCEPTION 'injected delivery audit failure'; END IF; RETURN NEW; END $$`
  );
  await pool.query(
    'CREATE TRIGGER delivery_test_fail BEFORE INSERT ON public.service_delivery_events FOR EACH ROW EXECUTE FUNCTION public.delivery_test_fail()'
  );
  try {
    await call(
      customer,
      '/deliveries/' + id + '/action',
      {
        revision: current.revision,
        action: 'dispute',
        reason: 'Testing atomic customer dispute recording',
      },
      500
    );
    assert.equal((await call(customer, '/deliveries/' + id)).delivery.status, 'accepted');
  } finally {
    await pool.query('DROP TRIGGER delivery_test_fail ON public.service_delivery_events');
    await pool.query('DROP FUNCTION public.delivery_test_fail()');
  }
  pass(
    'evidence, attendance revisions and verified audit history remain retained; reviewer identifiers are redacted; audit failure rolls back service decisions'
  );
  console.log(`PASS: ${count} service delivery integration scenarios`);
} finally {
  await pool.end();
  await closeDbPool();
}
