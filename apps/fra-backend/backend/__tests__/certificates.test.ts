/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import {
  canDownload, certificateHtml, newCertificateNumber, normaliseCertificateNumber, verifyUrl, type CertificateRecord,
} from '../src/certificates';

const API = 'http://localhost/api/v1';
const get = (path: string, token?: string) => app.request(`${API}${path}`, token ? { headers: authHeaders(token) } : {});
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

/** A user who has finished the workshop with every quiz question right, and holds a certificate. */
async function trainedUser() {
  const user = await createPaidUser('pkg_full', { name: 'Ada Lovelace', organisationName: 'Analytical Trust' });
  const progress = await json(await send('POST', '/workshop/progress', user.accessToken));
  await send('PATCH', `/workshop/progress/${progress.id}`, user.accessToken, {
    completedSections: [0, 1, 2, 3, 4, 5, 6], quizAnswers: { 1: 1, 2: 2, 3: 1, 4: 2 }, completedAt: new Date().toISOString(),
  });
  const cert = await json(await send('POST', '/workshop/certificates', user.accessToken));
  return { ...user, cert };
}

async function submittedAssessment(token: string, title = 'Annual fraud risk assessment') {
  const created = await json(await send('POST', '/assessments', token, { title }));
  const submitted = await send('POST', `/assessments/${created.id}/submit`, token);
  expect(submitted.status).toBe(200);
  return created.id as string;
}

describe('certificate numbers', () => {
  it('are random and hard to guess', () => {
    const a = newCertificateNumber();
    expect(a).toMatch(/^FRA-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(newCertificateNumber()).not.toBe(a);
  });

  it('accept the old format, lower case and spaces, and refuse anything else', () => {
    expect(normaliseCertificateNumber(' fra-1a2b-3c4d-5e6f ')).toBe('FRA-1A2B-3C4D-5E6F');
    expect(normaliseCertificateNumber('FRA-MH3K2J1A-A1B2C3')).toBe('FRA-MH3K2J1A-A1B2C3');
    expect(normaliseCertificateNumber('FRA-')).toBeNull();
    expect(normaliseCertificateNumber("FRA-1' OR 1=1")).toBeNull();
  });
});

describe('GET /certificates/verify/:number (public)', () => {
  it('confirms a training certificate without signing in, showing only what it certifies', async () => {
    const { cert } = await trainedUser();
    const res = await get(`/certificates/verify/${cert.certificate_number.toLowerCase()}`);
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data).toMatchObject({
      valid: true, kind: 'training', certificateNumber: cert.certificate_number,
      holderName: 'Ada Lovelace', organisationName: 'Analytical Trust',
      title: 'Fraud Risk Awareness Workshop', quizScore: 100,
    });
    expect(data.verifyUrl).toContain(`/certificate/verify?n=${cert.certificate_number}`);
    expect(data).not.toHaveProperty('userId');
    expect(data).not.toHaveProperty('organisationId');
  });

  it('says when no certificate has the number', async () => {
    const res = await get('/certificates/verify/FRA-0000-0000-0000');
    expect(res.status).toBe(404);
    expect((await get('/certificates/verify/not-a-number')).status).toBe(400);
  });
});

describe('assessment certificates', () => {
  it('are issued for each submitted assessment and can be verified', async () => {
    const user = await createPaidUser('pkg_full', { organisationName: 'Northwind Charity' });
    const first = await submittedAssessment(user.accessToken, 'Q1 assessment');
    const second = await submittedAssessment(user.accessToken, 'Q2 reassessment');

    const a = await json(await get(`/assessments/${first}/certificate`, user.accessToken));
    const b = await json(await get(`/assessments/${second}/certificate`, user.accessToken));
    expect(a.certificateNumber).toMatch(/^FRA-/);
    expect(b.certificateNumber).not.toBe(a.certificateNumber);
    // Asking again gives the same certificate
    expect((await json(await get(`/assessments/${first}/certificate`, user.accessToken))).certificateNumber).toBe(a.certificateNumber);

    const verified = await json(await get(`/certificates/verify/${a.certificateNumber}`));
    expect(verified).toMatchObject({
      valid: true, kind: 'assessment', holderName: 'Northwind Charity', title: 'Q1 assessment', areasAssessed: 13,
    });
    // The risk level and answers stay private
    expect(JSON.stringify(verified)).not.toMatch(/risk(Level)?":|answers/);
  });

  it('are not issued before submission, nor shown to another organisation', async () => {
    const user = await createPaidUser('pkg_full');
    const draft = await json(await send('POST', '/assessments', user.accessToken, { title: 'Draft' }));
    expect((await get(`/assessments/${draft.id}/certificate`, user.accessToken)).status).toBe(409);

    const submitted = await submittedAssessment(user.accessToken);
    const outsider = await createPaidUser('pkg_full');
    expect((await get(`/assessments/${submitted}/certificate`, outsider.accessToken)).status).toBe(404);
  });
});

describe('GET /certificates/:number/pdf', () => {
  it('needs a sign-in, and hides other people’s certificates', async () => {
    const { cert } = await trainedUser();
    expect((await get(`/certificates/${cert.certificate_number}/pdf`)).status).toBe(401);
    const outsider = await createPaidUser('pkg_full');
    expect((await get(`/certificates/${cert.certificate_number}/pdf`, outsider.accessToken)).status).toBe(404);
  });

  it('is open to the holder and to their organisation’s employer or admin only', () => {
    const record = { userId: 'u1', organisationId: 'o1' } as CertificateRecord;
    expect(canDownload(record, { userId: 'u1', organisationId: 'o1', role: 'employee' })).toBe(true);
    expect(canDownload(record, { userId: 'u2', organisationId: 'o1', role: 'employer' })).toBe(true);
    expect(canDownload(record, { userId: 'u2', organisationId: 'o1', role: 'employee' })).toBe(false);
    expect(canDownload(record, { userId: 'u3', organisationId: 'o2', role: 'admin' })).toBe(false);
  });
});

describe('the certificate document', () => {
  it('has the name, date, number and a QR code that opens the verification page', async () => {
    const html = await certificateHtml({
      kind: 'training', certificateNumber: 'FRA-1A2B-3C4D-5E6F', issuedAt: '2026-10-31T10:00:00.000Z',
      holderName: 'Ada <b>Lovelace</b>', organisationName: 'Analytical &copy; Trust', title: 'Fraud Risk Awareness Workshop',
      quizScore: 100, areasAssessed: null,
    });
    expect(html).toContain('Ada &lt;b&gt;Lovelace&lt;/b&gt;');
    expect(html).toContain('Analytical &amp;copy; Trust');
    expect(html).toContain('31 October 2026');
    expect(html).toContain('FRA-1A2B-3C4D-5E6F');
    expect(html).toContain('quiz score of 100%');
    expect(html).toContain('<svg');
    expect(html).toContain(verifyUrl('FRA-1A2B-3C4D-5E6F').replace(/^https?:\/\//, '').split('?')[0]);
  });

  it('for an assessment, names the organisation and the areas covered, not the risk level', async () => {
    const html = await certificateHtml({
      kind: 'assessment', certificateNumber: 'FRA-AAAA-BBBB-CCCC', issuedAt: '2026-10-31T10:00:00.000Z',
      holderName: 'Northwind Charity', organisationName: 'Northwind Charity', title: 'Q1 assessment',
      quizScore: null, areasAssessed: 13,
    });
    expect(html).toContain('Certificate of Fraud Risk Assessment');
    expect(html).toContain('covering 13 risk areas');
    expect(html).not.toMatch(/high risk|medium risk|low risk/i);
  });
});
