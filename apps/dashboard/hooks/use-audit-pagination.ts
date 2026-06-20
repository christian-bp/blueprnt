import { useEffect, useState } from "react"

// Client-side paging over an audit log's currently-available rows. For a browse
// query the rows grow via loadMore (cursor pagination); for a search query they
// are the (capped) result set. Advancing past the loaded browse rows fetches the
// next cursor page. The page resets to 0 whenever resetKey changes (filter or
// search/mode switch).
export function useAuditPagination<T>(opts: {
  rows: T[]
  pageSize: number
  canLoadMore: boolean
  isLoadingMore: boolean
  loadMore: (n: number) => void
  resetKey: unknown
}): {
  pageRows: T[]
  page: number
  pageCount: number
  hasMore: boolean
  canPrev: boolean
  canNext: boolean
  goPrev: () => void
  goNext: () => void
  goTo: (page0: number) => void
  loadNext: () => void
} {
  const { rows, pageSize, canLoadMore, isLoadingMore, loadMore, resetKey } =
    opts
  const [page, setPage] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on key change
  useEffect(() => setPage(0), [resetKey])
  const start = page * pageSize
  const pageRows = rows.slice(start, start + pageSize)
  // Pages over the currently-loaded rows (at least one, even when empty); more,
  // not-yet-loaded cursor pages may still exist (hasMore).
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const hasMore = canLoadMore
  const canPrev = page > 0
  const canNext = start + pageSize < rows.length || canLoadMore
  const goPrev = () => setPage((p) => Math.max(0, p - 1))
  const goNext = () => {
    const nextStart = (page + 1) * pageSize
    if (nextStart < rows.length) {
      setPage((p) => p + 1)
    } else if (canLoadMore && !isLoadingMore) {
      loadMore(pageSize)
      setPage((p) => p + 1)
    }
  }
  // Jump to a loaded page (clamped). Only loaded pages are ever offered, so this
  // never targets an unloaded cursor page.
  const goTo = (page0: number) =>
    setPage(Math.max(0, Math.min(pageCount - 1, page0)))
  // Load the next cursor page and jump to it. Cursor pagination only reveals one
  // page ahead at a time, so the next-loadable page (index = pageCount) is the
  // farthest reachable in one step.
  const loadNext = () => {
    if (canLoadMore && !isLoadingMore) {
      loadMore(pageSize)
      setPage(pageCount)
    }
  }
  return {
    pageRows,
    page,
    pageCount,
    hasMore,
    canPrev,
    canNext,
    goPrev,
    goNext,
    goTo,
    loadNext,
  }
}
