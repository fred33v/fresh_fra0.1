# START FRA Backend API - Quick Reference Card

**API Base URL:** `http://localhost:3000/api/v1` (dev) | `https://api.startfra.com/api/v1` (prod)

---

## Authentication

### Get Access Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

### Use Token in Requests
```bash
curl -H "Authorization: Bearer {accessToken}" \
  http://localhost:3000/api/v1/auth/me
```

### Refresh Expired Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "{refreshToken}"}'
```

---

## Assessments API

### Create Assessment
```bash
POST /assessments
{
  "title": "Fraud Risk Assessment 2026",
  "answers": {}
}
```

### Get Assessment
```bash
GET /assessments/{id}
```

### Update Assessment
```bash
PATCH /assessments/{id}
{
  "answers": {
    "Q1": "Yes",
    "Q2": "No",
    "Q3": "Partially"
  }
}
```

### Submit Assessment
```bash
POST /assessments/{id}/submit
```

### List User's Assessments
```bash
GET /assessments
GET /assessments?status=completed
```

### List Organization Assessments
```bash
GET /assessments/organisation/{orgId}
```

---

## Key-passes API

### Generate Key-passes
```bash
POST /keypasses/generate
{
  "quantity": 10,
  "expiresInDays": 30
}
```

### Validate Key-pass
```bash
POST /keypasses/validate
{
  "code": "ABC123DEF456"
}
```

### Use Key-pass (Employee Signup)
```bash
POST /keypasses/use
{
  "code": "ABC123DEF456",
  "email": "employee@company.com",
  "name": "Jane Smith"
}
```

### Get Quota Usage
```bash
GET /keypasses/organisation/{orgId}/quota
```

### List Key-passes
```bash
GET /keypasses/organisation/{orgId}
```

### Bulk Validate Multiple Codes
```bash
POST /keypasses/bulk-validate
{
  "codes": ["CODE1", "CODE2", "CODE3"]
}
```

---

## Payment & Packages API

### List Available Packages
```bash
GET /packages

Response:
[
  {
    "id": "pkg_basic",
    "name": "Basic",
    "price": 79900,
    "keypassAllowance": 0
  },
  {
    "id": "pkg_training",
    "name": "Training",
    "price": 179900,
    "keypassAllowance": 10,
    "currency": "gbp"
  },
  {
    "id": "pkg_full",
    "name": "Full",
    "price": 499900,
    "keypassAllowance": 50,
    "currency": "gbp"
  }
]
```

### Get AI-Recommended Package
```bash
GET /packages/recommended

Response:
{
  "packageId": "pkg_training",
  "reason": "medium_risk_score"
}
```

### Create Purchase
```bash
POST /purchases
{
  "packageId": "pkg_training"
}

Response:
{
  "purchaseId": "uuid",
  "paymentIntentId": "pi_xxx",
  "clientSecret": "pi_xxx_secret_xxx",
  "status": "requires_confirmation"
}
```

### Confirm Purchase
```bash
POST /purchases/{purchaseId}/confirm
{
  "paymentIntentId": "pi_xxx"
}
```

### Get Purchase Details
```bash
GET /purchases/{purchaseId}
```

### List Organization Purchases
```bash
GET /purchases/organisation/{orgId}
```

---

## Analytics API

### Get Organization Overview
```bash
GET /analytics/overview

Response:
{
  "totals": {
    "assessments": 42
  },
  "byStatus": {
    "draft": 5,
    "in_progress": 12,
    "submitted": 15,
    "completed": 10
  },
  "latestUpdatedAt": "2026-03-07T..."
}
```

### Get Assessment Timeline
```bash
GET /analytics/assessments
GET /analytics/assessments?from=2026-01-01&to=2026-03-01
GET /analytics/assessments?page=1&pageSize=50
```

### Get Dashboard Data
```bash
GET /analytics/dashboard
```

### Generate Report
```bash
POST /reports/generate

Response:
{
  "reportId": "rpt_xxx",
  "generatedAt": "2026-03-07T...",
  "summary": {
    "totalAssessments": 42,
    "overallRisk": "medium",
    "latestActivity": "2026-03-07T..."
  },
  "assessments": [...]
}
```

---

## Workshop API

### Create Training Session
```bash
POST /workshop/sessions
{
  "title": "Fraud Awareness Training - March 2026"
}

Response:
{
  "id": "session-uuid",
  "sessionCode": "ABC123",
  "title": "Fraud Awareness Training",
  "isActive": true
}
```

### Get Session by Code
```bash
GET /workshop/sessions/code/ABC123
```

### Join Session
```bash
POST /workshop/sessions/{sessionId}/join
```

### Subscribe to Live Updates (SSE)
```bash
GET /workshop/sessions/{sessionId}/sse?sse_token={token}

# Responds with Server-Sent Events stream
data: {"event":"slide_changed","slide":2}
data: {"event":"participant_joined","name":"John"}
```

### Update Session State
```bash
POST /workshop/sessions/{sessionId}/slide-changed/next
POST /workshop/sessions/{sessionId}/participant-activity/raise-hand
```

---

## User Profile API

### Get My Profile
```bash
GET /auth/me

Response:
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "employer",
  "organisationId": "org-uuid",
  "createdAt": "2026-01-01T..."
}
```

### Update Profile
```bash
PATCH /auth/profile
{
  "name": "Jane Doe",
  "department": "Risk Management"
}
```

### Request Password Reset
```bash
POST /auth/forgot-password
{
  "email": "user@example.com"
}
```

### Complete Password Reset
```bash
POST /auth/reset-password
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass123!"
}
```

### Logout
```bash
POST /auth/logout
```

---

## Common Error Responses

### 400 Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid signup payload"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid access token"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Requires employer or admin role"
  }
}
```

### 429 Rate Limited
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT",
    "message": "Too many requests, try again in 15 minutes"
  }
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/auth/signup` | 10 per 15 min |
| `/auth/login` | 20 per 15 min |
| `/auth/forgot-password` | 5 per hour |
| `/auth/refresh` | 10 per minute |
| `/assessments/*` | 20-30 per minute |
| `/keypasses/generate` | 10 per hour |
| `/purchases/*` | 10 per hour |
| `/analytics/*` | 20-30 per minute |
| `/reports/generate` | 5 per hour |

**Account Lockout:** 5 failed login attempts → 15 minute lockout

---

## Testing Endpoints

### Health Check
```bash
GET http://localhost:3000/health

Response:
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok"
  },
  "uptime": 3600,
  "version": "2.0.0"
}
```

### Debug DB Connection
```bash
GET /debug/db/ping

Response (requires auth):
{
  "success": true,
  "data": {"ok": 1}
}
```

---

## Environment Variables

**Required for Production:**
```
DATABASE_URL=postgresql://user:pass@host:5432/startfra
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=another-secret-key-min-32-chars
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
STRIPE_WEBHOOK_SECRET=whsec_...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

**Optional:**
```
JWT_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d
DB_POOL_MAX=20
CORS_ORIGINS=http://localhost:19006,https://app.startfra.com
NODE_ENV=production
```

---

## Development Commands

```bash
# Start dev server with hot reload
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start

# Run all tests
pnpm run test

# Run tests with coverage
pnpm run test:coverage

# Run linter
pnpm run lint

# Type check
pnpm run typecheck

# Run database migrations
pnpm run migrate
```

---

## Useful Resources

- **OpenAPI Docs:** (deployment in progress)
- **Webhook Testing:** `stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe`
- **Database UI:** pgAdmin or DBeaver (connect to DATABASE_URL)
- **Redis Monitoring:** Upstash console or redis-cli

---

**Last Updated:** March 7, 2026  
**API Version:** v2.0.0  
**Status:** Production Ready
