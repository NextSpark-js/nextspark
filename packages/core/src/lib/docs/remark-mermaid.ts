/**
 * remark plugin: rewrite ```mermaid fenced code blocks into a neutral
 * <pre class="mermaid"> marker that carries the raw diagram source, instead of
 * letting the syntax highlighter render them as source code.
 *
 * The marker is platform-neutral: the diagram source is preserved verbatim so
 * each surface can render it its own way. On web it is picked up and rendered
 * to SVG client-side after mount (see DocsContent).
 */

interface MarkdownNode {
  type: string
  lang?: string | null
  value?: string
  children?: MarkdownNode[]
}

/**
 * Escape the characters that are significant inside HTML text content so the
 * diagram source survives untouched. The browser decodes these back when
 * mermaid reads the element's textContent, so the original definition is
 * recovered exactly (including labels that contain `<`, `>` or `&`).
 */
function escapeHtml(source: string): string {
  return source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function transformMermaidFences(node: MarkdownNode): void {
  if (!node.children) return

  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index]

    if (child.type === 'code' && child.lang?.toLowerCase() === 'mermaid') {
      node.children[index] = {
        type: 'html',
        value: `<pre class="mermaid">${escapeHtml(child.value ?? '')}</pre>`,
      }
    } else {
      transformMermaidFences(child)
    }
  }
}

/**
 * Unified/remark plugin. Runs on the mdast tree before it is converted to
 * rehype, so the mermaid fence never reaches the syntax highlighter.
 */
export function remarkMermaid() {
  return (tree: unknown): void => {
    transformMermaidFences(tree as MarkdownNode)
  }
}
