# Deployment Workflow

## Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| Development | Local development | localhost:5173 |
| Staging | Pre-production testing | [staging URL] |
| Production | Live service | [production URL] |

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing
- [ ] Linting clean (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors in browser

### Security
- [ ] No hardcoded secrets
- [ ] Environment variables configured
- [ ] Supabase RLS policies reviewed
- [ ] Authentication flows tested

### Accessibility
- [ ] Tested with keyboard navigation
- [ ] Tested with screen reader
- [ ] Colour contrast verified

### Content
- [ ] British English spelling checked
- [ ] Regulatory references current
- [ ] All placeholder text replaced

### Database
- [ ] Migrations applied to target environment
- [ ] Seed data appropriate for environment
- [ ] Backup taken (production only)

## Deployment Steps

### Via Lovable Platform

1. Open Lovable project dashboard
2. Navigate to Share > Publish
3. Select target environment
4. Review deployment preview
5. Confirm deployment

### Manual Deployment

```bash
# Build production bundle
npm run build

# Preview locally
npm run preview

# Deploy to hosting platform
[platform-specific commands]
```

## Post-Deployment Verification

- [ ] Application loads correctly
- [ ] Authentication works
- [ ] Workshop content displays
- [ ] Real-time features functional
- [ ] Certificates generate correctly
- [ ] No console errors

## Rollback Procedure

1. Access deployment platform
2. Select previous successful deployment
3. Trigger rollback
4. Verify application restored
5. Investigate and fix issues
6. Re-deploy when ready

## Emergency Contacts

- Platform Support: [contact]
- Security Team: [contact]
- Product Owner: [contact]
