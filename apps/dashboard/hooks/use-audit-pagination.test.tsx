import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAuditPagination } from "@/hooks/use-audit-pagination"

const rows10 = Array.from({ length: 10 }, (_, i) => i)

describe("useAuditPagination", () => {
  afterEach(() => {
    cleanup()
  })

  it("pages within the loaded rows without loading more", () => {
    const loadMore = vi.fn()
    const { result } = renderHook(() =>
      useAuditPagination({
        rows: rows10,
        pageSize: 4,
        canLoadMore: false,
        isLoadingMore: false,
        loadMore,
        resetKey: "k",
      })
    )

    expect(result.current.pageRows).toEqual([0, 1, 2, 3])
    expect(result.current.canPrev).toBe(false)
    expect(result.current.canNext).toBe(true)
    // 10 rows / 4 per page = 3 pages; nothing more to load.
    expect(result.current.pageCount).toBe(3)
    expect(result.current.hasMore).toBe(false)

    act(() => result.current.goNext())
    expect(result.current.page).toBe(1)
    expect(result.current.pageRows).toEqual([4, 5, 6, 7])
    expect(result.current.canPrev).toBe(true)
    expect(loadMore).not.toHaveBeenCalled()

    // Final page is short; with no more to load, canNext is false there.
    act(() => result.current.goNext())
    expect(result.current.pageRows).toEqual([8, 9])
    expect(result.current.canNext).toBe(false)

    act(() => result.current.goPrev())
    expect(result.current.page).toBe(1)
    expect(result.current.pageRows).toEqual([4, 5, 6, 7])
  })

  it("goNext past the loaded rows triggers loadMore and advances", () => {
    const loadMore = vi.fn()
    const { result } = renderHook(() =>
      useAuditPagination({
        rows: [0, 1, 2, 3],
        pageSize: 4,
        canLoadMore: true,
        isLoadingMore: false,
        loadMore,
        resetKey: "k",
      })
    )

    // Sitting on the last loaded page; canNext is true because more can load.
    expect(result.current.page).toBe(0)
    expect(result.current.canNext).toBe(true)
    // One loaded page, but more cursor pages may exist.
    expect(result.current.pageCount).toBe(1)
    expect(result.current.hasMore).toBe(true)

    act(() => result.current.goNext())
    expect(loadMore).toHaveBeenCalledWith(4)
    expect(result.current.page).toBe(1)
  })

  it("loadNext loads the next cursor page and jumps to it", () => {
    const loadMore = vi.fn()
    const { result } = renderHook(() =>
      useAuditPagination({
        rows: rows10,
        pageSize: 4,
        canLoadMore: true,
        isLoadingMore: false,
        loadMore,
        resetKey: "k",
      })
    )

    // 10 rows / 4 per page = 3 loaded pages; the next loadable page is index 3.
    expect(result.current.pageCount).toBe(3)
    act(() => result.current.loadNext())
    expect(loadMore).toHaveBeenCalledWith(4)
    expect(result.current.page).toBe(3)
  })

  it("loadNext is a no-op when nothing more can load", () => {
    const loadMore = vi.fn()
    const { result } = renderHook(() =>
      useAuditPagination({
        rows: rows10,
        pageSize: 4,
        canLoadMore: false,
        isLoadingMore: false,
        loadMore,
        resetKey: "k",
      })
    )

    act(() => result.current.loadNext())
    expect(loadMore).not.toHaveBeenCalled()
    expect(result.current.page).toBe(0)
  })

  it("loadNext is a no-op while a page is already loading", () => {
    const loadMore = vi.fn()
    const { result } = renderHook(() =>
      useAuditPagination({
        rows: rows10,
        pageSize: 4,
        canLoadMore: true,
        isLoadingMore: true,
        loadMore,
        resetKey: "k",
      })
    )

    act(() => result.current.loadNext())
    expect(loadMore).not.toHaveBeenCalled()
    expect(result.current.page).toBe(0)
  })

  it("goTo jumps to a loaded page and clamps out-of-range targets", () => {
    const loadMore = vi.fn()
    const { result } = renderHook(() =>
      useAuditPagination({
        rows: rows10,
        pageSize: 4,
        canLoadMore: false,
        isLoadingMore: false,
        loadMore,
        resetKey: "k",
      })
    )

    act(() => result.current.goTo(2))
    expect(result.current.page).toBe(2)
    expect(result.current.pageRows).toEqual([8, 9])

    // Past the last page clamps to the last; negative clamps to the first.
    act(() => result.current.goTo(9))
    expect(result.current.page).toBe(2)
    act(() => result.current.goTo(-1))
    expect(result.current.page).toBe(0)
    expect(loadMore).not.toHaveBeenCalled()
  })

  it("does not call loadMore while a page is already loading", () => {
    const loadMore = vi.fn()
    const { result } = renderHook(() =>
      useAuditPagination({
        rows: [0, 1, 2, 3],
        pageSize: 4,
        canLoadMore: true,
        isLoadingMore: true,
        loadMore,
        resetKey: "k",
      })
    )

    act(() => result.current.goNext())
    expect(loadMore).not.toHaveBeenCalled()
    expect(result.current.page).toBe(0)
  })

  it("resets the page to 0 when resetKey changes", () => {
    const loadMore = vi.fn()
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useAuditPagination({
          rows: rows10,
          pageSize: 4,
          canLoadMore: false,
          isLoadingMore: false,
          loadMore,
          resetKey: key,
        }),
      { initialProps: { key: "a" } }
    )

    act(() => result.current.goNext())
    expect(result.current.page).toBe(1)

    rerender({ key: "b" })
    expect(result.current.page).toBe(0)
    expect(result.current.pageRows).toEqual([0, 1, 2, 3])
  })

  it("goPrev never goes below the first page", () => {
    const loadMore = vi.fn()
    const { result } = renderHook(() =>
      useAuditPagination({
        rows: rows10,
        pageSize: 4,
        canLoadMore: false,
        isLoadingMore: false,
        loadMore,
        resetKey: "k",
      })
    )

    act(() => result.current.goPrev())
    expect(result.current.page).toBe(0)
    expect(result.current.canPrev).toBe(false)
  })
})
