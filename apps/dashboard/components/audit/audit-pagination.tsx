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

// Build the windowed list of 1-based page numbers (and ellipsis gaps) to render
// for the current page. Always shows the first and the last loaded page, plus
// the current page and its immediate neighbors; "ellipsis" marks a gap > 1
// between consecutive shown pages. A trailing "ellipsis" is appended when more,
// not-yet-loaded pages may exist (hasMore). Exported for testing.
export function paginationItems(
  current0: number,
  pageCount: number,
  hasMore: boolean
): Array<number | "ellipsis"> {
  const current = current0 + 1 // 1-based for display
  const shown = new Set<number>()
  shown.add(1)
  shown.add(pageCount)
  for (const page of [current - 1, current, current + 1]) {
    if (page >= 1 && page <= pageCount) shown.add(page)
  }
  const pages = Array.from(shown).sort((a, b) => a - b)
  const items: Array<number | "ellipsis"> = []
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] as number
    if (i > 0) {
      const prev = pages[i - 1] as number
      if (page - prev > 1) items.push("ellipsis")
    }
    items.push(page)
  }
  if (hasMore) items.push("ellipsis")
  return items
}

// Numbered page control over the audit pagination hook. Page is 0-based in
// props, rendered 1-based. Previous/Next are icon-only; disabled links are inert
// (pointer-events-none).
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
