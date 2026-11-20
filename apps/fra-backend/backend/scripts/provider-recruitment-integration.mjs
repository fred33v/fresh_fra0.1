#!/usr/bin/env node
// Only a disposable local database. Never contacts Stripe, SMTP, AWS or production.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const connection = process.env.DATABASE_URL;
if (
  process.env.PROVIDER_TEST_DATABASE !== '1' ||
  process.env.NODE_ENV === 'production' ||
  !connection
)
  throw new Error('Requires PROVIDER_TEST_DATABASE=1 and disposable PostgreSQL');
const target = new URL(connection);
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
    target.pathname === '/provider_recruitment_test' &&
    !target.search,
  'Use the isolated loopback provider_recruitment_test database'
);
process.env.NODE_ENV = 'test';
process.env.PROVIDERS_ENABLED = 'true';
process.env.SMTP_HOST = '';
process.env.WEBHOOK_WORKER_ENABLED = 'false';
process.env.RETENTION_ENABLED = 'false';
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';
process.env.RATE_LIMIT_MAX = '10000';
const { default: app } = await import('../src/index.ts');
const { default: providerRoutes } = await import('../src/providers/routes.ts');
const { Hono } = await import('hono');
const { issueTokens } = await import('../src/auth-utils.ts');
const { closeDbPool } = await import('../src/db.ts');
const { RETENTION_RULES } = await import('../src/retention.ts');
const pool = new pg.Pool({ connectionString: connection });
let cases = 0;
const pass = (name) => {
  cases++;
  console.log('PASS ' + name);
};
async function actor(role = 'employer', verified = true) {
  const user = {
    id: randomUUID(),
    email: `provider-${randomUUID()}@example.test`,
    name: 'Provider fixture',
    role,
    organisationId: randomUUID(),
  };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      'INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        user.id,
        user.email,
        user.name,
        'not-a-real-password',
        role,
        user.organisationId,
        verified ? new Date() : null,
      ]
    );
    await db.query(
      "INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Provider fixture',$2)",
      [user.organisationId, user.id]
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  return { ...user, token: issueTokens(user).accessToken };
}
async function call(method, path, body, user) {
  const response = await app.request('http://localhost/api/v1/providers' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get('cache-control'),
  };
}
const engagement = {
  model: 'independent_no_minimum',
  formVersion: 'independent-engagement-2026-11-v1',
  legalStructure: 'sole_trader',
  companyNumber: '',
  businessAddress: {
    line1: '10 Example Street',
    line2: '',
    city: 'London',
    postalCode: 'SW1A 1AA',
  },
  vatRegistered: 'no',
  vatNumber: '',
  availability: 'Available for independently agreed assignments on weekdays.',
  declineAssignments: 'yes',
  deliveryControl: 'self',
  otherClients: 'yes',
  personalService: 'substitution_by_agreement',
  declarationName: 'Alex Morgan',
  noMinimumAccepted: true,
  commissionAccepted: true,
  informationAccurate: true,
};
const profile = {
  fullName: 'Alex Morgan',
  engagement,
  businessName: 'Example Prevention Ltd',
  country: 'GB',
  kind: 'both',
  website: 'https://example.test',
  expertise: ['fraud_prevention', 'training'],
  experience:
    'We support small organisations with fraud prevention, training and appropriate package referrals.',
};
const submission = (version = 0, patch = {}) => ({
  version,
  profile: { ...profile, ...patch },
  acknowledged: true,
});
const applicant = await actor(),
  other = await actor(),
  reviewer = await actor('admin'),
  secondReviewer = await actor('admin'),
  orgAdmin = await actor('admin'),
  unverified = await actor('employee', false);
process.env.PROVIDER_REVIEWER_IDS = `${reviewer.id},${secondReviewer.id}`;
const review = (
  id,
  version,
  status,
  message = 'Reviewed the supplied application information.',
  by = reviewer
) =>
  call(
    'POST',
    `/admin/applications/${id}/review`,
    { version, status, message, engagementReviewed: status === 'approved' },
    by
  );
let failureName;
try {
  process.env.PROVIDERS_ENABLED = 'false';
  assert.equal((await call('GET', '/me', undefined, applicant)).status, 503);
  process.env.PROVIDERS_ENABLED = 'true';
  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('GET', '/me', undefined, unverified)).status, 403);
  const keyApp = new Hono();
  keyApp.use('*', async (c, next) => {
    c.set('apiKeyAuth', {
      userId: applicant.id,
      organisationId: applicant.organisationId,
      role: 'employer',
      email: applicant.email,
    });
    return next();
  });
  keyApp.route('/providers', providerRoutes);
  assert.equal((await keyApp.request('http://localhost/providers/me')).status, 403);
  assert.equal(
    (
      await call(
        'POST',
        '/me',
        { ...submission(), status: 'approved', commissionBasisPoints: 9999 },
        applicant
      )
    ).status,
    400
  );
  assert.equal(
    (await call('POST', '/me', { ...submission(), acknowledged: false }, applicant)).status,
    400
  );
  assert.equal(
    (await call('POST', '/me', submission(0, { website: 'not-a-url' }), applicant)).status,
    400
  );
  pass('feature, verified-account, API-key and server-owned policy gates');
  let response = await call('POST', '/me', submission(), applicant);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  let application = response.body.data.application;
  assert.equal(application.contactEmail, applicant.email);
  assert.equal(application.commissionBasisPoints, 1700);
  assert.equal(application.payoutsActive, false);
  assert.equal(application.history.length, 1);
  assert.equal(response.cache, 'no-store');
  assert.equal((await call('GET', '/me', undefined, other)).body.data.application, null);
  assert.equal((await call('GET', '/admin/applications', undefined, applicant)).status, 403);
  assert.equal((await call('GET', '/admin/applications', undefined, orgAdmin)).status, 403);
  const queue = await call('GET', '/admin/applications?status=submitted', undefined, reviewer);
  assert.equal(queue.status, 200);
  assert(queue.body.data.applications.some((a) => a.id === application.id));
  assert.equal('history' in queue.body.data.applications[0], false);
  assert.equal(
    (await call('GET', '/admin/applications?offset=-1', undefined, reviewer)).status,
    400
  );
  pass('private applicant access, explicit programme-review appointments and paginated queue');
  response = await call(
    'POST',
    '/me',
    submission(application.version, { businessName: 'Revised Prevention Ltd' }),
    applicant
  );
  assert.equal(response.status, 200);
  application = response.body.data.application;
  assert.equal(application.version, 2);
  assert.equal(application.history[0].profile.businessName, profile.businessName);
  assert.equal(application.profile.businessName, 'Revised Prevention Ltd');
  assert.equal((await call('POST', '/me', submission(1), applicant)).status, 409);
  response = await review(application.id, application.version, 'under_review');
  assert.equal(response.status, 200);
  application = response.body.data.application;
  assert.equal((await call('POST', '/me', submission(application.version), applicant)).status, 409);
  const competing = await Promise.all([
    review(application.id, application.version, 'approved', 'First reviewer approval.'),
    review(
      application.id,
      application.version,
      'approved',
      'Second reviewer approval.',
      secondReviewer
    ),
  ]);
  assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
  application = competing.find((r) => r.status === 200).body.data.application;
  assert.equal(application.version, 4);
  assert.equal(application.history.length, 4);
  assert.equal(application.status, 'approved');
  assert.equal(application.payoutsActive, false);
  pass('retained revisions, review freeze and concurrent decisions without lost updates');
  response = await review(
    application.id,
    application.version,
    'suspended',
    'Suspended pending additional information.'
  );
  assert.equal(response.status, 200);
  application = response.body.data.application;
  response = await review(
    application.id,
    application.version,
    'approved',
    'Programme membership reinstated.'
  );
  assert.equal(response.status, 200);
  application = response.body.data.application;
  assert.equal(application.version, 6);
  assert.equal(application.payoutsActive, false);
  assert.equal(application.history[4].status, 'suspended');
  pass('suspension and reinstatement retain decisions and never activate payouts');
  const self = (await call('POST', '/me', submission(), reviewer)).body.data.application;
  assert.equal((await review(self.id, self.version, 'approved')).status, 403);
  assert.equal(
    (await call('GET', `/admin/applications/${self.id}`, undefined, reviewer)).body.data.canReview,
    false
  );
  assert.equal(
    (
      await review(
        self.id,
        self.version,
        'approved',
        'Another administrator reviewed this application.',
        secondReviewer
      )
    ).status,
    200
  );
  await pool.query("UPDATE public.users SET role='employer' WHERE id=$1", [reviewer.id]);
  assert.equal((await call('GET', '/admin/applications', undefined, reviewer)).status, 403);
  await pool.query("UPDATE public.users SET role='admin' WHERE id=$1", [reviewer.id]);
  process.env.PROVIDER_REVIEWER_IDS = secondReviewer.id;
  assert.equal((await call('GET', '/admin/applications', undefined, reviewer)).status, 403);
  process.env.PROVIDER_REVIEWER_IDS = `${reviewer.id},${secondReviewer.id}`;
  await pool.query('UPDATE public.users SET organisation_id=$2 WHERE id=$1', [
    applicant.id,
    other.organisationId,
  ]);
  assert.equal((await call('GET', '/me', undefined, applicant)).status, 403);
  const transferred = { ...applicant, organisationId: other.organisationId };
  transferred.token = issueTokens(transferred).accessToken;
  assert.equal((await call('GET', '/me', undefined, transferred)).status, 403);
  await pool.query('UPDATE public.users SET organisation_id=$2 WHERE id=$1', [
    applicant.id,
    applicant.organisationId,
  ]);
  pass(
    'no self-review, stale-role or removed appointment access, and no cross-organisation affiliation leak'
  );
  const correction = await actor();
  let corrected = (await call('POST', '/me', submission(), correction)).body.data.application;
  corrected = (
    await review(
      corrected.id,
      corrected.version,
      'rejected',
      'Please provide more details about your experience.'
    )
  ).body.data.application;
  response = await call(
    'POST',
    '/me',
    submission(corrected.version, {
      experience:
        'Updated experience with specific training and assessment projects supporting organisations.',
    }),
    correction
  );
  assert.equal(response.status, 200);
  corrected = response.body.data.application;
  assert.equal(corrected.status, 'submitted');
  assert.equal(corrected.reviewMessage, null);
  assert(corrected.history.some((h) => h.message?.includes('more details')));
  pass('requested changes can be resubmitted without erasing the previous application or review');
  const failed = await actor();
  failureName = `provider_test_${randomBytes(5).toString('hex')}`;
  await pool.query(
    `CREATE FUNCTION ${failureName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_id='${failed.id}'::uuid THEN RAISE EXCEPTION 'injected provider event failure'; END IF; RETURN NEW; END $$`
  );
  await pool.query(
    `CREATE TRIGGER ${failureName} BEFORE INSERT ON public.provider_application_events FOR EACH ROW EXECUTE FUNCTION ${failureName}()`
  );
  assert.equal((await call('POST', '/me', submission(), failed)).status, 500);
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int n FROM public.provider_applications WHERE user_id=$1',
        [failed.id]
      )
    ).rows[0].n,
    0
  );
  await pool.query(`DROP TRIGGER ${failureName} ON public.provider_application_events`);
  await pool.query(`DROP FUNCTION ${failureName}()`);
  failureName = undefined;
  const racer = await actor();
  const duplicate = await Promise.all([
    call('POST', '/me', submission(), racer),
    call('POST', '/me', submission(), racer),
  ]);
  assert.deepEqual(duplicate.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int n FROM public.provider_applications WHERE user_id=$1',
        [racer.id]
      )
    ).rows[0].n,
    1
  );
  pass('audit failures roll back submissions and racing creates yield one retained application');
  await assert.rejects(
    pool.query(
      "UPDATE public.provider_application_events SET event='changed' WHERE application_id=$1",
      [application.id]
    )
  );
  await assert.rejects(
    pool.query('DELETE FROM public.provider_applications WHERE id=$1', [application.id])
  );
  await assert.rejects(pool.query('TRUNCATE public.provider_application_events'));
  assert(!RETENTION_RULES.some((rule) => /provider/.test(rule.table)));
  const cascades = await pool.query(
    "SELECT conname FROM pg_constraint WHERE conrelid='public.provider_applications'::regclass AND contype='f'"
  );
  assert.equal(cascades.rowCount, 0);
  pass(
    'new application evidence is append-only, retained and independent of legacy purge cascades'
  );
  const legacy = await actor();
  const legacyProfile = { ...profile };
  delete legacyProfile.engagement;
  const legacyId = randomUUID();
  await pool.query(
    `INSERT INTO public.provider_applications(id,user_id,organisation_id,contact_email,profile,terms_version,acknowledged_at) VALUES($1,$2,$3,$4,$5,'provider-programme-2026-11',now())`,
    [legacyId, legacy.id, legacy.organisationId, legacy.email, legacyProfile]
  );
  await pool.query(
    `INSERT INTO public.provider_application_events(application_id,version,actor_id,actor_role,event,snapshot) SELECT id,version,user_id,'employer','application.submitted',to_jsonb(a) FROM public.provider_applications a WHERE id=$1`,
    [legacyId]
  );
  const beforeLegacy = await call('GET', '/me', undefined, legacy);
  assert.equal(beforeLegacy.body.data.application.independentEngagementComplete, false);
  assert.equal(beforeLegacy.body.data.application.history[0].profile.engagement, undefined);
  assert.equal((await review(legacyId, 1, 'approved')).status, 409);
  assert.equal(
    (
      await call(
        'POST',
        `/admin/applications/${legacyId}/review`,
        { version: 1, status: 'approved', message: 'Needs explicit review confirmation.' },
        reviewer
      )
    ).status,
    400
  );
  const revisedLegacy = await call('POST', '/me', submission(1), legacy);
  assert.equal(revisedLegacy.status, 200);
  assert.equal(revisedLegacy.body.data.application.independentEngagementComplete, true);
  assert.equal(revisedLegacy.body.data.application.history[0].profile.engagement, undefined);
  const approvedLegacy = await review(legacyId, 2, 'approved');
  assert.equal(approvedLegacy.status, 200);
  assert.equal(approvedLegacy.body.data.application.history.at(-1).engagementReviewed, true);
  assert.equal(approvedLegacy.body.data.application.payoutsActive, false);
  pass(
    'legacy records remain readable; independent candidate forms and reviewer confirmation gate new approvals'
  );

  if (process.env.PROVIDER_BROWSER_TEST === '1') {
    const web = new URL(process.env.PROVIDER_BROWSER_URL ?? 'http://127.0.0.1:8080');
    assert(
      web.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(web.hostname),
      'Browser tests require a loopback Web dashboard'
    );
    const { serve } = await import('@hono/node-server');
    const { chromium, expect } =
      await import('../../../fra-web-dashboard/node_modules/@playwright/test/index.mjs');
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
    const apiOrigin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox'],
    });
    try {
      const candidate = await actor('employee'),
        staff = await actor('admin');
      process.env.PROVIDER_REVIEWER_IDS += `,${staff.id}`;
      const errors = [];
      async function pageFor(user) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(
          (token) => localStorage.setItem('fra_access_token', token),
          user.token
        );
        // Forward only loopback API requests to the isolated real API. No responses are mocked.
        await page.route('**/api/v1/**', async (route) => {
          const requested = new URL(route.request().url());
          assert(['localhost', '127.0.0.1', '[::1]'].includes(requested.hostname));
          const response = await route.fetch({
            url: apiOrigin + requested.pathname + requested.search,
          });
          await route.fulfill({ response });
        });
        return page;
      }
      const candidatePage = await pageFor(candidate),
        staffPage = await pageFor(staff);
      const business = `Browser Partner ${randomBytes(4).toString('hex')}`;
      await candidatePage.goto(new URL('/partners', web).href);
      await candidatePage.getByLabel('Full name', { exact: true }).fill('Alex Morgan');
      await candidatePage.getByLabel('Business or professional name').fill(business);
      await candidatePage.getByLabel('Training', { exact: true }).check();
      await candidatePage
        .getByLabel('Experience and proposed contribution')
        .fill(profile.experience);
      await candidatePage.getByLabel('Business legal structure').selectOption('sole_trader');
      await candidatePage
        .getByLabel('Business correspondence address', { exact: true })
        .fill(engagement.businessAddress.line1);
      await candidatePage
        .getByLabel('Town / city', { exact: true })
        .fill(engagement.businessAddress.city);
      await candidatePage
        .getByLabel('Postcode / postal code', { exact: true })
        .fill(engagement.businessAddress.postalCode);
      await candidatePage.getByLabel('Are you VAT registered?').selectOption('no');
      await candidatePage
        .getByLabel('Availability and preferred working arrangements')
        .fill(engagement.availability);
      await candidatePage
        .getByLabel('Can you choose whether to accept a proposed assignment?')
        .selectOption('yes');
      await candidatePage
        .getByLabel('Who would normally decide how the agreed services are delivered?')
        .selectOption('self');
      await candidatePage
        .getByLabel('Do you currently provide services to other clients?')
        .selectOption('yes');
      await candidatePage
        .getByLabel('What personal-service arrangement is proposed?')
        .selectOption('substitution_by_agreement');
      await candidatePage.getByRole('checkbox', { name: /I understand that no minimum/ }).check();
      await candidatePage.getByRole('checkbox', { name: /I understand the 17%/ }).check();
      await candidatePage
        .getByRole('checkbox', { name: /I confirm the business information/ })
        .check();
      await candidatePage.getByLabel('Declaration full name').fill('Alex Morgan');
      await candidatePage.getByRole('checkbox', { name: /I confirm these details/ }).check();
      await candidatePage.getByRole('button', { name: 'Submit application', exact: true }).click();
      await candidatePage
        .getByText('Your application has been submitted. You can follow its review here.', {
          exact: true,
        })
        .waitFor();
      await staffPage.goto(new URL('/partners/review', web).href);
      await staffPage.getByRole('link', { name: business, exact: true }).click();
      await staffPage.getByLabel('Decision', { exact: true }).selectOption('approved');
      await staffPage
        .getByLabel('Message to the applicant')
        .fill('Approved for the programme. Stripe recipient verification remains separate.');
      await staffPage.getByRole('checkbox', { name: /I have reviewed the candidate/ }).check();
      await staffPage.getByRole('button', { name: 'Record decision', exact: true }).click();
      await staffPage
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Record decision', exact: true })
        .click();
      await staffPage
        .getByText('Decision recorded. Payouts remain inactive.', { exact: true })
        .waitFor();
      await candidatePage.getByRole('button', { name: 'Refresh status', exact: true }).click();
      await candidatePage.getByText('Approved', { exact: true }).waitFor();
      await expect(candidatePage.getByRole('button', { name: 'Update & resubmit' })).toHaveCount(0);
      const stored = (await call('GET', '/me', undefined, candidate)).body.data.application;
      assert.equal(stored.status, 'approved');
      assert.equal(stored.history.length, 2);
      assert.equal(stored.payoutsActive, false);
      if (process.env.PROVIDER_BROWSER_ARTIFACTS) {
        mkdirSync(process.env.PROVIDER_BROWSER_ARTIFACTS, { recursive: true });
        await candidatePage.evaluate(() => window.scrollTo(0, 0));
        await candidatePage.screenshot({
          path: join(process.env.PROVIDER_BROWSER_ARTIFACTS, 'application-approved.png'),
          fullPage: true,
        });
        await staffPage.evaluate(() => window.scrollTo(0, 0));
        await staffPage.screenshot({
          path: join(process.env.PROVIDER_BROWSER_ARTIFACTS, 'administrator-review.png'),
          fullPage: true,
        });
        await candidatePage.setViewportSize({ width: 390, height: 844 });
        assert(
          await candidatePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
        );
        await candidatePage.evaluate(() => window.scrollTo(0, 0));
        await candidatePage.screenshot({
          path: join(process.env.PROVIDER_BROWSER_ARTIFACTS, 'application-mobile.png'),
          fullPage: true,
        });
      }
      assert.deepEqual(errors, []);
      pass(
        'real browser submits and reviews an application through authenticated API and PostgreSQL; applicant sees retained approval'
      );
    } finally {
      await browser.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
  console.log(
    `PASS ${cases} provider recruitment PostgreSQL scenarios (no Stripe, SMTP or AWS calls)`
  );
} finally {
  if (failureName) {
    await pool.query(`DROP TRIGGER IF EXISTS ${failureName} ON public.provider_application_events`);
    await pool.query(`DROP FUNCTION IF EXISTS ${failureName}()`);
  }
  await pool.end();
  await closeDbPool();
}
