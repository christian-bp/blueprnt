// Pure paging math for the audit log's two data modes: browse (the server
// returns one page of rows plus the exact total) and search (the server
// returns up to 50 rows whole; they page client-side). Extracted from the
// section component so the derivation is unit-testable.
export type AuditPageView<Row> = {
  // Rows matching the active filter, across all pages.
  total: number
  // Always at least 1, so the pager math never divides into an empty range.
  pageCount: number
  // The requested page clamped into [0, pageCount - 1]: a reactive shrink
  // (an erased operator dropping search hits mid-view) must never strand the
  // pager past the end with its controls hidden.
  shownPage: number
  // The rows to render for shownPage.
  pageRows: Row[]
}

// The keep-previous-rows cache decision for the browse query, extracted so
// its invalidation rules are unit-testable. The cache keeps the last loaded
// page's rows visible while the NEXT page loads (no skeleton flash on a page
// flip), and must be dropped EAGERLY (not merely ignored) whenever the filter
// key changes or the browse query is skipped for search: a kept-but-ignored
// cache would resurface stale rows when a filter combination round-trips
// (e.g. entering and clearing a search), because the key would match again
// while the rows belong to an old page.
export type BrowseCache<T> = { key: string; value: T } | null

export function nextBrowseCache<T>(
  current: BrowseCache<T>,
  args: { filterKey: string; isSearching: boolean; result: T | undefined }
): BrowseCache<T> {
  let cache = current
  if (cache !== null && cache.key !== args.filterKey) cache = null
  if (args.isSearching) cache = null
  if (args.result !== undefined) {
    cache = { key: args.filterKey, value: args.result }
  }
  return cache
}

export function auditPageView<Row>(args: {
  isSearching: boolean
  searchRows: Row[]
  browse: { rows: Row[]; total: number } | undefined
  page: number
  pageSize: number
}): AuditPageView<Row> {
  const total = args.isSearching
    ? args.searchRows.length
    : (args.browse?.total ?? 0)
  const pageCount = Math.max(1, Math.ceil(total / args.pageSize))
  const shownPage = Math.max(0, Math.min(args.page, pageCount - 1))
  const pageRows = args.isSearching
    ? args.searchRows.slice(
        shownPage * args.pageSize,
        (shownPage + 1) * args.pageSize
      )
    : (args.browse?.rows ?? [])
  return { total, pageCount, shownPage, pageRows }
}
