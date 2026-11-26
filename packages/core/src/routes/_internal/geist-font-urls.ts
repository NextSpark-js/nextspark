/**
 * URLs of the two Geist files the root layouts preload (#560). The `@font-face` rules that use them are in
 * styles/fonts.css, which styles/utilities.css imports: the file is referenced from the CSS with `url()` and from here with
 * `new URL(..., import.meta.url)`, so the bundler emits it once, under one content-hashed name, and both point at it.
 * From src/routes/_internal and from dist/routes/_internal the path reaches the same styles/ folder of the package.
 */
export const GEIST_SANS_URL = new URL('../../../styles/fonts/Geist-Variable.woff2', import.meta.url).href
export const GEIST_MONO_URL = new URL('../../../styles/fonts/GeistMono-Variable.woff2', import.meta.url).href
