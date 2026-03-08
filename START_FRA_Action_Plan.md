# START FRA - Complete Action Plan

**Generated:** January 29, 2026
**Based on:** Analysis of 50+ documentation files

---

## Executive Summary

| Area | Status | Completion |
|------|--------|------------|
| Compliance Infrastructure | Done | 100% |
| Security Infrastructure | Done | 100% |
| Architecture & Documentation | Done | 100% |
| UI Components | Done | 100% |
| Backend APIs | Not Started | 0% |
| Frontend-Backend Integration | Not Started | 0% |
| Testing | Not Started | 0% |
| Production Infrastructure | Not Started | 0% |

**Overall Production Readiness: 60%**
**Estimated Time to Production: 16-24 weeks**

---

## SECTION 1: CRITICAL BLOCKERS (P0)

### 1.1 Backend TypeScript Errors (59 Errors)
**Must fix before any API work can proceed**

| Error Type | Count | Files Affected |
|------------|-------|----------------|
| Schema import mismatches | 22 | Assessment, Keypass, Package types |
| JWT type errors | 2 | auth.service.ts |
| Drizzle ORM query errors | 17 | complianceReporting.ts, dataRetention.ts |
| Missing return types | 18 | Various service methods |

**Actions:**
- [ ] Fix database schema import mismatches
- [ ] Resolve JWT signing `expiresIn` type mismatches
- [ ] Correct Drizzle ORM query type errors
- [ ] Add explicit return types to service methods
- [ ] Run `npm run type-check` until zero errors

**Effort:** 2-3 days | **Priority:** CRITICAL

---

### 1.2 Backend API Implementation
**Status:** Infrastructure exists, endpoints NOT implemented

**Missing Authentication APIs:**
- [ ] POST /api/v1/auth/login
- [ ] POST /api/v1/auth/signup
- [ ] POST /api/v1/auth/logout
- [ ] POST /api/v1/auth/refresh
- [ ] POST /api/v1/auth/forgot-password
- [ ] POST /api/v1/auth/reset-password

**Missing Assessment APIs:**
- [ ] GET /api/v1/assessments
- [ ] POST /api/v1/assessments
- [ ] GET /api/v1/assessments/:id
- [ ] PATCH /api/v1/assessments/:id
- [ ] POST /api/v1/assessments/:id/submit

**Missing Payment APIs:**
- [ ] POST /api/v1/payments/create-intent
- [ ] POST /api/v1/webhooks/stripe
- [ ] POST /api/v1/keypasses/generate
- [ ] POST /api/v1/keypasses/validate

**Missing Dashboard APIs (Package 3):**
- [ ] GET /api/v1/analytics/overview
- [ ] GET /api/v1/analytics/assessments
- [ ] GET /api/v1/reports/generate

**Effort:** 8-12 weeks | **Priority:** CRITICAL

---

### 1.3 Frontend-Backend Integration
**Current State:** Frontend uses AsyncStorage only (no API calls)

**Actions:**
- [ ] Replace AsyncStorage with React Query API calls
- [ ] Implement authentication flow (login/logout)
- [ ] Connect assessment submission to backend
- [ ] Implement offline queue for failed requests
- [ ] Add API error handling and retry logic
- [ ] Migrate to expo-secure-store for tokens
- [ ] Implement sync status UI

**Effort:** 2-3 weeks (after backend) | **Priority:** CRITICAL

---

### 1.4 Testing Coverage (Currently 0%)
**Target: 80%+ coverage before staging**

**Unit Tests Needed:**
- [ ] Risk scoring engine tests
- [ ] Authentication service tests
- [ ] Payment processing tests
- [ ] Data retention service tests
- [ ] Audit logger tests

**Integration Tests Needed:**
- [ ] API endpoint tests
- [ ] Database operations tests
- [ ] Compliance endpoint tests

**E2E Tests Needed:**
- [ ] User registration flow
- [ ] Assessment completion flow
- [ ] Payment flow
- [ ] Report generation flow

**Effort:** 4-6 weeks | **Priority:** CRITICAL

---

### 1.5 Security Audit
**Status:** Checklist created (150+ checkpoints), NOT executed

**Actions:**
- [ ] Execute internal security audit
- [ ] Schedule external penetration testing
- [ ] Fix identified vulnerabilities
- [ ] Obtain security sign-off

**Effort:** 2-3 weeks | **Priority:** CRITICAL

---

## SECTION 2: HIGH PRIORITY (P1)

### 2.1 Production Infrastructure

| Component | Action | Service Options |
|-----------|--------|-----------------|
| PostgreSQL | Provision managed database | RDS, Supabase, Neon |
| Redis | Provision cache cluster | ElastiCache, Upstash |
| S3 | Create bucket for files | AWS S3 |
| SSL/TLS | Configure certificates | Let's Encrypt, ACM |
| DNS | Configure domain | Route 53, Cloudflare |
| CDN | Set up distribution | CloudFront |

**Actions:**
- [ ] Provision production PostgreSQL
- [ ] Provision Redis cluster
- [ ] Configure S3 bucket
- [ ] Set up SSL certificates
- [ ] Configure DNS records
- [ ] Set up CloudFront CDN
- [ ] Configure environment variables
- [ ] Set up automated backups

**Effort:** 3-5 days | **Priority:** HIGH

#### EC2 Backend Production Runbook (StopFra API)

**Host:** EC2 (Amazon Linux)

**Repo path on instance:** `/opt/stopfra/backend`

**Service name:** `stopfra-backend`

**Service unit:** `/etc/systemd/system/stopfra-backend.service`

**Process:** `node dist/index.js` (launched via `start.sh`)

**Key ports:** `3001` (local)

**SSM parameters (eu-west-2):**
- `/fra/backend/DATABASE_URL`
- `/fra/backend/JWT_SECRET`
- `/fra/backend/JWT_REFRESH_SECRET`
- `/fra/backend/UPSTASH_REDIS_REST_URL`
- `/fra/backend/UPSTASH_REDIS_REST_TOKEN`

**Pull + build + restart (deploy):**
- `git -C /opt/stopfra/backend pull`
- `pnpm -C /opt/stopfra/backend --filter @stopfra/backend build`
- `sudo systemctl restart stopfra-backend`

**Health check:**
- `curl -sS http://127.0.0.1:3001/health`

**Rate-limit verification (expect 429s):**
- Burst `/api/v1/auth/login` with bad creds and confirm mix of `401` and `429`

**pnpm workspace requirement on EC2:**
- Ensure `/opt/stopfra/backend/pnpm-workspace.yaml` exists.

**Run DB migrations (one-off):**
- Migrations require `DATABASE_URL` in the environment.
- Load env from SSM in the shell then run migrate:
  - `aws ssm get-parameters --with-decryption --names ... --region eu-west-2`
  - export `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `pnpm -C /opt/stopfra/backend --filter @stopfra/backend migrate`

**Common failure signatures:**
- `ERR_MODULE_NOT_FOUND .../dist/db`
  - Fix ESM import specifiers to include `.js` (e.g. `./db.js`, `./redis.js`) and rebuild.
- `connect ENETUNREACH <ipv6>:5432`
  - DB resolved to IPv6 but instance has no IPv6 route; prefer IPv4 DNS before creating pg pool.
- `relation "public.users" does not exist`
  - Migrations not applied; run `migrate`.

---

### 2.2 Monitoring & Observability

| Tool | Purpose | Priority |
|------|---------|----------|
| Sentry | Error tracking | HIGH |
| Prometheus + Grafana | Metrics | MEDIUM |
| Pino | Structured logging | HIGH |
| Datadog/New Relic | APM | MEDIUM |

**Actions:**
- [ ] Set up Sentry for error tracking
- [ ] Configure structured logging (Pino)
- [ ] Implement health check endpoints
- [ ] Set up uptime monitoring
- [ ] Create alerting rules
- [ ] Configure log aggregation

**Effort:** 2-3 days | **Priority:** HIGH

---

### 2.3 CI/CD Pipeline

**Actions:**
- [ ] Verify test execution in GitHub Actions
- [ ] Configure EAS Build for mobile apps
- [ ] Set up staging environment deployment
- [ ] Set up production environment deployment
- [ ] Configure automatic testing on PRs
- [ ] Set up code coverage tracking
- [ ] Configure rollback procedures

**Effort:** 2-3 days | **Priority:** HIGH

---

### 2.4 Mobile App Secure Storage

**Current:** AsyncStorage for tokens (INSECURE)

**Actions:**
- [ ] Migrate to expo-secure-store
- [ ] Encrypt sensitive local data
- [ ] Implement secure key-pass storage
- [ ] Remove tokens from AsyncStorage

**Effort:** 1-2 days | **Priority:** HIGH

---

## SECTION 3: COMPLETED ITEMS (Reference)

### Security Infrastructure ✅
- Redis-backed rate limiting
- SQL injection prevention (parameterized queries)
- Security headers (X-Frame-Options, CSP, HSTS)
- Account lockout (5 attempts → 15min)
- Password reset flow (secure tokens, 1h expiry)
- JWT token blacklisting

### Compliance Infrastructure ✅
- Audit logging (30+ event types, 6-year retention)
- Data retention automation (6-7 year policies)
- ECCTA 2023 reporting (8 API endpoints)
- GovS-013 alignment

### Architecture ✅
- Hybrid backend strategy documented
- Frontend architecture guide
- API design standards
- Database schema strategy

### Shared UI Package ✅
- @stopfra/ui-core created
- Design tokens (colors, spacing, typography)
- Component type definitions
- Accessibility utilities

### Pre-commit Hooks ✅
- Husky pre-commit hooks
- Lint-staged configuration
- Prettier formatting
- ESLint checks

---

## SECTION 4: MEDIUM PRIORITY (P2 - Post-MVP)

### 4.1 Performance Optimization
- [ ] Database query optimization
- [ ] Add indexes to frequently queried tables
- [ ] Implement Redis caching strategy
- [ ] Optimize bundle size (target <600KB)
- [ ] Implement code splitting
- [ ] Optimize image loading

**Effort:** 2-3 weeks

### 4.2 Accessibility (WCAG 2.1 AA)
- [ ] Add accessibility labels to all elements
- [ ] Implement keyboard navigation
- [ ] Fix color contrast issues
- [ ] Add ARIA roles and states
- [ ] Test with screen readers

**Effort:** 1-2 weeks

### 4.3 Load Testing
- [ ] Conduct load testing with k6
- [ ] Test 100, 1000, 10,000 concurrent users
- [ ] Identify and fix bottlenecks
- [ ] Document performance SLAs

**Effort:** 1 week

### 4.4 Documentation
- [ ] Complete API documentation (OpenAPI/Swagger)
- [ ] Write developer onboarding guide
- [ ] Create user guides (employer/employee)
- [ ] Create deployment runbooks
- [ ] Write troubleshooting FAQs

**Effort:** 2-3 weeks

### 4.5 Additional Features (Post-MVP)
- [ ] Consent management UI
- [ ] Data portability export (GDPR Article 20)
- [ ] Automated DSAR API endpoint
- [ ] Advanced dashboard analytics
- [ ] Mobile push notifications
- [ ] Admin panel

**Effort:** 3-4 weeks per feature

---

## SECTION 5: IMPLEMENTATION TIMELINE

### Phase 1: Foundation (COMPLETE)
✅ Compliance infrastructure
✅ Security infrastructure
✅ Architecture documentation
✅ Shared UI package

### Phase 2: Backend APIs (Weeks 1-12)
| Week | Focus | Deliverables |
|------|-------|--------------|
| 1-2 | Fix TypeScript + Auth APIs | Login, signup, logout, refresh |
| 3-4 | Assessment APIs | CRUD, submit, risk scoring |
| 5-6 | Payment APIs | Stripe integration, key-passes |
| 7-8 | Dashboard APIs | Analytics, reports |
| 9-10 | Testing | Unit tests, integration tests |
| 11-12 | Security & Docs | Audit, API documentation |

### Phase 3: Frontend Integration (Weeks 13-15)
- Replace AsyncStorage with React Query
- Authentication flow
- Assessment submission
- Offline sync

### Phase 4: Testing & Compliance (Weeks 16-20)
- Complete test suite (80%+ coverage)
- Compliance testing
- Security audit
- Penetration testing
- Performance testing

### Phase 5: Production Setup (Week 21)
- Database provisioning
- Redis setup
- S3 configuration
- SSL/DNS setup
- Monitoring activation

### Phase 6: Staging Deployment (Week 22)
- CI/CD final configuration
- Staging deployment
- Testing and validation

### Phase 7: Production Launch (Week 23-24)
- Production deployment
- Monitoring activation
- Security sign-off
- Go-live

---

## SECTION 6: IMMEDIATE ACTIONS (This Week)

### Day 1-2: Fix TypeScript Errors
```bash
cd apps/fra-backend
npm run type-check
# Fix all 59 errors
```

### Day 3: Set Up Test Infrastructure
```bash
npm install --save-dev jest @types/jest supertest
# Configure jest.config.ts
# Create first test file
```

### Day 4-5: Begin Auth API Implementation
- [ ] POST /api/v1/auth/signup
- [ ] POST /api/v1/auth/login
- [ ] Write tests for both endpoints

### Parallel Actions:
- [ ] Schedule security audit vendor (4-week buffer)
- [ ] Begin infrastructure provisioning planning
- [ ] Set up project tracking (Jira/Linear)

---

## SECTION 7: SUCCESS CRITERIA

### Pre-Staging Checklist
- [ ] All TypeScript errors fixed (0 errors)
- [ ] Backend APIs 100% implemented
- [ ] Unit test coverage ≥ 80%
- [ ] Integration test coverage ≥ 70%
- [ ] Security audit passing
- [ ] No high/critical vulnerabilities
- [ ] Performance benchmarks met (p95 < 2s)

### Pre-Production Checklist
- [ ] E2E tests for critical flows
- [ ] Load testing successful (10K concurrent users)
- [ ] Penetration testing completed
- [ ] Monitoring operational
- [ ] Database backups verified
- [ ] Disaster recovery tested
- [ ] Security sign-off obtained

---

## SECTION 8: RESOURCE REQUIREMENTS

| Role | Allocation | Duration |
|------|------------|----------|
| Backend Engineer (Senior) | 1 FTE | 12 weeks |
| Frontend Engineer | 1 FTE | 3 weeks |
| QA/Testing Engineer | 1 FTE | 6 weeks |
| DevOps Engineer | 1 FTE | 2 weeks |
| Security Engineer | 0.5 FTE | 3 weeks |
| Technical Lead | 0.5 FTE | Ongoing |

**Total:** ~25 FTE-weeks

---

## SECTION 9: RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| TypeScript errors block work | HIGH | HIGH | Fix in first 2-3 days |
| 0% test coverage delays launch | HIGH | CRITICAL | Implement testing from Day 1 |
| Security audit finds critical issues | MEDIUM | CRITICAL | Run audit early, schedule vendor |
| Infrastructure delays | LOW | HIGH | Start provisioning in parallel |
| Performance issues | MEDIUM | MEDIUM | Load test early and often |

---

## Quick Reference: File Locations

| Document | Path |
|----------|------|
| Architecture | `docs/ARCHITECTURE.md` |
| Compliance | `docs/COMPLIANCE.md` |
| Backend Strategy | `docs/markdown/BACKEND_ARCHITECTURE_STRATEGY.md` |
| Frontend Strategy | `docs/markdown/FRONTEND_ARCHITECTURE_STRATEGY.md` |
| Security Checklist | `docs/markdown/SECURITY_AUDIT_CHECKLIST.md` |
| Deployment Report | `docs/markdown/DEPLOYMENT_READINESS_REPORT.md` |
| Implementation Report | `FINAL_IMPLEMENTATION_REPORT.md` |
| Improvement Report | `IMPROVEMENT_REPORT_JAN_2026.md` |

---

**Total Actions Identified:** 127
**Critical (P0):** 42
**High (P1):** 35
**Medium (P2):** 50

**Next Step:** Start with fixing the 59 TypeScript errors in the backend.

---

*Generated from analysis of 50+ project documentation files*
