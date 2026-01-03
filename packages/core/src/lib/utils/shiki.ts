import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

let highlighter: Highlighter | null = null;

// Lenguajes soportados en el proyecto
const SUPPORTED_LANGUAGES: BundledLanguage[] = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "json",
  "bash",
  "shell",
  "sql",
  "css",
  "html",
  "markdown",
  "yaml",
  "gherkin",
];

/**
 * Obtiene el highlighter singleton de Shiki.
 * Lazy-loaded para evitar cargar en páginas que no lo necesitan.
 */
export async function getShikiHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: SUPPORTED_LANGUAGES,
    });
  }
  return highlighter;
}

/**
 * Resalta código usando Shiki.
 * Debe llamarse después de inicializar el highlighter.
 */
export async function highlightCode(
  code: string,
  lang: string,
  theme: "github-dark" | "github-light" = "github-dark"
): Promise<string> {
  const hl = await getShikiHighlighter();

  // Normalizar lenguaje
  const normalizedLang = normalizeLanguage(lang);

  return hl.codeToHtml(code, {
    lang: normalizedLang,
    theme,
  });
}

/**
 * Normaliza el nombre del lenguaje para Shiki.
 */
function normalizeLanguage(lang: string): BundledLanguage {
  const langMap: Record<string, BundledLanguage> = {
    ts: "typescript",
    js: "javascript",
    sh: "bash",
    yml: "yaml",
    md: "markdown",
  };

  const normalized = lang.toLowerCase();
  return (langMap[normalized] || normalized) as BundledLanguage;
}
