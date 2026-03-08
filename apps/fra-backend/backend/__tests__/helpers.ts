/// <reference types="jest" />

import app from '../src/index';
import { purchasesById } from '../src/stores';

export { app };

export async function createAuthenticatedUser(overrides?: { email?: string; name?: string; organisationName?: string }) {
  const email = overrides?.email ?? `test-${crypto.randomUUID()}@example.com`;
  const name = overrides?.name ?? 'Test User';
  const organisationName = overrides?.organisationName ?? 'Test Org';
  const password = 'SecurePass123!';

  const res = await app.request('http://localhost/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, organisationName }),
  });

  const data = (await res.json()) as any;
  return {
    accessToken: data.data.accessToken as string,
    refreshToken: data.data.refreshToken as string,
    userId: data.data.user.userId as string,
    organisationId: data.data.organisation.organisationId as string,
    email,
  };
}

export function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** Seed a succeeded purchase in the in-memory store so keypass quota checks pass. */
export function seedPurchase(organisationId: string, userId: string, packageId = 'pkg_full') {
  const id = crypto.randomUUID();
  purchasesById.set(id, {
    id,
    organisationId,
    userId,
    packageId,
    status: 'succeeded',
    amountCents: 499500,
    currency: 'gbp',
    createdAt: new Date().toISOString(),
  });
}
