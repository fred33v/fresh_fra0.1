/// <reference types="jest" />

import app from '../src/index';
import { purchasesById, usersByEmail } from '../src/stores';
import { issueTokens } from '../src/auth-utils';

export { app };

/**
 * Signs up and follows the confirmation link, the way a new user gets their first tokens.
 * Returns the verify-email response, shaped like a login: { user, organisation, accessToken, refreshToken }.
 */
export async function signUpAndConfirm(body: Record<string, unknown>) {
  const signupRes = await app.request('http://localhost/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const signupJson = (await signupRes.json()) as any;
  const res = await app.request('http://localhost/api/v1/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: signupJson.data?.verificationToken }),
  });
  const json = (await res.json()) as any;
  return { signupRes, signupJson, res, json };
}

export async function createAuthenticatedUser(overrides?: { email?: string; name?: string; organisationName?: string }) {
  const email = overrides?.email ?? `test-${crypto.randomUUID()}@example.com`;
  const name = overrides?.name ?? 'Test User';
  const organisationName = overrides?.organisationName ?? 'Test Org';
  const password = 'SecurePass123!';

  const { json: data } = await signUpAndConfirm({ email, password, name, organisationName });
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
export function seedPurchase(organisationId: string, userId: string, packageId = 'pkg_full', createdAt = new Date().toISOString()) {
  const id = crypto.randomUUID();
  purchasesById.set(id, {
    id,
    organisationId,
    userId,
    packageId,
    status: 'succeeded',
    amountCents: 499500,
    currency: 'gbp',
    createdAt,
  });
  return id;
}

/** Sign up a user whose organisation has paid for the given package. */
export async function createPaidUser(
  packageId = 'pkg_full',
  overrides?: { email?: string; name?: string; organisationName?: string }
) {
  const user = await createAuthenticatedUser(overrides);
  seedPurchase(user.organisationId, user.userId, packageId);
  return user;
}

/** In-memory delivery tests use a server-seeded admin, never a client-assigned role. */
export async function createWorkshopAdmin() {
  const account = await createPaidUser();
  const user = usersByEmail.get(account.email)!;
  user.role = 'admin';
  return { ...account, ...issueTokens(user) };
}
