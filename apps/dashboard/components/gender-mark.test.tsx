import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  genderMarkBorder,
  GenderPointHitArea,
  GenderPointMark,
  GenderHatch,
  GenderMenIcon,
  orderGenderPayload,
  genderFillStyle,
  genderKeyStyle,
  useGenderMarks,
} from "@/components/gender-mark"
import { POINT_MARK_SIZE } from "@/components/point-mark"

afterEach(cleanup)

// The encoding is REDUNDANT: hue tells the two series apart quickly, the mark
// tells them apart at all when hue is unavailable (greyscale, print, a reader
// who cannot separate the two). These tests guard both channels rather than
// the specific colours: dropping either one costs a whole audience.

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

  it("paints the women series with its own ink", () => {
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

  // These two used to be asserted against a constant of shape/fill/stroke
  // values that every scatter spread onto its series. Its last consumer went
  // with the swimlane dot plot, so the invariants moved onto the mark that
  // actually draws: the DOM is now the thing under test, which a constant
  // could only stand in for.
  it("separates point marks by SHAPE, not by colour or by fill", () => {
    // Shape carries the whole distinction on a point mark: two overlapping
    // marks differing only in fill cannot be counted, and a hatch cannot
    // survive a mark narrower than its pattern tile.
    const { container } = render(
      <svg aria-label="marks">
        <GenderPointMark cx={20} cy={20} series="women" />
        <GenderPointMark cx={60} cy={20} series="men" />
      </svg>
    )
    // The triangle is a path, the square a rect. Each mark's own shape, and
    // never the other's.
    const triangle = container.querySelector("path")
    const square = container.querySelector("rect")
    expect(triangle).not.toBeNull()
    expect(square).not.toBeNull()
    // Neither is a CIRCLE: that shape is the app's ungendered point, drawn by
    // a plot encoding something else on the same marks (the role mode). A
    // gender owning it would keep reading as that gender there.
    expect(container.querySelector("circle")).toBeNull()
    // Both solid, each in its own ink. Outlining one series made it read as
    // the secondary case and was the harder hover target.
    expect(triangle?.getAttribute("fill")).toBe("var(--gender-woman)")
    expect(square?.getAttribute("fill")).toBe("var(--gender-man)")
  })

  it("edges every point mark in the card's colour, never its own ink", () => {
    // Solid marks in one colour merge where they overlap, and a plot of 22
    // salaries overlaps constantly. A background-coloured hairline separates
    // neighbours without adding a second visual channel.
    const { container } = render(
      <svg aria-label="marks">
        <GenderPointMark cx={20} cy={20} series="women" />
        <GenderPointMark cx={60} cy={20} series="men" />
      </svg>
    )
    for (const mark of container.querySelectorAll("path, circle")) {
      expect(mark.getAttribute("stroke")).toBe("var(--card)")
      expect(Number(mark.getAttribute("stroke-width"))).toBeGreaterThan(0)
    }
  })

  // Pointing at a 10px mark takes aim, and a reader checking a dozen people
  // gives up. The target is an invisible circle instead, because growing the
  // mark would hide the neighbours these plots exist to show.
  it("gives a point a pointer target far larger than its ink", () => {
    const { container } = render(
      <svg aria-label="targets">
        <GenderPointHitArea cx={20} cy={20} />
      </svg>
    )
    const hit = container.querySelector("circle")
    // 24px across: the minimum WCAG 2.2 asks of a pointer target, and well
    // over twice the visible mark.
    expect(Number(hit?.getAttribute("r")) * 2).toBeGreaterThanOrEqual(24)
    // `transparent`, not `none`: SVG hit-testing follows the paint, so `none`
    // would look identical and catch nothing.
    expect(hit?.getAttribute("fill")).toBe("transparent")
  })

  // The target ships SEPARATELY from the mark, and that is the whole point of
  // it: drawn together, a 24px target buries the neighbour behind it, and two
  // people a few pixels apart left the one behind unhoverable. A chart has to
  // paint the whole target layer before any mark, so a target can only claim
  // empty space.
  it("keeps the mark free of its own target, so a mark can never bury a neighbour", () => {
    const { container } = render(
      <svg aria-label="marks">
        <GenderPointMark cx={20} cy={20} series="women" />
        <GenderPointMark cx={60} cy={20} series="men" />
      </svg>
    )
    expect(
      container.querySelectorAll("circle[fill='transparent']")
    ).toHaveLength(0)
  })

  // One size for every scatter in the app. Two of them had drifted to 64 and
  // 78, a difference invisible side by side that still made the same person a
  // different size on two surfaces.
  it("draws every scatter's marks at one shared size", () => {
    const { container } = render(
      <svg aria-label="default">
        <GenderPointMark cx={20} cy={20} series="men" />
      </svg>
    )
    const side = Number(container.querySelector("rect")?.getAttribute("width"))
    expect(side * side).toBeCloseTo(POINT_MARK_SIZE, 1)
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
    const side = Number(container.querySelector("rect")?.getAttribute("width"))
    expect(side * side).toBeCloseTo(100, 1)
    // The triangle is drawn as a path; its three points bound the same area.
    expect(container.querySelector("path")?.getAttribute("d")).toContain("M 20")
  })

  it("gives each series its own border ink, never one shared stroke", () => {
    // While both series were the brand ink this was a single constant that
    // every call site spread onto BOTH bars. With two hues that outlines the
    // women's bar in the men's blue, which is worse than no border: it states
    // the wrong series. Taking a required argument is what makes that a
    // compile error rather than a thing to notice in a screenshot.
    expect(genderMarkBorder("women").stroke).toBe("var(--gender-woman-edge)")
    expect(genderMarkBorder("men").stroke).toBe("var(--gender-man)")
    expect(genderMarkBorder("women").strokeWidth).toBeGreaterThan(0)
  })

  it("edges the solid series in a DARKER step of its own ink", () => {
    // The men's mark is a pale wash under stripes, so their ink already
    // contours it. A solid fill outlined in its own colour has no visible
    // edge at all, which left the two series looking differently
    // constructed rather than differently filled.
    expect(genderMarkBorder("women").stroke).not.toBe("var(--gender-woman)")
    expect(genderMarkBorder("women").stroke).toContain("--gender-woman")
    // The hatched series needs no separate edge ink, and inventing one would
    // be a second value to keep in step with nothing.
    expect(genderMarkBorder("men").stroke).toBe("var(--gender-man)")
  })

  it("borders an HTML mark in its own ink too", () => {
    // Same defect, other family: genderKeyStyle and genderFillStyle both hard
    // coded the men's token for the border of BOTH series.
    for (const style of [genderKeyStyle, genderFillStyle]) {
      expect(style("women").border).toContain("--gender-woman-edge")
      expect(style("men").border).toContain("--gender-man")
    }
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

  // Recharts positions its tooltip by translating one wrapper and transitions
  // that transform, so a tooltip left on the default slides in from the
  // chart's top-left corner on the first hover and slides between points
  // after that: it arrives from somewhere other than the thing it describes.
  // One chart forgetting this reads differently from every other.
  it("turns off the sliding tooltip on every chart", () => {
    const offenders: string[] = []
    for (const [path, source] of files) {
      if (path.includes(".test.")) continue
      for (const [tooltip] of source.matchAll(/<ChartTooltip\b[\s\S]*?\/>/g)) {
        if (!tooltip.includes("CHART_TOOLTIP_MOTION")) {
          offenders.push(`${path}: ${tooltip.slice(0, 40)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  // With the slide gone, the panel would pop. The fade that replaces it lives
  // on the panel's own class list, so it has to be added per tooltip; this
  // guards at file granularity (a file that builds a tooltip panel mentions
  // CHART_TOOLTIP_TEXT), which is coarse but catches the whole-surface misses
  // this is actually about.
  it("fades in every tooltip panel it stopped sliding", () => {
    const offenders: string[] = []
    for (const [path, source] of files) {
      if (path.includes(".test.")) continue
      if (!source.includes("CHART_TOOLTIP_TEXT")) continue
      if (!source.includes("TOOLTIP_APPEAR")) offenders.push(path)
    }
    expect(offenders).toEqual([])
  })

  // Targets ride in their own series, declared before the marks, so recharts
  // paints the whole target layer first. Getting that order wrong is what made
  // a point behind another unhoverable, and it is invisible on screen: nothing
  // about the drawing changes, only which element answers the pointer.
  it("paints every chart's target layer before any of its marks", () => {
    const offenders: string[] = []
    for (const [path, source] of files) {
      if (path.includes(".test.") || !source.includes("target")) continue
      const series = [...source.matchAll(/<Scatter\s+name="([\w-]+)"/g)].map(
        (match) => match[1] ?? ""
      )
      if (series.length === 0) continue
      const lastTarget = series.reduce(
        (last, name, index) => (name.endsWith("-target") ? index : last),
        -1
      )
      const firstMark = series.findIndex((name) => !name.endsWith("-target"))
      if (lastTarget === -1 || firstMark === -1) continue
      if (lastTarget > firstMark)
        offenders.push(`${path}: ${series.join(", ")}`)
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

// The tokens themselves, read from the stylesheet. Nothing in the component
// layer can catch the two planes drifting back onto one colour: every mark
// references var(--gender-woman) / var(--gender-man) and would keep passing
// while rendering a chart with one ink and no hue channel at all.
describe("gender tokens", () => {
  const css = readFileSync(
    join(process.cwd(), "../../packages/ui/src/styles/globals.css"),
    "utf8"
  )
  const declarations = (name: string) =>
    [...css.matchAll(new RegExp(`--gender-${name}:\\s*([^;]+);`, "g"))].map(
      (m) => m[1]?.trim()
    )

  it("declares both series in the light and the dark plane", () => {
    expect(declarations("woman")).toHaveLength(2)
    expect(declarations("man")).toHaveLength(2)
    expect(declarations("woman-edge")).toHaveLength(2)
  })

  it("registers every gender token in @theme, or the build drops it", () => {
    // Found the hard way: --gender-woman-edge resolved to nothing in the
    // browser while --gender-woman right above it worked. A custom property
    // that no @theme entry references is stripped from the compiled CSS, so
    // a new token is invisible until it is registered here too.
    for (const name of ["gender-man", "gender-woman", "gender-woman-edge"]) {
      expect(css).toContain(`--color-${name}: var(--${name});`)
    }
  })

  it("gives the two series different ink in every plane", () => {
    const women = declarations("woman")
    const men = declarations("man")
    expect(women).not.toEqual(declarations("woman-edge"))
    for (const [i, w] of women.entries()) {
      expect(w).not.toBe(men[i])
    }
  })

  it("keeps both series off the brand, so a chart never competes with the CTA", () => {
    for (const value of [...declarations("woman"), ...declarations("man")]) {
      expect(value).not.toBe("var(--brand)")
    }
  })
})
