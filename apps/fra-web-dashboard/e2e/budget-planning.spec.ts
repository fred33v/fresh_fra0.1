// Browser contracts use a mocked API; real SQL, authority and rollbacks are
// verified separately by domain-budget-integration.mjs.
import { test, expect } from '@playwright/test';
import type { BudgetPlanningPlan, BudgetPlanningMitigation } from '@stopfra/types';
test('budget plans save, reload, edit, retain failed drafts, complete, export and remove', async ({
  page,
}) => {
  const id = '8ae0e3a1-bb74-47b9-8076-a928bb29768e';
  let plan: BudgetPlanningPlan | null = null,
    failEdit = true,
    creates = 0,
    updates = 0;
  await page.addInitScript(() => {
    localStorage.setItem('fra_access_token', 'fixture');
    localStorage.setItem('fra_refresh_token', 'fixture');
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname,
      method = req.method();
    let data: unknown = null;
    if (method === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      });
    if (path.endsWith('/auth/me'))
      data = {
        userId: 'owner',
        name: 'Owner',
        email: 'owner@example.test',
        role: 'employer',
        organisationId: 'org',
        createdAt: '2026-01-01',
        profile: null,
        workshopRoles: [],
      };
    else if (path.endsWith('/results')) data = { overallScore: 60 };
    else if (path.includes('/budget-guide/plans/')) {
      if (path.endsWith('/report'))
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>Saved budget</title>',
          headers: { 'Content-Disposition': 'attachment; filename="budget.html"' },
        });
      if (method === 'GET') data = plan;
      else {
        const input = method === 'DELETE' ? null : req.postDataJSON();
        if (path.endsWith('/mitigations/item') && method === 'PATCH' && failEdit) {
          failEdit = false;
          return route.fulfill({
            status: 503,
            json: {
              success: false,
              error: { code: 'SAVE_FAILED', message: 'Save unavailable; retry your strategy' },
            },
          });
        }
        if (!plan)
          plan = {
            id: 'plan',
            assessment_id: id,
            version: 1,
            riskAppetite: null,
            mitigations: [],
            completed_at: null,
            updated_at: '2026-11-13',
          };
        else {
          expect(
            Number(input?.expectedVersion ?? new URL(req.url()).searchParams.get('expectedVersion'))
          ).toBe(plan.version);
          plan = { ...plan, version: plan.version + 1, completed_at: null };
        }
        if (path.endsWith('/risk-appetite'))
          plan.riskAppetite = {
            level: input.level,
            justification: input.justification,
            updated_at: '2026-11-13',
          };
        if (path.endsWith('/mitigations')) {
          creates++;
          plan.mitigations = [
            {
              ...input,
              id: 'item',
              created_at: '2026-11-13',
              updated_at: '2026-11-13',
            } as BudgetPlanningMitigation,
          ];
        }
        if (path.endsWith('/mitigations/item') && method === 'PATCH') {
          updates++;
          plan.mitigations = [{ ...plan.mitigations[0], ...input }];
        }
        if (method === 'DELETE') plan.mitigations = [];
        if (path.endsWith('/complete')) plan.completed_at = '2026-11-13';
        data = plan;
      }
    }
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto(`/budget-guide/${id}`);
  await page.getByLabel('Justification').fill('Protect our services');
  await page.getByRole('button', { name: 'Save appetite' }).click();
  await page.getByRole('tab', { name: /Mitigation Strategies/ }).click();
  await page.getByRole('button', { name: 'Add Strategy', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Description').fill('Vendor checks');
  await dialog.getByLabel('Budget (£)', { exact: true }).fill('125.55');
  await dialog.getByRole('button', { name: 'Add Strategy', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('tab', { name: /Mitigation Strategies/ }).click();
  await expect(page.getByText('Vendor checks', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit strategy Vendor checks' }).click();
  await dialog.getByLabel('Description').fill('Revised checks');
  await dialog.getByRole('button', { name: 'Update Strategy' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Description')).toHaveValue('Revised checks');
  await expect(dialog.getByRole('alert')).toContainText('Save unavailable');
  await dialog.getByRole('button', { name: 'Update Strategy' }).click();
  await expect(dialog).toHaveCount(0);
  expect(creates).toBe(1);
  expect(updates).toBe(1);
  await page.getByRole('button', { name: 'Complete budget plan', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Budget plan completed', exact: true })
  ).toBeDisabled();
  await page.getByRole('tab', { name: /Implementation/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download.*Report/i }).click();
  expect((await download).suggestedFilename()).toMatch(/\.html$/);
  await page.getByRole('tab', { name: /Mitigation Strategies/ }).click();
  await page.getByRole('button', { name: 'Remove strategy Revised checks' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Remove strategy', exact: true })
    .click();
  await expect(page.getByText('Revised checks', { exact: true })).toHaveCount(0);
});
