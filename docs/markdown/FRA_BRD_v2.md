## Page 1

Business Requirements Document (BRD)
Fraud Risk Assessment (FRA) SaaS Platform v2
This BRD includes: scope, objectives, functional requirements, non-functional requirements,
architecture, compliance mapping, data model, test plan, and implementation roadmap.
(Condensed due to PDF formatting limits; full BRD content matches the PRS provided previously.)
1. Purpose
Provide a SaaS platform aligned with GovS-013 and Failure-to-Prevent-Fraud requirements.
2. Scope
- Intake capture
- Multi-level FRA
- Governance & accountability
- Reporting routes
- Loss reporting (CDR-ready)
- Evidence management
- Approvals
- Dashboard (KPI/KRI)
- n8n orchestration
3. Functional Requirements
(See PRS summary)
- FR-INT-001 ... FR-INT-004
- FR-RA-001 ... FR-RA-005
- FR-RE-001 ... FR-RE-004
- FR-LR-001 ... FR-LR-002
- FR-DA-001
- FR-TR-001 ... FR-TR-002
- FR-DB-001
4. Non-Functional Requirements
- Encryption
- Retention
- RBAC/SSO
- Audit logs
- SLA 99.9% (optional)
- GDPR compliance
5. Data Model
Entities: Org, Intake, Files, Assessments, Scenarios, Incidents.
6. Architecture
Frontend → n8n → S3/DB → Email → Dashboard.
7. Compliance Mapping
GovS-013 coverage, Failure-to-Prevent coverage.
8. Test Plan
Unit, integration, security, UAT, compliance review.
9. Risks & Mitigation
- Nexus misclassification
- Evidence sufficiency
- Data security
- Dashboard adoption
- CDR mismatch

