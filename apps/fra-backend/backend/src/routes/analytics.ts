import crypto from 'node:crypto';
import { Hono } from 'hono';
import { hasDatabase, hasPackageEntitlement, jsonError, requireAuth } from '../helpers.js';
import { RISK_THRESHOLDS, RATE_LIMITS, parsePagination, paginate, requireUUIDParam } from '../types.js';
import type { AssessmentStatus, EmployeeDashboardRow } from '../types.js';
import { assessmentsById, purchasesById, keypassesByCode, usersByEmail } from '../stores.js';
import { dbListAssessmentsByOrganisation, dbListPurchasesByOrganisation, dbListKeypassesByOrganisation, dbListKeypassesByUser, dbGetEmployeeDashboardData, dbGetUserById, auditLog } from '../db/index.js';
import { rateLimit, getClientIp } from '../middleware.js';

const analytics = new Hono();

analytics.get('/analytics/overview', async (c) => {
  const limited = await rateLimit('analytics:overview', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const orgAssessments = hasDatabase()
    ? await dbListAssessmentsByOrganisation(auth.organisationId)
    : Array.from(assessmentsById.values()).filter((a) => a.organisationId === auth.organisationId);

  const byStatus = orgAssessments.reduce<Record<AssessmentStatus, number>>(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    { draft: 0, in_progress: 0, submitted: 0, completed: 0 }
  );

  const latestUpdatedAt = orgAssessments
    .map((a) => a.updatedAt)
    .sort()
    .at(-1);

  return c.json({
    success: true,
    data: {
      organisationId: auth.organisationId,
      totals: {
        assessments: orgAssessments.length,
      },
      byStatus,
      latestUpdatedAt: latestUpdatedAt ?? null,
    },
  });
});

analytics.get('/analytics/assessments', async (c) => {
  const limited = await rateLimit('analytics:assessments', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const orgAssessments = hasDatabase()
    ? await dbListAssessmentsByOrganisation(auth.organisationId)
    : Array.from(assessmentsById.values()).filter((a) => a.organisationId === auth.organisationId);

  const from = c.req.query('from');
  const to = c.req.query('to');

  let filtered = orgAssessments;
  if (from) {
    const fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      return jsonError(c, 400, 'INVALID_DATE', 'Invalid "from" date parameter');
    }
    filtered = filtered.filter((a) => new Date(a.createdAt) >= fromDate);
  }
  if (to) {
    const toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      return jsonError(c, 400, 'INVALID_DATE', 'Invalid "to" date parameter');
    }
    toDate.setDate(toDate.getDate() + 1); // inclusive end date
    filtered = filtered.filter((a) => new Date(a.createdAt) < toDate);
  }

  const timeline = filtered
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      status: a.status,
      submittedAt: a.submittedAt ?? null,
    }));

  const { page, pageSize } = parsePagination(c.req.query());
  const result = paginate(timeline, page, pageSize);

  return c.json({
    success: true,
    data: {
      organisationId: auth.organisationId,
      items: result.items,
    },
    pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages },
  });
});

analytics.get('/reports/generate', async (c) => {
  const limited = await rateLimit('reports:generate', { windowMs: RATE_LIMITS.REPORT_WINDOW_MS, max: RATE_LIMITS.REPORT_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  // Allow all packages (basic, training, full) to generate reports
  // PDF export with full details available to all packages via /assessments/:id/export-pdf
  const orgAssessments = hasDatabase()
    ? await dbListAssessmentsByOrganisation(auth.organisationId)
    : Array.from(assessmentsById.values()).filter((a) => a.organisationId === auth.organisationId);

  // Compute summary statistics
  const byStatus = orgAssessments.reduce<Record<AssessmentStatus, number>>(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    { draft: 0, in_progress: 0, submitted: 0, completed: 0 }
  );

  const completedAssessments = orgAssessments.filter((a) => a.status === 'completed' || a.status === 'submitted');

  // Derive risk indicators from completed assessments
  const assessmentSummaries = completedAssessments.map((a) => {
    const answerCount = Object.keys(a.answers).length;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (answerCount >= RISK_THRESHOLDS.HIGH_ANSWER_COUNT) riskLevel = 'high';
    else if (answerCount >= RISK_THRESHOLDS.MEDIUM_ANSWER_COUNT) riskLevel = 'medium';

    return {
      id: a.id,
      title: a.title,
      status: a.status,
      answerCount,
      riskLevel,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      submittedAt: a.submittedAt ?? null,
    };
  });

  // Overall risk: highest risk found across assessments, or 'none' if no assessments
  const riskLevels = assessmentSummaries.map((s) => s.riskLevel);
  const overallRisk = riskLevels.includes('high')
    ? 'high'
    : riskLevels.includes('medium')
      ? 'medium'
      : completedAssessments.length > 0
        ? 'low'
        : 'none';

  const latestUpdatedAt = orgAssessments
    .map((a) => a.updatedAt)
    .sort()
    .at(-1);

  const reportId = `rpt_${crypto.randomUUID().replace(/-/g, '')}`;
  const generatedAt = new Date().toISOString();

  await auditLog({
    eventType: 'report.generated', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'report', resourceId: reportId,
    details: { assessmentCount: completedAssessments.length, overallRisk },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: {
      reportId,
      organisationId: auth.organisationId,
      status: 'generated',
      generatedAt,
      summary: {
        totalAssessments: orgAssessments.length,
        byStatus,
        completedCount: completedAssessments.length,
        overallRisk,
        latestActivity: latestUpdatedAt ?? null,
      },
      assessments: assessmentSummaries,
    },
  });
});

analytics.get('/analytics/dashboard', async (c) => {
  const limited = await rateLimit('analytics:dashboard', { windowMs: 60_000, max: 20 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  // Require pkg_full for the aggregated dashboard
  const orgPurchases = hasDatabase()
    ? await dbListPurchasesByOrganisation(auth.organisationId)
    : Array.from(purchasesById.values()).filter((p) => p.organisationId === auth.organisationId);

  if (!hasPackageEntitlement(orgPurchases, 'pkg_full')) {
    return jsonError(c, 403, 'PACKAGE_REQUIRED', 'Dashboard requires the Full package');
  }

  const orgAssessments = hasDatabase()
    ? await dbListAssessmentsByOrganisation(auth.organisationId)
    : Array.from(assessmentsById.values()).filter((a) => a.organisationId === auth.organisationId);

  const orgKeypasses = hasDatabase()
    ? await dbListKeypassesByOrganisation(auth.organisationId)
    : Array.from(keypassesByCode.values()).filter((k) => k.organisationId === auth.organisationId);

  const assessmentsByStatus = orgAssessments.reduce<Record<string, number>>(
    (acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; },
    { draft: 0, in_progress: 0, submitted: 0, completed: 0 }
  );

  const keypassesByStatus = orgKeypasses.reduce<Record<string, number>>(
    (acc, k) => { acc[k.status] = (acc[k.status] ?? 0) + 1; return acc; },
    { available: 0, used: 0, revoked: 0, expired: 0 }
  );

  const activePurchases = orgPurchases.filter((p) => p.status === 'succeeded');
  const totalSpent = activePurchases.reduce((sum, p) => sum + p.amountCents, 0);

  return c.json({
    success: true,
    data: {
      organisationId: auth.organisationId,
      assessments: {
        total: orgAssessments.length,
        byStatus: assessmentsByStatus,
      },
      keypasses: {
        total: orgKeypasses.length,
        byStatus: keypassesByStatus,
      },
      purchases: {
        total: orgPurchases.length,
        active: activePurchases.length,
        totalSpentCents: totalSpent,
      },
    },
  });
});

// ── Employee dashboard endpoints ────────────────────────────────

analytics.get('/analytics/employees', async (c) => {
  const limited = await rateLimit('analytics:employees', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Employee analytics requires employer or admin role');
  }

  // Require pkg_full for employee analytics
  const orgPurchases = hasDatabase()
    ? await dbListPurchasesByOrganisation(auth.organisationId)
    : Array.from(purchasesById.values()).filter((p) => p.organisationId === auth.organisationId);

  if (!hasPackageEntitlement(orgPurchases, 'pkg_full')) {
    return jsonError(c, 403, 'PACKAGE_REQUIRED', 'Employee analytics requires the Full package');
  }

  // Fetch employee data with assessment progress
  let rows: EmployeeDashboardRow[];
  if (hasDatabase()) {
    rows = await dbGetEmployeeDashboardData(auth.organisationId);
  } else {
    // In-memory fallback: join users + assessments manually
    const orgUsers = Array.from(usersByEmail.values()).filter((u) => u.organisationId === auth.organisationId);
    const orgAssessments = Array.from(assessmentsById.values()).filter((a) => a.organisationId === auth.organisationId);
    rows = [];
    for (const u of orgUsers) {
      const userAssessments = orgAssessments.filter((a) => a.createdByUserId === u.id);
      if (userAssessments.length === 0) {
        rows.push({ id: u.id, email: u.email, name: u.name, role: u.role, department: u.department ?? null, createdAt: u.createdAt, assessmentId: null, assessmentStatus: null, assessmentStarted: null, assessmentCompleted: null, answerCount: 0 });
      } else {
        for (const a of userAssessments) {
          rows.push({ id: u.id, email: u.email, name: u.name, role: u.role, department: u.department ?? null, createdAt: u.createdAt, assessmentId: a.id, assessmentStatus: a.status, assessmentStarted: a.createdAt, assessmentCompleted: a.submittedAt ?? null, answerCount: Object.keys(a.answers).length });
        }
      }
    }
  }

  // Group rows by user to produce one record per employee
  const userMap = new Map<string, {
    userId: string; userName: string; email: string; role: string;
    department: string | null;
    status: 'completed' | 'in-progress' | 'not-started';
    startedAt: string | null; completedAt: string | null;
    assessmentCount: number; latestAssessmentStatus: string | null;
    riskLevel: 'high' | 'medium' | 'low' | null;
  }>();

  for (const row of rows) {
    const existing = userMap.get(row.id);
    if (!existing) {
      let status: 'completed' | 'in-progress' | 'not-started' = 'not-started';
      let riskLevel: 'high' | 'medium' | 'low' | null = null;
      if (row.assessmentStatus === 'completed' || row.assessmentStatus === 'submitted') {
        status = 'completed';
        if (row.answerCount >= RISK_THRESHOLDS.HIGH_ANSWER_COUNT) riskLevel = 'high';
        else if (row.answerCount >= RISK_THRESHOLDS.MEDIUM_ANSWER_COUNT) riskLevel = 'medium';
        else riskLevel = 'low';
      } else if (row.assessmentStatus === 'draft' || row.assessmentStatus === 'in_progress') {
        status = 'in-progress';
      }

      userMap.set(row.id, {
        userId: row.id,
        userName: row.name,
        email: row.email,
        role: row.role,
        department: row.department,
        status,
        startedAt: row.assessmentStarted,
        completedAt: row.assessmentCompleted,
        assessmentCount: row.assessmentId ? 1 : 0,
        latestAssessmentStatus: row.assessmentStatus,
        riskLevel,
      });
    } else {
      // Multiple assessments: update with latest
      existing.assessmentCount += row.assessmentId ? 1 : 0;
      if (row.assessmentStatus === 'completed' || row.assessmentStatus === 'submitted') {
        existing.status = 'completed';
        existing.completedAt = row.assessmentCompleted ?? existing.completedAt;
        if (row.answerCount >= RISK_THRESHOLDS.HIGH_ANSWER_COUNT) existing.riskLevel = 'high';
        else if (row.answerCount >= RISK_THRESHOLDS.MEDIUM_ANSWER_COUNT) existing.riskLevel = existing.riskLevel === 'high' ? 'high' : 'medium';
        else if (!existing.riskLevel) existing.riskLevel = 'low';
      } else if (row.assessmentStatus && existing.status === 'not-started') {
        existing.status = 'in-progress';
        existing.startedAt = row.assessmentStarted ?? existing.startedAt;
      }
      existing.latestAssessmentStatus = row.assessmentStatus ?? existing.latestAssessmentStatus;
    }
  }

  const employees = Array.from(userMap.values());
  const { page, pageSize } = parsePagination(c.req.query());
  const result = paginate(employees, page, pageSize);

  return c.json({
    success: true,
    data: result.items,
    pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages },
  });
});

analytics.get('/analytics/employees/:userId', async (c) => {
  const limited = await rateLimit('analytics:employee-detail', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Employee detail requires employer or admin role');
  }

  const userId = requireUUIDParam(c, 'userId');
  if (userId instanceof Response) return userId;

  // Require pkg_full
  const orgPurchases = hasDatabase()
    ? await dbListPurchasesByOrganisation(auth.organisationId)
    : Array.from(purchasesById.values()).filter((p) => p.organisationId === auth.organisationId);

  if (!hasPackageEntitlement(orgPurchases, 'pkg_full')) {
    return jsonError(c, 403, 'PACKAGE_REQUIRED', 'Employee detail requires the Full package');
  }

  // Verify user belongs to same org
  let targetUser;
  if (hasDatabase()) {
    targetUser = await dbGetUserById(userId);
  } else {
    targetUser = Array.from(usersByEmail.values()).find((u) => u.id === userId) ?? null;
  }

  if (!targetUser || targetUser.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Employee not found');
  }

  // Get assessments for this user
  const orgAssessments = hasDatabase()
    ? await dbListAssessmentsByOrganisation(auth.organisationId)
    : Array.from(assessmentsById.values()).filter((a) => a.organisationId === auth.organisationId);

  const userAssessments = orgAssessments
    .filter((a) => a.createdByUserId === userId)
    .map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      answers: a.answers,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      submittedAt: a.submittedAt ?? null,
    }));

  // Get keypasses used by this user
  const userKeypasses = hasDatabase()
    ? (await dbListKeypassesByUser(userId)).map((k) => ({
        code: k.code, status: k.status, createdAt: k.createdAt,
        expiresAt: k.expiresAt, usedAt: k.usedAt ?? null,
      }))
    : [];  // In-memory store does not track used_by_user_id — return empty

  return c.json({
    success: true,
    data: {
      userId: targetUser.id,
      userName: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      createdAt: targetUser.createdAt,
      assessments: userAssessments,
      keypasses: userKeypasses,
    },
  });
});

export default analytics;
