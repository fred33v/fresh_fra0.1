# CI/CD Workflows - Quick Reference

A quick reference guide for all GitHub Actions workflows in the Stop FRA project.

---

## Workflow Files

| File | Purpose | Trigger | Duration |
|------|---------|---------|----------|
| `frontend-ci.yml` | Test, lint, build frontend | Push, PR | ~5-10 min |
| `backend-ci.yml` | Test, lint, build backend | Push, PR | ~10-15 min |
| `deploy-staging.yml` | Deploy to staging | Push to develop | ~10-15 min |
| `deploy-production.yml` | Deploy to production | Push to main, tags | ~20-30 min |
| `security-monitoring.yml` | Security scans | Daily 2 AM UTC | ~10-15 min |

---

## Common Commands

### View Workflow Status
```bash
# List all workflows
gh workflow list

# View specific workflow runs
gh run list --workflow=frontend-ci.yml

# View run details
gh run view <run-id>
```

### Trigger Manual Workflow
```bash
# Trigger staging deployment
gh workflow run deploy-staging.yml

# Trigger production deployment
gh workflow run deploy-production.yml

# Trigger security scan
gh workflow run security-monitoring.yml
```

### Download Artifacts
```bash
# List artifacts from a run
gh run view <run-id> --log

# Download specific artifact
gh run download <run-id> -n web-build
```

---

## Workflow Jobs Overview

### Frontend CI
```
frontend-ci.yml
├── test (tests + coverage)
├── lint (ESLint)
├── security (npm audit, Snyk)
├── build (Expo web build)
└── test-coverage-gate (PR only)
```

### Backend CI
```
backend-ci.yml
├── test (tests + coverage + PostgreSQL)
├── security (npm audit, Snyk, OWASP)
├── build (TypeScript compile)
├── integration-test (full API test)
└── api-schema-validation (OpenAPI)
```

### Deploy Staging
```
deploy-staging.yml
├── deploy-backend-staging
│   ├── Build
│   ├── SSH deploy
│   ├── Run migrations
│   ├── PM2 restart
│   └── Health check
└── deploy-frontend-staging
    ├── Build web app
    ├── Deploy to Vercel
    └── Update domain
```

### Deploy Production
```
deploy-production.yml
├── pre-deployment-checks
│   ├── Run all tests
│   ├── Check coverage (≥80%)
│   └── Security audit
├── deploy-backend-production
│   ├── Backup current version
│   ├── Build & deploy
│   ├── Run migrations
│   ├── Health check
│   └── Rollback on failure
├── deploy-frontend-production
│   ├── Build production app
│   └── Deploy to Vercel
├── mobile-app-build (tags only)
│   ├── Build iOS (EAS)
│   └── Build Android (EAS)
└── post-deployment-tests
    ├── API smoke tests
    └── Frontend smoke test
```

### Security Monitoring
```
security-monitoring.yml
├── dependency-audit
│   ├── npm audit (frontend + backend)
│   └── Create issue if vulnerabilities
├── snyk-security-scan
│   └── Upload SARIF results
├── codeql-analysis
│   └── Static code analysis
├── license-compliance
│   └── Check approved licenses
└── outdated-dependencies
    └── Create issue for updates
```

---

## Status Badges

Add these to your README.md:

```markdown
![Frontend CI](https://github.com/<org>/stop-fra/workflows/Frontend%20CI/badge.svg)
![Backend CI](https://github.com/<org>/stop-fra/workflows/Backend%20CI/badge.svg)
![Deploy Production](https://github.com/<org>/stop-fra/workflows/Deploy%20to%20Production/badge.svg)
![Security Monitoring](https://github.com/<org>/stop-fra/workflows/Security%20Monitoring/badge.svg)
```

---

## Workflow Secrets Required

### Must Have (CI)
- `CODECOV_TOKEN` - Coverage reporting
- `SNYK_TOKEN` - Security scanning

### Staging Deployment
- `STAGING_SSH_PRIVATE_KEY`
- `STAGING_HOST`
- `STAGING_USER`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Production Deployment
- `PROD_SSH_PRIVATE_KEY`
- `PROD_HOST`
- `PROD_USER`
- `EXPO_TOKEN`
- `EXPO_PUBLIC_API_URL`

### Optional
- `SLACK_WEBHOOK` - Deployment notifications

---

## Common Issues & Fixes

### ❌ Tests Failing
```bash
# Run tests locally first
npm test

# Check specific test
npm test -- path/to/test.ts
```

### ❌ Coverage Gate Failing
```bash
# Generate coverage report
npm test -- --coverage

# View detailed report
open coverage/lcov-report/index.html
```

### ❌ Type Check Failing
```bash
# Run TypeScript compiler
npx tsc --noEmit
```

### ❌ Deployment Failing
```bash
# Check server logs
ssh user@server
pm2 logs stopfra-api

# Test health endpoint
curl https://api.stopfra.com/health
```

### ❌ Secrets Not Found
1. Go to **Settings → Secrets and variables → Actions**
2. Verify secret name matches exactly (case-sensitive)
3. Verify secret is in correct environment (staging/production)

---

## Emergency Procedures

### Rollback Production Deployment
```bash
# Option 1: Automatic (happens on health check failure)
# Option 2: Manual rollback
ssh user@production-server
cd /var/www/backups
ls -t  # Find latest backup
rm -rf /var/www/stopfra-api
cp -r stopfra-api-20251221_120000 /var/www/stopfra-api
cd /var/www/stopfra-api
pm2 restart stopfra-api
```

### Disable Workflow
```bash
# Disable specific workflow
gh workflow disable frontend-ci.yml

# Re-enable
gh workflow enable frontend-ci.yml
```

### Cancel Running Workflow
```bash
# List running workflows
gh run list --status in_progress

# Cancel specific run
gh run cancel <run-id>
```

---

## Performance Tips

### Speed Up CI
- Use npm cache (already configured)
- Run jobs in parallel (already configured)
- Use `--maxWorkers=2` for Jest (already configured)

### Reduce GitHub Actions Minutes
- Skip CI for documentation changes:
  ```yaml
  paths-ignore:
    - '**.md'
    - 'docs/**'
  ```

### Optimize Deployments
- Use incremental builds
- Cache dependencies on server
- Use PM2 cluster mode for zero-downtime

---

## Monitoring

### Check Workflow Health
```bash
# View recent runs
gh run list --limit 20

# Check success rate
gh run list --json conclusion --jq '[.[] | .conclusion] | group_by(.) | map({key: .[0], value: length})'
```

### View Logs
```bash
# View workflow logs
gh run view <run-id> --log

# View specific job logs
gh run view <run-id> --log --job=<job-id>
```

---

## Best Practices

### Commit Messages
```
feat(frontend): add new assessment module
fix(backend): correct risk scoring calculation
chore(ci): update Node.js version to 20.x
docs(readme): update setup instructions
test(unit): add tests for risk scoring
```

### Branch Naming
```
feature/assessment-module
bugfix/risk-scoring
hotfix/security-patch
release/v1.0.0
```

### PR Process
1. Create feature branch
2. Implement with tests
3. Push and create PR
4. Wait for CI checks
5. Address review comments
6. Merge when approved + CI passes

---

## Support

**Questions?**
- Check [CI_CD_SETUP_COMPLETE.md](../CI_CD_SETUP_COMPLETE.md) for full documentation
- Review workflow logs in GitHub Actions tab
- Contact DevOps team

**Found a bug in CI/CD?**
- Create issue with `ci/cd` label
- Include workflow name and run ID
- Attach relevant logs

---

**Last Updated**: December 21, 2025
**Version**: 1.0
