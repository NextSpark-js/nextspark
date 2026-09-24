-- Migration: 094_posts_sample_data.sql
-- Description: Sample data for posts and taxonomies (categories)
-- Date: 2025-12-16
-- Updated: 2025-12-18 - Added 15 posts with post-content blocks for pagination testing

-- ============================================
-- SAMPLE TAXONOMIES (post_category type)
-- ============================================
INSERT INTO public.taxonomies (
  id, type, slug, name, description, icon, color, "order", "isDefault", "isActive"
) VALUES
  ('cat-technology', 'post_category', 'technology', 'Technology', 'Posts about technology, software, and development', 'cpu', '#3B82F6', 1, false, true),
  ('cat-tutorials', 'post_category', 'tutorials', 'Tutorials', 'Step-by-step guides and how-to articles', 'book-open', '#10B981', 2, false, true),
  ('cat-news', 'post_category', 'news', 'News', 'Latest news and announcements', 'newspaper', '#F59E0B', 3, true, true),
  ('cat-tips', 'post_category', 'tips-tricks', 'Tips & Tricks', 'Helpful tips and productivity hacks', 'lightbulb', '#8B5CF6', 4, false, true),
  ('cat-design', 'post_category', 'design', 'Design', 'UI/UX and graphic design', 'palette', '#EC4899', 5, false, true),
  ('cat-ai', 'post_category', 'inteligencia-artificial', 'Inteligencia Artificial', 'Posts about AI, machine learning and future technologies', 'brain', '#6366F1', 6, false, true),
  ('cat-saas', 'post_category', 'saas', 'SaaS', 'Software as a Service insights and strategies', 'cloud', '#14B8A6', 7, false, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE POSTS (15 posts for pagination)
-- All with post-content block only (no post-hero)
-- ============================================
INSERT INTO public.posts (
  id, "userId", "teamId", slug, title, excerpt, "featuredImage", blocks, locale, status
) VALUES
  -- Post 1: Welcome to Our Blog
  (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'welcome-to-our-blog',
    'Welcome to Our Blog',
    'Discover the latest insights, tutorials, and news from our team.',
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800',
    '[{"id":"content-1","blockSlug":"post-content","props":{"content":"<h2>Welcome to Everpoint Labs Blog</h2><p>We are excited to launch our new blog where we will share insights about technology, AI, and SaaS development. Stay tuned for regular updates!</p><p>Our team of experts will cover topics ranging from <strong>artificial intelligence</strong> to <strong>software architecture</strong> and everything in between.</p><h2>What to Expect</h2><ul><li>In-depth tutorials and guides</li><li>Industry news and analysis</li><li>Best practices and tips</li><li>Case studies from real projects</li></ul><p>Subscribe to our newsletter to never miss an update!</p>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 2: Getting Started with Next.js 15
  (
    'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'getting-started-with-nextjs',
    'Getting Started with Next.js 15',
    'Learn the fundamentals of Next.js 15 and build your first application.',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
    '[{"id":"content-2","blockSlug":"post-content","props":{"content":"<h2>Introduction to Next.js 15</h2><p>Next.js 15 brings exciting new features including improved performance, better developer experience, and enhanced server components.</p><h2>Key Features</h2><ul><li><strong>Turbopack</strong>: Lightning-fast bundler for development</li><li><strong>Server Actions</strong>: Simplified data mutations</li><li><strong>Partial Prerendering</strong>: Best of static and dynamic</li></ul><h2>Getting Started</h2><p>To create a new Next.js 15 project, run:</p><pre><code>npx create-next-app@latest my-app</code></pre><p>This will scaffold a new project with all the latest features enabled by default.</p>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 3: TypeScript Best Practices
  (
    'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'typescript-best-practices',
    'TypeScript Best Practices in 2025',
    'Master TypeScript with these proven patterns and practices.',
    'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800',
    '[{"id":"content-3","blockSlug":"post-content","props":{"content":"<h2>TypeScript Best Practices</h2><p>TypeScript has become the standard for large-scale JavaScript applications. Here are the best practices for 2025.</p><h2>1. Use Strict Mode</h2><p>Always enable strict mode in your tsconfig.json:</p><pre><code>{\"compilerOptions\": {\"strict\": true}}</code></pre><h2>2. Prefer Interfaces Over Types</h2><p>Use interfaces for object shapes and types for unions and primitives.</p><h2>3. Avoid Any</h2><p>The <code>any</code> type defeats the purpose of TypeScript. Use <code>unknown</code> when the type is truly unknown.</p>"}}]'::JSONB,
    'en',
    'draft'
  ),
  -- Post 4: El Futuro de la IA
  (
    'f82415da-56e9-4c15-a960-0a62a01b2274'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'futuro-inteligencia-artificial-2025',
    'El Futuro de la Inteligencia Artificial: Tendencias 2025',
    'Exploramos las tendencias más disruptivas en inteligencia artificial.',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
    '[{"id":"content-4","blockSlug":"post-content","props":{"content":"<h2>La Revolución de los Modelos Multimodales</h2><p>Los modelos de lenguaje han evolucionado más allá del texto. En 2025, los sistemas multimodales como GPT-4o y Claude pueden procesar imágenes, audio y video de manera nativa.</p><h2>Agentes Autónomos: El Próximo Salto</h2><p>Quizás la tendencia más transformadora es el surgimiento de <strong>agentes de IA autónomos</strong>. Estos agentes pueden:</p><ul><li>Planificar y ejecutar tareas complejas</li><li>Interactuar con APIs y herramientas externas</li><li>Tomar decisiones basadas en contexto</li></ul><blockquote><p>La IA no reemplazará a los programadores, pero los programadores que usen IA reemplazarán a los que no lo hagan.</p></blockquote>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 5: Building SaaS Products with AI
  (
    'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'building-saas-products-with-ai',
    'Building SaaS Products with AI Integration',
    'How to leverage AI to create competitive SaaS products in 2025.',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    '[{"id":"content-5","blockSlug":"post-content","props":{"content":"<h2>AI-Powered SaaS: The New Standard</h2><p>In 2025, SaaS products without AI capabilities are at a significant disadvantage. Users expect intelligent features that save time and provide insights.</p><h2>Key AI Features for SaaS</h2><ul><li><strong>Smart Search</strong>: Semantic search that understands intent</li><li><strong>Automated Workflows</strong>: AI-triggered actions based on patterns</li><li><strong>Predictive Analytics</strong>: Forecasting based on historical data</li><li><strong>Natural Language Interfaces</strong>: Chat-based interactions</li></ul><h2>Implementation Strategy</h2><p>Start with high-impact, low-complexity features. Use APIs from providers like OpenAI, Anthropic, or open-source models.</p>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 6: Microservices vs Monolith
  (
    'e5f6a7b8-c9d0-4e1f-a2b3-c4d5e6f7a8b9'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'microservices-vs-monolith-2025',
    'Microservices vs Monolith: What to Choose in 2025',
    'A practical guide to choosing the right architecture for your project.',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    '[{"id":"content-6","blockSlug":"post-content","props":{"content":"<h2>The Architecture Debate Continues</h2><p>The microservices vs monolith debate has evolved. In 2025, the answer is nuanced: it depends on your team size, scale, and complexity.</p><h2>When to Choose Monolith</h2><ul><li>Small teams (< 10 developers)</li><li>Early-stage startups</li><li>Simple domain logic</li><li>Need for rapid iteration</li></ul><h2>When to Choose Microservices</h2><ul><li>Large teams with clear domain boundaries</li><li>Need for independent scaling</li><li>Multiple programming languages required</li><li>Complex, evolving domains</li></ul><h2>The Middle Ground: Modular Monolith</h2><p>Consider starting with a modular monolith that can be split later if needed.</p>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 7: Claude API Deep Dive
  (
    'f6a7b8c9-d0e1-4f2a-b3c4-d5e6f7a8b9c0'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'claude-api-deep-dive',
    'Claude API Deep Dive: Building Intelligent Applications',
    'Everything you need to know about integrating Claude into your applications.',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800',
    '[{"id":"content-7","blockSlug":"post-content","props":{"content":"<h2>Introduction to Claude API</h2><p>Claude by Anthropic is one of the most capable AI assistants available. This guide covers everything from basic integration to advanced techniques.</p><h2>Getting Started</h2><pre><code>npm install @anthropic-ai/sdk</code></pre><h2>Basic Usage</h2><p>The Messages API is the primary way to interact with Claude:</p><pre><code>const response = await anthropic.messages.create({\n  model: \"claude-sonnet-4-20250514\",\n  max_tokens: 1024,\n  messages: [{role: \"user\", content: \"Hello!\"}]\n});</code></pre><h2>Best Practices</h2><ul><li>Use system prompts for consistent behavior</li><li>Implement streaming for better UX</li><li>Handle rate limits gracefully</li></ul>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 8: SaaS Pricing Strategies
  (
    'a7b8c9d0-e1f2-4a3b-c4d5-e6f7a8b9c0d1'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'saas-pricing-strategies-2025',
    'SaaS Pricing Strategies That Work in 2025',
    'Learn how to price your SaaS product for maximum growth and retention.',
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
    '[{"id":"content-8","blockSlug":"post-content","props":{"content":"<h2>The Art of SaaS Pricing</h2><p>Pricing is one of the most important decisions for a SaaS business. Get it wrong, and you leave money on the table or lose customers.</p><h2>Popular Pricing Models</h2><ul><li><strong>Per-seat</strong>: Scales with team size</li><li><strong>Usage-based</strong>: Pay for what you use</li><li><strong>Tiered</strong>: Good-better-best packages</li><li><strong>Hybrid</strong>: Combination of models</li></ul><h2>AI-Era Considerations</h2><p>With AI features, usage-based pricing is becoming more common due to the variable costs of API calls.</p><blockquote><p>Price based on value delivered, not cost incurred.</p></blockquote>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 9: React Server Components
  (
    'b8c9d0e1-f2a3-4b4c-d5e6-f7a8b9c0d1e2'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'react-server-components-explained',
    'React Server Components Explained',
    'Understanding the paradigm shift in React development.',
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    '[{"id":"content-9","blockSlug":"post-content","props":{"content":"<h2>What Are Server Components?</h2><p>React Server Components (RSC) represent a fundamental shift in how we build React applications. They run on the server and send only the rendered output to the client.</p><h2>Benefits</h2><ul><li><strong>Smaller bundles</strong>: Server-only code never reaches the client</li><li><strong>Direct backend access</strong>: Query databases without APIs</li><li><strong>Better performance</strong>: Less JavaScript to parse and execute</li></ul><h2>When to Use Client Components</h2><p>Use the \"use client\" directive when you need:</p><ul><li>Event handlers (onClick, onChange)</li><li>Browser APIs (localStorage, window)</li><li>React hooks (useState, useEffect)</li></ul>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 10: Database Design for SaaS
  (
    'c9d0e1f2-a3b4-4c5d-e6f7-a8b9c0d1e2f3'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'database-design-multi-tenant-saas',
    'Database Design for Multi-Tenant SaaS',
    'Best practices for designing scalable multi-tenant databases.',
    'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800',
    '[{"id":"content-10","blockSlug":"post-content","props":{"content":"<h2>Multi-Tenancy Approaches</h2><p>Choosing the right multi-tenancy strategy is crucial for SaaS applications. Here are the main approaches:</p><h2>1. Shared Database, Shared Schema</h2><p>All tenants share tables with a tenant_id column. Simple but requires careful RLS policies.</p><h2>2. Shared Database, Separate Schemas</h2><p>Each tenant gets their own schema. Better isolation but more complex migrations.</p><h2>3. Separate Databases</h2><p>Complete isolation but highest operational overhead.</p><h2>Row-Level Security</h2><p>PostgreSQL RLS is essential for shared schema approaches:</p><pre><code>CREATE POLICY tenant_isolation ON items\n  USING (tenant_id = current_setting(''app.tenant_id''));</code></pre>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 11: AI Agents Architecture
  (
    'd0e1f2a3-b4c5-4d6e-f7a8-b9c0d1e2f3a4'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'ai-agents-architecture-patterns',
    'AI Agents Architecture: Design Patterns for 2025',
    'How to design and build reliable AI agent systems.',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800',
    '[{"id":"content-11","blockSlug":"post-content","props":{"content":"<h2>The Rise of AI Agents</h2><p>AI agents are autonomous systems that can plan, reason, and execute tasks. Building reliable agents requires careful architecture.</p><h2>Core Components</h2><ul><li><strong>Planner</strong>: Breaks down goals into steps</li><li><strong>Executor</strong>: Runs individual actions</li><li><strong>Memory</strong>: Stores context and history</li><li><strong>Tools</strong>: External capabilities (APIs, code execution)</li></ul><h2>Design Patterns</h2><h3>ReAct Pattern</h3><p>Interleave reasoning and action: Think → Act → Observe → Repeat</p><h3>Plan-and-Execute</h3><p>Create full plan first, then execute sequentially.</p>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 12: Authentication Best Practices
  (
    'e1f2a3b4-c5d6-4e7f-a8b9-c0d1e2f3a4b5'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'authentication-best-practices-2025',
    'Authentication Best Practices for Modern Web Apps',
    'Secure your applications with these proven authentication strategies.',
    'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800',
    '[{"id":"content-12","blockSlug":"post-content","props":{"content":"<h2>Authentication in 2025</h2><p>Security threats evolve constantly. Here are the current best practices for authentication.</p><h2>Key Recommendations</h2><ul><li><strong>Use established libraries</strong>: Better Auth, Auth.js, Clerk</li><li><strong>Implement MFA</strong>: SMS is weak, use TOTP or passkeys</li><li><strong>Secure sessions</strong>: HttpOnly cookies, short expiration</li><li><strong>Rate limiting</strong>: Prevent brute force attacks</li></ul><h2>Passkeys: The Future</h2><p>Passkeys eliminate passwords entirely using public-key cryptography. They are phishing-resistant and more user-friendly.</p>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 13: Prompt Engineering
  (
    'f2a3b4c5-d6e7-4f8a-b9c0-d1e2f3a4b5c6'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'prompt-engineering-advanced-techniques',
    'Advanced Prompt Engineering Techniques',
    'Master the art of crafting effective prompts for AI models.',
    'https://images.unsplash.com/photo-1676299081847-824916de030a?w=800',
    '[{"id":"content-13","blockSlug":"post-content","props":{"content":"<h2>Beyond Basic Prompting</h2><p>Effective prompt engineering can dramatically improve AI output quality. Here are advanced techniques.</p><h2>Techniques</h2><h3>Chain of Thought</h3><p>Ask the model to think step by step before answering.</p><h3>Few-Shot Learning</h3><p>Provide examples of desired input-output pairs.</p><h3>Role Prompting</h3><p>Assign a specific persona or expertise to the model.</p><h2>System Prompts</h2><p>Use system prompts to establish consistent behavior:</p><pre><code>You are an expert software architect. Always consider scalability, security, and maintainability in your recommendations.</code></pre>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 14: Monitoring SaaS Applications
  (
    'a3b4c5d6-e7f8-4a9b-c0d1-e2f3a4b5c6d7'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'monitoring-saas-applications',
    'Monitoring SaaS Applications: A Complete Guide',
    'Set up comprehensive monitoring for your SaaS product.',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    '[{"id":"content-14","blockSlug":"post-content","props":{"content":"<h2>Why Monitoring Matters</h2><p>In SaaS, downtime directly impacts revenue and customer trust. Comprehensive monitoring is essential.</p><h2>The Four Golden Signals</h2><ul><li><strong>Latency</strong>: Time to serve requests</li><li><strong>Traffic</strong>: Request volume</li><li><strong>Errors</strong>: Rate of failed requests</li><li><strong>Saturation</strong>: Resource utilization</li></ul><h2>Recommended Stack</h2><ul><li><strong>Metrics</strong>: Prometheus + Grafana</li><li><strong>Logs</strong>: Loki or DataDog</li><li><strong>Traces</strong>: OpenTelemetry</li><li><strong>Alerts</strong>: PagerDuty or OpsGenie</li></ul>"}}]'::JSONB,
    'en',
    'published'
  ),
  -- Post 15: Future of SaaS in AI Era
  (
    'b4c5d6e7-f8a9-4b0c-d1e2-f3a4b5c6d7e8'::UUID,
    'usr-carlos-001',
    'team-everpoint-001',
    'future-of-saas-ai-era',
    'The Future of SaaS in the AI Era',
    'How AI is reshaping the SaaS landscape and what it means for founders.',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    '[{"id":"content-15","blockSlug":"post-content","props":{"content":"<h2>SaaS is Evolving</h2><p>The traditional SaaS model is being disrupted by AI. Products that once required dozens of features can now be replaced by a well-prompted AI agent.</p><h2>Emerging Trends</h2><ul><li><strong>AI-Native Products</strong>: Built around AI from day one</li><li><strong>Vertical AI</strong>: Deep expertise in specific domains</li><li><strong>Agent Marketplaces</strong>: Ecosystems of specialized AI agents</li><li><strong>Usage-Based Pricing</strong>: Pay per AI operation</li></ul><h2>Opportunities for Founders</h2><p>The barrier to entry has lowered, but the bar for quality has risen. Success requires:</p><ul><li>Deep domain expertise</li><li>Excellent user experience</li><li>Reliable, fast AI infrastructure</li></ul><blockquote><p>The next unicorns will be AI-native SaaS companies built by small teams.</p></blockquote>"}}]'::JSONB,
    'en',
    'published'
  )
ON CONFLICT (id) DO UPDATE SET
  blocks = EXCLUDED.blocks,
  excerpt = EXCLUDED.excerpt,
  "featuredImage" = EXCLUDED."featuredImage";

-- ============================================
-- SAMPLE POST-TAXONOMY RELATIONS
-- Using generic entity_taxonomy_relations table
-- ============================================
INSERT INTO public.entity_taxonomy_relations ("entityType", "entityId", "taxonomyId", "order")
VALUES
  -- Post 1: Welcome
  ('posts', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'cat-news', 1),
  -- Post 2: Next.js
  ('posts', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'cat-tutorials', 1),
  ('posts', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'cat-technology', 2),
  -- Post 3: TypeScript
  ('posts', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cat-technology', 1),
  ('posts', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cat-tips', 2),
  -- Post 4: AI Future
  ('posts', 'f82415da-56e9-4c15-a960-0a62a01b2274', 'cat-ai', 1),
  ('posts', 'f82415da-56e9-4c15-a960-0a62a01b2274', 'cat-technology', 2),
  -- Post 5: SaaS + AI
  ('posts', 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70', 'cat-saas', 1),
  ('posts', 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70', 'cat-ai', 2),
  -- Post 6: Architecture
  ('posts', 'e5f6a7b8-c9d0-4e1f-a2b3-c4d5e6f7a8b9', 'cat-technology', 1),
  ('posts', 'e5f6a7b8-c9d0-4e1f-a2b3-c4d5e6f7a8b9', 'cat-tips', 2),
  -- Post 7: Claude API
  ('posts', 'f6a7b8c9-d0e1-4f2a-b3c4-d5e6f7a8b9c0', 'cat-ai', 1),
  ('posts', 'f6a7b8c9-d0e1-4f2a-b3c4-d5e6f7a8b9c0', 'cat-tutorials', 2),
  -- Post 8: SaaS Pricing
  ('posts', 'a7b8c9d0-e1f2-4a3b-c4d5-e6f7a8b9c0d1', 'cat-saas', 1),
  ('posts', 'a7b8c9d0-e1f2-4a3b-c4d5-e6f7a8b9c0d1', 'cat-tips', 2),
  -- Post 9: RSC
  ('posts', 'b8c9d0e1-f2a3-4b4c-d5e6-f7a8b9c0d1e2', 'cat-technology', 1),
  ('posts', 'b8c9d0e1-f2a3-4b4c-d5e6-f7a8b9c0d1e2', 'cat-tutorials', 2),
  -- Post 10: Database
  ('posts', 'c9d0e1f2-a3b4-4c5d-e6f7-a8b9c0d1e2f3', 'cat-saas', 1),
  ('posts', 'c9d0e1f2-a3b4-4c5d-e6f7-a8b9c0d1e2f3', 'cat-technology', 2),
  -- Post 11: AI Agents
  ('posts', 'd0e1f2a3-b4c5-4d6e-f7a8-b9c0d1e2f3a4', 'cat-ai', 1),
  ('posts', 'd0e1f2a3-b4c5-4d6e-f7a8-b9c0d1e2f3a4', 'cat-technology', 2),
  -- Post 12: Auth
  ('posts', 'e1f2a3b4-c5d6-4e7f-a8b9-c0d1e2f3a4b5', 'cat-technology', 1),
  ('posts', 'e1f2a3b4-c5d6-4e7f-a8b9-c0d1e2f3a4b5', 'cat-tips', 2),
  -- Post 13: Prompt Engineering
  ('posts', 'f2a3b4c5-d6e7-4f8a-b9c0-d1e2f3a4b5c6', 'cat-ai', 1),
  ('posts', 'f2a3b4c5-d6e7-4f8a-b9c0-d1e2f3a4b5c6', 'cat-tutorials', 2),
  -- Post 14: Monitoring
  ('posts', 'a3b4c5d6-e7f8-4a9b-c0d1-e2f3a4b5c6d7', 'cat-saas', 1),
  ('posts', 'a3b4c5d6-e7f8-4a9b-c0d1-e2f3a4b5c6d7', 'cat-technology', 2),
  -- Post 15: Future SaaS
  ('posts', 'b4c5d6e7-f8a9-4b0c-d1e2-f3a4b5c6d7e8', 'cat-saas', 1),
  ('posts', 'b4c5d6e7-f8a9-4b0c-d1e2-f3a4b5c6d7e8', 'cat-ai', 2)
ON CONFLICT ("entityType", "entityId", "taxonomyId") DO NOTHING;
