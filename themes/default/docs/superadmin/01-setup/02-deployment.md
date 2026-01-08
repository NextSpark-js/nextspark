# Deployment Guide

This guide covers deploying your NextSpark application to production environments.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database provisioned
- Domain configured with SSL

## Vercel Deployment

### 1. Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository

### 2. Configure Environment Variables

Add all required environment variables in Vercel project settings:

```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Deploy

Vercel will automatically build and deploy your application.

## Docker Deployment

### Build Image

```bash
docker build -t nextspark-app .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e BETTER_AUTH_SECRET="..." \
  nextspark-app
```

## Database Migrations

Run migrations before starting the application:

```bash
pnpm db:migrate
```

## Health Checks

The application exposes health check endpoints:

- `/api/health` - Basic health check
- `/api/health/db` - Database connectivity check

## Monitoring

Configure monitoring and alerting for:

- Application errors
- Database connection issues
- API response times
- Memory and CPU usage

## Next Steps

- [Configuration Guide](./01-configuration.md)
- [User Management](../02-management/01-users.md)
