import { Hono } from 'hono';
import { auditLog } from '../db/index.js';
import { hasDatabase, requireAuth, jsonError } from '../helpers.js';
import { withTransaction } from '../db/transaction.js';
import { recruitmentIdentity, RecruitmentError } from '../provider-recruitment.js';
import {
  salesReportFilters,
  providerSalesReport,
  salesReportCsv,
} from '../provider-sales-report.js';
const routes = new Hono();
routes.get('/report', async (c) => {
  c.header('Cache-Control', 'no-store');
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never))
    return jsonError(c, 403, 'FORBIDDEN', 'A personal reviewer account is required');
  if (!hasDatabase())
    return jsonError(c, 503, 'DATABASE_REQUIRED', 'Sales reports require PostgreSQL');
  const { format = 'json', ...query } = c.req.query();
  const input = salesReportFilters.safeParse(query);
  if (!input.success || !['json', 'csv'].includes(format))
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide valid filters and UTC dates: from inclusive, until exclusive, at most 366 days'
    );
  try {
    const report = await withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const report = await providerSalesReport(db, input.data, format === 'csv');
      if (format === 'csv' && report.total > 10000) return report;
      await auditLog(
        {
          eventType: 'provider.sales_report',
          actorId: auth.userId,
          actorEmail: auth.email,
          organisationId: auth.organisationId,
          resourceType: 'sales_report',
          resourceId: 'provider-sales',
          details: { filters: input.data, format, total: report.total, basis: report.basis.id },
        },
        db
      );
      return report;
    });
    if (format === 'csv') {
      if (report.total > 10000)
        return jsonError(
          c,
          400,
          'EXPORT_TOO_LARGE',
          'Narrow the report to at most 10,000 sales before exporting'
        );
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="provider-sales.csv"');
      return c.body(salesReportCsv(report));
    }
    return c.json({ success: true, data: report });
  } catch (e) {
    if (e instanceof RecruitmentError) return jsonError(c, e.status, 'FORBIDDEN', e.message);
    throw e;
  }
});
export default routes;
