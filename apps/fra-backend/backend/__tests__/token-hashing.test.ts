/// <reference types="jest" />

import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// (jest.mock is hoisted; factory variables must start with "mock")
const mockQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>>();
jest.mock('../src/db', () => ({ getDbPool: () => ({ query: mockQuery }) }));

import { dbDeleteRefreshToken, dbHasRefreshToken, dbUpsertRefreshToken, hashToken } from '../src/db/tokens';
import { deletePasswordResetToken, getPasswordResetUserId, setPasswordResetToken } from '../src/db/password-reset';
import { passwordResetTokens } from '../src/stores';

const RAW = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.signature';
const HASH = crypto.createHash('sha256').update(RAW).digest('hex');

describe('refresh tokens are stored hashed', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('hashes with SHA-256 (matching migration 025)', () => {
    expect(hashToken(RAW)).toBe(HASH);
  });

  it('never sends the raw token to the database', async () => {
    await dbUpsertRefreshToken(RAW, 'user-1');
    await dbHasRefreshToken(RAW);
    await dbDeleteRefreshToken(RAW);

    for (const [, params] of mockQuery.mock.calls) {
      expect(params).not.toContain(RAW);
      expect(params?.[0]).toBe(HASH);
    }
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });
});

describe('password reset tokens are stored hashed', () => {
  it('keeps only the hash, and still finds the token by its raw value', async () => {
    await setPasswordResetToken(RAW, 'user-1');
    expect(passwordResetTokens.has(RAW)).toBe(false);
    expect(passwordResetTokens.has(HASH)).toBe(true);

    expect(await getPasswordResetUserId(RAW)).toBe('user-1');
    await deletePasswordResetToken(RAW);
    expect(await getPasswordResetUserId(RAW)).toBeNull();
  });
});
