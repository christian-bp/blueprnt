"use client"

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"

// Previous / current-page / Next control over the audit pagination hook. Page
// number is 1-based for display. Disabled links are inert (pointer-events-none).
export function AuditPagination({
  page,
  canPrev,
  canNext,
  onPrev,
  onNext,
  previousLabel,
  nextLabel,
}: {
  page: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  previousLabel: string
  nextLabel: string
}) {
  const disabled = "pointer-events-none opacity-50"
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={previousLabel}
            aria-label={previousLabel}
            onClick={canPrev ? onPrev : undefined}
            aria-disabled={!canPrev}
            className={canPrev ? "cursor-pointer" : disabled}
          />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink
            isActive
            aria-current="page"
            className="pointer-events-none"
          >
            {page + 1}
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            text={nextLabel}
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
