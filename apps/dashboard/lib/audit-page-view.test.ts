import { describe, expect, it } from "vitest"
import {
  auditPageView,
  type BrowseCache,
  nextBrowseCache,
} from "./audit-page-view"

const rows = (count: number) => Array.from({ length: count }, (_, i) => i)

describe("auditPageView", () => {
  it("passes browse pages through with the server's total", () => {
    const view = auditPageView({
      isSearching: false,
      searchRows: [],
      browse: { rows: rows(25), total: 410 },
      page: 3,
      pageSize: 25,
    })
    expect(view.total).toBe(410)
    expect(view.pageCount).toBe(17)
    expect(view.shownPage).toBe(3)
    expect(view.pageRows).toHaveLength(25)
  })

  it("treats a still-loading browse as empty with one page", () => {
    const view = auditPageView({
      isSearching: false,
      searchRows: [],
      browse: undefined,
      page: 0,
      pageSize: 25,
    })
    expect(view.total).toBe(0)
    expect(view.pageCount).toBe(1)
    expect(view.pageRows).toHaveLength(0)
  })

  it("slices search rows client-side by the shown page", () => {
    const view = auditPageView({
      isSearching: true,
      searchRows: rows(30),
      browse: undefined,
      page: 1,
      pageSize: 25,
    })
    expect(view.total).toBe(30)
    expect(view.pageCount).toBe(2)
    expect(view.shownPage).toBe(1)
    expect(view.pageRows).toEqual(rows(30).slice(25))
  })

  it("clamps the page when the result set shrinks under the pager", () => {
    // On page 2 of search hits that reactively shrink to 20 rows (an erased
    // operator): the view must fall back to the last real page, not render
    // an empty slice with the pager stuck past the end.
    const view = auditPageView({
      isSearching: true,
      searchRows: rows(20),
      browse: undefined,
      page: 1,
      pageSize: 25,
    })
    expect(view.pageCount).toBe(1)
    expect(view.shownPage).toBe(0)
    expect(view.pageRows).toHaveLength(20)
  })

  it("keeps pageCount at 1 for an empty result", () => {
    const view = auditPageView({
      isSearching: true,
      searchRows: [],
      browse: undefined,
      page: 4,
      pageSize: 25,
    })
    expect(view.total).toBe(0)
    expect(view.pageCount).toBe(1)
    expect(view.shownPage).toBe(0)
    expect(view.pageRows).toHaveLength(0)
  })
})

describe("nextBrowseCache", () => {
  const loaded = { rows: ["a"], total: 1 }

  it("keeps the cache across a page flip (same key, next page loading)", () => {
    const cache: BrowseCache<typeof loaded> = { key: "X", value: loaded }
    expect(
      nextBrowseCache(cache, {
        filterKey: "X",
        isSearching: false,
        result: undefined,
      })
    ).toBe(cache)
  })

  it("stores each loaded result under the current key", () => {
    expect(
      nextBrowseCache(null, {
        filterKey: "X",
        isSearching: false,
        result: loaded,
      })
    ).toEqual({ key: "X", value: loaded })
  })

  it("drops the cache when the filter key changes", () => {
    const cache: BrowseCache<typeof loaded> = { key: "X", value: loaded }
    expect(
      nextBrowseCache(cache, {
        filterKey: "Y",
        isSearching: false,
        result: undefined,
      })
    ).toBeNull()
  })

  it("drops the cache while searching, so a search round-trip cannot resurface stale rows", () => {
    // Browse on key X (cache holds page rows) -> enter search (query skipped,
    // key changes) -> clear the search (key returns to X). Without the eager
    // drop during search, the returning key would match the stale cache and
    // old page rows would flash under page 1.
    let cache: BrowseCache<typeof loaded> = { key: "X", value: loaded }
    cache = nextBrowseCache(cache, {
      filterKey: "Y",
      isSearching: true,
      result: undefined,
    })
    cache = nextBrowseCache(cache, {
      filterKey: "X",
      isSearching: false,
      result: undefined,
    })
    expect(cache).toBeNull()
  })
})
