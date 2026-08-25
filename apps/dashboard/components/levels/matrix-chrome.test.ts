import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  MATRIX_COL_HEADER_CLASS,
  MATRIX_COL_RULE_CLASS,
  MATRIX_HEAD_INSET_CLASS,
  MATRIX_ZONE_GAP_CLASS,
  MATRIX_ZONE_RULE_DASH,
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

  // TWO ORDERS OF DIVISION, distinguished by PATTERN and EXTENT rather than
  // by weight. The level rule is a solid 1px tick in the header; the zone
  // rule is a 1px DASHED line running the whole grid. Both are 1px now, so
  // the dash and the length are what separate them, which is what "less
  // prominent" asked for: the boundary reads from its continuity instead of
  // from its ink.
  it("dashes the zone rule and leaves the level rule solid", () => {
    expect(MATRIX_ZONE_RULE_CLASS).toContain("w-px")
    // THE INK, with its ceiling, measured by painting each colour over the
    // card and reading the pixel (these tokens compute to oklab, where a
    // colour string tells you nothing). The cells' own solid edges sit at
    // 1.26 contrast and the level rule at 1.15; the dash at the border token
    // averaged 1.11 over its length and disappeared into the paper.
    // foreground/15 reads 1.40 per dash and averages 1.17. foreground/20
    // would average 1.25, which IS the cell borders, so the boundary would
    // stop being an annotation and become a second grid.
    expect(MATRIX_ZONE_RULE_CLASS).toContain("text-foreground/15")
    expect(MATRIX_ZONE_RULE_CLASS).not.toContain("text-border")
    expect(MATRIX_ZONE_RULE_CLASS).not.toContain("w-0.5")
    expect(MATRIX_ZONE_RULE_DASH).toContain("repeating-linear-gradient")
    // The app's reference-line rhythm, not the browser's border-dashed one.
    expect(MATRIX_ZONE_RULE_DASH).toContain("currentColor 0 3px")
    expect(MATRIX_ZONE_RULE_DASH).toContain("transparent 3px 7px")
    // The level rule stays solid: a second dashed line would leave the two
    // orders with only their length to tell them apart.
    expect(MATRIX_COL_RULE_CLASS).not.toContain("gradient")
    expect(MATRIX_COL_RULE_CLASS).toContain("after:bg-border/60")
  })

  // ONE ELEMENT PER BOUNDARY, spanning the table. A gradient restarts its
  // phase in every box it paints, and no row here is a multiple of the 7px
  // period, so a segment per row would break the pattern at every joint.
  it("draws the zone rule as one full-height element", () => {
    expect(MATRIX_ZONE_RULE_CLASS).toContain("absolute")
    expect(MATRIX_ZONE_RULE_CLASS).toContain("top-0")
    expect(MATRIX_ZONE_RULE_CLASS).toContain("bottom-0")
    // Placed by its STATIC position, so it needs no measurement to find its
    // column: left and right stay auto.
    expect(MATRIX_ZONE_RULE_CLASS).not.toMatch(/(^|\s)-?left-(?!\[)/)
    expect(MATRIX_ZONE_RULE_CLASS).toContain("ml-[5px]")
    // And it never eats a click meant for the grid under it.
    expect(MATRIX_ZONE_RULE_CLASS).toContain("pointer-events-none")
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
  // 9 + 8 + 12 + 8 + 9 = 46px, and a 1px rule 5px into that column leaves
  // 22px on each side.
  it("centres both rules, and gives the zone boundary its air", () => {
    expect(MATRIX_COL_RULE_CLASS).toContain("after:absolute")
    expect(MATRIX_COL_RULE_CLASS).not.toMatch(/(^|\s)border-/)
    // 1px at the midpoint of an even 26px gap: 13/12, as close as odd sits.
    expect(MATRIX_COL_RULE_CLASS).toContain("after:-left-1")
    // 11px of air, with the line 5px into it: 22px of clear space each side.
    // Odd on purpose: a 1px rule cannot centre in an even column, and at 12px
    // the boundary measured 22 left against 23 right.
    expect(MATRIX_ZONE_GAP_CLASS).toContain("w-[11px]")
    expect(MATRIX_ZONE_GAP_CLASS).toContain("p-0")
    // The gap cell is NOT a positioning context: the line has to escape it to
    // reach the table's full height.
    expect(MATRIX_ZONE_GAP_CLASS).not.toContain("relative")
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
