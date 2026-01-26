import { defineConfig } from "tsup";

export default defineConfig([
  // Web build - needs "use client" for Next.js RSC compatibility
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["react", "@radix-ui/react-slot"],
    banner: {
      js: '"use client";',
    },
  },
  // Native build - no "use client" needed
  {
    entry: ["src/index.native.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    external: ["react", "react-native", "react-native-reanimated"],
  },
]);
