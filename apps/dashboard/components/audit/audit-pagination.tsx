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

// How many page numbers to show before collapsing to ellipses.
const MAX_NUMBERS = 9

// Build the list of 1-based page numbers (and ellipsis gaps) to render. Every
// number is a loaded, directly-jumpable page. When there are at most MAX_NUMBERS
// loaded pages they are all shown; beyond that, the first and last loaded page
// are kept and a window around the current page is shown, with "ellipsis" for the
// gaps. A trailing "ellipsis" is appended when more, not-yet-loaded cursor pages
// may still exist (hasMore), so the control reads e.g. "1 2 3 4 5 6 7 8 9 ...".
// Exported for testing.
export function paginationItems(
  current0: number,
  pageCount: number,
  hasMore: boolean
): Array<number | "ellipsis"> {
  const current = current0 + 1 // 1-based for display
  const items: Array<number | "ellipsis"> = []
  if (pageCount <= MAX_NUMBERS) {
    for (let page = 1; page <= pageCount; page++) items.push(page)
  } else {
    const siblings = 2
    const start = Math.max(2, current - siblings)
    const end = Math.min(pageCount - 1, current + siblings)
    items.push(1)
    if (start > 2) items.push("ellipsis")
    for (let page = start; page <= end; page++) items.push(page)
    if (end < pageCount - 1) items.push("ellipsis")
    items.push(pageCount)
  }
  // More cursor pages may exist beyond the last loaded one; the Next arrow loads
  // them. The trailing ellipsis signals there is more than what is numbered.
  if (hasMore) items.push("ellipsis")
  return items
}

// Numbered page control over the audit pagination hook. Page is 0-based in
// props, rendered 1-based. Every number is a loaded page (jump via onSelect);
// Previous/Next are icon-only and load the next cursor page when needed. Disabled
// links are inert (pointer-events-none).
export function AuditPagination({
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
