/// <reference types="jest" />
import crypto from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser, createWorkshopAdmin } from './helpers';
import { certificates, workshopProfiles } from '../src/workshop-store';
import { assessmentsById, organisationsById, usersByEmail } from '../src/stores';
import { findCertificate, issueAssessmentCertificate } from '../src/certificates';
const API = 'http://localhost/api/v1';
const data = async (r: Response) => ((await r.json()) as any).data;
let counter = 0;
async function fixture(admin = false) {
  const account = admin ? await createWorkshopAdmin() : await createPaidUser();
  const ip = `198.18.0.${++counter}`;
  const send = (path: string, body: unknown = {}, token = account.accessToken) =>
    app.request(API + path, {
      method: 'POST',
      headers: { ...authHeaders(token), 'X-Forwarded-For': ip },
      body: JSON.stringify(body),
    });
  const progress = await data(await send('/workshop/progress'));
  const completed = await app.request(`${API}/workshop/progress/${progress.id}`, {
    method: 'PATCH',
    headers: authHeaders(account.accessToken),
    body: JSON.stringify({
      completedSections: [0, 1, 2, 3, 4, 5, 6],
      quizAnswers: { 1: 1, 2: 2, 3: 1, 4: 2 },
      completedAt: new Date().toISOString(),
    }),
  });
  expect(completed.status).toBe(200);
  return { ...account, send };
}
describe('Certificate lifecycle', () => {
  it('issues one canonical training reference under concurrent requests', async () => {
    const a = await fixture();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => a.send('/workshop/certificates'))
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(4);
    const rows = await Promise.all(responses.map(data));
    expect(new Set(rows.map((r) => r.certificate_number)).size).toBe(1);
    expect(rows[0].issued_details).toMatchObject({
      snapshotOrigin: 'issued',
      courseId: 'fraud-risk-awareness',
      courseVersion: '2026-10-30',
    });
    expect(rows[0].completed_at).toBeTruthy();
  });
  it('freezes training identity and dates after profile/organisation edits', async () => {
    const a = await fixture();
    const issued = await data(await a.send('/workshop/certificates'));
    const before = await findCertificate(issued.certificate_number);
    organisationsById.get(a.organisationId)!.name = 'Changed organisation';
    workshopProfiles.set(a.userId, {
      id: crypto.randomUUID(),
      user_id: a.userId,
      full_name: 'Changed recipient',
      organization_name: 'Changed organisation',
      sector: 'private',
      job_title: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(await findCertificate(issued.certificate_number)).toEqual(before);
    expect(
      (
        await data(
          await app.request(`${API}/workshop/certificates`, { headers: authHeaders(a.accessToken) })
        )
      ).issued_details.holderName
    ).toBe(before!.holderName);
  });
  it('requires the issuing organisation admin and preserves the first revocation', async () => {
    const a = await fixture(true),
      other = await createWorkshopAdmin(),
      ordinary = await createPaidUser();
    const cert = await data(await a.send('/workshop/certificates'));
    const path = `/certificates/${cert.certificate_number}/revoke`;
    expect((await a.send(path, { reason: 'Private reason' }, ordinary.accessToken)).status).toBe(
      403
    );
    expect((await a.send(path, { reason: 'Private reason' }, other.accessToken)).status).toBe(404);
    expect((await a.send(path, { reason: '   ' })).status).toBe(400);
    usersByEmail.get(a.email)!.role = 'employee';
    expect((await a.send(path, { reason: 'Private reason' })).status).toBe(404);
    usersByEmail.get(a.email)!.role = 'admin';
    expect((await data(await a.send(path, { reason: 'Private reason' }))).changed).toBe(true);
    expect((await data(await a.send(path, { reason: 'Replacement reason' }))).changed).toBe(false);
    const verified = await data(
      await app.request(`${API}/certificates/verify/${cert.certificate_number}`)
    );
    expect(verified).toMatchObject({ valid: false, status: 'revoked' });
    for (const key of [
      'userId',
      'organisationId',
      'sourceId',
      'trainingKey',
      'reason',
      'revocationReason',
      'revokedBy',
    ])
      expect(verified).not.toHaveProperty(key);
    expect(
      (
        await app.request(`${API}/certificates/${cert.certificate_number}/pdf`, {
          headers: authHeaders(a.accessToken),
        })
      ).status
    ).toBe(409);
    const repeated = await data(await a.send('/workshop/certificates'));
    expect(repeated.certificate_number).toBe(cert.certificate_number);
    expect(repeated.status).toBe('revoked');
  });
  it('rejects malformed issuance bodies and unrelated sessions', async () => {
    const a = await fixture();
    expect((await a.send('/workshop/certificates', { sessionId: 'not-a-uuid' })).status).toBe(400);
    expect(
      (await a.send('/workshop/certificates', { sessionId: crypto.randomUUID() })).status
    ).toBe(403);
  });
  it('freezes a legacy reference without inventing its completion date', async () => {
    const a = await createPaidUser();
    const row = {
      id: crypto.randomUUID(),
      user_id: a.userId,
      session_id: null,
      certificate_number: 'FRA-LEGACY-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      issued_at: '2026-01-01T00:00:00.000Z',
    };
    certificates.set(row.id, row);
    const before = await findCertificate(row.certificate_number);
    expect(before).toMatchObject({
      snapshotOrigin: 'legacy_reconstructed',
      completedAt: null,
      courseVersion: null,
    });
    organisationsById.get(a.organisationId)!.name = 'Later name';
    expect(await findCertificate(row.certificate_number)).toEqual(before);
  });
  it('keeps assessment verification after source retention', async () => {
    const a = await createPaidUser();
    const created = await data(
      await app.request(`${API}/assessments`, {
        method: 'POST',
        headers: authHeaders(a.accessToken),
        body: JSON.stringify({ title: 'Immutable assessment' }),
      })
    );
    expect(
      (
        await app.request(`${API}/assessments/${created.id}/submit`, {
          method: 'POST',
          headers: authHeaders(a.accessToken),
          body: '{}',
        })
      ).status
    ).toBe(200);
    const issued = await issueAssessmentCertificate(assessmentsById.get(created.id)!);
    const before = await findCertificate(issued.certificate_number);
    assessmentsById.delete(created.id);
    expect(await findCertificate(issued.certificate_number)).toEqual(before);
  });
});
