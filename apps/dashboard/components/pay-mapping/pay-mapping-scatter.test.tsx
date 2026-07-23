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

const REF = Date.UTC(2026, 6, 1)

function row(
  overrides: Partial<PayMappingSnapshotRow> = {}
): PayMappingSnapshotRow {
  return {
    displayName: "Alex Doe",
    erased: false,
    gender: "Kvinna",
    roleTitle: "SWE",
    trackKey: "IC",
    level: "Senior",
    band: 3,
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

  it("names the person, and shows role/level, band, and gender", () => {
    const point: ScatterPoint = {
      x: 36,
      y: 40000,
      woman: true,
      row: row({
        displayName: "Alex Doe",
        gender: "Kvinna",
        roleTitle: "SWE",
        level: "Senior",
        band: 3,
      }),
    }
    renderTooltip(point)
    expect(screen.getByText("Alex Doe")).toBeDefined()
    expect(screen.getByText("SWE · Senior")).toBeDefined()
    expect(screen.getByText("Band 3")).toBeDefined()
    expect(screen.getByText(mGender.Kvinna)).toBeDefined()
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

  it("shows the basic/variable split and the FTE-adjusted total when there is variable pay", () => {
    const point: ScatterPoint = {
      x: 5,
      y: 52500,
      woman: false,
      row: row({
        gender: "Man",
        basicMonthly: 40000,
        components: [{ kind: "variable", monthlyAmount: 2000 }],
      }),
    }
    renderTooltip(point)
    expect(screen.getByText("SEK 40,000")).toBeDefined()
    expect(screen.getByText("SEK 2,000")).toBeDefined()
    expect(screen.getByText("SEK 52,500")).toBeDefined()
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
