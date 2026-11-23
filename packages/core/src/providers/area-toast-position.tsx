/**
 * Toasts at the bottom right inside /devtools and /superadmin, whose sidebar footer the bottom-left default covers (#537).
 *
 * The one toaster is the root layout's (or the area's DashboardProviders when the root has none), mounted bottom-left for
 * the dashboard and the public pages. Mounting a second one here would show every toast twice, so the area moves the
 * existing one with a rule that exists only while an area layout is rendered: it is gone when the user leaves for the
 * dashboard, and nothing changes in the JavaScript or the markup of any other route.
 */
export const AREA_TOAST_RULES =
  "[data-sonner-toaster][data-x-position='left']{left:auto;right:var(--offset-right)}" +
  "[data-sonner-toast][data-x-position='left']{left:auto;right:0}"

export function AreaToastPosition() {
  return <style data-cy="area-toast-position">{AREA_TOAST_RULES}</style>
}
