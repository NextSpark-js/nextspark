/**
 * Template Gallery Data
 *
 * Categorized project templates that pre-fill the AI prompt.
 * Each template provides a rich description for the AI to generate a complete project.
 */

export type TemplateCategory = 'crm' | 'blog' | 'saas' | 'commerce' | 'internal-tools'

export interface Template {
  id: string
  title: string
  description: string
  prompt: string
  category: TemplateCategory
  icon: string
  tags: string[]
  color: string
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; color: string }[] = [
  { id: 'crm', label: 'CRM', color: 'blue' },
  { id: 'blog', label: 'Blog & Portfolio', color: 'purple' },
  { id: 'saas', label: 'SaaS', color: 'emerald' },
  { id: 'commerce', label: 'Commerce', color: 'amber' },
  { id: 'internal-tools', label: 'Internal Tools', color: 'rose' },
]

export const TEMPLATES: Template[] = [
  // ── CRM ──
  {
    id: 'gym-crm',
    title: 'Gym CRM',
    description: 'Manage members, memberships, classes, and payment tracking for a fitness center.',
    prompt: 'A CRM for my gym with clients, memberships (monthly/annual plans), class schedules, trainer assignments, and payment tracking. Include a dashboard with active members count, revenue stats, and expiring memberships alerts.',
    category: 'crm',
    icon: 'Dumbbell',
    tags: ['fitness', 'members', 'payments'],
    color: 'blue',
  },
  {
    id: 'real-estate-crm',
    title: 'Real Estate CRM',
    description: 'Track properties, leads, viewings, and deals for a real estate agency.',
    prompt: 'A real estate CRM to manage properties (for sale and rent), leads/contacts, property viewings, offers, and deals. Include property status tracking (available, under offer, sold), agent assignments, and a dashboard with pipeline value and recent activity.',
    category: 'crm',
    icon: 'Building2',
    tags: ['properties', 'leads', 'deals'],
    color: 'blue',
  },
  {
    id: 'recruitment-agency',
    title: 'Recruitment Agency',
    description: 'Manage candidates, job positions, interviews, and placement pipeline.',
    prompt: 'A recruitment agency CRM with candidates (profiles, skills, resume), job positions (company, role, salary range), applications, interview scheduling, and placement tracking. Include pipeline stages (applied, screening, interview, offer, placed) and a dashboard with open positions and placement rate.',
    category: 'crm',
    icon: 'Users',
    tags: ['candidates', 'jobs', 'interviews'],
    color: 'blue',
  },

  // ── Blog & Portfolio ──
  {
    id: 'photography-portfolio',
    title: 'Photography Portfolio',
    description: 'Showcase galleries, projects, and client bookings for a photographer.',
    prompt: 'A photography portfolio with galleries organized by category (wedding, portrait, landscape), individual photo projects with descriptions, a client booking form, testimonials section, and an about/bio page. Include a hero section with featured work.',
    category: 'blog',
    icon: 'Camera',
    tags: ['portfolio', 'galleries', 'bookings'],
    color: 'purple',
  },
  {
    id: 'tech-blog',
    title: 'Tech Blog',
    description: 'A developer blog with articles, categories, tags, and code snippets.',
    prompt: 'A tech blog platform with articles (title, content, featured image), categories and tags, author profiles, code syntax highlighting, estimated reading time, and a newsletter subscription. Include a landing page with featured posts and a category archive.',
    category: 'blog',
    icon: 'Code2',
    tags: ['articles', 'categories', 'newsletter'],
    color: 'purple',
  },
  {
    id: 'recipe-blog',
    title: 'Recipe Blog',
    description: 'Share recipes with ingredients, instructions, and nutritional info.',
    prompt: 'A recipe blog with recipes (title, description, ingredients list, step-by-step instructions, prep/cook time, servings, difficulty level), categories (breakfast, lunch, dinner, dessert), dietary tags (vegan, gluten-free), and user ratings. Include a hero page with featured recipes.',
    category: 'blog',
    icon: 'ChefHat',
    tags: ['recipes', 'ingredients', 'categories'],
    color: 'purple',
  },

  // ── SaaS ──
  {
    id: 'project-management',
    title: 'Project Management',
    description: 'Manage projects, tasks, team members, and deadlines with Kanban boards.',
    prompt: 'A project management tool with projects, tasks (title, description, priority, status, due date, assignee), team member management, task comments, and time tracking. Task statuses: backlog, todo, in-progress, review, done. Include a dashboard with task distribution and upcoming deadlines.',
    category: 'saas',
    icon: 'KanbanSquare',
    tags: ['projects', 'tasks', 'teams'],
    color: 'emerald',
  },
  {
    id: 'invoice-platform',
    title: 'Invoice Platform',
    description: 'Create and track invoices, clients, and payment status.',
    prompt: 'An invoicing platform with clients (name, email, company, address), invoices (number, items, quantities, prices, tax, total, due date, status), payment tracking (paid, pending, overdue), and PDF export. Include a dashboard with revenue overview, outstanding amounts, and recent invoices.',
    category: 'saas',
    icon: 'Receipt',
    tags: ['invoices', 'clients', 'payments'],
    color: 'emerald',
  },
  {
    id: 'booking-system',
    title: 'Booking System',
    description: 'Appointment scheduling with services, providers, and time slots.',
    prompt: 'A booking/appointment system with services (name, duration, price), service providers (name, availability, specialties), appointments (date, time, client, service, provider, status), and client management. Include a calendar view and a dashboard with upcoming appointments and daily schedule.',
    category: 'saas',
    icon: 'CalendarCheck',
    tags: ['appointments', 'services', 'calendar'],
    color: 'emerald',
  },

  // ── Commerce ──
  {
    id: 'product-catalog',
    title: 'Product Catalog',
    description: 'Manage products with categories, variants, pricing, and inventory.',
    prompt: 'A product catalog with products (name, description, SKU, price, images, category), product categories, inventory tracking (stock levels, low-stock alerts), and product variants (size, color). Include a public catalog page with search and filtering, and a dashboard with inventory stats.',
    category: 'commerce',
    icon: 'ShoppingBag',
    tags: ['products', 'inventory', 'categories'],
    color: 'amber',
  },
  {
    id: 'order-tracker',
    title: 'Order Tracker',
    description: 'Track customer orders, shipping status, and fulfillment pipeline.',
    prompt: 'An order tracking system with customers, orders (items, quantities, total, payment status, shipping address), order statuses (pending, processing, shipped, delivered, cancelled), and shipping tracking. Include a dashboard with order volume, fulfillment rate, and revenue.',
    category: 'commerce',
    icon: 'Truck',
    tags: ['orders', 'shipping', 'customers'],
    color: 'amber',
  },
  {
    id: 'inventory-manager',
    title: 'Inventory Manager',
    description: 'Warehouse inventory with stock levels, suppliers, and purchase orders.',
    prompt: 'An inventory management system with products (name, SKU, category, unit cost, selling price), suppliers (name, contact, lead time), stock locations/warehouses, stock movements (in/out), purchase orders, and low-stock alerts. Include a dashboard with stock value, items below reorder point, and recent movements.',
    category: 'commerce',
    icon: 'Warehouse',
    tags: ['stock', 'suppliers', 'warehouse'],
    color: 'amber',
  },

  // ── Internal Tools ──
  {
    id: 'employee-directory',
    title: 'Employee Directory',
    description: 'Company directory with departments, roles, and contact info.',
    prompt: 'An employee directory with employees (name, email, phone, department, role, hire date, manager), departments (name, head, description), office locations, and an org chart view. Include a search page with filters by department and role, and a dashboard with headcount by department.',
    category: 'internal-tools',
    icon: 'Contact',
    tags: ['employees', 'departments', 'directory'],
    color: 'rose',
  },
  {
    id: 'it-ticketing',
    title: 'IT Ticketing',
    description: 'IT support tickets with categories, priorities, and SLA tracking.',
    prompt: 'An IT ticketing system with tickets (title, description, category, priority, status, assignee, requester), categories (hardware, software, network, access), priority levels (low, medium, high, critical), SLA timers, and ticket comments/history. Include a dashboard with open tickets, average resolution time, and tickets by category.',
    category: 'internal-tools',
    icon: 'Headphones',
    tags: ['tickets', 'support', 'SLA'],
    color: 'rose',
  },
  {
    id: 'expense-tracker',
    title: 'Expense Tracker',
    description: 'Track team expenses, approvals, and budget allocation.',
    prompt: 'An expense tracking tool with expenses (amount, category, description, date, receipt image, status), expense categories (travel, meals, supplies, software), approval workflow (submitted, approved, rejected, reimbursed), and budget limits per category. Include a dashboard with monthly spending, budget utilization, and pending approvals.',
    category: 'internal-tools',
    icon: 'Wallet',
    tags: ['expenses', 'approvals', 'budgets'],
    color: 'rose',
  },
]

/**
 * Get templates filtered by category
 */
export function getTemplatesByCategory(category: TemplateCategory): Template[] {
  return TEMPLATES.filter(t => t.category === category)
}

/**
 * Search templates by query string (matches title, description, and tags)
 */
export function searchTemplates(query: string): Template[] {
  const q = query.toLowerCase().trim()
  if (!q) return TEMPLATES

  return TEMPLATES.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q))
  )
}

/**
 * Get a single template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id)
}
