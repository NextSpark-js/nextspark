-- Migration: 098_patterns_sample_data.sql
-- Description: Sample patterns for testing pattern references and usage tracking
-- Date: 2025-01-17

-- =====================================================
-- PATTERNS SAMPLE DATA
-- =====================================================

-- Pattern 1: Newsletter CTA (Published)
INSERT INTO public.patterns (
  id,
  "userId",
  "teamId",
  title,
  slug,
  blocks,
  status,
  description,
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-b000-000000000001',
  'test-developer-001',
  'team-nextspark-001',
  'Newsletter CTA',
  'newsletter-cta',
  '[
    {
      "id": "newsletter-cta-block",
      "blockSlug": "cta-section",
      "props": {
        "title": "Stay Updated",
        "content": "Subscribe to our newsletter for the latest updates, tips, and exclusive content delivered straight to your inbox.",
        "backgroundColor": "primary",
        "textColor": "white",
        "primaryCta": {
          "label": "Subscribe Now",
          "url": "/newsletter",
          "variant": "secondary"
        },
        "secondaryCta": {
          "label": "Learn More",
          "url": "/about",
          "variant": "outline"
        }
      }
    }
  ]',
  'published',
  'Reusable newsletter call-to-action section for pages',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '2 days'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  blocks = EXCLUDED.blocks,
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  "updatedAt" = EXCLUDED."updatedAt";

-- Pattern 2: Footer Links (Published)
INSERT INTO public.patterns (
  id,
  "userId",
  "teamId",
  title,
  slug,
  blocks,
  status,
  description,
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-b000-000000000002',
  'test-developer-001',
  'team-nextspark-001',
  'Footer Links',
  'footer-links',
  '[
    {
      "id": "footer-links-block",
      "blockSlug": "text-content",
      "props": {
        "content": "## Quick Links\n\n- [Home](/)\n- [Features](/features)\n- [Pricing](/pricing)\n- [About](/about)\n- [Contact](/contact)\n\n## Resources\n\n- [Documentation](/getting-started)\n- [API Reference](/api)\n- [Support](/support)\n- [Blog](/blog)",
        "textAlign": "left",
        "maxWidth": "4xl",
        "padding": "lg"
      }
    }
  ]',
  'published',
  'Common footer links section for all pages',
  NOW() - INTERVAL '14 days',
  NOW() - INTERVAL '5 days'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  blocks = EXCLUDED.blocks,
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  "updatedAt" = EXCLUDED."updatedAt";

-- Pattern 3: Hero Header (Draft)
INSERT INTO public.patterns (
  id,
  "userId",
  "teamId",
  title,
  slug,
  blocks,
  status,
  description,
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-b000-000000000003',
  'test-developer-001',
  'team-nextspark-001',
  'Hero Header',
  'hero-header',
  '[
    {
      "id": "hero-header-block",
      "blockSlug": "hero",
      "props": {
        "title": "Welcome to NextSpark",
        "content": "The complete SaaS boilerplate for modern web applications. Build faster, scale smarter.",
        "textAlign": "center",
        "size": "lg",
        "cta": {
          "text": "Get Started",
          "link": "/signup",
          "variant": "default"
        },
        "secondaryCta": {
          "text": "View Demo",
          "link": "/demo",
          "variant": "outline"
        }
      }
    }
  ]',
  'draft',
  'Standard hero header for landing pages (work in progress)',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  blocks = EXCLUDED.blocks,
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  "updatedAt" = EXCLUDED."updatedAt";

-- =====================================================
-- PATTERN USAGES SAMPLE DATA
-- =====================================================

-- Usage 1: Newsletter CTA used in Home page
INSERT INTO public.pattern_usages (
  id,
  "patternId",
  "entityType",
  "entityId",
  "teamId",
  "createdAt"
) VALUES (
  '00000000-0000-4000-c000-000000000001',
  '00000000-0000-4000-b000-000000000001',
  'pages',
  '00000000-0000-4000-a000-000000000001',
  'team-nextspark-001',
  NOW() - INTERVAL '5 days'
) ON CONFLICT ("patternId", "entityType", "entityId") DO NOTHING;

-- Usage 2: Newsletter CTA used in Features page
INSERT INTO public.pattern_usages (
  id,
  "patternId",
  "entityType",
  "entityId",
  "teamId",
  "createdAt"
) VALUES (
  '00000000-0000-4000-c000-000000000002',
  '00000000-0000-4000-b000-000000000001',
  'pages',
  '00000000-0000-4000-a000-000000000002',
  'team-nextspark-001',
  NOW() - INTERVAL '4 days'
) ON CONFLICT ("patternId", "entityType", "entityId") DO NOTHING;

-- Usage 3: Footer Links used in Home page
INSERT INTO public.pattern_usages (
  id,
  "patternId",
  "entityType",
  "entityId",
  "teamId",
  "createdAt"
) VALUES (
  '00000000-0000-4000-c000-000000000003',
  '00000000-0000-4000-b000-000000000002',
  'pages',
  '00000000-0000-4000-a000-000000000001',
  'team-nextspark-001',
  NOW() - INTERVAL '10 days'
) ON CONFLICT ("patternId", "entityType", "entityId") DO NOTHING;

-- Usage 4: Footer Links used in About page
INSERT INTO public.pattern_usages (
  id,
  "patternId",
  "entityType",
  "entityId",
  "teamId",
  "createdAt"
) VALUES (
  '00000000-0000-4000-c000-000000000004',
  '00000000-0000-4000-b000-000000000002',
  'pages',
  '00000000-0000-4000-a000-000000000004',
  'team-nextspark-001',
  NOW() - INTERVAL '8 days'
) ON CONFLICT ("patternId", "entityType", "entityId") DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES (for manual testing)
-- =====================================================
-- SELECT id, title, status FROM patterns WHERE id::text LIKE '00000000-0000-4000-b000-%';
-- Expected: 3 rows (newsletter, footer-links, hero-header)

-- SELECT id, "patternId", "entityType", "entityId" FROM pattern_usages WHERE id::text LIKE '00000000-0000-4000-c000-%';
-- Expected: 4 rows
