/** Generic API response wrapper containing success status, optional data, error, and pagination metadata. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
  message?: string;
}

/** Options for API requests extending the standard RequestInit. */
export interface ApiRequestOptions extends RequestInit {
  requiresAuth?: boolean;
  timeout?: number;
  retried?: boolean;
}

/** Structured API error with a machine-readable code, human-readable message, and optional details. */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Pagination metadata returned with list endpoints. */
export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

/** Query parameters for paginated API requests, including sort options. */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** An assessment package available for purchase, defining price, key-pass allocation, and features. */
export interface Package {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  keyPassCount: number;
  features: string[];
  isActive: boolean;
}

/** Payment status for a purchase. One of 'pending', 'processing', 'completed', 'failed', or 'refunded'. */
export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

/** A record of a package purchase by an organisation, including payment status and key-pass count. */
export interface Purchase {
  id: string;
  organisationId: string;
  packageId: number;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  stripePaymentId?: string;
  keyPassCount: number;
  createdAt: string;
  completedAt?: string;
}

/** Aggregated dashboard metrics for an organisation, summarising assessments, risk distribution, and key-pass usage. */
export interface DashboardMetrics {
  organisationId: string;
  totalAssessments: number;
  completedAssessments: number;
  averageRiskScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  keyPassesUsed: number;
  keyPassesRemaining: number;
}

/** User-submitted feedback for the platform or a specific assessment, with rating and category. */
export interface Feedback {
  id: string;
  userId: string;
  assessmentId?: string;
  rating: number;
  comment?: string;
  category: 'general' | 'usability' | 'content' | 'technical';
  createdAt: string;
}

/** A digital signature captured for an assessment, including provenance metadata. */
export interface Signature {
  id: string;
  assessmentId: string;
  userId: string;
  signatureUrl: string;
  signedAt: string;
  ipAddress?: string;
  userAgent?: string;
}
