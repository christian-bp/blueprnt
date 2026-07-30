import { describe, expect, it } from "vitest"
import { paginationItems } from "@/components/table-pagination"

// The control renders the classic seven-slot window: first page, current
// page with one sibling each side, last page, ellipses in the gaps; with an
// unknown tail (hasMore) the trailing ellipsis replaces the right boundary.
describe("paginationItems", () => {
  it("shows every page when everything is loaded and fits without gaps", () => {
    expect(paginationItems(0, 1, false)).toEqual([1])
    expect(paginationItems(0, 3, false)).toEqual([1, 2, 3])
    expect(paginationItems(2, 3, false)).toEqual([1, 2, 3])
    expect(paginationItems(0, 7, false)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("caps the start-of-list window at five numbers when more pages can load", () => {
    // The old control showed all nine loaded pages here ("1 2 3 … 9 …").
    expect(paginationItems(0, 9, true)).toEqual([1, 2, 3, 4, 5, "ellipsis"])
    expect(paginationItems(2, 9, true)).toEqual([1, 2, 3, 4, 5, "ellipsis"])
  })

  it("keeps short unknown-total lists plain, with the trailing load-more ellipsis", () => {
    expect(paginationItems(0, 1, true)).toEqual([1, "ellipsis"])
    expect(paginationItems(0, 3, true)).toEqual([1, 2, 3, "ellipsis"])
    expect(paginationItems(3, 4, true)).toEqual([
      1,
      "ellipsis",
      3,
      4,
      "ellipsis",
    ])
  })

  it("windows one sibling around a mid-list page with both boundaries", () => {
    // current = page 10 (0-based 9) of 17: 1 … 9 10 11 … 17
    expect(paginationItems(9, 17, false)).toEqual([
      1,
      "ellipsis",
      9,
      10,
      11,
      "ellipsis",
      17,
    ])
  })

  it("widens the window near the start so five numbers stay visible", () => {
    // current = page 2 (0-based 1) of 17: 1 2 3 4 5 … 17
    expect(paginationItems(1, 17, false)).toEqual([
      1,
      2,
      3,
      4,
      5,
      "ellipsis",
      17,
    ])
  })

  it("widens the window near the known end so five numbers stay visible", () => {
    // current = page 17 (0-based 16) of 17: 1 … 13 14 15 16 17
    expect(paginationItems(16, 17, false)).toEqual([
      1,
      "ellipsis",
      13,
      14,
      15,
      16,
      17,
    ])
    // current = page 15 (0-based 14) of 17 sits inside the same widened window.
    expect(paginationItems(14, 17, false)).toEqual([
      1,
      "ellipsis",
      13,
      14,
      15,
      16,
      17,
    ])
  })

  it("replaces the right boundary with the load-more ellipsis at the loading frontier", () => {
    // current = the last loaded page (10) with more to load: 1 … 9 10 …
    // (the old control rendered "1 … 8 9 10 … " with a two-back window).
    expect(paginationItems(9, 10, true)).toEqual([
      1,
      "ellipsis",
      9,
      10,
      "ellipsis",
    ])
  })

  it("windows mid-list with an unknown tail when pages past current are loaded", () => {
    // current = page 10 (0-based 9) of 17 loaded, more to load: 1 … 9 10 11 …
    expect(paginationItems(9, 17, true)).toEqual([
      1,
      "ellipsis",
      9,
      10,
      11,
      "ellipsis",
    ])
  })
})
