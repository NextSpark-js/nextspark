# Disaster Recovery

## Introduction

Disaster recovery ensures business continuity by having backups and recovery procedures for catastrophic failures. This guide covers backup strategies and recovery procedures.

**Current Status:** Basic backups via Supabase and GitHub; comprehensive DR plan in development.

---

## Backup Strategy

### Overview

```typescript
const BACKUP_STRATEGY = {
  code: {
    location: 'GitHub',
    frequency: 'Every commit',
    retention: 'Unlimited (git history)',
    recovery: 'Clone repository',
  },
  
  database: {
    location: 'Supabase',
    frequency: 'Daily (automatic)',
    retention: '7 days (free tier)',
    recovery: 'Restore from Supabase dashboard',
  },
  
  deployments: {
    location: 'Vercel',
    frequency: 'Every deployment',
    retention: 'Unlimited',
    recovery: 'Promote previous deployment',
  },
}
```

---

## Database Backups

### Supabase Automatic Backups

```bash
# Free tier:
- Daily automatic backups
- 7-day retention
- Point-in-time recovery: No

# Paid tier (if upgraded):
- Daily automatic backups
- Longer retention (30+ days)
- Point-in-time recovery: Yes
```

### Manual Backup

```bash
# Create manual backup via Supabase Dashboard:
# 1. Go to Supabase Dashboard
# 2. Database → Backups
# 3. Click "Create backup"
# 4. Add description
# 5. Confirm

# Best practice: Create manual backup before major changes
```

### Database Restore

```bash
# Restore from backup:
# 1. Supabase Dashboard → Database → Backups
# 2. Select backup to restore
# 3. Click "Restore"
# 4. Confirm restoration (OVERWRITES current data)
# 5. Wait for restore to complete
# 6. Verify data integrity
```

---

## Code Repository Backups

### GitHub as Source of Truth

```bash
# Code is backed up in GitHub:
- Every commit is stored
- Full git history preserved
- Branch protection ensures safety
- Can clone from anywhere

# Recovery:
git clone https://github.com/your-org/your-repo.git
cd your-repo
pnpm install
```

### GitHub Backup Best Practices

```typescript
const GITHUB_PRACTICES = [
  'Push commits regularly',
  'Use meaningful commit messages',
  'Tag releases (git tag v1.0.0)',
  'Protect main branch (require reviews)',
  'Keep at least 2 branches (main + staging)',
]
```

---

## Deployment History

### Vercel Deployment Backups

```bash
# Vercel automatically:
- Stores all deployments indefinitely
- Preserves build artifacts
- Allows instant rollback to any deployment
- No manual backup needed

# Access deployment history:
# Vercel Dashboard → Project → Deployments
```

---

## Recovery Procedures

### Complete System Recovery

```bash
# Scenario: Total infrastructure loss

# 1. Restore Code
git clone https://github.com/your-org/your-repo.git
cd your-repo
pnpm install

# 2. Restore Database
# - Create new Supabase project (if needed)
# - Restore from backup
# - Update DATABASE_URL in .env

# 3. Restore Deployments
# - Link Vercel project
vercel link
# - Deploy
pnpm vercel:deploy --prod

# 4. Restore Environment Variables
# - Manually add in Vercel dashboard
# - Or use deployment script
pnpm vercel:deploy --prod

# 5. Verify Everything Works
# - Test critical features
# - Check database connections
# - Monitor logs
```

---

## Data Loss Scenarios

### Accidental Data Deletion

```sql
-- Prevent with RLS policies
-- All tables should have RLS enabled

-- Recovery:
-- 1. Restore database from backup
-- 2. Extract lost data
-- 3. Import into current database
```

### Database Corruption

```bash
# Recovery:
# 1. Restore from most recent backup
# 2. Replay transactions if logs available
# 3. Verify data integrity
# 4. Update application if needed
```

---

## Planned Improvements

### Future DR Enhancements

```typescript
const PLANNED_IMPROVEMENTS = [
  'Automated backup testing',
  'Cross-region database replication',
  'Automated failover procedures',
  'Regular disaster recovery drills',
  'Documented RTO/RPO targets',
  'Off-site backup storage',
  'Backup encryption',
]

// RTO: Recovery Time Objective (how fast to recover)
// RPO: Recovery Point Objective (how much data loss acceptable)
```

---

## Recovery Time Objectives

### Current Targets

```typescript
const RECOVERY_TARGETS = {
  code: {
    RTO: '15 minutes',  // Time to clone and setup
    RPO: '0 minutes',   // No data loss (git)
  },
  
  deployment: {
    RTO: '1 second',    // Vercel instant rollback
    RPO: '0 minutes',   // No data loss
  },
  
  database: {
    RTO: '30 minutes',  // Time to restore backup
    RPO: '24 hours',    // Daily backups (free tier)
  },
}
```

---

## Testing Recovery

### Recovery Drill

```bash
# Recommended: Test recovery quarterly

# 1. Create test project
# 2. Restore database backup to test project
# 3. Clone repository
# 4. Deploy to test Vercel project
# 5. Verify functionality
# 6. Document time taken
# 7. Identify improvements
```

---

## Quick Reference

### Backup Locations

```bash
# Code
GitHub: https://github.com/your-org/your-repo

# Database
Supabase Dashboard → Database → Backups

# Deployments
Vercel Dashboard → Project → Deployments
```

### Recovery Steps

```typescript
const RECOVERY_STEPS = {
  minor: 'Rollback deployment (1 second)',
  moderate: 'Restore database backup (30 minutes)',
  major: 'Full system recovery (1-2 hours)',
}
```

### Emergency Contacts

```bash
# Document in your team:
- Supabase support: support@supabase.io
- Vercel support: support@vercel.com
- Team lead contact
- Database admin contact
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Basic DR (Improvements Planned)  
**RTO:** 30 minutes (database restore)  
**RPO:** 24 hours (free tier backups)
