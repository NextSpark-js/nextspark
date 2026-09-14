/**
 * Sanitising for the HTML a block renders through dangerouslySetInnerHTML.
 *
 * Rich-text block fields hold markup on purpose — that is what the editor is
 * for — so the value cannot simply be escaped. What it can be is restricted to
 * markup that only formats: an allowlist of tags and attributes, with no event
 * handlers and no `javascript:` URLs.
 *
 * This runs at render, which is where every path meets. Content reaches the
 * database through the dashboard, the v1 API with an API key, sample data and
 * whatever a project imports; sanitising at one of those leaves the others, and
 * leaves whatever is already stored. Note the flip side: what is stored is
 * still the raw input, so a consumer reading the API directly gets what was
 * written, not this.
 *
 * Not marked server-only, though blocks are server components: devtools
 * previews a block in the browser, through the lazy half of the block registry,
 * so this module has to survive being bundled for the client. It does —
 * sanitize-html parses with htmlparser2, not a DOM — and that preview is the
 * only route that pays for it.
 *
 * @module core/lib/blocks/sanitize-html
 */

import sanitizeHtmlLib from 'sanitize-html'

/**
 * What a formatting-only subset of HTML needs.
 *
 * Built from the library's defaults rather than listed from scratch, so the
 * things it already refuses — `<script>`, `<style>`, event handlers — stay
 * refused, and the additions are only what rich text legitimately produces.
 */
const OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    ...sanitizeHtmlLib.defaults.allowedTags,
    'img',
    'h1',
    'h2',
    'figure',
    'figcaption',
    'picture',
    'source',
    'del',
    'ins',
    'mark',
    'small',
    'u',
  ],
  allowedAttributes: {
    ...sanitizeHtmlLib.defaults.allowedAttributes,
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    source: ['src', 'srcset', 'type', 'media'],
    a: ['href', 'name', 'target', 'rel', 'title'],
    // The editor writes Tailwind classes into the markup, and dropping them
    // would strip the formatting the author applied rather than secure it.
    '*': ['class', 'id', 'dir', 'lang', 'style'],
  },
  // No `javascript:`, and no `data:` either: an `<a href="data:text/html,…">`
  // navigates to attacker-authored markup on this origin.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  // Inline styles survive, but only declarations that cannot script or reach
  // out: no `url()`, no `expression()`, no `-moz-binding`.
  allowedStyles: {
    '*': {
      color: [/^[^;{}()]*$/],
      'background-color': [/^[^;{}()]*$/],
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^[\d.]+(px|em|rem|%|pt)$/],
      'font-weight': [/^(normal|bold|lighter|bolder|[1-9]00)$/],
      'font-style': [/^(normal|italic|oblique)$/],
      'text-decoration': [/^[a-z\s-]+$/],
      margin: [/^[\d.\s]+(px|em|rem|%)?$/],
      padding: [/^[\d.\s]+(px|em|rem|%)?$/],
      width: [/^[\d.]+(px|em|rem|%)$/],
      height: [/^[\d.]+(px|em|rem|%)$/],
    },
  },
  // A link that opens a new tab hands the opener to the destination without
  // this; the editor has no way to set it, so it is added here.
  transformTags: {
    a: (tagName, attribs) =>
      attribs.target === '_blank'
        ? { tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }
        : { tagName, attribs },
  },
}

/**
 * The HTML of a rich-text block field, reduced to markup that only formats.
 *
 * @param html - The stored field value.
 * @returns Markup safe to hand to dangerouslySetInnerHTML; '' for no input.
 */
export function sanitizeBlockHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtmlLib(html, OPTIONS)
}
