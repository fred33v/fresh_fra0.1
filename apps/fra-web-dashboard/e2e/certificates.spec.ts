// Browser UI contracts use a mocked API. PostgreSQL, issuance and real PDF
// rendering are tested separately by backend/scripts/certificate-integration.mjs.
import { test, expect, type Page } from '@playwright/test';
const number = 'FRA-AAAA-BBBB-CCCC';
const certificate = {
  valid: true,
  status: 'valid',
  kind: 'training',
  certificateNumber: number,
  issuedAt: '2026-11-12T12:00:00Z',
  completedAt: '2026-11-01T10:00:00Z',
  holderName: 'Original Recipient',
  organisationName: 'Original Organisation',
  title: 'Fraud Risk Awareness Workshop',
  quizScore: 100,
  areasAssessed: null,
  snapshotOrigin: 'issued',
};
async function api(page: Page, role?: string) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = null;
    if (path.endsWith('/auth/me'))
      data = {
        userId: 'admin-fixture',
        email: 'admin@example.test',
        name: 'Admin',
        role: role ?? 'admin',
        organisationId: 'org-fixture',
        createdAt: '2026-01-01T00:00:00Z',
        profile: null,
        workshopRoles: [],
      };
    else if (path.includes('/certificates/verify/')) {
      const ref = decodeURIComponent(path.split('/').at(-1)!);
      if (ref === 'FRA-NOT-FOUND')
        return route.fulfill({
          status: 404,
          json: {
            success: false,
            error: { code: 'NOT_FOUND', message: 'No certificate has this number' },
          },
        });
      data = {
        ...certificate,
        ...(ref === 'FRA-REVOKED-0000'
          ? { certificateNumber: ref, valid: false, status: 'revoked' }
          : {}),
      };
    } else if (path.endsWith('/revoke')) {
      expect(route.request().postDataJSON()).toEqual({ reason: 'Issued in error' });
      data = { certificateNumber: number, changed: true, status: 'revoked' };
    }
    await route.fulfill({ json: { success: true, data } });
  });
  if (role)
    await page.addInitScript(() => {
      localStorage.setItem('fra_access_token', 'ui-fixture-token');
      localStorage.setItem('fra_refresh_token', 'ui-fixture-refresh');
    });
}
test('public verification distinguishes valid, revoked and not found on a narrow screen', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await api(page);
  await page.goto(`/certificate/verify?n=${number}`);
  await expect(page.getByText('Certificate is valid')).toBeVisible();
  await expect(page.getByText('Original Recipient')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({ path: testInfo.outputPath('verify-valid-mobile.png'), fullPage: true });
  await page.goto('/certificate/verify?n=FRA-REVOKED-0000');
  await expect(page.getByText('Certificate has been revoked')).toBeVisible();
  await expect(page.getByText('Certificate is valid')).toHaveCount(0);
  await page.goto('/certificate/verify?n=FRA-NOT-FOUND');
  await expect(page.getByRole('heading', { name: 'Not verified' })).toBeVisible();
});
test('an admin confirms revocation and other account roles are redirected', async ({
  page,
}, testInfo) => {
  await api(page, 'admin');
  await page.goto('/certificate/manage');
  await page.getByLabel('Certificate number').fill(number);
  await page.getByLabel('Reason for revocation').fill('Issued in error');
  await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Revoke certificate', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('has been revoked');
  await page.screenshot({ path: testInfo.outputPath('admin-revocation.png'), fullPage: true });
  await page.unrouteAll({ behavior: 'wait' });
  await api(page, 'employer');
  await page.goto('/certificate/manage');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Manage certificates' })).toHaveCount(0);
});
