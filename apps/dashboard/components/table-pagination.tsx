"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"

// Build the list of 1-based page numbers (and ellipsis gaps) to render: the
// classic seven-slot pagination window. The first page, the current page with
// one sibling on each side, the last page, and an ellipsis in each gap, so
// the control reads "1 … 9 10 11 … 17" and keeps a near-constant width at
// every position. Near an edge the window widens so five numbers stay
// visible ("1 2 3 4 5 … 17" / "1 … 13 14 15 16 17"). Every number is a
// loaded, directly-jumpable page. When more cursor pages may still load
// (hasMore) the total is unknown, so the trailing ellipsis takes the right
// boundary's place and stands in for the not-yet-loaded pages (the Next
// arrow loads them): "1 … 9 10 …". Exported for testing.
export function paginationItems(
  current0: number,
  pageCount: number,
  hasMore: boolean
): Array<number | "ellipsis"> {
  const current = current0 + 1 // 1-based for display
  // Everything is loaded and fits without gaps: a plain list.
  if (!hasMore && pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }
  // The sibling window, widened at the edges to keep five numbers visible:
  // near the start it is 2..5; near a KNOWN end it is N-4..N-1 (the
  // boundary pages render separately).
  let start = current - 1
  let end = current + 1
  if (current <= 3) {
    start = 2
    end = 5
  } else if (!hasMore && current >= pageCount - 2) {
    start = pageCount - 4
    end = pageCount - 1
  }
  start = Math.max(start, 2)
  end = Math.min(end, hasMore ? pageCount : pageCount - 1)
  const items: Array<number | "ellipsis"> = [1]
  if (start > 2) items.push("ellipsis")
  for (let page = start; page <= end; page++) items.push(page)
  if (hasMore) {
    items.push("ellipsis")
  } else {
    if (end < pageCount - 1) items.push("ellipsis")
    items.push(pageCount)
  }
  return items
}

// Numbered page control over a client-side pager (useAuditPagination or a
// TanStack pagination row model). Page is 0-based in
// props, rendered 1-based. Every number is a loaded page (jump via onSelect);
// Previous/Next are icon-only and load the next cursor page when needed. Disabled
// links are inert (pointer-events-none).
export function TablePagination({
  page,
  pageCount,
  hasMore,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSelect,
  previousLabel,
  nextLabel,
}: {
  page: number
  pageCount: number
  hasMore: boolean
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onSelect: (page0: number) => void
  previousLabel: string
  nextLabel: string
}) {
  const disabled = "pointer-events-none opacity-50"
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text=""
            aria-label={previousLabel}
            onClick={canPrev ? onPrev : undefined}
            aria-disabled={!canPrev}
            className={canPrev ? "cursor-pointer" : disabled}
          />
        </PaginationItem>
        {paginationItems(page, pageCount, hasMore).map((item, index) =>
          item === "ellipsis" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis positions are stable per render
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={`page-${item}`}>
              <PaginationLink
                isActive={item - 1 === page}
                aria-current={item - 1 === page ? "page" : undefined}
                onClick={
                  item - 1 === page ? undefined : () => onSelect(item - 1)
                }
                className={
                  item - 1 === page ? "pointer-events-none" : "cursor-pointer"
                }
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            text=""
            aria-label={nextLabel}
            onClick={canNext ? onNext : undefined}
            aria-disabled={!canNext}
            className={canNext ? "cursor-pointer" : disabled}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
