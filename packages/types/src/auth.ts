/** Valid user roles within the Stop FRA platform. One of 'employer', 'employee', or 'admin'. */
export type UserRole = 'employer' | 'employee' | 'admin';

/** Organisation sector classification. One of 'public', 'charity', or 'private'. */
export type OrgSector = 'public' | 'charity' | 'private';

/** Organisation size band based on employee count. One of 'micro' (1-9), 'small' (10-49), 'medium' (50-249), or 'large' (250+). */
export type OrgSize =
  | 'micro'      // 1-9 employees
  | 'small'      // 10-49 employees
  | 'medium'     // 50-249 employees
  | 'large';     // 250+ employees

/** Represents a registered user on the platform with profile and activity metadata. */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  organisationId?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Represents an organisation registered on the platform, including contact and classification details. */
export interface Organisation {
  id: string;
  name: string;
  sector: OrgSector;
  size: OrgSize;
  employeeCount?: number;
  annualTurnover?: number;
  address?: string;
  postcode?: string;
  contactEmail: string;
  contactPhone?: string;
  registrationNumber?: string;
  createdAt: string;
  updatedAt: string;
}

/** A key-pass code that grants access to an assessment, tied to a purchase and organisation. */
export interface KeyPass {
  id: string;
  code: string;
  organisationId: string;
  purchaseId: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: string;
  expiresAt: string;
  createdAt: string;
}

/** Decoded JWT token payload containing user identity, role, and token expiry information. */
export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  organisationId?: string;
  iat: number;
  exp: number;
}

/** Credentials required for email/password authentication. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Credentials required for key-pass based authentication. */
export interface KeyPassLogin {
  code: string;
  email: string;
}

/** Response returned after a successful authentication, containing the user, JWT token, and expiry. */
export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: string;
}
