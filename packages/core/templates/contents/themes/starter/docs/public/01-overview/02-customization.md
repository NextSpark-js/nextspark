# Customizing the Starter Theme

This guide explains how to customize the starter theme for your needs.

## Renaming the Theme

When you run `npx nextspark init`, the theme is automatically renamed based on your project name.

## Adding New Entities

1. Create a new folder in `entities/`
2. Add the required files:
   - `[entity].config.ts`
   - `[entity].fields.ts`
   - `[entity].types.ts`
   - `migrations/`
   - `messages/`

## Adding New Blocks

1. Create a new folder in `blocks/`
2. Add the required files:
   - `config.ts`
   - `schema.ts`
   - `fields.ts`
   - `component.tsx`
   - `index.ts`

## Adding Dashboard Pages

1. Create a new folder in `templates/(dashboard)/`
2. Add `page.tsx` and any components
3. Update `config/dashboard.config.ts` to add navigation

## Modifying Styles

Edit the CSS files in `styles/`:
- `globals.css` - Global styles and CSS variables
- `components.css` - Component-specific styles

## Adding Languages

1. Create a new folder in `messages/[locale]/`
2. Copy files from `messages/en/`
3. Translate all strings
4. Update `config/app.config.ts` to include the new locale
