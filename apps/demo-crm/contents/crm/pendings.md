# CRM Theme - Phase 3 Pending Items

> **Status**: Deferred - Not working on this phase yet
> **Last Updated**: 2024-11-28

## Overview

This document tracks pending UI/UX components and customizations needed for the CRM theme to be production-ready. These items are deferred after completing:
- Phase 1: SQL migrations corrections
- Phase 2: Permission validation with generic UI

---

## 1. Custom Components (Priority: High)

### 1.1 Pipeline Kanban Board
- [ ] Create `components/PipelineBoard.tsx` - Drag & drop board for opportunities
- [ ] Show opportunities grouped by pipeline stages
- [ ] Display deal value, probability, and close date on cards
- [ ] Support drag between stages with `opportunities.move_stage` permission
- [ ] Show pipeline value totals per stage
- [ ] Add quick actions: edit, view activities, mark as won/lost

### 1.2 Lead Conversion Flow
- [ ] Create `components/LeadConversionModal.tsx`
- [ ] Wizard-style flow: Lead → Contact + Company + Opportunity
- [ ] Pre-fill data from lead
- [ ] Require `leads.convert` permission
- [ ] Track conversion in lead record

### 1.3 Activity Timeline
- [ ] Create `components/ActivityTimeline.tsx`
- [ ] Polymorphic timeline for any entity (lead, contact, company, opportunity)
- [ ] Show activities, notes, and system events
- [ ] Support quick activity creation
- [ ] Filter by activity type

### 1.4 Contact/Company 360 View
- [ ] Create `components/EntityDetailView.tsx`
- [ ] Show related entities (contacts for company, opportunities, activities)
- [ ] Quick access to communication history
- [ ] Display key metrics and scores

---

## 2. Dashboard Widgets (Priority: High)

### 2.1 Sales Dashboard
- [ ] Pipeline funnel visualization
- [ ] Revenue forecast chart
- [ ] Won/Lost ratio
- [ ] Top opportunities list
- [ ] Activities due today

### 2.2 Marketing Dashboard
- [ ] Campaign performance metrics
- [ ] Lead source breakdown
- [ ] Conversion rates by source
- [ ] ROI calculations

### 2.3 Team Performance (owner/admin only)
- [ ] Sales rep leaderboard
- [ ] Activity completion rates
- [ ] Opportunity by rep
- [ ] Pipeline coverage

---

## 3. Template Overrides (Priority: Medium)

### 3.1 Entity List Views
- [ ] `templates/app/dashboard/(main)/leads/page.tsx`
  - Custom columns: score badge, source icon, status chip
  - Quick convert action

- [ ] `templates/app/dashboard/(main)/opportunities/page.tsx`
  - Toggle between list and Kanban view
  - Quick stage change

- [ ] `templates/app/dashboard/(main)/activities/page.tsx`
  - Calendar view option
  - Due date highlighting

### 3.2 Entity Detail Views
- [ ] `templates/app/dashboard/(main)/[entity]/[id]/page.tsx`
  - Related entities sidebar
  - Activity timeline
  - Quick actions based on entity type

### 3.3 Entity Create/Edit Forms
- [ ] Lead form with score calculator
- [ ] Opportunity form with pipeline/stage selector
- [ ] Activity form with entity picker

---

## 4. Settings Pages (Priority: Medium)

### 4.1 Pipeline Configuration
- [ ] `templates/app/dashboard/settings/pipelines/page.tsx`
- [ ] CRUD for pipelines (owner only)
- [ ] Stage editor with drag reorder
- [ ] Probability per stage configuration
- [ ] Default pipeline selection

### 4.2 Product Catalog
- [ ] `templates/app/dashboard/settings/products/page.tsx`
- [ ] Product CRUD (owner only)
- [ ] Categories and pricing tiers
- [ ] Product-opportunity association

### 4.3 Import/Export
- [ ] Bulk import wizard for leads, contacts, companies
- [ ] CSV/Excel template downloads
- [ ] Field mapping UI
- [ ] Requires `bulk.import` permission

---

## 5. Reports (Priority: Low)

### 5.1 Sales Reports
- [ ] Pipeline analysis report
- [ ] Win/loss analysis
- [ ] Sales cycle duration
- [ ] Requires `reports.sales` permission

### 5.2 Marketing Reports
- [ ] Campaign ROI
- [ ] Lead source analysis
- [ ] Conversion funnel
- [ ] Requires `reports.marketing` permission

### 5.3 Export Functionality
- [ ] PDF export for reports
- [ ] Excel export for data
- [ ] Requires `reports.export` permission

---

## 6. Mobile Optimizations (Priority: Low)

- [ ] Mobile-friendly pipeline view
- [ ] Swipe actions for activities
- [ ] Quick call/email actions
- [ ] Offline activity logging

---

## 7. Integrations (Priority: Future)

- [ ] Email integration (Gmail, Outlook)
- [ ] Calendar sync
- [ ] Phone/VoIP integration
- [ ] Social media enrichment

---

## Technical Notes

### Component Structure
```
contents/themes/crm/
├── components/
│   ├── PipelineBoard.tsx
│   ├── LeadConversionModal.tsx
│   ├── ActivityTimeline.tsx
│   ├── EntityDetailView.tsx
│   └── widgets/
│       ├── SalesDashboard.tsx
│       ├── MarketingDashboard.tsx
│       └── TeamPerformance.tsx
├── templates/
│   └── app/
│       └── dashboard/
│           ├── (main)/
│           │   ├── leads/
│           │   ├── opportunities/
│           │   └── activities/
│           └── settings/
│               ├── pipelines/
│               └── products/
└── styles/
    ├── globals.css
    └── components.css
```

### Permission Gates Required
All custom components must use `PermissionGate` for:
- `leads.convert`
- `opportunities.move_stage`
- `opportunities.close`
- `activities.complete`
- `campaigns.launch`
- `campaigns.pause`
- `reports.*`
- `bulk.*`
- `settings.pipelines`
- `settings.products`

### Design Guidelines
- Use CRM theme colors (teal/cyan primary)
- Professional, data-centric aesthetic
- Consistent with existing dashboard patterns
- Follow shadcn/ui component patterns
