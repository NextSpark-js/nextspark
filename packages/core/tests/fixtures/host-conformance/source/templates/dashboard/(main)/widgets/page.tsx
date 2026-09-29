// The project's own list page for the widgets entity: composed into the generated route, after core's checks.
export default async function WidgetsList({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params
  return <h1 data-probe="project-widgets-list">Project list for {entity}</h1>
}
