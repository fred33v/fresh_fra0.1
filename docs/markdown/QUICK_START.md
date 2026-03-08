# 🚀 Stop FRA - Quick Start Guide

Complete guide to launch the Stop FRA (Fraud Risk Assessment) platform locally.

**Last Updated:** January 1, 2026
**Version:** 2.0

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Testing the Application](#testing-the-application)
8. [Common Issues & Solutions](#common-issues--solutions)
9. [API Endpoints](#api-endpoints)
10. [Production Deployment](#production-deployment)

---

## 🔧 Prerequisites

### Required Software

Install these before starting:

| Software | Version | Installation | Verification |
|----------|---------|--------------|--------------|
| **Node.js** | ≥20.0.0 | [nodejs.org](https://nodejs.org) | `node --version` |
| **Bun** | Latest | [bun.sh](https://bun.sh) | `bun --version` |
| **PostgreSQL** | ≥14.0 | [postgresql.org](https://postgresql.org) | `psql --version` |
| **Git** | Latest | [git-scm.com](https://git-scm.com) | `git --version` |

### Optional (but recommended)

- **Redis** (for session management) - `brew install redis`
- **VS Code** (recommended IDE)
- **Expo Go** app (for mobile testing)

---

## 📁 Project Structure

```
stop_fra/
├── backend/                    # Node.js + Hono API
│   ├── src/
│   │   ├── controllers/       # API route handlers
│   │   ├── services/          # Business logic
│   │   ├── db/               # Database schema & migrations
│   │   ├── middleware/       # Auth, CORS, error handling
│   │   └── index.ts          # Server entry point
│   ├── .env                  # Environment variables
│   └── package.json
│
├── fraud-risk-app-main/       # React Native + Expo frontend
│   ├── app/                   # Expo Router screens
│   │   ├── auth/             # Login, signup, key-pass
│   │   ├── *.tsx             # Assessment screens
│   │   └── _layout.tsx       # Root layout
│   ├── contexts/             # React contexts
│   ├── services/             # API client
│   ├── constants/            # Config & colors
│   └── package.json
│
├── CLAUDE.MD                  # Project documentation
└── QUICK_START.md            # This file
```

---

## 🔐 Backend Setup

### Step 1: Navigate to Backend Directory

```bash
cd backend
```

### Step 2: Install Dependencies

```bash
bun install
```

### Step 3: Configure Environment Variables

The `.env` file is already configured for local development:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://hola@localhost:5432/stopfra_dev
JWT_SECRET=stopfra-dev-secret-2025
JWT_REFRESH_SECRET=stopfra-dev-refresh-2025
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_placeholder
AWS_REGION=eu-west-2
AWS_S3_BUCKET=stopfra-dev
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
FRONTEND_URL=http://localhost:8081
```

**⚠️ For production, change:**
- `JWT_SECRET` and `JWT_REFRESH_SECRET` (use strong random strings)
- `STRIPE_SECRET_KEY` (use live key)
- `DATABASE_URL` (point to production database)

### Step 4: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE stopfra_dev;

# Exit psql
\q
```

### Step 5: Run Database Migrations

```bash
# Generate migration files (if schema changed)
bun run db:generate

# Apply migrations to database
bun run db:migrate

# Seed database with initial data
bun run db:seed
```

### Step 6: Verify TypeScript Build

```bash
bun run build
```

**Expected output:**
```
$ tsc
✅ Successfully compiled (0 errors)
```

---

## 📱 Frontend Setup

### Step 1: Navigate to Frontend Directory

```bash
cd ../fraud-risk-app-main
```

### Step 2: Install Dependencies

```bash
bun install
```

### Step 3: Configure API Endpoint

The frontend is already configured to connect to `http://localhost:3000`.

Check [constants/api.ts](fraud-risk-app-main/constants/api.ts#L12):

```typescript
return 'http://localhost:3000';
```

---

## 💾 Database Setup

### Database Schema

The database includes these main tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (employers, employees) |
| `organisations` | Organization profiles |
| `assessments` | Fraud risk assessments |
| `assessment_answers` | Assessment questionnaire responses |
| `risk_register_items` | Identified risks with scores |
| `packages` | Available assessment packages |
| `purchases` | Payment transactions |
| `keypasses` | Employee access codes |
| `employee_assessments` | Individual employee assessments |
| `signatures` | Electronic signatures |
| `audit_logs` | Comprehensive audit trail |

### Seed Data

After running `bun run db:seed`, you'll have:

**Test Employer Account:**
- Email: `test-employer@example.com`
- Password: `Test123@Pass`
- Organisation: `Test Organisation`

**Packages:**
- Package 1: Basic (£799/year) - No features included
- Package 2: Training (£1,799/year) - Full assessment + training
- Package 3: Full (£4,999/year) - Everything + priority support

**Stripe Test Cards:**
- Success: `4242 4242 4242 4242`
- 3D Secure: `4000 0027 6000 3184`
- Decline: `4000 0000 0000 0002`
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)

---

## 🎯 Running the Application

### Terminal 1: Start Backend

```bash
cd backend
bun run dev
```

**Expected output:**
```
🚀 Stop FRA Backend API starting on port 3000...
📝 Environment: development
🔗 API Base URL: http://localhost:3000/api/v1
❤️  Health check: http://localhost:3000/health

📚 Available endpoints:
   - POST /api/v1/auth/signup
   - POST /api/v1/auth/login
   - POST /api/v1/assessments
   - POST /api/v1/keypasses/allocate
   - GET  /api/v1/packages
   - POST /api/v1/purchases
   - GET  /api/v1/compliance/report

🔒 Audit logging enabled (all requests logged)
⏰ Data retention scheduler: Daily at 2 AM

✅ Database connected successfully
```

**Backend is now running on:** `http://localhost:3000`

### Terminal 2: Start Frontend

```bash
cd fraud-risk-app-main
bun run start
```

**Expected output:**
```
Starting Metro Bundler...
Metro waiting on exp://localhost:8081

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web browser
```

**Frontend is now running on:** `http://localhost:8081` (web) or scan QR code for mobile

### Terminal 3: Monitor Logs (Optional)

```bash
# Watch backend logs
tail -f /tmp/backend.log

# Or watch database queries
cd backend
bun run db:studio
```

---

## ✅ Testing the Application

### Test 1: Health Check

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-01T19:00:00.000Z",
  "uptime": 123.45,
  "environment": "development"
}
```

### Test 2: Create Employer Account

**Via Web Browser:**
1. Open `http://localhost:8081`
2. Click "Create your account"
3. Fill in:
   - Organisation: `My Test Company`
   - Email: `myemail@example.com`
   - Password: `MyPass123!` (must meet requirements)
   - Confirm password
   - Accept terms
4. Click "Create Account"

**Password Requirements:**
- ✅ At least 8 characters
- ✅ One lowercase letter
- ✅ One uppercase letter
- ✅ One number
- ✅ One special character (!@#$%^&*)

**Via API:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123@Pass",
    "organisationName": "Test Organisation"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid-here",
      "email": "test@example.com",
      "role": "employer",
      "organisationId": "org-uuid"
    },
    "organisation": {
      "organisationId": "org-uuid",
      "name": "Test Organisation"
    },
    "accessToken": "jwt-token-here",
    "refreshToken": "refresh-token-here"
  }
}
```

### Test 3: Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-employer@example.com",
    "password": "Test123@Pass"
  }'
```

### Test 4: Get Packages

```bash
curl http://localhost:3000/api/v1/packages
```

### Test 5: Payment Testing with Stripe Test Cards

The platform uses Stripe for payment processing. In development/test mode, use these test cards:

#### Successful Payment Cards

**Standard Success:**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**3D Secure Authentication (Success):**
```
Card Number: 4000 0027 6000 3184
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
Note: Will prompt for 3D Secure authentication
```

#### Test Card for Different Scenarios

**Insufficient Funds:**
```
Card Number: 4000 0000 0000 9995
Result: Payment declined (insufficient_funds)
```

**Generic Decline:**
```
Card Number: 4000 0000 0000 0002
Result: Payment declined (generic_decline)
```

**Expired Card:**
```
Card Number: 4000 0000 0000 0069
Result: Payment declined (expired_card)
```

**Incorrect CVC:**
```
Card Number: 4000 0000 0000 0127
Result: Payment declined (incorrect_cvc)
```

**Processing Error:**
```
Card Number: 4000 0000 0000 0119
Result: Payment declined (processing_error)
```

#### Package Pricing

Test package purchases with these prices:

| Package | Price | Key-Passes | Features |
|---------|-------|------------|----------|
| **Package 1: Basic** | £799/year | 0 | No features - upgrade required |
| **Package 2: Training** | £1,799/year | 10 | Full assessment + training modules |
| **Package 3: Full** | £4,999/year | 50 | Everything + priority support |

#### Testing Payment Flow

1. **Login with test account**
2. **Navigate to packages screen**
3. **Select a package**
4. **Enter test card details:**
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`
5. **Confirm payment**
6. **Verify key-passes allocated**

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "purchaseId": "uuid",
    "status": "success",
    "packageType": "with-dashboard",
    "amount": 1299.00,
    "keypassesAllocated": 250
  }
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Port 3000 Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Find and kill process using port 3000
lsof -ti :3000 | xargs kill -9

# Or use a different port
PORT=3001 bun run dev
```

### Issue 2: Database Connection Failed

**Error:**
```
❌ Database connection failed
```

**Solution:**
```bash
# Check PostgreSQL is running
pg_isready

# If not running, start it
brew services start postgresql@14

# Verify database exists
psql -l | grep stopfra_dev

# If not exists, create it
createdb stopfra_dev
```

### Issue 3: CORS Errors in Browser

**Error:**
```
Access to fetch blocked by CORS policy
```

**Solution:**
The backend is already configured to allow:
- Expo tunnel URLs (*.exp.direct, *.exp.dev)
- Localhost variations
- Custom frontend URLs via `FRONTEND_URL` env var

If still blocked, check:
1. Backend is running
2. Frontend URL matches CORS config
3. Clear browser cache

### Issue 4: Password Validation Fails

**Error:**
```
Weak Password: Password must contain at least one special character
```

**Solution:**
Ensure password meets ALL requirements:
```
✓ At least 8 characters
✓ One lowercase letter (a-z)
✓ One uppercase letter (A-Z)
✓ One number (0-9)
✓ One special character (!@#$%^&*)
```

**Valid examples:**
- `Test123@Pass`
- `Admin2024!`
- `Secure1#Pass`
- `MyPass99$`

### Issue 5: Migration Errors

**Error:**
```
Migration failed: relation already exists
```

**Solution:**
```bash
# Drop and recreate database
dropdb stopfra_dev
createdb stopfra_dev

# Re-run migrations
cd backend
bun run db:migrate
bun run db:seed
```

### Issue 6: TypeScript Errors

**Error:**
```
TS2349: This expression is not callable
```

**Solution:**
All TypeScript errors have been resolved in version 2.0.
If you see errors, ensure you're on the latest commit:

```bash
git pull origin main
cd backend
bun install
bun run build
```

---

## 📡 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/signup` | Register employer account | No |
| POST | `/api/v1/auth/login` | Login with email/password | No |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| GET | `/api/v1/auth/me` | Get current user info | Yes |

### Assessment Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/assessments` | Create new assessment | Yes |
| GET | `/api/v1/assessments/:id` | Get assessment details | Yes |
| PATCH | `/api/v1/assessments/:id` | Update assessment | Yes |
| POST | `/api/v1/assessments/:id/submit` | Submit assessment | Yes |
| GET | `/api/v1/assessments/:id/risk-register` | Get risk register | Yes |

### Package & Payment Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/packages` | List all packages | No |
| GET | `/api/v1/packages/recommended` | Get recommended package | Yes |
| POST | `/api/v1/purchases` | Create purchase | Yes |
| POST | `/api/v1/purchases/:id/confirm` | Confirm payment | Yes |

### Key-Pass Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/keypasses/allocate` | Allocate key-passes | Yes |
| POST | `/api/v1/keypasses/validate` | Validate key-pass | No |
| POST | `/api/v1/keypasses/use` | Use key-pass (employee login) | No |
| GET | `/api/v1/keypasses/organisation/:orgId` | List org key-passes | Yes |

### Compliance Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/compliance/report` | Generate ECCTA 2023 report | Yes |

---

## 🚀 Production Deployment

### Backend Deployment (Railway/Heroku/AWS)

**1. Build Production Bundle:**
```bash
cd backend
bun run build
```

**2. Set Environment Variables:**
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://prod-user:pass@prod-host:5432/stopfra_prod
JWT_SECRET=<STRONG_RANDOM_STRING>
JWT_REFRESH_SECRET=<STRONG_RANDOM_STRING>
STRIPE_SECRET_KEY=sk_live_your_key
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=stopfra-production
REDIS_URL=redis://prod-redis:6379
```

**3. Run Migrations:**
```bash
bun run db:migrate
```

**4. Start Server:**
```bash
bun run start
```

### Frontend Deployment (EAS/Vercel/Netlify)

**For iOS & Android (EAS):**
```bash
cd fraud-risk-app-main

# Install EAS CLI
bun i -g @expo/eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

**For Web (Vercel):**
```bash
# Push to GitHub
git push origin main

# Connect to Vercel
# Deploy automatically via GitHub integration
```

**Environment Variables for Production:**
```env
EXPO_PUBLIC_API_URL=https://api.stopfra.com
```

---

## 📞 Support & Documentation

### Documentation Files

- **[CLAUDE.MD](CLAUDE.MD)** - Complete project documentation
- **[BACKEND-SPECIFICATION.md](fraud-risk-app-main/docs/BACKEND-SPECIFICATION.md)** - API specification
- **[FRA_n8n_workflow_v2.json](FRA_n8n_workflow_v2.json)** - n8n automation workflow

### Key Features

✅ **Authentication:** JWT-based with role-based access control
✅ **Assessment System:** 13 comprehensive modules (Risk Appetite → Compliance Mapping)
✅ **Package System:** 3-tier pricing with key-pass distribution
✅ **Risk Scoring:** Automated inherent/residual risk calculation
✅ **Dashboard:** Real-time analytics for employers (Package 3)
✅ **Compliance:** ECCTA 2023 & GovS-013 compliant reporting
✅ **Audit Logging:** Comprehensive activity tracking
✅ **Data Retention:** Automated 6-year compliance management

### Project Status

| Component | Status | Errors |
|-----------|--------|--------|
| Backend API | ✅ Production Ready | 0 |
| Frontend App | ✅ Production Ready | 0 |
| Database Schema | ✅ Complete | - |
| TypeScript | ✅ 100% Type Safe | 0 |
| Authentication | ✅ Functional | - |
| Payment Integration | ⚠️ Test Mode | - |
| n8n Workflow | ⚠️ Needs Config | - |

---

## 🎉 You're Ready!

Your Stop FRA platform is now running locally and ready for development or testing.

**Quick Summary:**
1. ✅ Backend running on http://localhost:3000
2. ✅ Frontend running on http://localhost:8081
3. ✅ Database connected and seeded
4. ✅ 100% TypeScript error-free
5. ✅ CORS configured for development
6. ✅ Authentication working

**Test Account:**
- Email: `test-employer@example.com`
- Password: `Test123@Pass`

**Test Payment Card:**
- Card: `4242 4242 4242 4242`
- Expiry: `12/34`
- CVC: `123`
- ZIP: `12345`

**Next Steps:**
1. Test signup/login flow
2. Complete an assessment
3. Purchase a package (use test card above)
4. Allocate key-passes
5. View dashboard (Package 3)

---

**🔗 Useful Links:**
- Repository: https://github.com/deric7223r-tech/stop_fra
- Expo Docs: https://docs.expo.dev
- Hono Docs: https://hono.dev
- Drizzle ORM: https://orm.drizzle.team

**Need Help?**
Open an issue on GitHub or check the troubleshooting section above.

---

**Built with ❤️ using Claude Code**
