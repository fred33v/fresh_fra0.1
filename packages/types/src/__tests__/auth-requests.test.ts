import { describe, it, expect } from 'vitest';
import type {
  LoginCredentials,
  KeyPassLogin,
  AuthResponse,
  SignupRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  RefreshTokenRequest,
  LogoutRequest,
} from '../auth';

describe('Authentication Types', () => {
  describe('LoginCredentials', () => {
    it('requires email and password', () => {
      const creds: LoginCredentials = {
        email: 'john@example.com',
        password: 'SecurePass123!',
      };

      expect(creds.email).toBeDefined();
      expect(creds.password).toBeDefined();
      expect(creds.email).toMatch(/@/);
    });
  });

  describe('KeyPassLogin', () => {
    it('requires code and email for key-pass authentication', () => {
      const login: KeyPassLogin = {
        code: 'FRA-TIMESTAMP-RANDOM8',
        email: 'employee@company.com',
      };

      expect(login.code).toBeDefined();
      expect(login.email).toBeDefined();
    });
  });

  describe('AuthResponse', () => {
    it('returns user info with JWT token', () => {
      const response: AuthResponse = {
        user: {
          id: 'user-123',
          email: 'john@example.com',
          role: 'employer',
          organisationId: 'org-123',
          firstName: 'John',
          lastName: 'Doe',
          jobTitle: 'Risk Manager',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-03-08T00:00:00Z',
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresAt: '2026-03-08T08:00:00Z',
      };

      expect(response.token).toBeDefined();
      expect(response.expiresAt).toBeDefined();
      expect(response.user.email).toBe('john@example.com');
    });
  });

  describe('SignupRequest', () => {
    it('requires basic user information', () => {
      const signup: SignupRequest = {
        email: 'newuser@company.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      expect(signup.email).toBeDefined();
      expect(signup.password).toBeDefined();
      expect(signup.firstName).toBeDefined();
      expect(signup.lastName).toBeDefined();
    });

    it('accepts optional organisation information', () => {
      const signup: SignupRequest = {
        email: 'newuser@company.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Smith',
        organisationName: 'Acme Corp',
        organisationSector: 'private',
        organisationSize: 'large',
        jobTitle: 'Compliance Officer',
      };

      expect(signup.organisationName).toBeDefined();
      expect(['public', 'charity', 'private']).toContain(signup.organisationSector);
    });
  });

  describe('PasswordResetRequest', () => {
    it('requires email address', () => {
      const request: PasswordResetRequest = {
        email: 'john@example.com',
      };

      expect(request.email).toBeDefined();
    });
  });

  describe('PasswordResetConfirm', () => {
    it('requires token and new password', () => {
      const confirm: PasswordResetConfirm = {
        token: 'reset-token-xyz',
        newPassword: 'NewSecurePass456!',
      };

      expect(confirm.token).toBeDefined();
      expect(confirm.newPassword).toBeDefined();
    });
  });

  describe('RefreshTokenRequest', () => {
    it('requires refresh token', () => {
      const request: RefreshTokenRequest = {
        refreshToken: 'refresh-token-abc123',
      };

      expect(request.refreshToken).toBeDefined();
    });
  });

  describe('LogoutRequest', () => {
    it('optionally includes refresh token', () => {
      const logout1: LogoutRequest = {
        refreshToken: 'refresh-token-abc123',
      };

      const logout2: LogoutRequest = {};

      expect(logout1.refreshToken).toBeDefined();
      expect(logout2).toBeDefined(); // Can be empty
    });
  });
});
