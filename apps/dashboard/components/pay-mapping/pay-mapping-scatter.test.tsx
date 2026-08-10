import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PayMappingSnapshotRow } from "./pay-mapping-gap-types"
import {
  buildScatterPoints,
  meanAwareYDomain,
  PayMappingScatter,
  type ScatterPoint,
  type ScatterXMode,
  ScatterTooltipContent,
} from "./pay-mapping-scatter"

const m = messages.dashboard.payMapping.scatter
const mGender = messages.dashboard.people.gender
const mDetail = messages.dashboard.payMapping.detail
const mHelp = messages.dashboard.help

const REF = Date.UTC(2026, 6, 1)

function row(
  overrides: Partial<PayMappingSnapshotRow> = {}
): PayMappingSnapshotRow {
  return {
    personPublicId: "p1",
    displayName: "Alex Doe",
    erased: false,
    gender: "Kvinna",
    roleTitle: "SWE",
    trackKey: "IC",
    seniority: "Senior",
    level: 3,
    basicMonthly: 40000,
    components: [],
    birthDate: "1990-07-01",
    employmentStartDate: "2020-01-01",
    ftePercent: 100,
    currency: "SEK",
    payYear: 2026,
    ...overrides,
  }
}

describe("buildScatterPoints", () => {
  it("plots priced rows with a parseable birth date in age mode, and counts a missing one as omitted", () => {
    const rows = [row(), row({ displayName: "Bo Berg", birthDate: undefined })]
    const { points, omitted } = buildScatterPoints(rows, "age", REF)
    expect(points).toHaveLength(1)
    expect(points[0]?.row.displayName).toBe("Alex Doe")
    expect(omitted).toBe(1)
  })

  it("keys on employmentStartDate in tenure mode", () => {
    const rows = [
      row(),
      row({ displayName: "Bo Berg", employmentStartDate: undefined }),
    ]
    const { points, omitted } = buildScatterPoints(rows, "tenure", REF)
    expect(points).toHaveLength(1)
    expect(points[0]?.row.displayName).toBe("Alex Doe")
    expect(omitted).toBe(1)
  })

  it("omits unpriced rows", () => {
    const rows = [row(), row({ displayName: "Bo Berg", basicMonthly: null })]
    const { points, omitted } = buildScatterPoints(rows, "age", REF)
    expect(points).toHaveLength(1)
    expect(omitted).toBe(1)
  })

  it("computes y as the FTE-adjusted total monthly comp", () => {
    const rows = [
      row({
        basicMonthly: 40000,
        components: [{ kind: "variable", monthlyAmount: 2000 }],
        ftePercent: 80,
      }),
    ]
    const { points } = buildScatterPoints(rows, "age", REF)
    expect(points[0]?.y).toBe(52500)
  })

  // The equal-work surface states its figures in base salary, so the plot has
  // to be able to draw that same measure or the card and the chart disagree.
  it("plots base salary instead of total comp on the base metric", () => {
    const rows = [
      row({
        basicMonthly: 40000,
        components: [{ kind: "variable", monthlyAmount: 2000 }],
        ftePercent: 80,
      }),
    ]
    expect(
      buildScatterPoints(rows, "age", REF, undefined, "base").points[0]?.y
    ).toBe(50000)
    expect(
      buildScatterPoints(rows, "age", REF, undefined, "total").points[0]?.y
    ).toBe(52500)
  })

  it("marks gender via the woman flag", () => {
    const rows = [row({ gender: "Kvinna" }), row({ gender: "Man" })]
    const { points } = buildScatterPoints(rows, "age", REF)
    expect(points.map((p) => p.woman)).toEqual([true, false])
  })

  it("attaches the owning group label when a lookup is given", () => {
    const rows = [row({ roleTitle: "Nurse" })]
    const { points } = buildScatterPoints(
      rows,
      "age",
      REF,
      () => "Technician · Mid"
    )
    expect(points[0]?.groupLabel).toBe("Technician · Mid")
  })

  it("omits nothing and attaches no label when none is given", () => {
    const rows = [row()]
    const { points } = buildScatterPoints(rows, "age", REF)
    expect(points[0]?.groupLabel).toBeUndefined()
  })
})

describe("meanAwareYDomain", () => {
  // Recharts drops a reference line that falls outside the axis domain, and
  // an auto domain is fitted to the DOTS. The averages count everyone in the
  // group, including the people the plot cannot draw (no birth date, no start
  // date), so an average can legitimately sit above or below every dot: this
  // is what keeps that line on the chart instead of silently missing.
  it("widens the fitted domain to reach an average outside the dots", () => {
    const [low, high] = meanAwareYDomain({ women: 30_000, men: 60_000 })
    expect(typeof low === "function" && low(40_000)).toBe(30_000)
    expect(typeof high === "function" && high(50_000)).toBe(60_000)
  })

  it("leaves the dots' own framing alone when the averages sit inside it", () => {
    const [low, high] = meanAwareYDomain({ women: 38_000, men: 39_000 })
    expect(typeof low === "function" && low(30_000)).toBe(30_000)
    expect(typeof high === "function" && high(50_000)).toBe(50_000)
  })

  it("stays on the auto domain when there are no averages to fit", () => {
    expect(meanAwareYDomain(undefined)).toEqual(["auto", "auto"])
    expect(meanAwareYDomain({ women: null, men: null })).toEqual([
      "auto",
      "auto",
    ])
  })
})

const ROWS: PayMappingSnapshotRow[] = [
  row({ displayName: "Alex Doe", gender: "Kvinna" }),
  row({ displayName: "Bo Berg", gender: "Man" }),
]

function renderScatter(
  props: Partial<{
    rows: PayMappingSnapshotRow[] | undefined
    currency: string
    referenceDateMs: number
    groupLabelFor: (row: PayMappingSnapshotRow) => string
    title: string
    means: { women: number | null; men: number | null }
  }> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingScatter
        rows={"rows" in props ? props.rows : ROWS}
        currency={props.currency ?? "SEK"}
        referenceDateMs={props.referenceDateMs ?? REF}
        groupLabelFor={props.groupLabelFor}
        title={props.title ?? m.titleEqualWork}
        {...("means" in props ? { means: props.means } : {})}
      />
    </NextIntlClientProvider>
  )
}

describe("PayMappingScatter", () => {
  // Recharts' ResponsiveContainer measures its container via
  // getBoundingClientRect on mount; jsdom has no layout, so it reads 0x0 and
  // renders nothing inside the chart. Stub a nonzero rect so the chart
  // content (legend included) actually renders (mirrors
  // pay-comparison-section.test.tsx).
  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 640,
      bottom: 256,
      width: 640,
      height: 256,
      toJSON: () => ({}),
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it("shows the real title, help, and toggle with a skeleton while rows are loading", () => {
    renderScatter({ rows: undefined })
    expect(screen.getByText(m.titleEqualWork)).toBeDefined()
    expect(screen.getByRole("tab", { name: m.xAge })).toBeDefined()
    expect(screen.getByRole("tab", { name: m.xTenure })).toBeDefined()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("renders the chart with a gendered legend, and swaps the omitted note on toggle", () => {
    renderScatter({
      rows: [
        ...ROWS,
        row({
          displayName: "No Dates",
          birthDate: undefined,
          employmentStartDate: undefined,
        }),
      ],
    })
    expect(document.querySelector("[data-chart]")).not.toBeNull()
    expect(screen.getByText(mGender.Man)).toBeDefined()
    expect(screen.getByText(mGender.Kvinna)).toBeDefined()
    expect(
      screen.getByText("1 person without a birth date is not shown")
    ).toBeDefined()

    fireEvent.click(screen.getByRole("tab", { name: m.xTenure }))
    expect(
      screen.getByText("1 person without a start date is not shown")
    ).toBeDefined()
  })

  // The two averages are the reading the swimlane dot plot used to carry, and
  // this chart replaced it: without them, moving to a pay/age plot would have
  // dropped the gap out of the visual entirely.
  it("draws each gender's average as a labelled line when means are given", () => {
    renderScatter({ means: { women: 38_903, men: 39_608 } })
    expect(screen.getByText(m.womenMean)).toBeDefined()
    expect(screen.getByText(m.menMean)).toBeDefined()
  })

  // The labels sit at opposite ENDS of their lines. Stacking them vertically
  // was tried and shipped once: a horizontal reference line has no height for
  // a label to sit inside, so on a small gap both landed in the same place and
  // overprinted, which is exactly the case a reader most needs to read. The
  // gap here is 0.6% of pay, i.e. the two lines are within a pixel or two of
  // each other, and the labels still have the plot's full width between them.
  it("puts the two average labels at opposite ends, even when the lines nearly touch", () => {
    renderScatter({ means: { women: 38_903, men: 39_150 } })
    const x = (label: string) =>
      Number(
        [...document.querySelectorAll("text")]
          .find((node) => node.textContent === label)
          ?.getAttribute("x") ?? Number.NaN
      )
    const womenX = x(m.womenMean)
    const menX = x(m.menMean)
    expect(Number.isNaN(womenX)).toBe(false)
    expect(Number.isNaN(menX)).toBe(false)
    // Women left, men right, and far enough apart that no pair of labels can
    // collide whatever the words are in a given locale.
    expect(menX - womenX).toBeGreaterThan(200)
  })

  // The equivalent-work plot holds a group AND its comparators at once, so one
  // pair of lines there would average across jobs that are deliberately being
  // kept apart. It passes no means, and must get no lines.
  it("draws no average lines when no means are given", () => {
    renderScatter()
    expect(screen.queryByText(m.womenMean)).toBeNull()
    expect(screen.queryByText(m.menMean)).toBeNull()
  })

  // A masked or single-gender group reports a null mean; that side simply has
  // no line, and the other one still draws.
  it("draws only the side that has an average", () => {
    renderScatter({ means: { women: null, men: 39_608 } })
    expect(screen.queryByText(m.womenMean)).toBeNull()
    expect(screen.getByText(m.menMean)).toBeDefined()
  })

  // The averages sentence is appended only where the lines exist, or the help
  // would describe two lines that are not on screen.
  it("explains the averages only on the surface that draws them", () => {
    const { unmount } = renderScatter({ means: { women: 1, men: 2 } })
    fireEvent.click(
      screen.getByRole("button", { name: mHelp.payGapScatterLabel })
    )
    expect(
      screen.getByText(new RegExp(mHelp.payGapScatterMeansBody.slice(0, 40)))
    ).toBeDefined()
    unmount()

    renderScatter()
    fireEvent.click(
      screen.getByRole("button", { name: mHelp.payGapScatterLabel })
    )
    expect(
      screen.queryByText(new RegExp(mHelp.payGapScatterMeansBody.slice(0, 40)))
    ).toBeNull()
  })

  it("shows the empty age precondition when nothing is plottable", () => {
    renderScatter({ rows: [row({ birthDate: undefined })] })
    expect(screen.getByText(m.emptyAge)).toBeDefined()
  })

  it("shows the empty tenure precondition after toggling X mode", () => {
    renderScatter({
      rows: [row({ birthDate: undefined, employmentStartDate: undefined })],
    })
    fireEvent.click(screen.getByRole("tab", { name: m.xTenure }))
    expect(screen.getByText(m.emptyTenure)).toBeDefined()
  })

  it("hides the omitted note entirely once nothing is omitted", () => {
    renderScatter()
    expect(screen.queryByText(/is not shown/)).toBeNull()
  })
})

function renderTooltip(point: ScatterPoint, xMode: ScatterXMode = "age") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ScatterTooltipContent point={point} currency="SEK" xMode={xMode} />
    </NextIntlClientProvider>
  )
}

describe("ScatterTooltipContent", () => {
  afterEach(() => cleanup())

  it("names the person, and shows role/seniority, level, and gender", () => {
    const point: ScatterPoint = {
      x: 36,
      y: 40000,
      woman: true,
      row: row({
        displayName: "Alex Doe",
        gender: "Kvinna",
        roleTitle: "SWE",
        seniority: "Senior",
        level: 3,
      }),
    }
    renderTooltip(point)
    expect(screen.getByText("Alex Doe")).toBeDefined()
    expect(screen.getByText("SWE · Senior")).toBeDefined()
    expect(screen.getByText("Level 3")).toBeDefined()
    expect(screen.getByText(mGender.Kvinna)).toBeDefined()
  })

  // The panel appears AT the mark now, instead of sliding in from the chart's
  // corner, so it needs its own appearance: a fade, gated on motion-safe
  // because a CSS animation outside Motion's control has no other guard.
  it("fades the panel in rather than popping, and only when motion is welcome", () => {
    const point: ScatterPoint = { x: 36, y: 40000, woman: true, row: row() }
    const { container } = renderTooltip(point)
    const panel = container.firstElementChild as HTMLElement
    expect(panel.className).toContain("motion-safe:animate-in")
    expect(panel.className).toContain("motion-safe:fade-in-0")
  })

  it("shows the tombstone, not the name, for an erased row", () => {
    const point: ScatterPoint = {
      x: 10,
      y: 1000,
      woman: false,
      row: row({ erased: true, displayName: "Should Not Show" }),
    }
    renderTooltip(point)
    expect(screen.getByText(mDetail.erased)).toBeDefined()
    expect(screen.queryByText("Should Not Show")).toBeNull()
  })

  // The total comes from the ROW, never from the plotted y: the axis draws
  // base salary on the equal-work surface, and a "Total" line echoing that
  // position would state a wrong number rather than a shorter one. The y here
  // is deliberately a different value, so a tooltip reading it would fail.
  it("shows the basic/variable split and derives the FTE-adjusted total from the row", () => {
    const point: ScatterPoint = {
      x: 5,
      y: 50_000,
      woman: false,
      row: row({
        gender: "Man",
        basicMonthly: 40000,
        components: [{ kind: "variable", monthlyAmount: 2000 }],
        ftePercent: 80,
      }),
    }
    renderTooltip(point)
    expect(screen.getByText("SEK 40,000")).toBeDefined()
    expect(screen.getByText("SEK 2,000")).toBeDefined()
    expect(screen.getByText("SEK 52,500")).toBeDefined()
    expect(screen.queryByText("SEK 50,000")).toBeNull()
  })

  it("omits the variable line when there is no variable pay", () => {
    const point: ScatterPoint = {
      x: 5,
      y: 40000,
      woman: false,
      row: row({ basicMonthly: 40000, components: [] }),
    }
    renderTooltip(point)
    expect(screen.queryByText(m.variable)).toBeNull()
  })

  it("labels the X value by the active mode", () => {
    const point: ScatterPoint = { x: 36, y: 40000, woman: true, row: row() }
    renderTooltip(point, "age")
    expect(screen.getByText(m.age)).toBeDefined()
    expect(screen.getByText("36")).toBeDefined()
    cleanup()
    renderTooltip(point, "tenure")
    expect(screen.getByText(m.tenure)).toBeDefined()
  })

  it("shows the owning group row when provided (equivalentWork)", () => {
    const point: ScatterPoint = {
      x: 36,
      y: 40000,
      woman: true,
      row: row(),
      groupLabel: "Technician · Mid",
    }
    renderTooltip(point)
    expect(screen.getByText(m.group)).toBeDefined()
    expect(screen.getByText("Technician · Mid")).toBeDefined()
  })

  it("omits the group row when not provided (equalWork)", () => {
    const point: ScatterPoint = { x: 36, y: 40000, woman: true, row: row() }
    renderTooltip(point)
    expect(screen.queryByText(m.group)).toBeNull()
  })
})
