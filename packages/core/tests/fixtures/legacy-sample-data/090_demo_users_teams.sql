-- Trimmed from v0.1.0-beta.191:themes/default/migrations/090_demo_users_teams.sql: its header and the first account row.
-- Migration: 090_demo_users_teams.sql
-- Description: Demo users, teams, and invoices for default theme
-- Date: 2025-12-24
-- Theme: default
-- Phase: Theme sample data - runs AFTER core migrations (090_sample_data.sql)

INSERT INTO "account" (
  id,
  "userId",
  "accountId",
  "providerId",
  "accessToken",
  "refreshToken",
  "idToken",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt",
  "scope",
  "password",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'account-tmt-carlos',
    'usr-carlos-001',
    'carlos.mendoza@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(), NOW()
  )
ON CONFLICT DO NOTHING;
