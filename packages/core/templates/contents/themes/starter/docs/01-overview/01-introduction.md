# Starter Theme Introduction

Welcome to the Starter theme for NextSpark. This minimal theme provides everything you need to begin building your application.

## Features

- **Tasks Entity**: A complete example entity with CRUD operations
- **Analytics Dashboard**: Custom dashboard page example
- **Hero Block**: Page builder block example
- **Multi-language Support**: Translations in 6 languages (en, es, fr, it, de, pt)
- **Cypress Tests**: Complete test infrastructure

## Getting Started

1. Install dependencies: `pnpm install`
2. Configure environment: `cp .env.example .env.local`
3. Run migrations: `pnpm db:migrate`
4. Start development: `pnpm dev`

## Project Structure

```
starter/
├── config/         # Theme configuration files
├── entities/       # Entity definitions (tasks)
├── blocks/         # Page builder blocks (hero)
├── templates/      # Page templates (public, dashboard)
├── messages/       # i18n translations
├── lib/            # Utilities and hooks
├── tests/          # Cypress test suite
├── styles/         # CSS files
└── docs/           # Documentation
```
