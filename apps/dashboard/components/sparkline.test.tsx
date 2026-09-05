import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Sparkline } from "@/components/sparkline"

describe("Sparkline", () => {
  // A single reading is a figure with no history, which the tile already
  // prints at full size beside the strip.
  it("draws nothing until there are two readings", () => {
    const { container } = render(<Sparkline values={[12]} />)
    expect(container.firstChild).toBeNull()
  })

  it("draws one bar per reading, most recent last", () => {
    const { container } = render(<Sparkline values={[10, 12, 11, 14]} />)
    expect(container.querySelectorAll("span")).toHaveLength(4)
  })

  it("slopes a pair across the strip rather than flattening it", () => {
    const { container } = render(<Sparkline values={[14.2, 13.7]} />)
    const heights = [...container.querySelectorAll("span")].map(
      (bar) => (bar as HTMLElement).style.height
    )
    expect(heights).toEqual(["100%", "35%"])
  })

  // A longer history keeps its most recent readings rather than its first.
  it("keeps the last readings when the history outgrows the strip", () => {
    const { container } = render(
      <Sparkline values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} bars={4} />
    )
    const heights = [...container.querySelectorAll("span")].map(
      (bar) => (bar as HTMLElement).style.height
    )
    expect(heights).toHaveLength(4)
    // 7..10 rises across the whole strip: the first shown bar is the floor
    // and the last is the ceiling.
    expect(heights[0]).toBe("35%")
    expect(heights[3]).toBe("100%")
  })

  // Every reading equal has no range at all. Drawn against its own minimum
  // that is a division by zero, and drawn as a floor it reads as missing
  // data, so a flat series sits mid-strip instead.
  //
  // A PAIR is not that case: it takes its own range like any other series,
  // so two readings slope across the strip instead of lying one pixel off
  // horizontal, which read as a broken chart.
  it("draws a flat series across the middle rather than as nothing", () => {
    const { container } = render(<Sparkline values={[9, 9, 9]} />)
    const heights = [...container.querySelectorAll("span")].map(
      (bar) => (bar as HTMLElement).style.height
    )
    expect(new Set(heights).size).toBe(1)
    expect(heights[0]).toBe("67.5%")
  })

  // One ink for every strip, with no per-surface option at all: a strip
  // carries no category, so a colour that varied by tile would claim one.
  it("paints every strip in the one strip ink", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />)
    const bar = container.querySelector("span") as HTMLElement
    expect(bar.style.backgroundColor).toContain("--spark")
  })
})

// Read from the stylesheet, for the same reason the role and gender tokens
// are: every call site references var(--spark) and would keep passing while
// the build resolved it to nothing.
describe("strip ink", () => {
  const css = readFileSync(
    join(process.cwd(), "../../packages/ui/src/styles/globals.css"),
    "utf8"
  )
  it("declares the strip ink in both planes", () => {
    expect(css.match(/--spark:\s*[^;]+;/g)).toHaveLength(2)
  })

  it("registers the strip ink in @theme, or the build drops it", () => {
    expect(css).toContain("--color-spark: var(--spark);")
  })

  // The strip is decoration. Landing its ink on one that MEANS something
  // would make the decoration look like an encoding: the saturated brand
  // rose is what a reader can click, and the flag inks are verdicts.
  it("keeps the strip off every ink that carries meaning", () => {
    const reserved = [
      "--brand:",
      "--flag-ok:",
      "--flag-elevated:",
      "--flag-critical:",
      "--gender-woman:",
      "--gender-man:",
    ]
      .map((token) =>
        css.match(new RegExp(`${token}\\s*([^;]+);`))?.[1]?.trim()
      )
      .filter((value): value is string => value !== undefined)
    const spark = css.match(/--spark:\s*([^;]+);/)?.[1]?.trim()
    expect(spark).toBeDefined()
    expect(reserved).not.toContain(spark)
  })
})
