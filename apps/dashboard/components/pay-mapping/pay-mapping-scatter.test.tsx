import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PayMappingSnapshotRow } from "./pay-mapping-gap-types"
import {
  buildScatterPoints,
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
    roleOrder: readonly string[]
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
        {...("roleOrder" in props ? { roleOrder: props.roleOrder } : {})}
      />
    </NextIntlClientProvider>
  )
}

// The rendered axes and dots, read back from the SVG recharts draws.
function axisTicks(axis: "xAxis" | "yAxis"): SVGTextElement[] {
  return [
    ...document.querySelectorAll<SVGTextElement>(
      `.recharts-${axis}-tick-labels .recharts-cartesian-axis-tick-value`
    ),
  ]
}
function yTickLabels(): string[] {
  return axisTicks("yAxis").map((node) => node.textContent ?? "")
}
function xTickLabels(): string[] {
  return axisTicks("xAxis").map((node) => node.textContent ?? "")
}
function yTickYs(): number[] {
  return axisTicks("yAxis").map((node) => Number(node.getAttribute("y")))
}
// Each dot's pointer target is a transparent circle centred on the mark.
function dotCenterYs(): number[] {
  return [
    ...document.querySelectorAll<SVGCircleElement>(
      'circle[fill="transparent"]'
    ),
  ].map((node) => Number(node.getAttribute("cy")))
}
// "SEK 44,471" -> 44471, whatever the locale puts around the digits.
function moneyValue(label: string): number {
  return Number(label.replace(/[^\d]/g, ""))
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

  // The averages count everyone in the group, including the people the plot
  // cannot draw (no birth date), so an average can legitimately sit below
  // every dot. Recharts drops a reference line outside the axis window; the
  // window is built from the averages as well as the dots so it never does.
  it("keeps an average outside the dots on the chart", () => {
    renderScatter({ means: { women: 30_000, men: 60_000 } })
    expect(screen.getByText(m.womenMean)).toBeDefined()
    expect(screen.getByText(m.menMean)).toBeDefined()
    const tickValues = yTickLabels().map(moneyValue)
    expect(Math.min(...tickValues)).toBeLessThanOrEqual(30_000)
    expect(Math.max(...tickValues)).toBeGreaterThanOrEqual(60_000)
  })

  // Two people, one at each extreme: fitted to the raw values they sat on the
  // plot's top and bottom edges under tick labels that were the values
  // themselves. The window steps out to a round tick past each of them.
  it("frames the two extremes inside the plot, on round ticks", () => {
    renderScatter({
      rows: [
        row({
          displayName: "Alex Doe",
          gender: "Kvinna",
          basicMonthly: 44_471,
        }),
        row({ displayName: "Bo Berg", gender: "Man", basicMonthly: 52_442 }),
      ],
      means: { women: 44_471, men: 52_442 },
    })
    const tickValues = yTickLabels().map(moneyValue)
    expect(tickValues).not.toContain(44_471)
    expect(tickValues).not.toContain(52_442)
    expect(Math.min(...tickValues)).toBeLessThan(44_471)
    expect(Math.max(...tickValues)).toBeGreaterThan(52_442)
    // And on screen: the dots sit strictly between the outermost ticks.
    const tickYs = yTickYs()
    const dotYs = dotCenterYs()
    expect(dotYs).toHaveLength(2)
    expect(Math.min(...dotYs)).toBeGreaterThan(Math.min(...tickYs))
    expect(Math.max(...dotYs)).toBeLessThan(Math.max(...tickYs))
  })

  // Ages and years of service are whole numbers; a "48.5" tick between two
  // people aged 48 and 50 is a number nobody is.
  it("labels the x axis in whole years, one past each extreme", () => {
    renderScatter({
      rows: [
        row({ displayName: "Alex Doe", birthDate: "1978-01-01" }),
        row({ displayName: "Bo Berg", gender: "Man", birthDate: "1976-01-01" }),
      ],
    })
    expect(xTickLabels()).toEqual(["47", "48", "49", "50", "51"])
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

  // The key is a filter on this chart too: reading one gender's spread means
  // being able to put the other away.
  it("hides a gender's points from its key, and takes that gender's average with them", () => {
    renderScatter({ means: { women: 38_903, men: 39_608 } })
    const chart = () => document.querySelector("[data-chart]")
    const genderFills = () =>
      [...(chart()?.querySelectorAll("path[fill], rect[fill]") ?? [])]
        .map((el) => el.getAttribute("fill") ?? "")
        .filter((fill) => fill.startsWith("var(--gender"))
    expect(genderFills()).toEqual(
      expect.arrayContaining(["var(--gender-woman)", "var(--gender-man)"])
    )
    fireEvent.click(screen.getByRole("button", { name: mGender.Man }))
    expect(genderFills()).toEqual(["var(--gender-woman)"])
    // The average line belongs to the series: a dashed line for people who
    // are not on the plot is a number with nothing to read it against.
    expect(screen.queryByText(m.menMean)).toBeNull()
    expect(screen.getByText(m.womenMean)).toBeDefined()
  })

  it("refuses to switch off the last gender showing", () => {
    renderScatter()
    fireEvent.click(screen.getByRole("button", { name: mGender.Man }))
    expect(
      screen
        .getByRole("button", { name: mGender.Kvinna })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  // Expanding is a request for a BIGGER plot. This chart renders its own
  // WidgetCard, so the naive way to read the expanded flag is a hook call in
  // the same component, which sits ABOVE the dialog's provider and quietly
  // answers "not expanded": the dialog then showed the identical 256px chart,
  // wider and not one pixel taller. The height is decided by ChartCanvas
  // instead, which renders inside the dialog.
  it("gives the expanded dialog a taller plot than the card", () => {
    renderScatter()
    const heightOf = (node: Element | null | undefined) =>
      (node?.getAttribute("class") ?? "")
        .split(/\s+/)
        .find((cls) => cls.startsWith("h-"))
    const inCard = document.querySelector("[data-chart]")
    expect(heightOf(inCard)).toBe("h-64")

    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.widgetCard.expand,
      })
    )
    const charts = [...document.querySelectorAll("[data-chart]")]
    expect(charts).toHaveLength(2)
    const inDialog = charts.find(
      (chart) => chart.closest('[data-slot="dialog-content"]') !== null
    )
    expect(inDialog).toBeDefined()
    expect(heightOf(inDialog)).not.toBe("h-64")
  })

  it("hides the omitted note entirely once nothing is omitted", () => {
    renderScatter()
    expect(screen.queryByText(/is not shown/)).toBeNull()
  })
})

// Hue can answer "which job is this point" instead of repeating the gender
// the shape already carries. The rules that must hold: the shape never stops
// meaning gender, a job's hue comes from the chart's fixed order rather than
// from anything the reader can re-rank, and no hue is ever shown without a
// legend row naming the job it stands for.
describe("PayMappingScatter: showing the roles", () => {
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

  // Two people in two different jobs, so a per-point mark is observable.
  const TWO_JOBS: PayMappingSnapshotRow[] = [
    row({ displayName: "Alex Doe", gender: "Kvinna", roleTitle: "Nurse" }),
    row({ displayName: "Bo Berg", gender: "Man", roleTitle: "IT Manager" }),
  ]
  const byRoleTitle = (r: PayMappingSnapshotRow) => r.roleTitle

  function renderByRole(roleOrder: readonly string[]) {
    const result = renderScatter({
      rows: TWO_JOBS,
      groupLabelFor: byRoleTitle,
      roleOrder,
    })
    fireEvent.click(screen.getByRole("tab", { name: m.colorRole }))
    return result
  }

  // Every mark the plot draws, as its element and its fill. The marks sit
  // alongside invisible hit areas, which are filled "transparent".
  function marks(prefix: string): { shape: string; fill: string }[] {
    const chart = document.querySelector("[data-chart]")
    if (chart === null) return []
    return [...chart.querySelectorAll("path[fill], circle[fill], rect[fill]")]
      .map((el) => ({
        shape: el.tagName.toLowerCase(),
        fill: el.getAttribute("fill") ?? "",
      }))
      .filter((mark) => mark.fill.startsWith(prefix))
  }

  it("offers the toggle only where there are jobs to show", () => {
    renderScatter()
    expect(screen.queryByRole("tab", { name: m.colorRole })).toBeNull()
    cleanup()
    renderScatter({ roleOrder: ["Nurse"] })
    expect(screen.getByRole("tab", { name: m.colorRole })).toBeDefined()
  })

  // Hue alone here, and every point stays a circle: a silhouette a few
  // pixels across cannot carry six categories, and what keeps identity off
  // colour alone is the legend, the hover, and being able to click every
  // other job away. Shape is left to the gender mode.
  it("gives each job its own hue, and draws every point as the same circle", () => {
    renderByRole(["Nurse", "IT Manager"])
    expect(marks("var(--role")).toEqual(
      expect.arrayContaining([
        { shape: "circle", fill: "var(--role-1)" },
        { shape: "circle", fill: "var(--role-2)" },
      ])
    )
  })

  it("takes the hue from the chart's own order, not from the plotted order", () => {
    // The man's job leads the order, so his point takes slot one even though
    // the woman's point is plotted first. Nothing about the hue may depend on
    // who is standing in it.
    renderByRole(["IT Manager", "Nurse"])
    const fills = marks("var(--role").map((mark) => mark.fill)
    expect(fills).toEqual(
      expect.arrayContaining(["var(--role-1)", "var(--role-2)"])
    )
  })

  it("goes back to the gender marks when the reader toggles back", () => {
    renderByRole(["Nurse", "IT Manager"])
    fireEvent.click(screen.getByRole("tab", { name: m.colorGender }))
    expect(marks("var(--role")).toEqual([])
    expect(marks("var(--gender")).toEqual(
      expect.arrayContaining([
        { shape: "path", fill: "var(--gender-woman)" },
        { shape: "rect", fill: "var(--gender-man)" },
      ])
    )
  })

  it("names every job that has a mark, and folds the rest into one neutral", () => {
    const jobs = Array.from({ length: 8 }, (_, i) => `Job ${i + 1}`)
    renderByRole(jobs)
    // The six with a mark of their own are named.
    for (const job of jobs.slice(0, 6)) {
      expect(screen.getByText(job)).toBeDefined()
    }
    // The seventh and eighth share the neutral, so they get ONE chip between
    // them: a chip each would promise a mark that cannot tell them apart.
    expect(screen.queryByText("Job 7")).toBeNull()
    expect(screen.queryByText("Job 8")).toBeNull()
    expect(screen.getAllByText(m.colorRoleOther)).toHaveLength(1)
  })

  // The key has to show the object the plot draws: the same filled circle in
  // the same hue, never a square swatch standing in for it.
  it("shows each job's own mark in the key", () => {
    renderByRole(["Nurse", "IT Manager", "Analyst"])
    const chips = [...document.querySelectorAll("li")].filter((li) =>
      ["Nurse", "IT Manager", "Analyst"].includes(li.textContent ?? "")
    )
    expect(
      chips.map((li) => {
        const mark = li.querySelector("path, circle, rect")
        return `${mark?.tagName.toLowerCase()}|${mark?.getAttribute("fill")}`
      })
    ).toEqual([
      "circle|var(--role-1)",
      "circle|var(--role-2)",
      "circle|var(--role-3)",
    ])
  })

  // A key as long as the comparison is has to be a filter too: with seven
  // jobs on one plot, reading one of them means being able to put the others
  // away.
  it("hides a job's points when its key is clicked, and brings them back", () => {
    renderByRole(["Nurse", "IT Manager"])
    expect(marks("var(--role")).toHaveLength(2)
    const key = screen.getByRole("button", { name: "Nurse" })
    expect(key.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(key)
    expect(marks("var(--role")).toEqual([
      { shape: "circle", fill: "var(--role-2)" },
    ])
    expect(
      screen.getByRole("button", { name: "Nurse" }).getAttribute("aria-pressed")
    ).toBe("false")
    fireEvent.click(screen.getByRole("button", { name: "Nurse" }))
    expect(marks("var(--role")).toHaveLength(2)
  })

  // The chip stays in the legend when its series is off, or the only way
  // back would be remembering what used to be there.
  it("keeps a hidden job in the legend", () => {
    renderByRole(["Nurse", "IT Manager"])
    fireEvent.click(screen.getByRole("button", { name: "Nurse" }))
    expect(screen.getByRole("button", { name: "Nurse" })).toBeDefined()
  })

  it("refuses to switch off the last job showing", () => {
    renderByRole(["Nurse", "IT Manager"])
    fireEvent.click(screen.getByRole("button", { name: "Nurse" }))
    const last = screen.getByRole("button", { name: "IT Manager" })
    expect(last.hasAttribute("disabled")).toBe(true)
    fireEvent.click(last)
    expect(marks("var(--role")).toHaveLength(1)
  })

  // A key can name a job the plot could not place (nobody in it has a birth
  // date). It must not count as the one series holding the chart up, or the
  // last job with points would be locked on for no visible reason.
  it("lets the last drawn job be the one that stays, not a key with no points", () => {
    renderScatter({
      rows: [
        row({ displayName: "Alex Doe", gender: "Kvinna", roleTitle: "Nurse" }),
        row({
          displayName: "Bo Berg",
          gender: "Man",
          roleTitle: "IT Manager",
          birthDate: undefined,
        }),
      ],
      groupLabelFor: byRoleTitle,
      roleOrder: ["Nurse", "IT Manager"],
    })
    fireEvent.click(screen.getByRole("tab", { name: m.colorRole }))
    // Nothing of IT Manager's is on the plot, so its key is free to toggle
    // and Nurse's is the one that cannot go.
    expect(
      screen
        .getByRole("button", { name: "IT Manager" })
        .hasAttribute("disabled")
    ).toBe(false)
    expect(
      screen.getByRole("button", { name: "Nurse" }).hasAttribute("disabled")
    ).toBe(true)
  })

  // One chip stands for every job past the sixth, so switching it off has to
  // take the whole bucket with it.
  it("hides the whole neutral bucket from its one chip", () => {
    const jobs = Array.from({ length: 8 }, (_, i) => `Job ${i + 1}`)
    renderScatter({
      rows: [
        row({ displayName: "Alex Doe", gender: "Kvinna", roleTitle: "Job 1" }),
        row({ displayName: "Bo Berg", gender: "Man", roleTitle: "Job 7" }),
      ],
      groupLabelFor: byRoleTitle,
      roleOrder: jobs,
    })
    fireEvent.click(screen.getByRole("tab", { name: m.colorRole }))
    expect(marks("var(--role")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: m.colorRoleOther }))
    expect(marks("var(--role")).toEqual([
      { shape: "circle", fill: "var(--role-1)" },
    ])
  })

  // Nothing on the chart encodes gender in this mode, so naming the two
  // series would offer a distinction the reader cannot make on the plot.
  it("takes the gender key off the legend entirely", () => {
    renderByRole(["Nurse", "IT Manager"])
    expect(screen.queryByText(mGender.Kvinna)).toBeNull()
    expect(screen.queryByText(mGender.Man)).toBeNull()
    fireEvent.click(screen.getByRole("tab", { name: m.colorGender }))
    expect(screen.getByText(mGender.Kvinna)).toBeDefined()
    expect(screen.getByText(mGender.Man)).toBeDefined()
  })
})

function renderTooltip(
  point: ScatterPoint,
  xMode: ScatterXMode = "age",
  roleColor?: string
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ScatterTooltipContent
        point={point}
        currency="SEK"
        xMode={xMode}
        {...(roleColor === undefined ? {} : { roleColor })}
      />
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

  // The hover has to show the mark the reader is pointing at, on the line
  // that mark actually names. In role mode nothing encodes gender, so the
  // gender line loses its own mark rather than showing one that means the
  // job.
  it("moves its mark onto the job line when the plot is showing jobs", () => {
    const { container } = renderTooltip(
      {
        x: 36,
        y: 40000,
        woman: true,
        row: row({ gender: "Kvinna" }),
        groupLabel: "Nurse|3",
      },
      "age",
      "var(--role-3)"
    )
    const marks = [...container.querySelectorAll("svg :is(path, circle, rect)")]
    expect(marks.map((mark) => mark.getAttribute("fill"))).toEqual([
      "var(--role-3)",
    ])
    expect(marks[0]?.tagName.toLowerCase()).toBe("circle")
  })

  it("keeps the gender mark on the gender line when the plot shows gender", () => {
    const { container } = renderTooltip({
      x: 36,
      y: 40000,
      woman: true,
      row: row({ gender: "Kvinna" }),
      groupLabel: "Nurse|3",
    })
    const marks = [...container.querySelectorAll("svg :is(path, circle, rect)")]
    expect(marks.map((mark) => mark.getAttribute("fill"))).toEqual([
      "var(--gender-woman)",
    ])
  })

  it("omits the group row when not provided (equalWork)", () => {
    const point: ScatterPoint = { x: 36, y: 40000, woman: true, row: row() }
    renderTooltip(point)
    expect(screen.queryByText(m.group)).toBeNull()
  })
})
