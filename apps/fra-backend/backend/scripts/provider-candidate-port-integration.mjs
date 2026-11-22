import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.PROVIDER_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['127.0.0.1', 'localhost'].includes(url.hostname),
  'Disposable loopback database required'
);
process.env.NODE_ENV = 'test';
const { default: routes } = await import('../src/routes/provider-applications.ts');
const { jwtSecret } = await import('../src/helpers.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: url.href }),
  app = new Hono().route('/providers', routes);
async function actor(role = 'employer', org = randomUUID()) {
  const a = { id: randomUUID(), org, email: `${randomUUID()}@example.test`, role };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      "INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,'Candidate Fixture','unused',$3,$4,now())",
      [a.id, a.email, role, org]
    );
    await db.query(
      "INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Fixture',$2) ON CONFLICT(id) DO NOTHING",
      [org, a.id]
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  a.token = jwt.sign({ sub: a.id, email: a.email, role, organisationId: org }, jwtSecret);
  return a;
}
async function request(a, path, body, status = 200) {
  const r = await app.request(`http://localhost/providers${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(r.status, status, await r.clone().text());
  return r;
}
const json = async (r) => (await r.json()).data;
const candidateProfile = {
  fullName: 'Alex Morgan',
  businessName: 'Example Ltd',
  country: 'GB',
  kind: 'both',
  website: 'https://example.test',
  expertise: ['training'],
  experience: 'Independent training delivery by agreement with each customer.',
  engagement: {
    model: 'independent_no_minimum',
    formVersion: 'independent-engagement-2026-11-v1',
    legalStructure: 'limited_company',
    companyNumber: '12345678',
    businessAddress: {
      line1: '10 Example Road',
      line2: '',
      city: 'London',
      postalCode: 'SW1A 1AA',
    },
    vatRegistered: 'no',
    vatNumber: '',
    availability: 'Weekdays by agreement only.',
    declineAssignments: 'not_sure',
    deliveryControl: 'shared',
    otherClients: 'not_sure',
    personalService: 'substitution_by_agreement',
    declarationName: 'Alex Morgan',
    noMinimumAccepted: true,
    commissionAccepted: true,
    informationAccurate: true,
  },
};
const value = {
  companyName: 'Example Ltd',
  serviceInterest: 'both',
  trainingExperience: 'Training demonstration to be reviewed.',
  candidateProfile,
};
async function financialFingerprint() {
  const out = {};
  for (const table of [
    'provider_sale_attributions',
    'provider_commission_entries',
    'provider_payouts',
    'provider_assignments',
  ])
    out[table] = (
      await pool.query(
        `SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) AS hash,count(*)::int AS n FROM public.${table} t`
      )
    ).rows[0];
  return out;
}
let failure;
try {
  const before = await financialFingerprint();
  const user = await actor(),
    other = await actor(),
    reviewer = await actor('admin');
  process.env.PROVIDER_REVIEW_ORGANISATION_ID = reviewer.org;
  const initial = await json(await request(user, '/me', value, 201));
  assert.equal(initial.revision, 0);
  assert.deepEqual(initial.candidateProfile, candidateProfile);
  assert.equal((await json(await request(user, '/me/revisions'))).length, 1);
  await request(other, `/${initial.id}/dossier`, undefined, 403);
  const revisionBody = {
    ...value,
    revision: 0,
    companyName: 'Revised Ltd',
    candidateProfile: { ...candidateProfile, businessName: 'Revised Ltd' },
  };
  await request(user, '/me/amend', { ...revisionBody, candidateProfile: undefined }, 400);
  await request(
    user,
    '/me/amend',
    {
      ...revisionBody,
      candidateProfile: {
        ...revisionBody.candidateProfile,
        engagement: { ...candidateProfile.engagement, informationAccurate: false },
      },
    },
    400
  );
  const results = await Promise.all([
    request(user, '/me/amend', revisionBody, 200)
      .then(() => 200)
      .catch((e) => e),
    app.request('http://localhost/providers/me/amend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify(revisionBody),
    }),
  ]);
  // Either concurrent request may win; independently check one success/one conflict without assuming scheduler order.
  const stored = await json(await request(user, '/me'));
  assert.equal(stored.revision, 1);
  assert.equal(stored.companyName, 'Revised Ltd');
  const second = results[1];
  if (results[0] === 200) assert.equal(second.status, 409);
  else assert.equal(second.status, 200);
  await request(user, '/me/amend', revisionBody, 409);
  const revisions = await json(await request(user, '/me/revisions'));
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].companyName, 'Example Ltd');
  assert.equal(revisions[1].companyName, 'Revised Ltd');
  console.log(
    'PASS independent declarations, conditional validation, revision conflict and retained amendments'
  );
  await request(reviewer, `/${initial.id}/review`, {
    revision: 1,
    status: 'declined',
    reason: 'Please revise your proposed availability.',
  });
  const amended = await json(await request(user, '/me/amend', { ...revisionBody, revision: 2 }));
  assert.equal(amended.status, 'submitted');
  assert.equal(amended.revision, 3);
  const dossier = await request(user, '/me/dossier');
  const text = await dossier.text();
  assert(text.includes('NOT A CONTRACT'));
  assert(text.includes('Example Ltd'));
  assert(text.includes('Revised Ltd'));
  assert(!text.includes(reviewer.id));
  assert.equal(dossier.headers.get('cache-control'), 'no-store');
  assert(
    (await (await request(reviewer, `/${initial.id}/dossier`)).text()).includes('NOT A CONTRACT')
  );
  assert(!JSON.stringify(await json(await request(user, '/me/revisions'))).includes(reviewer.id));
  console.log(
    'PASS declined resubmission requires renewed declarations; dossier keeps versions without leaking internal reviewer IDs'
  );
  // Failure during snapshot append must roll back the application update and existing audit.
  failure = `candidate_fail_${randomUUID().replaceAll('-', '')}`;
  await pool.query(
    `CREATE FUNCTION ${failure}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected snapshot failure'; END $$`
  );
  await pool.query(
    `CREATE TRIGGER ${failure} BEFORE INSERT ON public.provider_application_revisions FOR EACH ROW EXECUTE FUNCTION ${failure}()`
  );
  await request(user, '/me/amend', { ...revisionBody, revision: 3 }, 500);
  assert.equal((await json(await request(user, '/me'))).revision, 3);
  await pool.query(`DROP TRIGGER ${failure} ON public.provider_application_revisions`);
  await pool.query(`DROP FUNCTION ${failure}()`);
  failure = undefined;
  await assert.rejects(
    pool.query('DELETE FROM public.provider_application_revisions WHERE application_id=$1', [
      initial.id,
    ])
  );
  // Preserve #86 approval binding and qualification rules: this is not a substitute agreement.
  await request(
    reviewer,
    `/${initial.id}/review`,
    {
      revision: 3,
      status: 'approved',
      reason: 'Attempt without the required completed agreement.',
      qualificationEvidence: 'Fixture demonstration checked.',
    },
    400
  );
  await pool.query("UPDATE public.users SET role='employee' WHERE id=$1", [reviewer.id]);
  await request(reviewer, `/${initial.id}/dossier`, undefined, 403);
  assert.deepEqual(await financialFingerprint(), before);
  console.log(
    'PASS rollback, retained snapshots, original agreement/authority gates and byte-stable accounting data'
  );
  console.log(
    'PASS 3 candidate-port integration scenarios; no financial state or signing policy changed'
  );
} finally {
  if (failure) {
    await pool.query(`DROP TRIGGER IF EXISTS ${failure} ON public.provider_application_revisions`);
    await pool.query(`DROP FUNCTION IF EXISTS ${failure}()`);
  }
  await pool.end();
  await closeDbPool();
}
