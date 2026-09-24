/**
 * API Explorer Layout
 *
 * The Explorer is a tool, not a document: it wants the whole content area, while every other
 * DevTools page sits inside the parent layout's centered, padded, max-width container.
 *
 * It escapes that container by filling the scroll area it lives in — `absolute inset-0` against
 * the `relative <main>` of the parent layout. What it must NOT do is compute its own size from
 * the viewport: the previous `calc(100vw - 16rem)` assumed the DevTools sidebar is always
 * 16rem, so collapsing that sidebar to a rail left the Explorer 192px narrower than the space
 * it had, and the centering split the difference into dead margins on both sides — the layout
 * got worse exactly when someone made room for it.
 *
 * Filling the parent has no such assumption: the sidebar's width, the container's padding and
 * its max-width all stop being this file's business.
 */
export default function ApiExplorerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="absolute inset-0">{children}</div>
}
