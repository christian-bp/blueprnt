// The separator between a page title and the brand in the document <title>.
// Single source so the server metadata template (root layout) and the client
// usePageTitle hook produce an identical tab format: "Roles · blueprnt".
export const TITLE_SEPARATOR = " · "

// Join the page-title segments (dropping empty/loading ones) with the brand.
// `page` is undefined while a dynamic title (a role or family name) is still
// loading, in which case the tab shows the brand alone.
export function formatPageTitle(
  segments: Array<string | undefined>,
  brand: string
): string {
  const page = segments
    .filter((s): s is string => Boolean(s))
    .join(TITLE_SEPARATOR)
  return page ? `${page}${TITLE_SEPARATOR}${brand}` : brand
}
