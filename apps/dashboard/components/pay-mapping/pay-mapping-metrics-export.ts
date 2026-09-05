"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { genderStats } from "@workspace/core"
import { useMutation } from "convex/react"
import type { Workbook } from "exceljs"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import { exportFileLabel } from "@/lib/export-file-name"
import {
  EXPORT_MIN_GROUP_SIZE,
  EXPORT_MIN_PER_GENDER,
  exportMasksGenderMeans,
} from "@/lib/pay-mapping-masking"
import { toast } from "@/lib/toast"
import type {
  GapGroup,
  PayMappingGapResult,
  PayMappingRunDetail,
  PayMappingSnapshotRow,
} from "./pay-mapping-gap-types"
import { fteBaseMonthly, fteTotalMonthly } from "./pay-mapping-gap-types"
import {
  floorVariablePayStats,
  memberRows,
  orgVariablePayStats,
  signedGapPctOf,
} from "./pay-mapping-report-data"

// The key-figures export as an Excel workbook: the organization's pay-gap
// figures (mean and median total pay, the variable-pay pair, the quartile
// distribution) and the per-category tables, in the format this market
// actually consumes (every Nordic pay-equity tool exports Office documents;
// no authority anywhere ingests JSON, and the practitioners downstream work
// in Excel). Numbers are written as NUMBERS so the sheet can be computed
// on; a masked figure is an EMPTY cell, stated by the masking note. The
// same export-boundary masking as the PDF (ADR-0012) is applied in the
// assembly, and the download is logged at the boundary before the file is
// handed over.

// A per-gender amount with its signed gap. Positive means men earn more;
// null is masked or not computable.
export interface MetricsGenderAmount {
  women: number | null
  men: number | null
  gapPct: number | null
}

export interface MetricsGroupRow {
  key: string
  roleTitle: string | null
  level: number | null
  women: number
  men: number
  basePay: MetricsGenderAmount
  totalPay: MetricsGenderAmount
  variablePay: MetricsGenderAmount
}

export interface PayMappingMetrics {
  runLabel: string
  status: "draft" | "final"
  referenceDate: number
  currency: string | null
  population: { total: number; women: number; men: number; priced: number }
  organization: {
    meanTotalPay: MetricsGenderAmount
    medianTotalPay: MetricsGenderAmount
    variablePay: {
      receivingSharePct: { women: number | null; men: number | null }
      meanAmount: MetricsGenderAmount
      medianAmount: MetricsGenderAmount
    }
    quartiles: { women: number; men: number }[]
  }
  // The category tables list every mixed-gender group in BOTH directions;
  // what they cannot list is stated as counts so the export never looks
  // like it lost groups silently.
  coverage: { singletonGroups: number; singleGenderGroups: number }
  groups: {
    equalWork: MetricsGroupRow[]
    equivalentLevels: MetricsGroupRow[]
  }
}

// Rounding keeps the workbook stable across recomputation: whole currency
// units for amounts, one decimal for percentages (the display convention).
function roundAmount(value: number | null): number | null {
  return value === null ? null : Math.round(value)
}

// toFixed, not Math.round(v * 10) / 10: the latter rounds a negative
// half-tenth toward zero while the app's Intl-based percent formatters
// round it away, and the same raw figure must never print -2.2 in the
// workbook and -2.3 in the PDF.
function roundPct(value: number | null): number | null {
  return value === null ? null : Number.parseFloat(value.toFixed(1))
}

// The signed gap is recomputed from the raw means rather than read off the
// wire, so every table in this export carries one sign convention
// regardless of which direction the analysis flow filed the group under.
function genderAmount(
  women: number | null,
  men: number | null
): MetricsGenderAmount {
  return {
    women: roundAmount(women),
    men: roundAmount(men),
    gapPct: roundPct(signedGapPctOf(women, men)),
  }
}

const MASKED_AMOUNT: MetricsGenderAmount = {
  women: null,
  men: null,
  gapPct: null,
}

function meanOf(values: number[]): number | null {
  if (values.length === 0) return null
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

function groupRow(
  group: GapGroup,
  pricedRows: PayMappingSnapshotRow[]
): MetricsGroupRow {
  const masked = exportMasksGenderMeans(group)
  const counts = { women: group.womenCount, men: group.menCount }
  if (masked) {
    return {
      key: group.key,
      roleTitle: group.roleTitle,
      level: group.level,
      ...counts,
      basePay: MASKED_AMOUNT,
      totalPay: MASKED_AMOUNT,
      variablePay: MASKED_AMOUNT,
    }
  }
  // The variable component per member is total minus base (every pay
  // component beyond basic salary), FTE-adjusted like both of its parts.
  const members = memberRows(pricedRows, group)
  const variable = (row: PayMappingSnapshotRow) =>
    fteTotalMonthly(row) - fteBaseMonthly(row)
  const womenVariable = members
    .filter((row) => row.gender === "Kvinna")
    .map(variable)
  const menVariable = members
    .filter((row) => row.gender === "Man")
    .map(variable)
  return {
    key: group.key,
    roleTitle: group.roleTitle,
    level: group.level,
    ...counts,
    basePay: genderAmount(group.base.womenMean, group.base.menMean),
    totalPay: genderAmount(group.tcc.womenMean, group.tcc.menMean),
    variablePay: genderAmount(meanOf(womenVariable), meanOf(menVariable)),
  }
}

export function assemblePayMappingMetrics(input: {
  run: PayMappingRunDetail
  gap: PayMappingGapResult
  // The viewer's active locale: the workbook's rows collate by it, like
  // every other sorted list in the app.
  locale: string
}): PayMappingMetrics {
  const { run, gap, locale } = input
  const pricedRows = run.rows.filter((row) => row.basicMonthly !== null)
  const womenRows = pricedRows.filter((row) => row.gender === "Kvinna")
  const menRows = pricedRows.filter((row) => row.gender === "Man")

  // The organization-level per-gender floor: a gender with fewer priced
  // people than the group minimum masks entirely (the spread rule).
  const orgValues = (values: number[]): number[] | null =>
    values.length < EXPORT_MIN_GROUP_SIZE ? null : values
  const womenTotal = orgValues(womenRows.map(fteTotalMonthly))
  const menTotal = orgValues(menRows.map(fteTotalMonthly))
  const womenStats = womenTotal === null ? null : genderStats(womenTotal)
  const menStats = menTotal === null ? null : genderStats(menTotal)

  // The workbook leaves the HR context, so the variable-pay figures take the
  // export floor here; the assembly behind the documents stays raw.
  const variablePay = floorVariablePayStats(orgVariablePayStats(pricedRows))

  const equalWorkGroups = [...gap.equalWork, ...gap.excluded.reverse]
    .map((group) => groupRow(group, pricedRows))
    .sort(
      (a, b) =>
        (a.roleTitle ?? "").localeCompare(b.roleTitle ?? "", locale) ||
        (a.level ?? 0) - (b.level ?? 0)
    )

  return {
    runLabel: run.label,
    status: run.status === "completed" ? "final" : "draft",
    referenceDate: run.referenceDate,
    currency: gap.currency,
    population: {
      total: run.populationCount,
      women: gap.population.women,
      men: gap.population.men,
      priced: pricedRows.length,
    },
    organization: {
      meanTotalPay: genderAmount(
        womenStats?.mean ?? null,
        menStats?.mean ?? null
      ),
      medianTotalPay: genderAmount(
        womenStats?.median ?? null,
        menStats?.median ?? null
      ),
      variablePay: {
        receivingSharePct: {
          women: roundPct(variablePay.womenSharePct),
          men: roundPct(variablePay.menSharePct),
        },
        meanAmount: genderAmount(variablePay.womenMean, variablePay.menMean),
        medianAmount: genderAmount(
          variablePay.womenMedian,
          variablePay.menMedian
        ),
      },
      quartiles: gap.quartiles.map((tally) => ({
        women: tally.women,
        men: tally.men,
      })),
    },
    coverage: {
      singletonGroups: gap.excluded.singletonCount,
      singleGenderGroups: gap.excluded.genderPure.length,
    },
    groups: {
      equalWork: equalWorkGroups,
      equivalentLevels: gap.equivalentWork.map((group) =>
        groupRow(group, pricedRows)
      ),
    },
  }
}

// Every string the workbook renders, resolved by the caller so the builder
// stays i18n-free (the report template's pattern).
export interface MetricsWorkbookLabels {
  sheetTitle: string
  statusTag: string
  referenceDateLine: string
  generatedOn: string
  // Two masking notes because two rules apply: the key-figures sheet masks
  // by the organization-level per-gender floor, the group sheets by the
  // per-group small-cell rule. Each sheet states ITS OWN rule.
  maskedNoteOrg: string
  maskedNoteGroups: string
  // What the equal-work table cannot list, stated as counts.
  coverageNote: string
  signNote: string
  colWomen: string
  colMen: string
  colGapPct: string
  colGroup: string
  colLevel: string
  meanTotal: string
  medianTotal: string
  variableShare: string
  variableMean: string
  variableMedian: string
  quartilesTitle: string
  quartileRow: (index: number) => string
  basePay: string
  totalPay: string
  variablePay: string
  equalWorkTitle: string
  levelsTitle: string
}

const NOTE_FONT = { italic: true, color: { argb: "FF6B6B6B" } } as const

function addGroupSheet(
  workbook: Workbook,
  title: string,
  rows: MetricsGroupRow[],
  labels: MetricsWorkbookLabels,
  withGroupColumn: boolean,
  // Written under the table (its own masking rule, the sign convention,
  // and for the equal-work sheet what the table cannot list).
  notes: string[]
) {
  const sheet = workbook.addWorksheet(title)
  const lead = withGroupColumn
    ? [labels.colGroup, labels.colLevel, labels.colWomen, labels.colMen]
    : [labels.colLevel, labels.colWomen, labels.colMen]
  // Row 1 groups the metric families over their three columns each; row 2
  // carries the per-column headers.
  const familyRow = sheet.addRow([
    ...lead.map(() => ""),
    labels.basePay,
    "",
    "",
    labels.totalPay,
    "",
    "",
    labels.variablePay,
    "",
    "",
  ])
  familyRow.font = { bold: true }
  for (let family = 0; family < 3; family++) {
    const start = lead.length + 1 + family * 3
    sheet.mergeCells(1, start, 1, start + 2)
  }
  const triplet = [labels.colWomen, labels.colMen, labels.colGapPct]
  const headerRow = sheet.addRow([...lead, ...triplet, ...triplet, ...triplet])
  headerRow.font = { bold: true }
  for (const row of rows) {
    sheet.addRow([
      ...(withGroupColumn ? [row.roleTitle ?? "", row.level] : [row.level]),
      row.women,
      row.men,
      row.basePay.women,
      row.basePay.men,
      row.basePay.gapPct,
      row.totalPay.women,
      row.totalPay.men,
      row.totalPay.gapPct,
      row.variablePay.women,
      row.variablePay.men,
      row.variablePay.gapPct,
    ])
  }
  sheet.addRow([])
  for (const note of notes) {
    sheet.addRow([note]).font = NOTE_FONT
  }
  sheet.getColumn(1).width = withGroupColumn ? 32 : 12
  for (let column = 2; column <= lead.length + 9; column++) {
    sheet.getColumn(column).width = 13
  }
}

// The workbook, built from the assembled metrics. exceljs is imported on
// demand: this module is statically imported by the runs list, and the
// spreadsheet engine has no business in that page's bundle.
export async function buildMetricsWorkbook(
  metrics: PayMappingMetrics,
  labels: MetricsWorkbookLabels
): Promise<Workbook> {
  const { Workbook: ExcelWorkbook } = await import("exceljs")
  const workbook = new ExcelWorkbook()
  const sheet = workbook.addWorksheet(labels.sheetTitle)

  sheet.addRow([metrics.runLabel]).font = { bold: true, size: 14 }
  sheet.addRow([labels.statusTag])
  sheet.addRow([labels.referenceDateLine])
  sheet.addRow([labels.generatedOn])
  sheet.addRow([labels.maskedNoteOrg]).font = NOTE_FONT
  sheet.addRow([labels.signNote]).font = NOTE_FONT
  sheet.addRow([])
  sheet.addRow(["", labels.colWomen, labels.colMen, labels.colGapPct]).font = {
    bold: true,
  }
  const amountRow = (label: string, amount: MetricsGenderAmount) =>
    sheet.addRow([label, amount.women, amount.men, amount.gapPct])
  const organization = metrics.organization
  amountRow(labels.meanTotal, organization.meanTotalPay)
  amountRow(labels.medianTotal, organization.medianTotalPay)
  sheet.addRow([
    labels.variableShare,
    organization.variablePay.receivingSharePct.women,
    organization.variablePay.receivingSharePct.men,
    null,
  ])
  amountRow(labels.variableMean, organization.variablePay.meanAmount)
  amountRow(labels.variableMedian, organization.variablePay.medianAmount)
  sheet.addRow([])
  sheet.addRow([labels.quartilesTitle]).font = { bold: true }
  sheet.addRow(["", labels.colWomen, labels.colMen]).font = { bold: true }
  organization.quartiles.forEach((tally, index) => {
    sheet.addRow([labels.quartileRow(index), tally.women, tally.men])
  })
  sheet.getColumn(1).width = 52
  for (let column = 2; column <= 4; column++) {
    sheet.getColumn(column).width = 14
  }

  addGroupSheet(
    workbook,
    labels.equalWorkTitle,
    metrics.groups.equalWork,
    labels,
    true,
    [labels.coverageNote, labels.maskedNoteGroups, labels.signNote]
  )
  addGroupSheet(
    workbook,
    labels.levelsTitle,
    metrics.groups.equivalentLevels,
    labels,
    false,
    [labels.maskedNoteGroups, labels.signNote]
  )
  return workbook
}

// The export flow, shared by the report page and the runs list's row menu:
// assemble, build the workbook, log at the boundary BEFORE the file is
// handed over (the same rule as the PDF), then download.
// The standalone download's file name, shared with the archive package so
// the bundled workbook and the standalone one can never drift apart.
export function metricsFileName(label: string): string {
  return `${exportFileLabel(label)}-nyckeltal.xlsx`
}

export function usePayMappingMetricsExport(): {
  busy: boolean
  exportMetrics: (data: {
    run: PayMappingRunDetail
    gap: PayMappingGapResult
  }) => Promise<void>
  // The workbook alone, without the boundary log and the download: the
  // archive package builds the SAME workbook through this seam, so the
  // bundled file can never diverge from the standalone one. The caller owns
  // busy state and its own boundary event.
  renderWorkbookBuffer: (data: {
    run: PayMappingRunDetail
    gap: PayMappingGapResult
  }) => Promise<ArrayBuffer>
} {
  const t = useTranslations("dashboard.payMapping.report")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tAppendix = useTranslations("dashboard.model.methodAppendix")
  const format = useFormatter()
  const locale = useLocale()
  const { orgId } = useOrganization()
  const logExport = useMutation(
    api.payMapping.report.logPayMappingMetricsExport
  )
  const [busy, setBusy] = useState(false)

  async function renderWorkbookBuffer(data: {
    run: PayMappingRunDetail
    gap: PayMappingGapResult
  }): Promise<ArrayBuffer> {
    const metrics = assemblePayMappingMetrics({ ...data, locale })
    const quartileLabels = [
      t("quartile1"),
      t("quartile2"),
      t("quartile3"),
      t("quartile4"),
    ]
    const workbook = await buildMetricsWorkbook(metrics, {
      sheetTitle: t("metricsSheetTitle"),
      // The tag is one word; a draft's row carries the sentence that says
      // what its figures are worth, exactly as the two PDFs' covers do.
      statusTag:
        metrics.status === "final"
          ? t("tagFinal")
          : `${t("tagDraft")}: ${t("draftNote")}`,
      referenceDateLine: t("referenceDateLine", {
        date: format.dateTime(new Date(metrics.referenceDate), {
          dateStyle: "medium",
        }),
      }),
      generatedOn: tAppendix("generatedOn", {
        date: format.dateTime(new Date(), { dateStyle: "medium" }),
      }),
      maskedNoteOrg: t("metricsMaskedNoteOrg", {
        min: EXPORT_MIN_GROUP_SIZE,
      }),
      maskedNoteGroups: t("metricsMaskedNote", {
        min: EXPORT_MIN_GROUP_SIZE,
        perGender: EXPORT_MIN_PER_GENDER,
      }),
      coverageNote: t("metricsCoverageNote", {
        singletons: metrics.coverage.singletonGroups,
        singleGender: metrics.coverage.singleGenderGroups,
      }),
      signNote: t("metricsSignNote"),
      colWomen: tGap("columns.women"),
      colMen: tGap("columns.men"),
      colGapPct: t("colGapPct"),
      colGroup: tGap("columns.group"),
      colLevel: tGap("columns.level"),
      meanTotal: t("metricsMeanTotal"),
      medianTotal: t("metricsMedianTotal"),
      variableShare: t("metricsVariableShare"),
      variableMean: t("metricsVariableMean"),
      variableMedian: t("metricsVariableMedian"),
      quartilesTitle: t("quartilesTitle"),
      quartileRow: (index) => quartileLabels[index] ?? "",
      basePay: t("metricsBasePay"),
      totalPay: t("metricsTotalPay"),
      variablePay: t("metricsVariablePay"),
      equalWorkTitle: t("equalWorkTitle"),
      levelsTitle: t("levelsTitle"),
    })
    return (await workbook.xlsx.writeBuffer()) as ArrayBuffer
  }

  async function exportMetrics(data: {
    run: PayMappingRunDetail
    gap: PayMappingGapResult
  }): Promise<void> {
    setBusy(true)
    try {
      const buffer = await renderWorkbookBuffer(data)
      try {
        await logExport({ orgId, runId: data.run.runId })
      } catch {
        toast.error(t("logFailed"))
        return
      }
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = metricsFileName(data.run.label)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return { busy, exportMetrics, renderWorkbookBuffer }
}
