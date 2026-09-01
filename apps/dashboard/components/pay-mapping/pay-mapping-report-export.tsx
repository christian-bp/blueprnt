"use client"

import { pdf } from "@react-pdf/renderer"
import { api } from "@workspace/backend/convex/_generated/api"
import type { PraxisAreaKey } from "@workspace/constants"
import { useMutation } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { type CSSProperties, type ReactNode, useRef, useState } from "react"
import { useOrganization } from "@/components/org-context"
import {
  canRasterizeCharts,
  type CapturedChart,
  captureSvgToPng,
  unthrottledDelay,
} from "@/lib/chart-capture"
import { formatMoney } from "@/lib/currency"
import { percentText, signedPercentText } from "@/lib/percent"
import { toast } from "@/lib/toast"
import type {
  GenderTally,
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingGapResult,
  PayMappingNoteWire,
  PayMappingRunDetail,
} from "./pay-mapping-gap-types"
import { QuartileStat, WholeSurveyStat } from "./pay-mapping-overview"
import {
  PDF_MAN_INK,
  PDF_WOMAN_EDGE,
  PDF_WOMAN_INK,
} from "./pay-mapping-report-charts"
import {
  assemblePayMappingReport,
  computeHeaderBreaks,
  EXPORT_MIN_GROUP_SIZE,
  EXPORT_MIN_PER_GENDER,
  type ReportPreviousInput,
  unionReportDoc,
} from "./pay-mapping-report-data"
import {
  PayMappingReportPdf,
  type PayMappingReportLabels,
  type ReportChartImages,
  type ReportVariant,
} from "./pay-mapping-report-doc"

// The capture host pins the LIGHT theme's chart tokens (globals.css :root)
// as inline overrides, so an export made from a dark-themed session still
// rasterizes light charts for the light document. The gender inks are the
// PDF's own constants (the same light-token conversions the vector charts
// use); the neutrals are the :root values verbatim, and a neutral-scale
// retune must update them too.
export const CAPTURE_LIGHT_TOKENS = {
  "--gender-woman": PDF_WOMAN_INK,
  "--gender-woman-edge": PDF_WOMAN_EDGE,
  "--gender-man": PDF_MAN_INK,
  "--background": "oklch(1 0 0)",
  "--foreground": "oklch(0.145 0 0)",
  "--muted-foreground": "oklch(0.556 0 0)",
  "--border": "oklch(0.922 0 0)",
} as CSSProperties

// The host's charts mount with animation OFF (its rAF never fires in a
// hidden tab, which would capture the empty first frame); this wait covers
// ResponsiveContainer's measurement pass. Waited through unthrottledDelay,
// because a hidden tab throttles plain timers up to a minute per tick.
const CHART_SETTLE_MS = 600

// One chart out of the host, by its data-chart key. Per-chart best effort: a
// failed capture yields undefined and that slot falls back to the vector
// chart, never blocking the export.
async function captureHostChart(
  host: HTMLElement,
  key: string
): Promise<CapturedChart | undefined> {
  const svg = host.querySelector<SVGSVGElement>(
    `[data-chart="${key}"] svg.recharts-surface`
  )
  if (svg === null) return undefined
  try {
    return await captureSvgToPng(svg)
  } catch {
    return undefined
  }
}

// A population stat row's value: the count with its share of the total,
// "48 (41 %)". Figures and punctuation only, so it composes outside i18n.
function populationShare(
  count: number,
  total: number,
  format: ReturnType<typeof useFormatter>
): string {
  if (total === 0) return format.number(count)
  return `${format.number(count)} (${percentText((count / total) * 100, format)})`
}

// Everything one export consumes; the caller owns the fetching (the report
// page reads its run context and subscriptions, the runs list fetches
// one-shot), the hook owns everything after.
export interface ReportExportData {
  run: PayMappingRunDetail
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  actions: PayMappingActionWire[]
  notes: PayMappingNoteWire[]
  previous: ReportPreviousInput | null
}

// The statutory documentation export (M8), shared by the report page's card
// and the runs list's row menu: assembles the frozen run + work layer into
// the report doc, rasterizes the app's own charts off-screen, renders the
// document with the multi-pass pagination, logs the export in the audit
// trail (ADR-0011 p.3: the boundary where data leaves the system) and hands
// the browser the file. The caller must render `captureHost` somewhere in
// its tree, or the chart capture silently falls back to the vector charts.
export function usePayMappingReportExport(): {
  busy: boolean
  exportReport: (
    data: ReportExportData,
    variant?: ReportVariant
  ) => Promise<void>
  captureHost: ReactNode
} {
  const t = useTranslations("dashboard.payMapping.report")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tActions = useTranslations("dashboard.payMapping.actions")
  const tActionsOverview = useTranslations(
    "dashboard.payMapping.actionsOverview"
  )
  const tReasons = useTranslations("dashboard.payMapping.reasons")
  const tReview = useTranslations("dashboard.payMapping.review")
  // The document-shared labels the metodbilaga already owns (contents,
  // generated-on, criteria table columns): reused, not duplicated.
  const tAppendix = useTranslations("dashboard.model.methodAppendix")
  const format = useFormatter()
  const locale = useLocale()
  const { orgId } = useOrganization()
  const logExport = useMutation(api.payMapping.report.logPayMappingReportExport)
  const logUnionExport = useMutation(
    api.payMapping.report.logPayMappingUnionReportExport
  )
  const [busy, setBusy] = useState(false)
  // While set, the off-screen capture host renders the app's own charts
  // with this data so the export can rasterize them.
  const [captureData, setCaptureData] = useState<{
    population: GenderTally
    quartiles: GenderTally[]
  } | null>(null)
  const captureHostRef = useRef<HTMLDivElement | null>(null)

  async function exportReport(
    data: ReportExportData,
    variant: ReportVariant = "statutory"
  ): Promise<void> {
    const { run, gap, analyses, actions, notes, previous } = data
    setBusy(true)
    try {
      const currency = gap.currency
      const money = (value: number) =>
        currency === null
          ? format.number(Math.round(value))
          : formatMoney(value, currency, locale)
      const assembled = assemblePayMappingReport({
        run,
        gap,
        analyses,
        actions,
        notes,
        previous,
        formatters: {
          money,
          pct: (value) => percentText(value, format),
          signedPct: (value) => signedPercentText(value, format),
          date: (epochMs) =>
            format.dateTime(new Date(epochMs), { dateStyle: "medium" }),
        },
      })
      // The union variant's data-level masking (person-targeted action
      // costs, notes) happens on the assembled doc, so both variants share
      // one assembly and can never diverge in their figures.
      const doc = variant === "union" ? unionReportDoc(assembled) : assembled

      // The app's own shadcn charts (the population donut and the quartile
      // stack), rasterized off-screen: the capture host mounts with the
      // frozen figures, recharts' mount animation settles, and each SVG is
      // captured as a PNG. Best effort per chart: any failure leaves its
      // slot undefined and the template draws the vector fallback, so the
      // statutory export never depends on rasterization.
      let chartImages: ReportChartImages = {}
      // A fully hidden tab suspends the rendering steps recharts needs to
      // draw at all, so the capture is skipped outright there (the vector
      // fallback carries the document); a user-initiated export runs in a
      // visible tab.
      if (canRasterizeCharts() && document.visibilityState === "visible") {
        try {
          setCaptureData({
            population: {
              women: doc.population.women,
              men: doc.population.men,
            },
            quartiles: gap.quartiles,
          })
          await unthrottledDelay(CHART_SETTLE_MS)
          const host = captureHostRef.current
          if (host !== null) {
            const population = await captureHostChart(host, "population")
            const quartiles = await captureHostChart(host, "quartiles")
            chartImages = {
              ...(population === undefined ? {} : { population }),
              ...(quartiles === undefined ? {} : { quartiles }),
            }
          }
        } finally {
          setCaptureData(null)
        }
      }

      const quartileLabels = [
        t("quartile1"),
        t("quartile2"),
        t("quartile3"),
        t("quartile4"),
      ]
      const union = variant === "union"
      const labels: PayMappingReportLabels = {
        docTitle: union ? t("unionTitle") : t("docTitle"),
        footer: union ? t("unionTitle") : t("docTitle"),
        // The union cover states its legal ground and purpose: no
        // individual-level data, separate disclosure under MBL
        // tystnadsplikt when needed, and the masking thresholds (stated as
        // this tool's own conservative choice, never a standard).
        ...(union
          ? {
              coverSubtitle: t("unionSubtitle"),
              coverPurpose: t("unionPurpose", {
                min: EXPORT_MIN_GROUP_SIZE,
                perGender: EXPORT_MIN_PER_GENDER,
              }),
            }
          : {}),
        contentsTitle: tAppendix("contentsTitle"),
        statusTag: doc.status === "final" ? t("tagFinal") : t("tagDraft"),
        generatedOn: tAppendix("generatedOn", {
          date: format.dateTime(new Date(), { dateStyle: "medium" }),
        }),
        referenceDateLine: t("referenceDateLine", {
          date: doc.referenceDate,
        }),
        populationTotal: format.number(doc.population.total),
        populationWomen: populationShare(
          doc.population.women,
          doc.population.total,
          format
        ),
        populationMen: populationShare(
          doc.population.men,
          doc.population.total,
          format
        ),
        populationPriced: format.number(doc.population.priced),
        summaryTitle: t("summaryTitle"),
        summaryEmployees: t("summaryEmployees"),
        summaryWomen: t("summaryWomen"),
        summaryMen: t("summaryMen"),
        summaryPriced: t("summaryPriced"),
        summaryWomenShareMean: t("summaryWomenShareMean"),
        summaryWomenShareMedian: t("summaryWomenShareMedian"),
        summaryVariableShareWomen: t("summaryVariableShareWomen"),
        summaryVariableShareMen: t("summaryVariableShareMen"),
        summaryVariableWomenShareMean: t("summaryVariableWomenShareMean"),
        summaryVariableWomenShareMedian: t("summaryVariableWomenShareMedian"),
        summaryGroupsShown: t("summaryGroupsShown"),
        summaryGroupsRequired: t("summaryGroupsRequired"),
        summaryGroupsDocumented: t("summaryGroupsDocumented"),
        summarySingletons: t("summarySingletons"),
        summaryWdGroups: t("summaryWdGroups"),
        summaryComparisons: t("summaryComparisons"),
        summaryComparisonsDocumented: t("summaryComparisonsDocumented"),
        summaryActionsCount: t("summaryActionsCount"),
        summaryCost: tActions("estimatedCost"),
        introTitle: t("introTitle"),
        introBody: t("introBody"),
        orgGapLine:
          doc.org.gapPct === null ||
          doc.org.womenMean === null ||
          doc.org.menMean === null
            ? t("orgGapUnmeasurable")
            : t("orgGapLine", {
                womenMean: doc.org.womenMean,
                menMean: doc.org.menMean,
                gap: doc.org.gapPct,
              }),
        orgMedianLine:
          doc.org.womenMedian !== null &&
          doc.org.menMedian !== null &&
          doc.org.medianGapPct !== null
            ? t("orgMedianLine", {
                womenMedian: doc.org.womenMedian,
                menMedian: doc.org.menMedian,
                gap: doc.org.medianGapPct,
              })
            : null,
        orgPreviousLine:
          doc.orgPrevious === null
            ? null
            : t("orgPreviousLine", {
                run: doc.orgPrevious.runLabel,
                date: doc.orgPrevious.referenceDate,
                gap: doc.orgPrevious.gapPct,
              }),
        chartMeansCaption: t("chartMeansCaption"),
        chartSpreadCaption: t("chartSpreadCaption"),
        chartQuartilesCaption: t("chartQuartilesCaption"),
        quartilesTitle: t("quartilesTitle"),
        quartileRow: (index) => quartileLabels[index] ?? "",
        spreadTitle: t("spreadTitle"),
        colP10: t("colP10"),
        colQ1: t("colQ1"),
        colMedian: t("colMedian"),
        colQ3: t("colQ3"),
        colP90: t("colP90"),
        colWomen: tGap("columns.women"),
        colMen: tGap("columns.men"),
        collaborationTitle: tReview("collaborationTitle"),
        participantsLabel: tReview("collaborationParticipants"),
        descriptionLabel: tReview("collaborationDescription"),
        notDocumented: t("notDocumented"),
        praxisTitle: t("praxisTitle"),
        praxisIntro: t("praxisIntro"),
        praxisAreaTitle: (key: PraxisAreaKey) => tReview(`praxis.${key}.title`),
        findingLabel: (finding) =>
          finding === "none"
            ? t("findingNone")
            : finding === "found"
              ? t("findingFound")
              : t("findingPending"),
        equalWorkTitle: t("equalWorkTitle"),
        equalWorkIntro: t("equalWorkIntro"),
        equalWorkStatusLine:
          doc.summary.equalWorkGroups === 0
            ? null
            : t("equalWorkStatusLine", {
                total: doc.summary.equalWorkGroups,
                required: doc.summary.equalWorkRequired,
                documented: doc.summary.equalWorkDocumented,
              }),
        wdStatusLine:
          doc.summary.womenDominatedGroups === 0
            ? null
            : t("wdStatusLine", {
                groups: doc.summary.womenDominatedGroups,
                comparisons: doc.summary.comparisonCount,
                documented: doc.summary.comparisonsDocumented,
              }),
        colGroup: tGap("columns.group"),
        colLevel: tGap("columns.level"),
        colWomenMean: t("colWomenMean"),
        colMenMean: t("colMenMean"),
        colGapPct: t("colGapPct"),
        colGapKr: t("colGapKr"),
        colStatus: t("colStatus"),
        flagLabel: (flag) => tGap(`flag.${flag}`),
        levelText: (level) => (level === null ? "-" : String(level)),
        levelRowLabel: (level) =>
          level === null ? "-" : tGap("levelLabel", { level }),
        tccDrivenMarker: "†",
        tccLine: (metric) =>
          t("tccLine", {
            womenMean: metric.womenMean ?? t("maskedCell"),
            menMean: metric.menMean ?? t("maskedCell"),
            gapPct: metric.gapPct ?? t("maskedCell"),
            gapKr: metric.gapKr ?? t("maskedCell"),
          }),
        medianShort: t("medianShort"),
        prevYearLine: (gapPct) => t("prevYearLine", { gap: gapPct }),
        reasonsLabel: t("reasonsLabel"),
        noteLabel: t("noteLabel"),
        reasonLabel: (reason) => tReasons(reason),
        undocumented: t("undocumented"),
        emptyEqualWork: t("emptyEqualWork"),
        reverseTitle: t("reverseTitle"),
        genderPureTitle: t("genderPureTitle"),
        genderPureRow: (row) =>
          t("genderPureRow", {
            group: row.label,
            level: row.level ?? "-",
            count: row.count,
            gender: row.gender === "Kvinna" ? t("wordWomen") : t("wordMen"),
          }),
        equivalentTitle: t("equivalentTitle"),
        equivalentIntro: t("equivalentIntro"),
        levelsTitle: t("levelsTitle"),
        levelsSignNote: t("levelsSignNote"),
        womenDominatedTitle: t("womenDominatedTitle"),
        womenDominatedIntro: t("womenDominatedIntro"),
        wdGroupLine: (group) =>
          t("wdGroupLine", {
            group: group.label,
            level: group.level,
            headcount: group.headcount,
            share: group.womenSharePct,
            mean: group.meanComp ?? t("maskedCell"),
          }),
        colComparator: t("colComparator"),
        colSpread: t("colSpread"),
        colHeadcount: tGap("columns.headcount"),
        colWomenShare: tGap("columns.womenShare"),
        colMean: tGap("columns.mean"),
        colDiffPct: tGap("columns.diffPct"),
        colDiffKr: tGap("columns.diffSek"),
        noComparators: tGap("noComparators"),
        emptyWomenDominated: t("emptyWomenDominated"),
        actionsTitle: t("actionsTitle"),
        actionsIntro: t("actionsIntro"),
        actionScopeLabel: (scope) =>
          scope === "equalWork"
            ? tActionsOverview("scopeEqualWork")
            : tActionsOverview("scopeEquivalentWork"),
        colAction: t("colAction"),
        colOwner: tActions("owner"),
        colDate: tActions("plannedDate"),
        colCost: tActions("estimatedCost"),
        colPriority: tActions("priorityLabel"),
        colActionStatus: t("colStatus"),
        targetKindLabel: (kind) => tActions(`targetKind.${kind}`),
        statusLabel: (status) => tActions(`status.${status}`),
        priorityLabel: (priority) => tActions(`priority.${priority}`),
        actionTotalsLine:
          doc.actionTotals.cost === null
            ? t("actionTotalsNoCost", { count: doc.actionTotals.count })
            : t("actionTotals", {
                count: doc.actionTotals.count,
                cost: doc.actionTotals.cost,
              }),
        noActions: t("noActions"),
        notesTitle: t("notesTitle"),
        noteTypeLabel: (type) => tActions(`noteType.${type}`),
        noNotes: t("noNotes"),
        evaluationTitle: t("evaluationTitle"),
        evaluationIntro:
          doc.previousEvaluation === null
            ? ""
            : t("evaluationIntro", {
                run: doc.previousEvaluation.runLabel,
                date: doc.previousEvaluation.referenceDate,
              }),
        evaluationStatusNote: t("evaluationStatusNote"),
        noPreviousActions: t("noPreviousActions"),
        methodTitle: t("methodTitle"),
        methodBody: t("methodBody"),
        criteriaTitle: t("criteriaTitle"),
        colCriterion: tAppendix("colCriterion"),
        colWeight: tAppendix("colWeight"),
        colShare: tAppendix("colShare"),
        pointBudgetLine: t("pointBudgetLine", {
          points: doc.method.pointBudget,
        }),
        scopeNote: t("scopeNote"),
        individualNote: t("individualNote"),
        statisticsNote: t("statisticsNote"),
        coverageNote: t("coverageNote", {
          singletons: doc.method.singletonCount,
          genderPure: doc.method.genderPureCount,
          reverse: doc.method.reverseCount,
        }),
        maskingNote: t("maskingNote", {
          count: doc.method.maskedGroupCount,
          min: EXPORT_MIN_GROUP_SIZE,
          perGender: EXPORT_MIN_PER_GENDER,
        }),
        measuresNote: t("measuresNote", {
          currency: doc.currency ?? "-",
        }),
        maskedCell: t("maskedCell"),
      }

      // Multi-pass render: each pass records where every section and table
      // row lands; from that the rows that start a new page get their
      // table's header re-rendered above them (continuation headers), and
      // because an inserted header can itself move later rows, the loop
      // repeats until the layout is stable. Convergence is NOT monotone
      // (an inserted header can push the previous page's last row forward,
      // MOVING a break rather than adding one), so there is no guaranteed
      // fixed point: typical documents settle in 2 passes, but measured
      // comparison-heavy documents have needed up to 13. The cap is a
      // safety stop; when it is hit, the final render ships the LAST
      // RENDERED set together with the page refs measured under it, never
      // an unrendered guess, so the contents page always matches the
      // document even if a continuation header then sits imperfectly.
      const maxPasses = 16
      let headerBreaks = new Set<string>()
      let pageRefs: Record<string, number> = {}
      for (let pass = 0; pass < maxPasses; pass++) {
        const rowPages: Record<string, number> = {}
        const refs: Record<string, number> = {}
        await pdf(
          <PayMappingReportPdf
            doc={doc}
            labels={labels}
            variant={variant}
            chartImages={chartImages}
            headerBreaks={headerBreaks}
            onResolvePage={(id, page) => {
              refs[id] = page
            }}
            onRowPage={(id, page) => {
              rowPages[id] = page
            }}
          />
        ).toBlob()
        pageRefs = refs
        const next = computeHeaderBreaks(doc, rowPages)
        const stable =
          next.size === headerBreaks.size &&
          [...next].every((id) => headerBreaks.has(id))
        if (stable || pass === maxPasses - 1) break
        headerBreaks = next
      }
      const blob = await pdf(
        <PayMappingReportPdf
          doc={doc}
          labels={labels}
          variant={variant}
          chartImages={chartImages}
          pageRefs={pageRefs}
          headerBreaks={headerBreaks}
        />
      ).toBlob()

      // The export-boundary audit row (ADR-0011 p.3) is written BEFORE the
      // file is handed over: a download the trail does not know about must
      // not happen. Generation stayed local; nothing has left the browser
      // yet.
      try {
        await (union
          ? logUnionExport({ orgId, runId: run.runId })
          : logExport({ orgId, runId: run.runId }))
      } catch {
        toast.error(t("logFailed"))
        return
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = union
        ? `${run.label}-facklig-rapport.pdf`
        : `${run.label}-lonekartlaggning.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  // The off-screen capture host: mounted only during an export, fixed
  // outside the viewport (not display:none, recharts must measure and draw
  // for real), pinned to the light chart tokens. Each chart sits under a
  // data-chart key the capture selects by.
  const captureHost =
    captureData === null ? null : (
      <div
        ref={captureHostRef}
        aria-hidden
        style={{
          position: "fixed",
          left: -10000,
          top: 0,
          width: 640,
          ...CAPTURE_LIGHT_TOKENS,
        }}
      >
        {captureData.population.women + captureData.population.men > 0 && (
          <div data-chart="population" style={{ width: 240 }}>
            <WholeSurveyStat
              population={captureData.population}
              countLabel={t("summaryEmployees")}
              animate={false}
            />
          </div>
        )}
        {captureData.quartiles.length > 0 && (
          <div data-chart="quartiles">
            <QuartileStat quartiles={captureData.quartiles} animate={false} />
          </div>
        )}
      </div>
    )

  return { busy, exportReport, captureHost }
}
