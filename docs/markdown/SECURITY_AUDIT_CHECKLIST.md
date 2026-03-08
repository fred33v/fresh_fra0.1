# Security Audit Checklist - Stop FRA Platform

**Version:** 1.0
**Date:** December 21, 2025
**Purpose:** Pre-launch security audit and penetration testing preparation

---

## Executive Summary

This document provides a comprehensive security audit checklist for the Stop FRA (Fraud Risk Assessment) platform. It covers all critical security areas required before production launch, aligned with UK government security standards (GovS-013) and ECCTA 2023 requirements.

---

## 1. Authentication & Authorization

### 1.1 Authentication Mechanisms

- [ ] **Password Security**
  - [ ] Passwords hashed with bcrypt/Argon2 (cost factor 10+)
  - [ ] Minimum password length enforced (12+ characters)
  - [ ] Password complexity requirements implemented
  - [ ] Password reset functionality secure (time-limited tokens)
  - [ ] No passwords logged or stored in plaintext anywhere

- [ ] **JWT Token Security**
  - [ ] JWT tokens signed with strong secret (256-bit minimum)
  - [ ] Token expiration enforced (15-60 minutes for access tokens)
  - [ ] Refresh token rotation implemented
  - [ ] Token blacklisting on logout
  - [ ] Token verification on all protected routes
  - [ ] No sensitive data stored in JWT payload

- [ ] **Key-Pass System**
  - [ ] Key-pass codes cryptographically random (UUID v4 or better)
  - [ ] Key-pass codes single-use only
  - [ ] Key-pass codes expire after defined period (30 days)
  - [ ] Key-pass validation rate limited
  - [ ] Key-pass usage audit logged

### 1.2 Authorization & Access Control

- [ ] **Role-Based Access Control (RBAC)**
  - [ ] Employer role permissions enforced
  - [ ] Employee role permissions enforced
  - [ ] Admin role permissions enforced
  - [ ] Organisation-scoped data access enforced
  - [ ] Package-based feature gating working correctly

- [ ] **API Endpoint Protection**
  - [ ] All endpoints require authentication (except public routes)
  - [ ] User can only access own organisation's data
  - [ ] Admin endpoints restricted to admin role
  - [ ] Dashboard endpoints restricted to Package 3 users
  - [ ] Employee assessment endpoints restricted to key-pass holders

### 1.3 Session Management

- [ ] **Session Security**
  - [ ] Session tokens stored securely (httpOnly, secure, sameSite cookies)
  - [ ] Session timeout enforced (30 minutes idle, 8 hours absolute)
  - [ ] Concurrent session limits enforced
  - [ ] Session invalidation on logout
  - [ ] Session fixation attacks prevented

---

## 2. Input Validation & Sanitization

### 2.1 API Input Validation

- [ ] **Data Validation**
  - [ ] All request bodies validated against schema (Zod/Joi)
  - [ ] Query parameters validated and sanitized
  - [ ] Path parameters validated (UUIDs, numeric IDs)
  - [ ] File uploads validated (type, size, content)
  - [ ] JSON payloads validated for structure and types

- [ ] **SQL Injection Prevention**
  - [ ] All database queries use parameterized statements
  - [ ] No string concatenation in SQL queries
  - [ ] ORM/query builder used correctly (no raw SQL with user input)
  - [ ] Database user has minimum required privileges

### 2.2 Output Encoding

- [ ] **XSS Prevention**
  - [ ] User-generated content escaped before rendering
  - [ ] HTML entities encoded in email templates
  - [ ] JSON responses properly encoded
  - [ ] Content-Security-Policy headers set

### 2.3 File Upload Security

- [ ] **Signature Upload Protection**
  - [ ] File type validation (PNG, JPEG only)
  - [ ] File size limits enforced (< 5MB)
  - [ ] File content validation (magic bytes check)
  - [ ] Files stored outside web root
  - [ ] Unique random filenames assigned
  - [ ] S3 bucket not publicly accessible

---

## 3. Data Protection & Privacy

### 3.1 Data at Rest

- [ ] **Encryption**
  - [ ] Database encryption enabled (PostgreSQL TDE)
  - [ ] S3 bucket encryption enabled (AES-256)
  - [ ] Sensitive fields encrypted in database (PII, financial data)
  - [ ] Encryption keys securely managed (AWS KMS, HashiCorp Vault)
  - [ ] Backup encryption enabled

- [ ] **Data Retention**
  - [ ] 6-year retention policy implemented (fraud records)
  - [ ] 7-year retention policy implemented (financial records)
  - [ ] Automated archival after 1 year
  - [ ] Automated deletion after retention period
  - [ ] Data retention compliance reporting available

### 3.2 Data in Transit

- [ ] **HTTPS/TLS**
  - [ ] HTTPS enforced on all endpoints
  - [ ] TLS 1.2+ required (TLS 1.0/1.1 disabled)
  - [ ] Strong cipher suites configured
  - [ ] Valid SSL certificate installed
  - [ ] HSTS header set (Strict-Transport-Security)

### 3.3 GDPR & UK Data Protection

- [ ] **Privacy Compliance**
  - [ ] Privacy policy documented and accessible
  - [ ] Cookie consent mechanism implemented
  - [ ] Data subject access request (DSAR) process documented
  - [ ] Right to erasure (RTBF) process documented
  - [ ] Data processing agreements in place
  - [ ] Data breach notification procedure documented

---

## 4. API Security

### 4.1 Rate Limiting

- [ ] **Rate Limiting**
  - [ ] Authentication endpoints rate limited (5 attempts/15 min)
  - [ ] Key-pass validation rate limited (3 attempts/min)
  - [ ] API endpoints rate limited (100 requests/min per user)
  - [ ] Payment endpoints rate limited (10 requests/hour)
  - [ ] Report generation rate limited (5 requests/hour)

### 4.2 API Hardening

- [ ] **Security Headers**
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] X-XSS-Protection: 1; mode=block
  - [ ] Referrer-Policy: strict-origin-when-cross-origin
  - [ ] Content-Security-Policy configured
  - [ ] Permissions-Policy configured

- [ ] **CORS Configuration**
  - [ ] CORS restricted to known origins
  - [ ] Credentials allowed only for trusted origins
  - [ ] Preflight requests handled correctly

### 4.3 API Documentation

- [ ] **Documentation Security**
  - [ ] API documentation does not expose sensitive information
  - [ ] Example requests do not contain real credentials/tokens
  - [ ] Internal/admin endpoints not documented publicly
  - [ ] Security considerations documented for each endpoint

---

## 5. Third-Party Integrations

### 5.1 Payment Processing (Stripe)

- [ ] **Stripe Integration Security**
  - [ ] Stripe API keys stored securely (environment variables)
  - [ ] Webhook signature verification implemented
  - [ ] Payment amounts validated server-side
  - [ ] PCI DSS compliance documented
  - [ ] No card details stored locally
  - [ ] Stripe.js used for client-side card handling

### 5.2 Email Service

- [ ] **Email Security**
  - [ ] SPF records configured
  - [ ] DKIM signing enabled
  - [ ] DMARC policy configured
  - [ ] Email rate limiting implemented
  - [ ] No sensitive data in email bodies
  - [ ] Unsubscribe mechanism implemented

### 5.3 n8n Workflow Automation

- [ ] **n8n Security**
  - [ ] Webhook endpoints authenticated
  - [ ] n8n instance not publicly accessible
  - [ ] Credentials encrypted in n8n
  - [ ] Workflow error handling secure
  - [ ] No sensitive data logged

---

## 6. Infrastructure & Deployment

### 6.1 Server Hardening

- [ ] **Operating System**
  - [ ] OS patches up to date
  - [ ] Unnecessary services disabled
  - [ ] Firewall configured (only required ports open)
  - [ ] SSH key-based authentication only
  - [ ] Root login disabled
  - [ ] Fail2ban or similar intrusion prevention installed

### 6.2 Database Security

- [ ] **PostgreSQL Hardening**
  - [ ] Database not exposed to public internet
  - [ ] Strong database passwords (20+ characters)
  - [ ] Least privilege database users
  - [ ] Database connection pooling configured
  - [ ] Query logging enabled for audit
  - [ ] Regular database backups automated
  - [ ] Backup encryption enabled

### 6.3 Container Security (if using Docker)

- [ ] **Container Hardening**
  - [ ] Base images from trusted sources
  - [ ] Images scanned for vulnerabilities (Trivy, Snyk)
  - [ ] Containers run as non-root user
  - [ ] Read-only file systems where possible
  - [ ] Resource limits configured (CPU, memory)
  - [ ] Secrets not baked into images

### 6.4 Cloud Security (AWS/Azure/GCP)

- [ ] **Cloud Configuration**
  - [ ] IAM roles follow least privilege
  - [ ] Security groups properly configured
  - [ ] S3 buckets not publicly accessible
  - [ ] CloudTrail/Activity logs enabled
  - [ ] Multi-factor authentication enforced for admin accounts
  - [ ] Regular security audits (AWS Config, Azure Security Center)

---

## 7. Logging & Monitoring

### 7.1 Audit Logging

- [ ] **Comprehensive Audit Trail**
  - [ ] All authentication events logged
  - [ ] All data access events logged
  - [ ] All data modification events logged
  - [ ] All payment transactions logged
  - [ ] All admin actions logged
  - [ ] Logs include: timestamp, user ID, IP address, user agent, action
  - [ ] 6-year log retention enforced

### 7.2 Security Monitoring

- [ ] **Real-Time Monitoring**
  - [ ] Failed authentication attempts monitored
  - [ ] Unusual activity patterns detected (brute force, SQL injection)
  - [ ] Critical errors alerting configured
  - [ ] Security incidents escalated to team
  - [ ] Log aggregation and analysis (ELK, Splunk, CloudWatch)

### 7.3 Incident Response

- [ ] **Incident Response Plan**
  - [ ] Security incident response plan documented
  - [ ] Incident escalation procedures defined
  - [ ] Data breach notification procedure documented
  - [ ] Forensic logging enabled
  - [ ] Incident response team identified

---

## 8. Dependency Security

### 8.1 Dependency Management

- [ ] **Package Security**
  - [ ] npm audit run regularly (weekly)
  - [ ] Dependabot/Renovate configured for automated updates
  - [ ] Known vulnerable packages patched
  - [ ] Lock files (package-lock.json, bun.lockb) committed
  - [ ] Unused dependencies removed

### 8.2 Software Composition Analysis

- [ ] **SCA Tools**
  - [ ] Snyk, WhiteSource, or similar SCA tool integrated
  - [ ] License compliance checked
  - [ ] Transitive dependencies analyzed
  - [ ] Regular dependency vulnerability reports reviewed

---

## 9. Code Security

### 9.1 Secure Coding Practices

- [ ] **Code Review**
  - [ ] All code peer-reviewed before merge
  - [ ] Security-focused code review checklist used
  - [ ] No hardcoded secrets (API keys, passwords)
  - [ ] No commented-out sensitive code
  - [ ] Error messages do not leak sensitive information

### 9.2 Static Analysis

- [ ] **SAST Tools**
  - [ ] ESLint security plugin configured
  - [ ] SonarQube or similar SAST tool integrated
  - [ ] TypeScript strict mode enabled
  - [ ] Code complexity metrics monitored

### 9.3 Secrets Management

- [ ] **Secrets Security**
  - [ ] Environment variables used for secrets
  - [ ] .env files not committed to git
  - [ ] Secrets rotation policy documented
  - [ ] AWS Secrets Manager, HashiCorp Vault, or similar used
  - [ ] No secrets in client-side code

---

## 10. Testing & QA

### 10.1 Security Testing

- [ ] **Test Coverage**
  - [ ] Unit tests for authentication/authorization logic
  - [ ] Integration tests for API security
  - [ ] End-to-end tests for critical user flows
  - [ ] Security regression tests for known vulnerabilities

### 10.2 Penetration Testing

- [ ] **Pentest Scope**
  - [ ] External penetration test scheduled
  - [ ] Internal penetration test scheduled
  - [ ] Social engineering assessment planned
  - [ ] Test environment prepared (non-production)
  - [ ] Pentest report review process defined
  - [ ] Remediation timeline established

### 10.3 Vulnerability Scanning

- [ ] **Automated Scanning**
  - [ ] OWASP ZAP or Burp Suite scans run
  - [ ] Infrastructure vulnerability scans (Nessus, Qualys)
  - [ ] SSL/TLS configuration tested (SSL Labs)
  - [ ] Web application firewall (WAF) configured

---

## 11. Compliance & Regulations

### 11.1 GovS-013 Compliance

- [ ] **UK Government Standard**
  - [ ] Counter-fraud controls implemented
  - [ ] Fraud risk assessments documented
  - [ ] Fraud response plan documented
  - [ ] Regular compliance reviews scheduled

### 11.2 ECCTA 2023 Compliance

- [ ] **Economic Crime Act**
  - [ ] Reasonable prevention procedures documented
  - [ ] Automated compliance reporting implemented
  - [ ] Due diligence processes documented
  - [ ] Senior management accountability established

### 11.3 WCAG 2.1 Level AA Compliance

- [ ] **Accessibility**
  - [ ] Screen reader compatibility tested
  - [ ] Keyboard navigation working
  - [ ] Color contrast ratios compliant
  - [ ] Form labels and error messages accessible
  - [ ] ARIA roles correctly implemented

---

## 12. Disaster Recovery & Business Continuity

### 12.1 Backup & Recovery

- [ ] **Backup Strategy**
  - [ ] Database backups automated (daily full, hourly incremental)
  - [ ] Backup retention policy documented (30 days online, 6 years archived)
  - [ ] Backup encryption enabled
  - [ ] Backup restoration tested (quarterly)
  - [ ] Recovery Time Objective (RTO) defined (< 4 hours)
  - [ ] Recovery Point Objective (RPO) defined (< 1 hour)

### 12.2 High Availability

- [ ] **Redundancy**
  - [ ] Database replication configured (primary + standby)
  - [ ] Application servers load balanced
  - [ ] Multi-region deployment considered
  - [ ] Health checks and auto-scaling configured
  - [ ] Failover procedures documented

---

## 13. Documentation

### 13.1 Security Documentation

- [ ] **Required Documents**
  - [ ] Security architecture diagram
  - [ ] Data flow diagrams
  - [ ] Threat model documentation
  - [ ] Security policy document
  - [ ] Acceptable use policy
  - [ ] Incident response runbook
  - [ ] Disaster recovery plan

### 13.2 Training & Awareness

- [ ] **Team Training**
  - [ ] Security awareness training completed by team
  - [ ] Secure coding training completed
  - [ ] OWASP Top 10 awareness
  - [ ] Phishing awareness training

---

## 14. Pre-Launch Security Sign-Off

### 14.1 Final Checklist

- [ ] **Security Review**
  - [ ] All critical vulnerabilities resolved
  - [ ] All high vulnerabilities resolved or accepted risk documented
  - [ ] Penetration test report reviewed
  - [ ] Security sign-off from CISO/Security Lead
  - [ ] Legal review completed
  - [ ] Privacy impact assessment completed

### 14.2 Launch Readiness

- [ ] **Go-Live Checklist**
  - [ ] Monitoring dashboards configured
  - [ ] Alerting rules tested
  - [ ] On-call rotation established
  - [ ] Incident response team briefed
  - [ ] Rollback plan documented
  - [ ] Launch date security review scheduled (post-launch)

---

## Appendix A: OWASP Top 10 Coverage

### A01:2021 - Broken Access Control
- ✅ Role-based access control implemented
- ✅ Organisation-scoped data access enforced
- ✅ Direct object references validated

### A02:2021 - Cryptographic Failures
- ✅ HTTPS enforced
- ✅ Strong password hashing (bcrypt/Argon2)
- ✅ Database encryption enabled

### A03:2021 - Injection
- ✅ Parameterized SQL queries
- ✅ Input validation and sanitization
- ✅ ORM/query builder used

### A04:2021 - Insecure Design
- ✅ Threat modeling completed
- ✅ Security requirements defined
- ✅ Defense in depth implemented

### A05:2021 - Security Misconfiguration
- ✅ Security headers configured
- ✅ Unnecessary services disabled
- ✅ Default credentials changed

### A06:2021 - Vulnerable and Outdated Components
- ✅ Dependency scanning automated
- ✅ Regular security updates applied
- ✅ SCA tools integrated

### A07:2021 - Identification and Authentication Failures
- ✅ Strong password policy
- ✅ JWT token security
- ✅ Session management secure

### A08:2021 - Software and Data Integrity Failures
- ✅ CI/CD pipeline security
- ✅ Code signing considered
- ✅ Dependency integrity verified

### A09:2021 - Security Logging and Monitoring Failures
- ✅ Comprehensive audit logging
- ✅ Real-time monitoring
- ✅ Incident response procedures

### A10:2021 - Server-Side Request Forgery (SSRF)
- ✅ URL validation on server-side
- ✅ Network segmentation
- ✅ Whitelist allowed domains

---

## Appendix B: API Endpoint Inventory

### Public Endpoints (No Authentication)
- `GET /` - Health check
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/keypass-login` - Employee key-pass login
- `GET /api/packages` - List packages

### Authenticated Endpoints (JWT Required)
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/assessments/:id` - Get assessment
- `POST /api/assessments` - Create assessment
- `PATCH /api/assessments/:id` - Update assessment
- `POST /api/assessments/:id/submit` - Submit assessment
- `GET /api/risk-register/:assessmentId` - Get risk register
- `POST /api/purchases` - Create purchase
- `POST /api/purchases/:id/confirm` - Confirm payment
- `POST /api/signatures` - Create signature
- `POST /api/feedback` - Submit feedback

### Admin Endpoints (Admin Role Required)
- `GET /api/admin/users` - List all users
- `GET /api/admin/organisations` - List all organisations
- `GET /api/admin/feedback` - List all feedback
- `POST /api/compliance/data-retention/run` - Trigger retention job

### Package 3 Endpoints (Dashboard Access)
- `GET /api/dashboard/organisation/:orgId` - Dashboard metrics
- `GET /api/dashboard/organisation/:orgId/export` - Export data

### Compliance Endpoints (Authenticated)
- `GET /api/compliance/report` - ECCTA 2023 report (JSON)
- `GET /api/compliance/report/html` - ECCTA 2023 report (HTML)
- `GET /api/compliance/report/json` - ECCTA 2023 report (download)
- `GET /api/compliance/audit-logs` - Query audit logs
- `GET /api/compliance/audit-logs/summary` - Audit log summary
- `GET /api/compliance/data-retention` - Data retention status

---

## Appendix C: Threat Model

### Threats

1. **Unauthorized Data Access**
   - **Attack Vector**: Broken access control, SQL injection
   - **Mitigation**: RBAC, parameterized queries, organisation scoping

2. **Account Takeover**
   - **Attack Vector**: Credential stuffing, brute force, session hijacking
   - **Mitigation**: Rate limiting, strong passwords, secure session management

3. **Key-Pass Theft**
   - **Attack Vector**: Key-pass code interception or guessing
   - **Mitigation**: Cryptographically random codes, single-use, expiration, rate limiting

4. **Payment Fraud**
   - **Attack Vector**: Manipulated payment amounts, stolen payment methods
   - **Mitigation**: Server-side validation, Stripe integration, webhook verification

5. **Data Exfiltration**
   - **Attack Vector**: Unauthorized data export, API abuse
   - **Mitigation**: Audit logging, rate limiting, access controls

6. **Insider Threat**
   - **Attack Vector**: Malicious employee accessing customer data
   - **Mitigation**: Comprehensive audit logging, least privilege, separation of duties

7. **Denial of Service (DoS)**
   - **Attack Vector**: API flooding, resource exhaustion
   - **Mitigation**: Rate limiting, WAF, auto-scaling, DDoS protection

---

## Contact Information

**Security Lead:** [TBD]
**Security Email:** security@stopfra.com
**Bug Bounty Program:** [TBD]
**Responsible Disclosure Policy:** [TBD]

---

**Document Version:** 1.0
**Last Updated:** December 21, 2025
**Next Review Date:** Pre-launch security audit
