# CRM Theme - Permissions Matrix

## Teams Mode: `single-tenant`

One work team created at signup. Owner can invite multiple members.

## Roles

| Role | Description |
|------|-------------|
| owner | CRM Administrator - full control |
| admin | Sales/Marketing Manager - team management + reports |
| member | Sales/Marketing Rep - daily operations |
| viewer | Read-only access to CRM data |

---

## Entity Permissions

### Leads

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ | ❌ |
| assign | ✅ | ✅ | ❌ | ❌ |
| import | ✅ | ✅ | ❌ | ❌ |
| export | ✅ | ✅ | ❌ | ❌ |
| convert | ✅ | ✅ | ✅ | ❌ |

### Contacts

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ | ❌ |
| import | ✅ | ✅ | ❌ | ❌ |
| export | ✅ | ✅ | ❌ | ❌ |

### Companies

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ | ❌ |
| import | ✅ | ✅ | ❌ | ❌ |
| export | ✅ | ✅ | ❌ | ❌ |

### Opportunities

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ | ❌ |
| assign | ✅ | ✅ | ❌ | ❌ |
| import | ✅ | ✅ | ❌ | ❌ |
| export | ✅ | ✅ | ❌ | ❌ |
| move_stage | ✅ | ✅ | ✅ | ❌ |
| close | ✅ | ✅ | ✅ | ❌ |

### Activities

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ✅ | ❌ |
| assign | ✅ | ✅ | ❌ | ❌ |
| complete | ✅ | ✅ | ✅ | ❌ |

### Notes

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ✅ | ❌ |

> Note: Private notes (`isPrivate: true`) are only visible to their creator.

### Campaigns

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ✅ | ❌ |
| launch | ✅ | ✅ | ❌ | ❌ |
| pause | ✅ | ✅ | ❌ | ❌ |

### Pipelines (Configuration)

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ❌ | ❌ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ❌ | ❌ | ❌ |
| delete | ✅ | ❌ | ❌ | ❌ |

### Products (Configuration)

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| create | ✅ | ❌ | ❌ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ❌ | ❌ | ❌ |
| delete | ✅ | ❌ | ❌ | ❌ |

---

## Theme Features

| Feature | owner | admin | member | viewer | Description |
|---------|-------|-------|--------|--------|-------------|
| `reports.sales` | ✅ | ✅ | ❌ | ❌ | Sales performance reports |
| `reports.marketing` | ✅ | ✅ | ❌ | ❌ | Marketing campaign reports |
| `reports.pipeline` | ✅ | ✅ | ❌ | ❌ | Pipeline analysis |
| `reports.export` | ✅ | ✅ | ❌ | ❌ | Export reports |
| `dashboard.forecasting` | ✅ | ✅ | ❌ | ❌ | Sales forecasting |
| `dashboard.team_metrics` | ✅ | ✅ | ❌ | ❌ | Team performance KPIs |
| `bulk.import` | ✅ | ✅ | ❌ | ❌ | Bulk data import |
| `bulk.export` | ✅ | ✅ | ❌ | ❌ | Bulk data export |
| `leads.convert` | ✅ | ✅ | ✅ | ❌ | Convert leads to contacts |
| `settings.pipelines` | ✅ | ❌ | ❌ | ❌ | Pipeline configuration |
| `settings.products` | ✅ | ❌ | ❌ | ❌ | Product catalog management |

---

## Team Permissions

| Permission | owner | admin | member | viewer |
|------------|-------|-------|--------|--------|
| `teams.invite` | ✅ | ✅ | ❌ | ❌ |
| `teams.remove_member` | ✅ | ✅ | ❌ | ❌ |
| `teams.change_roles` | ✅ | ❌ | ❌ | ❌ |
| `teams.settings` | ✅ | ❌ | ❌ | ❌ |

---

## Disabled Core Permissions

- `teams.delete` - Cannot delete organization in single-tenant mode

---

## Test Scenarios

### Owner (CRM Administrator)

1. ✅ Full CRUD on all entities
2. ✅ Can assign leads/opportunities
3. ✅ Can convert leads
4. ✅ Can access all reports
5. ✅ Can see forecasting and team metrics
6. ✅ Can bulk import/export
7. ✅ Can manage pipelines and products
8. ✅ Can invite all roles (admin, member, viewer)
9. ✅ Can remove any member
10. ✅ Can change member roles

### Admin (Manager)

1. ✅ Full CRUD on operational entities (leads, contacts, companies, opportunities)
2. ✅ Can assign leads/opportunities
3. ✅ Can convert leads
4. ✅ Can access all reports
5. ✅ Can see forecasting and team metrics
6. ✅ Can bulk import/export
7. ❌ Cannot manage pipelines
8. ❌ Cannot manage products
9. ✅ Can invite members and viewers
10. ✅ Can remove members and viewers
11. ❌ Cannot change roles

### Member (Representative)

1. ✅ Can create/update on operational entities
2. ❌ Cannot delete leads, contacts, companies, opportunities
3. ✅ Can delete own activities, notes, campaigns
4. ✅ Can convert leads
5. ❌ Cannot assign leads/opportunities
6. ❌ Cannot access reports
7. ❌ Cannot see forecasting
8. ❌ Cannot bulk import/export
9. ❌ Cannot manage pipelines/products
10. ❌ Cannot invite members

### Viewer

1. ❌ Cannot create anything
2. ✅ Can view all entities
3. ❌ Cannot update anything
4. ❌ Cannot delete anything
5. ❌ Cannot access reports
6. ❌ Cannot see forecasting

