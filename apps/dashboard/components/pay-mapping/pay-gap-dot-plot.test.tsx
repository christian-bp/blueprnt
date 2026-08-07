import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"

import {
  buildDotPlotModel,
  DotPlotTooltipContent,
  meanLabelPlacement,
  PayGapDotPlot,
} from "@/components/pay-mapping/pay-gap-dot-plot"
import type { PayMappingSnapshotRow } from "@/components/pay-mapping/pay-mapping-gap-types"
import { makeGapGroup } from "@/test/pay-mapping-fixtures"

const m = messages.dashboard.payMapping

function memberRow(
  overrides: Partial<PayMappingSnapshotRow> = {}
): PayMappingSnapshotRow {
  return {
    personPublicId: "p1",
    displayName: "Person",
    erased: false,
    gender: "Man",
    roleTitle: "SWE",
    trackKey: "IC",
    seniority: "Senior",
    level: 3,
    basicMonthly: 100000,
    components: [],
    currency: "SEK",
    payYear: 2026,
    ...overrides,
  }
}

describe("buildDotPlotModel", () => {
  it("lanes women above men and plots FTE-adjusted base salary with diffs", () => {
    const group = makeGapGroup({
      base: { womenMean: 90000, menMean: 100000, gapPct: 10, gapKr: 10000 },
    })
    const model = buildDotPlotModel(group, [
      memberRow({
        displayName: "Anna",
        gender: "Kvinna",
        basicMonthly: 45000,
        ftePercent: 50,
      }),
      memberRow({ displayName: "Mats", gender: "Man", basicMonthly: 100000 }),
      // Outside the group's identity: never plotted.
      memberRow({ displayName: "Other", roleTitle: "Other" }),
    ])
    expect(model.points).toHaveLength(2)
    const anna = model.points.find((p) => p.name === "Anna")
    const mats = model.points.find((p) => p.name === "Mats")
    // 45k at 50% FTE grosses to 90k; women's lane sits above the men's.
    expect(anna?.x).toBe(90000)
    expect(anna?.lane).toBeGreaterThan(mats?.lane ?? 0)
    expect(anna?.diffKr).toBe(-10000)
    expect(anna?.diffPct).toBe(-10)
    expect(model.womenMean).toBe(90000)
    expect(model.menMean).toBe(100000)
    expect(model.gapKr).toBe(10000)
  })

  it("plots total comp for a tccDriven group", () => {
    const group = makeGapGroup({
      base: { womenMean: 100000, menMean: 100000, gapPct: 0, gapKr: 0 },
      tcc: { womenMean: 100000, menMean: 112000, gapPct: 10.7, gapKr: 12000 },
      tccDriven: true,
    })
    const model = buildDotPlotModel(group, [
      memberRow({
        displayName: "Mats",
        basicMonthly: 100000,
        components: [{ kind: "bonus", monthlyAmount: 12000 }],
      }),
    ])
    expect(model.points[0]?.x).toBe(112000)
    expect(model.menMean).toBe(112000)
  })

  it("pads the domain around the data and both reference lines", () => {
    const group = makeGapGroup({
      base: { womenMean: 90000, menMean: 100000, gapPct: 10, gapKr: 10000 },
    })
    const model = buildDotPlotModel(group, [
      memberRow({ gender: "Kvinna", basicMonthly: 90000 }),
      memberRow({ basicMonthly: 100000 }),
    ])
    expect(model.domain[0]).toBeLessThan(90000)
    expect(model.domain[1]).toBeGreaterThan(100000)
  })

  it("keeps a visible span for a flat group (all on one value)", () => {
    const group = makeGapGroup({
      metric: { womenMean: 50000, menMean: 50000, gapPct: 0, gapKr: 0 },
    })
    const model = buildDotPlotModel(group, [
      memberRow({ gender: "Kvinna", basicMonthly: 50000 }),
      memberRow({ basicMonthly: 50000 }),
    ])
    expect(model.domain[1] - model.domain[0]).toBeGreaterThan(0)
  })
})

describe("DotPlotTooltipContent", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows the name, pay, and the diff against the men's average", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DotPlotTooltipContent
          point={{
            x: 90000,
            lane: 1,
            woman: true,
            name: "Anna",
            erased: false,
            diffKr: -10000,
            diffPct: -10,
          }}
          currency="SEK"
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Anna")).toBeDefined()
    expect(screen.getByText(m.dotPlot.pay)).toBeDefined()
    expect(screen.getByText(m.dotPlot.diff)).toBeDefined()
  })

  it("tombstones an erased member's name", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DotPlotTooltipContent
          point={{
            x: 90000,
            lane: 0,
            woman: false,
            name: "Raderad",
            erased: true,
            diffKr: null,
            diffPct: null,
          }}
          currency="SEK"
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByText(m.detail.erased)).toBeDefined()
  })
})

describe("PayGapDotPlot", () => {
  afterEach(() => {
    cleanup()
  })

  it("stacks the two mean labels and turns each one inward from its line", () => {
    // Women behind: their line is the left one, so their label reads
    // rightwards and the men's leftwards, and the women's sits a line above
    // so the two can never overprint on a narrow gap.
    const behind = meanLabelPlacement(90000, 100000)
    expect(behind.women).toBe("insideBottomLeft")
    expect(behind.men).toBe("insideBottomRight")
    expect(behind.womenDy).toBeLessThan(0)

    // Women ahead: the sides swap, or the outer label runs off the plot.
    const ahead = meanLabelPlacement(100000, 90000)
    expect(ahead.women).toBe("insideBottomRight")
    expect(ahead.men).toBe("insideBottomLeft")

    // A single mean has no other label to avoid.
    expect(meanLabelPlacement(90000, null).women).toBe("insideBottomLeft")
    expect(meanLabelPlacement(null, 90000).men).toBe("insideBottomRight")
  })

  it("renders the card title, help, and the text legend for both series", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PayGapDotPlot
          group={makeGapGroup()}
          rows={[
            memberRow({ gender: "Kvinna", basicMonthly: 90000 }),
            memberRow({ basicMonthly: 100000 }),
          ]}
          currency="SEK"
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByText(m.dotPlot.title)).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.payGapDotPlotLabel,
      })
    ).toBeDefined()
    // Both series named in text (gender is never mark-alone).
    expect(screen.getByText("Woman")).toBeDefined()
    expect(screen.getByText("Man")).toBeDefined()
  })
})
