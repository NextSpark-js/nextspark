-- ============================================================================
-- Blog Theme - Multi-Author Sample Data Migration
-- Scenario: Medium-style multi-author blog platform
-- Teams Mode: single-user (each author has isolated team, public feed aggregates all)
-- ============================================================================

-- ============================================
-- STEP 0: CLEANUP (preserves superadmin)
-- ============================================
DO $$
DECLARE
  v_superadmin_id TEXT;
BEGIN
  -- Get superadmin ID to preserve
  SELECT id INTO v_superadmin_id FROM "users" WHERE role = 'superadmin' LIMIT 1;

  -- Clean theme entities (if tables exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
    TRUNCATE "posts" CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    TRUNCATE "categories" CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    TRUNCATE "invoices" CASCADE;
  END IF;

  -- Clean team-related data (except superadmin's)
  IF v_superadmin_id IS NOT NULL THEN
    DELETE FROM "api_audit_log" WHERE "userId" != v_superadmin_id;
    DELETE FROM "api_key" WHERE "userId" != v_superadmin_id;
    DELETE FROM "team_members" WHERE "userId" != v_superadmin_id;
    DELETE FROM "teams" WHERE "ownerId" != v_superadmin_id;
    DELETE FROM "users_metas" WHERE "userId" != v_superadmin_id;
    DELETE FROM "session" WHERE "userId" != v_superadmin_id;
    DELETE FROM "account" WHERE "userId" != v_superadmin_id;
    DELETE FROM "users" WHERE id != v_superadmin_id;
  ELSE
    -- No superadmin, clean everything
    DELETE FROM "api_audit_log";
    DELETE FROM "api_key";
    DELETE FROM "team_members";
    DELETE FROM "teams";
    DELETE FROM "users_metas";
    DELETE FROM "session";
    DELETE FROM "account";
    DELETE FROM "users";
  END IF;

  RAISE NOTICE 'Blog theme cleanup complete. Superadmin preserved.';
END $$;

-- ============================================
-- STEP 1: CREATE 3 BLOG AUTHORS
-- ============================================
-- Multi-author Medium-style platform with 3 content creators

INSERT INTO "users" (
  id,
  email,
  name,
  "firstName",
  "lastName",
  username,
  bio,
  social_twitter,
  social_linkedin,
  social_website,
  role,
  "emailVerified",
  language,
  country,
  timezone,
  "createdAt",
  "updatedAt"
) VALUES
  -- Marcos Tech - Technology & Startups niche
  (
    'usr-blog-marcos',
    'blog_author_marcos@nextspark.dev',
    'Marcos Tech',
    'Marcos',
    'Tech',
    'marcos_tech',
    'Tech entrepreneur and developer. Building the future one line of code at a time. Writing about AI, SaaS, and startup life.',
    'https://twitter.com/marcostech',
    'https://linkedin.com/in/marcostech',
    'https://marcostech.dev',
    'member',
    true,
    'en',
    'US',
    'America/Los_Angeles',
    NOW() - INTERVAL '6 months',
    NOW()
  ),
  -- Lucia Lifestyle - Travel & Lifestyle niche
  (
    'usr-blog-lucia',
    'blog_author_lucia@nextspark.dev',
    'Lucia Lifestyle',
    'Lucia',
    'Lifestyle',
    'lucia_lifestyle',
    'Digital nomad exploring the world. Sharing travel tips, remote work advice, and lifestyle adventures from 30+ countries.',
    'https://twitter.com/lucialifestyle',
    'https://linkedin.com/in/lucialifestyle',
    'https://lucialifestyle.com',
    'member',
    true,
    'es',
    'ES',
    'Europe/Madrid',
    NOW() - INTERVAL '5 months',
    NOW()
  ),
  -- Carlos Finance - Business & Finance niche
  (
    'usr-blog-carlos',
    'blog_author_carlos@nextspark.dev',
    'Carlos Finance',
    'Carlos',
    'Finance',
    'carlos_finance',
    'Financial advisor helping everyday people build wealth. Making personal finance simple and accessible for everyone.',
    'https://twitter.com/carlosfinance',
    'https://linkedin.com/in/carlosfinance',
    NULL,
    'member',
    true,
    'en',
    'US',
    'America/New_York',
    NOW() - INTERVAL '4 months',
    NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- STEP 2: CREATE 3 AUTHOR TEAMS (BLOGS)
-- ============================================
-- Each author has their own isolated blog

INSERT INTO "teams" (
  id,
  name,
  slug,
  description,
  "ownerId",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'team-blog-marcos',
    'Marcos Tech Blog',
    'marcos-tech',
    'Technology insights and startup wisdom',
    'usr-blog-marcos',
    NOW() - INTERVAL '6 months',
    NOW()
  ),
  (
    'team-blog-lucia',
    'Lucia Lifestyle Blog',
    'lucia-lifestyle',
    'Travel adventures and lifestyle tips',
    'usr-blog-lucia',
    NOW() - INTERVAL '5 months',
    NOW()
  ),
  (
    'team-blog-carlos',
    'Carlos Finance Blog',
    'carlos-finance',
    'Personal finance and investment strategies',
    'usr-blog-carlos',
    NOW() - INTERVAL '4 months',
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
  ('tm-blog-marcos', 'team-blog-marcos', 'usr-blog-marcos', 'owner', NOW() - INTERVAL '6 months'),
  ('tm-blog-lucia', 'team-blog-lucia', 'usr-blog-lucia', 'owner', NOW() - INTERVAL '5 months'),
  ('tm-blog-carlos', 'team-blog-carlos', 'usr-blog-carlos', 'owner', NOW() - INTERVAL '4 months')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 4: CREATE ACCOUNTS (Password: Test1234)
-- ============================================
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
    'acc-blog-marcos',
    'usr-blog-marcos',
    'blog_author_marcos@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW() - INTERVAL '6 months',
    NOW()
  ),
  (
    'acc-blog-lucia',
    'usr-blog-lucia',
    'blog_author_lucia@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW() - INTERVAL '5 months',
    NOW()
  ),
  (
    'acc-blog-carlos',
    'usr-blog-carlos',
    'blog_author_carlos@nextspark.dev',
    'credential',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
    NOW() - INTERVAL '4 months',
    NOW()
  )
ON CONFLICT ("providerId", "accountId") DO NOTHING;

-- ============================================
-- STEP 5: CREATE USER METADATA
-- ============================================

INSERT INTO "users_metas" (
  "userId",
  "metaKey",
  "metaValue",
  "dataType",
  "isPublic",
  "isSearchable",
  "createdAt",
  "updatedAt"
) VALUES
  -- Marcos metadata
  ('usr-blog-marcos', 'activeTeamId', '"team-blog-marcos"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-marcos', 'uiPreferences', '{"theme": "dark", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  -- Lucia metadata
  ('usr-blog-lucia', 'activeTeamId', '"team-blog-lucia"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-lucia', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": false}', 'json', false, false, NOW(), NOW()),
  -- Carlos metadata
  ('usr-blog-carlos', 'activeTeamId', '"team-blog-carlos"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-carlos', 'uiPreferences', '{"theme": "light", "sidebarCollapsed": true}', 'json', false, false, NOW(), NOW())
ON CONFLICT ("userId", "metaKey") DO NOTHING;

-- ============================================
-- STEP 6: CREATE SAMPLE CATEGORIES
-- ============================================
-- Each author has 3 categories for their niche

INSERT INTO "categories" (
  id,
  "teamId",
  "userId",
  name,
  slug,
  description,
  "createdAt",
  "updatedAt"
) VALUES
  -- Marcos Tech categories (Technology & Startups)
  ('cat-marcos-tech', 'team-blog-marcos', 'usr-blog-marcos', 'Technology', 'technology', 'Tech trends, programming, and software development', NOW() - INTERVAL '6 months', NOW()),
  ('cat-marcos-startups', 'team-blog-marcos', 'usr-blog-marcos', 'Startups', 'startups', 'Startup advice, MVPs, and entrepreneurship', NOW() - INTERVAL '6 months', NOW()),
  ('cat-marcos-ai', 'team-blog-marcos', 'usr-blog-marcos', 'AI & ML', 'ai-ml', 'Artificial intelligence and machine learning insights', NOW() - INTERVAL '6 months', NOW()),

  -- Lucia Lifestyle categories (Travel & Lifestyle)
  ('cat-lucia-travel', 'team-blog-lucia', 'usr-blog-lucia', 'Travel', 'travel', 'Travel guides, destinations, and tips', NOW() - INTERVAL '5 months', NOW()),
  ('cat-lucia-lifestyle', 'team-blog-lucia', 'usr-blog-lucia', 'Lifestyle', 'lifestyle', 'Digital nomad lifestyle and work-life balance', NOW() - INTERVAL '5 months', NOW()),
  ('cat-lucia-remote', 'team-blog-lucia', 'usr-blog-lucia', 'Remote Work', 'remote-work', 'Working remotely, cafes, and productivity', NOW() - INTERVAL '5 months', NOW()),

  -- Carlos Finance categories (Business & Finance)
  ('cat-carlos-investing', 'team-blog-carlos', 'usr-blog-carlos', 'Investing', 'investing', 'Investment strategies and financial markets', NOW() - INTERVAL '4 months', NOW()),
  ('cat-carlos-finance', 'team-blog-carlos', 'usr-blog-carlos', 'Personal Finance', 'personal-finance', 'Budgeting, saving, and money management', NOW() - INTERVAL '4 months', NOW()),
  ('cat-carlos-income', 'team-blog-carlos', 'usr-blog-carlos', 'Side Hustles', 'side-hustles', 'Extra income streams and entrepreneurship', NOW() - INTERVAL '4 months', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 7: CREATE API KEYS
-- ============================================

INSERT INTO "api_key" (
  id,
  "userId",
  name,
  "keyHash",
  "keyPrefix",
  scopes,
  "expiresAt",
  "createdAt",
  "updatedAt",
  status
) VALUES
  (
    'apikey-blog-marcos',
    'usr-blog-marcos',
    'Marcos Blog API Key',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'testkey_marcos01',
    ARRAY['posts:read', 'posts:write', 'posts:delete'],
    NULL,
    NOW(),
    NOW(),
    'active'
  ),
  (
    'apikey-blog-lucia',
    'usr-blog-lucia',
    'Lucia Blog API Key',
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    'testkey_lucia001',
    ARRAY['posts:read', 'posts:write', 'posts:delete'],
    NULL,
    NOW(),
    NOW(),
    'active'
  ),
  (
    'apikey-blog-carlos',
    'usr-blog-carlos',
    'Carlos Blog API Key',
    'f0e1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3',
    'testkey_carlos1',
    ARRAY['posts:read', 'posts:write', 'posts:delete'],
    NULL,
    NOW(),
    NOW(),
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 8: CREATE SAMPLE POSTS (13 total)
-- ============================================
-- Marcos Tech: 5 posts (4 published, 1 draft)
-- Lucia Lifestyle: 4 posts (3 published, 1 draft)
-- Carlos Finance: 4 posts (3 published, 1 draft)

INSERT INTO "posts" (
  id,
  title,
  slug,
  excerpt,
  content,
  category,
  tags,
  status,
  "publishedAt",
  "userId",
  "teamId",
  "createdAt",
  "updatedAt"
) VALUES
  -- ========================================
  -- MARCOS TECH - Technology & Startups (5 posts)
  -- ========================================
  (
    'post-marcos-001',
    'The Future of AI in SaaS',
    'the-future-of-ai-in-saas',
    'How artificial intelligence is transforming the software-as-a-service industry and what founders need to know.',
    E'# The Future of AI in SaaS\n\nArtificial intelligence is no longer a buzzword - it''s reshaping how we build and deliver software.\n\n## The Current Landscape\n\nEvery SaaS company is now an AI company, whether they realize it or not. The integration of AI capabilities has become table stakes.\n\n### Key Trends\n\n1. **Intelligent Automation** - From customer support to data analysis\n2. **Predictive Analytics** - Understanding user behavior before it happens\n3. **Natural Language Interfaces** - Conversational UX is becoming standard\n4. **Personalization at Scale** - One-size-fits-all is dead\n\n## What This Means for Founders\n\nIf you''re building a SaaS product in 2024, you need to think about AI from day one.\n\n### Start Here\n\n- Identify repetitive tasks that AI could automate\n- Look for patterns in your data that could drive insights\n- Consider conversational interfaces for complex workflows\n\n## The Risks\n\n- Over-engineering solutions\n- Privacy concerns with user data\n- The "AI washing" trap\n\n## My Prediction\n\nIn 5 years, the distinction between "AI-powered" and regular software will disappear. AI will simply be how software works.\n\nThe question isn''t whether to adopt AI. It''s how fast you can do it well.',
    'Technology',
    '["ai", "saas", "startups", "machine-learning", "future"]'::jsonb,
    'published',
    NOW() - INTERVAL '30 days',
    'usr-blog-marcos',
    'team-blog-marcos',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
  ),
  (
    'post-marcos-002',
    'Building MVPs Fast',
    'building-mvps-fast',
    'A practical guide to launching your minimum viable product in weeks, not months.',
    E'# Building MVPs Fast\n\nSpeed is a startup''s greatest advantage. Here''s how to ship your MVP in weeks, not months.\n\n## The MVP Mindset\n\nAn MVP isn''t a crappy version of your product. It''s the smallest thing that delivers real value.\n\n## My Framework\n\n### Week 1: Define\n- Identify ONE core problem\n- List the minimum features to solve it\n- Cut that list in half\n- Cut it again\n\n### Week 2: Design\n- Paper sketches first\n- Low-fidelity wireframes\n- Don''t touch high-fidelity until validated\n\n### Week 3-4: Build\n- Use existing tools (no custom auth!)\n- Deploy early, deploy often\n- Get something in front of users ASAP\n\n## Tools I Recommend\n\n- **Auth**: Clerk, Auth0, or Better Auth\n- **Database**: Supabase or PlanetScale\n- **Payments**: Stripe (always)\n- **Hosting**: Vercel or Railway\n\n## Common Mistakes\n\n1. Building features nobody asked for\n2. Perfecting UI before validating value\n3. Not talking to users daily\n4. Building everything from scratch\n\n## The Golden Rule\n\nIf you''re not embarrassed by your first release, you launched too late.\n\nShip it. Learn. Iterate.',
    'Startups',
    '["mvp", "startups", "development", "product", "speed"]'::jsonb,
    'published',
    NOW() - INTERVAL '21 days',
    'usr-blog-marcos',
    'team-blog-marcos',
    NOW() - INTERVAL '21 days',
    NOW() - INTERVAL '21 days'
  ),
  (
    'post-marcos-003',
    'Why TypeScript Won',
    'why-typescript-won',
    'The rise of TypeScript and why it became the default choice for modern web development.',
    E'# Why TypeScript Won\n\nFive years ago, TypeScript was "that Microsoft thing." Today, it''s the default for serious JavaScript development.\n\n## The Numbers Don''t Lie\n\n- 78% of JS developers use TypeScript\n- Every major framework supports it natively\n- GitHub''s own platform runs on it\n\n## Why Developers Love It\n\n### 1. Catch Bugs Before They Ship\n```typescript\nfunction greet(name: string) {\n  return `Hello, ${name}!`\n}\n\ngreet(42) // Error: Argument of type ''number'' is not assignable\n```\n\n### 2. Better IDE Experience\n- Autocomplete that actually works\n- Refactoring without fear\n- Documentation built into the types\n\n### 3. Self-Documenting Code\n```typescript\ninterface User {\n  id: string\n  email: string\n  role: ''admin'' | ''member''\n  createdAt: Date\n}\n```\n\n## The Migration Path\n\n1. Rename `.js` to `.ts`\n2. Add types incrementally\n3. Enable strict mode when ready\n\n## What Changed My Mind\n\nI was a TypeScript skeptic. Then I maintained a large JavaScript codebase.\n\nThe time "lost" to writing types is nothing compared to the time saved debugging runtime errors.\n\n## The Verdict\n\nTypeScript didn''t win by being perfect. It won by solving real problems for real developers.',
    'Technology',
    '["typescript", "javascript", "programming", "web-development"]'::jsonb,
    'published',
    NOW() - INTERVAL '14 days',
    'usr-blog-marcos',
    'team-blog-marcos',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '14 days'
  ),
  (
    'post-marcos-004',
    'Startup Metrics That Matter',
    'startup-metrics-that-matter',
    'Stop tracking vanity metrics. Focus on the numbers that actually predict success.',
    E'# Startup Metrics That Matter\n\nNot all metrics are created equal. Here''s what to actually track.\n\n## The Vanity Trap\n\nPage views. App downloads. Social followers.\n\nThese feel good but tell you nothing about your business health.\n\n## Metrics That Matter\n\n### 1. Monthly Recurring Revenue (MRR)\nThe lifeblood of any SaaS. Track it religiously.\n\n### 2. Customer Acquisition Cost (CAC)\nHow much to acquire one customer?\n```\nCAC = Marketing Spend / New Customers\n```\n\n### 3. Lifetime Value (LTV)\nHow much does a customer pay over their lifetime?\n```\nLTV = Average Revenue per User * Average Lifespan\n```\n\n### 4. The Magic Ratio: LTV/CAC\n- < 1: You''re losing money on every customer\n- 1-3: Sustainable but tight\n- > 3: Healthy business (aim here)\n\n### 5. Churn Rate\nThe percentage of customers who leave each month.\n```\nChurn = Lost Customers / Total Customers * 100\n```\n\n## The Dashboard\n\nI check these daily:\n- MRR and growth rate\n- Trial-to-paid conversion\n- Active users (DAU/MAU)\n\nWeekly:\n- CAC and LTV\n- Churn by cohort\n- NPS score\n\n## The One Number\n\nIf you can only track one thing: **Net Revenue Retention**\n\nAre existing customers paying you more or less over time?',
    'Startups',
    '["metrics", "saas", "business", "analytics", "growth"]'::jsonb,
    'published',
    NOW() - INTERVAL '7 days',
    'usr-blog-marcos',
    'team-blog-marcos',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    'post-marcos-005',
    'Remote Team Culture',
    'remote-team-culture',
    'Building strong company culture when your team is distributed across the globe.',
    E'# Remote Team Culture\n\nBuilding culture is hard. Building remote culture is harder. But it''s not impossible.\n\n## The Challenge\n\nNo water cooler conversations. No spontaneous lunches. No reading the room.\n\nHow do you build connection without proximity?\n\n## What Works\n\n### 1. Over-communicate\n- Default to public channels\n- Write things down\n- Share context, not just decisions\n\n### 2. Create Rituals\n- Monday kickoffs\n- Friday wins\n- Virtual coffee chats\n\n### 3. Invest in IRL\n- Quarterly team meetups\n- Annual company retreat\n- Budget for local coworking\n\n## Tools That Help\n\n- **Async video**: Loom for updates\n- **Virtual office**: Gather or similar\n- **Documentation**: Notion or Confluence\n- **Chat**: Slack with threading discipline\n\n## Common Mistakes\n\n1. Too many meetings\n2. Expecting always-on availability\n3. Not trusting people to work\n4. Forgetting timezones exist\n\n## Our Practices\n\n[Draft - adding our specific examples]',
    'Startups',
    '["remote-work", "culture", "team-building", "management", "startup"]'::jsonb,
    'draft',
    NULL,
    'usr-blog-marcos',
    'team-blog-marcos',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),

  -- ========================================
  -- LUCIA LIFESTYLE - Travel & Lifestyle (4 posts)
  -- ========================================
  (
    'post-lucia-001',
    'Best Cafes for Remote Work in Lisbon',
    'best-cafes-remote-work-lisbon',
    'A digital nomad''s guide to the best spots to work in Portugal''s vibrant capital.',
    E'# Best Cafes for Remote Work in Lisbon\n\nLisbon has become a digital nomad hotspot. Here are my favorite spots to work.\n\n## What I Look For\n\n- Stable WiFi (minimum 50 Mbps)\n- Power outlets\n- Good coffee (obviously)\n- Not too crowded\n- Laptop-friendly vibes\n\n## My Top Picks\n\n### 1. Fabrica Coffee Roasters\n**Rua das Portas de Santo Antao**\n- WiFi: Excellent (80+ Mbps)\n- Outlets: Plenty\n- Vibe: Industrial, creative\n- Best for: Deep focus work\n- Pro tip: Go early, gets crowded after 11am\n\n### 2. Copenhagen Coffee Lab\n**Rua Nova da Piedade**\n- WiFi: Great (60 Mbps)\n- Outlets: Limited (bring a power bank)\n- Vibe: Minimalist Scandinavian\n- Best for: Client calls (quiet)\n- Pro tip: Their flat white is perfect\n\n### 3. Dear Breakfast\n**Multiple locations**\n- WiFi: Good (50 Mbps)\n- Outlets: Adequate\n- Vibe: Instagram-worthy\n- Best for: Brunch + emails\n- Pro tip: Try the avocado toast (yes, really)\n\n### 4. Village Underground\n**Creative hub in Alcantara**\n- WiFi: Excellent\n- Outlets: Everywhere\n- Vibe: Old buses turned into offices!\n- Best for: Community + coworking\n- Pro tip: Book a day pass for full access\n\n## The Coworking Alternative\n\nSometimes you need a proper desk:\n- **Heden**: Beautiful space, great events\n- **Second Home**: Design-focused, pricey but worth it\n\n## WiFi Backup Plan\n\nAlways have a local SIM with data. I use NOS - 10GB for around 15 euros.\n\nSee you at the next cafe!',
    'Travel',
    '["lisbon", "digital-nomad", "remote-work", "cafes", "portugal"]'::jsonb,
    'published',
    NOW() - INTERVAL '25 days',
    'usr-blog-lucia',
    'team-blog-lucia',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days'
  ),
  (
    'post-lucia-002',
    'Digital Nomad Essentials',
    'digital-nomad-essentials',
    'Everything I pack for a location-independent lifestyle, refined over 3 years on the road.',
    E'# Digital Nomad Essentials\n\nAfter 3 years of nomading, I''ve learned what actually matters. Here''s my packing list.\n\n## The Non-Negotiables\n\n### Tech\n- MacBook Air M2 (light, powerful, all-day battery)\n- iPhone with dual SIM capability\n- AirPods Pro (noise canceling for flights)\n- Universal power adapter (I use EPICKA)\n- Portable charger (20,000 mAh minimum)\n- Kindle Paperwhite\n\n### Work Accessories\n- Lightweight laptop stand (Roost)\n- Compact mouse (Logitech MX Anywhere)\n- Collapsible water bottle\n- Blue light glasses\n- Noise-canceling headphones for calls\n\n## Clothing Philosophy\n\n**The capsule wardrobe approach:**\n- 3-4 tops that mix and match\n- 2 bottoms (one jeans, one versatile)\n- 1 light jacket\n- Comfortable walking shoes\n- Flip flops\n\nEverything should:\n- Wash easily\n- Dry quickly\n- Not wrinkle\n- Match everything else\n\n## The Bag\n\n**Osprey Farpoint 40L** - My ride or die\n- Fits carry-on requirements\n- Laptop compartment\n- Comfortable for long walks\n- Locks together for security\n\n## What I Stopped Bringing\n\n- Books (Kindle is life)\n- Separate camera (iPhone is enough)\n- "Just in case" items\n- More than 7 days of clothes\n\n## Pro Tips\n\n1. Ship heavy items to your next destination\n2. Buy toiletries locally\n3. Backup everything to cloud\n4. Get travel insurance (World Nomads)\n\nLess stuff = more freedom.',
    'Lifestyle',
    '["digital-nomad", "packing", "travel", "minimalism", "remote-work"]'::jsonb,
    'published',
    NOW() - INTERVAL '18 days',
    'usr-blog-lucia',
    'team-blog-lucia',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '18 days'
  ),
  (
    'post-lucia-003',
    'Hidden Gems of Southeast Asia',
    'hidden-gems-southeast-asia',
    'Beyond Bali: Discovering the less-traveled corners of Southeast Asia.',
    E'# Hidden Gems of Southeast Asia\n\nEveryone goes to Bali. Here are the places I loved even more.\n\n## Vietnam: Phong Nha\n\n**Why it''s special:** World''s largest cave systems\n\n- Skip Ha Long Bay (too touristy)\n- Phong Nha is raw, beautiful, uncrowded\n- Stay at Easy Tiger hostel\n- Do the Paradise Cave tour\n\n**Best for:** Adventure seekers, nature lovers\n\n## Philippines: Siargao\n\n**Why it''s special:** The next Bali (but still unspoiled)\n\n- Perfect for beginners to learn surfing\n- Cloud 9 break for experienced surfers\n- Island hopping to empty beaches\n- Incredible food scene developing\n\n**Best for:** Surfers, chill vibes\n\n## Thailand: Pai\n\n**Why it''s special:** Hippie mountain town\n\n- Skip Chiang Mai''s crowds\n- 3-hour winding drive worth it\n- Hot springs, waterfalls, canyons\n- Best pad thai I''ve ever had\n\n**Best for:** Motorcyclists, nature\n\n## Malaysia: Penang\n\n**Why it''s special:** Food capital of Asia\n\n- Georgetown''s street art\n- Hawker food heaven\n- Mix of cultures\n- Great digital nomad infrastructure\n\n**Best for:** Foodies, culture lovers\n\n## Indonesia: Lombok\n\n**Why it''s special:** Bali 20 years ago\n\n- Same beauty, fraction of tourists\n- Gili Islands nearby\n- Mount Rinjani trekking\n- Authentic village experiences\n\n**Best for:** Beach lovers, trekkers\n\n## Getting Off the Beaten Path\n\n1. Talk to locals, not TripAdvisor\n2. Take buses, not flights\n3. Stay longer in fewer places\n4. Learn a few words in local language\n\nThe real magic is where the tourists aren''t.',
    'Travel',
    '["southeast-asia", "travel", "hidden-gems", "adventure", "digital-nomad"]'::jsonb,
    'published',
    NOW() - INTERVAL '10 days',
    'usr-blog-lucia',
    'team-blog-lucia',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
  ),
  (
    'post-lucia-004',
    'Work-Life Balance Tips',
    'work-life-balance-tips',
    'How to actually disconnect when your office is everywhere.',
    E'# Work-Life Balance Tips\n\nWhen your office is everywhere, balance gets tricky. Here''s what I''ve learned.\n\n## The Problem\n\nAs a digital nomad, there''s no physical separation between work and life.\n\nThe beach IS your office. The cafe IS your meeting room.\n\n## Setting Boundaries\n\n### Time Boundaries\n- Set fixed work hours (I do 9am-5pm local time)\n- No emails after dinner\n- Weekends are sacred\n\n### Space Boundaries\n- Never work from bed\n- Designate a "work spot" even in small spaces\n- Close the laptop when done\n\n[Draft - more tips coming]\n\n## The Hardest Part\n\nGiving yourself permission to not work.\n\nMore coming soon...',
    'Lifestyle',
    '["work-life-balance", "remote-work", "mental-health", "productivity", "digital-nomad"]'::jsonb,
    'draft',
    NULL,
    'usr-blog-lucia',
    'team-blog-lucia',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),

  -- ========================================
  -- CARLOS FINANCE - Business & Finance (4 posts)
  -- ========================================
  (
    'post-carlos-001',
    'Investing 101 for Beginners',
    'investing-101-for-beginners',
    'Everything you need to know to start investing today, explained in plain English.',
    E'# Investing 101 for Beginners\n\nInvesting seems complicated. It doesn''t have to be. Let''s break it down.\n\n## Why Invest?\n\nMoney in a savings account loses value to inflation every year.\n\n$10,000 today = ~$7,500 purchasing power in 10 years (at 3% inflation)\n\nInvesting is how you make your money work for you.\n\n## The Basics\n\n### Stocks\nOwning a tiny piece of a company.\n- Higher risk, higher potential reward\n- Apple, Google, thousands of companies\n\n### Bonds\nLending money to governments or companies.\n- Lower risk, lower returns\n- More stable than stocks\n\n### Index Funds\nA basket of many stocks in one purchase.\n- S&P 500 = 500 largest US companies\n- Instant diversification\n- My recommendation for beginners\n\n## Getting Started\n\n### Step 1: Emergency Fund First\n3-6 months expenses in savings BEFORE investing.\n\n### Step 2: Open a Brokerage Account\n- Fidelity, Vanguard, or Schwab\n- All have no minimums\n- All have index funds\n\n### Step 3: Start Small\n- $50/month is a great start\n- Automate it\n- Increase as you can\n\n## The Power of Time\n\n$200/month starting at 25 = ~$500,000 at 65\n$200/month starting at 35 = ~$230,000 at 65\n\nSame money. Different outcomes. Time matters.\n\n## Golden Rules\n\n1. Don''t invest money you need soon\n2. Don''t try to time the market\n3. Diversify (index funds do this automatically)\n4. Stay the course during downturns\n5. Keep fees low (under 0.2%)\n\n## My Simple Portfolio\n\n- 80% Total US Stock Market Index (VTI)\n- 20% Total International (VXUS)\n\nThat''s it. Boring wins.',
    'Finance',
    '["investing", "beginners", "personal-finance", "stocks", "index-funds"]'::jsonb,
    'published',
    NOW() - INTERVAL '28 days',
    'usr-blog-carlos',
    'team-blog-carlos',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '28 days'
  ),
  (
    'post-carlos-002',
    'Side Hustles That Actually Work',
    'side-hustles-that-actually-work',
    'Realistic ways to earn extra income without falling for get-rich-quick schemes.',
    E'# Side Hustles That Actually Work\n\nForget the "make $10k/month passive income" gurus. Here''s what actually works.\n\n## The Reality Check\n\nMost side hustles:\n- Take time to build\n- Require real work\n- Won''t make you rich overnight\n\nBut they CAN:\n- Add $500-2000/month\n- Build valuable skills\n- Potentially become full-time income\n\n## Tier 1: Skill-Based (Highest Pay)\n\n### Freelance Writing\n- Start: $50-100/article\n- Experienced: $200-500/article\n- Platform: Contently, LinkedIn\n\n### Web Development\n- Start: $500-1000/project\n- Experienced: $2000-5000/project\n- Platform: Upwork, word of mouth\n\n### Design\n- Start: $100-300/project\n- Experienced: $500-2000/project\n- Platform: 99designs, Fiverr Pro\n\n## Tier 2: Service-Based (Consistent)\n\n### Virtual Assistant\n- $15-25/hour\n- Admin, email, scheduling\n- Platforms: Belay, Time Etc\n\n### Tutoring\n- $20-50/hour\n- Online or local\n- Platform: Wyzant, Varsity Tutors\n\n### Consulting\n- Bill your expertise hourly\n- LinkedIn is your friend\n- Start with former colleagues\n\n## Tier 3: Digital Products (Scalable)\n\n### Online Courses\n- Create once, sell forever\n- Takes 3-6 months to build\n- Platforms: Teachable, Podia\n\n### Ebooks/Guides\n- Lower effort than courses\n- Price $10-50\n- Sell through Gumroad\n\n## What Doesn''t Work\n\n- MLM (it''s always MLM)\n- Survey sites (pennies/hour)\n- "Passive income" dropshipping\n- Crypto day trading\n\n## My Advice\n\n1. Start with skills you already have\n2. Dedicate consistent hours (5-10/week)\n3. Reinvest earnings\n4. Be patient (3-6 months to see results)',
    'Finance',
    '["side-hustle", "income", "freelance", "money", "career"]'::jsonb,
    'published',
    NOW() - INTERVAL '20 days',
    'usr-blog-carlos',
    'team-blog-carlos',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days'
  ),
  (
    'post-carlos-003',
    'Understanding Crypto Markets',
    'understanding-crypto-markets',
    'A balanced look at cryptocurrency: the technology, the hype, and the reality.',
    E'# Understanding Crypto Markets\n\nCrypto is either the future of money or a giant scam, depending on who you ask. Let''s look at it objectively.\n\n## What Is Cryptocurrency?\n\nDigital money that runs on blockchain technology.\n\n**Blockchain**: A shared database that no single entity controls.\n\n## The Big Players\n\n### Bitcoin (BTC)\n- The original\n- "Digital gold" narrative\n- Limited to 21 million coins ever\n- Most institutional acceptance\n\n### Ethereum (ETH)\n- Platform for apps and smart contracts\n- Powers DeFi and NFTs\n- More utility than Bitcoin\n- Higher risk/reward\n\n## The Bull Case\n\n1. Decentralization from governments/banks\n2. Inflation hedge (limited supply)\n3. Global, borderless transactions\n4. New financial infrastructure\n\n## The Bear Case\n\n1. Extreme volatility\n2. Regulatory uncertainty\n3. Environmental concerns (mining)\n4. Used for illegal activity\n5. Many projects are scams\n\n## My Honest Take\n\nCrypto is:\n- NOT a get-rich-quick scheme\n- NOT replacing the dollar soon\n- NOT completely without value\n\nIt IS:\n- Interesting technology\n- A speculative asset\n- High risk, high potential reward\n\n## If You''re Going to Invest\n\n1. Only money you can afford to lose (1-5% of portfolio max)\n2. Stick to BTC and ETH (everything else is gambling)\n3. Use real exchanges (Coinbase, Kraken)\n4. Never invest based on TikTok\n5. Plan to hold 5+ years\n\n## Red Flags\n\n- "Guaranteed returns"\n- Celebrity endorsements\n- New coins promising 1000x\n- "Send me crypto, I''ll send back double"\n\n## The Bottom Line\n\nEducate yourself. Be skeptical. Only invest what you understand.',
    'Finance',
    '["crypto", "bitcoin", "ethereum", "investing", "blockchain"]'::jsonb,
    'published',
    NOW() - INTERVAL '12 days',
    'usr-blog-carlos',
    'team-blog-carlos',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '12 days'
  ),
  (
    'post-carlos-004',
    'Building Passive Income',
    'building-passive-income',
    'Real passive income strategies that work, without the Instagram guru BS.',
    E'# Building Passive Income\n\nLet me be clear: TRUE passive income takes years to build. But it''s worth it.\n\n## What Passive Income Actually Means\n\n**Not**: Money for nothing\n**Actually**: Income that doesn''t require active work AFTER initial effort\n\n## The Math of Financial Freedom\n\nPassive income goal = Monthly expenses x 12 / 0.04\n\nExample: $5,000/month expenses\n$5,000 x 12 = $60,000/year\n$60,000 / 0.04 = $1,500,000 invested\n\nThat''s the 4% rule - withdraw 4% annually without depleting principal.\n\n## Realistic Passive Income Sources\n\n### Dividend Investing\n- Stocks that pay quarterly\n- 3-4% yield typically\n- Requires significant capital\n- Most "passive" option\n\n### Rental Property\n- Monthly cash flow\n- Requires management (not fully passive)\n- Tax advantages\n- Leverage possible\n\n[Draft - more strategies coming]\n\n## The Timeline\n\nYear 1-3: Build active income, save aggressively\nYear 3-5: Invest consistently, reinvest everything\nYear 5-10: Compound growth kicks in\nYear 10+: Passive income becomes meaningful\n\nMore coming soon...',
    'Finance',
    '["passive-income", "investing", "financial-freedom", "money", "wealth"]'::jsonb,
    'draft',
    NULL,
    'usr-blog-carlos',
    'team-blog-carlos',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 9: MARK FEATURED POSTS
-- ============================================

UPDATE "posts" SET "featured" = true WHERE id IN (
  'post-marcos-001',  -- The Future of AI in SaaS
  'post-marcos-003',  -- Why TypeScript Won
  'post-lucia-001',   -- Best Cafes for Remote Work in Lisbon
  'post-lucia-003',   -- Hidden Gems of Southeast Asia
  'post-carlos-001',  -- Investing 101 for Beginners
  'post-carlos-002'   -- Side Hustles That Actually Work
);

-- ============================================
-- STEP 10: CREATE INVOICES (6 per team = 18 total)
-- ============================================
-- Pro Plan subscription: $29/month
-- Status: 5 paid + 1 pending per team

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
  -- Marcos Tech Blog invoices
  ('inv-marcos-001', 'team-blog-marcos', 'INV-MARCOS-001', NOW() - INTERVAL '5 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-marcos-001.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-marcos-002', 'team-blog-marcos', 'INV-MARCOS-002', NOW() - INTERVAL '4 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-marcos-002.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-marcos-003', 'team-blog-marcos', 'INV-MARCOS-003', NOW() - INTERVAL '3 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-marcos-003.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-marcos-004', 'team-blog-marcos', 'INV-MARCOS-004', NOW() - INTERVAL '2 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-marcos-004.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-marcos-005', 'team-blog-marcos', 'INV-MARCOS-005', NOW() - INTERVAL '1 month', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-marcos-005.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-marcos-006', 'team-blog-marcos', 'INV-MARCOS-006', NOW(), 29.00, 'USD', 'pending', NULL, 'Pro Plan - Monthly subscription'),

  -- Lucia Lifestyle Blog invoices
  ('inv-lucia-001', 'team-blog-lucia', 'INV-LUCIA-001', NOW() - INTERVAL '5 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-lucia-001.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-lucia-002', 'team-blog-lucia', 'INV-LUCIA-002', NOW() - INTERVAL '4 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-lucia-002.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-lucia-003', 'team-blog-lucia', 'INV-LUCIA-003', NOW() - INTERVAL '3 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-lucia-003.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-lucia-004', 'team-blog-lucia', 'INV-LUCIA-004', NOW() - INTERVAL '2 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-lucia-004.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-lucia-005', 'team-blog-lucia', 'INV-LUCIA-005', NOW() - INTERVAL '1 month', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-lucia-005.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-lucia-006', 'team-blog-lucia', 'INV-LUCIA-006', NOW(), 29.00, 'USD', 'pending', NULL, 'Pro Plan - Monthly subscription'),

  -- Carlos Finance Blog invoices
  ('inv-carlos-001', 'team-blog-carlos', 'INV-CARLOS-001', NOW() - INTERVAL '5 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-carlos-001.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-carlos-002', 'team-blog-carlos', 'INV-CARLOS-002', NOW() - INTERVAL '4 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-carlos-002.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-carlos-003', 'team-blog-carlos', 'INV-CARLOS-003', NOW() - INTERVAL '3 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-carlos-003.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-carlos-004', 'team-blog-carlos', 'INV-CARLOS-004', NOW() - INTERVAL '2 months', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-carlos-004.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-carlos-005', 'team-blog-carlos', 'INV-CARLOS-005', NOW() - INTERVAL '1 month', 29.00, 'USD', 'paid', 'https://billing.example.com/invoices/inv-carlos-005.pdf', 'Pro Plan - Monthly subscription'),
  ('inv-carlos-006', 'team-blog-carlos', 'INV-CARLOS-006', NOW(), 29.00, 'USD', 'pending', NULL, 'Pro Plan - Monthly subscription')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 11: SUBSCRIPTIONS (B2C - with userId optimization)
-- ============================================
-- Note: Blog theme is single-user B2C - we use userId for optimization
-- Each author = 1 team = 1 subscription = 1 user

-- First, delete auto-created free subscriptions from the trigger
-- (the trigger creates a free subscription for each new team)
DELETE FROM public."subscriptions" WHERE "teamId" IN (
  'team-blog-marcos', 'team-blog-lucia', 'team-blog-carlos'
);

INSERT INTO public."subscriptions" (
  id, "teamId", "userId", "planId", status,
  "currentPeriodStart", "currentPeriodEnd", "billingInterval", "paymentProvider",
  "externalSubscriptionId", "externalCustomerId", "createdAt"
) VALUES
  -- Marcos Tech → Pro Plan $29/mo (active, monthly)
  ('sub-blog-marcos', 'team-blog-marcos', 'usr-blog-marcos', 'plan_pro', 'active',
   NOW() - INTERVAL '30 days', NOW() + INTERVAL '30 days', 'monthly', 'stripe',
   'sub_stripe_marcos', 'cus_marcos', NOW() - INTERVAL '6 months'),
  -- Lucia Lifestyle → Pro Plan $29/mo (active, monthly)
  ('sub-blog-lucia', 'team-blog-lucia', 'usr-blog-lucia', 'plan_pro', 'active',
   NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 'monthly', 'stripe',
   'sub_stripe_lucia', 'cus_lucia', NOW() - INTERVAL '5 months'),
  -- Carlos Finance → Pro Plan (trialing, monthly)
  ('sub-blog-carlos', 'team-blog-carlos', 'usr-blog-carlos', 'plan_pro', 'trialing',
   NOW(), NOW() + INTERVAL '14 days', 'monthly', NULL, NULL, NULL, NOW() - INTERVAL '4 months')
ON CONFLICT (id) DO NOTHING;

UPDATE public."subscriptions" SET "trialEndsAt" = NOW() + INTERVAL '14 days'
WHERE id = 'sub-blog-carlos';

-- ============================================
-- STEP 12: BILLING EVENTS
-- ============================================

INSERT INTO public."billing_events" (id, "subscriptionId", type, status, amount, currency, "createdAt")
VALUES
  -- Marcos pagos (6 meses @ $29)
  ('be-blog-marcos-001', 'sub-blog-marcos', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '6 months'),
  ('be-blog-marcos-002', 'sub-blog-marcos', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '5 months'),
  ('be-blog-marcos-003', 'sub-blog-marcos', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '4 months'),
  ('be-blog-marcos-004', 'sub-blog-marcos', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '3 months'),
  ('be-blog-marcos-005', 'sub-blog-marcos', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '2 months'),
  ('be-blog-marcos-006', 'sub-blog-marcos', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '1 month'),
  -- Lucia pagos (5 meses @ $29)
  ('be-blog-lucia-001', 'sub-blog-lucia', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '5 months'),
  ('be-blog-lucia-002', 'sub-blog-lucia', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '4 months'),
  ('be-blog-lucia-003', 'sub-blog-lucia', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '3 months'),
  ('be-blog-lucia-004', 'sub-blog-lucia', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '2 months'),
  ('be-blog-lucia-005', 'sub-blog-lucia', 'payment', 'succeeded', 2900, 'usd', NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 13: TEAM METADATA (B2C author attributes)
-- ============================================

UPDATE public."teams" SET metadata = '{"authorNiche": "technology", "postsPublished": 4, "featuredCount": 2}'::jsonb WHERE id = 'team-blog-marcos';
UPDATE public."teams" SET metadata = '{"authorNiche": "travel", "postsPublished": 3, "featuredCount": 2}'::jsonb WHERE id = 'team-blog-lucia';
UPDATE public."teams" SET metadata = '{"authorNiche": "finance", "postsPublished": 3, "featuredCount": 2}'::jsonb WHERE id = 'team-blog-carlos';

-- ============================================
-- STEP 14: 10 NEW BLOGGERS WITH DIVERSE SCENARIOS
-- ============================================
-- Mix of monthly/yearly, active/canceled/past_due
-- Password: Test1234 (same hash as above)

INSERT INTO "users" (
  id, email, name, "firstName", "lastName", username, bio,
  social_twitter, role, "emailVerified", language, country, timezone, "createdAt", "updatedAt"
) VALUES
  -- 1. Diana Design - Pro Monthly Active
  ('usr-blog-diana', 'blog_author_diana@nextspark.dev', 'Diana Design', 'Diana', 'Design',
   'diana_design', 'UX/UI designer creating beautiful digital experiences.',
   'https://twitter.com/dianadesign', 'member', true, 'en', 'US', 'America/New_York',
   NOW() - INTERVAL '8 months', NOW()),
  -- 2. Elena Eco - Pro Monthly Active
  ('usr-blog-elena', 'blog_author_elena@nextspark.dev', 'Elena Eco', 'Elena', 'Eco',
   'elena_eco', 'Sustainable living advocate. Small changes, big impact.',
   'https://twitter.com/elenaeco', 'member', true, 'en', 'DE', 'Europe/Berlin',
   NOW() - INTERVAL '7 months', NOW()),
  -- 3. Felix Fitness - Pro Yearly Active
  ('usr-blog-felix', 'blog_author_felix@nextspark.dev', 'Felix Fitness', 'Felix', 'Fitness',
   'felix_fitness', 'Personal trainer helping you achieve your fitness goals.',
   'https://twitter.com/felixfitness', 'member', true, 'en', 'AU', 'Australia/Sydney',
   NOW() - INTERVAL '14 months', NOW()),
  -- 4. Gloria Gourmet - Pro Yearly Active
  ('usr-blog-gloria', 'blog_author_gloria@nextspark.dev', 'Gloria Gourmet', 'Gloria', 'Gourmet',
   'gloria_gourmet', 'Food blogger exploring cuisines from around the world.',
   'https://twitter.com/gloriagourmet', 'member', true, 'es', 'MX', 'America/Mexico_City',
   NOW() - INTERVAL '12 months', NOW()),
  -- 5. Hugo Health - Pro Monthly Active
  ('usr-blog-hugo', 'blog_author_hugo@nextspark.dev', 'Hugo Health', 'Hugo', 'Health',
   'hugo_health', 'Medical doctor sharing health tips for everyday wellness.',
   'https://twitter.com/hugohealth', 'member', true, 'en', 'UK', 'Europe/London',
   NOW() - INTERVAL '6 months', NOW()),
  -- 6. Iris Inspire - Pro Monthly Past Due
  ('usr-blog-iris', 'blog_author_iris@nextspark.dev', 'Iris Inspire', 'Iris', 'Inspire',
   'iris_inspire', 'Motivation coach helping you unlock your potential.',
   'https://twitter.com/irisinspire', 'member', true, 'en', 'CA', 'America/Toronto',
   NOW() - INTERVAL '5 months', NOW()),
  -- 7. Jorge Journey - Pro Monthly Canceled (voluntary)
  ('usr-blog-jorge', 'blog_author_jorge@nextspark.dev', 'Jorge Journey', 'Jorge', 'Journey',
   'jorge_journey', 'Adventure seeker documenting epic journeys.',
   'https://twitter.com/jorgejourney', 'member', true, 'es', 'AR', 'America/Argentina/Buenos_Aires',
   NOW() - INTERVAL '9 months', NOW()),
  -- 8. Karen Kitchen - Pro Yearly Canceled (payment failed)
  ('usr-blog-karen', 'blog_author_karen@nextspark.dev', 'Karen Kitchen', 'Karen', 'Kitchen',
   'karen_kitchen', 'Home cook sharing family recipes and cooking tips.',
   'https://twitter.com/karenkitchen', 'member', true, 'en', 'US', 'America/Chicago',
   NOW() - INTERVAL '15 months', NOW()),
  -- 9. Leo Learn - Free Plan Active
  ('usr-blog-leo', 'blog_author_leo@nextspark.dev', 'Leo Learn', 'Leo', 'Learn',
   'leo_learn', 'Educator making learning fun and accessible.',
   'https://twitter.com/leolearn', 'member', true, 'en', 'IN', 'Asia/Kolkata',
   NOW() - INTERVAL '2 months', NOW()),
  -- 10. Maria Music - Pro Monthly Trialing
  ('usr-blog-maria', 'blog_author_maria@nextspark.dev', 'Maria Music', 'Maria', 'Music',
   'maria_music', 'Musician and producer exploring sounds and stories.',
   'https://twitter.com/mariamusic', 'member', true, 'es', 'ES', 'Europe/Madrid',
   NOW() - INTERVAL '5 days', NOW())
ON CONFLICT (email) DO NOTHING;

-- Teams for 10 new bloggers
INSERT INTO "teams" (id, name, slug, description, "ownerId", "createdAt", "updatedAt") VALUES
  ('team-blog-diana', 'Diana Design Blog', 'diana-design', 'UX/UI design insights', 'usr-blog-diana', NOW() - INTERVAL '8 months', NOW()),
  ('team-blog-elena', 'Elena Eco Blog', 'elena-eco', 'Sustainable living tips', 'usr-blog-elena', NOW() - INTERVAL '7 months', NOW()),
  ('team-blog-felix', 'Felix Fitness Blog', 'felix-fitness', 'Fitness and health content', 'usr-blog-felix', NOW() - INTERVAL '14 months', NOW()),
  ('team-blog-gloria', 'Gloria Gourmet Blog', 'gloria-gourmet', 'Food and recipes', 'usr-blog-gloria', NOW() - INTERVAL '12 months', NOW()),
  ('team-blog-hugo', 'Hugo Health Blog', 'hugo-health', 'Health and wellness', 'usr-blog-hugo', NOW() - INTERVAL '6 months', NOW()),
  ('team-blog-iris', 'Iris Inspire Blog', 'iris-inspire', 'Motivation and self-improvement', 'usr-blog-iris', NOW() - INTERVAL '5 months', NOW()),
  ('team-blog-jorge', 'Jorge Journey Blog', 'jorge-journey', 'Adventure travel stories', 'usr-blog-jorge', NOW() - INTERVAL '9 months', NOW()),
  ('team-blog-karen', 'Karen Kitchen Blog', 'karen-kitchen', 'Home cooking recipes', 'usr-blog-karen', NOW() - INTERVAL '15 months', NOW()),
  ('team-blog-leo', 'Leo Learn Blog', 'leo-learn', 'Educational content', 'usr-blog-leo', NOW() - INTERVAL '2 months', NOW()),
  ('team-blog-maria', 'Maria Music Blog', 'maria-music', 'Music and production', 'usr-blog-maria', NOW() - INTERVAL '5 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- Team memberships
INSERT INTO "team_members" (id, "teamId", "userId", role, "joinedAt") VALUES
  ('tm-blog-diana', 'team-blog-diana', 'usr-blog-diana', 'owner', NOW() - INTERVAL '8 months'),
  ('tm-blog-elena', 'team-blog-elena', 'usr-blog-elena', 'owner', NOW() - INTERVAL '7 months'),
  ('tm-blog-felix', 'team-blog-felix', 'usr-blog-felix', 'owner', NOW() - INTERVAL '14 months'),
  ('tm-blog-gloria', 'team-blog-gloria', 'usr-blog-gloria', 'owner', NOW() - INTERVAL '12 months'),
  ('tm-blog-hugo', 'team-blog-hugo', 'usr-blog-hugo', 'owner', NOW() - INTERVAL '6 months'),
  ('tm-blog-iris', 'team-blog-iris', 'usr-blog-iris', 'owner', NOW() - INTERVAL '5 months'),
  ('tm-blog-jorge', 'team-blog-jorge', 'usr-blog-jorge', 'owner', NOW() - INTERVAL '9 months'),
  ('tm-blog-karen', 'team-blog-karen', 'usr-blog-karen', 'owner', NOW() - INTERVAL '15 months'),
  ('tm-blog-leo', 'team-blog-leo', 'usr-blog-leo', 'owner', NOW() - INTERVAL '2 months'),
  ('tm-blog-maria', 'team-blog-maria', 'usr-blog-maria', 'owner', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- Accounts (Password: Test1234)
INSERT INTO "account" (id, "userId", "accountId", "providerId", "password", "createdAt", "updatedAt") VALUES
  ('acc-blog-diana', 'usr-blog-diana', 'blog_author_diana@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '8 months', NOW()),
  ('acc-blog-elena', 'usr-blog-elena', 'blog_author_elena@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '7 months', NOW()),
  ('acc-blog-felix', 'usr-blog-felix', 'blog_author_felix@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '14 months', NOW()),
  ('acc-blog-gloria', 'usr-blog-gloria', 'blog_author_gloria@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '12 months', NOW()),
  ('acc-blog-hugo', 'usr-blog-hugo', 'blog_author_hugo@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '6 months', NOW()),
  ('acc-blog-iris', 'usr-blog-iris', 'blog_author_iris@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '5 months', NOW()),
  ('acc-blog-jorge', 'usr-blog-jorge', 'blog_author_jorge@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '9 months', NOW()),
  ('acc-blog-karen', 'usr-blog-karen', 'blog_author_karen@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '15 months', NOW()),
  ('acc-blog-leo', 'usr-blog-leo', 'blog_author_leo@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '2 months', NOW()),
  ('acc-blog-maria', 'usr-blog-maria', 'blog_author_maria@nextspark.dev', 'credential', '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866', NOW() - INTERVAL '5 days', NOW())
ON CONFLICT ("providerId", "accountId") DO NOTHING;

-- Users meta
INSERT INTO "users_metas" ("userId", "metaKey", "metaValue", "dataType", "isPublic", "isSearchable", "createdAt", "updatedAt") VALUES
  ('usr-blog-diana', 'activeTeamId', '"team-blog-diana"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-elena', 'activeTeamId', '"team-blog-elena"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-felix', 'activeTeamId', '"team-blog-felix"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-gloria', 'activeTeamId', '"team-blog-gloria"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-hugo', 'activeTeamId', '"team-blog-hugo"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-iris', 'activeTeamId', '"team-blog-iris"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-jorge', 'activeTeamId', '"team-blog-jorge"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-karen', 'activeTeamId', '"team-blog-karen"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-leo', 'activeTeamId', '"team-blog-leo"', 'json', false, false, NOW(), NOW()),
  ('usr-blog-maria', 'activeTeamId', '"team-blog-maria"', 'json', false, false, NOW(), NOW())
ON CONFLICT ("userId", "metaKey") DO NOTHING;

-- ============================================
-- STEP 15: SUBSCRIPTIONS FOR 10 NEW BLOGGERS
-- ============================================
-- Diverse scenarios: active/canceled/past_due, monthly/yearly

-- Delete auto-created free subscriptions from the trigger
DELETE FROM public."subscriptions" WHERE "teamId" IN (
  'team-blog-diana', 'team-blog-elena', 'team-blog-felix', 'team-blog-gloria',
  'team-blog-hugo', 'team-blog-iris', 'team-blog-jorge', 'team-blog-karen',
  'team-blog-leo', 'team-blog-maria'
);

INSERT INTO public."subscriptions" (
  id, "teamId", "userId", "planId", status,
  "currentPeriodStart", "currentPeriodEnd", "billingInterval",
  "paymentProvider", "externalSubscriptionId", "externalCustomerId",
  "createdAt", "canceledAt", "cancelAtPeriodEnd", metadata
) VALUES
  -- 1. Diana Design - Pro Monthly ACTIVE (8 months customer)
  ('sub-blog-diana', 'team-blog-diana', 'usr-blog-diana', 'plan_pro', 'active',
   NOW() - INTERVAL '25 days', NOW() + INTERVAL '5 days', 'monthly',
   'stripe', 'sub_stripe_diana', 'cus_diana',
   NOW() - INTERVAL '8 months', NULL, false, '{}'::jsonb),

  -- 2. Elena Eco - Pro Monthly ACTIVE (7 months customer)
  ('sub-blog-elena', 'team-blog-elena', 'usr-blog-elena', 'plan_pro', 'active',
   NOW() - INTERVAL '20 days', NOW() + INTERVAL '10 days', 'monthly',
   'stripe', 'sub_stripe_elena', 'cus_elena',
   NOW() - INTERVAL '7 months', NULL, false, '{}'::jsonb),

  -- 3. Felix Fitness - Pro Yearly ACTIVE (14 months = 2nd year)
  ('sub-blog-felix', 'team-blog-felix', 'usr-blog-felix', 'plan_pro', 'active',
   NOW() - INTERVAL '60 days', NOW() + INTERVAL '305 days', 'yearly',
   'stripe', 'sub_stripe_felix', 'cus_felix',
   NOW() - INTERVAL '14 months', NULL, false, '{}'::jsonb),

  -- 4. Gloria Gourmet - Pro Yearly ACTIVE (12 months)
  ('sub-blog-gloria', 'team-blog-gloria', 'usr-blog-gloria', 'plan_pro', 'active',
   NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', 'yearly',
   'stripe', 'sub_stripe_gloria', 'cus_gloria',
   NOW() - INTERVAL '12 months', NULL, false, '{}'::jsonb),

  -- 5. Hugo Health - Pro Monthly ACTIVE (6 months customer)
  ('sub-blog-hugo', 'team-blog-hugo', 'usr-blog-hugo', 'plan_pro', 'active',
   NOW() - INTERVAL '18 days', NOW() + INTERVAL '12 days', 'monthly',
   'stripe', 'sub_stripe_hugo', 'cus_hugo',
   NOW() - INTERVAL '6 months', NULL, false, '{}'::jsonb),

  -- 6. Iris Inspire - Pro Monthly PAST_DUE (failed payment)
  ('sub-blog-iris', 'team-blog-iris', 'usr-blog-iris', 'plan_pro', 'past_due',
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '5 days', 'monthly',
   'stripe', 'sub_stripe_iris', 'cus_iris',
   NOW() - INTERVAL '5 months', NULL, false,
   '{"lastPaymentAttempt": "failed", "retryCount": 2}'::jsonb),

  -- 7. Jorge Journey - Pro Monthly CANCELED (voluntary - user decided to cancel)
  ('sub-blog-jorge', 'team-blog-jorge', 'usr-blog-jorge', 'plan_pro', 'canceled',
   NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days', 'monthly',
   'stripe', 'sub_stripe_jorge', 'cus_jorge',
   NOW() - INTERVAL '9 months', NOW() - INTERVAL '15 days', false,
   '{"cancelReason": "voluntary", "canceledBy": "user", "feedback": "taking a break"}'::jsonb),

  -- 8. Karen Kitchen - Pro Yearly CANCELED (payment failed 4 times)
  ('sub-blog-karen', 'team-blog-karen', 'usr-blog-karen', 'plan_pro', 'canceled',
   NOW() - INTERVAL '400 days', NOW() - INTERVAL '35 days', 'yearly',
   'stripe', 'sub_stripe_karen', 'cus_karen',
   NOW() - INTERVAL '15 months', NOW() - INTERVAL '35 days', false,
   '{"cancelReason": "payment_failed", "failedAttempts": 4, "lastCardEnding": "4242"}'::jsonb),

  -- 9. Leo Learn - Free Plan ACTIVE (no billing)
  ('sub-blog-leo', 'team-blog-leo', 'usr-blog-leo', 'plan_free', 'active',
   NOW() - INTERVAL '2 months', NOW() + INTERVAL '100 years', 'monthly',
   NULL, NULL, NULL,
   NOW() - INTERVAL '2 months', NULL, false, '{}'::jsonb),

  -- 10. Maria Music - Pro Monthly TRIALING (5 days in)
  ('sub-blog-maria', 'team-blog-maria', 'usr-blog-maria', 'plan_pro', 'trialing',
   NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 'monthly',
   NULL, NULL, NULL,
   NOW() - INTERVAL '5 days', NULL, false, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Set trial end date for Maria
UPDATE public."subscriptions" SET "trialEndsAt" = NOW() + INTERVAL '9 days'
WHERE id = 'sub-blog-maria';

-- ============================================
-- STEP 16: BILLING EVENTS FOR 10 NEW BLOGGERS
-- ============================================
-- Coherent payment history matching subscription scenarios

INSERT INTO public."billing_events" (
  id, "subscriptionId", type, status, amount, currency, "externalPaymentId", "createdAt"
) VALUES
  -- ========================================
  -- DIANA DESIGN - 8 months @ $29/mo = 8 payments
  -- ========================================
  ('be-diana-m1', 'sub-blog-diana', 'payment', 'succeeded', 2900, 'usd', 'pi_diana_m1', NOW() - INTERVAL '8 months'),
  ('be-diana-m2', 'sub-blog-diana', 'payment', 'succeeded', 2900, 'usd', 'pi_diana_m2', NOW() - INTERVAL '7 months'),
  ('be-diana-m3', 'sub-blog-diana', 'payment', 'succeeded', 2900, 'usd', 'pi_diana_m3', NOW() - INTERVAL '6 months'),
  ('be-diana-m4', 'sub-blog-diana', 'payment', 'succeeded', 2900, 'usd', 'pi_diana_m4', NOW() - INTERVAL '5 months'),
  ('be-diana-m5', 'sub-blog-diana', 'payment', 'succeeded', 2900, 'usd', 'pi_diana_m5', NOW() - INTERVAL '4 months'),
  ('be-diana-m6', 'sub-blog-diana', 'payment', 'succeeded', 2900, 'usd', 'pi_diana_m6', NOW() - INTERVAL '3 months'),
  ('be-diana-m7', 'sub-blog-diana', 'payment', 'succeeded', 2900, 'usd', 'pi_diana_m7', NOW() - INTERVAL '2 months'),
  ('be-diana-m8', 'sub-blog-diana', 'payment', 'succeeded', 2900, 'usd', 'pi_diana_m8', NOW() - INTERVAL '1 month'),

  -- ========================================
  -- ELENA ECO - 7 months @ $29/mo = 7 payments
  -- ========================================
  ('be-elena-m1', 'sub-blog-elena', 'payment', 'succeeded', 2900, 'usd', 'pi_elena_m1', NOW() - INTERVAL '7 months'),
  ('be-elena-m2', 'sub-blog-elena', 'payment', 'succeeded', 2900, 'usd', 'pi_elena_m2', NOW() - INTERVAL '6 months'),
  ('be-elena-m3', 'sub-blog-elena', 'payment', 'succeeded', 2900, 'usd', 'pi_elena_m3', NOW() - INTERVAL '5 months'),
  ('be-elena-m4', 'sub-blog-elena', 'payment', 'succeeded', 2900, 'usd', 'pi_elena_m4', NOW() - INTERVAL '4 months'),
  ('be-elena-m5', 'sub-blog-elena', 'payment', 'succeeded', 2900, 'usd', 'pi_elena_m5', NOW() - INTERVAL '3 months'),
  ('be-elena-m6', 'sub-blog-elena', 'payment', 'succeeded', 2900, 'usd', 'pi_elena_m6', NOW() - INTERVAL '2 months'),
  ('be-elena-m7', 'sub-blog-elena', 'payment', 'succeeded', 2900, 'usd', 'pi_elena_m7', NOW() - INTERVAL '1 month'),

  -- ========================================
  -- FELIX FITNESS - 2 yearly payments @ $290/yr
  -- ========================================
  ('be-felix-y1', 'sub-blog-felix', 'payment', 'succeeded', 29000, 'usd', 'pi_felix_y1', NOW() - INTERVAL '14 months'),
  ('be-felix-y2', 'sub-blog-felix', 'payment', 'succeeded', 29000, 'usd', 'pi_felix_y2', NOW() - INTERVAL '2 months'),

  -- ========================================
  -- GLORIA GOURMET - 1 yearly payment @ $290/yr
  -- ========================================
  ('be-gloria-y1', 'sub-blog-gloria', 'payment', 'succeeded', 29000, 'usd', 'pi_gloria_y1', NOW() - INTERVAL '1 month'),

  -- ========================================
  -- HUGO HEALTH - 6 months @ $29/mo = 6 payments
  -- ========================================
  ('be-hugo-m1', 'sub-blog-hugo', 'payment', 'succeeded', 2900, 'usd', 'pi_hugo_m1', NOW() - INTERVAL '6 months'),
  ('be-hugo-m2', 'sub-blog-hugo', 'payment', 'succeeded', 2900, 'usd', 'pi_hugo_m2', NOW() - INTERVAL '5 months'),
  ('be-hugo-m3', 'sub-blog-hugo', 'payment', 'succeeded', 2900, 'usd', 'pi_hugo_m3', NOW() - INTERVAL '4 months'),
  ('be-hugo-m4', 'sub-blog-hugo', 'payment', 'succeeded', 2900, 'usd', 'pi_hugo_m4', NOW() - INTERVAL '3 months'),
  ('be-hugo-m5', 'sub-blog-hugo', 'payment', 'succeeded', 2900, 'usd', 'pi_hugo_m5', NOW() - INTERVAL '2 months'),
  ('be-hugo-m6', 'sub-blog-hugo', 'payment', 'succeeded', 2900, 'usd', 'pi_hugo_m6', NOW() - INTERVAL '1 month'),

  -- ========================================
  -- IRIS INSPIRE - 4 successful + 2 failed (PAST_DUE scenario)
  -- ========================================
  ('be-iris-m1', 'sub-blog-iris', 'payment', 'succeeded', 2900, 'usd', 'pi_iris_m1', NOW() - INTERVAL '5 months'),
  ('be-iris-m2', 'sub-blog-iris', 'payment', 'succeeded', 2900, 'usd', 'pi_iris_m2', NOW() - INTERVAL '4 months'),
  ('be-iris-m3', 'sub-blog-iris', 'payment', 'succeeded', 2900, 'usd', 'pi_iris_m3', NOW() - INTERVAL '3 months'),
  ('be-iris-m4', 'sub-blog-iris', 'payment', 'succeeded', 2900, 'usd', 'pi_iris_m4', NOW() - INTERVAL '2 months'),
  -- Failed payment - 1st attempt
  ('be-iris-fail1', 'sub-blog-iris', 'payment', 'failed', 2900, 'usd', 'pi_iris_fail1', NOW() - INTERVAL '32 days'),
  -- Failed payment - 2nd attempt (retry)
  ('be-iris-fail2', 'sub-blog-iris', 'payment', 'failed', 2900, 'usd', 'pi_iris_fail2', NOW() - INTERVAL '25 days'),

  -- ========================================
  -- JORGE JOURNEY - 8 successful then VOLUNTARY CANCEL
  -- ========================================
  ('be-jorge-m1', 'sub-blog-jorge', 'payment', 'succeeded', 2900, 'usd', 'pi_jorge_m1', NOW() - INTERVAL '9 months'),
  ('be-jorge-m2', 'sub-blog-jorge', 'payment', 'succeeded', 2900, 'usd', 'pi_jorge_m2', NOW() - INTERVAL '8 months'),
  ('be-jorge-m3', 'sub-blog-jorge', 'payment', 'succeeded', 2900, 'usd', 'pi_jorge_m3', NOW() - INTERVAL '7 months'),
  ('be-jorge-m4', 'sub-blog-jorge', 'payment', 'succeeded', 2900, 'usd', 'pi_jorge_m4', NOW() - INTERVAL '6 months'),
  ('be-jorge-m5', 'sub-blog-jorge', 'payment', 'succeeded', 2900, 'usd', 'pi_jorge_m5', NOW() - INTERVAL '5 months'),
  ('be-jorge-m6', 'sub-blog-jorge', 'payment', 'succeeded', 2900, 'usd', 'pi_jorge_m6', NOW() - INTERVAL '4 months'),
  ('be-jorge-m7', 'sub-blog-jorge', 'payment', 'succeeded', 2900, 'usd', 'pi_jorge_m7', NOW() - INTERVAL '3 months'),
  ('be-jorge-m8', 'sub-blog-jorge', 'payment', 'succeeded', 2900, 'usd', 'pi_jorge_m8', NOW() - INTERVAL '2 months'),
  -- Final invoice before cancellation
  ('be-jorge-last', 'sub-blog-jorge', 'invoice', 'succeeded', 2900, 'usd', 'in_jorge_last', NOW() - INTERVAL '45 days'),

  -- ========================================
  -- KAREN KITCHEN - 1 yearly success + 4 failed attempts = CANCELED
  -- ========================================
  ('be-karen-y1', 'sub-blog-karen', 'payment', 'succeeded', 29000, 'usd', 'pi_karen_y1', NOW() - INTERVAL '15 months'),
  -- Renewal failed - attempt 1
  ('be-karen-fail1', 'sub-blog-karen', 'payment', 'failed', 29000, 'usd', 'pi_karen_fail1', NOW() - INTERVAL '3 months'),
  -- Renewal failed - attempt 2
  ('be-karen-fail2', 'sub-blog-karen', 'payment', 'failed', 29000, 'usd', 'pi_karen_fail2', NOW() - INTERVAL '75 days'),
  -- Renewal failed - attempt 3
  ('be-karen-fail3', 'sub-blog-karen', 'payment', 'failed', 29000, 'usd', 'pi_karen_fail3', NOW() - INTERVAL '55 days'),
  -- Renewal failed - attempt 4 (final, then canceled)
  ('be-karen-fail4', 'sub-blog-karen', 'payment', 'failed', 29000, 'usd', 'pi_karen_fail4', NOW() - INTERVAL '40 days')

  -- LEO LEARN: Free plan - no billing events
  -- MARIA MUSIC: Trialing - no billing events yet
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 17: TEAM METADATA FOR NEW BLOGGERS
-- ============================================

UPDATE public."teams" SET metadata = '{"authorNiche": "design", "segment": "creator"}'::jsonb WHERE id = 'team-blog-diana';
UPDATE public."teams" SET metadata = '{"authorNiche": "sustainability", "segment": "creator"}'::jsonb WHERE id = 'team-blog-elena';
UPDATE public."teams" SET metadata = '{"authorNiche": "fitness", "segment": "creator", "billingCycle": "annual"}'::jsonb WHERE id = 'team-blog-felix';
UPDATE public."teams" SET metadata = '{"authorNiche": "food", "segment": "creator", "billingCycle": "annual"}'::jsonb WHERE id = 'team-blog-gloria';
UPDATE public."teams" SET metadata = '{"authorNiche": "health", "segment": "creator"}'::jsonb WHERE id = 'team-blog-hugo';
UPDATE public."teams" SET metadata = '{"authorNiche": "motivation", "segment": "creator", "atRisk": true}'::jsonb WHERE id = 'team-blog-iris';
UPDATE public."teams" SET metadata = '{"authorNiche": "adventure", "segment": "creator", "churned": true}'::jsonb WHERE id = 'team-blog-jorge';
UPDATE public."teams" SET metadata = '{"authorNiche": "cooking", "segment": "creator", "churned": true}'::jsonb WHERE id = 'team-blog-karen';
UPDATE public."teams" SET metadata = '{"authorNiche": "education", "segment": "free"}'::jsonb WHERE id = 'team-blog-leo';
UPDATE public."teams" SET metadata = '{"authorNiche": "music", "segment": "trialing"}'::jsonb WHERE id = 'team-blog-maria';

-- ============================================
-- SUCCESS SUMMARY
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '  Blog Theme Sample Data - Multi-Author Platform (Medium-style)';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '  ORIGINAL AUTHORS (3):';
  RAISE NOTICE '  ------------------------------------------------------------';
  RAISE NOTICE '  1. blog_author_marcos@nextspark.dev / Test1234 - Pro Monthly Active';
  RAISE NOTICE '  2. blog_author_lucia@nextspark.dev / Test1234 - Pro Monthly Active';
  RAISE NOTICE '  3. blog_author_carlos@nextspark.dev / Test1234 - Pro Monthly Trialing';
  RAISE NOTICE '';
  RAISE NOTICE '  NEW AUTHORS (10):';
  RAISE NOTICE '  ------------------------------------------------------------';
  RAISE NOTICE '  4. blog_author_diana@nextspark.dev / Test1234 - Pro Monthly Active';
  RAISE NOTICE '  5. blog_author_elena@nextspark.dev / Test1234 - Pro Monthly Active';
  RAISE NOTICE '  6. blog_author_felix@nextspark.dev / Test1234 - Pro Yearly Active';
  RAISE NOTICE '  7. blog_author_gloria@nextspark.dev / Test1234 - Pro Yearly Active';
  RAISE NOTICE '  8. blog_author_hugo@nextspark.dev / Test1234 - Pro Monthly Active';
  RAISE NOTICE '  9. blog_author_iris@nextspark.dev / Test1234 - Pro Monthly PAST_DUE';
  RAISE NOTICE '  10. blog_author_jorge@nextspark.dev / Test1234 - Pro CANCELED (voluntary)';
  RAISE NOTICE '  11. blog_author_karen@nextspark.dev / Test1234 - Pro CANCELED (payment failed)';
  RAISE NOTICE '  12. blog_author_leo@nextspark.dev / Test1234 - Free Plan Active';
  RAISE NOTICE '  13. blog_author_maria@nextspark.dev / Test1234 - Pro Monthly Trialing';
  RAISE NOTICE '';
  RAISE NOTICE '  SUBSCRIPTION SUMMARY:';
  RAISE NOTICE '  ------------------------------------------------------------';
  RAISE NOTICE '  - Monthly Active: 6 (Marcos, Lucia, Diana, Elena, Hugo)';
  RAISE NOTICE '  - Yearly Active: 2 (Felix, Gloria)';
  RAISE NOTICE '  - Trialing: 2 (Carlos, Maria)';
  RAISE NOTICE '  - Past Due: 1 (Iris)';
  RAISE NOTICE '  - Canceled Voluntary: 1 (Jorge)';
  RAISE NOTICE '  - Canceled Payment Failed: 1 (Karen)';
  RAISE NOTICE '  - Free Plan: 1 (Leo)';
  RAISE NOTICE '';
  RAISE NOTICE '  BILLING (Pro Plan = $29/mo, $290/yr):';
  RAISE NOTICE '  ------------------------------------------------------------';
  RAISE NOTICE '  - MRR (monthly active): ~$203 (7 x $29)';
  RAISE NOTICE '  - ARR (yearly active): $580 (2 x $290)';
  RAISE NOTICE '  - At-risk revenue: $29 (Iris past_due)';
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
END $$;
