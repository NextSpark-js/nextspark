-- ============================================================================
-- Productivity Theme - Abundant Sample Data Migration
-- Additional boards and cards to populate the Kanban experience
-- Run AFTER: 999_theme_sample_data.sql and entity sample data migrations
-- ============================================================================

-- ============================================
-- ADDITIONAL BOARDS (6 more boards)
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
    'board-prod-004',
    'Marketing Campaigns',
    'Marketing initiatives and content calendar',
    'orange',
    3,
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'board-prod-005',
    'Bug Tracker',
    'Track and resolve bugs across the platform',
    'red',
    4,
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'board-prod-006',
    'Customer Feedback',
    'Feature requests and user feedback tracking',
    'pink',
    5,
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'board-prod-007',
    'Q1 Goals',
    'Quarterly objectives and key results',
    'blue',
    6,
    'usr-prod-pm-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'board-prod-008',
    'Infrastructure',
    'DevOps and infrastructure improvements',
    'gray',
    7,
    'usr-prod-dev-001',
    'team-prod-product',
    NOW(),
    NOW()
  ),
  (
    'board-prod-009',
    'User Research',
    'UX research findings and insights',
    'purple',
    8,
    'usr-prod-design-001',
    'team-prod-product',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ADDITIONAL LISTS
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
  -- Marketing Campaigns lists
  ('list-prod-012', 'Ideas', 0, 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-013', 'Planning', 1, 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-014', 'In Progress', 2, 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-015', 'Review', 3, 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-016', 'Published', 4, 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- Bug Tracker lists
  ('list-prod-017', 'Reported', 0, 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-018', 'Triaged', 1, 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-019', 'Fixing', 2, 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-020', 'Testing', 3, 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-021', 'Resolved', 4, 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),

  -- Customer Feedback lists
  ('list-prod-022', 'New Requests', 0, 'board-prod-006', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-023', 'Under Review', 1, 'board-prod-006', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-024', 'Planned', 2, 'board-prod-006', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-025', 'Implemented', 3, 'board-prod-006', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- Q1 Goals lists
  ('list-prod-026', 'Not Started', 0, 'board-prod-007', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-027', 'In Progress', 1, 'board-prod-007', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-028', 'At Risk', 2, 'board-prod-007', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-029', 'Completed', 3, 'board-prod-007', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- Infrastructure lists
  ('list-prod-030', 'Backlog', 0, 'board-prod-008', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-031', 'Scheduled', 1, 'board-prod-008', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-032', 'Deploying', 2, 'board-prod-008', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-033', 'Monitoring', 3, 'board-prod-008', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-034', 'Done', 4, 'board-prod-008', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),

  -- User Research lists
  ('list-prod-035', 'To Research', 0, 'board-prod-009', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-036', 'Interviewing', 1, 'board-prod-009', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-037', 'Analyzing', 2, 'board-prod-009', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('list-prod-038', 'Insights Ready', 3, 'board-prod-009', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ABUNDANT CARDS - Sprint Board (board-prod-002)
-- ============================================

INSERT INTO "cards" (
  id, title, description, "position", priority, "dueDate", labels,
  "listId", "boardId", "userId", "teamId", "createdAt", "updatedAt"
) VALUES
  -- Sprint - To Do (list-prod-005) - 8 more cards
  ('card-prod-010', 'Implement dark mode toggle', 'Add system/light/dark mode switcher to settings', 2, 'medium', NOW() + INTERVAL '4 days', '["feature", "ui"]'::jsonb, 'list-prod-005', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-011', 'Add keyboard shortcuts', 'Implement common keyboard shortcuts for power users', 3, 'low', NOW() + INTERVAL '10 days', '["feature", "ux"]'::jsonb, 'list-prod-005', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-012', 'Optimize image loading', 'Implement lazy loading for card images', 4, 'medium', NOW() + INTERVAL '6 days', '["performance"]'::jsonb, 'list-prod-005', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-013', 'Add drag and drop for file uploads', 'Allow users to drag files into card details', 5, 'low', NOW() + INTERVAL '14 days', '["feature", "ux"]'::jsonb, 'list-prod-005', 'board-prod-002', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-014', 'Create onboarding flow', 'New user onboarding with interactive tutorial', 6, 'high', NOW() + INTERVAL '7 days', '["feature", "onboarding"]'::jsonb, 'list-prod-005', 'board-prod-002', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-015', 'Add activity feed', 'Show recent activity on boards and cards', 7, 'medium', NOW() + INTERVAL '12 days', '["feature"]'::jsonb, 'list-prod-005', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-016', 'Implement card comments', 'Allow team members to comment on cards', 8, 'high', NOW() + INTERVAL '5 days', '["feature", "collaboration"]'::jsonb, 'list-prod-005', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-017', 'Add card attachments', 'Upload and attach files to cards', 9, 'medium', NOW() + INTERVAL '8 days', '["feature"]'::jsonb, 'list-prod-005', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),

  -- Sprint - In Progress (list-prod-006) - 5 more cards
  ('card-prod-018', 'Build notification system', 'Real-time notifications for card updates', 1, 'high', NOW() + INTERVAL '2 days', '["feature", "notifications"]'::jsonb, 'list-prod-006', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-019', 'Design card detail modal', 'Create expanded card view with full details', 2, 'medium', NOW() + INTERVAL '3 days', '["design", "ui"]'::jsonb, 'list-prod-006', 'board-prod-002', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-020', 'Implement board filters', 'Filter cards by label, assignee, and due date', 3, 'medium', NOW() + INTERVAL '4 days', '["feature", "ux"]'::jsonb, 'list-prod-006', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-021', 'Add checklist feature', 'Checklists within cards for subtasks', 4, 'high', NOW() + INTERVAL '3 days', '["feature"]'::jsonb, 'list-prod-006', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-022', 'Create board templates', 'Pre-made board templates for common workflows', 5, 'low', NOW() + INTERVAL '9 days', '["feature"]'::jsonb, 'list-prod-006', 'board-prod-002', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- Sprint - Code Review (list-prod-007) - 4 cards
  ('card-prod-023', 'API rate limiting', 'Implement rate limiting for API endpoints', 0, 'high', NOW() + INTERVAL '1 day', '["security", "api"]'::jsonb, 'list-prod-007', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-024', 'User avatar upload', 'Allow users to upload custom avatars', 1, 'medium', NOW() + INTERVAL '2 days', '["feature", "profile"]'::jsonb, 'list-prod-007', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-025', 'Email notifications', 'Send email alerts for important updates', 2, 'medium', NOW() + INTERVAL '2 days', '["feature", "notifications"]'::jsonb, 'list-prod-007', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-026', 'Board sharing permissions', 'Share boards with specific team members', 3, 'high', NOW() + INTERVAL '1 day', '["feature", "permissions"]'::jsonb, 'list-prod-007', 'board-prod-002', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- Sprint - Done (list-prod-008) - 6 cards
  ('card-prod-027', 'Setup CI/CD pipeline', 'Automated testing and deployment', 0, 'high', NOW() - INTERVAL '5 days', '["devops"]'::jsonb, 'list-prod-008', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-028', 'Create API documentation', 'OpenAPI spec for all endpoints', 1, 'medium', NOW() - INTERVAL '3 days', '["docs", "api"]'::jsonb, 'list-prod-008', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-029', 'Implement card labels', 'Colored labels for card categorization', 2, 'medium', NOW() - INTERVAL '7 days', '["feature"]'::jsonb, 'list-prod-008', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-030', 'Add due dates to cards', 'Date picker for card deadlines', 3, 'high', NOW() - INTERVAL '10 days', '["feature"]'::jsonb, 'list-prod-008', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-031', 'Board creation flow', 'Create new boards with color selection', 4, 'high', NOW() - INTERVAL '12 days', '["feature"]'::jsonb, 'list-prod-008', 'board-prod-002', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-prod-032', 'List reordering', 'Drag and drop to reorder lists', 5, 'medium', NOW() - INTERVAL '8 days', '["feature", "ux"]'::jsonb, 'list-prod-008', 'board-prod-002', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ABUNDANT CARDS - Bug Tracker (board-prod-005)
-- ============================================

INSERT INTO "cards" (
  id, title, description, "position", priority, "dueDate", labels,
  "listId", "boardId", "userId", "teamId", "createdAt", "updatedAt"
) VALUES
  -- Reported bugs
  ('card-bug-001', 'Safari drag drop not working', 'Cards cannot be dragged on Safari 16.x', 0, 'urgent', NOW() + INTERVAL '1 day', '["bug", "browser"]'::jsonb, 'list-prod-017', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-002', 'Mobile menu overlaps content', 'Navigation menu covers main content on iPhone', 1, 'high', NOW() + INTERVAL '2 days', '["bug", "mobile"]'::jsonb, 'list-prod-017', 'board-prod-005', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-003', 'Duplicate cards on fast click', 'Double clicking creates duplicate cards', 2, 'medium', NOW() + INTERVAL '3 days', '["bug"]'::jsonb, 'list-prod-017', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-004', 'Search returns stale results', 'Search cache not invalidating properly', 3, 'medium', NOW() + INTERVAL '4 days', '["bug", "search"]'::jsonb, 'list-prod-017', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-005', 'Avatar not loading for some users', 'External avatar URLs blocked by CSP', 4, 'low', NOW() + INTERVAL '5 days', '["bug"]'::jsonb, 'list-prod-017', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),

  -- Triaged
  ('card-bug-006', 'Memory leak in board view', 'Memory usage grows when switching boards', 0, 'high', NOW() + INTERVAL '2 days', '["bug", "performance"]'::jsonb, 'list-prod-018', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-007', 'Timezone issues in due dates', 'Due dates off by timezone offset', 1, 'medium', NOW() + INTERVAL '3 days', '["bug", "dates"]'::jsonb, 'list-prod-018', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-008', 'Keyboard navigation broken', 'Tab order incorrect in card modal', 2, 'medium', NOW() + INTERVAL '4 days', '["bug", "a11y"]'::jsonb, 'list-prod-018', 'board-prod-005', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),

  -- Fixing
  ('card-bug-009', 'Login redirect loop', 'Users stuck in redirect loop after password change', 0, 'urgent', NOW() + INTERVAL '1 day', '["bug", "auth"]'::jsonb, 'list-prod-019', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-010', 'File upload size limit error', 'Unclear error message for large files', 1, 'medium', NOW() + INTERVAL '2 days', '["bug", "ux"]'::jsonb, 'list-prod-019', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),

  -- Testing
  ('card-bug-011', 'Card position not persisting', 'Card order resets on page reload', 0, 'high', NOW() + INTERVAL '1 day', '["bug"]'::jsonb, 'list-prod-020', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-012', 'Notification badge count wrong', 'Badge shows incorrect unread count', 1, 'low', NOW() + INTERVAL '2 days', '["bug", "notifications"]'::jsonb, 'list-prod-020', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),

  -- Resolved
  ('card-bug-013', 'Fixed: Board color picker', 'Color not saving on board edit', 0, 'medium', NOW() - INTERVAL '3 days', '["bug", "resolved"]'::jsonb, 'list-prod-021', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-014', 'Fixed: List name truncation', 'Long names not truncating correctly', 1, 'low', NOW() - INTERVAL '5 days', '["bug", "resolved"]'::jsonb, 'list-prod-021', 'board-prod-005', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-bug-015', 'Fixed: Double submit on forms', 'Submit button not disabling', 2, 'medium', NOW() - INTERVAL '7 days', '["bug", "resolved"]'::jsonb, 'list-prod-021', 'board-prod-005', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ABUNDANT CARDS - Marketing Campaigns (board-prod-004)
-- ============================================

INSERT INTO "cards" (
  id, title, description, "position", priority, "dueDate", labels,
  "listId", "boardId", "userId", "teamId", "createdAt", "updatedAt"
) VALUES
  -- Ideas
  ('card-mkt-001', 'Product launch video', 'Create video showcasing new features', 0, 'medium', NULL, '["content", "video"]'::jsonb, 'list-prod-012', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-002', 'Customer testimonials', 'Gather and publish customer success stories', 1, 'low', NULL, '["content", "social-proof"]'::jsonb, 'list-prod-012', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-003', 'Podcast sponsorship', 'Research tech podcasts for sponsorship', 2, 'low', NULL, '["advertising"]'::jsonb, 'list-prod-012', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-004', 'Referral program design', 'Design referral reward structure', 3, 'medium', NULL, '["growth"]'::jsonb, 'list-prod-012', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- Planning
  ('card-mkt-005', 'Q2 content calendar', 'Plan blog posts and social content', 0, 'high', NOW() + INTERVAL '7 days', '["planning", "content"]'::jsonb, 'list-prod-013', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-006', 'Email drip campaign', 'Design onboarding email sequence', 1, 'high', NOW() + INTERVAL '10 days', '["email", "onboarding"]'::jsonb, 'list-prod-013', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-007', 'Landing page A/B test', 'Test new hero section copy', 2, 'medium', NOW() + INTERVAL '5 days', '["testing", "conversion"]'::jsonb, 'list-prod-013', 'board-prod-004', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),

  -- In Progress
  ('card-mkt-008', 'Blog: Getting Started Guide', 'Write comprehensive getting started article', 0, 'high', NOW() + INTERVAL '3 days', '["content", "docs"]'::jsonb, 'list-prod-014', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-009', 'Social media graphics pack', 'Create templates for social posts', 1, 'medium', NOW() + INTERVAL '4 days', '["design", "social"]'::jsonb, 'list-prod-014', 'board-prod-004', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-010', 'Newsletter template redesign', 'Update email template for consistency', 2, 'medium', NOW() + INTERVAL '5 days', '["design", "email"]'::jsonb, 'list-prod-014', 'board-prod-004', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),

  -- Review
  ('card-mkt-011', 'Press release draft', 'Review funding announcement PR', 0, 'urgent', NOW() + INTERVAL '1 day', '["pr", "review"]'::jsonb, 'list-prod-015', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-012', 'Feature comparison chart', 'Verify competitor feature data', 1, 'medium', NOW() + INTERVAL '2 days', '["content", "sales"]'::jsonb, 'list-prod-015', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- Published
  ('card-mkt-013', 'Blog: 10 Productivity Tips', 'Published productivity tips article', 0, 'medium', NOW() - INTERVAL '7 days', '["content", "published"]'::jsonb, 'list-prod-016', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-014', 'Product Hunt launch', 'Successfully launched on PH', 1, 'high', NOW() - INTERVAL '14 days', '["launch", "published"]'::jsonb, 'list-prod-016', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-mkt-015', 'Case study: Acme Corp', 'Published enterprise case study', 2, 'medium', NOW() - INTERVAL '21 days', '["content", "published"]'::jsonb, 'list-prod-016', 'board-prod-004', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ABUNDANT CARDS - Product Roadmap (board-prod-001)
-- ============================================

INSERT INTO "cards" (
  id, title, description, "position", priority, "dueDate", labels,
  "listId", "boardId", "userId", "teamId", "createdAt", "updatedAt"
) VALUES
  -- Backlog - more cards
  ('card-road-001', 'AI-powered card suggestions', 'Use ML to suggest card assignments', 2, 'low', NOW() + INTERVAL '90 days', '["feature", "ai"]'::jsonb, 'list-prod-001', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-002', 'Gantt chart view', 'Timeline visualization for projects', 3, 'medium', NOW() + INTERVAL '60 days', '["feature", "views"]'::jsonb, 'list-prod-001', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-003', 'Calendar integration', 'Sync with Google Calendar and Outlook', 4, 'high', NOW() + INTERVAL '45 days', '["feature", "integration"]'::jsonb, 'list-prod-001', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-004', 'Mobile app', 'Native iOS and Android applications', 5, 'high', NOW() + INTERVAL '120 days', '["feature", "mobile"]'::jsonb, 'list-prod-001', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-005', 'Slack integration', 'Post updates to Slack channels', 6, 'medium', NOW() + INTERVAL '30 days', '["feature", "integration"]'::jsonb, 'list-prod-001', 'board-prod-001', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-006', 'Custom fields', 'User-defined fields on cards', 7, 'medium', NOW() + INTERVAL '50 days', '["feature"]'::jsonb, 'list-prod-001', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- Planning
  ('card-road-007', 'Workspace analytics', 'Team productivity metrics and reports', 0, 'high', NOW() + INTERVAL '21 days', '["feature", "analytics"]'::jsonb, 'list-prod-002', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-008', 'API v2 redesign', 'RESTful API improvements', 1, 'medium', NOW() + INTERVAL '28 days', '["api", "technical"]'::jsonb, 'list-prod-002', 'board-prod-001', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-009', 'Automation rules', 'If-this-then-that style automations', 2, 'high', NOW() + INTERVAL '35 days', '["feature", "automation"]'::jsonb, 'list-prod-002', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),

  -- In Development
  ('card-road-010', 'Board templates marketplace', 'Share and download board templates', 1, 'medium', NOW() + INTERVAL '14 days', '["feature"]'::jsonb, 'list-prod-003', 'board-prod-001', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-011', 'Advanced search filters', 'Complex search queries with filters', 2, 'high', NOW() + INTERVAL '10 days', '["feature", "search"]'::jsonb, 'list-prod-003', 'board-prod-001', 'usr-prod-dev-001', 'team-prod-product', NOW(), NOW()),

  -- Released
  ('card-road-012', 'Team workspaces', 'Multi-team support launched', 0, 'high', NOW() - INTERVAL '30 days', '["feature", "released"]'::jsonb, 'list-prod-004', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-013', 'Card priority levels', 'Urgent, high, medium, low priorities', 1, 'medium', NOW() - INTERVAL '45 days', '["feature", "released"]'::jsonb, 'list-prod-004', 'board-prod-001', 'usr-prod-pm-001', 'team-prod-product', NOW(), NOW()),
  ('card-road-014', 'Dark mode', 'System-wide dark theme', 2, 'medium', NOW() - INTERVAL '60 days', '["feature", "released"]'::jsonb, 'list-prod-004', 'board-prod-001', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ABUNDANT CARDS - Design System (board-prod-003)
-- ============================================

INSERT INTO "cards" (
  id, title, description, "position", priority, "dueDate", labels,
  "listId", "boardId", "userId", "teamId", "createdAt", "updatedAt"
) VALUES
  -- Components - more cards
  ('card-design-001', 'Modal component', 'Responsive dialog/modal component', 2, 'high', NOW() + INTERVAL '5 days', '["component", "ui"]'::jsonb, 'list-prod-009', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-002', 'Dropdown menu', 'Multi-level dropdown navigation', 3, 'medium', NOW() + INTERVAL '7 days', '["component", "ui"]'::jsonb, 'list-prod-009', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-003', 'Toast notifications', 'Success, error, warning, info toasts', 4, 'medium', NOW() + INTERVAL '4 days', '["component", "feedback"]'::jsonb, 'list-prod-009', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-004', 'Avatar component', 'User avatar with status indicator', 5, 'low', NOW() + INTERVAL '10 days', '["component", "ui"]'::jsonb, 'list-prod-009', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-005', 'Card component', 'Content card with variants', 6, 'medium', NOW() + INTERVAL '6 days', '["component", "ui"]'::jsonb, 'list-prod-009', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-006', 'Table component', 'Data table with sorting and pagination', 7, 'high', NOW() + INTERVAL '8 days', '["component", "data"]'::jsonb, 'list-prod-009', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),

  -- Patterns - more cards
  ('card-design-007', 'Loading states', 'Skeleton loaders and spinners', 1, 'medium', NULL, '["pattern", "feedback"]'::jsonb, 'list-prod-010', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-008', 'Empty states', 'Illustrations for empty content areas', 2, 'low', NULL, '["pattern", "illustration"]'::jsonb, 'list-prod-010', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-009', 'Error handling', 'Error messages and recovery flows', 3, 'high', NULL, '["pattern", "ux"]'::jsonb, 'list-prod-010', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),

  -- Guidelines
  ('card-design-010', 'Color palette', 'Define primary, secondary, semantic colors', 0, 'high', NULL, '["guideline", "color"]'::jsonb, 'list-prod-011', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-011', 'Typography scale', 'Font sizes, weights, and line heights', 1, 'high', NULL, '["guideline", "typography"]'::jsonb, 'list-prod-011', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-012', 'Spacing system', '4px grid spacing rules', 2, 'medium', NULL, '["guideline", "layout"]'::jsonb, 'list-prod-011', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-013', 'Icon guidelines', 'Icon sizing and usage rules', 3, 'medium', NULL, '["guideline", "icons"]'::jsonb, 'list-prod-011', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW()),
  ('card-design-014', 'Motion principles', 'Animation timing and easing', 4, 'low', NULL, '["guideline", "motion"]'::jsonb, 'list-prod-011', 'board-prod-003', 'usr-prod-design-001', 'team-prod-product', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SUCCESS SUMMARY
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  Productivity Theme - Abundant Sample Data';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  📋 BOARDS: 9 total (6 new)';
  RAISE NOTICE '     Product Roadmap, Sprint Board, Design System,';
  RAISE NOTICE '     Marketing Campaigns, Bug Tracker, Customer Feedback,';
  RAISE NOTICE '     Q1 Goals, Infrastructure, User Research';
  RAISE NOTICE '';
  RAISE NOTICE '  📑 LISTS: 38 total (27 new)';
  RAISE NOTICE '     5 per board average';
  RAISE NOTICE '';
  RAISE NOTICE '  🎴 CARDS: 80+ total (70+ new)';
  RAISE NOTICE '     Sprint Board: 25 cards';
  RAISE NOTICE '     Bug Tracker: 15 cards';
  RAISE NOTICE '     Marketing: 15 cards';
  RAISE NOTICE '     Product Roadmap: 14 cards';
  RAISE NOTICE '     Design System: 14 cards';
  RAISE NOTICE '';
  RAISE NOTICE '  🎨 BOARD COLORS:';
  RAISE NOTICE '     blue, green, purple, orange, red, pink, gray';
  RAISE NOTICE '';
  RAISE NOTICE '  🏷️  LABELS:';
  RAISE NOTICE '     feature, bug, design, security, performance,';
  RAISE NOTICE '     content, integration, automation, and more!';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
