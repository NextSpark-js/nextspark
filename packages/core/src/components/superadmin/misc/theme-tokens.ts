/** The color tokens the Style Gallery shows (the swatches of ThemePreview) and exports. */
export const COLOR_TOKENS = [
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--accent",
  "--accent-foreground",
  "--muted",
  "--muted-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
] as const;

export type TokensFormat = "css" | "json";

/** The resolved value of a CSS variable on the document root ("" outside a browser or when unset). */
export function readToken(cssVar: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
}

/** The tokens as a `:root { ... }` block or a JSON object keyed by variable name. */
export function buildTokensExport(
  tokens: readonly string[],
  read: (cssVar: string) => string,
  format: TokensFormat
): string {
  const entries = tokens.map((token) => [token, read(token)] as const);
  if (format === "json") return JSON.stringify(Object.fromEntries(entries), null, 2) + "\n";
  return `:root {\n${entries.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n`;
}
