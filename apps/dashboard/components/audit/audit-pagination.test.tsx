import { describe, expect, it } from "vitest"
import { paginationItems } from "@/components/audit/audit-pagination"

describe("paginationItems", () => {
  it("shows every page when there are at most 9", () => {
    expect(paginationItems(0, 3, false)).toEqual([1, 2, 3])
    expect(paginationItems(2, 3, false)).toEqual([1, 2, 3])
    expect(paginationItems(0, 9, false)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it("appends a trailing ellipsis when more pages can still load", () => {
    // The headline case: nine loaded pages plus more -> 1..9 then ellipsis.
    expect(paginationItems(0, 9, true)).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      "ellipsis",
    ])
    expect(paginationItems(0, 3, true)).toEqual([1, 2, 3, "ellipsis"])
    expect(paginationItems(0, 1, true)).toEqual([1, "ellipsis"])
    expect(paginationItems(0, 1, false)).toEqual([1])
  })

  it("windows around the current page with ellipses beyond nine pages", () => {
    // current = page 5 (0-based 4) of 12: 1 … 3 4 5 6 7 … 12
    expect(paginationItems(4, 12, false)).toEqual([
      1,
      "ellipsis",
      3,
      4,
      5,
      6,
      7,
      "ellipsis",
      12,
    ])
  })

  it("omits the leading ellipsis when the window touches page 1", () => {
    // current = page 2 (0-based 1) of 12: 1 2 3 4 … 12
    expect(paginationItems(1, 12, false)).toEqual([1, 2, 3, 4, "ellipsis", 12])
  })

  it("omits the trailing window ellipsis when it touches the last page", () => {
    // current = page 12 (0-based 11) of 12: 1 … 10 11 12
    expect(paginationItems(11, 12, false)).toEqual([1, "ellipsis", 10, 11, 12])
  })

  it("adds the load-more ellipsis after the window when beyond nine", () => {
    expect(paginationItems(4, 12, true)).toEqual([
      1,
      "ellipsis",
      3,
      4,
      5,
      6,
      7,
      "ellipsis",
      12,
      "ellipsis",
    ])
  })
})
