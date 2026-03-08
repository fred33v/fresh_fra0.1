# Backend Architecture Strategy Template
## Stop FRA Platform - Backend Development Guide

**Version:** 1.0
**Last Updated:** December 20, 2025
**Target Audience:** Backend Architect Agents, Backend Developers, DevOps Engineers

---

## Table of Contents

1. [Architecture Philosophy](#architecture-philosophy)
2. [System Design Principles](#system-design-principles)
3. [Technology Stack Decisions](#technology-stack-decisions)
4. [Database Architecture](#database-architecture)
5. [API Design Standards](#api-design-standards)
6. [Security Architecture](#security-architecture)
7. [Scalability Strategy](#scalability-strategy)
8. [Integration Patterns](#integration-patterns)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Architecture](#deployment-architecture)
11. [Monitoring & Observability](#monitoring-observability)
12. [Decision Framework](#decision-framework)

---

## Architecture Philosophy

### Core Principles

**1. Compliance-First Design**
- Every architectural decision must consider GovS-013, ECCTA 2023, and failure-to-prevent fraud regulations
- Audit trails are mandatory, not optional
- Data retention policies built into core architecture
- Regulatory reporting capabilities designed upfront

**2. Security by Design**
- Zero-trust architecture
- Defense in depth strategy
- Principle of least privilege
- Encryption at rest and in transit
- Regular security audits built into development cycle

**3. Scalability & Performance**
- Design for 10x current scale
- Horizontal scaling preferred over vertical
- Asynchronous processing for heavy workloads
- Caching strategy for read-heavy operations
- Database query optimization mandatory

**4. Maintainability & Developer Experience**
- Clean, self-documenting code
- Comprehensive API documentation
- Automated testing coverage >80%
- Clear separation of concerns
- Consistent naming conventions

**5. Cost Optimization**
- Right-size infrastructure resources
- Serverless for variable workloads
- Efficient database query patterns
- CDN for static assets
- Auto-scaling policies

---

## System Design Principles

### Microservices vs Monolith Decision Matrix

**Current Decision: Modular Monolith → Gradual Microservices Migration**

**Phase 1 (Current):** Modular Monolith
- Single deployable unit
- Clear module boundaries
- Shared database with logical separation
- Faster initial development
- Lower operational complexity

**Phase 2 (Future):** Extract High-Load Services
- Payment processing → Independent service
- Report generation → Independent service
- Dashboard analytics → Independent service
- Keep core assessment flow in monolith

### Module Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway Layer                     │
│              (Rate Limiting, Auth, Routing)              │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Auth Module  │   │ Assessment   │   │  Payment     │
│              │   │   Module     │   │   Module     │
│ - JWT        │   │ - Questions  │   │ - Stripe     │
│ - Sessions   │   │ - Risk Score │   │ - Invoicing  │
│ - RBAC       │   │ - Reports    │   │ - Packages   │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                  ┌──────────────────┐
                  │  Database Layer  │
                  │   (PostgreSQL)   │
                  └──────────────────┘
```

### Data Flow Architecture

```
Mobile App → API Gateway → Application Server → Database
                ↓
           Auth Service
                ↓
        Rate Limiter/WAF
                ↓
          Load Balancer
```

**Asynchronous Processing Flow:**
```
API Request → Queue (Redis/RabbitMQ) → Background Worker → Process
                                              ↓
                                         S3 Storage
                                              ↓
                                      Email Notification
```

---

## Technology Stack Decisions

### Core Backend Technologies

#### Application Server
**Selected: Node.js with Express/Fastify**

**Rationale:**
- ✅ Shared language with frontend (TypeScript)
- ✅ Rich ecosystem for rapid development
- ✅ Excellent async I/O performance
- ✅ Strong community support
- ✅ Easy integration with n8n workflows

**Alternative Considered:** Python (Django/FastAPI)
- ❌ Language context switching
- ✅ Better for data science workloads
- Decision: Node.js wins for full-stack consistency

**Tech Stack:**
```
Framework: Fastify (performance) or Express (ecosystem)
Language: TypeScript 5.x
Runtime: Node.js 20.x LTS
Package Manager: Bun (development), npm (production)
```

#### Database
**Selected: PostgreSQL 15+**

**Rationale:**
- ✅ ACID compliance for financial data
- ✅ JSON/JSONB support for flexible schemas
- ✅ Excellent performance with proper indexing
- ✅ Strong data integrity guarantees
- ✅ Mature ecosystem and tooling
- ✅ Row-level security for multi-tenancy

**Schema Strategy:**
- Strongly typed core tables (users, organisations, assessments)
- JSONB for flexible questionnaire responses
- Materialized views for dashboard analytics
- Partitioning for large tables (audit_logs, employee_assessments)

#### Caching Layer
**Selected: Redis 7+**

**Use Cases:**
- Session storage (JWT blacklist)
- Rate limiting counters
- Cached dashboard metrics
- Job queue (BullMQ)
- Real-time analytics aggregation

**Cache Strategy:**
```typescript
// Cache invalidation patterns
- Package data: Cache-aside, TTL 24h
- Organisation data: Write-through, TTL 1h
- Assessment data: Cache-aside, invalidate on update
- Dashboard metrics: Lazy load, TTL 5min
```

#### Message Queue
**Selected: BullMQ (Redis-based) for Phase 1, RabbitMQ for Phase 2**

**Queues:**
```typescript
queues = {
  'assessment-scoring': { priority: 'high', concurrency: 5 },
  'report-generation': { priority: 'medium', concurrency: 3 },
  'email-notifications': { priority: 'low', concurrency: 10 },
  'keypass-generation': { priority: 'medium', concurrency: 5 },
  'analytics-aggregation': { priority: 'low', concurrency: 2 }
}
```

#### File Storage
**Selected: AWS S3 (or compatible)**

**Bucket Structure:**
```
fra-production/
├── signatures/{org_id}/{assessment_id}/{timestamp}.png
├── reports/{org_id}/{assessment_id}/FRA-{version}.pdf
├── reports/{org_id}/{assessment_id}/FRA-{version}.html
├── intake-archives/{org_id}/{timestamp}.json
└── exports/{org_id}/dashboard-{timestamp}.csv
```

**Access Patterns:**
- Signatures: Private, signed URLs, 24h expiry
- Reports: Private, signed URLs, 7-day expiry
- Exports: Private, signed URLs, 1h expiry

#### Authentication & Authorization
**Selected: JWT with Refresh Tokens**

**Token Strategy:**
```typescript
AccessToken: {
  algorithm: 'RS256',
  expiry: '15m',
  payload: { user_id, org_id, role, permissions }
}

RefreshToken: {
  algorithm: 'RS256',
  expiry: '7d',
  storage: 'Redis with rotation',
  family_tracking: true // Detect token theft
}
```

**RBAC Model:**
```typescript
roles = {
  'admin': ['*'],
  'employer': [
    'assessment:create',
    'assessment:read:own',
    'assessment:update:own',
    'keypass:generate',
    'keypass:read:own',
    'dashboard:read:own',
    'organisation:update:own'
  ],
  'employee': [
    'assessment:create:own',
    'assessment:read:own',
    'assessment:update:own'
  ]
}
```

#### Payment Processing
**Selected: Stripe**

**Integration Pattern:**
```
Client → Create PaymentIntent → Stripe → Webhook → Fulfill Order
                                              ↓
                                      Update Database
                                              ↓
                                    Generate Key-Passes
                                              ↓
                                     Send Confirmation
```

**Webhook Security:**
- Verify Stripe signature
- Idempotency key handling
- Retry logic with exponential backoff
- Dead letter queue for failed webhooks

---

## Database Architecture

### Schema Design Strategy

#### Core Tables (Strongly Typed)

**Users Table:**
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('employer', 'employee', 'admin')),
  organisation_id UUID REFERENCES organisations(organisation_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,

  -- Indexes
  CONSTRAINT users_email_lowercase CHECK (email = LOWER(email))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organisation ON users(organisation_id);
CREATE INDEX idx_users_role ON users(role);
```

**Organisations Table:**
```sql
CREATE TABLE organisations (
  organisation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('charity', 'public-sector', 'private-sme', 'large-corporate')),
  employee_band VARCHAR(20) NOT NULL CHECK (employee_band IN ('1-10', '11-50', '51-100', '101-250', '251-1000', '1001+')),
  size VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN employee_band IN ('1-10', '11-50') THEN 'small'
      WHEN employee_band IN ('51-100', '101-250') THEN 'medium'
      ELSE 'large'
    END
  ) STORED,
  package_type VARCHAR(30) CHECK (package_type IN ('health-check', 'with-awareness', 'with-dashboard')),
  keypasses_allocated INT DEFAULT 0,
  keypasses_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Business constraints
  CONSTRAINT keypasses_valid CHECK (keypasses_used <= keypasses_allocated)
);

CREATE INDEX idx_organisations_name ON organisations(name);
CREATE INDEX idx_organisations_package ON organisations(package_type);
```

**Assessments Table:**
```sql
CREATE TABLE assessments (
  assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(organisation_id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'paid', 'signed')),
  overall_risk_level VARCHAR(10) CHECK (overall_risk_level IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,

  -- Audit fields
  version INT DEFAULT 1,
  methodology_version VARCHAR(20) DEFAULT 'v1.0'
);

CREATE INDEX idx_assessments_organisation ON assessments(organisation_id);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_assessments_created ON assessments(created_at DESC);
CREATE INDEX idx_assessments_composite ON assessments(organisation_id, status, created_at DESC);
```

**Assessment Answers (Flexible Schema):**
```sql
CREATE TABLE assessment_answers (
  answer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
  section VARCHAR(50) NOT NULL,
  question_key VARCHAR(100) NOT NULL,
  answer_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one answer per question per assessment
  CONSTRAINT unique_assessment_question UNIQUE (assessment_id, section, question_key)
);

CREATE INDEX idx_answers_assessment ON assessment_answers(assessment_id);
CREATE INDEX idx_answers_section ON assessment_answers(assessment_id, section);
CREATE INDEX idx_answers_jsonb ON assessment_answers USING GIN (answer_value);
```

**Risk Register Items:**
```sql
CREATE TABLE risk_register_items (
  risk_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
  risk_id_code VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  area VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  inherent_impact INT NOT NULL CHECK (inherent_impact BETWEEN 1 AND 5),
  inherent_likelihood INT NOT NULL CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_score INT GENERATED ALWAYS AS (inherent_impact * inherent_likelihood) STORED,
  control_strength VARCHAR(20) CHECK (control_strength IN ('very-strong', 'reasonably-strong', 'weak', 'gaps')),
  residual_score INT NOT NULL,
  priority VARCHAR(10) GENERATED ALWAYS AS (
    CASE
      WHEN residual_score >= 15 THEN 'high'
      WHEN residual_score >= 8 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  suggested_owner VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_items_assessment ON risk_register_items(assessment_id);
CREATE INDEX idx_risk_items_priority ON risk_register_items(priority);
CREATE INDEX idx_risk_items_composite ON risk_register_items(assessment_id, priority, residual_score DESC);
```

**Key-Passes:**
```sql
CREATE TABLE keypasses (
  keypass_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(organisation_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired')),
  used_by_user_id UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Business rules
  CONSTRAINT keypass_used_logic CHECK (
    (status = 'used' AND used_by_user_id IS NOT NULL AND used_at IS NOT NULL) OR
    (status != 'used' AND used_by_user_id IS NULL AND used_at IS NULL)
  )
);

CREATE UNIQUE INDEX idx_keypasses_code ON keypasses(code);
CREATE INDEX idx_keypasses_organisation ON keypasses(organisation_id);
CREATE INDEX idx_keypasses_status ON keypasses(organisation_id, status);
```

**Purchases:**
```sql
CREATE TABLE purchases (
  purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(organisation_id),
  assessment_id UUID REFERENCES assessments(assessment_id),
  package_id UUID NOT NULL REFERENCES packages(package_id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GBP',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  transaction_reference VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Idempotency
  idempotency_key VARCHAR(255) UNIQUE
);

CREATE INDEX idx_purchases_organisation ON purchases(organisation_id);
CREATE INDEX idx_purchases_assessment ON purchases(assessment_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_stripe_intent ON purchases(stripe_payment_intent_id);
```

### Database Performance Optimization

**Query Patterns:**
```sql
-- Materialized view for dashboard metrics
CREATE MATERIALIZED VIEW org_dashboard_metrics AS
SELECT
  o.organisation_id,
  o.name,
  COUNT(DISTINCT a.assessment_id) as total_assessments,
  COUNT(DISTINCT CASE WHEN a.status = 'signed' THEN a.assessment_id END) as completed_assessments,
  o.keypasses_allocated,
  o.keypasses_used,
  o.keypasses_allocated - o.keypasses_used as keypasses_remaining,
  COUNT(DISTINCT ea.employee_assessment_id) as employee_assessments,
  AVG(CASE WHEN a.overall_risk_level = 'high' THEN 3
           WHEN a.overall_risk_level = 'medium' THEN 2
           ELSE 1 END) as avg_risk_score
FROM organisations o
LEFT JOIN assessments a ON o.organisation_id = a.organisation_id
LEFT JOIN employee_assessments ea ON o.organisation_id = ea.organisation_id
GROUP BY o.organisation_id, o.name, o.keypasses_allocated, o.keypasses_used;

CREATE UNIQUE INDEX idx_dashboard_org ON org_dashboard_metrics(organisation_id);

-- Refresh strategy: Every 5 minutes via cron job
```

**Partitioning Strategy:**
```sql
-- Partition audit logs by month
CREATE TABLE audit_logs (
  log_id BIGSERIAL,
  user_id UUID,
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- Create partitions for each month
```

---

## API Design Standards

### RESTful API Conventions

**Base URL Structure:**
```
Production: https://api.stopfra.com/v1
Staging:    https://api-staging.stopfra.com/v1
Development: http://localhost:3000/api/v1
```

**Resource Naming:**
```
✅ Good:
GET    /api/v1/assessments
POST   /api/v1/assessments
GET    /api/v1/assessments/:id
PATCH  /api/v1/assessments/:id
DELETE /api/v1/assessments/:id

❌ Bad:
GET    /api/v1/getAssessments
POST   /api/v1/create-assessment
GET    /api/v1/assessment/:id
```

**HTTP Method Usage:**
```
GET    - Retrieve resources (idempotent, cacheable)
POST   - Create new resources (not idempotent)
PUT    - Full resource replacement (idempotent)
PATCH  - Partial resource update (idempotent)
DELETE - Remove resources (idempotent)
```

### Request/Response Format

**Standard Request:**
```typescript
// Headers
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Request-ID: <uuid>
X-Idempotency-Key: <uuid> // For POST/PATCH requests

// Body
{
  "data": {
    // Request payload
  },
  "meta": {
    "client_version": "1.0.0",
    "device_id": "optional"
  }
}
```

**Standard Response:**
```typescript
// Success (200, 201)
{
  "success": true,
  "data": {
    // Response payload
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2025-12-20T10:30:00Z"
  }
}

// Success with Pagination (200)
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "pages": 4,
    "has_next": true,
    "has_prev": false
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2025-12-20T10:30:00Z"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email format is invalid"
      }
    ]
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2025-12-20T10:30:00Z"
  }
}
```

**Error Codes:**
```typescript
errorCodes = {
  // Client errors (4xx)
  'VALIDATION_ERROR': 400,
  'UNAUTHORIZED': 401,
  'FORBIDDEN': 403,
  'NOT_FOUND': 404,
  'CONFLICT': 409,
  'RATE_LIMIT_EXCEEDED': 429,

  // Server errors (5xx)
  'INTERNAL_ERROR': 500,
  'SERVICE_UNAVAILABLE': 503,
  'GATEWAY_TIMEOUT': 504,

  // Business logic errors (422)
  'KEYPASS_ALREADY_USED': 422,
  'INSUFFICIENT_KEYPASSES': 422,
  'ASSESSMENT_ALREADY_SUBMITTED': 422,
  'PAYMENT_FAILED': 422
}
```

### API Versioning Strategy

**Approach: URL-based versioning**
```
/v1/assessments  (Current)
/v2/assessments  (Future)
```

**Deprecation Policy:**
- New version announced 3 months in advance
- Old version supported for 6 months after new version release
- Deprecation warnings in response headers:
  ```
  Deprecation: true
  Sunset: Wed, 20 Jun 2026 23:59:59 GMT
  Link: <https://api.stopfra.com/v2/assessments>; rel="successor-version"
  ```

### Rate Limiting

**Strategy:**
```typescript
rateLimits = {
  'anonymous': {
    window: '15min',
    max_requests: 100
  },
  'authenticated': {
    window: '15min',
    max_requests: 1000
  },
  'premium': {
    window: '15min',
    max_requests: 5000
  }
}

// Response Headers
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1703080800
```

**Rate Limit Algorithm:** Token Bucket with Redis

---

## Security Architecture

### Authentication Flow

```
┌─────────┐                                  ┌──────────┐
│ Client  │                                  │  Server  │
└────┬────┘                                  └────┬─────┘
     │                                            │
     │  POST /auth/login                          │
     │  {email, password}                         │
     ├───────────────────────────────────────────>│
     │                                            │
     │                              Validate credentials
     │                              Generate access_token (15m)
     │                              Generate refresh_token (7d)
     │                              Store refresh_token in Redis
     │                                            │
     │  {access_token, refresh_token}             │
     │<───────────────────────────────────────────┤
     │                                            │
     │  Subsequent API requests                   │
     │  Authorization: Bearer access_token        │
     ├───────────────────────────────────────────>│
     │                                            │
     │                              Verify JWT signature
     │                              Check token expiry
     │                              Extract user_id, org_id, role
     │                                            │
     │  Response with data                        │
     │<───────────────────────────────────────────┤
     │                                            │
     │  When access_token expires:                │
     │  POST /auth/refresh                        │
     │  {refresh_token}                           │
     ├───────────────────────────────────────────>│
     │                                            │
     │                              Validate refresh_token
     │                              Check Redis for validity
     │                              Generate new access_token
     │                              Rotate refresh_token (optional)
     │                                            │
     │  {new_access_token, new_refresh_token}     │
     │<───────────────────────────────────────────┤
```

### Password Security

**Hashing Algorithm: Argon2id**
```typescript
import argon2 from 'argon2';

const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,        // 3 iterations
    parallelism: 4      // 4 threads
  });
};

const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  return await argon2.verify(hash, password);
};
```

**Password Policy:**
- Minimum 12 characters
- At least one uppercase, lowercase, number, special character
- No common passwords (check against breach database)
- Password history: prevent reuse of last 5 passwords
- Account lockout: 5 failed attempts → 15 min lockout

### Authorization Model

**Row-Level Security (RLS):**
```sql
-- Example: Users can only access their organisation's data
CREATE POLICY organisation_isolation ON assessments
  FOR ALL
  TO authenticated_user
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM users
      WHERE user_id = current_user_id()
    )
  );
```

**Middleware Authorization:**
```typescript
// Permission-based middleware
const requirePermission = (permission: string) => {
  return async (req, res, next) => {
    const { role, permissions } = req.user;

    if (role === 'admin' || permissions.includes(permission)) {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
  };
};

// Usage
router.get('/dashboard/:orgId',
  authenticate,
  requirePermission('dashboard:read:own'),
  getDashboard
);
```

### Data Encryption

**Encryption at Rest:**
- Database: PostgreSQL TDE (Transparent Data Encryption)
- File Storage: S3 server-side encryption (SSE-S3 or SSE-KMS)
- Sensitive fields: Application-level encryption for PII

**Encryption in Transit:**
- TLS 1.3 for all HTTP traffic
- Certificate pinning for mobile app
- HSTS headers enforced

**Field-Level Encryption:**
```typescript
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

const decrypt = (encryptedText: string): string => {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};
```

### Input Validation & Sanitization

**Validation Library: Zod**
```typescript
import { z } from 'zod';

// Schema definitions
const CreateAssessmentSchema = z.object({
  organisationId: z.string().uuid(),
  answers: z.record(z.string(), z.any()).optional()
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional()
});

// Usage in route handler
const createAssessment = async (req, res) => {
  try {
    const validated = CreateAssessmentSchema.parse(req.body);
    // Proceed with validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors
        }
      });
    }
  }
};
```

**SQL Injection Prevention:**
- Always use parameterized queries
- Never concatenate user input into SQL
- Use ORM query builders (TypeORM, Prisma)

```typescript
// ✅ Good
const user = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ❌ Bad
const user = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

**XSS Prevention:**
- Sanitize all user input
- Content Security Policy (CSP) headers
- HTML entity encoding for output

### Audit Logging

**What to Log:**
```typescript
auditEvents = {
  // Authentication
  'user.login': { level: 'info', retention: '6 years' },
  'user.logout': { level: 'info', retention: '6 years' },
  'user.password_changed': { level: 'warning', retention: '6 years' },
  'user.failed_login': { level: 'warning', retention: '6 years' },

  // Data access
  'assessment.created': { level: 'info', retention: '6 years' },
  'assessment.updated': { level: 'info', retention: '6 years' },
  'assessment.submitted': { level: 'info', retention: '6 years' },
  'assessment.signed': { level: 'info', retention: '6 years' },
  'dashboard.accessed': { level: 'info', retention: '6 years' },

  // Payment
  'purchase.created': { level: 'info', retention: '6 years' },
  'purchase.completed': { level: 'info', retention: '6 years' },
  'purchase.failed': { level: 'warning', retention: '6 years' },

  // Security
  'keypass.generated': { level: 'info', retention: '6 years' },
  'keypass.used': { level: 'info', retention: '6 years' },
  'unauthorized_access': { level: 'error', retention: '6 years' }
}
```

**Audit Log Schema:**
```sql
CREATE TABLE audit_logs (
  log_id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(user_id),
  organisation_id UUID REFERENCES organisations(organisation_id),
  resource_type VARCHAR(50),
  resource_id UUID,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  request_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_org ON audit_logs(organisation_id, created_at DESC);
CREATE INDEX idx_audit_event ON audit_logs(event_type, created_at DESC);
```

---

## Scalability Strategy

### Horizontal Scaling Architecture

```
                     ┌─────────────┐
                     │   Route 53  │
                     │   (DNS)     │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │ CloudFront  │
                     │   (CDN)     │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │     ALB     │
                     │ (Load       │
                     │  Balancer)  │
                     └──────┬──────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  App Server   │   │  App Server   │   │  App Server   │
│   Instance 1  │   │   Instance 2  │   │   Instance N  │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Redis      │   │   PostgreSQL  │   │      S3       │
│   (Cache)     │   │   (Primary)   │   │   (Files)     │
│               │   │       +       │   │               │
│               │   │   Read        │   │               │
│               │   │   Replicas    │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Database Scaling

**Read Replicas:**
```typescript
// Database connection configuration
const dbConfig = {
  primary: {
    host: process.env.DB_PRIMARY_HOST,
    port: 5432,
    // Used for writes and critical reads
  },
  replicas: [
    {
      host: process.env.DB_REPLICA_1_HOST,
      port: 5432,
      // Used for dashboard queries, reports
    },
    {
      host: process.env.DB_REPLICA_2_HOST,
      port: 5432,
      // Used for analytics, exports
    }
  ]
};

// Smart query routing
const readQuery = async (sql, params) => {
  const replica = selectRandomReplica();
  return await replica.query(sql, params);
};

const writeQuery = async (sql, params) => {
  return await primary.query(sql, params);
};
```

**Connection Pooling:**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,          // Maximum pool size
  min: 5,           // Minimum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching Strategy

**Multi-Layer Caching:**
```
┌──────────────────────────────────────────────────┐
│  Layer 1: Application Memory (Node.js LRU Cache) │
│  - Size: 100MB                                   │
│  - TTL: 60 seconds                               │
│  - Use: Frequently accessed small data          │
└──────────────────────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────┐
│  Layer 2: Redis (Distributed Cache)             │
│  - Size: 10GB                                    │
│  - TTL: Varies by data type                      │
│  - Use: Session data, dashboard metrics          │
└──────────────────────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────┐
│  Layer 3: PostgreSQL (Database)                  │
│  - Source of truth                               │
│  - Materialized views for complex queries        │
└──────────────────────────────────────────────────┘
```

**Cache Invalidation:**
```typescript
// Event-driven cache invalidation
eventBus.on('assessment.updated', async (assessmentId, orgId) => {
  await Promise.all([
    cache.del(`assessment:${assessmentId}`),
    cache.del(`org:${orgId}:assessments`),
    cache.del(`dashboard:${orgId}`)
  ]);
});

// TTL-based expiration
await cache.set('dashboard:metrics', data, 'EX', 300); // 5 min TTL

// Stale-while-revalidate pattern
const getCachedData = async (key, fetchFn, ttl) => {
  let data = await cache.get(key);

  if (!data) {
    data = await fetchFn();
    await cache.set(key, JSON.stringify(data), 'EX', ttl);
  }

  return JSON.parse(data);
};
```

### Load Balancing Strategy

**Algorithm: Least Connections**
- Distributes traffic to server with fewest active connections
- Better for long-lived connections (WebSockets, SSE)

**Health Checks:**
```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database
    await db.query('SELECT 1');

    // Check Redis
    await redis.ping();

    // Check disk space
    const diskSpace = await checkDiskSpace('/');

    if (diskSpace.free < 1e9) { // Less than 1GB
      throw new Error('Low disk space');
    }

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### Auto-Scaling Rules

```yaml
# Auto-scaling configuration
autoscaling:
  min_instances: 2
  max_instances: 10
  target_cpu_utilization: 70%
  target_memory_utilization: 80%

  scale_up:
    - metric: cpu_utilization
      threshold: 80%
      duration: 5 minutes
      action: add 2 instances

    - metric: request_rate
      threshold: 1000 req/sec
      duration: 3 minutes
      action: add 1 instance

  scale_down:
    - metric: cpu_utilization
      threshold: 30%
      duration: 15 minutes
      action: remove 1 instance
```

---

## Integration Patterns

### n8n Workflow Integration

**Architecture:**
```
Mobile App → API Server → Event Bus → n8n Webhook
                              ↓
                        Database Update
                              ↓
                      n8n Workflow Triggered
                              ↓
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              S3 Upload   Email   Analytics DB
```

**Event Publishing:**
```typescript
import EventEmitter from 'events';

class FRAEventBus extends EventEmitter {
  async publishAssessmentSubmitted(assessment) {
    const event = {
      type: 'assessment.submitted',
      timestamp: new Date().toISOString(),
      data: {
        assessment_id: assessment.id,
        organisation_id: assessment.organisation_id,
        priority_score: assessment.priority_score
      }
    };

    // Emit to internal listeners
    this.emit('assessment.submitted', event.data);

    // Send to n8n webhook
    await axios.post(process.env.N8N_WEBHOOK_URL, event);

    // Log to audit trail
    await auditLog.create(event);
  }
}

export const eventBus = new FRAEventBus();
```

**Webhook Security:**
```typescript
import crypto from 'crypto';

const verifyWebhookSignature = (payload, signature, secret) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

// Webhook endpoint
app.post('/webhooks/n8n', async (req, res) => {
  const signature = req.headers['x-n8n-signature'];

  if (!verifyWebhookSignature(req.body, signature, process.env.N8N_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook
  await handleN8nWebhook(req.body);

  res.status(200).json({ received: true });
});
```

### Stripe Payment Integration

**Payment Flow:**
```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create payment intent
const createPaymentIntent = async (organisationId, packageId) => {
  const package = await db.query(
    'SELECT * FROM packages WHERE package_id = $1',
    [packageId]
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount: package.price * 100, // Convert to pence
    currency: 'gbp',
    metadata: {
      organisation_id: organisationId,
      package_id: packageId
    },
    automatic_payment_methods: {
      enabled: true
    }
  });

  return paymentIntent;
};

// Webhook handler
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
  }

  res.json({ received: true });
});

const handlePaymentSuccess = async (paymentIntent) => {
  const { organisation_id, package_id } = paymentIntent.metadata;

  // Update purchase record
  await db.query(
    'UPDATE purchases SET status = $1, updated_at = NOW() WHERE stripe_payment_intent_id = $2',
    ['success', paymentIntent.id]
  );

  // Allocate key-passes
  await allocateKeyPasses(organisation_id, package_id);

  // Send confirmation email
  await sendPaymentConfirmation(organisation_id);
};
```

### Email Service Integration

**Provider: SendGrid or AWS SES**

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, template, data) => {
  const msg = {
    to,
    from: 'noreply@stopfra.com',
    templateId: template,
    dynamicTemplateData: data
  };

  try {
    await sgMail.send(msg);
    await logEmailSent(to, template);
  } catch (error) {
    await logEmailFailed(to, template, error);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  WELCOME: 'd-xxx',
  PAYMENT_CONFIRMATION: 'd-yyy',
  KEYPASS_GENERATED: 'd-zzz',
  ASSESSMENT_COMPLETE: 'd-aaa'
};
```

---

## Testing Strategy

### Testing Pyramid

```
                  ┌─────────────┐
                  │     E2E     │  (10% - Critical user flows)
                  │   Tests     │
                  └─────────────┘
             ┌────────────────────────┐
             │  Integration Tests     │  (30% - API + DB)
             └────────────────────────┘
        ┌──────────────────────────────────┐
        │         Unit Tests               │  (60% - Business logic)
        └──────────────────────────────────┘
```

### Unit Tests

**Framework: Jest**

```typescript
// Example: Risk scoring logic test
describe('RiskScoringEngine', () => {
  describe('calculateInherentScore', () => {
    it('should calculate inherent score correctly', () => {
      const impact = 5;
      const likelihood = 4;
      const score = calculateInherentScore(impact, likelihood);
      expect(score).toBe(20);
    });

    it('should enforce bounds', () => {
      expect(() => calculateInherentScore(6, 3)).toThrow('Impact must be 1-5');
    });
  });

  describe('calculateResidualScore', () => {
    it('should apply very-strong control reduction', () => {
      const inherentScore = 20;
      const controlStrength = 'very-strong';
      const residualScore = calculateResidualScore(inherentScore, controlStrength);
      expect(residualScore).toBe(12); // 40% reduction
    });
  });

  describe('determinePriority', () => {
    it('should classify high priority correctly', () => {
      expect(determinePriority(20)).toBe('high');
      expect(determinePriority(15)).toBe('high');
    });

    it('should classify medium priority correctly', () => {
      expect(determinePriority(14)).toBe('medium');
      expect(determinePriority(8)).toBe('medium');
    });

    it('should classify low priority correctly', () => {
      expect(determinePriority(7)).toBe('low');
      expect(determinePriority(1)).toBe('low');
    });
  });
});
```

### Integration Tests

**Framework: Supertest + Jest**

```typescript
import request from 'supertest';
import app from '../app';
import { setupTestDatabase, teardownTestDatabase } from '../test/helpers';

describe('Assessment API', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('POST /api/v1/assessments', () => {
    it('should create new assessment', async () => {
      const token = await getTestToken();

      const response = await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          organisationId: 'test-org-id'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assessment_id).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/assessments')
        .send({
          organisationId: 'test-org-id'
        })
        .expect(401);
    });

    it('should validate organisationId', async () => {
      const token = await getTestToken();

      const response = await request(app)
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          organisationId: 'invalid-uuid'
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### E2E Tests

**Framework: Playwright**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Assessment Flow', () => {
  test('complete assessment end-to-end', async ({ page }) => {
    // Login
    await page.goto('https://app.stopfra.com/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Create assessment
    await page.click('text=New Assessment');
    await expect(page).toHaveURL(/.*\/risk-appetite/);

    // Fill risk appetite
    await page.selectOption('[name="risk_appetite"]', 'medium');
    await page.click('text=Continue');

    // ... Continue through all modules

    // Submit assessment
    await page.click('text=Submit Assessment');

    // Verify completion
    await expect(page.locator('text=Assessment Complete')).toBeVisible();
  });
});
```

### Test Coverage Requirements

```
Minimum Coverage Thresholds:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

Critical Components (90%+ coverage required):
- Authentication & authorization
- Payment processing
- Risk scoring engine
- Key-pass generation
- Data validation
```

---

## Deployment Architecture

### Environment Strategy

```yaml
environments:
  development:
    domain: localhost:3000
    database: fra_dev
    cache: redis_dev
    s3_bucket: fra-dev

  staging:
    domain: api-staging.stopfra.com
    database: fra_staging (RDS)
    cache: elasticache_staging
    s3_bucket: fra-staging
    replicas: 2

  production:
    domain: api.stopfra.com
    database: fra_production (RDS Multi-AZ)
    cache: elasticache_production (cluster mode)
    s3_bucket: fra-production
    replicas: 3 (min) - 10 (max)
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run test:integration

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t fra-api:${{ github.sha }} .
      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login ...
          docker push fra-api:${{ github.sha }}

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS Staging
        run: |
          aws ecs update-service \
            --cluster fra-staging \
            --service fra-api \
            --force-new-deployment

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS Production
        run: |
          aws ecs update-service \
            --cluster fra-production \
            --service fra-api \
            --force-new-deployment
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

USER node

CMD ["node", "dist/server.js"]
```

### Database Migrations

**Tool: node-pg-migrate**

```typescript
// migrations/1703000000000_initial_schema.ts
export const up = async (pgm) => {
  pgm.createTable('users', {
    user_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });

  pgm.createIndex('users', 'email');
};

export const down = async (pgm) => {
  pgm.dropTable('users');
};
```

**Migration Strategy:**
- Migrations run automatically on deployment
- Zero-downtime migrations (add before remove)
- Rollback strategy for failures
- Database backups before major migrations

---

## Monitoring & Observability

### Logging Strategy

**Structured Logging with Winston:**

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'fra-api',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Assessment created', {
  assessment_id: 'uuid',
  organisation_id: 'uuid',
  user_id: 'uuid'
});

logger.error('Payment failed', {
  error: error.message,
  stack: error.stack,
  payment_intent_id: 'pi_xxx'
});
```

### Metrics Collection

**Tool: Prometheus + Grafana**

```typescript
import promClient from 'prom-client';

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const assessmentCreated = new promClient.Counter({
  name: 'assessments_created_total',
  help: 'Total number of assessments created',
  labelNames: ['organisation_type']
});

const activeUsers = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of currently active users'
});

// Middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || 'unknown', res.statusCode)
      .observe(duration);
  });

  next();
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: fra_api_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: SlowResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "95th percentile response time > 2s"

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_pool_size - pg_pool_available < 2
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool near exhaustion"
```

### Distributed Tracing

**Tool: OpenTelemetry**

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('fra-api');

const createAssessment = async (req, res) => {
  const span = tracer.startSpan('createAssessment');

  try {
    span.setAttribute('organisation_id', req.body.organisationId);

    const assessment = await db.query('INSERT INTO assessments...');
    span.addEvent('assessment_created', { assessment_id: assessment.id });

    await eventBus.publish('assessment.created', assessment);
    span.addEvent('event_published');

    res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
};
```

---

## Decision Framework

### When to Make Architectural Changes

**Decision Matrix:**

| Factor | Weight | Threshold for Change |
|--------|--------|---------------------|
| Performance degradation | High | >20% slowdown |
| Security vulnerability | Critical | Any CVE 7.0+ |
| Cost increase | Medium | >30% cost increase |
| Developer productivity | Medium | >2h/day lost to issues |
| Compliance requirement | Critical | Any regulatory gap |
| User complaints | High | >10% users affected |

### Architecture Decision Records (ADR)

**Template:**

```markdown
# ADR-001: Use PostgreSQL as Primary Database

## Status
Accepted

## Context
We need a reliable, ACID-compliant database for storing fraud risk assessments with strong data integrity guarantees.

## Decision
We will use PostgreSQL 15+ as our primary database.

## Consequences

### Positive
- ACID compliance for financial data
- Excellent JSON support for flexible schemas
- Strong ecosystem and tooling
- Row-level security for multi-tenancy

### Negative
- Higher operational complexity than managed NoSQL
- Requires careful query optimization for performance
- Vertical scaling limits (mitigated by read replicas)

## Alternatives Considered
- MongoDB: Rejected due to lack of ACID guarantees
- MySQL: Rejected due to inferior JSON support
- DynamoDB: Rejected due to complex query patterns
```

### Technical Debt Management

**Debt Classification:**

```typescript
technicalDebt = {
  'critical': {
    impact: 'high',
    effort: 'any',
    action: 'fix immediately',
    examples: ['security vulnerabilities', 'data corruption risks']
  },
  'important': {
    impact: 'medium',
    effort: 'low-medium',
    action: 'plan in next sprint',
    examples: ['performance bottlenecks', 'missing tests']
  },
  'nice-to-have': {
    impact: 'low',
    effort: 'any',
    action: 'backlog',
    examples: ['code style improvements', 'refactoring']
  }
}
```

**Debt Tracking:**
- Maximum 10% of sprint capacity for tech debt
- Quarterly architecture review
- Mandatory refactoring for >15% code duplication

---

## Summary Checklist for Backend Architects

### Pre-Implementation
- [ ] Review compliance requirements (GovS-013, ECCTA 2023)
- [ ] Design database schema with audit trails
- [ ] Plan security architecture (auth, encryption, RBAC)
- [ ] Define API contracts and error codes
- [ ] Establish caching strategy
- [ ] Plan monitoring and alerting

### During Implementation
- [ ] Follow RESTful API conventions
- [ ] Implement comprehensive input validation
- [ ] Add structured logging to all endpoints
- [ ] Write unit and integration tests (>80% coverage)
- [ ] Document all architectural decisions (ADRs)
- [ ] Implement rate limiting and security headers

### Pre-Deployment
- [ ] Run security audit (OWASP Top 10)
- [ ] Performance testing (load, stress tests)
- [ ] Database migration scripts tested
- [ ] Monitoring dashboards configured
- [ ] Runbooks for common issues
- [ ] Disaster recovery plan documented

### Post-Deployment
- [ ] Monitor error rates and response times
- [ ] Review logs for anomalies
- [ ] Collect user feedback
- [ ] Plan optimizations based on metrics
- [ ] Update documentation with learnings

---

**Document Version:** 1.0
**Last Updated:** December 20, 2025
**Next Review:** March 20, 2026
**Maintained By:** Backend Architecture Team
