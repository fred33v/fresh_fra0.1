import { Hono } from 'hono';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { requireUUIDParam, assessmentCreateSchema, assessmentPatchSchema, parsePagination, paginate } from '../types.js';
import type { Assessment, AssessmentStatus } from '../types.js';
import { assessmentsById } from '../stores.js';
import {
  dbInsertAssessment, dbGetAssessmentById, dbListAssessmentsByOrganisation, dbUpdateAssessment,
  auditLog,
} from '../db/index.js';
import { rateLimit, getClientIp } from '../middleware.js';
import { getAssessmentAllowance } from '../entitlements.js';
import { ASSESSMENT_MODULES, buildAssessmentResults } from '../assessment-modules.js';
import { emitOrgEvent } from '../webhooks-out.js';
import { scoreAssessment } from '../assessment-risk.js';
import { organisationReassessmentStatus } from '../reassessment.js';
import { issueAssessmentCertificateLater } from '../certificates.js';

// Answers stay out of webhook payloads; integrations fetch detail via the API if needed
function notifySubmitted(a: Assessment) {
  // Every submitted assessment gets its own verifiable certificate
  issueAssessmentCertificateLater(a);
  const risk = scoreAssessment(a);
  const assessment = {
    id: a.id, title: a.title, status: a.status, createdByUserId: a.createdByUserId,
    submittedAt: a.submittedAt, answerCount: Object.keys(a.answers).length,
    riskLevel: risk.level, riskCounts: risk.counts,
  };
  void emitOrgEvent(a.organisationId, 'assessment.submitted', { assessment });
  if (risk.level === 'high') {
    void emitOrgEvent(a.organisationId, 'assessment.high_risk', {
      assessment,
      highRisks: risk.risks.filter((r) => r.priority === 'high').map(({ title, area, residualScore }) => ({ title, area, residualScore })),
    });
  }
}

const assessments = new Hono();

assessments.get('/assessments', async (c) => {
  const limited = await rateLimit('assessments:list', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const statusFilter = c.req.query('status') as Assessment['status'] | undefined;
  const validStatuses = new Set<string>(['draft', 'in_progress', 'submitted', 'completed']);

  if (statusFilter && !validStatuses.has(statusFilter)) {
    return jsonError(c, 400, 'INVALID_PARAM', 'Invalid status filter');
  }

  let items: Assessment[];
  if (!hasDatabase()) {
    items = Array.from(assessmentsById.values()).filter((a) => a.organisationId === auth.organisationId);
  } else {
    items = await dbListAssessmentsByOrganisation(auth.organisationId);
  }

  if (statusFilter) {
    items = items.filter((a) => a.status === statusFilter);
  }

  const { page, pageSize } = parsePagination(c.req.query());
  const result = paginate(items, page, pageSize);

  return c.json({ success: true, data: result.items, pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages } });
});

assessments.get('/assessments/organisation/:orgId', async (c) => {
  const limited = await rateLimit('assessments:org-list', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const orgId = requireUUIDParam(c, 'orgId');
  if (orgId instanceof Response) return orgId;
  if (orgId !== auth.organisationId) return jsonError(c, 403, 'FORBIDDEN', 'Forbidden');

  const items = !hasDatabase()
    ? Array.from(assessmentsById.values()).filter((a) => a.organisationId === orgId)
    : await dbListAssessmentsByOrganisation(orgId);

  const { page, pageSize } = parsePagination(c.req.query());
  const result = paginate(items, page, pageSize);

  return c.json({ success: true, data: result.items, pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages } });
});

assessments.post('/assessments', async (c) => {
  const limited = await rateLimit('assessments:create', { windowMs: 60_000, max: 20 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const parsed = assessmentCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid assessment payload');

  const allowance = await getAssessmentAllowance(auth);
  if (allowance.limit === 0) return jsonError(c, 403, 'PACKAGE_REQUIRED', 'A paid package is required to start an assessment');
  if (!allowance.allowed) return jsonError(c, 403, 'ASSESSMENT_LIMIT_REACHED', allowance.reason ?? 'Assessment limit reached');

  const now = new Date().toISOString();
  const assessment: Assessment = {
    id: crypto.randomUUID(),
    organisationId: auth.organisationId,
    createdByUserId: auth.userId,
    title: parsed.data.title,
    status: 'draft',
    answers: parsed.data.answers ?? {},
    createdAt: now,
    updatedAt: now,
  };

  if (hasDatabase()) {
    await dbInsertAssessment(assessment);
  } else {
    assessmentsById.set(assessment.id, assessment);
  }

  await auditLog({
    eventType: 'assessment.created', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'assessment', resourceId: assessment.id,
    details: { title: assessment.title }, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: assessment }, 201);
});

// Registered before /assessments/:id so "modules" is not treated as an ID
// When the organisation's quarterly reassessment is due (Professional and Enterprise)
assessments.get('/assessments/reassessment', async (c) => {
  const limited = await rateLimit('assessments:reassessment', { windowMs: 60_000, max: 60 })(c);
  if (limited instanceof Response) return limited;
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.json({ success: true, data: await organisationReassessmentStatus(auth.organisationId) });
});

assessments.get('/assessments/modules', async (c) => {
  const limited = await rateLimit('assessments:modules', { windowMs: 60_000, max: 60 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  return c.json({ success: true, data: ASSESSMENT_MODULES });
});

assessments.get('/assessments/:id', async (c) => {
  const limited = await rateLimit('assessments:get', { windowMs: 60_000, max: 60 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  if (!hasDatabase()) {
    const assessment = assessmentsById.get(id);
    if (!assessment || assessment.organisationId !== auth.organisationId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
    }
    return c.json({ success: true, data: assessment });
  }

  const assessment = await dbGetAssessmentById(id);
  if (!assessment || assessment.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
  }
  return c.json({ success: true, data: assessment });
});

assessments.patch('/assessments/:id', async (c) => {
  const limited = await rateLimit('assessments:patch', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;
  const parsed = assessmentPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid assessment patch payload');

  // Valid status transitions — prevent arbitrary jumps (e.g. draft→completed)
  const validTransitions: Record<AssessmentStatus, AssessmentStatus[]> = {
    draft: ['draft', 'in_progress', 'submitted'],
    in_progress: ['in_progress', 'submitted'],
    submitted: ['submitted', 'completed'],
    completed: ['completed'],
  };

  if (!hasDatabase()) {
    const assessment = assessmentsById.get(id);
    if (!assessment || assessment.organisationId !== auth.organisationId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
    }
    if (assessment.createdByUserId !== auth.userId && auth.role !== 'employer' && auth.role !== 'admin') {
      return jsonError(c, 403, 'FORBIDDEN', 'Cannot modify another user\'s assessment');
    }

    const newStatus = parsed.data.status ?? assessment.status;
    if (parsed.data.status && !validTransitions[assessment.status]?.includes(newStatus)) {
      return jsonError(c, 400, 'INVALID_STATUS_TRANSITION', `Cannot transition from ${assessment.status} to ${newStatus}`);
    }

    const now = new Date().toISOString();
    const updated: Assessment = {
      ...assessment,
      title: parsed.data.title ?? assessment.title,
      status: newStatus,
      answers: parsed.data.answers ?? assessment.answers,
      updatedAt: now,
      submittedAt: newStatus === 'submitted' && assessment.status !== 'submitted' ? now : assessment.submittedAt,
    };

    assessmentsById.set(id, updated);
    if (newStatus === 'submitted' && assessment.status !== 'submitted') notifySubmitted(updated);
    return c.json({ success: true, data: updated });
  }

  const existing = await dbGetAssessmentById(id);
  if (!existing || existing.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
  }
  if (existing.createdByUserId !== auth.userId && auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Cannot modify another user\'s assessment');
  }

  const newStatus = parsed.data.status ?? existing.status;
  if (parsed.data.status && !validTransitions[existing.status]?.includes(newStatus)) {
    return jsonError(c, 400, 'INVALID_STATUS_TRANSITION', `Cannot transition from ${existing.status} to ${newStatus}`);
  }

  const now = new Date().toISOString();
  const updated = await dbUpdateAssessment(id, {
    title: parsed.data.title ?? existing.title,
    status: newStatus,
    answers: parsed.data.answers ?? existing.answers,
    updatedAt: now,
    submittedAt: newStatus === 'submitted' && existing.status !== 'submitted' ? now : undefined,
  });

  if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');

  await auditLog({
    eventType: 'assessment.updated', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'assessment', resourceId: id,
    details: { title: updated.title, status: updated.status }, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });
  if (newStatus === 'submitted' && existing.status !== 'submitted') notifySubmitted(updated);

  return c.json({ success: true, data: updated });
});

assessments.post('/assessments/:id/submit', async (c) => {
  const limited = await rateLimit('assessments:submit', { windowMs: 60_000, max: 10 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  const allowedFrom: AssessmentStatus[] = ['draft', 'in_progress'];

  if (!hasDatabase()) {
    const assessment = assessmentsById.get(id);
    if (!assessment || assessment.organisationId !== auth.organisationId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
    }
    if (assessment.createdByUserId !== auth.userId && auth.role !== 'employer' && auth.role !== 'admin') {
      return jsonError(c, 403, 'FORBIDDEN', 'Cannot submit another user\'s assessment');
    }
    if (!allowedFrom.includes(assessment.status)) {
      return jsonError(c, 400, 'INVALID_STATUS_TRANSITION', `Cannot submit from ${assessment.status}`);
    }

    const now = new Date().toISOString();
    const updated: Assessment = {
      ...assessment,
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
    };
    assessmentsById.set(id, updated);

    await auditLog({
      eventType: 'assessment.submitted', actorId: auth.userId, actorEmail: auth.email,
      organisationId: auth.organisationId, resourceType: 'assessment', resourceId: id,
      details: { title: updated.title, answerCount: Object.keys(updated.answers).length },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });
    notifySubmitted(updated);

    return c.json({ success: true, data: updated });
  }

  const existing = await dbGetAssessmentById(id);
  if (!existing || existing.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
  }
  if (existing.createdByUserId !== auth.userId && auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Cannot submit another user\'s assessment');
  }
  if (!allowedFrom.includes(existing.status)) {
    return jsonError(c, 400, 'INVALID_STATUS_TRANSITION', `Cannot submit from ${existing.status}`);
  }

  const now = new Date().toISOString();
  const updated = await dbUpdateAssessment(id, {
    status: 'submitted',
    submittedAt: now,
    updatedAt: now,
  });

  if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');

  await auditLog({
    eventType: 'assessment.submitted', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'assessment', resourceId: id,
    details: { title: updated.title, answerCount: Object.keys(updated.answers).length },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });
  notifySubmitted(updated);

  return c.json({ success: true, data: updated });
});

assessments.get('/assessments/:id/results', async (c) => {
  const limited = await rateLimit('assessments:results', { windowMs: 60_000, max: 60 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  const assessment = hasDatabase() ? await dbGetAssessmentById(id) : assessmentsById.get(id);
  if (!assessment || assessment.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
  }
  if (assessment.status !== 'submitted' && assessment.status !== 'completed') {
    return jsonError(c, 409, 'NOT_SUBMITTED', 'Results are available once the assessment has been submitted');
  }

  return c.json({ success: true, data: buildAssessmentResults(assessment.id, assessment.answers) });
});

export default assessments;
