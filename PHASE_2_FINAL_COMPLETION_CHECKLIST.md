# Phase 2 - Final Completion Checklist

**Timeline:** Weeks 9-12 (After API Implementation Complete)  
**Status:** Ready for Testing & Validation Phase  
**Owner:** QA Engineer + Security Team

---

## Quick Start Commands

```bash
# Install dependencies (if not already done)
cd /Users/frederic/Documents/projects/start_fra
pnpm install

# Run full test suite
cd apps/fra-backend/backend
pnpm run test

# Run tests with coverage report
pnpm run test:coverage

# Run linting
pnpm run lint

# Type check (identifies TypeScript errors)
pnpm run typecheck

# Build for production
pnpm run build

# Start dev server
pnpm run dev
```

---

## WEEK 9-10: Testing Phase

### Task 1: Run Test Suite

```bash
cd apps/fra-backend/backend
pnpm run test 2>&1 | tee test-results.log
```

**Expected Outcome:**
- All 18 test files pass
- 0 test failures
- Coverage > 60%

**If Tests Fail:**
1. Check test output for specific failures
2. Review helper.ts configuration in __tests__/
3. Verify PostgreSQL test database is configured
4. Check .env configuration

---

### Task 2: Generate Coverage Report

```bash
pnpm run test:coverage 2>&1 | tee coverage-report.log
```

**Target Metrics:**
- `Statements` ≥ 80%
- `Branches` ≥ 75%
- `Functions` ≥ 80%
- `Lines` ≥ 80%

**Coverage Breakdown by Module:**
- Auth module: Target 90%+
- Assessment module: Target 85%+
- Payment module: Target 80%+
- Analytics module: Target 75%+
- Middleware/Helpers: Target 80%+

---

### Task 3: Fix Coverage Gaps

For any module below target coverage:

```bash
# View detailed coverage report
open coverage/index.html  # (on macOS)
# or
xdg-open coverage/index.html  # (on Linux)
```

**High-Priority Coverage Gaps:**
- Error paths in handlers
- Rate limiter edge cases
- Redis fallback scenarios
- Database transaction rollbacks
- JWT refresh token flows

---

### Task 4: Run Linting & Type Checks

```bash
# Check for linting issues
pnpm run lint

# Check TypeScript compilation
pnpm run typecheck

# Expected: 0 errors, 0 warnings
```

**If Errors Found:**
1. Address all ESLint violations
2. Fix TypeScript type errors
3. Run prettier to auto-format:
   ```bash
   npx prettier --write src/
   ```

---

### Task 5: Create Integration Tests

Create new test file: `__tests__/integration-critical-flows.test.ts`

```typescript
describe('Critical User Flows (E2E)', () => {
  
  it('should complete end-to-end signup → assessment → purchase flow', async () => {
    // 1. User signs up
    // 2. Creates assessment
    // 3. Completes assessment
    // 4. Purchases package
    // 5. Receives key-passes
    // Verify audit logs
  });

  it('should handle account lockout after failed logins', async () => {
    // 1. Attempt 5 failed logins
    // 2. Verify account locked
    // 3. Wait 15 minutes (or mock time)
    // 4. Verify login succeeds
  });

  it('should enforce password reset token expiry', async () => {
    // 1. Request password reset
    // 2. Extract reset token
    // 3. Verify token works within 1 hour
    // 4. Verify token fails after 1 hour
  });

  // Add 5-10 more critical flow tests
});
```

---

## WEEK 11: Documentation Phase

### Task 1: Generate OpenAPI Specification

Create `docs/openapi.yaml`:

```yaml
openapi: 3.0.0
info:
  title: START FRA Backend API
  version: "2.0.0"
  description: Fraud Risk Assessment Platform

servers:
  - url: https://api.startfra.com/api/v1
    description: Production
  - url: http://localhost:3000/api/v1
    description: Development

paths:
  /auth/signup:
    post:
      summary: Register new user
      tags: [Authentication]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SignupRequest'
      responses:
        '200':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '409':
          description: Email already exists
  
  # ... (repeat for all 60+ endpoints)

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  
  schemas:
    SignupRequest:
      type: object
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 12
        name:
          type: string
      required: [email, password, name]
    
    AuthResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            accessToken:
              type: string
            refreshToken:
              type: string
            user:
              type: object
              properties:
                userId:
                  type: string
                email:
                  type: string
                role:
                  type: string
```

**Tools to Generate OpenAPI:**
- Use `@hono/swagger-ui` package
- Or manually document in `docs/openapi.yaml`
- Verify with Swagger Editor: https://editor.swagger.io

---

### Task 2: Create API Endpoint Reference

Create `docs/API_REFERENCE.md`:

```markdown
# API Endpoints Reference

## Authentication

### POST /auth/signup
Register a new user and organization.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "organisationName": "Acme Corp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "userId": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "employer"
    }
  }
}
```

**Errors:**
- 400: Validation error
- 409: Email already exists

---

### POST /auth/login
Authenticate user and get tokens.

*... (continue for all endpoints)*
```

---

### Task 3: Create Authentication Guide

Create `docs/AUTHENTICATION.md`:

```markdown
# Authentication Guide

## JWT Token Flow

1. User logs in → receives access token (30 min) + refresh token (7 days)
2. Access token sent in `Authorization: Bearer <token>` header
3. When access token expires → use refresh token to get new one
4. Logout invalidates refresh token in Redis

## Token Structure

**Access Token Payload:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "employer",
  "organisationId": "org-id",
  "iat": 1234567890,
  "exp": 1234569690
}
```

## Rate Limiting

- Auth endpoints: 10-20 requests per 15 minutes
- After 5 failed logins: 15 minute lockout
- Password reset: 5 attempts per hour

## Best Practices

1. Store tokens securely (not in localStorage)
2. Use react-secure-storage or similar
3. Implement token refresh proactively
4. Clear tokens on logout
5. Validate tokens server-side on every request
```

---

### Task 4: Create Webhook Documentation

Create `docs/WEBHOOKS.md`:

```markdown
# Stripe Webhook Documentation

## Setup

1. Register webhook in Stripe Dashboard
2. Endpoint: `POST /api/v1/webhooks/stripe`
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

## Payload Example

```json
{
  "id": "evt_1234567890",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "status": "succeeded",
      "amount": 4900
    }
  }
}
```

## Response

Return HTTP 200 within 30 seconds to acknowledge receipt.

## Idempotency

Each webhook event ID is processed only once. Retries are safe.

## Testing

Use Stripe CLI to test:
```bash
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
stripe trigger payment_intent.succeeded
```
```

---

## WEEK 12: Security Audit & Sign-off

### Task 1: Execute Security Checklist

Use `docs/markdown/SECURITY_AUDIT_CHECKLIST.md` (150+ checkpoints):

**Critical Security Items to Verify:**

```checklist
Authentication & Authorization
- [ ] All endpoints require authentication (except signup/login)
- [ ] Role-based access control enforced
- [ ] JWT tokens validated on every request
- [ ] Token expiry enforced
- [ ] Refresh token blacklist works
- [ ] Account lockout after 5 failed attempts
- [ ] Password reset tokens expire after 1 hour

Data Protection
- [ ] All SQL queries use parameterized statements (no string concatenation)
- [ ] No sensitive data logged (passwords, tokens)
- [ ] Audit logs retained for 6+ years
- [ ] Encryption at rest configured (if using AWS)
- [ ] Encryption in transit (TLS/HTTPS) enforced

Request Validation
- [ ] Input validation on all endpoints (using Zod)
- [ ] Request size limits enforced (1MB max body)
- [ ] Rate limiting on all public endpoints
- [ ] CORS properly configured
- [ ] No open redirect vulnerabilities
- [ ] CSRF protection in place

Response Security
- [ ] Security headers set (X-Frame-Options, CSP, etc.)
- [ ] Error messages don't leak sensitive info
- [ ] No stack traces in production responses
- [ ] Timing-safe password comparison used
- [ ] Account enumeration prevented

Database Security
- [ ] Only necessary tables accessible
- [ ] Foreign key constraints enforced
- [ ] Unused privileges revoked
- [ ] Database backups configured
- [ ] Query logging enabled for audit

API Security
- [ ] API versioning in place (/api/v1)
- [ ] Deprecated endpoints documented
- [ ] Breaking changes tracked
- [ ] Webhook signatures validated
- [ ] Stripe webhook events processed idempotently

Infrastructure
- [ ] Environment variables not committed to repo
- [ ] Database backups automated
- [ ] Log rotation configured
- [ ] Monitoring & alerting in place
- [ ] DDoS protection (if applicable)
```

---

### Task 2: Address Findings

If any security issues found during checklist:

1. **Critical** (Fix immediately):
   - Data exposure vulnerabilities
   - Authentication bypasses
   - SQL injection / NoSQL injection
   - Unencrypted sensitive data

2. **High** (Fix before production):
   - Weak encryption
   - Missing validation
   - Privilege escalation
   - Account enumeration

3. **Medium** (Fix in next release):
   - Timing attacks
   - Information disclosure
   - Rate limit issues

4. **Low** (Document as known):
   - Security headers optimization
   - Performance improvements

---

### Task 3: Prepare for Penetration Testing

Create `docs/SECURITY_SIGN_OFF.md`:

```markdown
# Security Sign-Off Report

**Date:** [DATE]  
**Audited By:** [TEAM]  
**Status:** Ready for Production

## Checklist Results

- Security Audit Checklist: [X] 150/150 items verified
- Code Review: [X] Complete
- Dependency Scanning: [X] 0 critical vulnerabilities
- OWASP Top 10: [X] All mitigated

## Known Issues

None at critical/high severity

## Recommendations

1. Schedule annual penetration test
2. Implement WAF (Web Application Firewall)
3. Enable database encryption at rest
4. Set up SOC 2 compliance monitoring

## Approved By

- Security Lead: ________________
- Backend Lead: ________________
- Product Lead: ________________

---

Sign-off Date: [DATE]  
Valid Until: [DATE + 1 YEAR]
```

---

### Task 4: Create Deployment Readiness Report

```markdown
# Phase 2 Completion - Deployment Readiness

## Tests
- [x] Unit tests: 100% passing
- [x] Integration tests: 100% passing
- [x] Coverage: 80%+

## Documentation
- [x] API Reference: Complete
- [x] Authentication Guide: Complete
- [x] Webhook Documentation: Complete
- [x] Deployment Guide: Complete

## Security
- [x] Security Audit: Passed
- [x] OWASP Top 10: Covered
- [x] Penetration Test: Scheduled/Completed

## Performance
- [x] Load testing: p95 < 2s
- [x] Database optimization: Indexed
- [x] Rate limiting: Configured

## Monitoring
- [x] Error tracking (Sentry): Configured
- [x] Logging (Pino): Structured
- [x] Alerting: Set up

**Status: READY FOR PHASE 3**
```

---

## Post-Phase 2 Phase Transition

Once all tasks above complete:

### Move to Phase 3: Frontend Integration
- Replace AsyncStorage with React Query
- Implement OAuth/JWT login flow
- Connect to assessment submission APIs
- Set up offline queue for failed requests

### Deliverables from Phase 2
- ✅ 60+ production-ready API endpoints
- ✅ 80%+ test coverage with passing tests
- ✅ Complete API documentation
- ✅ Security audit sign-off
- ✅ Performance benchmarks met
- ✅ Deployment readiness confirmed

---

## Contact & Escalation

**Backend Lead:** [Name] - [Contact]  
**QA Lead:** [Name] - [Contact]  
**Security Lead:** [Name] - [Contact]  
**Product Lead:** [Name] - [Contact]

---

**Document Status:** Active  
**Last Updated:** March 7, 2026  
**Next Review:** After test execution
