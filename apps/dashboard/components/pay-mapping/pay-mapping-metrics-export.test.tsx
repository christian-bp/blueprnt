import { renderHook, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import {
  makeExcluded,
  makeGapGroup,
  makeGapResult,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
import type { PayMappingSnapshotRow } from "./pay-mapping-gap-types"

const logExport = vi.fn(async () => null)
vi.mock("convex/react", () => ({
  useMutation: () => logExport,
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1" }),
}))

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import {
  assemblePayMappingMetrics,
  buildMetricsWorkbook,
  type MetricsWorkbookLabels,
  usePayMappingMetricsExport,
} from "./pay-mapping-metrics-export"

// Ten priced people in one SWE|3 group. Three of five women and four of
// five men carry a variable component, so the two genders sit on opposite
// sides of the receiver masking floor.
function makeRow(
  index: number,
  gender: "Kvinna" | "Man",
  basicMonthly: number,
  bonus: number
): PayMappingSnapshotRow {
  return {
    personPublicId: `p${gender}${index}`,
    displayName: `Person ${index}`,
    erased: false,
    gender,
    roleTitle: "SWE",
    trackKey: "ic",
    seniority: "Senior",
    level: 3,
    basicMonthly,
    components: bonus === 0 ? [] : [{ kind: "bonus", monthlyAmount: bonus }],
  }
}

const ROWS = [
  makeRow(0, "Kvinna", 40000, 2000),
  makeRow(1, "Kvinna", 40000, 2000),
  makeRow(2, "Kvinna", 40000, 2000),
  makeRow(3, "Kvinna", 40000, 0),
  makeRow(4, "Kvinna", 40000, 0),
  makeRow(5, "Man", 50000, 1000),
  makeRow(6, "Man", 50000, 1000),
  makeRow(7, "Man", 50000, 1000),
  makeRow(8, "Man", 50000, 1000),
  makeRow(9, "Man", 50000, 0),
]

const RUN = makeRunDetail({
  label: "Pay mapping 2026",
  status: "completed",
  populationCount: 10,
  rows: ROWS,
})

const GAP = makeGapResult({
  population: { women: 5, men: 5 },
  equalWork: [makeGapGroup({ key: "SWE|3", roleTitle: "SWE" })],
  equivalentWork: [makeGapGroup({ key: "3", roleTitle: null, level: 3 })],
  quartiles: [
    { women: 2, men: 1 },
    { women: 1, men: 1 },
    { women: 1, men: 1 },
    { women: 1, men: 2 },
  ],
  excluded: makeExcluded({
    singletonCount: 2,
    genderPure: [
      {
        key: "Lead|1",
        roleTitle: "Lead",
        seniority: null,
        level: 1,
        gender: "Man",
        count: 3,
      },
    ],
    // Women ahead: the export keeps the row and its SIGNED gap.
    reverse: [
      makeGapGroup({
        key: "UX|2",
        roleTitle: "UX",
        level: 2,
        flag: "ok",
        base: { womenMean: 50000, menMean: 45000 },
      }),
    ],
  }),
})

function assemble() {
  return assemblePayMappingMetrics({ run: RUN, gap: GAP, locale: "sv" })
}

describe("assemblePayMappingMetrics", () => {
  it("carries the run identity and the population", () => {
    const metrics = assemble()
    expect(metrics.status).toBe("final")
    expect(metrics.runLabel).toBe("Pay mapping 2026")
    expect(metrics.population).toEqual({
      total: 10,
      women: 5,
      men: 5,
      priced: 10,
    })
  })

  it("computes the organization mean and median total pay with a signed gap", () => {
    const metrics = assemble()
    // Women totals [42000 x3, 40000 x2], men [51000 x4, 50000].
    expect(metrics.organization.meanTotalPay).toEqual({
      women: 41200,
      men: 50800,
      gapPct: 18.9,
    })
    expect(metrics.organization.medianTotalPay).toEqual({
      women: 42000,
      men: 51000,
      gapPct: 17.6,
    })
  })

  it("computes variable-pay shares over everyone but amounts among receivers, masked under the floor", () => {
    const metrics = assemble()
    const variablePay = metrics.organization.variablePay
    expect(variablePay.receivingSharePct).toEqual({ women: 60, men: 80 })
    // Three women receive (below the 4-per-gender floor): masked; four men
    // receive: their mean and median are the receiver amounts.
    expect(variablePay.meanAmount).toEqual({
      women: null,
      men: 1000,
      gapPct: null,
    })
    expect(variablePay.medianAmount).toEqual({
      women: null,
      men: 1000,
      gapPct: null,
    })
  })

  it("lists every mixed group in both directions with one sign convention", () => {
    const metrics = assemble()
    const [swe, ux] = metrics.groups.equalWork
    // The shown group: men ahead, positive.
    expect(swe?.key).toBe("SWE|3")
    expect(swe?.basePay.gapPct).toBe(10)
    // Members feed the per-group variable component (mean across the whole
    // gender, zeros included): women 1200, men 800, men lower so negative.
    expect(swe?.variablePay).toEqual({ women: 1200, men: 800, gapPct: -50 })
    // The women-ahead group stays in the table with its negative gap.
    expect(ux?.key).toBe("UX|2")
    expect(ux?.basePay.gapPct).toBe(-11.1)
    // What the tables cannot list is stated as counts.
    expect(metrics.coverage).toEqual({
      singletonGroups: 2,
      singleGenderGroups: 1,
    })
  })

  it("masks a small group's amounts but keeps its counts", () => {
    const metrics = assemblePayMappingMetrics({
      run: RUN,
      gap: makeGapResult({
        equalWork: [
          makeGapGroup({
            key: "QA|4",
            roleTitle: "QA",
            level: 4,
            womenCount: 1,
            menCount: 3,
          }),
        ],
      }),
      locale: "sv",
    })
    const qa = metrics.groups.equalWork[0]
    expect(qa?.women).toBe(1)
    expect(qa?.men).toBe(3)
    expect(qa?.basePay).toEqual({ women: null, men: null, gapPct: null })
    expect(qa?.totalPay).toEqual({ women: null, men: null, gapPct: null })
    expect(qa?.variablePay).toEqual({ women: null, men: null, gapPct: null })
  })
})

const WORKBOOK_LABELS: MetricsWorkbookLabels = {
  sheetTitle: "Key figures",
  statusTag: "FINAL",
  referenceDateLine: "Reference date 1 Jul 2026",
  generatedOn: "Generated 31 Aug 2026",
  maskedNoteOrg: "Empty cells are masked (organization floor).",
  maskedNoteGroups: "Empty cells are masked (group rule).",
  coverageNote: "Not listed: 2 single-person and 1 single-gender group.",
  signNote: "Positive means men earn more.",
  colWomen: "Women",
  colMen: "Men",
  colGapPct: "Gap %",
  colGroup: "Group",
  colLevel: "Level",
  meanTotal: "Mean pay (total)",
  medianTotal: "Median pay (total)",
  variableShare: "Share with variable pay (%)",
  variableMean: "Variable pay, mean",
  variableMedian: "Variable pay, median",
  quartilesTitle: "Quartiles",
  quartileRow: (index) => `Quartile ${index + 1}`,
  basePay: "Basic salary",
  totalPay: "Total compensation",
  variablePay: "Variable pay components",
  equalWorkTitle: "Equal work",
  levelsTitle: "Per level",
}

describe("buildMetricsWorkbook", () => {
  it("writes the three sheets with numbers as numbers and masked as empty", async () => {
    const workbook = await buildMetricsWorkbook(assemble(), WORKBOOK_LABELS)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Key figures",
      "Equal work",
      "Per level",
    ])
    const key = workbook.getWorksheet("Key figures")
    // Rows: 1 run label, 2-4 meta, 5-6 notes, 7 blank, 8 header, 9 mean.
    expect(key?.getCell("A1").value).toBe("Pay mapping 2026")
    expect(key?.getCell("A9").value).toBe("Mean pay (total)")
    expect(key?.getCell("B9").value).toBe(41200)
    expect(key?.getCell("C9").value).toBe(50800)
    expect(key?.getCell("D9").value).toBe(18.9)
    // Row 11: the variable share; row 12: the masked women mean is EMPTY.
    expect(key?.getCell("B11").value).toBe(60)
    expect(key?.getCell("C11").value).toBe(80)
    expect(key?.getCell("B12").value).toBeNull()
    expect(key?.getCell("C12").value).toBe(1000)

    const equalWork = workbook.getWorksheet("Equal work")
    // Family headers merged over their triplets on row 1, columns on row 2,
    // first data row on row 3.
    expect(equalWork?.getCell("E1").value).toBe("Basic salary")
    expect(equalWork?.getCell("A2").value).toBe("Group")
    expect(equalWork?.getCell("A3").value).toBe("SWE")
    expect(equalWork?.getCell("G3").value).toBe(10)
    // The women-ahead group keeps its signed negative gap.
    expect(equalWork?.getCell("A4").value).toBe("UX")
    expect(equalWork?.getCell("G4").value).toBe(-11.1)
    // Under the table: what the table cannot list, ITS OWN masking rule,
    // and the sign convention (the key sheet's note describes a different
    // floor and must not stand in for this one).
    expect(equalWork?.getCell("A6").value).toBe(
      "Not listed: 2 single-person and 1 single-gender group."
    )
    expect(equalWork?.getCell("A7").value).toBe(
      "Empty cells are masked (group rule)."
    )
    expect(equalWork?.getCell("A8").value).toBe("Positive means men earn more.")
    // The key sheet states the ORGANIZATION floor, not the group rule.
    expect(key?.getCell("A5").value).toBe(
      "Empty cells are masked (organization floor)."
    )

    // The per-level sheet: no group column, so the families start at D and
    // the lead is Level + counts; notes carry the group rule too.
    const levels = workbook.getWorksheet("Per level")
    expect(levels?.getCell("D1").value).toBe("Basic salary")
    expect(levels?.getCell("A2").value).toBe("Level")
    expect(levels?.getCell("A3").value).toBe(3)
    expect(levels?.getCell("B3").value).toBe(2)
    expect(levels?.getCell("F3").value).toBe(10)
    expect(levels?.getCell("A5").value).toBe(
      "Empty cells are masked (group rule)."
    )
  })
})

describe("usePayMappingMetricsExport", () => {
  it("logs the export at the boundary before handing the workbook over", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    )
    const { result } = renderHook(() => usePayMappingMetricsExport(), {
      wrapper,
    })

    await result.current.exportMetrics({ run: RUN, gap: GAP })

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(logExport).toHaveBeenCalledWith({ orgId: "org1", runId: "run-1" })
    const logOrder = logExport.mock.invocationCallOrder[0] ?? 0
    const downloadOrder = createObjectURL.mock.invocationCallOrder[0] ?? 0
    expect(logOrder).toBeLessThan(downloadOrder)
    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob?.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
  })
})
