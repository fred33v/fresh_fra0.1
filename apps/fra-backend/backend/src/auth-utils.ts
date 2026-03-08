import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { hasDatabase, jwtSecret } from './helpers.js';
import { refreshSecret, accessTokenExpiry, refreshTokenExpiry } from './types.js';
import type { User } from './types.js';
import { refreshTokenAllowlist } from './stores.js';

/**
 * Issue a pair of access + refresh tokens for the given user.
 * When running without a database the refresh token is added to the
 * in-memory allowlist automatically.
 */
export function issueTokens(user: User) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      organisationId: user.organisationId,
    },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: accessTokenExpiry }
  );

  const refreshToken = jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
      jti: crypto.randomUUID(),
    },
    refreshSecret,
    { algorithm: 'HS256', expiresIn: refreshTokenExpiry }
  );

  if (!hasDatabase()) {
    refreshTokenAllowlist.add(refreshToken);
  }

  return { accessToken, refreshToken };
}

/**
 * Return a safe public-facing subset of a User record (strips passwordHash
 * and other internal fields).
 */
export function publicUser(user: User) {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organisationId: user.organisationId,
    createdAt: user.createdAt,
  };
}
