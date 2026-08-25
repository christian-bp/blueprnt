import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  MATRIX_COL_HEADER_CLASS,
  MATRIX_COL_RULE_CLASS,
  MATRIX_HEAD_PAD_CLASS,
  MATRIX_WRAPPER_CLASS,
  MATRIX_ZONE_RULE_CLASS,
} from "@/components/levels/matrix-chrome"

const MATRICES = ["level-matrix.tsx", "family-level-matrix.tsx"] as const

function source(file: string): string {
  return readFileSync(join(__dirname, file), "utf8")
}

describe("matrix chrome", () => {
  // THE HORIZONTAL BAR IS THE WHOLE POINT, and it cannot be pinned by
  // rendering: Base UI mounts a scrollbar only after it MEASURES overflow,
  // and jsdom measures nothing, so a matrix that quietly lost its horizontal
  // orientation would render an identical tree in every DOM test. The source
  // is what carries the intent, so the source is what is pinned.
  it.each(MATRICES)("scrolls %s in both axes", (file) => {
    const text = source(file)
    expect(text).toContain('<ScrollArea orientation="both"')
    expect(text).toContain("className={MATRIX_WRAPPER_CLASS}")
    // And nothing re-hands the scroll to a bare div beside it.
    expect(text).not.toContain("overflow-auto")
  })

  // The wrapper fills its panel and sets no overflow of its own: the
  // ScrollArea's viewport is the scrollport, and a second scroll container
  // around it would take the sticky headers off their anchor.
  it("leaves the scrolling to the scroll area", () => {
    expect(MATRIX_WRAPPER_CLASS).toBe("min-h-0 flex-1")
  })

  // One left edge for both header rows. The zone band sat at px-2 while the
  // level row sat at 0, so a zone label started 8px right of the level label
  // beneath it.
  it("insets every column header identically", () => {
    expect(MATRIX_HEAD_PAD_CLASS).toContain("px-2")
    const text = source("family-level-matrix.tsx")
    // Both header rows use it, and only they: the import does not count.
    const heads = text.match(/\$\{MATRIX_HEAD_PAD_CLASS\}/g) ?? []
    expect(heads.length).toBe(2)
    // Neither header row keeps a horizontal inset of its own beside it.
    expect(text).not.toContain("whitespace-nowrap px-2 py-1 text-left")
  })

  // TWO ORDERS OF DIVISION, and they must stay distinguishable. The level
  // rule is the app's border ink at 60%; the zone rule is the same ink at
  // full strength AND runs the height of the grid instead of hanging from the
  // header. Ink alone is a difference a reader has to hunt for.
  it("draws the zone rule heavier than the level rule", () => {
    expect(MATRIX_COL_RULE_CLASS).toContain("border-border/60")
    expect(MATRIX_ZONE_RULE_CLASS).toContain("bg-border")
    expect(MATRIX_ZONE_RULE_CLASS).not.toContain("/60")
    // It reaches down through the border-spacing gutter to meet the next
    // row's, which is what turns segments into one line.
    expect(MATRIX_ZONE_RULE_CLASS).toContain("after:-bottom-2")
    // And it adds no box, so a boundary column's label does not shift.
    expect(MATRIX_ZONE_RULE_CLASS).not.toMatch(/(^|\s)border-l/)
  })

  // THE MATRIS TAB GETS NONE. Zones are its VERTICAL axis, already drawn as
  // row bands; a vertical rule there would divide the tracks, which zones
  // have nothing to do with. The rule means something only where levels run
  // horizontally, which is the families view alone.
  it("keeps the zone rule out of the levels x tracks matrix", () => {
    expect(source("level-matrix.tsx")).not.toContain("MATRIX_ZONE_RULE_CLASS")
    expect(source("level-matrix.tsx")).not.toContain("zoneBoundaryIndexes")
    expect(source("family-level-matrix.tsx")).toContain(
      "MATRIX_ZONE_RULE_CLASS"
    )
  })

  it("keeps the sticky header on the header cells", () => {
    expect(MATRIX_COL_HEADER_CLASS).toContain("sticky")
    for (const file of MATRICES) {
      expect(source(file)).toContain("MATRIX_COL_HEADER_CLASS")
    }
  })
})
