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

  it("appends a trailing ellipsis when more pages may exist", () => {
    expect(paginationItems(0, 3, true)).toEqual([1, 2, 3, "ellipsis"])
    // The windowing ellipsis before page 12 plus a further trailing ellipsis
    // for the unknown not-yet-loaded pages.
    expect(paginationItems(4, 12, true)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      12,
      "ellipsis",
    ])
  })

  it("de-dups when the window overlaps the first/last page", () => {
    // Single page: only page 1, no duplicate from the last-page rule.
    expect(paginationItems(0, 1, false)).toEqual([1])
    // Two pages: 1 2, no ellipsis.
    expect(paginationItems(0, 2, false)).toEqual([1, 2])
  })
})
