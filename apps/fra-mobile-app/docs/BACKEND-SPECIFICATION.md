# Backend Data Model & API Documentation

## Overview

This document provides a comprehensive specification for the backend database structure and API design for the Fraud Risk Assessment (FRA) Health Check platform. The system supports user authentication, assessment management, payment processing, key-pass distribution, and employer dashboards.

---

## Core Entities

### 1. User

Represents both employers (who purchase packages) and employees (who use key-passes).

**Table: `users`**

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | UUID (PK) | Unique identifier |
| `email` | VARCHAR(255) UNIQUE | User's email address |
| `password_hash` | VARCHAR(255) | Hashed password (bcrypt/argon2) |
| `name` | VARCHAR(255) | User's full name or organisation name |
| `role` | ENUM('employer', 'employee', 'admin') | User role |
| `organisation_id` | UUID (FK) | Links to organisation table |
| `created_at` | TIMESTAMP | Account creation timestamp |
| `last_login` | TIMESTAMP | Last login timestamp |

**Indexes:**
- `idx_users_email` on `email`
- `idx_users_organisation` on `organisation_id`

**Relationships:**
- One User belongs to one Organisation
- One User (employer) can create many Assessments
- One User (employee) can have many EmployeeAssessments

---

### 2. Organisation

Represents the organisation that purchases FRA packages.

**Table: `organisations`**

| Field | Type | Description |
|-------|------|-------------|
| `organisation_id` | UUID (PK) | Unique identifier |
| `name` | VARCHAR(255) | Organisation name |
| `type` | ENUM('charity', 'public-sector', 'private-sme', 'large-corporate') | Organisation type |
| `employee_band` | ENUM('1-10', '11-50', '51-100', '101-250', '251-1000', '1001+') | Employee count range |
| `size` | ENUM('small', 'medium', 'large') | Computed organisation size |
| `created_at` | TIMESTAMP | Creation timestamp |
| `package_type` | ENUM('health-check', 'with-awareness', 'with-dashboard') NULL | Currently active package |
| `keypasses_allocated` | INT DEFAULT 0 | Total key-passes allocated |
| `keypasses_used` | INT DEFAULT 0 | Number of key-passes used |

**Indexes:**
- `idx_organisations_name` on `name`

**Relationships:**
- One Organisation has many Users
- One Organisation has many Assessments
- One Organisation has many KeyPasses

---

### 3. Assessment

Represents the main organisational FRA assessment.

**Table: `assessments`**

| Field | Type | Description |
|-------|------|-------------|
| `assessment_id` | UUID (PK) | Unique identifier |
| `organisation_id` | UUID (FK) | Links to organisation |
| `created_by_user_id` | UUID (FK) | User who created assessment |
| `status` | ENUM('draft', 'submitted', 'paid', 'signed') | Assessment status |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `overall_risk_level` | ENUM('low', 'medium', 'high') NULL | Calculated overall risk |

**Indexes:**
- `idx_assessments_organisation` on `organisation_id`
- `idx_assessments_user` on `created_by_user_id`
- `idx_assessments_status` on `status`

**Relationships:**
- One Assessment belongs to one Organisation
- One Assessment has many RiskRegisterItems
- One Assessment has one Signature (optional)
- One Assessment has many FeedbackEntries

---

### 4. AssessmentAnswers

Stores detailed questionnaire responses. Can be implemented as either separate tables per section or a single flexible table.

**Option A: Single Table (Recommended for flexibility)**

**Table: `assessment_answers`**

| Field | Type | Description |
|-------|------|-------------|
| `answer_id` | UUID (PK) | Unique identifier |
| `assessment_id` | UUID (FK) | Links to assessment |
| `section` | VARCHAR(50) | Section name (e.g., 'risk_appetite', 'procurement') |
| `question_key` | VARCHAR(100) | Question identifier |
| `answer_value` | TEXT | Answer value (string/JSON) |
| `created_at` | TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_answers_assessment` on `assessment_id`
- `idx_answers_section` on (`assessment_id`, `section`)

**Option B: Section Tables (Alternative for strong typing)**

Separate tables: `assessment_risk_appetite`, `assessment_fraud_triangle`, `assessment_procurement`, etc.

---

### 5. RiskRegisterItem

Individual risks identified in the assessment.

**Table: `risk_register_items`**

| Field | Type | Description |
|-------|------|-------------|
| `risk_item_id` | UUID (PK) | Unique identifier |
| `assessment_id` | UUID (FK) | Links to assessment |
| `risk_id_code` | VARCHAR(20) | Display ID (e.g., 'FRA-001') |
| `title` | VARCHAR(255) | Risk title |
| `area` | VARCHAR(100) | Risk area/category |
| `description` | TEXT | Risk description |
| `inherent_score` | INT | Inherent risk score (1-25) |
| `residual_score` | INT | Residual risk score (1-25) |
| `priority` | ENUM('high', 'medium', 'low') | Risk priority |
| `suggested_owner` | VARCHAR(255) | Suggested role for ownership |

**Indexes:**
- `idx_risk_items_assessment` on `assessment_id`
- `idx_risk_items_priority` on `priority`

**Relationships:**
- One RiskRegisterItem belongs to one Assessment

---

### 6. Package

Defines available FRA packages.

**Table: `packages`**

| Field | Type | Description |
|-------|------|-------------|
| `package_id` | UUID (PK) | Unique identifier |
| `package_type` | VARCHAR(50) UNIQUE | Type identifier |
| `name` | VARCHAR(255) | Display name |
| `description` | TEXT | Package description |
| `price` | DECIMAL(10,2) | Price in GBP |
| `max_keypasses_default` | INT | Default key-passes allocation |
| `features` | JSON | Array of feature strings |

---

### 7. Purchase / Payment

Records payment transactions.

**Table: `purchases`**

| Field | Type | Description |
|-------|------|-------------|
| `purchase_id` | UUID (PK) | Unique identifier |
| `organisation_id` | UUID (FK) | Purchasing organisation |
| `assessment_id` | UUID (FK) | Related assessment |
| `package_id` | UUID (FK) | Package purchased |
| `amount` | DECIMAL(10,2) | Amount paid |
| `currency` | VARCHAR(3) DEFAULT 'GBP' | Currency code |
| `status` | ENUM('pending', 'success', 'failed') | Payment status |
| `transaction_reference` | VARCHAR(255) | External payment gateway reference |
| `created_at` | TIMESTAMP | Transaction timestamp |

**Indexes:**
- `idx_purchases_organisation` on `organisation_id`
- `idx_purchases_assessment` on `assessment_id`
- `idx_purchases_status` on `status`

---

### 8. KeyPass

Employee access codes distributed by employers.

**Table: `keypasses`**

| Field | Type | Description |
|-------|------|-------------|
| `keypass_id` | UUID (PK) | Unique identifier |
| `code` | VARCHAR(50) UNIQUE | Access code (e.g., 'FRA-A1B2C3D4') |
| `organisation_id` | UUID (FK) | Owning organisation |
| `status` | ENUM('unused', 'used', 'expired') | Key-pass status |
| `used_by_user_id` | UUID (FK) NULL | Employee who used it |
| `created_at` | TIMESTAMP | Creation timestamp |
| `used_at` | TIMESTAMP NULL | Usage timestamp |

**Indexes:**
- `idx_keypasses_code` on `code`
- `idx_keypasses_organisation` on `organisation_id`
- `idx_keypasses_status` on `status`

**Relationships:**
- One KeyPass belongs to one Organisation
- One KeyPass can be used by one User (employee)

---

### 9. EmployeeAssessment

Tracks employee-level assessments (if employees complete mini-modules).

**Table: `employee_assessments`**

| Field | Type | Description |
|-------|------|-------------|
| `employee_assessment_id` | UUID (PK) | Unique identifier |
| `user_id` | UUID (FK) | Employee user |
| `organisation_id` | UUID (FK) | Employee's organisation |
| `status` | ENUM('not-started', 'in-progress', 'completed') | Assessment status |
| `started_at` | TIMESTAMP NULL | Start timestamp |
| `completed_at` | TIMESTAMP NULL | Completion timestamp |
| `overall_risk_level` | ENUM('low', 'medium', 'high') NULL | Calculated risk level |
| `score` | INT NULL | Optional score |

**Indexes:**
- `idx_employee_assessments_user` on `user_id`
- `idx_employee_assessments_org` on `organisation_id`
- `idx_employee_assessments_status` on `status`

---

### 10. Signature

Electronic signatures for assessment sign-off.

**Table: `signatures`**

| Field | Type | Description |
|-------|------|-------------|
| `signature_id` | UUID (PK) | Unique identifier |
| `assessment_id` | UUID (FK) | Related assessment |
| `signed_by_user_id` | UUID (FK) | User who signed |
| `signatory_name` | VARCHAR(255) | Name of signatory |
| `signatory_role` | VARCHAR(255) | Role/job title |
| `signature_image_ref` | VARCHAR(500) | S3/storage reference or base64 data |
| `signed_at` | TIMESTAMP | Signature timestamp |

**Indexes:**
- `idx_signatures_assessment` on `assessment_id`

**Relationships:**
- One Signature belongs to one Assessment
- One Signature is created by one User

---

### 11. Feedback

User feedback on the assessment experience.

**Table: `feedback`**

| Field | Type | Description |
|-------|------|-------------|
| `feedback_id` | UUID (PK) | Unique identifier |
| `assessment_id` | UUID (FK) | Related assessment |
| `user_id` | UUID (FK) | User providing feedback |
| `rating` | INT | Rating 1-5 |
| `what_worked_well` | TEXT | Positive comments |
| `improvements` | TEXT | Improvement suggestions |
| `consent_contact` | BOOLEAN | Consent for follow-up |
| `created_at` | TIMESTAMP | Feedback timestamp |

**Indexes:**
- `idx_feedback_assessment` on `assessment_id`
- `idx_feedback_rating` on `rating`

---

## Entity Relationship Diagram (Text Format)

```
Organisation (1) ──── (N) User
Organisation (1) ──── (N) Assessment
Organisation (1) ──── (N) KeyPass
Organisation (1) ──── (N) EmployeeAssessment

User (1) ──── (N) Assessment [as creator]
User (1) ──── (N) EmployeeAssessment [as employee]
User (1) ──── (N) Signature [as signatory]

Assessment (1) ──── (N) AssessmentAnswers
Assessment (1) ──── (N) RiskRegisterItem
Assessment (1) ──── (1) Signature [optional]
Assessment (1) ──── (N) Feedback
Assessment (1) ──── (1) Purchase

Package (1) ──── (N) Purchase

KeyPass (N) ──── (1) Organisation
KeyPass (0/1) ──── (1) User [when used]
```

---

## API Endpoints

### Authentication

**POST** `/api/auth/signup`
- Body: `{ email, password, organisationName }`
- Response: `{ success, user, organisation, token }`

**POST** `/api/auth/login`
- Body: `{ email, password }`
- Response: `{ success, user, organisation, token }`

**POST** `/api/auth/keypass-login`
- Body: `{ email, keyPassCode }`
- Response: `{ success, user, organisation, token }`

**POST** `/api/auth/logout`
- Headers: `Authorization: Bearer <token>`
- Response: `{ success }`

---

### Organisations

**GET** `/api/organisations/:id`
- Headers: `Authorization: Bearer <token>`
- Response: `{ organisation }`

**PATCH** `/api/organisations/:id`
- Headers: `Authorization: Bearer <token>`
- Body: `{ name, type, employeeBand, ... }`
- Response: `{ organisation }`

---

### Assessments

**POST** `/api/assessments`
- Headers: `Authorization: Bearer <token>`
- Body: `{ organisationId }`
- Response: `{ assessment }`

**GET** `/api/assessments/:id`
- Headers: `Authorization: Bearer <token>`
- Response: `{ assessment, answers, riskRegister }`

**PATCH** `/api/assessments/:id`
- Headers: `Authorization: Bearer <token>`
- Body: `{ status, answers, ... }`
- Response: `{ assessment }`

**POST** `/api/assessments/:id/submit`
- Headers: `Authorization: Bearer <token>`
- Response: `{ assessment, riskRegister }`

**GET** `/api/assessments/organisation/:orgId`
- Headers: `Authorization: Bearer <token>`
- Response: `{ assessments[] }`

---

### Packages

**GET** `/api/packages`
- Response: `{ packages[] }`

**GET** `/api/packages/recommended`
- Query: `employeeBand`
- Response: `{ recommendedPackage, allPackages[] }`

---

### Purchases / Payments

**POST** `/api/purchases`
- Headers: `Authorization: Bearer <token>`
- Body: `{ assessmentId, packageId, paymentMethod }`
- Response: `{ purchase, paymentIntent }`

**POST** `/api/purchases/:id/confirm`
- Headers: `Authorization: Bearer <token>`
- Body: `{ transactionReference }`
- Response: `{ purchase, success }`

**GET** `/api/purchases/organisation/:orgId`
- Headers: `Authorization: Bearer <token>`
- Response: `{ purchases[] }`

---

### Key-Passes

**POST** `/api/keypasses/allocate`
- Headers: `Authorization: Bearer <token>`
- Body: `{ organisationId, packageType, employeeBand }`
- Response: `{ keypasses[], allocated }`

**GET** `/api/keypasses/organisation/:orgId`
- Headers: `Authorization: Bearer <token>`
- Response: `{ keypasses[], allocated, used, remaining }`

**POST** `/api/keypasses/validate`
- Body: `{ code, email }`
- Response: `{ valid, organisationId }`

**PATCH** `/api/keypasses/:code/use`
- Headers: `Authorization: Bearer <token>`
- Body: `{ userId }`
- Response: `{ keypass, success }`

---

### Employee Assessments

**POST** `/api/employee-assessments`
- Headers: `Authorization: Bearer <token>`
- Body: `{ userId }`
- Response: `{ employeeAssessment }`

**GET** `/api/employee-assessments/organisation/:orgId`
- Headers: `Authorization: Bearer <token>`
- Response: `{ employeeAssessments[] }`

**PATCH** `/api/employee-assessments/:id`
- Headers: `Authorization: Bearer <token>`
- Body: `{ status, answers, ... }`
- Response: `{ employeeAssessment }`

---

### Dashboard (Package 3 only)

**GET** `/api/dashboard/organisation/:orgId`
- Headers: `Authorization: Bearer <token>`
- Response: `{ metrics, employeeData[], keypassUsage }`

**GET** `/api/dashboard/organisation/:orgId/export`
- Headers: `Authorization: Bearer <token>`
- Response: CSV file download

---

### Signatures

**POST** `/api/signatures`
- Headers: `Authorization: Bearer <token>`
- Body: `{ assessmentId, signatoryName, signatoryRole, signatureImage }`
- Response: `{ signature }`

**GET** `/api/signatures/assessment/:assessmentId`
- Headers: `Authorization: Bearer <token>`
- Response: `{ signature }`

---

### Feedback

**POST** `/api/feedback`
- Headers: `Authorization: Bearer <token>`
- Body: `{ assessmentId, rating, whatWorkedWell, improvements, consentContact }`
- Response: `{ feedback }`

**GET** `/api/feedback` (Admin only)
- Headers: `Authorization: Bearer <token>`
- Query: `packageType`, `dateFrom`, `dateTo`
- Response: `{ feedbacks[], averageRating }`

---

## Risk Scoring Logic

### Calculation Method

1. **Impact & Likelihood**: Each risk factor is scored 1-5
2. **Inherent Risk Score**: `impact × likelihood` (1-25)
3. **Control Adjustment**: Apply reduction based on control strength:
   - Very strong controls: 40% reduction
   - Reasonably strong: 20% reduction
   - Some gaps / weak: 0% reduction
4. **Residual Risk Score**: `inherent × (1 - reduction)`
5. **Priority Bands**:
   - **High**: 15-25
   - **Medium**: 8-14
   - **Low**: 1-7

### Implementation Notes

- Store risk scoring logic in backend service layer
- Persist calculated scores in `risk_register_items` table
- Recalculate when assessment answers change

---

## Security Considerations

### Authentication
- Use JWT tokens with appropriate expiration
- Hash passwords with bcrypt (cost factor 10+) or argon2
- Implement rate limiting on auth endpoints

### Authorization
- Employers can only access their organisation's data
- Employees can only access their own assessment data
- Dashboard access restricted to Package 3 users
- Validate organisation ownership on all data access

### Data Privacy
- Never expose password hashes in API responses
- Encrypt sensitive data at rest (signatures, personal info)
- Comply with UK GDPR requirements
- Implement audit logging for data access

---

## Performance Optimizations

### Indexing
- All foreign keys should be indexed
- Add composite indexes for common query patterns:
  - `(organisation_id, status)` on assessments
  - `(organisation_id, status)` on keypasses

### Caching
- Cache package data (rarely changes)
- Cache organisation data for session duration
- Use Redis for session management

### Query Optimization
- Use pagination for list endpoints (default 25, max 100)
- Implement efficient joins for dashboard queries
- Pre-calculate dashboard metrics periodically

---

## Data Backup & Recovery

- Daily automated backups
- Point-in-time recovery capability
- Backup retention: 30 days minimum
- Test recovery procedures quarterly

---

## Compliance Notes

### GovS-013 & Fraud Prevention Standard
- Store assessment methodology version
- Maintain audit trail of all changes
- Generate compliance reports on demand

### ECCTA 2023
- Document fraud risk assessment process
- Maintain records of assessments for 6 years
- Support automated reporting for regulators

---

## Implementation Checklist

- [ ] Set up PostgreSQL database with schema
- [ ] Implement authentication with JWT
- [ ] Create RESTful API endpoints
- [ ] Implement key-pass generation algorithm
- [ ] Build risk scoring engine
- [ ] Integrate payment gateway (Stripe recommended)
- [ ] Implement file storage for signatures (S3/equivalent)
- [ ] Set up email service for notifications
- [ ] Create admin panel for feedback review
- [ ] Implement audit logging
- [ ] Set up monitoring and alerting
- [ ] Write API documentation (OpenAPI/Swagger)
- [ ] Create database migration scripts
- [ ] Implement automated testing
- [ ] Set up CI/CD pipeline

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintainer:** FRA Development Team
