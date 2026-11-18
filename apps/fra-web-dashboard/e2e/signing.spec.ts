import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const fixture = fileURLToPath(new URL('./fixtures/signing.pdf', import.meta.url));

test('manager prepares a PDF with real canvas preview and receives honest delivery status', async ({
  page,
}, testInfo) => {
  const doc = {
    id: 'document-1',
    title: 'Supplier agreement',
    status: 'draft',
    pages: [{ width: 595, height: 842 }],
    signers: [] as {
      id: string;
      name: string;
      email: string;
      status: string;
      invitation_sent_at: string | null;
      signed_at: null;
    }[],
    fields: [] as Record<string, unknown>[],
    createdAt: '2026-11-18T09:00:00Z',
    expiresAt: '2026-11-25T09:00:00Z',
  };
  await page.addInitScript(() => {
    localStorage.setItem('fra_access_token', 'isolated-ui-test-token');
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (request.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      });
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: { success: true, data },
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    if (path === '/api/v1/auth/me')
      return reply({
        userId: 'manager',
        email: 'manager@example.test',
        name: 'Alex Morgan',
        role: 'employer',
        organisationId: 'test-org',
        createdAt: doc.createdAt,
        profile: null,
        workshopRoles: [],
      });
    if (path === '/api/v1/esign/documents' && request.method() === 'GET')
      return reply({
        documents: [
          {
            id: doc.id,
            title: doc.title,
            status: doc.status,
            created_at: doc.createdAt,
            expires_at: doc.expiresAt,
            signer_count: 1,
            signed_count: 0,
          },
          {
            id: 'completed-1',
            title: 'Annual compliance acknowledgement',
            status: 'completed',
            created_at: doc.createdAt,
            expires_at: null,
            signer_count: 3,
            signed_count: 3,
          },
          {
            id: 'draft-1',
            title: 'Partner referral agreement',
            status: 'draft',
            created_at: doc.createdAt,
            expires_at: null,
            signer_count: 0,
            signed_count: 0,
          },
        ],
        hasMore: false,
      });
    if (path === '/api/v1/esign/documents' && request.method() === 'POST') {
      expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=');
      return reply({ id: doc.id }, 201);
    }
    if (path.endsWith('/source'))
      return route.fulfill({
        body: readFileSync(fixture),
        contentType: 'application/pdf',
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    if (path.endsWith('/signers')) {
      const body = request.postDataJSON();
      doc.signers.push({
        ...body,
        id: 'signer-1',
        status: 'pending',
        signed_at: null,
        invitation_sent_at: null,
      });
      return reply({ id: 'signer-1' }, 201);
    }
    if (path.endsWith('/fields')) {
      const fields = request.postDataJSON().fields;
      expect(fields).toHaveLength(1);
      expect(fields[0].signerId).toBe('signer-1');
      expect(fields[0].page).toBe(0);
      expect(fields[0].x).toBeGreaterThanOrEqual(0);
      expect(fields[0].x + fields[0].width).toBeLessThanOrEqual(595);
      expect(fields[0].y + fields[0].height).toBeLessThanOrEqual(842);
      doc.fields = fields.map(({ signerId, ...f }: Record<string, unknown>) => ({
        ...f,
        signer_id: signerId,
      }));
      return reply({ saved: true });
    }
    if (path.endsWith('/send')) {
      doc.status = 'sent';
      return reply({ status: 'sent', deliveries: [{ signerId: 'signer-1', sent: false }] });
    }
    if (path === '/api/v1/esign/documents/document-1') return reply(doc);
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: 'NOT_FOUND', message: 'No test route' } },
    });
  });
  await page.goto('/signing/new');
  await page.getByLabel('Document title').fill(doc.title);
  await page.getByLabel('Choose your PDF').setInputFiles(fixture);
  await page.getByRole('button', { name: 'Upload & continue' }).click();
  await expect(page.getByRole('heading', { name: 'Who needs to sign?' })).toBeVisible();
  await page.getByLabel('Full name', { exact: true }).fill('Alex Morgan');
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.test');
  await page.getByRole('button', { name: 'Add recipient', exact: true }).click();
  await page.getByRole('button', { name: 'Place signature fields' }).click();

  await expect(page.getByRole('alert')).toHaveCount(0);
  const canvas = page.getByLabel('PDF preview, page 1');
  await expect(canvas).toHaveAttribute('data-preview-ready', 'true', { timeout: 30000 });
  await expect(page.getByText('Preparing document preview…')).toHaveCount(0);
  await expect
    .poll(() => canvas.evaluate((el) => (el as HTMLCanvasElement).width))
    .toBeGreaterThan(0);
  await page
    .getByRole('button', { name: /Place field on page/ })
    .click({ position: { x: 120, y: 220 } });
  await expect(page.getByLabel('X', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('fields-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('fields-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save fields & review' }).click();
  await expect(page.getByRole('heading', { name: 'Ready to send?' })).toBeVisible();
  const send = page.getByRole('button', { name: 'Send invitations', exact: true });
  await expect(send).toBeDisabled();
  await page.getByRole('checkbox').check();
  await send.click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Send invitations', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: '1 invitation(s) could not be sent' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend invitation' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/signing');
  await expect(
    page.getByRole('link', { name: 'Annual compliance acknowledgement', exact: true })
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('documents-desktop.png'), fullPage: true });
  await page.getByLabel('Filter this page by status').selectOption('draft');
  await expect(
    page.getByRole('link', { name: 'Partner referral agreement', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Annual compliance acknowledgement', exact: true })
  ).toHaveCount(0);
});
