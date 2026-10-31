/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createAuthenticatedUser, createPaidUser } from './helpers';
import { certificates, workshopProgress } from '../src/workshop-store';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const post = (path: string, token: string | null, body: unknown) => app.request(`${API}${path}`, {
  method: 'POST', headers: token ? authHeaders(token) : { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

async function employerWithStaff(packageId = 'pkg_training') {
  const boss = await createPaidUser(packageId);
  const email = `sam-${crypto.randomUUID()}@example.com`;
  const { invited } = ((await (await post('/keypasses/invite', boss.accessToken, { emails: [email, `pending-${crypto.randomUUID()}@example.com`] })).json()) as any).data;
  const joined = ((await (await post('/keypasses/use', null, { code: invited[0].code, email, password: 'Employee-Pass-2026', name: 'Sam Staff' })).json()) as any).data;
  return { boss, employee: { accessToken: joined.accessToken as string, userId: joined.user.userId as string, email } };
}

describe('GET /team/training', () => {
  it("shows each employee's training, certificate and action plan, and unused invitations", async () => {
    const { boss, employee } = await employerWithStaff();
    const now = new Date().toISOString();
    workshopProgress.set(crypto.randomUUID(), {
      id: crypto.randomUUID(), user_id: employee.userId, session_id: null, current_section: 3, completed_sections: [0, 1, 2],
      quiz_scores: { 1: 100, 2: 0 }, scenario_choices: {}, completed_at: null, created_at: now, updated_at: now,
    });
    await post('/workshop/action-plans', employee.accessToken, {
      actionItems: [{ id: 'a', title: 'One', completed: true }, { id: 'b', title: 'Two', completed: false }, { id: 'c', title: 'Three', completed: true }],
      commitments: [],
    });

    const res = await get('/team/training', boss.accessToken);
    expect(res.status).toBe(200);
    const data = ((await res.json()) as any).data;
    expect(data.people).toHaveLength(1);
    const sam = data.people[0];
    expect(sam).toMatchObject({
      name: 'Sam Staff', email: employee.email, emailConfirmed: true,
      training: { status: 'in_progress', modulesDone: 3, totalModules: 7, quizAverage: 50, completedAt: null },
      certificate: null,
      actionPlan: { done: 2, total: 3 },
    });
    expect(data.invitations).toHaveLength(1);
    expect(data.summary).toEqual({ people: 1, trained: 0, certificates: 0, pendingInvitations: 1 });
  });

  it('counts a finished workshop and its certificate, and exports CSV', async () => {
    const { boss, employee } = await employerWithStaff();
    const now = new Date().toISOString();
    workshopProgress.set(crypto.randomUUID(), {
      id: crypto.randomUUID(), user_id: employee.userId, session_id: null, current_section: 6, completed_sections: [0, 1, 2, 3, 4, 5, 6],
      quiz_scores: { 1: 100, 2: 100, 3: 100, 4: 100 }, scenario_choices: {}, completed_at: now, created_at: now, updated_at: now,
    });
    certificates.set(crypto.randomUUID(), { id: crypto.randomUUID(), user_id: employee.userId, session_id: null, certificate_number: 'FRA-TEST-0001', issued_at: now });

    const data = ((await (await get('/team/training', boss.accessToken)).json()) as any).data;
    expect(data.people[0].training.status).toBe('completed');
    expect(data.people[0].certificate).toEqual({ number: 'FRA-TEST-0001', issuedAt: now });
    expect(data.summary.trained).toBe(1);

    const csv = await (await get('/team/training?format=csv', boss.accessToken)).text();
    expect(csv.split('\n')[0]).toContain('certificateNumber');
    expect(csv).toContain('FRA-TEST-0001');
    expect(csv).toContain('7/7');
  });

  it('is for the employer, from Professional up', async () => {
    const { employee } = await employerWithStaff('pkg_full');
    expect((await get('/team/training', employee.accessToken)).status).toBe(403);

    const starter = await createPaidUser('pkg_basic');
    expect((await get('/team/training', starter.accessToken)).status).toBe(403);

    const none = await createAuthenticatedUser();
    expect((await get('/team/training', none.accessToken)).status).toBe(403);
  });
});
