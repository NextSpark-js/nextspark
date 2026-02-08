-- Migration: 090_sample_data.sql
-- Description: Core sample data for testing (superadmin + developer only)
-- Date: 2025-12-24
-- Phase: Core sample data - runs BEFORE theme sample data
--
-- NOTE: This file contains ONLY core test users.
-- Theme-specific demo data (TMT.dev users, companies, invoices) is in:
-- contents/themes/default/migrations/090_demo_users_teams.sql

-- ============================================
-- STEP 1: CREATE CORE TEST USERS
-- ============================================
-- Only 2 core users for testing:
-- - superadmin@nextspark.dev (superadmin role)
-- - developer@nextspark.dev (developer role)
--
-- Global user roles: 'member', 'superadmin', 'developer' (immutable)
-- Team roles: 'owner', 'admin', 'member', 'viewer' (owner is protected)

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
    'test-superadmin-001',
    'superadmin@nextspark.dev',
    'Super Admin',
    'Super',
    'Admin',
    'superadmin',
    true,
    'en',
    'US',
    'America/New_York',
    NOW(),
    NOW()
  ),
  (
    'test-developer-001',
    'developer@nextspark.dev',
    'Developer',
    'Dev',
    'User',
    'developer',
    true,
    'en',
    'US',
    'America/Los_Angeles',
    NOW(),
    NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- STEP 2: CREATE NEXTSPARK TEAM (SYSTEM ADMIN TEAM)
-- ============================================
-- This is the System Admin Team for cross-team access bypass
-- Members of this team with elevated roles (developer/superadmin) can
-- bypass team context validation using the x-admin-bypass header

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
  (
    'team-nextspark-001',
    'NextSpark Team',
    'nextspark',
    'System Administrators - Cross-team access enabled',
    'test-superadmin-001',
    '{"segment": "enterprise", "industry": "platform", "systemAdmin": true}'::jsonb,
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
  -- Superadmin is owner of NextSpark Team (System Admin Team)
  ('tm-nextspark-superadmin-001', 'team-nextspark-001', 'test-superadmin-001', 'owner', NOW()),
  -- Developer is admin of NextSpark Team (System Admin Team)
  ('tm-nextspark-developer-001', 'team-nextspark-001', 'test-developer-001', 'admin', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 4: CREATE ACCOUNT CREDENTIALS
-- ============================================
-- Password: Pandora1234
-- Hash: 22de14d5472248ed0bece911df908b2a:d29576424798ba6845d348a3767c0b0f38a00f2aca461b3b1d34b99a93cab06c86774c6edb183e6d6ec47457649b032a49a7b60a48f6f4f7fbbc4ea40258f19f

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
    'account-superadmin-001',
    'test-superadmin-001',
    'superadmin@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '22de14d5472248ed0bece911df908b2a:d29576424798ba6845d348a3767c0b0f38a00f2aca461b3b1d34b99a93cab06c86774c6edb183e6d6ec47457649b032a49a7b60a48f6f4f7fbbc4ea40258f19f',
    NOW(), NOW()
  ),
  (
    'account-developer-001',
    'test-developer-001',
    'developer@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '22de14d5472248ed0bece911df908b2a:d29576424798ba6845d348a3767c0b0f38a00f2aca461b3b1d34b99a93cab06c86774c6edb183e6d6ec47457649b032a49a7b60a48f6f4f7fbbc4ea40258f19f',
    NOW(), NOW()
  )
ON CONFLICT ("providerId", "accountId") DO NOTHING;

-- ============================================
-- STEP 5: CREATE SESSIONS
-- ============================================

INSERT INTO "session" (
  id, "userId", "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent"
) VALUES
  ('session-superadmin-001', 'test-superadmin-001', NOW() + INTERVAL '30 days', 'tmt_superadmin_session_token_001', NOW(), NOW(), '127.0.0.1', 'TMT Test Agent'),
  ('session-developer-001', 'test-developer-001', NOW() + INTERVAL '30 days', 'tmt_developer_session_token_001', NOW(), NOW(), '127.0.0.1', 'TMT Test Agent')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 6: CREATE USER METADATA
-- ============================================

INSERT INTO "users_metas" (
  "userId", "metaKey", "metaValue", "dataType", "isPublic", "isSearchable", "createdAt", "updatedAt"
) VALUES
  ('test-superadmin-001', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('test-superadmin-001', 'activeTeamId', '"team-nextspark-001"', 'json', false, false, NOW(), NOW()),
  ('test-developer-001', 'uiPreferences', '{"theme": "dark", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  ('test-developer-001', 'activeTeamId', '"team-nextspark-001"', 'json', false, false, NOW(), NOW())
ON CONFLICT ("userId", "metaKey") DO NOTHING;

-- ============================================
-- STEP 7: CREATE API KEY FOR SUPERADMIN
-- ============================================

INSERT INTO "api_key" (
  "id",
  "userId",
  "name",
  "keyHash",
  "keyPrefix",
  "scopes",
  "lastUsedAt",
  "expiresAt",
  "createdAt",
  "updatedAt",
  "status"
) VALUES (
  'cb48859f-70a0-4f21-8417-93b1d930838f',
  'test-superadmin-001',
  'Super Admin API Key',
  '205f13ae4d2e18df417e61123bb84030c124fcb5013699046379ae1b5ec04324',
  'testkey_62fc9942',
  ARRAY['users:read','users:write','users:delete','tasks:read','tasks:write','tasks:delete','admin:api-keys','admin:users','*'],
  null,
  null,
  NOW(),
  NOW(),
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE MEDIA DATA
-- ============================================
INSERT INTO public."media" (id, "userId", "teamId", url, filename, "fileSize", "mimeType", width, height, alt, caption, status)
SELECT
  gen_random_uuid()::text,
  u.id,
  tm."teamId",
  '/uploads/temp/sample-' || n || '.jpg',
  CASE n
    WHEN 1 THEN 'hero-banner.jpg'
    WHEN 2 THEN 'team-photo.png'
    WHEN 3 THEN 'product-screenshot.png'
    WHEN 4 THEN 'company-logo.svg'
    WHEN 5 THEN 'office-interior.jpg'
    WHEN 6 THEN 'marketing-campaign.jpg'
    WHEN 7 THEN 'user-avatar.png'
    WHEN 8 THEN 'infographic-q4.png'
    WHEN 9 THEN 'demo-video-thumbnail.jpg'
    WHEN 10 THEN 'presentation-cover.jpg'
    WHEN 11 THEN 'promo-video.mp4'
    WHEN 12 THEN 'tutorial-recording.mp4'
  END,
  CASE n
    WHEN 1 THEN 2500000
    WHEN 2 THEN 1800000
    WHEN 3 THEN 950000
    WHEN 4 THEN 45000
    WHEN 5 THEN 3200000
    WHEN 6 THEN 1200000
    WHEN 7 THEN 85000
    WHEN 8 THEN 4100000
    WHEN 9 THEN 520000
    WHEN 10 THEN 780000
    WHEN 11 THEN 8500000
    WHEN 12 THEN 6200000
  END,
  CASE WHEN n <= 10 THEN 'image/jpeg' ELSE 'video/mp4' END,
  CASE WHEN n <= 10 THEN 1920 ELSE NULL END,
  CASE WHEN n <= 10 THEN 1080 ELSE NULL END,
  'Sample media ' || n,
  'Sample caption for media file ' || n,
  'active'
FROM "users" u
CROSS JOIN generate_series(1, 12) AS n
INNER JOIN "team_members" tm ON tm."userId" = u.id
WHERE u.email = 'superadmin@nextspark.dev'
LIMIT 12
ON CONFLICT DO NOTHING;

-- ============================================
-- SUCCESS SUMMARY
-- ============================================

DO $$
DECLARE
  user_count INTEGER;
  team_count INTEGER;
  member_count INTEGER;
  media_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM "users";
  SELECT COUNT(*) INTO team_count FROM "teams";
  SELECT COUNT(*) INTO member_count FROM "team_members";
  SELECT COUNT(*) INTO media_count FROM "media";

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Migration 090_sample_data.sql completed!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  📊 CORE STATISTICS:';
  RAISE NOTICE '     Users:          %', user_count;
  RAISE NOTICE '     Teams:          %', team_count;
  RAISE NOTICE '     Memberships:    %', member_count;
  RAISE NOTICE '     Media files:    %', media_count;
  RAISE NOTICE '';
  RAISE NOTICE '  🔐 CORE TEST CREDENTIALS (Password: Pandora1234):';
  RAISE NOTICE '     superadmin@nextspark.dev (superadmin) → NextSpark Team owner';
  RAISE NOTICE '     developer@nextspark.dev (developer) → NextSpark Team admin';
  RAISE NOTICE '';
  RAISE NOTICE '  🛡️  SYSTEM ADMIN TEAM (Cross-team bypass):';
  RAISE NOTICE '     NextSpark Team (team-nextspark-001)';
  RAISE NOTICE '     Members can use x-admin-bypass header for cross-team access';
  RAISE NOTICE '';
  RAISE NOTICE '  📝 NOTE: Theme demo data is in theme migrations:';
  RAISE NOTICE '     contents/themes/default/migrations/090_demo_users_teams.sql';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
