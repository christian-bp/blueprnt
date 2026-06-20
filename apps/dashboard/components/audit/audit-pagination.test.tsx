import { describe, expect, it } from "vitest"
import { paginationItems } from "@/components/audit/audit-pagination"

describe("paginationItems", () => {
  it("returns every page when the count is small", () => {
    expect(paginationItems(0, 3, false)).toEqual([1, 2, 3])
    expect(paginationItems(1, 3, false)).toEqual([1, 2, 3])
  })

  it("windows around the current page with ellipses for a large count", () => {
    // current = page 5 (0-based 4) of 12: 1 … 4 5 6 … 12
    expect(paginationItems(4, 12, false)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      12,
    ])
  })

  it("omits the leading ellipsis when the window touches page 1", () => {
    // current = page 2 (0-based 1) of 12: 1 2 3 … 12 (gap 3->12)
    expect(paginationItems(1, 12, false)).toEqual([1, 2, 3, "ellipsis", 12])
  })

  it("omits the trailing ellipsis when the window touches the last page", () => {
    // current = page 11 (0-based 10) of 12: 1 … 10 11 12
    expect(paginationItems(10, 12, false)).toEqual([1, "ellipsis", 10, 11, 12])
  })

  it("shows the next loadable page as a number when more pages may exist", () => {
    // One loaded page with more to load: maxPage = 2, so "1 2" (no ellipsis,
    // no standalone trailing ellipsis).
    expect(paginationItems(0, 1, true)).toEqual([1, 2])
    // No more to load: just the loaded page.
    expect(paginationItems(0, 1, false)).toEqual([1])
    // Three loaded pages with more to load, sitting on page 1: maxPage = 4.
    // Window is page 1 and its neighbors (1, 2) plus maxPage (4); the 2->4 gap
    // shows an ellipsis: 1 2 … 4.
    expect(paginationItems(0, 3, true)).toEqual([1, 2, "ellipsis", 4])
    // 11 loaded pages with more to load: maxPage = 12. Window around page 5:
    // 1 … 4 5 6 … 12 (12 is the next loadable page, shown as a number).
    expect(paginationItems(4, 11, true)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      12,
    ])
  })

  it("de-dups when the window overlaps the first/last page", () => {
    // Single page: only page 1, no duplicate from the last-page rule.
    expect(paginationItems(0, 1, false)).toEqual([1])
    // Two pages: 1 2, no ellipsis.
    expect(paginationItems(0, 2, false)).toEqual([1, 2])
  })
})
