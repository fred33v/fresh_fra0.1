import { Hono } from 'hono';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { organisationUpdateSchema, requireUUIDParam } from '../types.js';
import type { Organisation } from '../types.js';
import { organisationsById } from '../stores.js';
import { getClientIp } from '../middleware.js';
import { dbGetOrganisationById, dbUpdateOrganisation, auditLog } from '../db/index.js';

const organisations = new Hono();

const publicOrganisation = (org: Organisation) => ({
  organisationId: org.id,
  name: org.name,
  employeeCount: org.employeeCount ?? null,
  region: org.region ?? null,
  industry: org.industry ?? null,
  createdAt: org.createdAt,
  updatedAt: org.updatedAt,
});

async function getOrganisation(id: string): Promise<Organisation | null> {
  return hasDatabase() ? dbGetOrganisationById(id) : (organisationsById.get(id) ?? null);
}

organisations.get('/organisations/:orgId', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const orgId = requireUUIDParam(c, 'orgId');
  if (orgId instanceof Response) return orgId;
  // Members only see their own organisation; report 404 rather than confirm another one exists
  if (orgId !== auth.organisationId) return jsonError(c, 404, 'NOT_FOUND', 'Organisation not found');

  const org = await getOrganisation(orgId);
  if (!org) return jsonError(c, 404, 'NOT_FOUND', 'Organisation not found');
  return c.json({ success: true, data: publicOrganisation(org) });
});

organisations.patch('/organisations/:orgId', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const orgId = requireUUIDParam(c, 'orgId');
  if (orgId instanceof Response) return orgId;
  if (orgId !== auth.organisationId) return jsonError(c, 404, 'NOT_FOUND', 'Organisation not found');
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Only the organisation account can change its details');
  }

  const body = await c.req.json().catch(() => null);
  const parsed = organisationUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid organisation update');

  const existing = await getOrganisation(orgId);
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', 'Organisation not found');

  const now = new Date().toISOString();
  const updated: Organisation = { ...existing, ...parsed.data, updatedAt: now };
  if (hasDatabase()) {
    await dbUpdateOrganisation(orgId, parsed.data, now);
  } else {
    organisationsById.set(orgId, updated);
  }

  await auditLog({
    eventType: 'organisation.update', actorId: auth.userId, actorEmail: auth.email,
    organisationId: orgId, resourceType: 'organisation', resourceId: orgId,
    details: { fields: Object.keys(parsed.data) },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: publicOrganisation(updated) });
});

export default organisations;
