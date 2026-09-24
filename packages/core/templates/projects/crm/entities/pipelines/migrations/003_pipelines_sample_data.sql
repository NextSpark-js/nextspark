-- ============================================================================
-- Sample data for pipelines table - CRM Theme
-- Aligned with schema in 001_pipelines_table.sql
-- Uses users from 999_theme_sample_data.sql
-- NOTE: IDs are valid UUIDs because opportunities.pipelineId is UUID type
-- ============================================================================

-- Clean existing pipelines data
DELETE FROM "pipelines" WHERE "teamId" = 'team-crm-company';

INSERT INTO "pipelines" (
  id,
  name,
  description,
  type,
  "isDefault",
  "isActive",
  stages,
  "dealRottenDays",
  "userId",
  "teamId",
  "createdAt",
  "updatedAt"
) VALUES
-- Main Sales Pipeline (Default)
(
  'cf7f1f00-0001-4000-8000-000000000001',
  'Main Sales Pipeline',
  'Primary sales pipeline for all standard opportunities',
  'sales',
  true,
  true,
  '[
    {"id": "stage_001", "name": "Lead", "order": 1, "probability": 10, "color": "#e3f2fd"},
    {"id": "stage_002", "name": "Qualified", "order": 2, "probability": 25, "color": "#bbdefb"},
    {"id": "stage_003", "name": "Proposal", "order": 3, "probability": 50, "color": "#90caf9"},
    {"id": "stage_004", "name": "Negotiation", "order": 4, "probability": 75, "color": "#64b5f6"},
    {"id": "stage_005", "name": "Closed Won", "order": 5, "probability": 100, "color": "#4caf50"},
    {"id": "stage_006", "name": "Closed Lost", "order": 6, "probability": 0, "color": "#f44336"}
  ]'::jsonb,
  30,
  'usr-crm-ceo',
  'team-crm-company',
  NOW() - INTERVAL '90 days',
  NOW() - INTERVAL '30 days'
),
-- Enterprise Sales Pipeline
(
  'cf7f1f00-0002-4000-8000-000000000002',
  'Enterprise Sales Pipeline',
  'Specialized pipeline for large enterprise deals with extended sales cycles',
  'sales',
  false,
  true,
  '[
    {"id": "stage_007", "name": "Discovery", "order": 1, "probability": 5, "color": "#f3e5f5"},
    {"id": "stage_008", "name": "Technical Evaluation", "order": 2, "probability": 15, "color": "#e1bee7"},
    {"id": "stage_009", "name": "Business Case", "order": 3, "probability": 30, "color": "#ce93d8"},
    {"id": "stage_010", "name": "Procurement", "order": 4, "probability": 60, "color": "#ba68c8"},
    {"id": "stage_011", "name": "Legal Review", "order": 5, "probability": 80, "color": "#ab47bc"},
    {"id": "stage_012", "name": "Closed Won", "order": 6, "probability": 100, "color": "#4caf50"},
    {"id": "stage_013", "name": "Closed Lost", "order": 7, "probability": 0, "color": "#f44336"}
  ]'::jsonb,
  45,
  'usr-crm-ceo',
  'team-crm-company',
  NOW() - INTERVAL '60 days',
  NOW() - INTERVAL '15 days'
),
-- Small Business Pipeline
(
  'cf7f1f00-0003-4000-8000-000000000003',
  'Small Business Pipeline',
  'Pipeline for small business leads with faster sales cycle',
  'sales',
  false,
  true,
  '[
    {"id": "stage_014", "name": "MQL", "order": 1, "probability": 10, "color": "#fff3e0"},
    {"id": "stage_015", "name": "Nurturing", "order": 2, "probability": 20, "color": "#ffe0b2"},
    {"id": "stage_016", "name": "Engaged", "order": 3, "probability": 40, "color": "#ffcc80"},
    {"id": "stage_017", "name": "Sales Ready", "order": 4, "probability": 70, "color": "#ffb300"},
    {"id": "stage_018", "name": "Converted", "order": 5, "probability": 100, "color": "#4caf50"},
    {"id": "stage_019", "name": "Disqualified", "order": 6, "probability": 0, "color": "#f44336"}
  ]'::jsonb,
  21,
  'usr-crm-sales-mgr',
  'team-crm-company',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '5 days'
);
