# Plan de Implementación del Sistema CRM

## Estado: EN DESARROLLO
## Fecha: 2025-09-27

## Entidades del CRM (9 entidades fundamentales)

### 1. LEADS
**Descripción**: Prospectos potenciales que aún no son clientes
**Tabla**: `leads`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who owns this lead
- `companyName` (TEXT) - Company name
- `contactName` (TEXT) - Contact person name
- `email` (TEXT) - Email address
- `phone` (TEXT) - Phone number
- `website` (TEXT) - Company website
- `source` (TEXT) - Lead source (web, referral, cold_call, trade_show, social_media)
- `status` (TEXT) - Lead status (new, contacted, qualified, proposal, negotiation, converted, lost)
- `score` (INTEGER) - Lead score (0-100)
- `industry` (TEXT) - Industry sector
- `companySize` (TEXT) - Company size (1-10, 11-50, 51-200, 201-500, 500+)
- `budget` (DECIMAL) - Estimated budget
- `assignedTo` (TEXT) - User ID of assigned sales rep
- `convertedDate` (TIMESTAMPTZ) - Date when lead was converted
- `convertedToContactId` (TEXT) - Reference to contact if converted
- `convertedToCompanyId` (TEXT) - Reference to company if converted
- `notes` (TEXT) - Internal notes
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

### 2. CONTACTS
**Descripción**: Personas de contacto en las empresas
**Tabla**: `contacts`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who owns this contact
- `companyId` (TEXT) - Reference to companies table (nullable for standalone contacts)
- `firstName` (TEXT) - First name
- `lastName` (TEXT) - Last name
- `email` (TEXT) - Email address
- `phone` (TEXT) - Phone number
- `mobile` (TEXT) - Mobile phone
- `position` (TEXT) - Job position/title
- `department` (TEXT) - Department
- `isPrimary` (BOOLEAN) - Is primary contact for company
- `birthDate` (DATE) - Birth date
- `linkedin` (TEXT) - LinkedIn profile URL
- `twitter` (TEXT) - Twitter handle
- `preferredChannel` (TEXT) - Preferred contact channel (email, phone, whatsapp, linkedin)
- `timezone` (TEXT) - Contact's timezone
- `lastContactedAt` (TIMESTAMPTZ) - Last contact date
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

### 3. COMPANIES
**Descripción**: Empresas clientes o prospectos
**Tabla**: `companies`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who owns this company
- `name` (TEXT) - Company name
- `legalName` (TEXT) - Legal company name
- `taxId` (TEXT) - Tax identification number
- `website` (TEXT) - Company website
- `email` (TEXT) - General company email
- `phone` (TEXT) - Main phone number
- `industry` (TEXT) - Industry sector
- `type` (TEXT) - Company type (prospect, customer, partner, competitor)
- `size` (TEXT) - Company size (1-10, 11-50, 51-200, 201-500, 500+)
- `annualRevenue` (DECIMAL) - Annual revenue
- `address` (TEXT) - Street address
- `city` (TEXT) - City
- `state` (TEXT) - State/Province
- `country` (TEXT) - Country
- `postalCode` (TEXT) - Postal/ZIP code
- `logo` (TEXT) - Logo URL
- `linkedin` (TEXT) - LinkedIn company page
- `facebook` (TEXT) - Facebook page
- `twitter` (TEXT) - Twitter handle
- `rating` (TEXT) - Company rating (hot, warm, cold)
- `assignedTo` (TEXT) - User ID of account manager
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

### 4. OPPORTUNITIES
**Descripción**: Oportunidades de venta
**Tabla**: `opportunities`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who owns this opportunity
- `name` (TEXT) - Opportunity name
- `companyId` (TEXT) - Reference to companies table
- `contactId` (TEXT) - Primary contact for this opportunity
- `pipelineId` (TEXT) - Reference to pipelines table
- `stageId` (TEXT) - Current stage in pipeline
- `amount` (DECIMAL) - Deal amount
- `currency` (TEXT) - Currency code (USD, EUR, MXN)
- `probability` (INTEGER) - Win probability (0-100)
- `expectedRevenue` (DECIMAL) - amount * (probability/100)
- `closeDate` (DATE) - Expected close date
- `type` (TEXT) - Opportunity type (new_business, existing_business, renewal)
- `source` (TEXT) - Lead source
- `competitor` (TEXT) - Main competitor
- `status` (TEXT) - Status (open, won, lost)
- `lostReason` (TEXT) - Reason if lost
- `wonDate` (DATE) - Date when won
- `lostDate` (DATE) - Date when lost
- `assignedTo` (TEXT) - User ID of sales rep
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

### 5. ACTIVITIES
**Descripción**: Actividades y tareas relacionadas con CRM
**Tabla**: `activities`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who owns this activity
- `type` (TEXT) - Activity type (call, email, meeting, task, note)
- `subject` (TEXT) - Activity subject/title
- `description` (TEXT) - Detailed description
- `status` (TEXT) - Status (scheduled, completed, cancelled)
- `priority` (TEXT) - Priority (low, medium, high, urgent)
- `dueDate` (TIMESTAMPTZ) - Due date/time
- `completedAt` (TIMESTAMPTZ) - Completion date/time
- `duration` (INTEGER) - Duration in minutes
- `outcome` (TEXT) - Activity outcome/result
- `location` (TEXT) - Location (for meetings)
- `entityType` (TEXT) - Related entity type (lead, contact, company, opportunity)
- `entityId` (TEXT) - Related entity ID
- `contactId` (TEXT) - Related contact (optional)
- `companyId` (TEXT) - Related company (optional)
- `opportunityId` (TEXT) - Related opportunity (optional)
- `assignedTo` (TEXT) - User ID assigned to
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

### 6. CAMPAIGNS
**Descripción**: Campañas de marketing
**Tabla**: `campaigns`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who owns this campaign
- `name` (TEXT) - Campaign name
- `type` (TEXT) - Campaign type (email, social, event, webinar, advertising, content)
- `status` (TEXT) - Status (planned, active, paused, completed, cancelled)
- `objective` (TEXT) - Campaign objective
- `description` (TEXT) - Detailed description
- `startDate` (DATE) - Start date
- `endDate` (DATE) - End date
- `budget` (DECIMAL) - Campaign budget
- `actualCost` (DECIMAL) - Actual cost spent
- `targetAudience` (TEXT) - Target audience description
- `targetLeads` (INTEGER) - Target number of leads
- `actualLeads` (INTEGER) - Actual leads generated
- `targetRevenue` (DECIMAL) - Target revenue
- `actualRevenue` (DECIMAL) - Actual revenue generated
- `roi` (DECIMAL) - Return on investment percentage
- `channel` (TEXT) - Main channel (email, social_media, web, print, tv, radio)
- `assignedTo` (TEXT) - User ID of campaign manager
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

### 7. NOTES
**Descripción**: Notas y comentarios
**Tabla**: `notes`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who created this note
- `title` (TEXT) - Note title
- `content` (TEXT) - Note content
- `type` (TEXT) - Note type (general, call, meeting, email, followup)
- `isPinned` (BOOLEAN) - Is pinned/important
- `isPrivate` (BOOLEAN) - Is private to creator
- `entityType` (TEXT) - Related entity type (lead, contact, company, opportunity, campaign)
- `entityId` (TEXT) - Related entity ID
- `contactId` (TEXT) - Related contact (optional)
- `companyId` (TEXT) - Related company (optional)
- `opportunityId` (TEXT) - Related opportunity (optional)
- `attachments` (JSONB) - Array of attachment URLs
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

### 8. PRODUCTS
**Descripción**: Productos o servicios que se venden
**Tabla**: `products`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who owns this product
- `code` (TEXT) - Product code/SKU
- `name` (TEXT) - Product name
- `category` (TEXT) - Product category
- `type` (TEXT) - Type (product, service, subscription)
- `description` (TEXT) - Product description
- `features` (JSONB) - Array of product features
- `price` (DECIMAL) - Standard price
- `cost` (DECIMAL) - Product cost
- `currency` (TEXT) - Currency code
- `unit` (TEXT) - Unit of measure (piece, hour, month, year)
- `isActive` (BOOLEAN) - Is currently active
- `image` (TEXT) - Product image URL
- `brochureUrl` (TEXT) - Product brochure URL
- `minimumQuantity` (INTEGER) - Minimum order quantity
- `commissionRate` (DECIMAL) - Sales commission percentage
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

### 9. PIPELINES
**Descripción**: Pipelines de ventas con sus etapas
**Tabla**: `pipelines`
**Campos**:
- `id` (TEXT/UUID) - Primary key
- `userId` (TEXT) - User who owns this pipeline
- `name` (TEXT) - Pipeline name
- `description` (TEXT) - Pipeline description
- `type` (TEXT) - Pipeline type (sales, support, project)
- `isDefault` (BOOLEAN) - Is default pipeline
- `isActive` (BOOLEAN) - Is currently active
- `stages` (JSONB) - Array of stages with order, name, probability
  ```json
  [
    {"order": 1, "name": "Qualification", "probability": 10, "color": "#3B82F6"},
    {"order": 2, "name": "Needs Analysis", "probability": 25, "color": "#10B981"},
    {"order": 3, "name": "Proposal", "probability": 50, "color": "#F59E0B"},
    {"order": 4, "name": "Negotiation", "probability": 75, "color": "#8B5CF6"},
    {"order": 5, "name": "Closed Won", "probability": 100, "color": "#059669"},
    {"order": 6, "name": "Closed Lost", "probability": 0, "color": "#EF4444"}
  ]
  ```
- `dealRottenDays` (INTEGER) - Days until deal is considered rotten
- `createdAt` (TIMESTAMPTZ)
- `updatedAt` (TIMESTAMPTZ)

## Relaciones entre Entidades

### Conversión Lead → Contact/Company
- `leads.convertedToContactId` → `contacts.id`
- `leads.convertedToCompanyId` → `companies.id`

### Relaciones de Contacts
- `contacts.companyId` → `companies.id`

### Relaciones de Opportunities
- `opportunities.companyId` → `companies.id`
- `opportunities.contactId` → `contacts.id`
- `opportunities.pipelineId` → `pipelines.id`

### Relaciones de Activities
- Polimórfica vía `entityType` y `entityId`
- Referencias opcionales directas:
  - `activities.contactId` → `contacts.id`
  - `activities.companyId` → `companies.id`
  - `activities.opportunityId` → `opportunities.id`

### Relaciones de Notes
- Polimórfica vía `entityType` y `entityId`
- Referencias opcionales directas:
  - `notes.contactId` → `contacts.id`
  - `notes.companyId` → `companies.id`
  - `notes.opportunityId` → `opportunities.id`

### Relaciones de Campaign
- Las campañas pueden generar leads
- Tracking vía activities y notes

## Consideraciones de Implementación

### Seguridad y Permisos
- Todas las tablas tienen `userId` para aislamiento multi-tenant
- RLS (Row Level Security) habilitado en todas las tablas
- Políticas por rol: admin, sales, marketing, viewer

### Metadatos
- Todas las entidades soportan tabla `{entity}_metas`
- Estructura estándar: `entityId`, `metaKey`, `metaValue`

### Índices Recomendados
- Por `userId` en todas las tablas
- Por campos de búsqueda frecuente (email, phone, name)
- Por foreign keys para JOINs eficientes
- Por fechas para ordenamiento temporal

### Validaciones
- Emails únicos por usuario en leads y contacts
- Phone con formato internacional
- Enums para campos de estado y tipo
- Probabilidades entre 0-100
- Montos y costos >= 0

## Timeline de Implementación

### Fase 1: Estructura Base (Actual)
1. ✅ Leads (parcialmente creado)
2. ⏳ Contacts
3. ⏳ Companies
4. ⏳ Pipelines

### Fase 2: Funcionalidad Core
5. ⏳ Opportunities
6. ⏳ Activities
7. ⏳ Notes

### Fase 3: Extensiones
8. ⏳ Products
9. ⏳ Campaigns

### Fase 4: Sample Data
- Crear datos relacionados coherentes
- 10 leads, 5 convertidos a contacts/companies
- 20 contacts distribuidos en 8 companies
- 15 opportunities en diferentes stages
- 50+ activities variadas
- 5 campaigns con resultados
- 30+ notes
- 10 products
- 2 pipelines (Sales, Support)

## Notas de Desarrollo

### Convenciones
- Tablas en plural: `leads`, `contacts`, `companies`
- Foreign keys genéricas: `entityId` en metas
- Timestamps: `createdAt`, `updatedAt`
- IDs como TEXT (UUID convertido)
- camelCase para campos (compatibilidad con JS/TS)

### Performance
- JSONB para datos estructurados variables (stages, features, attachments)
- Índices GIN para búsquedas en JSONB
- Vistas materializadas para dashboards
- Particionamiento por fecha para activities (futuro)

### Integración
- API REST v1 automática para todas las entidades
- GraphQL opcional via Hasura
- Webhooks para eventos importantes
- Bulk operations para imports/exports

## Estado Actual: EN DESARROLLO

Creado: 2025-09-27
Actualizado: 2025-09-27