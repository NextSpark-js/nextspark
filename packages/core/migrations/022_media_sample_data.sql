-- Migration: 022_media_sample_data.sql
-- Description: Sample media data for testing
-- Date: 2026-02-06

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

DO $$
DECLARE
  media_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO media_count FROM "media";

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Media sample data migration completed!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  📊 MEDIA STATISTICS:';
  RAISE NOTICE '     Media files:    %', media_count;
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
