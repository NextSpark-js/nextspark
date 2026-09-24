-- ============================================================================
-- Blog Demo Sample Data
-- Creates 3 authors with their teams, posts, and categories
-- ============================================================================

-- Note: This migration creates users with a default password "Test123!"
-- In production, users should sign up normally through the auth flow

DO $$
DECLARE
  v_marcos_user_id TEXT;
  v_marcos_team_id TEXT;
  v_lucia_user_id TEXT;
  v_lucia_team_id TEXT;
  v_carlos_user_id TEXT;
  v_carlos_team_id TEXT;
  v_cat_ai TEXT;
  v_cat_saas TEXT;
  v_cat_startups TEXT;
  v_cat_travel TEXT;
  v_cat_remote TEXT;
  v_cat_lifestyle TEXT;
  v_cat_investing TEXT;
  v_cat_finance TEXT;
  v_cat_entrepreneurship TEXT;
  v_post_id TEXT;
BEGIN
  -- =====================================================
  -- AUTHOR 1: Marcos Tech (Technology & Startups)
  -- =====================================================

  -- Create user
  INSERT INTO "users" (id, email, "emailVerified", name, "firstName", "lastName",
                       username, bio, "social_twitter", "social_linkedin", "role", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'blog_author_marcos@nextspark.dev',
    true,
    'Marcos Tech',
    'Marcos',
    'Tech',
    'marcos',
    'Tech entrepreneur and startup advisor. Writing about AI, SaaS, and building products that scale.',
    'https://twitter.com/marcostech',
    'https://linkedin.com/in/marcostech',
    'member',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET username = 'marcos'
  RETURNING id INTO v_marcos_user_id;

  -- Create team for Marcos
  INSERT INTO "teams" (id, name, slug, "ownerId", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'Marcos Tech Blog',
    'marcos-tech-blog',
    v_marcos_user_id,
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_marcos_team_id;

  -- Handle case where team already exists
  IF v_marcos_team_id IS NULL THEN
    SELECT id INTO v_marcos_team_id FROM "teams" WHERE slug = 'marcos-tech-blog';
  END IF;

  -- Add Marcos as owner of his team
  INSERT INTO "team_members" ("teamId", "userId", "role", "createdAt", "updatedAt")
  VALUES (v_marcos_team_id, v_marcos_user_id, 'owner', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- Create Marcos's categories
  INSERT INTO "categories" (id, "teamId", "userId", name, slug, "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid()::text, v_marcos_team_id, v_marcos_user_id, 'AI', 'ai', NOW(), NOW()),
    (gen_random_uuid()::text, v_marcos_team_id, v_marcos_user_id, 'SaaS', 'saas', NOW(), NOW()),
    (gen_random_uuid()::text, v_marcos_team_id, v_marcos_user_id, 'Startups', 'startups', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_cat_ai FROM "categories" WHERE "teamId" = v_marcos_team_id AND slug = 'ai' LIMIT 1;
  SELECT id INTO v_cat_saas FROM "categories" WHERE "teamId" = v_marcos_team_id AND slug = 'saas' LIMIT 1;
  SELECT id INTO v_cat_startups FROM "categories" WHERE "teamId" = v_marcos_team_id AND slug = 'startups' LIMIT 1;

  -- Marcos's Posts (5 total: 4 published, 1 draft)
  -- Post 1: The Future of AI in SaaS (published, featured)
  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_marcos_team_id, v_marcos_user_id,
    'The Future of AI in SaaS',
    'future-of-ai-in-saas',
    'How artificial intelligence is transforming the SaaS landscape and what it means for founders building the next generation of products.',
    '<p>The software-as-a-service industry is undergoing a fundamental transformation driven by artificial intelligence. What started as simple automation is now evolving into intelligent systems that can predict, adapt, and optimize in ways we couldn''t imagine just a few years ago.</p><h2>The AI Revolution</h2><p>From customer support chatbots to predictive analytics, AI is reshaping every aspect of how we build and deliver software. Companies that embrace this shift early will have a significant competitive advantage.</p><h2>Key Trends to Watch</h2><p>1. <strong>Autonomous Customer Success:</strong> AI-powered systems that predict churn before it happens and automatically take action to retain customers.</p><p>2. <strong>Intelligent Product Development:</strong> Using machine learning to analyze user behavior and automatically suggest or even implement feature improvements.</p><p>3. <strong>Hyper-Personalization:</strong> Moving beyond simple segmentation to truly individualized user experiences powered by AI.</p><h2>What This Means for Founders</h2><p>The bar for SaaS products is rising. Users now expect intelligent features as standard. The question isn''t whether to integrate AI, but how quickly you can do it effectively.</p>',
    'published', NOW() - INTERVAL '5 days', true, NOW() - INTERVAL '5 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_ai IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_ai) ON CONFLICT DO NOTHING;
  END IF;
  IF v_post_id IS NOT NULL AND v_cat_saas IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_saas) ON CONFLICT DO NOTHING;
  END IF;

  -- Post 2: Building MVPs Fast (published)
  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_marcos_team_id, v_marcos_user_id,
    'Building MVPs Fast: A Practical Guide',
    'building-mvps-fast',
    'Learn the proven strategies for getting your minimum viable product to market in weeks, not months.',
    '<p>Speed is everything in the startup world. The faster you can validate your idea with real users, the faster you can iterate and find product-market fit. But how do you build fast without sacrificing quality?</p><h2>The 4-Week MVP Framework</h2><p><strong>Week 1: Define your core value proposition.</strong> What is the ONE thing your product does that makes it valuable? Everything else is a distraction.</p><p><strong>Week 2: Build the absolute minimum.</strong> Focus only on the features that deliver your core value. Nothing else matters for your MVP.</p><p><strong>Week 3: Test with real users.</strong> Get your MVP in front of at least 10 potential customers. Watch how they use it.</p><p><strong>Week 4: Iterate based on feedback.</strong> Make improvements based on actual user behavior, not assumptions.</p><h2>Tools That Help</h2><p>Use no-code tools where possible. Leverage existing APIs. Don''t build what you can buy or integrate. Your goal is to test your unique value proposition, not to reinvent the wheel.</p>',
    'published', NOW() - INTERVAL '10 days', false, NOW() - INTERVAL '10 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_startups IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_startups) ON CONFLICT DO NOTHING;
  END IF;

  -- Post 3: Why TypeScript Won (published)
  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_marcos_team_id, v_marcos_user_id,
    'Why TypeScript Won the JavaScript Wars',
    'why-typescript-won',
    'A deep dive into how TypeScript became the de facto standard for serious JavaScript development.',
    '<p>Five years ago, the debate between TypeScript and JavaScript was heated. Today, it''s essentially over. TypeScript won. But why?</p><h2>Type Safety Matters</h2><p>The main argument for TypeScript has always been type safety. In large codebases, the ability to catch errors at compile time rather than runtime is invaluable. It''s not just about preventing bugs - it''s about developer confidence and velocity.</p><h2>The Developer Experience</h2><p>Modern IDEs with TypeScript provide autocomplete, inline documentation, and refactoring tools that simply aren''t possible with plain JavaScript. This makes developers significantly more productive.</p><h2>The Ecosystem Effect</h2><p>Once major libraries like React, Next.js, and Node.js embraced TypeScript, the network effects kicked in. Now, almost every new JavaScript library ships with TypeScript definitions out of the box.</p><h2>For New Projects</h2><p>If you''re starting a new project today, using TypeScript is a no-brainer. The setup is trivial, the benefits are immediate, and the ecosystem support is comprehensive.</p>',
    'published', NOW() - INTERVAL '15 days', false, NOW() - INTERVAL '15 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_saas IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_saas) ON CONFLICT DO NOTHING;
  END IF;

  -- Post 4: Startup Metrics That Matter (published)
  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_marcos_team_id, v_marcos_user_id,
    'Startup Metrics That Actually Matter',
    'startup-metrics-that-matter',
    'Forget vanity metrics. These are the numbers that will determine if your startup succeeds or fails.',
    '<p>Every startup founder obsesses over metrics. Page views, signups, social media followers - these numbers feel good to watch go up. But they''re often meaningless.</p><h2>The Only 5 Metrics You Need</h2><p><strong>1. Monthly Recurring Revenue (MRR):</strong> The lifeblood of any SaaS business. Everything else is a proxy for this.</p><p><strong>2. Customer Acquisition Cost (CAC):</strong> How much you spend to acquire one customer. If this is higher than...</p><p><strong>3. Lifetime Value (LTV):</strong> How much revenue you get from a customer over their lifetime. The LTV:CAC ratio should be at least 3:1.</p><p><strong>4. Churn Rate:</strong> What percentage of customers leave each month. For SaaS, anything above 5% monthly churn is a red flag.</p><p><strong>5. Gross Margin:</strong> Revenue minus cost of goods sold. For SaaS, this should be 80%+ or you have a scaling problem.</p><h2>Focus on What Matters</h2><p>Track these five metrics religiously. Everything else is just noise.</p>',
    'published', NOW() - INTERVAL '20 days', false, NOW() - INTERVAL '20 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_startups IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_startups) ON CONFLICT DO NOTHING;
  END IF;

  -- Post 5: Remote Team Culture (draft)
  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_marcos_team_id, v_marcos_user_id,
    'Building Remote Team Culture',
    'remote-team-culture',
    'Lessons learned from running a fully distributed startup for three years.',
    '<p>Draft in progress... This will cover asynchronous communication, building trust remotely, and maintaining culture without an office.</p>',
    'draft', NULL, false, NOW() - INTERVAL '2 days', NOW()
  )
  ON CONFLICT DO NOTHING;

  -- =====================================================
  -- AUTHOR 2: Lucia Lifestyle (Travel & Lifestyle)
  -- =====================================================

  INSERT INTO "users" (id, email, "emailVerified", name, "firstName", "lastName",
                       username, bio, "social_twitter", "social_linkedin", "social_website", "role", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'blog_author_lucia@nextspark.dev',
    true,
    'Lucia Lifestyle',
    'Lucia',
    'Lifestyle',
    'lucia',
    'Digital nomad exploring the world while working remotely. Coffee addict and sunset chaser.',
    'https://twitter.com/lucialifestyle',
    'https://linkedin.com/in/lucialifestyle',
    'https://lucialifestyle.com',
    'member',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET username = 'lucia'
  RETURNING id INTO v_lucia_user_id;

  INSERT INTO "teams" (id, name, slug, "ownerId", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'Lucia Lifestyle Blog',
    'lucia-lifestyle-blog',
    v_lucia_user_id,
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_lucia_team_id;

  IF v_lucia_team_id IS NULL THEN
    SELECT id INTO v_lucia_team_id FROM "teams" WHERE slug = 'lucia-lifestyle-blog';
  END IF;

  INSERT INTO "team_members" ("teamId", "userId", "role", "createdAt", "updatedAt")
  VALUES (v_lucia_team_id, v_lucia_user_id, 'owner', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO "categories" (id, "teamId", "userId", name, slug, "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid()::text, v_lucia_team_id, v_lucia_user_id, 'Travel', 'travel', NOW(), NOW()),
    (gen_random_uuid()::text, v_lucia_team_id, v_lucia_user_id, 'Remote Work', 'remote-work', NOW(), NOW()),
    (gen_random_uuid()::text, v_lucia_team_id, v_lucia_user_id, 'Lifestyle', 'lifestyle', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_cat_travel FROM "categories" WHERE "teamId" = v_lucia_team_id AND slug = 'travel' LIMIT 1;
  SELECT id INTO v_cat_remote FROM "categories" WHERE "teamId" = v_lucia_team_id AND slug = 'remote-work' LIMIT 1;
  SELECT id INTO v_cat_lifestyle FROM "categories" WHERE "teamId" = v_lucia_team_id AND slug = 'lifestyle' LIMIT 1;

  -- Lucia's Posts (4 total: 3 published, 1 draft)
  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_lucia_team_id, v_lucia_user_id,
    'Best Cafes for Remote Work in Lisbon',
    'best-cafes-remote-work-lisbon',
    'A curated guide to the most laptop-friendly cafes in Portugal''s capital.',
    '<p>Lisbon has become a hotspot for digital nomads, and for good reason. The weather is amazing, the cost of living is reasonable, and the cafe scene is incredible.</p><h2>Top 10 Cafes</h2><p><strong>1. Fabrica Coffee Roasters:</strong> The best coffee in Lisbon, hands down. Great wifi, plenty of power outlets, and a atmosphere perfect for focused work.</p><p><strong>2. Copenhagen Coffee Lab:</strong> Multiple locations around the city. Consistently excellent coffee and a laptop-friendly vibe.</p><p><strong>3. Hello, Kristof:</strong> A bit off the beaten path in Anjos, but worth the trip. Local crowd, great prices, and super fast wifi.</p><h2>Remote Work Tips</h2><p>Most cafes in Lisbon are understanding of remote workers, but it''s good etiquette to buy something every 2-3 hours if you''re staying a while. And always ask before taking up a table during lunch rush!</p>',
    'published', NOW() - INTERVAL '3 days', true, NOW() - INTERVAL '3 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_travel IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_travel) ON CONFLICT DO NOTHING;
  END IF;
  IF v_post_id IS NOT NULL AND v_cat_remote IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_remote) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_lucia_team_id, v_lucia_user_id,
    'Digital Nomad Essentials: What to Pack',
    'digital-nomad-essentials',
    'Everything you need in your backpack for location-independent work.',
    '<p>After 3 years of nomadic living across 30+ countries, I''ve refined my packing list to the essentials. Here''s what actually matters.</p><h2>The Ultimate Packing List</h2><p><strong>Tech Essentials:</strong></p><ul><li>13" MacBook Pro (or similar lightweight laptop)</li><li>Portable SSD for backups</li><li>Universal travel adapter</li><li>Power bank (20,000mAh minimum)</li><li>Noise-cancelling headphones</li></ul><p><strong>Work Setup:</strong></p><ul><li>Portable laptop stand</li><li>Compact wireless mouse</li><li>Microfiber cleaning cloth</li></ul><h2>What I Don''t Pack Anymore</h2><p>After years of trial and error, I''ve stopped bringing: multiple cables (USB-C is enough), books (Kindle is better), and more than one week of clothes (you can do laundry anywhere).</p>',
    'published', NOW() - INTERVAL '8 days', false, NOW() - INTERVAL '8 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_remote IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_remote) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_lucia_team_id, v_lucia_user_id,
    'Hidden Gems of Southeast Asia',
    'hidden-gems-southeast-asia',
    'Off-the-beaten-path destinations that most tourists miss.',
    '<p>Southeast Asia offers incredible diversity, but most travelers stick to the same circuit: Bangkok, Angkor Wat, Ha Long Bay. Here are some places that deserve more attention.</p><h2>Beyond the Tourist Trail</h2><p><strong>1. Koh Rong Samloem, Cambodia:</strong> Like Koh Phi Phi was 20 years ago. Pristine beaches, bioluminescent plankton, and very few tourists.</p><p><strong>2. Pai, Thailand:</strong> A mountain town in northern Thailand with a creative vibe, great coffee, and stunning nature. Skip Chiang Mai and come here instead.</p><p><strong>3. Kampot, Cambodia:</strong> A riverside town known for its pepper farms and laid-back atmosphere. Perfect for slowing down.</p><h2>Why Go Off the Beaten Path</h2><p>You''ll have more authentic experiences, spend less money, and avoid the crowds. Plus, you''re supporting local economies that really need it.</p>',
    'published', NOW() - INTERVAL '12 days', false, NOW() - INTERVAL '12 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_travel IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_travel) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_lucia_team_id, v_lucia_user_id,
    'Work-Life Balance Tips for Remote Workers',
    'work-life-balance-remote',
    'How to avoid burnout when your office is everywhere.',
    '<p>Draft in progress... Will cover setting boundaries, maintaining routines, and knowing when to log off.</p>',
    'draft', NULL, false, NOW() - INTERVAL '1 day', NOW()
  )
  ON CONFLICT DO NOTHING;

  -- =====================================================
  -- AUTHOR 3: Carlos Finance (Business & Finance)
  -- =====================================================

  INSERT INTO "users" (id, email, "emailVerified", name, "firstName", "lastName",
                       username, bio, "social_twitter", "social_linkedin", "role", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'blog_author_carlos@nextspark.dev',
    true,
    'Carlos Finance',
    'Carlos',
    'Finance',
    'carlos',
    'Former investment banker turned financial educator. Making personal finance accessible to everyone.',
    'https://twitter.com/carlosfinance',
    'https://linkedin.com/in/carlosfinance',
    'member',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET username = 'carlos'
  RETURNING id INTO v_carlos_user_id;

  INSERT INTO "teams" (id, name, slug, "ownerId", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'Carlos Finance Blog',
    'carlos-finance-blog',
    v_carlos_user_id,
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_carlos_team_id;

  IF v_carlos_team_id IS NULL THEN
    SELECT id INTO v_carlos_team_id FROM "teams" WHERE slug = 'carlos-finance-blog';
  END IF;

  INSERT INTO "team_members" ("teamId", "userId", "role", "createdAt", "updatedAt")
  VALUES (v_carlos_team_id, v_carlos_user_id, 'owner', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO "categories" (id, "teamId", "userId", name, slug, "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid()::text, v_carlos_team_id, v_carlos_user_id, 'Investing', 'investing', NOW(), NOW()),
    (gen_random_uuid()::text, v_carlos_team_id, v_carlos_user_id, 'Personal Finance', 'personal-finance', NOW(), NOW()),
    (gen_random_uuid()::text, v_carlos_team_id, v_carlos_user_id, 'Entrepreneurship', 'entrepreneurship', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_cat_investing FROM "categories" WHERE "teamId" = v_carlos_team_id AND slug = 'investing' LIMIT 1;
  SELECT id INTO v_cat_finance FROM "categories" WHERE "teamId" = v_carlos_team_id AND slug = 'personal-finance' LIMIT 1;
  SELECT id INTO v_cat_entrepreneurship FROM "categories" WHERE "teamId" = v_carlos_team_id AND slug = 'entrepreneurship' LIMIT 1;

  -- Carlos's Posts (4 total: 3 published, 1 draft)
  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_carlos_team_id, v_carlos_user_id,
    'Investing 101: A Beginner''s Guide',
    'investing-101-beginners-guide',
    'Everything you need to know to start building wealth through smart investing.',
    '<p>Investing can seem intimidating if you''re just starting out. But the basics are actually quite simple, and the sooner you start, the better.</p><h2>Start Simple</h2><p>The best time to start investing was yesterday. The second best time is today. Thanks to compound interest, even small amounts invested early can grow significantly over time.</p><h2>The Three-Fund Portfolio</h2><p>For most people, a simple three-fund portfolio is all you need:</p><ul><li>60% Total Stock Market Index Fund</li><li>30% International Stock Market Index Fund</li><li>10% Bond Index Fund</li></ul><p>Adjust the percentages based on your age and risk tolerance, but this basic framework works for almost everyone.</p><h2>Key Principles</h2><p><strong>1. Start early:</strong> Time in the market beats timing the market.</p><p><strong>2. Invest regularly:</strong> Set up automatic monthly transfers.</p><p><strong>3. Keep fees low:</strong> Choose index funds over actively managed funds.</p><p><strong>4. Don''t panic sell:</strong> Market downturns are normal and temporary.</p>',
    'published', NOW() - INTERVAL '4 days', true, NOW() - INTERVAL '4 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_investing IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_investing) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_carlos_team_id, v_carlos_user_id,
    'Side Hustles That Actually Work in 2024',
    'side-hustles-that-work-2024',
    'Realistic ways to earn extra income without quitting your day job.',
    '<p>The gig economy has evolved significantly. Here are side hustles that actually generate meaningful income in 2024.</p><h2>Top 5 Side Hustles</h2><p><strong>1. Freelance Consulting:</strong> Use your professional expertise to consult for other companies. Rates: $100-$500/hour depending on your field.</p><p><strong>2. Online Course Creation:</strong> Package your knowledge into a course. Initial work is significant, but it can generate passive income long-term.</p><p><strong>3. Technical Writing:</strong> Many companies pay well for clear, technical documentation. Rates: $50-$150/hour.</p><p><strong>4. Web Development/Design:</strong> Always in demand. Build websites for small businesses. Projects: $2,000-$10,000 each.</p><p><strong>5. Rental Income:</strong> Rent out a spare room on Airbnb or your parking space. Passive income once set up.</p><h2>What Doesn''t Work</h2><p>Avoid: Surveys ($5/hour), most multi-level marketing schemes, and "make money fast" courses. Focus on leveraging your existing skills.</p>',
    'published', NOW() - INTERVAL '9 days', false, NOW() - INTERVAL '9 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_entrepreneurship IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_entrepreneurship) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_carlos_team_id, v_carlos_user_id,
    'Understanding Crypto Markets',
    'understanding-crypto-markets',
    'A balanced view on cryptocurrency investing: risks, rewards, and reality.',
    '<p>Cryptocurrency has gone from niche to mainstream, but that doesn''t mean everyone should invest. Here''s what you need to know.</p><h2>The Basics</h2><p>Before investing in crypto, understand that it''s highly speculative and volatile. Never invest more than you can afford to lose completely.</p><h2>If You Do Invest</h2><p><strong>Stick to the majors:</strong> Bitcoin and Ethereum are the only ones with established track records. Everything else is extremely high risk.</p><p><strong>Don''t try to time it:</strong> If you believe in crypto long-term, dollar-cost average your way in over time.</p><p><strong>Secure your holdings:</strong> Use a hardware wallet for any significant amounts. Exchanges get hacked.</p><h2>The Reality</h2><p>Crypto might be the future of finance, or it might not. No one knows. Treat it as a small, speculative part of a diversified portfolio, not as your path to quick riches.</p>',
    'published', NOW() - INTERVAL '14 days', false, NOW() - INTERVAL '14 days', NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_post_id;

  IF v_post_id IS NOT NULL AND v_cat_investing IS NOT NULL THEN
    INSERT INTO "post_categories" ("postId", "categoryId") VALUES (v_post_id, v_cat_investing) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO "posts" (id, "teamId", "userId", title, slug, excerpt, content, status, "publishedAt", featured, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text, v_carlos_team_id, v_carlos_user_id,
    'Building Passive Income Streams',
    'building-passive-income',
    'How to create income that works while you sleep.',
    '<p>Draft in progress... Will cover dividend investing, rental properties, and digital products.</p>',
    'draft', NULL, false, NOW() - INTERVAL '3 days', NOW()
  )
  ON CONFLICT DO NOTHING;

END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Sample data migration complete: 3 authors with 13 posts (10 published, 3 drafts) created';
END $$;
