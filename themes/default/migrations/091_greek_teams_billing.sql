-- Migration: 091_greek_teams_billing.sql
-- Description: Greek alphabet teams for billing/subscription testing
-- Date: 2025-12-25
-- Theme: default
-- Phase: Theme sample data - runs AFTER 090_demo_users_teams.sql
--
-- This file contains:
-- - 15 Greek alphabet teams (Alpha through Omicron) with 5 users each = 75 users
-- - Team memberships and accounts for all users
-- - User metadata
--
-- All passwords: Testing1234
-- Hash: 3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866

-- ============================================
-- STEP 6B: NEW TEAMS SAMPLE DATA (10 teams × 5 users = 50 users)
-- ============================================
-- Team naming: Greek alphabet (Alpha through Kappa)
-- Password for all: Test1234

-- NEW USERS (50 total)
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
  -- ALPHA TECH (Team 1) - Software Startup
  ('usr-alpha-01', 'owner@alpha.dev', 'Alex Alpha', 'Alex', 'Alpha', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '180 days', NOW()),
  ('usr-alpha-02', 'admin@alpha.dev', 'Andrea Alonso', 'Andrea', 'Alonso', 'member', true, 'es', 'ES', 'Europe/Madrid', NOW() - INTERVAL '175 days', NOW()),
  ('usr-alpha-03', 'member1@alpha.dev', 'Aaron Adams', 'Aaron', 'Adams', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '170 days', NOW()),
  ('usr-alpha-04', 'member2@alpha.dev', 'Amelia Archer', 'Amelia', 'Archer', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '165 days', NOW()),
  ('usr-alpha-05', 'member3@alpha.dev', 'Adrian Acosta', 'Adrian', 'Acosta', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW() - INTERVAL '160 days', NOW()),

  -- BETA SOLUTIONS (Team 2) - Digital Agency
  ('usr-beta-01', 'owner@beta.dev', 'Bruno Beta', 'Bruno', 'Beta', 'member', true, 'en', 'US', 'America/Los_Angeles', NOW() - INTERVAL '180 days', NOW()),
  ('usr-beta-02', 'admin@beta.dev', 'Bianca Bloom', 'Bianca', 'Bloom', 'member', true, 'en', 'CA', 'America/Toronto', NOW() - INTERVAL '175 days', NOW()),
  ('usr-beta-03', 'member1@beta.dev', 'Benjamin Banks', 'Benjamin', 'Banks', 'member', true, 'en', 'US', 'America/Denver', NOW() - INTERVAL '170 days', NOW()),
  ('usr-beta-04', 'member2@beta.dev', 'Beatriz Blanco', 'Beatriz', 'Blanco', 'member', true, 'es', 'AR', 'America/Argentina/Buenos_Aires', NOW() - INTERVAL '165 days', NOW()),
  ('usr-beta-05', 'member3@beta.dev', 'Blake Burton', 'Blake', 'Burton', 'member', true, 'en', 'AU', 'Australia/Sydney', NOW() - INTERVAL '160 days', NOW()),

  -- GAMMA INDUSTRIES (Team 3) - Manufacturing
  ('usr-gamma-01', 'owner@gamma.dev', 'Gabriel Gamma', 'Gabriel', 'Gamma', 'member', true, 'en', 'US', 'America/Detroit', NOW() - INTERVAL '180 days', NOW()),
  ('usr-gamma-02', 'admin@gamma.dev', 'Grace Green', 'Grace', 'Green', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '175 days', NOW()),
  ('usr-gamma-03', 'member1@gamma.dev', 'George Grant', 'George', 'Grant', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '170 days', NOW()),
  ('usr-gamma-04', 'member2@gamma.dev', 'Gabriela Gomez', 'Gabriela', 'Gomez', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW() - INTERVAL '165 days', NOW()),
  ('usr-gamma-05', 'member3@gamma.dev', 'Gordon Gray', 'Gordon', 'Gray', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '160 days', NOW()),

  -- DELTA DYNAMICS (Team 4) - Engineering
  ('usr-delta-01', 'owner@delta.dev', 'David Delta', 'David', 'Delta', 'member', true, 'en', 'US', 'America/Los_Angeles', NOW() - INTERVAL '180 days', NOW()),
  ('usr-delta-02', 'admin@delta.dev', 'Diana Drake', 'Diana', 'Drake', 'member', true, 'en', 'US', 'America/Denver', NOW() - INTERVAL '175 days', NOW()),
  ('usr-delta-03', 'member1@delta.dev', 'Daniel Dunn', 'Daniel', 'Dunn', 'member', true, 'en', 'CA', 'America/Vancouver', NOW() - INTERVAL '170 days', NOW()),
  ('usr-delta-04', 'member2@delta.dev', 'Daniela Diaz', 'Daniela', 'Diaz', 'member', true, 'es', 'CO', 'America/Bogota', NOW() - INTERVAL '165 days', NOW()),
  ('usr-delta-05', 'member3@delta.dev', 'Derek Douglas', 'Derek', 'Douglas', 'member', true, 'en', 'US', 'America/Phoenix', NOW() - INTERVAL '160 days', NOW()),

  -- EPSILON MEDIA (Team 5) - Media Company
  ('usr-epsilon-01', 'owner@epsilon.dev', 'Elena Epsilon', 'Elena', 'Epsilon', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '180 days', NOW()),
  ('usr-epsilon-02', 'admin@epsilon.dev', 'Ethan Evans', 'Ethan', 'Evans', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '175 days', NOW()),
  ('usr-epsilon-03', 'member1@epsilon.dev', 'Emma Ellis', 'Emma', 'Ellis', 'member', true, 'en', 'US', 'America/Los_Angeles', NOW() - INTERVAL '170 days', NOW()),
  ('usr-epsilon-04', 'member2@epsilon.dev', 'Eduardo Espinoza', 'Eduardo', 'Espinoza', 'member', true, 'es', 'ES', 'Europe/Madrid', NOW() - INTERVAL '165 days', NOW()),
  ('usr-epsilon-05', 'member3@epsilon.dev', 'Evelyn Edwards', 'Evelyn', 'Edwards', 'member', true, 'en', 'AU', 'Australia/Melbourne', NOW() - INTERVAL '160 days', NOW()),

  -- ZETA FINANCE (Team 6) - Fintech
  ('usr-zeta-01', 'owner@zeta.dev', 'Zach Zeta', 'Zach', 'Zeta', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '180 days', NOW()),
  ('usr-zeta-02', 'admin@zeta.dev', 'Zoe Zhang', 'Zoe', 'Zhang', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '175 days', NOW()),
  ('usr-zeta-03', 'member1@zeta.dev', 'Zachary Zimmerman', 'Zachary', 'Zimmerman', 'member', true, 'en', 'US', 'America/Denver', NOW() - INTERVAL '170 days', NOW()),
  ('usr-zeta-04', 'member2@zeta.dev', 'Zara Zapata', 'Zara', 'Zapata', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW() - INTERVAL '165 days', NOW()),
  ('usr-zeta-05', 'member3@zeta.dev', 'Zander Ziegler', 'Zander', 'Ziegler', 'member', true, 'en', 'DE', 'Europe/Berlin', NOW() - INTERVAL '160 days', NOW()),

  -- ETA HEALTHCARE (Team 7) - Healthcare
  ('usr-eta-01', 'owner@eta.dev', 'Henry Eta', 'Henry', 'Eta', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '180 days', NOW()),
  ('usr-eta-02', 'admin@eta.dev', 'Hannah Hill', 'Hannah', 'Hill', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '175 days', NOW()),
  ('usr-eta-03', 'member1@eta.dev', 'Harrison Hayes', 'Harrison', 'Hayes', 'member', true, 'en', 'CA', 'America/Toronto', NOW() - INTERVAL '170 days', NOW()),
  ('usr-eta-04', 'member2@eta.dev', 'Helena Hernandez', 'Helena', 'Hernandez', 'member', true, 'es', 'ES', 'Europe/Madrid', NOW() - INTERVAL '165 days', NOW()),
  ('usr-eta-05', 'member3@eta.dev', 'Hugo Hamilton', 'Hugo', 'Hamilton', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '160 days', NOW()),

  -- THETA ENTERPRISES (Team 8) - Large Corporation (Enterprise)
  ('usr-theta-01', 'owner@theta.dev', 'Thomas Theta', 'Thomas', 'Theta', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '180 days', NOW()),
  ('usr-theta-02', 'admin@theta.dev', 'Tessa Turner', 'Tessa', 'Turner', 'member', true, 'en', 'US', 'America/Los_Angeles', NOW() - INTERVAL '175 days', NOW()),
  ('usr-theta-03', 'member1@theta.dev', 'Theodore Thompson', 'Theodore', 'Thompson', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '170 days', NOW()),
  ('usr-theta-04', 'member2@theta.dev', 'Teresa Torres', 'Teresa', 'Torres', 'member', true, 'es', 'AR', 'America/Argentina/Buenos_Aires', NOW() - INTERVAL '165 days', NOW()),
  ('usr-theta-05', 'member3@theta.dev', 'Tyler Taylor', 'Tyler', 'Taylor', 'member', true, 'en', 'AU', 'Australia/Sydney', NOW() - INTERVAL '160 days', NOW()),

  -- IOTA CONSULTING (Team 9) - Voluntary Cancellation
  ('usr-iota-01', 'owner@iota.dev', 'Ian Iota', 'Ian', 'Iota', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '180 days', NOW()),
  ('usr-iota-02', 'admin@iota.dev', 'Ivy Irving', 'Ivy', 'Irving', 'member', true, 'en', 'US', 'America/Denver', NOW() - INTERVAL '175 days', NOW()),
  ('usr-iota-03', 'member1@iota.dev', 'Isaac Ingram', 'Isaac', 'Ingram', 'member', true, 'en', 'CA', 'America/Vancouver', NOW() - INTERVAL '170 days', NOW()),
  ('usr-iota-04', 'member2@iota.dev', 'Isabella Ibarra', 'Isabella', 'Ibarra', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW() - INTERVAL '165 days', NOW()),
  ('usr-iota-05', 'member3@iota.dev', 'Ivan Irwin', 'Ivan', 'Irwin', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '160 days', NOW()),

  -- KAPPA LABS (Team 10) - Payment Failure Cancellation
  ('usr-kappa-01', 'owner@kappa.dev', 'Kevin Kappa', 'Kevin', 'Kappa', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '180 days', NOW()),
  ('usr-kappa-02', 'admin@kappa.dev', 'Kelly Knight', 'Kelly', 'Knight', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '175 days', NOW()),
  ('usr-kappa-03', 'member1@kappa.dev', 'Kyle Kennedy', 'Kyle', 'Kennedy', 'member', true, 'en', 'US', 'America/Los_Angeles', NOW() - INTERVAL '170 days', NOW()),
  ('usr-kappa-04', 'member2@kappa.dev', 'Karla Kramer', 'Karla', 'Kramer', 'member', true, 'es', 'CO', 'America/Bogota', NOW() - INTERVAL '165 days', NOW()),
  ('usr-kappa-05', 'member3@kappa.dev', 'Keith King', 'Keith', 'King', 'member', true, 'en', 'AU', 'Australia/Perth', NOW() - INTERVAL '160 days', NOW()),

  -- ============================================
  -- ANNUAL SUBSCRIPTION TEAMS (Teams 11-15)
  -- ============================================

  -- LAMBDA CORP (Team 11) - Enterprise Yearly
  ('usr-lambda-01', 'owner@lambda.dev', 'Lucas Lambda', 'Lucas', 'Lambda', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '365 days', NOW()),
  ('usr-lambda-02', 'admin@lambda.dev', 'Laura Lee', 'Laura', 'Lee', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '360 days', NOW()),
  ('usr-lambda-03', 'member1@lambda.dev', 'Liam Lopez', 'Liam', 'Lopez', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW() - INTERVAL '355 days', NOW()),
  ('usr-lambda-04', 'member2@lambda.dev', 'Linda Lewis', 'Linda', 'Lewis', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '350 days', NOW()),
  ('usr-lambda-05', 'member3@lambda.dev', 'Leo Lancaster', 'Leo', 'Lancaster', 'member', true, 'en', 'AU', 'Australia/Sydney', NOW() - INTERVAL '345 days', NOW()),

  -- MU INDUSTRIES (Team 12) - Enterprise Yearly
  ('usr-mu-01', 'owner@mu.dev', 'Marcus Mu', 'Marcus', 'Mu', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '365 days', NOW()),
  ('usr-mu-02', 'admin@mu.dev', 'Maria Martinez', 'Maria', 'Martinez', 'member', true, 'es', 'ES', 'Europe/Madrid', NOW() - INTERVAL '360 days', NOW()),
  ('usr-mu-03', 'member1@mu.dev', 'Michael Moore', 'Michael', 'Moore', 'member', true, 'en', 'US', 'America/Los_Angeles', NOW() - INTERVAL '355 days', NOW()),
  ('usr-mu-04', 'member2@mu.dev', 'Michelle Miller', 'Michelle', 'Miller', 'member', true, 'en', 'CA', 'America/Toronto', NOW() - INTERVAL '350 days', NOW()),
  ('usr-mu-05', 'member3@mu.dev', 'Matthew Morgan', 'Matthew', 'Morgan', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '345 days', NOW()),

  -- NU DYNAMICS (Team 13) - Enterprise Yearly
  ('usr-nu-01', 'owner@nu.dev', 'Nathan Nu', 'Nathan', 'Nu', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '365 days', NOW()),
  ('usr-nu-02', 'admin@nu.dev', 'Nicole Nelson', 'Nicole', 'Nelson', 'member', true, 'en', 'US', 'America/Denver', NOW() - INTERVAL '360 days', NOW()),
  ('usr-nu-03', 'member1@nu.dev', 'Noah Nguyen', 'Noah', 'Nguyen', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '355 days', NOW()),
  ('usr-nu-04', 'member2@nu.dev', 'Nina Navarro', 'Nina', 'Navarro', 'member', true, 'es', 'AR', 'America/Argentina/Buenos_Aires', NOW() - INTERVAL '350 days', NOW()),
  ('usr-nu-05', 'member3@nu.dev', 'Nolan Nash', 'Nolan', 'Nash', 'member', true, 'en', 'AU', 'Australia/Melbourne', NOW() - INTERVAL '345 days', NOW()),

  -- XI SOLUTIONS (Team 14) - Pro Yearly
  ('usr-xi-01', 'owner@xi.dev', 'Xavier Xi', 'Xavier', 'Xi', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '365 days', NOW()),
  ('usr-xi-02', 'admin@xi.dev', 'Xena Xiong', 'Xena', 'Xiong', 'member', true, 'en', 'US', 'America/Los_Angeles', NOW() - INTERVAL '360 days', NOW()),
  ('usr-xi-03', 'member1@xi.dev', 'Xander Cross', 'Xander', 'Cross', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '355 days', NOW()),
  ('usr-xi-04', 'member2@xi.dev', 'Ximena Xochitl', 'Ximena', 'Xochitl', 'member', true, 'es', 'MX', 'America/Mexico_City', NOW() - INTERVAL '350 days', NOW()),
  ('usr-xi-05', 'member3@xi.dev', 'Xyla Xavier', 'Xyla', 'Xavier', 'member', true, 'en', 'CA', 'America/Vancouver', NOW() - INTERVAL '345 days', NOW()),

  -- OMICRON LABS (Team 15) - Pro Yearly
  ('usr-omicron-01', 'owner@omicron.dev', 'Oscar Omicron', 'Oscar', 'Omicron', 'member', true, 'en', 'US', 'America/New_York', NOW() - INTERVAL '365 days', NOW()),
  ('usr-omicron-02', 'admin@omicron.dev', 'Olivia Oliver', 'Olivia', 'Oliver', 'member', true, 'en', 'US', 'America/Chicago', NOW() - INTERVAL '360 days', NOW()),
  ('usr-omicron-03', 'member1@omicron.dev', 'Owen O''Brien', 'Owen', 'O''Brien', 'member', true, 'en', 'GB', 'Europe/London', NOW() - INTERVAL '355 days', NOW()),
  ('usr-omicron-04', 'member2@omicron.dev', 'Olga Ortiz', 'Olga', 'Ortiz', 'member', true, 'es', 'ES', 'Europe/Madrid', NOW() - INTERVAL '350 days', NOW()),
  ('usr-omicron-05', 'member3@omicron.dev', 'Otto Osborne', 'Otto', 'Osborne', 'member', true, 'en', 'AU', 'Australia/Perth', NOW() - INTERVAL '345 days', NOW())
ON CONFLICT (email) DO NOTHING;

-- NEW TEAMS (15 total - 10 monthly + 5 annual)
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
  ('team-alpha-001', 'Alpha Tech', 'alpha-tech', 'Software startup - Building innovative solutions', 'usr-alpha-01', '{"segment": "startup", "industry": "software", "employeeCount": 15, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-beta-002', 'Beta Solutions', 'beta-solutions', 'Digital agency - Creative marketing and design', 'usr-beta-01', '{"segment": "smb", "industry": "marketing", "employeeCount": 25, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-gamma-003', 'Gamma Industries', 'gamma-industries', 'Manufacturing - Industrial equipment and supplies', 'usr-gamma-01', '{"segment": "enterprise", "industry": "manufacturing", "employeeCount": 150, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-delta-004', 'Delta Dynamics', 'delta-dynamics', 'Engineering - Precision engineering services', 'usr-delta-01', '{"segment": "smb", "industry": "engineering", "employeeCount": 40, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-epsilon-005', 'Epsilon Media', 'epsilon-media', 'Media company - Content creation and distribution', 'usr-epsilon-01', '{"segment": "smb", "industry": "media", "employeeCount": 35, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-zeta-006', 'Zeta Finance', 'zeta-finance', 'Fintech - Financial technology solutions', 'usr-zeta-01', '{"segment": "startup", "industry": "fintech", "employeeCount": 20, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-eta-007', 'Eta Healthcare', 'eta-healthcare', 'Healthcare - Medical technology and services', 'usr-eta-01', '{"segment": "enterprise", "industry": "healthcare", "employeeCount": 200, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-theta-008', 'Theta Enterprises', 'theta-enterprises', 'Large corporation - Enterprise solutions', 'usr-theta-01', '{"segment": "enterprise", "industry": "consulting", "employeeCount": 500, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-iota-009', 'Iota Consulting', 'iota-consulting', 'Consulting - Business strategy and operations', 'usr-iota-01', '{"segment": "smb", "industry": "consulting", "employeeCount": 30, "churned": true, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  ('team-kappa-010', 'Kappa Labs', 'kappa-labs', 'Research lab - R&D and innovation', 'usr-kappa-01', '{"segment": "startup", "industry": "research", "employeeCount": 12, "churned": true, "isSeedData": true}'::jsonb, NOW() - INTERVAL '180 days', NOW()),
  -- Annual Subscription Teams (Teams 11-15)
  ('team-lambda-011', 'Lambda Corp', 'lambda-corp', 'Enterprise - Global technology corporation', 'usr-lambda-01', '{"segment": "enterprise", "industry": "technology", "employeeCount": 500, "billingCycle": "annual", "isSeedData": true}'::jsonb, NOW() - INTERVAL '365 days', NOW()),
  ('team-mu-012', 'Mu Industries', 'mu-industries', 'Manufacturing - Heavy industry and automation', 'usr-mu-01', '{"segment": "enterprise", "industry": "manufacturing", "employeeCount": 450, "billingCycle": "annual", "isSeedData": true}'::jsonb, NOW() - INTERVAL '365 days', NOW()),
  ('team-nu-013', 'Nu Dynamics', 'nu-dynamics', 'Technology - Advanced systems and AI', 'usr-nu-01', '{"segment": "enterprise", "industry": "technology", "employeeCount": 300, "billingCycle": "annual", "isSeedData": true}'::jsonb, NOW() - INTERVAL '365 days', NOW()),
  ('team-xi-014', 'Xi Solutions', 'xi-solutions', 'Consulting - Strategic advisory services', 'usr-xi-01', '{"segment": "smb", "industry": "consulting", "employeeCount": 50, "billingCycle": "annual", "isSeedData": true}'::jsonb, NOW() - INTERVAL '365 days', NOW()),
  ('team-omicron-015', 'Omicron Labs', 'omicron-labs', 'Research - Scientific research and development', 'usr-omicron-01', '{"segment": "startup", "industry": "research", "employeeCount": 25, "billingCycle": "annual", "isSeedData": true}'::jsonb, NOW() - INTERVAL '365 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- NEW TEAM MEMBERSHIPS (50 total - 5 per team)
INSERT INTO "team_members" (
  id,
  "teamId",
  "userId",
  role,
  "joinedAt"
) VALUES
  -- Alpha Tech
  ('tm-alpha-01', 'team-alpha-001', 'usr-alpha-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-alpha-02', 'team-alpha-001', 'usr-alpha-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-alpha-03', 'team-alpha-001', 'usr-alpha-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-alpha-04', 'team-alpha-001', 'usr-alpha-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-alpha-05', 'team-alpha-001', 'usr-alpha-05', 'member', NOW() - INTERVAL '160 days'),

  -- Beta Solutions
  ('tm-beta-01', 'team-beta-002', 'usr-beta-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-beta-02', 'team-beta-002', 'usr-beta-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-beta-03', 'team-beta-002', 'usr-beta-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-beta-04', 'team-beta-002', 'usr-beta-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-beta-05', 'team-beta-002', 'usr-beta-05', 'member', NOW() - INTERVAL '160 days'),

  -- Gamma Industries
  ('tm-gamma-01', 'team-gamma-003', 'usr-gamma-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-gamma-02', 'team-gamma-003', 'usr-gamma-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-gamma-03', 'team-gamma-003', 'usr-gamma-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-gamma-04', 'team-gamma-003', 'usr-gamma-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-gamma-05', 'team-gamma-003', 'usr-gamma-05', 'member', NOW() - INTERVAL '160 days'),

  -- Delta Dynamics
  ('tm-delta-01', 'team-delta-004', 'usr-delta-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-delta-02', 'team-delta-004', 'usr-delta-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-delta-03', 'team-delta-004', 'usr-delta-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-delta-04', 'team-delta-004', 'usr-delta-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-delta-05', 'team-delta-004', 'usr-delta-05', 'member', NOW() - INTERVAL '160 days'),

  -- Epsilon Media
  ('tm-epsilon-01', 'team-epsilon-005', 'usr-epsilon-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-epsilon-02', 'team-epsilon-005', 'usr-epsilon-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-epsilon-03', 'team-epsilon-005', 'usr-epsilon-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-epsilon-04', 'team-epsilon-005', 'usr-epsilon-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-epsilon-05', 'team-epsilon-005', 'usr-epsilon-05', 'member', NOW() - INTERVAL '160 days'),

  -- Zeta Finance
  ('tm-zeta-01', 'team-zeta-006', 'usr-zeta-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-zeta-02', 'team-zeta-006', 'usr-zeta-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-zeta-03', 'team-zeta-006', 'usr-zeta-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-zeta-04', 'team-zeta-006', 'usr-zeta-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-zeta-05', 'team-zeta-006', 'usr-zeta-05', 'member', NOW() - INTERVAL '160 days'),

  -- Eta Healthcare
  ('tm-eta-01', 'team-eta-007', 'usr-eta-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-eta-02', 'team-eta-007', 'usr-eta-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-eta-03', 'team-eta-007', 'usr-eta-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-eta-04', 'team-eta-007', 'usr-eta-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-eta-05', 'team-eta-007', 'usr-eta-05', 'member', NOW() - INTERVAL '160 days'),

  -- Theta Enterprises
  ('tm-theta-01', 'team-theta-008', 'usr-theta-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-theta-02', 'team-theta-008', 'usr-theta-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-theta-03', 'team-theta-008', 'usr-theta-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-theta-04', 'team-theta-008', 'usr-theta-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-theta-05', 'team-theta-008', 'usr-theta-05', 'member', NOW() - INTERVAL '160 days'),

  -- Iota Consulting
  ('tm-iota-01', 'team-iota-009', 'usr-iota-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-iota-02', 'team-iota-009', 'usr-iota-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-iota-03', 'team-iota-009', 'usr-iota-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-iota-04', 'team-iota-009', 'usr-iota-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-iota-05', 'team-iota-009', 'usr-iota-05', 'member', NOW() - INTERVAL '160 days'),

  -- Kappa Labs
  ('tm-kappa-01', 'team-kappa-010', 'usr-kappa-01', 'owner', NOW() - INTERVAL '180 days'),
  ('tm-kappa-02', 'team-kappa-010', 'usr-kappa-02', 'admin', NOW() - INTERVAL '175 days'),
  ('tm-kappa-03', 'team-kappa-010', 'usr-kappa-03', 'member', NOW() - INTERVAL '170 days'),
  ('tm-kappa-04', 'team-kappa-010', 'usr-kappa-04', 'member', NOW() - INTERVAL '165 days'),
  ('tm-kappa-05', 'team-kappa-010', 'usr-kappa-05', 'member', NOW() - INTERVAL '160 days'),

  -- Annual Teams (Teams 11-15)
  -- Lambda Corp
  ('tm-lambda-01', 'team-lambda-011', 'usr-lambda-01', 'owner', NOW() - INTERVAL '365 days'),
  ('tm-lambda-02', 'team-lambda-011', 'usr-lambda-02', 'admin', NOW() - INTERVAL '360 days'),
  ('tm-lambda-03', 'team-lambda-011', 'usr-lambda-03', 'member', NOW() - INTERVAL '355 days'),
  ('tm-lambda-04', 'team-lambda-011', 'usr-lambda-04', 'member', NOW() - INTERVAL '350 days'),
  ('tm-lambda-05', 'team-lambda-011', 'usr-lambda-05', 'member', NOW() - INTERVAL '345 days'),

  -- Mu Industries
  ('tm-mu-01', 'team-mu-012', 'usr-mu-01', 'owner', NOW() - INTERVAL '365 days'),
  ('tm-mu-02', 'team-mu-012', 'usr-mu-02', 'admin', NOW() - INTERVAL '360 days'),
  ('tm-mu-03', 'team-mu-012', 'usr-mu-03', 'member', NOW() - INTERVAL '355 days'),
  ('tm-mu-04', 'team-mu-012', 'usr-mu-04', 'member', NOW() - INTERVAL '350 days'),
  ('tm-mu-05', 'team-mu-012', 'usr-mu-05', 'member', NOW() - INTERVAL '345 days'),

  -- Nu Dynamics
  ('tm-nu-01', 'team-nu-013', 'usr-nu-01', 'owner', NOW() - INTERVAL '365 days'),
  ('tm-nu-02', 'team-nu-013', 'usr-nu-02', 'admin', NOW() - INTERVAL '360 days'),
  ('tm-nu-03', 'team-nu-013', 'usr-nu-03', 'member', NOW() - INTERVAL '355 days'),
  ('tm-nu-04', 'team-nu-013', 'usr-nu-04', 'member', NOW() - INTERVAL '350 days'),
  ('tm-nu-05', 'team-nu-013', 'usr-nu-05', 'member', NOW() - INTERVAL '345 days'),

  -- Xi Solutions
  ('tm-xi-01', 'team-xi-014', 'usr-xi-01', 'owner', NOW() - INTERVAL '365 days'),
  ('tm-xi-02', 'team-xi-014', 'usr-xi-02', 'admin', NOW() - INTERVAL '360 days'),
  ('tm-xi-03', 'team-xi-014', 'usr-xi-03', 'member', NOW() - INTERVAL '355 days'),
  ('tm-xi-04', 'team-xi-014', 'usr-xi-04', 'member', NOW() - INTERVAL '350 days'),
  ('tm-xi-05', 'team-xi-014', 'usr-xi-05', 'member', NOW() - INTERVAL '345 days'),

  -- Omicron Labs
  ('tm-omicron-01', 'team-omicron-015', 'usr-omicron-01', 'owner', NOW() - INTERVAL '365 days'),
  ('tm-omicron-02', 'team-omicron-015', 'usr-omicron-02', 'admin', NOW() - INTERVAL '360 days'),
  ('tm-omicron-03', 'team-omicron-015', 'usr-omicron-03', 'member', NOW() - INTERVAL '355 days'),
  ('tm-omicron-04', 'team-omicron-015', 'usr-omicron-04', 'member', NOW() - INTERVAL '350 days'),
  ('tm-omicron-05', 'team-omicron-015', 'usr-omicron-05', 'member', NOW() - INTERVAL '345 days')
ON CONFLICT (id) DO NOTHING;

-- NEW ACCOUNTS (50 total - all use Test1234)
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
  -- Alpha Tech
  ('acc-alpha-01', 'usr-alpha-01', 'owner@alpha.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-alpha-02', 'usr-alpha-02', 'admin@alpha.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-alpha-03', 'usr-alpha-03', 'member1@alpha.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-alpha-04', 'usr-alpha-04', 'member2@alpha.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-alpha-05', 'usr-alpha-05', 'member3@alpha.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Beta Solutions
  ('acc-beta-01', 'usr-beta-01', 'owner@beta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-beta-02', 'usr-beta-02', 'admin@beta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-beta-03', 'usr-beta-03', 'member1@beta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-beta-04', 'usr-beta-04', 'member2@beta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-beta-05', 'usr-beta-05', 'member3@beta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Gamma Industries
  ('acc-gamma-01', 'usr-gamma-01', 'owner@gamma.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-gamma-02', 'usr-gamma-02', 'admin@gamma.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-gamma-03', 'usr-gamma-03', 'member1@gamma.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-gamma-04', 'usr-gamma-04', 'member2@gamma.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-gamma-05', 'usr-gamma-05', 'member3@gamma.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Delta Dynamics
  ('acc-delta-01', 'usr-delta-01', 'owner@delta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-delta-02', 'usr-delta-02', 'admin@delta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-delta-03', 'usr-delta-03', 'member1@delta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-delta-04', 'usr-delta-04', 'member2@delta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-delta-05', 'usr-delta-05', 'member3@delta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Epsilon Media
  ('acc-epsilon-01', 'usr-epsilon-01', 'owner@epsilon.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-epsilon-02', 'usr-epsilon-02', 'admin@epsilon.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-epsilon-03', 'usr-epsilon-03', 'member1@epsilon.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-epsilon-04', 'usr-epsilon-04', 'member2@epsilon.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-epsilon-05', 'usr-epsilon-05', 'member3@epsilon.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Zeta Finance
  ('acc-zeta-01', 'usr-zeta-01', 'owner@zeta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-zeta-02', 'usr-zeta-02', 'admin@zeta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-zeta-03', 'usr-zeta-03', 'member1@zeta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-zeta-04', 'usr-zeta-04', 'member2@zeta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-zeta-05', 'usr-zeta-05', 'member3@zeta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Eta Healthcare
  ('acc-eta-01', 'usr-eta-01', 'owner@eta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-eta-02', 'usr-eta-02', 'admin@eta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-eta-03', 'usr-eta-03', 'member1@eta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-eta-04', 'usr-eta-04', 'member2@eta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-eta-05', 'usr-eta-05', 'member3@eta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Theta Enterprises
  ('acc-theta-01', 'usr-theta-01', 'owner@theta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-theta-02', 'usr-theta-02', 'admin@theta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-theta-03', 'usr-theta-03', 'member1@theta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-theta-04', 'usr-theta-04', 'member2@theta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-theta-05', 'usr-theta-05', 'member3@theta.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Iota Consulting
  ('acc-iota-01', 'usr-iota-01', 'owner@iota.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-iota-02', 'usr-iota-02', 'admin@iota.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-iota-03', 'usr-iota-03', 'member1@iota.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-iota-04', 'usr-iota-04', 'member2@iota.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-iota-05', 'usr-iota-05', 'member3@iota.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Kappa Labs
  ('acc-kappa-01', 'usr-kappa-01', 'owner@kappa.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-kappa-02', 'usr-kappa-02', 'admin@kappa.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-kappa-03', 'usr-kappa-03', 'member1@kappa.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-kappa-04', 'usr-kappa-04', 'member2@kappa.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-kappa-05', 'usr-kappa-05', 'member3@kappa.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Annual Teams (Teams 11-15)
  -- Lambda Corp
  ('acc-lambda-01', 'usr-lambda-01', 'owner@lambda.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-lambda-02', 'usr-lambda-02', 'admin@lambda.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-lambda-03', 'usr-lambda-03', 'member1@lambda.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-lambda-04', 'usr-lambda-04', 'member2@lambda.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-lambda-05', 'usr-lambda-05', 'member3@lambda.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Mu Industries
  ('acc-mu-01', 'usr-mu-01', 'owner@mu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-mu-02', 'usr-mu-02', 'admin@mu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-mu-03', 'usr-mu-03', 'member1@mu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-mu-04', 'usr-mu-04', 'member2@mu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-mu-05', 'usr-mu-05', 'member3@mu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Nu Dynamics
  ('acc-nu-01', 'usr-nu-01', 'owner@nu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-nu-02', 'usr-nu-02', 'admin@nu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-nu-03', 'usr-nu-03', 'member1@nu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-nu-04', 'usr-nu-04', 'member2@nu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-nu-05', 'usr-nu-05', 'member3@nu.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Xi Solutions
  ('acc-xi-01', 'usr-xi-01', 'owner@xi.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-xi-02', 'usr-xi-02', 'admin@xi.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-xi-03', 'usr-xi-03', 'member1@xi.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-xi-04', 'usr-xi-04', 'member2@xi.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-xi-05', 'usr-xi-05', 'member3@xi.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),

  -- Omicron Labs
  ('acc-omicron-01', 'usr-omicron-01', 'owner@omicron.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-omicron-02', 'usr-omicron-02', 'admin@omicron.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-omicron-03', 'usr-omicron-03', 'member1@omicron.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-omicron-04', 'usr-omicron-04', 'member2@omicron.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW()),
  ('acc-omicron-05', 'usr-omicron-05', 'member3@omicron.dev', 'credential', NULL, NULL, NULL, NULL, NULL, NULL, '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW(), NOW())
ON CONFLICT ("providerId", "accountId") DO NOTHING;

-- NEW USER METADATA (50 total - activeTeamId for each)
INSERT INTO "users_metas" (
  "userId", "metaKey", "metaValue", "dataType", "isPublic", "isSearchable", "createdAt", "updatedAt"
) VALUES
  -- Alpha Tech
  ('usr-alpha-01', 'activeTeamId', '"team-alpha-001"', 'json', false, false, NOW(), NOW()),
  ('usr-alpha-02', 'activeTeamId', '"team-alpha-001"', 'json', false, false, NOW(), NOW()),
  ('usr-alpha-03', 'activeTeamId', '"team-alpha-001"', 'json', false, false, NOW(), NOW()),
  ('usr-alpha-04', 'activeTeamId', '"team-alpha-001"', 'json', false, false, NOW(), NOW()),
  ('usr-alpha-05', 'activeTeamId', '"team-alpha-001"', 'json', false, false, NOW(), NOW()),

  -- Beta Solutions
  ('usr-beta-01', 'activeTeamId', '"team-beta-002"', 'json', false, false, NOW(), NOW()),
  ('usr-beta-02', 'activeTeamId', '"team-beta-002"', 'json', false, false, NOW(), NOW()),
  ('usr-beta-03', 'activeTeamId', '"team-beta-002"', 'json', false, false, NOW(), NOW()),
  ('usr-beta-04', 'activeTeamId', '"team-beta-002"', 'json', false, false, NOW(), NOW()),
  ('usr-beta-05', 'activeTeamId', '"team-beta-002"', 'json', false, false, NOW(), NOW()),

  -- Gamma Industries
  ('usr-gamma-01', 'activeTeamId', '"team-gamma-003"', 'json', false, false, NOW(), NOW()),
  ('usr-gamma-02', 'activeTeamId', '"team-gamma-003"', 'json', false, false, NOW(), NOW()),
  ('usr-gamma-03', 'activeTeamId', '"team-gamma-003"', 'json', false, false, NOW(), NOW()),
  ('usr-gamma-04', 'activeTeamId', '"team-gamma-003"', 'json', false, false, NOW(), NOW()),
  ('usr-gamma-05', 'activeTeamId', '"team-gamma-003"', 'json', false, false, NOW(), NOW()),

  -- Delta Dynamics
  ('usr-delta-01', 'activeTeamId', '"team-delta-004"', 'json', false, false, NOW(), NOW()),
  ('usr-delta-02', 'activeTeamId', '"team-delta-004"', 'json', false, false, NOW(), NOW()),
  ('usr-delta-03', 'activeTeamId', '"team-delta-004"', 'json', false, false, NOW(), NOW()),
  ('usr-delta-04', 'activeTeamId', '"team-delta-004"', 'json', false, false, NOW(), NOW()),
  ('usr-delta-05', 'activeTeamId', '"team-delta-004"', 'json', false, false, NOW(), NOW()),

  -- Epsilon Media
  ('usr-epsilon-01', 'activeTeamId', '"team-epsilon-005"', 'json', false, false, NOW(), NOW()),
  ('usr-epsilon-02', 'activeTeamId', '"team-epsilon-005"', 'json', false, false, NOW(), NOW()),
  ('usr-epsilon-03', 'activeTeamId', '"team-epsilon-005"', 'json', false, false, NOW(), NOW()),
  ('usr-epsilon-04', 'activeTeamId', '"team-epsilon-005"', 'json', false, false, NOW(), NOW()),
  ('usr-epsilon-05', 'activeTeamId', '"team-epsilon-005"', 'json', false, false, NOW(), NOW()),

  -- Zeta Finance
  ('usr-zeta-01', 'activeTeamId', '"team-zeta-006"', 'json', false, false, NOW(), NOW()),
  ('usr-zeta-02', 'activeTeamId', '"team-zeta-006"', 'json', false, false, NOW(), NOW()),
  ('usr-zeta-03', 'activeTeamId', '"team-zeta-006"', 'json', false, false, NOW(), NOW()),
  ('usr-zeta-04', 'activeTeamId', '"team-zeta-006"', 'json', false, false, NOW(), NOW()),
  ('usr-zeta-05', 'activeTeamId', '"team-zeta-006"', 'json', false, false, NOW(), NOW()),

  -- Eta Healthcare
  ('usr-eta-01', 'activeTeamId', '"team-eta-007"', 'json', false, false, NOW(), NOW()),
  ('usr-eta-02', 'activeTeamId', '"team-eta-007"', 'json', false, false, NOW(), NOW()),
  ('usr-eta-03', 'activeTeamId', '"team-eta-007"', 'json', false, false, NOW(), NOW()),
  ('usr-eta-04', 'activeTeamId', '"team-eta-007"', 'json', false, false, NOW(), NOW()),
  ('usr-eta-05', 'activeTeamId', '"team-eta-007"', 'json', false, false, NOW(), NOW()),

  -- Theta Enterprises
  ('usr-theta-01', 'activeTeamId', '"team-theta-008"', 'json', false, false, NOW(), NOW()),
  ('usr-theta-02', 'activeTeamId', '"team-theta-008"', 'json', false, false, NOW(), NOW()),
  ('usr-theta-03', 'activeTeamId', '"team-theta-008"', 'json', false, false, NOW(), NOW()),
  ('usr-theta-04', 'activeTeamId', '"team-theta-008"', 'json', false, false, NOW(), NOW()),
  ('usr-theta-05', 'activeTeamId', '"team-theta-008"', 'json', false, false, NOW(), NOW()),

  -- Iota Consulting
  ('usr-iota-01', 'activeTeamId', '"team-iota-009"', 'json', false, false, NOW(), NOW()),
  ('usr-iota-02', 'activeTeamId', '"team-iota-009"', 'json', false, false, NOW(), NOW()),
  ('usr-iota-03', 'activeTeamId', '"team-iota-009"', 'json', false, false, NOW(), NOW()),
  ('usr-iota-04', 'activeTeamId', '"team-iota-009"', 'json', false, false, NOW(), NOW()),
  ('usr-iota-05', 'activeTeamId', '"team-iota-009"', 'json', false, false, NOW(), NOW()),

  -- Kappa Labs
  ('usr-kappa-01', 'activeTeamId', '"team-kappa-010"', 'json', false, false, NOW(), NOW()),
  ('usr-kappa-02', 'activeTeamId', '"team-kappa-010"', 'json', false, false, NOW(), NOW()),
  ('usr-kappa-03', 'activeTeamId', '"team-kappa-010"', 'json', false, false, NOW(), NOW()),
  ('usr-kappa-04', 'activeTeamId', '"team-kappa-010"', 'json', false, false, NOW(), NOW()),
  ('usr-kappa-05', 'activeTeamId', '"team-kappa-010"', 'json', false, false, NOW(), NOW()),

  -- Annual Teams (Teams 11-15)
  -- Lambda Corp
  ('usr-lambda-01', 'activeTeamId', '"team-lambda-011"', 'json', false, false, NOW(), NOW()),
  ('usr-lambda-02', 'activeTeamId', '"team-lambda-011"', 'json', false, false, NOW(), NOW()),
  ('usr-lambda-03', 'activeTeamId', '"team-lambda-011"', 'json', false, false, NOW(), NOW()),
  ('usr-lambda-04', 'activeTeamId', '"team-lambda-011"', 'json', false, false, NOW(), NOW()),
  ('usr-lambda-05', 'activeTeamId', '"team-lambda-011"', 'json', false, false, NOW(), NOW()),

  -- Mu Industries
  ('usr-mu-01', 'activeTeamId', '"team-mu-012"', 'json', false, false, NOW(), NOW()),
  ('usr-mu-02', 'activeTeamId', '"team-mu-012"', 'json', false, false, NOW(), NOW()),
  ('usr-mu-03', 'activeTeamId', '"team-mu-012"', 'json', false, false, NOW(), NOW()),
  ('usr-mu-04', 'activeTeamId', '"team-mu-012"', 'json', false, false, NOW(), NOW()),
  ('usr-mu-05', 'activeTeamId', '"team-mu-012"', 'json', false, false, NOW(), NOW()),

  -- Nu Dynamics
  ('usr-nu-01', 'activeTeamId', '"team-nu-013"', 'json', false, false, NOW(), NOW()),
  ('usr-nu-02', 'activeTeamId', '"team-nu-013"', 'json', false, false, NOW(), NOW()),
  ('usr-nu-03', 'activeTeamId', '"team-nu-013"', 'json', false, false, NOW(), NOW()),
  ('usr-nu-04', 'activeTeamId', '"team-nu-013"', 'json', false, false, NOW(), NOW()),
  ('usr-nu-05', 'activeTeamId', '"team-nu-013"', 'json', false, false, NOW(), NOW()),

  -- Xi Solutions
  ('usr-xi-01', 'activeTeamId', '"team-xi-014"', 'json', false, false, NOW(), NOW()),
  ('usr-xi-02', 'activeTeamId', '"team-xi-014"', 'json', false, false, NOW(), NOW()),
  ('usr-xi-03', 'activeTeamId', '"team-xi-014"', 'json', false, false, NOW(), NOW()),
  ('usr-xi-04', 'activeTeamId', '"team-xi-014"', 'json', false, false, NOW(), NOW()),
  ('usr-xi-05', 'activeTeamId', '"team-xi-014"', 'json', false, false, NOW(), NOW()),

  -- Omicron Labs
  ('usr-omicron-01', 'activeTeamId', '"team-omicron-015"', 'json', false, false, NOW(), NOW()),
  ('usr-omicron-02', 'activeTeamId', '"team-omicron-015"', 'json', false, false, NOW(), NOW()),
  ('usr-omicron-03', 'activeTeamId', '"team-omicron-015"', 'json', false, false, NOW(), NOW()),
  ('usr-omicron-04', 'activeTeamId', '"team-omicron-015"', 'json', false, false, NOW(), NOW()),
  ('usr-omicron-05', 'activeTeamId', '"team-omicron-015"', 'json', false, false, NOW(), NOW())
ON CONFLICT ("userId", "metaKey") DO NOTHING;

