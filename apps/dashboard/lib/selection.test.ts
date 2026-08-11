import { describe, expect, it } from "vitest"
import { selectionState } from "./selection"

describe("selectionState", () => {
  it("prunes selected keys that are no longer selectable", () => {
    const state = selectionState(new Set(["a", "b", "gone"]), ["a", "b", "c"])
    expect([...state.effective].sort()).toEqual(["a", "b"])
  })

  it("is all when every selectable key is selected, some when partial", () => {
    expect(selectionState(new Set(["a", "b"]), ["a", "b"]).all).toBe(true)
    const partial = selectionState(new Set(["a"]), ["a", "b"])
    expect(partial.all).toBe(false)
    expect(partial.some).toBe(true)
  })

  it("is neither all nor some when nothing is selected or nothing is selectable", () => {
    expect(selectionState(new Set(), ["a"]).some).toBe(false)
    const empty = selectionState(new Set(["a"]), [])
    expect(empty.all).toBe(false)
    expect(empty.some).toBe(false)
    expect(empty.effective.size).toBe(0)
  })

  // The people register asks the helper two different questions about ONE
  // selection: the header checkbox reads the current page, and the bulk action
  // reads the whole filtered set. A selection spanning both pages is "all" for
  // a fully selected page while still only "some" of the filtered rows.
  it("answers page-scoped and filtered-scoped questions from the same selection", () => {
    const selected = new Set(["p1", "p2", "p5"])
    const page = ["p1", "p2"]
    const filtered = ["p1", "p2", "p3", "p4", "p5"]

    const pageState = selectionState(selected, page)
    expect(pageState.all).toBe(true)
    expect(pageState.some).toBe(false)

    const filteredState = selectionState(selected, filtered)
    expect(filteredState.all).toBe(false)
    expect(filteredState.some).toBe(true)
    expect([...filteredState.effective].sort()).toEqual(["p1", "p2", "p5"])
  })

  // Order follows the selectable list, not the insertion order of the Set, so
  // the ids handed to a bulk action are deterministic.
  it("orders the effective set by the selectable list", () => {
    const state = selectionState(new Set(["c", "a", "b"]), ["a", "b", "c"])
    expect([...state.effective]).toEqual(["a", "b", "c"])
  })
})
