import { defineConfig } from "tsup";

const radixPackages = [
  "@radix-ui/react-accordion",
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-icons",
  "@radix-ui/react-label",
  "@radix-ui/react-progress",
  "@radix-ui/react-separator",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-switch",
  "@radix-ui/react-tabs",
];

export default defineConfig([
  // Web build - needs "use client" for Next.js RSC compatibility
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["react", ...radixPackages],
    banner: {
      js: '"use client";',
    },
  },
  // Native build - no "use client" needed, no Radix
  {
    entry: ["src/index.native.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    external: ["react", "react-native", "react-native-reanimated", ...radixPackages],
  },
]);
