import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  GENDER_DOT,
  GenderPointMark,
  GenderHatch,
  GenderMenIcon,
  orderGenderPayload,
  genderFillStyle,
  genderKeyStyle,
  useGenderMarks,
} from "@/components/gender-mark"

afterEach(cleanup)

// The encoding's whole point: the two series are told apart WITHOUT hue, so a
// chart survives colorblind vision, greyscale and print. These tests guard
// that property rather than the specific colors.

describe("gender marks", () => {
  function Probe() {
    const marks = useGenderMarks()
    return (
      <svg aria-label="probe">
        <title>probe</title>
        <defs>
          <GenderHatch id={marks.hatchId} />
        </defs>
        <rect data-testid="women" fill={marks.women} />
        <rect data-testid="men" fill={marks.men} />
      </svg>
    )
  }

  it("paints the men series with a pattern, not a second color", () => {
    const { getByTestId } = render(<Probe />)
    expect(getByTestId("men").getAttribute("fill")).toMatch(/^url\(#/)
  })

  it("paints the women series with the shared ink", () => {
    const { getByTestId } = render(<Probe />)
    expect(getByTestId("women").getAttribute("fill")).toBe(
      "var(--gender-woman)"
    )
  })

  it("defines the pattern it references", () => {
    const { container, getByTestId } = render(<Probe />)
    const id = getByTestId("men")
      .getAttribute("fill")
      ?.replace(/^url\(#/, "")
      .replace(/\)$/, "")
    expect(id).toBeDefined()
    expect(container.querySelector(`pattern[id="${id}"]`)).not.toBeNull()
  })

  it("gives two charts on one page different pattern ids", () => {
    const { container } = render(
      <>
        <Probe />
        <Probe />
      </>
    )
    const ids = [...container.querySelectorAll("pattern")].map((p) => p.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it("separates point marks by SHAPE, not by colour or by fill", () => {
    // Shape carries the whole distinction on a point mark: two overlapping
    // marks differing only in fill cannot be counted, and a hatch cannot
    // survive a mark narrower than its pattern tile.
    expect(GENDER_DOT.women.shape).toBe("triangle")
    expect(GENDER_DOT.men.shape).toBe("circle")
    // Both solid, in the same ink. Outlining one series made it read as the
    // secondary case and was the harder hover target.
    expect(GENDER_DOT.women.fill).toBe("var(--gender-woman)")
    expect(GENDER_DOT.men.fill).toBe("var(--gender-man)")
  })

  it("edges every point mark in the card's colour, never the ink", () => {
    // Solid marks in one colour merge where they overlap, and a dot plot of
    // 22 salaries overlaps constantly. A background-coloured hairline
    // separates neighbours without adding a second visual channel.
    for (const mark of [GENDER_DOT.women, GENDER_DOT.men]) {
      expect(mark.stroke).toBe("var(--card)")
      expect(mark.strokeWidth).toBeGreaterThan(0)
    }
  })

  it("draws both point shapes at equal area", () => {
    // d3-shape sizes symbols by AREA, and GenderPointMark mirrors it, so
    // neither gender reads as the smaller mark.
    const { container } = render(
      <>
        <svg aria-label="women">
          <GenderPointMark cx={20} cy={20} series="women" size={100} />
        </svg>
        <svg aria-label="men">
          <GenderPointMark cx={20} cy={20} series="men" size={100} />
        </svg>
      </>
    )
    const circle = container.querySelector("circle")
    const radius = Number(circle?.getAttribute("r"))
    expect(Math.PI * radius * radius).toBeCloseTo(100, 1)
    // The triangle is drawn as a path; its three points bound the same area.
    expect(container.querySelector("path")?.getAttribute("d")).toContain("M 20")
  })

  it("gives the men mark a stripe at both scales, women none", () => {
    for (const style of [genderKeyStyle, genderFillStyle]) {
      expect(style("men").backgroundImage).toContain(
        "repeating-linear-gradient"
      )
      expect(style("women").backgroundImage).toBeUndefined()
    }
  })

  it("draws a key stripe heavier than a full-size bar's", () => {
    // A 10px chip washes out at the chart hatch's weight; a full-width bar at
    // the chip's weight reads denser than the charts beside it.
    expect(genderKeyStyle("men").backgroundImage).toContain("1.4px")
    expect(genderFillStyle("men").backgroundImage).toContain("60%")
  })

  it("renders a legend icon carrying stripes", () => {
    const { container } = render(<GenderMenIcon />)
    expect(container.querySelectorAll("line").length).toBeGreaterThan(1)
  })

  it("lists women before men in the hover, matching the legend", () => {
    // recharts hands rows over sorted by series name, which puts men first.
    const ordered = orderGenderPayload([
      { dataKey: "men", value: 27 },
      { dataKey: "women", value: 16 },
    ])
    expect(ordered.map((item) => item.dataKey)).toEqual(["women", "men"])
  })

  it("leaves a payload that is already women-first alone", () => {
    const ordered = orderGenderPayload([
      { dataKey: "woman", value: 16 },
      { dataKey: "man", value: 27 },
    ])
    expect(ordered.map((item) => item.dataKey)).toEqual(["woman", "man"])
  })
})

// Both series now draw in the same ink, so a ChartConfig that omits the men
// series' `icon` silently renders two identical keys in its legend AND its
// tooltip. That shipped once; this is the guard.
describe("gender ChartConfigs", () => {
  // vitest runs with the package root as cwd (see vitest.config.ts).
  const root = join(process.cwd(), "components")
  const files = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => [name, readFileSync(join(root, name), "utf8")] as const)

  it("renders every chart tooltip at the shared type size", () => {
    // shadcn's ChartTooltipContent ships at text-xs, so one chart forgetting
    // the standard reads visibly smaller than the cards beside it.
    const offenders: string[] = []
    for (const [path, source] of files) {
      if (path.includes(".test.")) continue
      for (const [tooltip] of source.matchAll(
        /<ChartTooltipContent[^>]*\/>/g
      )) {
        if (!tooltip.includes("CHART_TOOLTIP_TEXT")) {
          offenders.push(`${path}: ${tooltip.slice(0, 40)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("gives every men series a hatched key", () => {
    const offenders: string[] = []
    for (const [path, source] of files) {
      // Test fixtures build throwaway configs that never render a legend or a
      // tooltip; the guard is about the configs the app ships.
      if (path.includes("gender-mark") || path.includes(".test.")) continue
      // Each `men:`/`man:` config entry that names the gender token must also
      // name the icon that carries the hatch into legends and tooltips.
      const entries = source.matchAll(
        /\b(?:men|man):\s*\{[^}]*var\(--gender-man\)[^}]*\}/g
      )
      for (const [entry] of entries) {
        if (!entry.includes("GenderMenIcon")) {
          offenders.push(path)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
