# @nextsparkjs/ui

Shared UI components for NextSpark, in two builds with the same names: shadcn/ui-style components for the web (Radix UI and Tailwind CSS classes) and React Native components for Expo apps.

`@nextsparkjs/core` depends on this package and re-uses some of its components, and the mobile app template uses the React Native build. You can also install it on its own.

> **Stability: not listed.** The [stability page](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md) does not label `@nextsparkjs/ui`, and it is not on the [public API](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/05-public-api.md) list of `@nextsparkjs/core`. NextSpark is in beta (`0.1.0-beta`), so treat its exports as able to change in a minor release.

## Installation

```bash
pnpm add @nextsparkjs/ui
```

A project created with `pnpm create nextspark-app` already has it, because `@nextsparkjs/core` depends on it.

## Requirements

- Node.js 22.14.0 or later
- React `^19.1.0` (peer dependency)
- **Web:** a Tailwind CSS setup that defines shadcn/ui-style color tokens (`bg-primary`, `text-muted-foreground`, `border-input` and so on); a NextSpark project has it. The web build starts with `"use client"` for Next.js.
- **React Native:** React Native `>=0.75.0` and `react-native-reanimated` `>=4.0.0` (optional peer dependencies). The support matrix tests Expo SDK 58 with React Native 0.88, see [Mobile](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md#mobile).

## Usage

The package root resolves to the web build, and to the React Native build under the `react-native` condition (Metro picks it). `@nextsparkjs/ui/native` always gives the React Native build.

```tsx
import { Button, Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/ui'

export function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="outline">Upgrade</Button>
      </CardContent>
    </Card>
  )
}
```

On React Native, colors come from a theme instead of Tailwind classes. Wrap the app in `ThemeProvider` to override the defaults; the native components ignore `className` (they warn once in development), so style them with `style`:

```tsx
import { ThemeProvider } from '@nextsparkjs/ui'

export default function RootLayout() {
  return (
    <ThemeProvider colors={{ primary: '#3B82F6', primaryForeground: '#FFFFFF' }}>
      <Stack />
    </ThemeProvider>
  )
}
```

## Components

`Button`, `Input`, `Textarea`, `Checkbox`, `Switch`, `Label`, `Badge`, `Avatar`, `Card`, `Separator`, `Skeleton`, `Dialog`, `Progress`, `Tabs`, `Accordion` and `Slider`, plus the theme exports (`ThemeProvider`, `useTheme`, `defaultColors`). The React Native build also has `Select`; the web build also has the `cn` class-name helper and `badgeVariants`. Both builds export `buttonVariants`. Every component has its `*Props` type exported.

## Documentation

- [NextSpark documentation](https://www.nextspark.dev/docs)
- [Frontend and UI components](https://www.nextspark.dev/docs/frontend/shadcn-ui-integration)
- [Mobile package](https://github.com/NextSpark-js/nextspark/blob/main/packages/mobile/README.md)

## License

MIT
