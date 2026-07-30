import { describe, expect, it } from "vitest"
import {
  type BulkAssignment,
  packAssignmentChunks,
  selectionState,
} from "./classify-bulk"

const a = (n: number, offset: number = 0): BulkAssignment[] =>
  Array.from({ length: n }, (_, i) => ({
    personId: `p${offset + i}`,
    roleId: "r1",
    level: "IC1",
  }))

describe("selectionState", () => {
  it("prunes selected keys that are no longer actionable", () => {
    const state = selectionState(new Set(["a", "b", "gone"]), ["a", "b", "c"])
    expect([...state.effective].sort()).toEqual(["a", "b"])
  })

  it("is all when every actionable key is selected, some when partial", () => {
    expect(selectionState(new Set(["a", "b"]), ["a", "b"]).all).toBe(true)
    const partial = selectionState(new Set(["a"]), ["a", "b"])
    expect(partial.all).toBe(false)
    expect(partial.some).toBe(true)
  })

  it("is neither all nor some when nothing is selected or nothing is actionable", () => {
    expect(selectionState(new Set(), ["a"]).some).toBe(false)
    const empty = selectionState(new Set(["a"]), [])
    expect(empty.all).toBe(false)
    expect(empty.some).toBe(false)
    expect(empty.effective.size).toBe(0)
  })
})

describe("packAssignmentChunks", () => {
  it("keeps whole groups together within the limit", () => {
    const chunks = packAssignmentChunks([a(20, 0), a(20, 20), a(20, 40)], 50)
    expect(chunks.map((c) => c.length)).toEqual([40, 20])
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[0]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 40 }, (_, i) => `p${i}`)
    )
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[1]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 20 }, (_, i) => `p${40 + i}`)
    )
  })

  it("splits a single group larger than the limit", () => {
    const chunks = packAssignmentChunks([a(120, 0)], 50)
    expect(chunks.map((c) => c.length)).toEqual([50, 50, 20])
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[0]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 50 }, (_, i) => `p${i}`)
    )
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[1]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 50 }, (_, i) => `p${50 + i}`)
    )
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[2]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 20 }, (_, i) => `p${100 + i}`)
    )
  })

  it("closes the running chunk before an oversized group", () => {
    const chunks = packAssignmentChunks([a(10, 0), a(120, 10), a(10, 130)], 50)
    expect(chunks.map((c) => c.length)).toEqual([10, 50, 50, 20, 10])
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[0]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `p${i}`)
    )
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[1]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 50 }, (_, i) => `p${10 + i}`)
    )
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[2]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 50 }, (_, i) => `p${60 + i}`)
    )
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[3]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 20 }, (_, i) => `p${110 + i}`)
    )
    // biome-ignore lint/style/noNonNullAssertion: length verified above
    expect(chunks[4]!.map((a) => a.personId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `p${130 + i}`)
    )
  })

  it("returns no chunks for no assignments", () => {
    expect(packAssignmentChunks([], 50)).toEqual([])
    expect(packAssignmentChunks([[]], 50)).toEqual([])
  })
})
