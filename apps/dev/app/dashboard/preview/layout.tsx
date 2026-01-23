/**
 * Preview Layout
 *
 * Minimal layout for the iframe preview page.
 * Removes dashboard sidebar/header for clean block preview.
 */
export default function PreviewLayout({
  children
}: {
  children: React.ReactNode
}) {
  // Return children directly without any wrapper
  // The parent dashboard layout handles auth, this just strips the chrome
  return <>{children}</>
}
