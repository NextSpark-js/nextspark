-- ============================================================================
-- Productivity Theme - Initial Boards/Lists/Cards Sample Data
-- Runs AFTER: 999_theme_sample_data.sql (which creates users)
-- Runs BEFORE: 999b_abundant_sample_data.sql (which adds more data)
-- ============================================================================

-- ============================================
-- INITIAL BOARDS (3 boards)
-- ============================================

INSERT INTO "boards" (
  id,
  name,
  description,
  color,
  "position",
  "userId",
  "teamId",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'board-prod-001',
    'Product Roadmap',
    'Main product development roadmap and feature planning',
    'blue',
    0,
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'board-prod-002',
    'Sprint Board',
    'Current sprint tasks and progress tracking',
    'green',
    1,
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'board-prod-003',
    'Design System',
    'UI components and design documentation',
    'purple',
    2,
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- INITIAL LISTS (11 lists)
-- ============================================

INSERT INTO "lists" (
  id,
  name,
  "position",
  "boardId",
  "userId",
  "teamId",
  "createdAt",
  "updatedAt"
) VALUES
  -- Product Roadmap lists
  (
    'list-prod-001',
    'Backlog',
    0,
    'board-prod-001',
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'list-prod-002',
    'Planning',
    1,
    'board-prod-001',
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'list-prod-003',
    'In Development',
    2,
    'board-prod-001',
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'list-prod-004',
    'Released',
    3,
    'board-prod-001',
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),

  -- Sprint Board lists
  (
    'list-prod-005',
    'To Do',
    0,
    'board-prod-002',
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'list-prod-006',
    'In Progress',
    1,
    'board-prod-002',
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'list-prod-007',
    'Code Review',
    2,
    'board-prod-002',
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'list-prod-008',
    'Done',
    3,
    'board-prod-002',
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),

  -- Design System lists
  (
    'list-prod-009',
    'Components',
    0,
    'board-prod-003',
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'list-prod-010',
    'Patterns',
    1,
    'board-prod-003',
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'list-prod-011',
    'Guidelines',
    2,
    'board-prod-003',
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- INITIAL CARDS (9 cards)
-- ============================================

INSERT INTO "cards" (
  id,
  title,
  description,
  "position",
  priority,
  "dueDate",
  labels,
  "listId",
  "boardId",
  "userId",
  "teamId",
  "createdAt",
  "updatedAt"
) VALUES
  -- Product Roadmap - Backlog (board-prod-001)
  (
    'card-prod-001',
    'User authentication v2',
    'Implement OAuth2 and SSO support for enterprise customers',
    0,
    'high',
    NOW() + INTERVAL '30 days',
    '["feature", "security"]'::jsonb,
    'list-prod-001',
    'board-prod-001',
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'card-prod-002',
    'Dashboard analytics',
    'Add usage analytics and reporting to the dashboard',
    1,
    'medium',
    NOW() + INTERVAL '45 days',
    '["feature", "analytics"]'::jsonb,
    'list-prod-001',
    'board-prod-001',
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),

  -- Product Roadmap - In Development (board-prod-001)
  (
    'card-prod-003',
    'Mobile responsive design',
    'Ensure all pages work well on mobile devices',
    0,
    'high',
    NOW() + INTERVAL '7 days',
    '["design", "mobile"]'::jsonb,
    'list-prod-003',
    'board-prod-001',
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),

  -- Sprint Board - To Do (board-prod-002)
  (
    'card-prod-004',
    'Fix login page bug',
    'Users report intermittent login failures on Safari',
    0,
    'urgent',
    NOW() + INTERVAL '2 days',
    '["bug", "auth"]'::jsonb,
    'list-prod-005',
    'board-prod-002',
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'card-prod-005',
    'Update API documentation',
    'Document new endpoints added in v2.1',
    1,
    'low',
    NOW() + INTERVAL '5 days',
    '["docs"]'::jsonb,
    'list-prod-005',
    'board-prod-002',
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),

  -- Sprint Board - In Progress (board-prod-002)
  (
    'card-prod-006',
    'Implement search feature',
    'Add full-text search to the main dashboard',
    0,
    'high',
    NOW() + INTERVAL '3 days',
    '["feature", "search"]'::jsonb,
    'list-prod-006',
    'board-prod-002',
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),

  -- Design System - Components (board-prod-003)
  (
    'card-prod-007',
    'Button component',
    'Primary, secondary, and ghost button variants',
    0,
    'medium',
    NULL,
    '["component", "ui"]'::jsonb,
    'list-prod-009',
    'board-prod-003',
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'card-prod-008',
    'Input fields',
    'Text, email, password, and textarea components',
    1,
    'medium',
    NULL,
    '["component", "forms"]'::jsonb,
    'list-prod-009',
    'board-prod-003',
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),

  -- Design System - Patterns (board-prod-003)
  (
    'card-prod-009',
    'Form validation pattern',
    'Standard way to show validation errors',
    0,
    'low',
    NULL,
    '["pattern", "forms"]'::jsonb,
    'list-prod-010',
    'board-prod-003',
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  Productivity Theme - Initial Sample Data';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  📋 BOARDS: 3';
  RAISE NOTICE '     - Product Roadmap (blue)';
  RAISE NOTICE '     - Sprint Board (green)';
  RAISE NOTICE '     - Design System (purple)';
  RAISE NOTICE '';
  RAISE NOTICE '  📑 LISTS: 11';
  RAISE NOTICE '     - Roadmap: Backlog, Planning, In Development, Released';
  RAISE NOTICE '     - Sprint: To Do, In Progress, Code Review, Done';
  RAISE NOTICE '     - Design: Components, Patterns, Guidelines';
  RAISE NOTICE '';
  RAISE NOTICE '  🎴 CARDS: 9';
  RAISE NOTICE '     - Various feature, bug, and design cards';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
