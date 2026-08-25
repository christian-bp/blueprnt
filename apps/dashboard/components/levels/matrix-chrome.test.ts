import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  MATRIX_COL_HEADER_CLASS,
  MATRIX_COL_RULE_CLASS,
  MATRIX_HEAD_INSET_CLASS,
  MATRIX_ZONE_GAP_CLASS,
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
  // rule is the border ink at 60% and 1px, in an 8px gutter; the zone rule is
  // full ink, 2px, and has a column of its own. Ink alone is a difference a
  // reader has to hunt for.
  it("draws the zone rule heavier than the level rule", () => {
    expect(MATRIX_COL_RULE_CLASS).toContain("after:bg-border/60")
    expect(MATRIX_COL_RULE_CLASS).toContain("after:w-px")
    expect(MATRIX_ZONE_RULE_CLASS).toContain("after:bg-border")
    expect(MATRIX_ZONE_RULE_CLASS).not.toContain("/60")
    expect(MATRIX_ZONE_RULE_CLASS).toContain("after:w-0.5")
    // Only the zone rule bridges the border-spacing to the row below, which
    // is what turns its segments into one line.
    expect(MATRIX_ZONE_RULE_CLASS).toContain("after:-bottom-2")
    expect(MATRIX_COL_RULE_CLASS).toContain("after:bottom-0")
  })

  // EQUAL SPACE ON BOTH SIDES, and enough of it that the zones read as
  // separated groups.
  //
  // The level rule divides two adjacent columns, so it sits at the midpoint
  // of their 26px clear space (9px inset + 8px border-spacing + 9px inset);
  // drawn as a border it sat on one column's edge instead, 16px from the
  // label on its left and 8px from the one on its right.
  //
  // The zone rule has a 12px column to itself, so its clear space is
  // 9 + 8 + 12 + 8 + 9 = 46px, and a 2px rule down the middle of that column
  // leaves 22px on each side. Neither rule adds a box that could shift a
  // label.
  it("centres both rules, and gives the zone boundary its air", () => {
    for (const rule of [MATRIX_COL_RULE_CLASS, MATRIX_ZONE_RULE_CLASS]) {
      expect(rule).toContain("after:absolute")
      expect(rule).not.toMatch(/(^|\s)border-/)
    }
    // 1px at the midpoint of an even 26px gap: 13/12, as close as odd sits.
    expect(MATRIX_COL_RULE_CLASS).toContain("after:-left-1")
    // 2px down the middle of its own 12px column: 5px in, 22px of clear
    // space on each side.
    expect(MATRIX_ZONE_GAP_CLASS).toContain("w-3")
    expect(MATRIX_ZONE_GAP_CLASS).toContain("p-0")
    expect(MATRIX_ZONE_RULE_CLASS).toContain("after:left-[5px]")
    // Positive, not negative: it is centred in its OWN column, not reaching
    // back into the gutter of the column beside it.
    expect(MATRIX_ZONE_RULE_CLASS).not.toContain("-left-")
  })

  // The 26px is not an accident either: a header cell insets its content by
  // 9px on BOTH sides, matching a body cell's border plus p-2, so one offset
  // centres a rule in the header and in the body alike.
  it("insets a header cell symmetrically", () => {
    expect(MATRIX_HEAD_INSET_CLASS).toContain("border-x")
    expect(MATRIX_HEAD_INSET_CLASS).toContain("border-transparent")
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
