import { describe, it, expect } from 'vitest';
import type {
  UserRole,
  OrgSector,
  OrgSize,
  User,
  Organisation,
  KeyPass,
  AuthTokenPayload,
} from '../auth';

describe('auth types', () => {
  it('UserRole accepts valid values', () => {
    const roles: UserRole[] = ['employer', 'employee', 'admin'];
    expect(roles).toHaveLength(3);
    expect(roles).toContain('employer');
    expect(roles).toContain('employee');
    expect(roles).toContain('admin');
  });

  it('OrgSector accepts valid values', () => {
    const sectors: OrgSector[] = ['public', 'charity', 'private'];
    expect(sectors).toHaveLength(3);
    expect(sectors).toContain('public');
    expect(sectors).toContain('charity');
    expect(sectors).toContain('private');
  });

  it('OrgSize accepts valid values', () => {
    const sizes: OrgSize[] = ['micro', 'small', 'medium', 'large'];
    expect(sizes).toHaveLength(4);
    expect(sizes).toContain('micro');
    expect(sizes).toContain('small');
    expect(sizes).toContain('medium');
    expect(sizes).toContain('large');
  });

  it('User has required fields', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      role: 'employee',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.role).toBeDefined();
    expect(user.isActive).toBeDefined();
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });

  it('User supports optional fields', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      role: 'employer',
      organisationId: 'org-1',
      firstName: 'John',
      lastName: 'Doe',
      jobTitle: 'Manager',
      isActive: true,
      lastLoginAt: '2024-06-01',
      createdAt: '2024-01-01',
      updatedAt: '2024-06-01',
    };
    expect(user.organisationId).toBe('org-1');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.jobTitle).toBe('Manager');
    expect(user.lastLoginAt).toBe('2024-06-01');
  });

  it('Organisation has required fields', () => {
    const org: Organisation = {
      id: 'org-1',
      name: 'Test Org',
      sector: 'private',
      size: 'small',
      contactEmail: 'info@testorg.com',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(org.id).toBeDefined();
    expect(org.name).toBeDefined();
    expect(org.sector).toBeDefined();
    expect(org.size).toBeDefined();
    expect(org.contactEmail).toBeDefined();
    expect(org.createdAt).toBeDefined();
    expect(org.updatedAt).toBeDefined();
  });

  it('KeyPass has required fields', () => {
    const keyPass: KeyPass = {
      id: 'kp-1',
      code: 'ABC123',
      organisationId: 'org-1',
      purchaseId: 'pur-1',
      isUsed: false,
      expiresAt: '2025-01-01',
      createdAt: '2024-01-01',
    };
    expect(keyPass.id).toBeDefined();
    expect(keyPass.code).toBeDefined();
    expect(keyPass.organisationId).toBeDefined();
    expect(keyPass.purchaseId).toBeDefined();
    expect(keyPass.isUsed).toBe(false);
    expect(keyPass.expiresAt).toBeDefined();
    expect(keyPass.createdAt).toBeDefined();
  });

  it('AuthTokenPayload has required fields', () => {
    const payload: AuthTokenPayload = {
      userId: 'user-1',
      email: 'test@example.com',
      role: 'admin',
      iat: 1700000000,
      exp: 1700003600,
    };
    expect(payload.userId).toBeDefined();
    expect(payload.email).toBeDefined();
    expect(payload.role).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });
});
