/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    // Include shared UI package for NativeWind to scan
    "../../packages/ui/src/**/*.{js,jsx,ts,tsx}",
    "../../packages/ui/dist/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // Status colors
        status: {
          todo: "var(--status-todo)",
          inProgress: "var(--status-in-progress)",
          review: "var(--status-review)",
          done: "var(--status-done)",
          blocked: "var(--status-blocked)",
        },
        // Priority colors
        priority: {
          low: "var(--priority-low)",
          medium: "var(--priority-medium)",
          high: "var(--priority-high)",
          urgent: "var(--priority-urgent)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
  // Safelist classes used by @nextsparkjs/ui CustomButton
  safelist: [
    // Container variants
    "flex-row",
    "items-center",
    "justify-center",
    "rounded-lg",
    "font-semibold",
    "active:opacity-80",
    // Primary
    "bg-primary",
    "text-primary-foreground",
    // Secondary
    "bg-secondary",
    "text-secondary-foreground",
    // Outline
    "border",
    "border-input",
    "bg-background",
    "text-foreground",
    // Ghost (no bg)
    // Destructive
    "bg-destructive",
    "text-destructive-foreground",
    // Sizes
    "h-9",
    "h-11",
    "h-12",
    "px-3",
    "px-4",
    "px-6",
    "text-sm",
    "text-base",
    "text-lg",
  ],
};
