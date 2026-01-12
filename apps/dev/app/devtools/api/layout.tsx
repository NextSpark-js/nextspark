/**
 * API Explorer Layout
 *
 * Full-width layout for the API Explorer page.
 * Uses negative margins to break out of the parent container's padding
 * and centering (mx-auto).
 *
 * The parent layout has: container mx-auto p-6 max-w-7xl
 * We need to break out of ALL these constraints to use the full available width.
 *
 * Structure:
 * - DevTools sidebar: w-64 (256px / 16rem)
 * - Main content: flex-1 (fills remaining space)
 *   - Container: mx-auto p-6 max-w-7xl (centered, padded, max 1280px)
 *     - This layout: breaks out to fill full main content area
 */
export default function ApiExplorerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Use relative positioning to break out of the centered container
  // margin-left: -50vw + 50% + sidebar/2 adjustment positions at the left edge
  // width: calc(100vw - sidebar) fills to the right edge
  return (
    <div
      className="h-[calc(100vh-4rem)]"
      style={{
        // Position at the left edge of the main content area (right after sidebar)
        position: 'relative',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100vw - 16rem)', // 100vw minus DevTools sidebar (w-64 = 16rem)
        maxWidth: 'none',
        marginLeft: 0,
        marginRight: 0,
        marginTop: '-1.5rem', // Negate top padding
        marginBottom: '-1.5rem', // Negate bottom padding
      }}
    >
      {children}
    </div>
  )
}
