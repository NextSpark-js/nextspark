# Rollback Procedures

## Introduction

Rollback procedures allow you to quickly revert to a previous working version when issues are detected in production. Vercel provides **instant rollbacks** with zero downtime.

---

## Vercel Instant Rollback

### Via Vercel Dashboard

```bash
# 1. Go to Vercel Dashboard
# 2. Select your project
# 3. Deployments tab
# 4. Find previous working deployment
# 5. Click "..." menu
# 6. Select "Promote to Production"
# 7. Confirm promotion

# Rollback happens instantly (< 1 second)
# No build required - previous deployment is reactivated
```

### Automatic Rollback

```bash
# Vercel automatically:
- Keeps all deployment history
- Maintains previous builds
- Allows instant switching
- No rebuild needed
```

---

## Via Vercel CLI

### Rollback to Previous Deployment

```bash
# List recent deployments
vercel ls

# Output shows:
# deployment-url-1.vercel.app (Current Production)
# deployment-url-2.vercel.app
# deployment-url-3.vercel.app

# Promote previous deployment to production
vercel promote deployment-url-2.vercel.app
```

---

## When to Rollback

### Immediate Rollback Triggers

```typescript
const ROLLBACK_TRIGGERS = [
  'Application crashes on startup',
  'Critical feature broken',
  'Data corruption issues',
  'Performance degradation (>50%)',
  'Security vulnerability introduced',
  'High error rate (>5%)',
]
```

### Rollback Decision Process

```bash
# 1. Detect issue
#    - User reports
#    - Error logs spike
#    - Monitoring alerts

# 2. Assess severity
#    - Does it affect all users?
#    - Can it cause data loss?
#    - Is workaround available?

# 3. Decision
#    - High severity: Immediate rollback
#    - Medium severity: Fix forward or rollback
#    - Low severity: Fix forward

# 4. Execute rollback (if needed)
# 5. Investigate root cause
# 6. Fix and redeploy
```

---

## Database Rollback Considerations

### Database Changes

```typescript
const DATABASE_ROLLBACK = {
  additive: {
    description: 'New tables/columns added',
    rollback: 'Safe - old code ignores new schema',
    action: 'No database rollback needed',
  },
  
  destructive: {
    description: 'Tables/columns dropped',
    rollback: 'Requires database rollback',
    action: 'Restore from backup before rolling back code',
  },
  
  migration: {
    description: 'Schema changes',
    rollback: 'May require migration reversal',
    action: 'Run rollback migration if available',
  },
}
```

### Supabase Backup Restore

```bash
# 1. Go to Supabase Dashboard
# 2. Database → Backups
# 3. Select backup from before deployment
# 4. Click "Restore"
# 5. Confirm restoration
# 6. Then rollback application code
```

---

## Recovery Steps

### Post-Rollback Process

```bash
# 1. Verify rollback successful
# - Check production URL loads
# - Test critical features
# - Monitor error rates

# 2. Notify team
# - Update status page (if available)
# - Inform stakeholders
# - Document incident

# 3. Investigate issue
# - Review deployment logs
# - Check error traces
# - Identify root cause

# 4. Fix and test
# - Fix issue locally
# - Test thoroughly
# - Test on staging

# 5. Redeploy
# - Deploy fix to staging
# - Verify staging works
# - Deploy to production
# - Monitor closely
```

---

## Rollback Testing

### Test Rollback Process

```bash
# Practice rollback in staging:

# 1. Deploy to staging
pnpm vercel:deploy --staging

# 2. Note deployment URL
# 3. Deploy again (new version)
# 4. Practice rollback via dashboard
# 5. Verify previous version is active

# This ensures team knows process
```

---

## Prevention Strategies

### Reduce Need for Rollbacks

```typescript
const PREVENTION_STRATEGIES = [
  'Test thoroughly on staging before production',
  'Use feature flags for gradual rollouts',
  'Monitor deployments closely (first 15 minutes)',
  'Run automated tests in CI/CD',
  'Keep deployments small and frequent',
  'Have peer code reviews',
]
```

---

## Quick Reference

### Rollback Commands

```bash
# Via Vercel Dashboard
# Deployments → Previous deployment → Promote to Production

# Via CLI
vercel ls              # List deployments
vercel promote [url]   # Promote to production
```

### Rollback Checklist

```typescript
const ROLLBACK_CHECKLIST = [
  '✅ Identify previous working deployment',
  '✅ Check if database changes need rollback',
  '✅ Promote previous deployment to production',
  '✅ Verify application works',
  '✅ Monitor for issues',
  '✅ Notify team',
  '✅ Investigate root cause',
  '✅ Fix and redeploy',
]
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development  
**Rollback Time:** < 1 second (via Vercel)
