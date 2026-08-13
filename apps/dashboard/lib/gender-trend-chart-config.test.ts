import { describe, expect, it } from "vitest"
import {
  gapChartConfig,
  headcountChartConfig,
  toGapTrendRows,
  toHeadcountTrendRows,
} from "@/lib/gender-trend-chart-config"

const formatDate = (date: Date | number) =>
  new Date(date).toISOString().slice(0, 10)

describe("headcountChartConfig", () => {
  it("keys the config by series with the caller's labels and the shared gender tokens", () => {
    const config = headcountChartConfig({ women: "Kvinnor", men: "Män" })
    expect(config.women).toEqual({
      label: "Kvinnor",
      color: "var(--gender-woman)",
    })
    expect(config.men?.label).toBe("Män")
    expect(config.men?.color).toBe("var(--gender-man)")
    expect(config.men?.icon).toBeTypeOf("function")
  })
})

describe("gapChartConfig", () => {
  it("keys the config by gapPct with the caller's label and the brand token", () => {
    expect(gapChartConfig("Löneskillnad")).toEqual({
      gapPct: { label: "Löneskillnad", color: "var(--brand)" },
    })
  })
})

describe("toHeadcountTrendRows", () => {
  it("maps each point's run label, formatted date, and counts", () => {
    const rows = toHeadcountTrendRows(
      [{ date: Date.UTC(2026, 0, 1), runLabel: "2026", women: 3, men: 4 }],
      formatDate
    )
    expect(rows).toEqual([
      { label: "2026", caption: "2026-01-01", women: 3, men: 4 },
    ])
  })

  it("maps an empty list to an empty list", () => {
    expect(toHeadcountTrendRows([], formatDate)).toEqual([])
  })
})

describe("toGapTrendRows", () => {
  it("maps each point's run label, formatted date, and gap, preserving null", () => {
    const rows = toGapTrendRows(
      [
        {
          date: Date.UTC(2026, 0, 1),
          runLabel: "2026",
          gapPct: 4.1,
        },
        {
          date: Date.UTC(2027, 0, 1),
          runLabel: "2027",
          gapPct: null,
        },
      ],
      formatDate
    )
    expect(rows).toEqual([
      { label: "2026", caption: "2026-01-01", gapPct: 4.1 },
      { label: "2027", caption: "2027-01-01", gapPct: null },
    ])
  })
})
