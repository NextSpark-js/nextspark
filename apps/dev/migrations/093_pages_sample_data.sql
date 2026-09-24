-- Migration: 093_pages_sample_data.sql
-- Description: Sample pages for NextSpark website showcasing all blocks
-- Date: 2025-01-25
-- Updated: 2025-12-17 - Complete rewrite with all block types

-- =====================================================
-- HOME PAGE - Landing page with hero, features, stats, testimonials, pricing, FAQ
-- =====================================================
INSERT INTO public.pages (
  id,
  "userId",
  "teamId",
  slug,
  title,
  blocks,
  locale,
  status,
  "seoTitle",
  "seoDescription",
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000001',
  'usr-carlos-001',
  'team-everpoint-001',
  'home',
  'Home',
  '[
    {
      "id": "home-hero",
      "blockSlug": "jumbotron",
      "props": {
        "title": "Build Your SaaS in Days, Not Months",
        "subtitle": "A production-ready Next.js boilerplate with authentication, payments, emails, and everything you need to launch your SaaS product faster.",
        "fullscreen": true,
        "backgroundImage": "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1920&q=80",
        "textColor": "light",
        "textAlign": "center",
        "primaryCta": {
          "label": "Get Started Free",
          "url": "/signup",
          "variant": "default"
        },
        "secondaryCta": {
          "label": "View Demo",
          "url": "/demo",
          "variant": "outline"
        }
      }
    },
    {
      "id": "home-logos",
      "blockSlug": "logo-cloud",
      "props": {
        "title": "Trusted by developers at",
        "logos": [
          { "image": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg", "alt": "Amazon" },
          { "image": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg", "alt": "Google" },
          { "image": "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg", "alt": "Microsoft" },
          { "image": "https://upload.wikimedia.org/wikipedia/commons/e/e8/Tesla_logo.png", "alt": "Tesla" },
          { "image": "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg", "alt": "Netflix" }
        ],
        "layout": "row",
        "grayscale": true,
        "size": "md"
      }
    },
    {
      "id": "home-stats",
      "blockSlug": "stats-counter",
      "props": {
        "stats": [
          { "value": "500", "label": "Active Projects", "suffix": "+" },
          { "value": "10", "label": "Hours Saved per Project", "suffix": "K+" },
          { "value": "99.9", "label": "Uptime", "suffix": "%" },
          { "value": "24/7", "label": "Support" }
        ],
        "columns": "4",
        "variant": "default",
        "size": "lg",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "home-features",
      "blockSlug": "features-grid",
      "props": {
        "title": "Everything You Need to Launch",
        "content": "Stop reinventing the wheel. Our boilerplate includes all the essential features you need to build and scale your SaaS product.",
        "items": [
          {
            "icon": "Shield",
            "title": "Authentication Ready",
            "description": "Complete auth system with email/password, OAuth providers, email verification, and password reset out of the box."
          },
          {
            "icon": "CreditCard",
            "title": "Payments Integrated",
            "description": "Stripe integration for subscriptions, one-time payments, and usage-based billing. Webhooks included."
          },
          {
            "icon": "Mail",
            "title": "Email System",
            "description": "Transactional emails with Resend, beautiful templates, and queue support for high-volume sending."
          },
          {
            "icon": "Database",
            "title": "Database & ORM",
            "description": "PostgreSQL with Supabase, type-safe queries, migrations, and seed data for development."
          },
          {
            "icon": "Palette",
            "title": "UI Components",
            "description": "200+ accessible components built with Radix UI and Tailwind CSS. Dark mode included."
          },
          {
            "icon": "Globe",
            "title": "Multi-language",
            "description": "Built-in internationalization with next-intl. RTL support and language switching included."
          }
        ],
        "columns": "3"
      }
    },
    {
      "id": "home-split-1",
      "blockSlug": "split-content",
      "props": {
        "subtitle": "Developer Experience",
        "title": "Built for Speed and Quality",
        "content": "Our boilerplate is designed with developer experience in mind. TypeScript throughout, ESLint + Prettier configured, and comprehensive documentation to get you up and running in minutes.",
        "image": "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80",
        "imageAlt": "Developer coding",
        "imagePosition": "right",
        "imageStyle": "rounded",
        "bulletPoints": [
          { "text": "Full TypeScript support with strict mode" },
          { "text": "Hot reload for instant feedback" },
          { "text": "Pre-configured testing with Jest and Cypress" },
          { "text": "CI/CD templates for GitHub Actions" }
        ],
        "cta": {
          "text": "Read the Docs",
          "link": "/getting-started",
          "variant": "outline"
        }
      }
    },
    {
      "id": "home-split-2",
      "blockSlug": "split-content",
      "props": {
        "subtitle": "Production Ready",
        "title": "Scale with Confidence",
        "content": "From day one, your application is built on a solid foundation. Optimized for performance, security, and scalability so you can focus on building features, not infrastructure.",
        "image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
        "imageAlt": "Analytics dashboard",
        "imagePosition": "left",
        "imageStyle": "rounded",
        "bulletPoints": [
          { "text": "Edge-ready with Vercel deployment" },
          { "text": "Built-in rate limiting and security headers" },
          { "text": "Automatic database backups with Supabase" },
          { "text": "Real-time features with WebSocket support" }
        ],
        "cta": {
          "text": "View Architecture",
          "link": "/getting-started",
          "variant": "outline"
        },
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "home-video",
      "blockSlug": "video-hero",
      "props": {
        "title": "See It in Action",
        "content": "Watch how easy it is to go from zero to a fully functional SaaS application in under 10 minutes.",
        "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "layout": "inline",
        "autoplay": false
      }
    },
    {
      "id": "home-testimonials",
      "blockSlug": "testimonials",
      "props": {
        "title": "Loved by Developers",
        "content": "Join hundreds of developers who have shipped their SaaS faster with our boilerplate.",
        "items": [
          {
            "author": "Sarah Chen",
            "role": "Founder at LaunchFast",
            "quote": "This boilerplate saved me at least 3 months of development time. The auth system alone would have taken weeks to build properly.",
            "avatar": "https://i.pravatar.cc/150?u=sarah"
          },
          {
            "author": "Marcus Rodriguez",
            "role": "CTO at ScaleUp",
            "quote": "The code quality is exceptional. It''s clear this was built by developers who understand what it takes to ship production software.",
            "avatar": "https://i.pravatar.cc/150?u=marcus"
          },
          {
            "author": "Emily Watson",
            "role": "Solo Founder",
            "quote": "As a solo founder, I needed something that just works. This boilerplate let me focus on my product instead of infrastructure.",
            "avatar": "https://i.pravatar.cc/150?u=emily"
          }
        ],
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "home-pricing",
      "blockSlug": "pricing-table",
      "props": {
        "title": "Simple, Transparent Pricing",
        "content": "Choose the plan that fits your needs. All plans include lifetime updates and community support.",
        "plans": [
          {
            "name": "Starter",
            "price": "$0",
            "period": "/forever",
            "description": "Perfect for learning and side projects",
            "features": "Core boilerplate code\\nBasic authentication\\nCommunity support\\nMIT License",
            "ctaText": "Download Free",
            "ctaUrl": "/download",
            "isPopular": false
          },
          {
            "name": "Pro",
            "price": "$199",
            "period": "one-time",
            "description": "For serious projects and startups",
            "features": "Everything in Starter\\nPremium components\\nStripe integration\\nEmail templates\\nPriority support\\nPrivate Discord access",
            "ctaText": "Get Pro License",
            "ctaUrl": "/checkout/pro",
            "isPopular": true
          },
          {
            "name": "Enterprise",
            "price": "$499",
            "period": "one-time",
            "description": "For teams and agencies",
            "features": "Everything in Pro\\nUnlimited team seats\\nCustom integrations\\nDedicated support\\n1-on-1 onboarding call\\nWhite-label license",
            "ctaText": "Contact Sales",
            "ctaUrl": "/contact",
            "isPopular": false
          }
        ],
        "columns": "3",
        "highlightPopular": true
      }
    },
    {
      "id": "home-faq",
      "blockSlug": "faq-accordion",
      "props": {
        "title": "Frequently Asked Questions",
        "subtitle": "Got questions? We have answers. If you can''t find what you''re looking for, reach out to our support team.",
        "items": [
          {
            "question": "What''s included in the boilerplate?",
            "answer": "The boilerplate includes a complete Next.js 15 application with authentication (email/password + OAuth), database setup with PostgreSQL, email system with Resend, payment integration with Stripe, 200+ UI components, internationalization, and comprehensive documentation."
          },
          {
            "question": "Do I need to pay for updates?",
            "answer": "No! All licenses include lifetime updates. When we release new features, bug fixes, or security patches, you''ll have access to them at no additional cost."
          },
          {
            "question": "Can I use this for client projects?",
            "answer": "Yes! The Pro license allows you to use the boilerplate for unlimited personal and client projects. The Enterprise license also includes white-labeling rights."
          },
          {
            "question": "What kind of support do you offer?",
            "answer": "Starter users get community support through GitHub discussions. Pro users get priority support with 24-48 hour response times. Enterprise users get dedicated support with same-day responses and a 1-on-1 onboarding call."
          },
          {
            "question": "Is there a refund policy?",
            "answer": "Yes, we offer a 30-day money-back guarantee. If you''re not satisfied with the boilerplate for any reason, contact us for a full refund."
          }
        ],
        "allowMultiple": false,
        "defaultOpenFirst": true,
        "variant": "bordered",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "home-cta",
      "blockSlug": "cta-section",
      "props": {
        "title": "Ready to Ship Your SaaS?",
        "content": "Join 500+ developers who have already launched their products with our boilerplate. Get started today and ship faster.",
        "backgroundColor": "primary",
        "cta.text": "Get Started Now",
        "cta.link": "/signup",
        "secondaryButton.text": "View on GitHub",
        "secondaryButton.link": "https://github.com"
      }
    }
  ]'::jsonb,
  'en',
  'published',
  'NextSpark - Build Your SaaS in Days, Not Months',
  'Production-ready Next.js boilerplate with authentication, payments, emails, and everything you need to launch your SaaS faster.',
  NOW(),
  NOW()
) ON CONFLICT (slug, locale) DO UPDATE SET
  title = EXCLUDED.title,
  blocks = EXCLUDED.blocks,
  "seoTitle" = EXCLUDED."seoTitle",
  "seoDescription" = EXCLUDED."seoDescription",
  "updatedAt" = NOW();


-- =====================================================
-- FEATURES PAGE - Detailed features with split content and benefits
-- =====================================================
INSERT INTO public.pages (
  id,
  "userId",
  "teamId",
  slug,
  title,
  blocks,
  locale,
  status,
  "seoTitle",
  "seoDescription",
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000002',
  'usr-carlos-001',
  'team-everpoint-001',
  'features',
  'Features',
  '[
    {
      "id": "features-hero",
      "blockSlug": "hero",
      "props": {
        "title": "Powerful Features for Modern SaaS",
        "content": "Every feature you need to build, launch, and scale your SaaS product. Built with best practices and production-ready code.",
        "cta": {
          "text": "Explore All Features",
          "link": "#features-list"
        },
        "backgroundColor": "primary"
      }
    },
    {
      "id": "features-auth",
      "blockSlug": "split-content",
      "props": {
        "subtitle": "Authentication",
        "title": "Enterprise-Grade Auth System",
        "content": "Our authentication system is built on Better Auth, providing a secure and flexible foundation. From simple email/password to complex SSO setups, we''ve got you covered.",
        "image": "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=80",
        "imageAlt": "Security authentication",
        "imagePosition": "right",
        "imageStyle": "rounded",
        "bulletPoints": [
          { "text": "Email/password with secure hashing" },
          { "text": "OAuth providers (Google, GitHub, more)" },
          { "text": "Email verification flow" },
          { "text": "Password reset with secure tokens" },
          { "text": "Session management with refresh tokens" },
          { "text": "Role-based access control (RBAC)" }
        ]
      }
    },
    {
      "id": "features-payments",
      "blockSlug": "split-content",
      "props": {
        "subtitle": "Payments",
        "title": "Stripe Integration Done Right",
        "content": "Accept payments globally with our battle-tested Stripe integration. Subscriptions, one-time payments, and usage-based billing are all supported out of the box.",
        "image": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
        "imageAlt": "Payment processing",
        "imagePosition": "left",
        "imageStyle": "rounded",
        "bulletPoints": [
          { "text": "Subscription management with Stripe" },
          { "text": "Customer portal for self-service" },
          { "text": "Webhook handlers for all events" },
          { "text": "Usage-based billing support" },
          { "text": "Multiple currency support" },
          { "text": "Invoice and receipt generation" }
        ],
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "features-email",
      "blockSlug": "split-content",
      "props": {
        "subtitle": "Email System",
        "title": "Beautiful Transactional Emails",
        "content": "Send beautiful, responsive emails with our Resend integration. Pre-built templates for common scenarios and easy customization for your brand.",
        "image": "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&q=80",
        "imageAlt": "Email templates",
        "imagePosition": "right",
        "imageStyle": "rounded",
        "bulletPoints": [
          { "text": "Pre-built email templates" },
          { "text": "React Email for easy customization" },
          { "text": "Automatic email queue for reliability" },
          { "text": "Email analytics and tracking" },
          { "text": "Unsubscribe handling" }
        ]
      }
    },
    {
      "id": "features-grid",
      "blockSlug": "features-grid",
      "props": {
        "title": "And Much More...",
        "content": "These are just the highlights. Our boilerplate includes dozens of additional features to accelerate your development.",
        "items": [
          {
            "icon": "FileText",
            "title": "Page Builder",
            "description": "Visual page builder with 15+ blocks. Create landing pages without writing code."
          },
          {
            "icon": "Search",
            "title": "SEO Optimized",
            "description": "Meta tags, sitemaps, robots.txt, and structured data all configured for you."
          },
          {
            "icon": "BarChart",
            "title": "Analytics Ready",
            "description": "Easy integration with Vercel Analytics, Google Analytics, or Plausible."
          },
          {
            "icon": "Moon",
            "title": "Dark Mode",
            "description": "System-aware dark mode with smooth transitions. Users can override preference."
          },
          {
            "icon": "Smartphone",
            "title": "Mobile First",
            "description": "Responsive design that looks great on all devices, from phones to large screens."
          },
          {
            "icon": "Zap",
            "title": "Edge Ready",
            "description": "Optimized for Vercel Edge Functions. Deploy globally with minimal latency."
          }
        ],
        "columns": "3",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "features-cta",
      "blockSlug": "cta-section",
      "props": {
        "title": "See All Features in Action",
        "content": "Ready to explore? Check out our live demo or dive into the documentation to see how everything works.",
        "cta.text": "View Live Demo",
        "cta.link": "/demo",
        "secondaryButton.text": "Read Docs",
        "secondaryButton.link": "/getting-started"
      }
    }
  ]'::jsonb,
  'en',
  'published',
  'Features - NextSpark',
  'Explore all the powerful features included in NextSpark: authentication, payments, emails, and more.',
  NOW(),
  NOW()
) ON CONFLICT (slug, locale) DO UPDATE SET
  title = EXCLUDED.title,
  blocks = EXCLUDED.blocks,
  "seoTitle" = EXCLUDED."seoTitle",
  "seoDescription" = EXCLUDED."seoDescription",
  "updatedAt" = NOW();


-- =====================================================
-- PRICING PAGE - Dedicated pricing with FAQ
-- =====================================================
INSERT INTO public.pages (
  id,
  "userId",
  "teamId",
  slug,
  title,
  blocks,
  locale,
  status,
  "seoTitle",
  "seoDescription",
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000003',
  'usr-carlos-001',
  'team-everpoint-001',
  'pricing',
  'Pricing',
  '[
    {
      "id": "pricing-hero",
      "blockSlug": "text-content",
      "props": {
        "title": "Pricing That Scales With You",
        "content": "Start free and upgrade as you grow. No hidden fees, no surprises. Just straightforward pricing for serious builders.",
        "alignment": "center"
      }
    },
    {
      "id": "pricing-table",
      "blockSlug": "pricing-table",
      "props": {
        "plans": [
          {
            "name": "Starter",
            "price": "$0",
            "period": "/forever",
            "description": "For learning and experimentation",
            "features": "Core boilerplate\\nBasic auth system\\nCommunity support\\nGitHub access\\nMIT License",
            "ctaText": "Download Free",
            "ctaUrl": "/download",
            "isPopular": false
          },
          {
            "name": "Pro",
            "price": "$199",
            "period": "one-time",
            "description": "For startups and indie hackers",
            "features": "Everything in Starter\\n50+ premium components\\nStripe integration\\nEmail templates\\nPriority email support\\nPrivate Discord\\nLifetime updates",
            "ctaText": "Buy Pro License",
            "ctaUrl": "/checkout/pro",
            "isPopular": true
          },
          {
            "name": "Enterprise",
            "price": "$499",
            "period": "one-time",
            "description": "For teams and agencies",
            "features": "Everything in Pro\\nUnlimited team members\\nWhite-label rights\\nCustom integrations\\nDedicated support\\n1-on-1 onboarding\\nPriority feature requests",
            "ctaText": "Contact Sales",
            "ctaUrl": "/contact",
            "isPopular": false
          }
        ],
        "columns": "3",
        "highlightPopular": true
      }
    },
    {
      "id": "pricing-comparison",
      "blockSlug": "text-content",
      "props": {
        "title": "Why Pay for a Boilerplate?",
        "content": "Building authentication, payments, and email systems from scratch takes months. Our Pro customers report saving 200+ hours of development time—that''s over $10,000 in developer costs at typical rates. The boilerplate pays for itself on day one.",
        "alignment": "center",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "pricing-faq",
      "blockSlug": "faq-accordion",
      "props": {
        "title": "Pricing FAQ",
        "items": [
          {
            "question": "Is this a subscription or one-time payment?",
            "answer": "It''s a one-time payment with lifetime access. You pay once and get access to the current version plus all future updates forever. No recurring fees."
          },
          {
            "question": "Can I use this for multiple projects?",
            "answer": "Yes! Both Pro and Enterprise licenses allow unlimited projects. Build as many SaaS products as you want with a single license."
          },
          {
            "question": "What''s the difference between Pro and Enterprise?",
            "answer": "Pro is designed for individual developers and small teams. Enterprise adds white-label rights (remove all attribution), dedicated support with faster response times, and a personal onboarding call to help your team get started."
          },
          {
            "question": "Do you offer team licenses?",
            "answer": "The Enterprise plan includes unlimited team seats. For Pro, each developer needs their own license, but we offer bulk discounts for teams of 3+. Contact us for details."
          },
          {
            "question": "What payment methods do you accept?",
            "answer": "We accept all major credit cards, Apple Pay, and Google Pay through Stripe. For Enterprise customers, we can also arrange bank transfers or purchase orders."
          },
          {
            "question": "Is there a refund policy?",
            "answer": "Absolutely. We offer a 30-day, no-questions-asked refund policy. If the boilerplate isn''t right for you, just email us and we''ll process your refund immediately."
          }
        ],
        "allowMultiple": false,
        "defaultOpenFirst": true,
        "variant": "separated"
      }
    },
    {
      "id": "pricing-cta",
      "blockSlug": "cta-section",
      "props": {
        "title": "Still Have Questions?",
        "content": "We''re happy to help. Reach out to our team and we''ll get back to you within 24 hours.",
        "backgroundColor": "primary",
        "cta.text": "Contact Us",
        "cta.link": "/contact"
      }
    }
  ]'::jsonb,
  'en',
  'published',
  'Pricing - NextSpark',
  'Simple, transparent pricing. Start free, upgrade when you''re ready. One-time payment, lifetime updates.',
  NOW(),
  NOW()
) ON CONFLICT (slug, locale) DO UPDATE SET
  title = EXCLUDED.title,
  blocks = EXCLUDED.blocks,
  "seoTitle" = EXCLUDED."seoTitle",
  "seoDescription" = EXCLUDED."seoDescription",
  "updatedAt" = NOW();


-- =====================================================
-- ABOUT PAGE - Company story with timeline
-- =====================================================
INSERT INTO public.pages (
  id,
  "userId",
  "teamId",
  slug,
  title,
  blocks,
  locale,
  status,
  "seoTitle",
  "seoDescription",
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000004',
  'usr-carlos-001',
  'team-everpoint-001',
  'about',
  'About Us',
  '[
    {
      "id": "about-hero",
      "blockSlug": "hero",
      "props": {
        "title": "Built by Developers, for Developers",
        "content": "We''re a small team of experienced developers who got tired of building the same boilerplate code for every new project. So we decided to build the ultimate starting point.",
        "backgroundColor": "primary"
      }
    },
    {
      "id": "about-story",
      "blockSlug": "split-content",
      "props": {
        "subtitle": "Our Story",
        "title": "From Frustration to Solution",
        "content": "After years of building SaaS products, we noticed a pattern: every project started with the same 2-3 months of setup work. Authentication, payments, emails, user management—it was always the same. We decided to solve this problem once and for all.",
        "image": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80",
        "imageAlt": "Team working together",
        "imagePosition": "right",
        "imageStyle": "rounded"
      }
    },
    {
      "id": "about-timeline",
      "blockSlug": "timeline",
      "props": {
        "title": "Our Journey",
        "subtitle": "From a side project to helping hundreds of developers ship faster",
        "items": [
          {
            "date": "2022",
            "title": "The Idea",
            "description": "Frustrated with repetitive boilerplate work, we started documenting our setup process and best practices.",
            "icon": "Lightbulb"
          },
          {
            "date": "Early 2023",
            "title": "First Version",
            "description": "Released v1.0 as an open-source project. Received amazing feedback from the community.",
            "icon": "Rocket"
          },
          {
            "date": "Mid 2023",
            "title": "Going Pro",
            "description": "Launched Pro version with premium features, Stripe integration, and dedicated support.",
            "icon": "Star"
          },
          {
            "date": "2024",
            "title": "500+ Customers",
            "description": "Reached 500 paid customers and launched Enterprise tier for teams and agencies.",
            "icon": "Users"
          },
          {
            "date": "Today",
            "title": "Continuous Improvement",
            "description": "Regular updates, new features, and a growing community of developers building amazing products.",
            "icon": "TrendingUp"
          }
        ],
        "layout": "vertical",
        "alternating": true,
        "showConnector": true,
        "variant": "cards",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "about-values",
      "blockSlug": "features-grid",
      "props": {
        "title": "Our Values",
        "content": "The principles that guide everything we build",
        "items": [
          {
            "icon": "Code",
            "title": "Code Quality First",
            "description": "Every line of code is reviewed, tested, and documented. We don''t ship anything we wouldn''t use ourselves."
          },
          {
            "icon": "Heart",
            "title": "Developer Experience",
            "description": "We obsess over the little things that make developers'' lives easier. Good DX is our competitive advantage."
          },
          {
            "icon": "Users",
            "title": "Community Driven",
            "description": "Our roadmap is shaped by customer feedback. The best features come from real developers solving real problems."
          }
        ],
        "columns": "3"
      }
    },
    {
      "id": "about-stats",
      "blockSlug": "stats-counter",
      "props": {
        "stats": [
          { "value": "500", "label": "Happy Customers", "suffix": "+" },
          { "value": "50", "label": "Countries", "suffix": "+" },
          { "value": "1M", "label": "Lines of Code Saved", "suffix": "+" },
          { "value": "4.9", "label": "Average Rating", "suffix": "/5" }
        ],
        "columns": "4",
        "variant": "cards",
        "size": "lg",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "about-cta",
      "blockSlug": "cta-section",
      "props": {
        "title": "Want to Join Our Story?",
        "content": "Become part of our growing community of developers building the future of SaaS.",
        "cta.text": "Get Started",
        "cta.link": "/signup",
        "secondaryButton.text": "Join Discord",
        "secondaryButton.link": "https://discord.gg/example"
      }
    }
  ]'::jsonb,
  'en',
  'published',
  'About Us - NextSpark',
  'Learn about the team behind NextSpark and our mission to help developers ship faster.',
  NOW(),
  NOW()
) ON CONFLICT (slug, locale) DO UPDATE SET
  title = EXCLUDED.title,
  blocks = EXCLUDED.blocks,
  "seoTitle" = EXCLUDED."seoTitle",
  "seoDescription" = EXCLUDED."seoDescription",
  "updatedAt" = NOW();


-- =====================================================
-- DOCS PAGE - Documentation overview with video hero
-- =====================================================
INSERT INTO public.pages (
  id,
  "userId",
  "teamId",
  slug,
  title,
  blocks,
  locale,
  status,
  "seoTitle",
  "seoDescription",
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000005',
  'usr-carlos-001',
  'team-everpoint-001',
  'getting-started',
  'Getting Started',
  '[
    {
      "id": "docs-hero",
      "blockSlug": "video-hero",
      "props": {
        "title": "Get Started in Minutes",
        "content": "Our comprehensive documentation will guide you from installation to deployment. Watch the quick start video or dive into the docs.",
        "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "layout": "side-by-side",
        "autoplay": false,
        "cta": {
          "text": "Read the Docs",
          "link": "/getting-started"
        }
      }
    },
    {
      "id": "docs-quickstart",
      "blockSlug": "timeline",
      "props": {
        "title": "Quick Start Guide",
        "subtitle": "Get your development environment up and running in 5 steps",
        "items": [
          {
            "date": "Step 1",
            "title": "Clone the Repository",
            "description": "Clone the boilerplate from GitHub and install dependencies with pnpm install.",
            "icon": "GitBranch"
          },
          {
            "date": "Step 2",
            "title": "Configure Environment",
            "description": "Copy .env.example to .env and fill in your database, Stripe, and email credentials.",
            "icon": "Settings"
          },
          {
            "date": "Step 3",
            "title": "Run Migrations",
            "description": "Execute pnpm db:migrate to set up your database schema with all required tables.",
            "icon": "Database"
          },
          {
            "date": "Step 4",
            "title": "Start Development",
            "description": "Run pnpm dev to start the development server. Your app is now running at localhost:5173.",
            "icon": "Play"
          },
          {
            "date": "Step 5",
            "title": "Build Something Great",
            "description": "Start customizing the boilerplate for your specific needs. Check the docs for detailed guides.",
            "icon": "Rocket"
          }
        ],
        "layout": "vertical",
        "alternating": false,
        "showConnector": true,
        "variant": "default",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "docs-sections",
      "blockSlug": "features-grid",
      "props": {
        "title": "Documentation Sections",
        "content": "Everything you need to know, organized by topic",
        "items": [
          {
            "icon": "Rocket",
            "title": "Getting Started",
            "description": "Installation, configuration, and your first deployment. Everything to get up and running."
          },
          {
            "icon": "Shield",
            "title": "Authentication",
            "description": "User registration, login flows, OAuth setup, email verification, and password reset."
          },
          {
            "icon": "CreditCard",
            "title": "Payments",
            "description": "Stripe setup, subscriptions, webhooks, customer portal, and billing management."
          },
          {
            "icon": "Layout",
            "title": "UI Components",
            "description": "200+ components with examples, props documentation, and customization guides."
          },
          {
            "icon": "Database",
            "title": "Database",
            "description": "Schema design, migrations, queries, and best practices for PostgreSQL."
          },
          {
            "icon": "Cloud",
            "title": "Deployment",
            "description": "Deploy to Vercel, Railway, or your own infrastructure with our step-by-step guides."
          }
        ],
        "columns": "3"
      }
    },
    {
      "id": "docs-cta",
      "blockSlug": "cta-section",
      "props": {
        "title": "Need Help?",
        "content": "Can''t find what you''re looking for? Our support team is here to help.",
        "backgroundColor": "primary",
        "cta.text": "Contact Support",
        "cta.link": "/contact",
        "secondaryButton.text": "Join Discord",
        "secondaryButton.link": "https://discord.gg/example"
      }
    }
  ]'::jsonb,
  'en',
  'published',
  'Getting Started - NextSpark',
  'Quick start guide to help you get started with NextSpark. From installation to deployment.',
  NOW(),
  NOW()
) ON CONFLICT (slug, locale) DO UPDATE SET
  title = EXCLUDED.title,
  blocks = EXCLUDED.blocks,
  "seoTitle" = EXCLUDED."seoTitle",
  "seoDescription" = EXCLUDED."seoDescription",
  "updatedAt" = NOW();


-- =====================================================
-- CONTACT PAGE - Contact form hero
-- =====================================================
INSERT INTO public.pages (
  id,
  "userId",
  "teamId",
  slug,
  title,
  blocks,
  locale,
  status,
  "seoTitle",
  "seoDescription",
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000006',
  'usr-carlos-001',
  'team-everpoint-001',
  'contact',
  'Contact Us',
  '[
    {
      "id": "contact-hero",
      "blockSlug": "hero-with-form",
      "props": {
        "title": "Let''s Talk",
        "subtitle": "Have questions about the boilerplate? Want to discuss a custom integration? We''d love to hear from you.",
        "backgroundImage": "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?w=1920&q=80",
        "formTitle": "Send us a message",
        "formSubtitle": "We typically respond within 24 hours",
        "firstNamePlaceholder": "First Name",
        "lastNamePlaceholder": "Last Name",
        "emailPlaceholder": "Email",
        "phonePlaceholder": "Phone (optional)",
        "areaOfInterestPlaceholder": "What can we help with?",
        "areaOfInterestOptions": "General Question\\nPre-sales Inquiry\\nTechnical Support\\nEnterprise Sales\\nPartnership",
        "submitButtonText": "Send Message",
        "legalDisclaimer": "By submitting this form, you agree to our",
        "termsLinkText": "Terms of Service",
        "termsLinkUrl": "/terms",
        "privacyLinkText": "Privacy Policy",
        "privacyLinkUrl": "/privacy",
        "formAction": "/api/contact",
        "overlayOpacity": "60"
      }
    },
    {
      "id": "contact-info",
      "blockSlug": "features-grid",
      "props": {
        "title": "Other Ways to Reach Us",
        "items": [
          {
            "icon": "Mail",
            "title": "Email",
            "description": "For general inquiries: hello@example.com. For support: support@example.com"
          },
          {
            "icon": "MessageSquare",
            "title": "Discord",
            "description": "Join our community for real-time help, discussions, and announcements."
          },
          {
            "icon": "Twitter",
            "title": "Twitter",
            "description": "Follow @nextspark for updates, tips, and behind-the-scenes content."
          }
        ],
        "columns": "3",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "contact-faq",
      "blockSlug": "faq-accordion",
      "props": {
        "title": "Common Questions",
        "items": [
          {
            "question": "What''s your typical response time?",
            "answer": "We aim to respond to all inquiries within 24 hours on business days. Priority support customers typically receive responses within 4 hours."
          },
          {
            "question": "Do you offer custom development?",
            "answer": "While we focus on maintaining the boilerplate, we can connect you with vetted developers from our community who specialize in customizations and integrations."
          },
          {
            "question": "Can I schedule a demo?",
            "answer": "Absolutely! Enterprise customers can schedule a personalized demo and onboarding call. Use the form above and select \"Enterprise Sales\" as your topic."
          }
        ],
        "allowMultiple": true,
        "defaultOpenFirst": false,
        "variant": "bordered"
      }
    }
  ]'::jsonb,
  'en',
  'published',
  'Contact Us - NextSpark',
  'Get in touch with our team. We''re here to help with questions, support, and enterprise inquiries.',
  NOW(),
  NOW()
) ON CONFLICT (slug, locale) DO UPDATE SET
  title = EXCLUDED.title,
  blocks = EXCLUDED.blocks,
  "seoTitle" = EXCLUDED."seoTitle",
  "seoDescription" = EXCLUDED."seoDescription",
  "updatedAt" = NOW();


-- =====================================================
-- DEMO PAGE - Interactive demo with benefits
-- =====================================================
INSERT INTO public.pages (
  id,
  "userId",
  "teamId",
  slug,
  title,
  blocks,
  locale,
  status,
  "seoTitle",
  "seoDescription",
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000007',
  'usr-carlos-001',
  'team-everpoint-001',
  'demo',
  'Live Demo',
  '[
    {
      "id": "demo-hero",
      "blockSlug": "video-hero",
      "props": {
        "title": "See the Boilerplate in Action",
        "content": "This live demo showcases all the features included in the Pro version. Feel free to explore and test everything.",
        "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "layout": "background",
        "autoplay": false,
        "overlayOpacity": "60",
        "cta": {
          "text": "Try the Live Demo",
          "link": "https://demo.example.com"
        }
      }
    },
    {
      "id": "demo-benefits",
      "blockSlug": "benefits",
      "props": {
        "title": "What You''ll Experience",
        "content": "Our demo is a fully functional SaaS application. Here''s what you can test:",
        "items": [
          {
            "icon": "UserPlus",
            "title": "User Registration",
            "description": "Create an account with email/password or use Google OAuth to sign up instantly."
          },
          {
            "icon": "Settings",
            "title": "Dashboard",
            "description": "Explore the admin dashboard with real data, charts, and management tools."
          },
          {
            "icon": "CreditCard",
            "title": "Stripe Checkout",
            "description": "Test the payment flow with Stripe test mode. Use card 4242 4242 4242 4242."
          },
          {
            "icon": "Palette",
            "title": "Theme Customization",
            "description": "Toggle dark mode, change accent colors, and see the UI adapt in real-time."
          }
        ]
      }
    },
    {
      "id": "demo-credentials",
      "blockSlug": "text-content",
      "props": {
        "title": "Demo Credentials",
        "content": "Want to skip registration? Use these test credentials:\\n\\nEmail: demo@example.com\\nPassword: demo123\\n\\nThis account has full access to all Pro features. Data resets every 24 hours.",
        "alignment": "center",
        "backgroundColor": "gray-50"
      }
    },
    {
      "id": "demo-cta",
      "blockSlug": "cta-section",
      "props": {
        "title": "Ready to Build Your Own?",
        "content": "Get the same powerful foundation for your SaaS. Start building today.",
        "backgroundColor": "primary",
        "cta.text": "Get Started",
        "cta.link": "/pricing",
        "secondaryButton.text": "View Source",
        "secondaryButton.link": "https://github.com"
      }
    }
  ]'::jsonb,
  'en',
  'published',
  'Live Demo - NextSpark',
  'Experience NextSpark with our interactive live demo. Test authentication, payments, and all features.',
  NOW(),
  NOW()
) ON CONFLICT (slug, locale) DO UPDATE SET
  title = EXCLUDED.title,
  blocks = EXCLUDED.blocks,
  "seoTitle" = EXCLUDED."seoTitle",
  "seoDescription" = EXCLUDED."seoDescription",
  "updatedAt" = NOW();
