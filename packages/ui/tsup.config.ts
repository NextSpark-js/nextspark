import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/index.native.ts", "src/variants/button.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-native", "@radix-ui/react-slot"],
});
