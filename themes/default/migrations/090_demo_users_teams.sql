-- Migration: 090_demo_users_teams.sql
-- Description: Demo users, teams, and invoices for default theme
-- Date: 2025-12-24
-- Theme: default
-- Phase: Theme sample data - runs AFTER core migrations (090_sample_data.sql)
--
-- This file contains demo data for testing and demonstration:
-- - 8 TMT.dev users with realistic profiles
-- - Personal teams for each user
-- - 3 company teams with multiple members
-- - Invoices for company teams
--
-- Password for all users: Testing1234
-- Hash: 3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866

-- ============================================
-- STEP 1: CREATE TMT.DEV USERS
-- ============================================

INSERT INTO "users" (
  id,
  email,
  name,
  "firstName",
  "lastName",
  role,
  "emailVerified",
  language,
  country,
  timezone,
  "createdAt",
  "updatedAt"
) VALUES
  (
    'usr-carlos-001',
    'carlos.mendoza@nextspark.dev',
    'Carlos Mendoza',
    'Carlos',
    'Mendoza',
    'member',
    true,
    'es',
    'AR',
    'America/Argentina/Buenos_Aires',
    NOW(),
    NOW()
  ),
  (
    'usr-james-002',
    'james.wilson@nextspark.dev',
    'James Wilson',
    'James',
    'Wilson',
    'member',
    true,
    'en',
    'US',
    'America/New_York',
    NOW(),
    NOW()
  ),
  (
    'usr-diego-003',
    'diego.ramirez@nextspark.dev',
    'Diego Ramírez',
    'Diego',
    'Ramírez',
    'member',
    true,
    'es',
    'MX',
    'America/Mexico_City',
    NOW(),
    NOW()
  ),
  (
    'usr-michael-004',
    'michael.brown@nextspark.dev',
    'Michael Brown',
    'Michael',
    'Brown',
    'member',
    true,
    'en',
    'US',
    'America/Los_Angeles',
    NOW(),
    NOW()
  ),
  (
    'usr-ana-005',
    'ana.garcia@nextspark.dev',
    'Ana García',
    'Ana',
    'García',
    'member',
    true,
    'es',
    'ES',
    'Europe/Madrid',
    NOW(),
    NOW()
  ),
  (
    'usr-emily-006',
    'emily.johnson@nextspark.dev',
    'Emily Johnson',
    'Emily',
    'Johnson',
    'member',
    true,
    'en',
    'GB',
    'Europe/London',
    NOW(),
    NOW()
  ),
  (
    'usr-sofia-007',
    'sofia.lopez@nextspark.dev',
    'Sofia López',
    'Sofia',
    'López',
    'member',
    true,
    'es',
    'AR',
    'America/Argentina/Buenos_Aires',
    NOW(),
    NOW()
  ),
  (
    'usr-sarah-008',
    'sarah.davis@nextspark.dev',
    'Sarah Davis',
    'Sarah',
    'Davis',
    'member',
    true,
    'en',
    'CA',
    'America/Toronto',
    NOW(),
    NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- STEP 2: CREATE ALL TEAMS
-- ============================================

INSERT INTO "teams" (
  id,
  name,
  slug,
  description,
  "ownerId",
  metadata,
  "createdAt",
  "updatedAt"
) VALUES
  -- ========================================
  -- PERSONAL TEAMS
  -- ========================================
  (
    'team-personal-carlos-001',
    'Carlos Mendoza Team',
    'carlos-mendoza-team',
    'Default workspace',
    'usr-carlos-001',
    '{"isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-personal-james-002',
    'James Wilson Team',
    'james-wilson-team',
    'Default workspace',
    'usr-james-002',
    '{"isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-personal-diego-003',
    'Diego Ramírez Team',
    'diego-ramirez-team',
    'Default workspace',
    'usr-diego-003',
    '{"isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-personal-michael-004',
    'Michael Brown Team',
    'michael-brown-team',
    'Default workspace',
    'usr-michael-004',
    '{"isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-personal-ana-005',
    'Ana García Team',
    'ana-garcia-team',
    'Default workspace',
    'usr-ana-005',
    '{"isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-personal-emily-006',
    'Emily Johnson Team',
    'emily-johnson-team',
    'Default workspace',
    'usr-emily-006',
    '{"isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-personal-sofia-007',
    'Sofia López Team',
    'sofia-lopez-team',
    'Default workspace',
    'usr-sofia-007',
    '{"isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-personal-sarah-008',
    'Sarah Davis Team',
    'sarah-davis-team',
    'Default workspace',
    'usr-sarah-008',
    '{"isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),

  -- ========================================
  -- COMPANY TEAMS
  -- ========================================
  (
    'team-everpoint-001',
    'Everpoint Labs',
    'everpoint-labs',
    'Technology Company - Software development and innovation',
    'usr-carlos-001',
    '{"segment": "startup", "industry": "technology", "isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-ironvale-002',
    'Ironvale Global',
    'ironvale-global',
    'Consulting Firm - Business strategy and management consulting',
    'usr-ana-005',
    '{"segment": "enterprise", "industry": "consulting", "isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'team-riverstone-003',
    'Riverstone Ventures',
    'riverstone-ventures',
    'Investment Fund - Early-stage startup investments',
    'usr-sofia-007',
    '{"segment": "startup", "industry": "finance", "isSeedData": true}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 3: CREATE TEAM MEMBERSHIPS
-- ============================================

INSERT INTO "team_members" (
  id,
  "teamId",
  "userId",
  role,
  "joinedAt"
) VALUES
  -- ========================================
  -- PERSONAL TEAM MEMBERSHIPS
  -- ========================================
  ('tm-tmt-personal-carlos', 'team-personal-carlos-001', 'usr-carlos-001', 'owner', NOW()),
  ('tm-tmt-personal-james', 'team-personal-james-002', 'usr-james-002', 'owner', NOW()),
  ('tm-tmt-personal-diego', 'team-personal-diego-003', 'usr-diego-003', 'owner', NOW()),
  ('tm-tmt-personal-michael', 'team-personal-michael-004', 'usr-michael-004', 'owner', NOW()),
  ('tm-tmt-personal-ana', 'team-personal-ana-005', 'usr-ana-005', 'owner', NOW()),
  ('tm-tmt-personal-emily', 'team-personal-emily-006', 'usr-emily-006', 'owner', NOW()),
  ('tm-tmt-personal-sofia', 'team-personal-sofia-007', 'usr-sofia-007', 'owner', NOW()),
  ('tm-tmt-personal-sarah', 'team-personal-sarah-008', 'usr-sarah-008', 'owner', NOW()),

  -- ========================================
  -- EVERPOINT LABS - Technology Company
  -- Owner: Carlos Mendoza
  -- ========================================
  ('tm-everpoint-carlos', 'team-everpoint-001', 'usr-carlos-001', 'owner', NOW()),
  ('tm-everpoint-james', 'team-everpoint-001', 'usr-james-002', 'admin', NOW()),
  ('tm-everpoint-emily', 'team-everpoint-001', 'usr-emily-006', 'member', NOW()),
  ('tm-everpoint-diego', 'team-everpoint-001', 'usr-diego-003', 'editor', NOW()),

  -- ========================================
  -- IRONVALE GLOBAL - Consulting Firm
  -- Owner: Ana García
  -- ========================================
  ('tm-ironvale-ana', 'team-ironvale-002', 'usr-ana-005', 'owner', NOW()),
  ('tm-ironvale-sofia', 'team-ironvale-002', 'usr-sofia-007', 'admin', NOW()),
  ('tm-ironvale-michael', 'team-ironvale-002', 'usr-michael-004', 'member', NOW()),
  ('tm-ironvale-sarah', 'team-ironvale-002', 'usr-sarah-008', 'viewer', NOW()),

  -- ========================================
  -- RIVERSTONE VENTURES - Investment Fund
  -- Owner: Sofia López
  -- ========================================
  ('tm-riverstone-sofia', 'team-riverstone-003', 'usr-sofia-007', 'owner', NOW()),
  ('tm-riverstone-emily', 'team-riverstone-003', 'usr-emily-006', 'admin', NOW()),
  ('tm-riverstone-carlos', 'team-riverstone-003', 'usr-carlos-001', 'member', NOW())

ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 4: CREATE ACCOUNT CREDENTIALS
-- ============================================
-- Password: Testing1234
-- Hash: 3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866

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
  ),
  (
    'account-tmt-james',
    'usr-james-002',
    'james.wilson@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(), NOW()
  ),
  (
    'account-tmt-diego',
    'usr-diego-003',
    'diego.ramirez@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(), NOW()
  ),
  (
    'account-tmt-michael',
    'usr-michael-004',
    'michael.brown@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(), NOW()
  ),
  (
    'account-tmt-ana',
    'usr-ana-005',
    'ana.garcia@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(), NOW()
  ),
  (
    'account-tmt-emily',
    'usr-emily-006',
    'emily.johnson@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(), NOW()
  ),
  (
    'account-tmt-sofia',
    'usr-sofia-007',
    'sofia.lopez@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(), NOW()
  ),
  (
    'account-tmt-sarah',
    'usr-sarah-008',
    'sarah.davis@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW(), NOW()
  )
ON CONFLICT ("providerId", "accountId") DO NOTHING;

-- ============================================
-- STEP 5: CREATE USER METADATA
-- ============================================

INSERT INTO "users_metas" (
  "userId", "metaKey", "metaValue", "dataType", "isPublic", "isSearchable", "createdAt", "updatedAt"
) VALUES
  ('usr-carlos-001', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-carlos-001', 'activeTeamId', '"team-personal-carlos-001"', 'json', false, false, NOW(), NOW()),
  ('usr-james-002', 'uiPreferences', '{"theme": "dark", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-james-002', 'activeTeamId', '"team-personal-james-002"', 'json', false, false, NOW(), NOW()),
  ('usr-diego-003', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-diego-003', 'activeTeamId', '"team-personal-diego-003"', 'json', false, false, NOW(), NOW()),
  ('usr-michael-004', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-michael-004', 'activeTeamId', '"team-personal-michael-004"', 'json', false, false, NOW(), NOW()),
  ('usr-ana-005', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-ana-005', 'activeTeamId', '"team-personal-ana-005"', 'json', false, false, NOW(), NOW()),
  ('usr-emily-006', 'uiPreferences', '{"theme": "dark", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-emily-006', 'activeTeamId', '"team-personal-emily-006"', 'json', false, false, NOW(), NOW()),
  ('usr-sofia-007', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-sofia-007', 'activeTeamId', '"team-personal-sofia-007"', 'json', false, false, NOW(), NOW()),
  ('usr-sarah-008', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('usr-sarah-008', 'activeTeamId', '"team-personal-sarah-008"', 'json', false, false, NOW(), NOW())
ON CONFLICT ("userId", "metaKey") DO NOTHING;

-- ============================================
-- STEP 6: CREATE INVOICES FOR COMPANY TEAMS
-- ============================================
-- 6 invoices per work team (5 paid + 1 pending)

INSERT INTO "invoices" (
  id,
  "teamId",
  "invoiceNumber",
  date,
  amount,
  currency,
  status,
  "pdfUrl",
  description
) VALUES
  -- Everpoint Labs - $99/month
  ('inv-ever-001', 'team-everpoint-001', 'INV-EVER-001', NOW() - INTERVAL '5 months', 99.00, 'USD', 'paid', 'https://billing.example.com/inv-ever-001.pdf', 'Business Plan - Monthly'),
  ('inv-ever-002', 'team-everpoint-001', 'INV-EVER-002', NOW() - INTERVAL '4 months', 99.00, 'USD', 'paid', 'https://billing.example.com/inv-ever-002.pdf', 'Business Plan - Monthly'),
  ('inv-ever-003', 'team-everpoint-001', 'INV-EVER-003', NOW() - INTERVAL '3 months', 99.00, 'USD', 'paid', 'https://billing.example.com/inv-ever-003.pdf', 'Business Plan - Monthly'),
  ('inv-ever-004', 'team-everpoint-001', 'INV-EVER-004', NOW() - INTERVAL '2 months', 99.00, 'USD', 'paid', 'https://billing.example.com/inv-ever-004.pdf', 'Business Plan - Monthly'),
  ('inv-ever-005', 'team-everpoint-001', 'INV-EVER-005', NOW() - INTERVAL '1 month', 99.00, 'USD', 'paid', 'https://billing.example.com/inv-ever-005.pdf', 'Business Plan - Monthly'),
  ('inv-ever-006', 'team-everpoint-001', 'INV-EVER-006', NOW(), 99.00, 'USD', 'pending', NULL, 'Business Plan - Monthly'),

  -- Ironvale Global - $199/month
  ('inv-iron-001', 'team-ironvale-002', 'INV-IRON-001', NOW() - INTERVAL '5 months', 199.00, 'USD', 'paid', 'https://billing.example.com/inv-iron-001.pdf', 'Enterprise Plan - Monthly'),
  ('inv-iron-002', 'team-ironvale-002', 'INV-IRON-002', NOW() - INTERVAL '4 months', 199.00, 'USD', 'paid', 'https://billing.example.com/inv-iron-002.pdf', 'Enterprise Plan - Monthly'),
  ('inv-iron-003', 'team-ironvale-002', 'INV-IRON-003', NOW() - INTERVAL '3 months', 199.00, 'USD', 'paid', 'https://billing.example.com/inv-iron-003.pdf', 'Enterprise Plan - Monthly'),
  ('inv-iron-004', 'team-ironvale-002', 'INV-IRON-004', NOW() - INTERVAL '2 months', 199.00, 'USD', 'paid', 'https://billing.example.com/inv-iron-004.pdf', 'Enterprise Plan - Monthly'),
  ('inv-iron-005', 'team-ironvale-002', 'INV-IRON-005', NOW() - INTERVAL '1 month', 199.00, 'USD', 'paid', 'https://billing.example.com/inv-iron-005.pdf', 'Enterprise Plan - Monthly'),
  ('inv-iron-006', 'team-ironvale-002', 'INV-IRON-006', NOW(), 199.00, 'USD', 'pending', NULL, 'Enterprise Plan - Monthly'),

  -- Riverstone Ventures - $149/month
  ('inv-river-001', 'team-riverstone-003', 'INV-RIVER-001', NOW() - INTERVAL '5 months', 149.00, 'USD', 'paid', 'https://billing.example.com/inv-river-001.pdf', 'Pro Plan - Monthly'),
  ('inv-river-002', 'team-riverstone-003', 'INV-RIVER-002', NOW() - INTERVAL '4 months', 149.00, 'USD', 'paid', 'https://billing.example.com/inv-river-002.pdf', 'Pro Plan - Monthly'),
  ('inv-river-003', 'team-riverstone-003', 'INV-RIVER-003', NOW() - INTERVAL '3 months', 149.00, 'USD', 'paid', 'https://billing.example.com/inv-river-003.pdf', 'Pro Plan - Monthly'),
  ('inv-river-004', 'team-riverstone-003', 'INV-RIVER-004', NOW() - INTERVAL '2 months', 149.00, 'USD', 'paid', 'https://billing.example.com/inv-river-004.pdf', 'Pro Plan - Monthly'),
  ('inv-river-005', 'team-riverstone-003', 'INV-RIVER-005', NOW() - INTERVAL '1 month', 149.00, 'USD', 'paid', 'https://billing.example.com/inv-river-005.pdf', 'Pro Plan - Monthly'),
  ('inv-river-006', 'team-riverstone-003', 'INV-RIVER-006', NOW(), 149.00, 'USD', 'pending', NULL, 'Pro Plan - Monthly')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SUCCESS SUMMARY
-- ============================================

DO $$
DECLARE
  user_count INTEGER;
  team_count INTEGER;
  member_count INTEGER;
  invoice_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM "users" WHERE email LIKE '%@nextspark.dev';
  SELECT COUNT(*) INTO team_count FROM "teams" WHERE id LIKE 'team-personal-%' OR id LIKE 'team-everpoint%' OR id LIKE 'team-ironvale%' OR id LIKE 'team-riverstone%';
  SELECT COUNT(*) INTO member_count FROM "team_members" WHERE id LIKE 'tm-tmt-%' OR id LIKE 'tm-everpoint%' OR id LIKE 'tm-ironvale%' OR id LIKE 'tm-riverstone%';
  SELECT COUNT(*) INTO invoice_count FROM "invoices" WHERE id LIKE 'inv-ever%' OR id LIKE 'inv-iron%' OR id LIKE 'inv-river%';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Theme Migration 090_demo_users_teams.sql completed!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  📊 DEMO DATA STATISTICS:';
  RAISE NOTICE '     TMT.dev Users:  %', user_count;
  RAISE NOTICE '     Teams:          %', team_count;
  RAISE NOTICE '     Memberships:    %', member_count;
  RAISE NOTICE '     Invoices:       %', invoice_count;
  RAISE NOTICE '';
  RAISE NOTICE '  🔐 TMT.DEV CREDENTIALS (Password: Testing1234):';
  RAISE NOTICE '     carlos.mendoza@nextspark.dev → Everpoint Labs (owner)';
  RAISE NOTICE '     james.wilson@nextspark.dev → Everpoint Labs (admin)';
  RAISE NOTICE '     diego.ramirez@nextspark.dev → Everpoint Labs (editor)';
  RAISE NOTICE '     ana.garcia@nextspark.dev → Ironvale Global (owner)';
  RAISE NOTICE '     sofia.lopez@nextspark.dev → Ironvale + Riverstone';
  RAISE NOTICE '     emily.johnson@nextspark.dev → Everpoint + Riverstone';
  RAISE NOTICE '     michael.brown@nextspark.dev → Ironvale Global (member)';
  RAISE NOTICE '     sarah.davis@nextspark.dev → Ironvale Global (viewer)';
  RAISE NOTICE '';
  RAISE NOTICE '  🏢 COMPANY TEAMS:';
  RAISE NOTICE '     Everpoint Labs - Technology Company (4 members)';
  RAISE NOTICE '     Ironvale Global - Consulting Firm (4 members)';
  RAISE NOTICE '     Riverstone Ventures - Investment Fund (3 members)';
  RAISE NOTICE '';
  RAISE NOTICE '  💳 INVOICES:';
  RAISE NOTICE '     All company teams have 6 invoices (5 paid + 1 pending)';
  RAISE NOTICE '     Everpoint: $99/mo | Ironvale: $199/mo | Riverstone: $149/mo';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
