import { Image as PdfImage, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { ComponentProps } from "react"
import type { PayGapReason, PraxisAreaKey } from "@workspace/constants"
import type { PayGapFlag } from "@workspace/core"
import type { CapturedChart } from "@/lib/chart-capture"
import {
  BRAND,
  BrandedDocument,
  BrandedPage,
  Cover,
  Section,
} from "@/components/pdf/branded-document"
import type {
  ActionPriority,
  ActionStatus,
  NoteType,
} from "./pay-mapping-gap-types"
import {
  GenderBarsChart,
  PairedBarsChart,
  PdfGenderKeyRow,
  PdfGenderLegend,
  SpreadBandsChart,
} from "./pay-mapping-report-charts"
import type {
  PayMappingReportDoc,
  ReportGenderPureRow,
  ReportGroupRow,
  ReportMetricText,
  ReportWomenDominatedGroup,
} from "./pay-mapping-report-data"

// The statutory lönekartläggning documentation as a PDF (DL 3 kap. 13-14 §§).
// Section order follows the DO-canonical outline (docs/
// lonekartlaggning-rapport-kravbild.md), opened by a summary page with the
// key-figures table (the professional-template convention): sammanfattning,
// inledning, samverkan + praxis, lika arbete, likvärdigt arbete, åtgärder,
// utvärdering av föregående år, metod. Every section is its own PAGE, so a
// section always starts at a page top and a table gets the longest possible
// uncut runs. i18n-free like the metodbilaga: every string arrives resolved
// through `labels`, and all figures arrive display-formatted on the doc (the
// assembly applies the export-boundary masking; a null cell renders the
// masked/absent dash).
//
// Page-break protection: a table ROW (figures + meta) is an unbreakable
// unit, chart blocks are unbreakable, and every table re-renders its own
// header at each page it continues onto. The continuation headers come from
// a MULTI-PASS render: each row reports the page it landed on through a
// render-prop capture (`onRowPage`), the download component derives which
// rows start a new page (`headerBreaks`) and re-renders until the layout is
// stable, mirroring the metodbilaga's two-pass contents trick.
// A4 content width (595pt minus the page's 48pt horizontal padding), the
// width every chart draws at.
const CHART_WIDTH = 480

// A row whose free text reaches this length may exceed a full page as one
// block, and react-pdf draws an oversized wrap={false} block off the page
// edge with only a console warning: the overflow is silently lost from the
// document (measured at roughly 2,100 characters on the action row's
// geometry). Rows under the bound stay atomic; longer ones give up
// unbreakability so every word stays on a page.
const BREAKABLE_ROW_TEXT_LENGTH = 600

// The app's own charts, captured as PNGs by the download component
// (lib/chart-capture.ts). Every entry is optional and each render site keeps
// a vector fallback: the statutory export must never depend on
// rasterization succeeding.
export interface ReportChartImages {
  population?: CapturedChart
  quartiles?: CapturedChart
}

// A captured chart at its on-screen proportions: 1 CSS px = 0.75pt, so the
// type inside the raster prints at the size it holds on screen and sits
// consistently beside the page's own 8-9pt table type.
function CapturedChartImage({ chart }: { chart: CapturedChart }) {
  return (
    <PdfImage
      src={chart.src}
      style={{ width: chart.width * 0.75, height: chart.height * 0.75 }}
    />
  )
}

const s = StyleSheet.create({
  para: { marginBottom: 4, lineHeight: 1.4 },
  // Table rows follow the metodbilaga's flex-row pattern; lineHeight stays
  // off the page style (the fixed-footer landmine) and off table rows.
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#999",
    paddingVertical: 3,
  },
  label: { fontFamily: "Helvetica-Bold" },
  cellGroup: { flex: 2.4 },
  cellNum: { flex: 0.9, textAlign: "right", paddingLeft: 4 },
  // Wide enough for the "Women"/"Men" headers at font 9; narrower and the
  // three count headers fuse into one word.
  cellCount: { flex: 0.72, textAlign: "right", paddingLeft: 2 },
  cellMoney: { flex: 1.3, textAlign: "right", paddingLeft: 4 },
  cellSpread: { flex: 1.7, textAlign: "right", paddingLeft: 6 },
  cellStatus: { flex: 0.95, textAlign: "right", paddingLeft: 4 },
  tableText: { fontSize: 9 },
  // The median line under a mean cell: same figure family, visually
  // subordinate so the mean stays the row's first read.
  medianText: { fontSize: 8, color: "#555" },
  // The documentation block under a table row: the group's cited reasons and
  // note, indented so it reads as belonging to the row above.
  docBlock: {
    paddingLeft: 10,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  docText: { fontSize: 9, color: "#333", lineHeight: 1.4 },
  docLabel: { fontFamily: "Helvetica-Bold", color: "#111" },
  // Heading scale under the 16pt chapter title (branded-document): 12pt
  // subheadings, 10pt group headings, a clear step per level against the
  // 9-10pt body, with more space before a heading than after it.
  subHeading: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 6,
  },
  groupHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 2,
  },
  // A summary-table group heading row (the key-figures table's Lika arbete /
  // Likvärdigt arbete / Åtgärder bands): the app's rounded muted band, not a
  // bare rule.
  summaryBand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginTop: 14,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
  },
  // A chart with its key and caption: one breathing block.
  chartBlock: { marginTop: 12, marginBottom: 10 },
  // The population stat block: donut left, figures as stats beside it (the
  // app's population card anatomy).
  statRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  statCol: { flexDirection: "column", gap: 5 },
  statTotal: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  statLabel: { fontSize: 9, color: "#555" },
  statPricedRow: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    marginTop: 2,
  },
  statPricedValue: { fontSize: 9, color: "#111" },
  note: { fontSize: 9, color: "#555", marginTop: 4, lineHeight: 1.4 },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
    color: "#111",
  },
  fieldValue: { fontSize: 10, color: "#333", lineHeight: 1.4, marginBottom: 8 },
  contents: { marginTop: 28 },
  contentsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tocRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  // A fixed number column keeps the TOC titles left-aligned with each other.
  tocNumber: { fontSize: 11, color: BRAND, width: 18 },
  tocLabel: { fontSize: 11, flex: 1 },
  tocPage: { fontSize: 10, color: "#555" },
})

export type PayMappingReportLabels = {
  docTitle: string
  footer: string
  contentsTitle: string
  statusTag: string
  generatedOn: string
  referenceDateLine: string
  // The population stat block beside the donut: display strings, composed
  // by the export hook (counts and shares are figures, not sentences).
  populationTotal: string
  populationWomen: string
  populationMen: string
  populationPriced: string
  summaryTitle: string
  summaryEmployees: string
  summaryWomen: string
  summaryMen: string
  summaryPriced: string
  summaryWomenShareMean: string
  summaryWomenShareMedian: string
  // The variable-pay pair (the share receiving pay components beyond basic
  // salary, and women's amounts as a share of men's among receivers).
  summaryVariableShareWomen: string
  summaryVariableShareMen: string
  summaryVariableWomenShareMean: string
  summaryVariableWomenShareMedian: string
  summaryGroupsShown: string
  summaryGroupsRequired: string
  summaryGroupsDocumented: string
  summarySingletons: string
  summaryWdGroups: string
  summaryComparisons: string
  summaryComparisonsDocumented: string
  summaryActionsCount: string
  summaryCost: string
  introTitle: string
  introBody: string
  orgGapLine: string
  // Null suppresses the line (no median computable, or no previous run).
  orgMedianLine: string | null
  orgPreviousLine: string | null
  chartMeansCaption: string
  chartSpreadCaption: string
  chartQuartilesCaption: string
  quartilesTitle: string
  quartileRow: (index: number) => string
  spreadTitle: string
  colP10: string
  colQ1: string
  colMedian: string
  colQ3: string
  colP90: string
  colWomen: string
  colMen: string
  collaborationTitle: string
  participantsLabel: string
  descriptionLabel: string
  notDocumented: string
  praxisTitle: string
  praxisIntro: string
  praxisAreaTitle: (key: PraxisAreaKey) => string
  findingLabel: (finding: "none" | "found" | null) => string
  equalWorkTitle: string
  equalWorkIntro: string
  // The chapter's factual status line (counts of documented groups), or
  // null when the chapter has no groups.
  equalWorkStatusLine: string | null
  wdStatusLine: string | null
  colGroup: string
  colLevel: string
  colWomenMean: string
  colMenMean: string
  colGapPct: string
  colGapKr: string
  colStatus: string
  flagLabel: (flag: PayGapFlag) => string
  levelText: (level: number | null) => string
  levelRowLabel: (level: number | null) => string
  tccDrivenMarker: string
  tccLine: (metric: ReportMetricText) => string
  medianShort: string
  prevYearLine: (gapPct: string) => string
  reasonsLabel: string
  noteLabel: string
  reasonLabel: (reason: PayGapReason) => string
  undocumented: string
  emptyEqualWork: string
  reverseTitle: string
  genderPureTitle: string
  genderPureRow: (row: ReportGenderPureRow) => string
  equivalentTitle: string
  equivalentIntro: string
  levelsTitle: string
  // The per-level table is the one table whose figures are SIGNED (it runs
  // in both directions); this line states the sign convention.
  levelsSignNote: string
  womenDominatedTitle: string
  womenDominatedIntro: string
  wdGroupLine: (group: ReportWomenDominatedGroup) => string
  colComparator: string
  colHeadcount: string
  colWomenShare: string
  colMean: string
  colSpread: string
  colDiffPct: string
  colDiffKr: string
  noComparators: string
  emptyWomenDominated: string
  actionsTitle: string
  actionsIntro: string
  // The Lika arbete / Likvärdigt arbete band a grouped action table renders.
  actionScopeLabel: (scope: "equalWork" | "equivalentWork") => string
  colAction: string
  colOwner: string
  colDate: string
  colCost: string
  colPriority: string
  colActionStatus: string
  // The action target kind marker for non-group targets (individual,
  // comparison); a group target renders no marker.
  targetKindLabel: (kind: "person" | "comparison") => string
  statusLabel: (status: ActionStatus) => string
  priorityLabel: (priority: ActionPriority) => string
  actionTotalsLine: string
  noActions: string
  notesTitle: string
  noteTypeLabel: (type: NoteType) => string
  noNotes: string
  evaluationTitle: string
  evaluationIntro: string
  evaluationStatusNote: string
  noPreviousActions: string
  methodTitle: string
  methodBody: string
  criteriaTitle: string
  colCriterion: string
  colWeight: string
  colShare: string
  pointBudgetLine: string
  scopeNote: string
  individualNote: string
  statisticsNote: string
  coverageNote: string
  maskingNote: string
  measuresNote: string
  maskedCell: string
}

// A masked or absent figure renders the same dash; the method section's
// masking note explains which groups the export boundary masked.
function cell(value: string | null, labels: PayMappingReportLabels): string {
  return value ?? labels.maskedCell
}

// The multi-pass pagination hooks: rows report where they landed (pass N),
// and the download component answers with the rows that start a new page so
// their table's header re-renders above them (pass N+1).
export interface RowPaginationProps {
  onRowPage?: (id: string, page: number) => void
  headerBreaks?: ReadonlySet<string>
}

// A table cell text that reports its page for the continuation-header
// passes when a capture callback is wired, and renders as plain text
// otherwise. The render prop must be ABSENT (not undefined) on the plain
// path: react-pdf treats any node carrying the prop as dynamic and calls it.
function CapturedText({
  style,
  id,
  onRowPage,
  text,
}: {
  // View's style type, not Text's: the Text typing unions in the SVG text
  // variant's attributes, which the plain Text overload then rejects.
  style: ComponentProps<typeof View>["style"]
  id: string
  onRowPage?: (id: string, page: number) => void
  text: string
}) {
  if (!onRowPage) return <Text style={style}>{text}</Text>
  return (
    <Text
      style={style}
      render={({ pageNumber }) => {
        onRowPage(id, pageNumber)
        return text
      }}
    />
  )
}

function TocRow({
  number,
  label,
  page,
}: {
  number: string
  label: string
  page: number | undefined
}) {
  return (
    <View style={s.tocRow}>
      <Text style={s.tocNumber}>{number}</Text>
      <Text style={s.tocLabel}>{label}</Text>
      {page !== undefined && <Text style={s.tocPage}>{page}</Text>}
    </View>
  )
}

// The reasons + note block under a group or comparison row. Renders nothing
// when the row carries no documentation and needs none; a flagged row without
// documentation states that openly (a draft export must not look complete).
// Kept breakable (a long note may exceed a page, and a wrap={false} block
// taller than a page overlaps in react-pdf), but it never starts with less
// than a couple of lines of room.
function DocumentationBlock({
  reasons,
  note,
  required,
  labels,
}: {
  reasons: PayGapReason[]
  note: string | null
  required: boolean
  labels: PayMappingReportLabels
}) {
  const empty = reasons.length === 0 && note === null
  if (empty && !required) return null
  return (
    <View style={s.docBlock} minPresenceAhead={30}>
      {reasons.length > 0 && (
        <Text style={s.docText}>
          <Text style={s.docLabel}>{labels.reasonsLabel}: </Text>
          {reasons.map((reason) => labels.reasonLabel(reason)).join(", ")}
        </Text>
      )}
      {note !== null && (
        <Text style={s.docText}>
          <Text style={s.docLabel}>{labels.noteLabel}: </Text>
          {note}
        </Text>
      )}
      {empty && required && (
        <Text style={s.docText}>{labels.undocumented}</Text>
      )}
    </View>
  )
}

function GroupTableHeader({ labels }: { labels: PayMappingReportLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellGroup, s.label, s.tableText]}>{labels.colGroup}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colLevel}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colWomen}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colMen}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colWomenMean}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colMenMean}
      </Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colGapPct}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colGapKr}</Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>
        {labels.colStatus}
      </Text>
    </View>
  )
}

// A money-or-gap cell carrying the mean on its first line and the median
// beneath it (both measures, the professional standard). Median suppressed
// when masked or absent.
function MeanMedianCell({
  mean,
  median,
  style,
  labels,
}: {
  mean: string | null
  median: string | null
  style: ComponentProps<typeof View>["style"]
  labels: PayMappingReportLabels
}) {
  return (
    <View style={style}>
      <Text style={s.tableText}>{cell(mean, labels)}</Text>
      {median !== null && (
        <Text style={s.medianText}>
          {labels.medianShort} {median}
        </Text>
      )}
    </View>
  )
}

function GroupTableRow({
  row,
  labels,
  showLabel,
  documentationRequired,
  pageId,
  onRowPage,
  continuationHeader = false,
}: {
  row: ReportGroupRow
  labels: PayMappingReportLabels
  showLabel?: string
  documentationRequired: boolean
  pageId?: string
  onRowPage?: (id: string, page: number) => void
  // True when the pagination passes marked this row as starting a new page:
  // the re-rendered table header then joins the row's own unbreakable unit,
  // because a header rendered as a preceding sibling can be stranded at the
  // bottom of the page the row just left (minPresenceAhead is silently
  // ignored on a wrapper's first child).
  continuationHeader?: boolean
}) {
  const labelText = `${showLabel ?? row.label}${
    row.tccDriven ? ` ${labels.tccDrivenMarker}` : ""
  }`
  return (
    <View>
      {/* The figures row and its meta lines are ONE unbreakable unit: a
          page break must never split a group's numbers from each other. */}
      <View wrap={false}>
        {continuationHeader && <GroupTableHeader labels={labels} />}
        <View style={s.row}>
          <CapturedText
            style={[s.cellGroup, s.tableText]}
            id={pageId ?? ""}
            onRowPage={pageId ? onRowPage : undefined}
            text={labelText}
          />
          <Text style={[s.cellCount, s.tableText]}>
            {labels.levelText(row.level)}
          </Text>
          <Text style={[s.cellCount, s.tableText]}>{row.womenCount}</Text>
          <Text style={[s.cellCount, s.tableText]}>{row.menCount}</Text>
          <MeanMedianCell
            mean={row.base.womenMean}
            median={row.baseMedian.women}
            style={[s.cellMoney]}
            labels={labels}
          />
          <MeanMedianCell
            mean={row.base.menMean}
            median={row.baseMedian.men}
            style={[s.cellMoney]}
            labels={labels}
          />
          <MeanMedianCell
            mean={row.base.gapPct}
            median={row.baseMedian.gapPct}
            style={[s.cellNum]}
            labels={labels}
          />
          <Text style={[s.cellMoney, s.tableText]}>
            {cell(row.base.gapKr, labels)}
          </Text>
          <Text style={[s.cellStatus, s.tableText]}>
            {labels.flagLabel(row.flag)}
          </Text>
        </View>
        {/* A tccDriven group's flag comes from total compensation, so the
            figures that justify the status must be in the document, not only
            the base columns beside it. The previous mapping's gap rides in
            the same meta block (year-over-year figures, the
            published-document convention). Both suppressed when the row is
            masked. */}
        {!row.masked && (row.tccDriven || row.previousGapPct !== null) && (
          <View style={s.docBlock}>
            {row.tccDriven && (
              <Text style={s.docText}>{labels.tccLine(row.tcc)}</Text>
            )}
            {row.previousGapPct !== null && (
              <Text style={s.docText}>
                {labels.prevYearLine(row.previousGapPct)}
              </Text>
            )}
          </View>
        )}
      </View>
      <DocumentationBlock
        reasons={row.reasons}
        note={row.note}
        required={documentationRequired}
        labels={labels}
      />
    </View>
  )
}

// A group table with continuation headers: rows report their page, and rows
// the download component marked as page starts get the header re-rendered
// above them.
function GroupTable({
  tableId,
  rows,
  labels,
  requiresDocumentation,
  showLabelFor,
  onRowPage,
  headerBreaks,
}: {
  tableId: string
  rows: ReportGroupRow[]
  labels: PayMappingReportLabels
  requiresDocumentation: (row: ReportGroupRow) => boolean
  showLabelFor?: (row: ReportGroupRow) => string
  onRowPage?: (id: string, page: number) => void
  headerBreaks?: ReadonlySet<string>
}) {
  return (
    <View>
      <GroupTableHeader labels={labels} />
      {rows.map((row) => (
        <GroupTableRow
          key={row.key}
          row={row}
          labels={labels}
          showLabel={showLabelFor?.(row)}
          documentationRequired={requiresDocumentation(row)}
          pageId={`${tableId}:${row.key}`}
          onRowPage={onRowPage}
          continuationHeader={
            headerBreaks?.has(`${tableId}:${row.key}`) ?? false
          }
        />
      ))}
    </View>
  )
}

// One label + value line of the summary key-figures table.
function SummaryRow({
  label,
  value,
  labels,
  indent = false,
}: {
  label: string
  value: string | number | null
  labels: PayMappingReportLabels
  indent?: boolean
}) {
  return (
    <View style={s.row} wrap={false}>
      <Text
        style={[{ flex: 4 }, s.tableText, indent ? { paddingLeft: 10 } : {}]}
      >
        {label}
      </Text>
      <Text style={[s.cellMoney, s.tableText]}>
        {value === null ? labels.maskedCell : String(value)}
      </Text>
    </View>
  )
}

export function PayMappingReportPdf({
  doc,
  labels,
  pageRefs,
  onResolvePage,
  onRowPage,
  headerBreaks,
  chartImages,
}: {
  doc: PayMappingReportDoc
  labels: PayMappingReportLabels
  pageRefs?: Record<string, number>
  onResolvePage?: (id: string, page: number) => void
  // Captured app charts. Passed to EVERY pagination pass, not only the final
  // render: an image occupies a different height than the vector fallback,
  // so leaving it out of a pass would settle the layout for a document that
  // is not the one shipped.
  chartImages?: ReportChartImages
} & RowPaginationProps) {
  const resolve = (id: string) =>
    onResolvePage ? (page: number) => onResolvePage(id, page) : undefined
  // A flagged group is one the gate requires documentation for (ADR-0012);
  // the report states an empty documentation block on those instead of
  // hiding it.
  const requiresDocumentation = (row: ReportGroupRow) =>
    row.flag === "critical" || row.flag === "elevated"
  const summary = doc.summary
  // Chapter numbers, computed from the rendered order (the evaluation
  // chapter exists only with a previous run), shared by the TOC and every
  // section title so the two can never disagree.
  const sectionIds = [
    "summary",
    "introduction",
    "collaboration",
    "praxis",
    "equalWork",
    "equivalentWork",
    "actions",
    ...(doc.previousEvaluation !== null ? ["evaluation"] : []),
    "method",
  ]
  const num = (id: string) => String(sectionIds.indexOf(id) + 1)

  return (
    <BrandedDocument>
      <BrandedPage footerLeft={labels.footer}>
        <Cover
          docTitle={labels.docTitle}
          metaLines={[
            doc.runLabel,
            labels.referenceDateLine,
            labels.generatedOn,
          ]}
          statusTag={labels.statusTag}
        />
        <View style={s.contents}>
          <Text style={s.contentsTitle}>{labels.contentsTitle}</Text>
          <TocRow
            number={num("summary")}
            label={labels.summaryTitle}
            page={pageRefs?.summary}
          />
          <TocRow
            number={num("introduction")}
            label={labels.introTitle}
            page={pageRefs?.introduction}
          />
          <TocRow
            number={num("collaboration")}
            label={labels.collaborationTitle}
            page={pageRefs?.collaboration}
          />
          <TocRow
            number={num("praxis")}
            label={labels.praxisTitle}
            page={pageRefs?.praxis}
          />
          <TocRow
            number={num("equalWork")}
            label={labels.equalWorkTitle}
            page={pageRefs?.equalWork}
          />
          <TocRow
            number={num("equivalentWork")}
            label={labels.equivalentTitle}
            page={pageRefs?.equivalentWork}
          />
          <TocRow
            number={num("actions")}
            label={labels.actionsTitle}
            page={pageRefs?.actions}
          />
          {doc.previousEvaluation !== null && (
            <TocRow
              number={num("evaluation")}
              label={labels.evaluationTitle}
              page={pageRefs?.evaluation}
            />
          )}
          <TocRow
            number={num("method")}
            label={labels.methodTitle}
            page={pageRefs?.method}
          />
        </View>
      </BrandedPage>

      {/* The summary page: the key-figures table professional documents open
          with, entirely derived from figures the later sections carry. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.summaryTitle}
          number={num("summary")}
          onRenderPage={resolve("summary")}
        >
          <SummaryRow
            label={labels.summaryEmployees}
            value={doc.population.total}
            labels={labels}
          />
          <SummaryRow
            label={labels.summaryWomen}
            value={doc.population.women}
            labels={labels}
            indent
          />
          <SummaryRow
            label={labels.summaryMen}
            value={doc.population.men}
            labels={labels}
            indent
          />
          <SummaryRow
            label={labels.summaryPriced}
            value={doc.population.priced}
            labels={labels}
            indent
          />
          <SummaryRow
            label={labels.summaryWomenShareMean}
            value={summary.womenShareOfMenMeanPct}
            labels={labels}
          />
          <SummaryRow
            label={labels.summaryWomenShareMedian}
            value={summary.womenShareOfMenMedianPct}
            labels={labels}
          />
          <SummaryRow
            label={labels.summaryVariableShareWomen}
            value={summary.variableShareWomenPct}
            labels={labels}
          />
          <SummaryRow
            label={labels.summaryVariableShareMen}
            value={summary.variableShareMenPct}
            labels={labels}
          />
          <SummaryRow
            label={labels.summaryVariableWomenShareMean}
            value={summary.variableWomenShareOfMenMeanPct}
            labels={labels}
            indent
          />
          <SummaryRow
            label={labels.summaryVariableWomenShareMedian}
            value={summary.variableWomenShareOfMenMedianPct}
            labels={labels}
            indent
          />
          <Text style={s.summaryBand}>{labels.equalWorkTitle}</Text>
          <SummaryRow
            label={labels.summaryGroupsShown}
            value={summary.equalWorkGroups}
            labels={labels}
          />
          <SummaryRow
            label={labels.summaryGroupsRequired}
            value={summary.equalWorkRequired}
            labels={labels}
            indent
          />
          <SummaryRow
            label={labels.summaryGroupsDocumented}
            value={summary.equalWorkDocumented}
            labels={labels}
            indent
          />
          <SummaryRow
            label={labels.reverseTitle}
            value={doc.method.reverseCount}
            labels={labels}
          />
          <SummaryRow
            label={labels.genderPureTitle}
            value={doc.method.genderPureCount}
            labels={labels}
          />
          <SummaryRow
            label={labels.summarySingletons}
            value={doc.method.singletonCount}
            labels={labels}
          />
          <Text style={s.summaryBand}>{labels.equivalentTitle}</Text>
          <SummaryRow
            label={labels.summaryWdGroups}
            value={summary.womenDominatedGroups}
            labels={labels}
          />
          <SummaryRow
            label={labels.summaryComparisons}
            value={summary.comparisonCount}
            labels={labels}
            indent
          />
          <SummaryRow
            label={labels.summaryComparisonsDocumented}
            value={summary.comparisonsDocumented}
            labels={labels}
            indent
          />
          <Text style={s.summaryBand}>{labels.actionsTitle}</Text>
          <SummaryRow
            label={labels.summaryActionsCount}
            value={doc.actionTotals.count}
            labels={labels}
          />
          <SummaryRow
            label={labels.summaryCost}
            value={doc.actionTotals.cost}
            labels={labels}
            indent
          />
        </Section>
      </BrandedPage>

      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.introTitle}
          number={num("introduction")}
          onRenderPage={resolve("introduction")}
        >
          <Text style={s.para}>{labels.introBody}</Text>
          {/* The population as a stat block, the app's own anatomy: donut
              left, the figures as labeled stats beside it. The stats column
              always renders; only the donut is capture-dependent. */}
          <View wrap={false} style={[s.chartBlock, s.statRow]}>
            {chartImages?.population !== undefined && (
              <CapturedChartImage chart={chartImages.population} />
            )}
            <View style={s.statCol}>
              <Text style={s.statTotal}>{labels.populationTotal}</Text>
              <Text style={s.statLabel}>{labels.summaryEmployees}</Text>
              <PdfGenderKeyRow
                series="women"
                label={labels.colWomen}
                value={labels.populationWomen}
              />
              <PdfGenderKeyRow
                series="men"
                label={labels.colMen}
                value={labels.populationMen}
              />
              <View style={s.statPricedRow}>
                <Text style={s.statLabel}>{labels.summaryPriced}</Text>
                <Text style={s.statPricedValue}>{labels.populationPriced}</Text>
              </View>
            </View>
          </View>
          <Text style={s.para}>{labels.orgGapLine}</Text>
          {labels.orgMedianLine !== null && (
            <Text style={s.para}>{labels.orgMedianLine}</Text>
          )}
          {labels.orgPreviousLine !== null && (
            <Text style={s.para}>{labels.orgPreviousLine}</Text>
          )}
          {doc.chartData.means !== null &&
            doc.org.womenMean !== null &&
            doc.org.menMean !== null && (
              <View wrap={false} style={s.chartBlock}>
                {/* Each bar carries its own side label (the spread chart's
                    reading), which also names the series: no legend. */}
                <GenderBarsChart
                  width={CHART_WIDTH}
                  rows={[
                    {
                      series: "women",
                      label: labels.colWomen,
                      value: doc.chartData.means.women,
                      text: doc.org.womenMean,
                    },
                    {
                      series: "men",
                      label: labels.colMen,
                      value: doc.chartData.means.men,
                      text: doc.org.menMean,
                    },
                  ]}
                />
                <Text style={s.note}>{labels.chartMeansCaption}</Text>
              </View>
            )}
          <View wrap={false}>
            <Text style={s.subHeading}>{labels.spreadTitle}</Text>
            <View style={s.headerRow}>
              <Text style={[s.cellGroup, s.label, s.tableText]} />
              <Text style={[s.cellMoney, s.label, s.tableText]}>
                {labels.colP10}
              </Text>
              <Text style={[s.cellMoney, s.label, s.tableText]}>
                {labels.colQ1}
              </Text>
              <Text style={[s.cellMoney, s.label, s.tableText]}>
                {labels.colMedian}
              </Text>
              <Text style={[s.cellMoney, s.label, s.tableText]}>
                {labels.colQ3}
              </Text>
              <Text style={[s.cellMoney, s.label, s.tableText]}>
                {labels.colP90}
              </Text>
            </View>
            {(
              [
                { name: labels.colWomen, row: doc.spread.women },
                { name: labels.colMen, row: doc.spread.men },
              ] as const
            ).map((gender) => (
              <View key={gender.name} style={s.row}>
                <Text style={[s.cellGroup, s.tableText]}>{gender.name}</Text>
                <Text style={[s.cellMoney, s.tableText]}>
                  {cell(gender.row?.p10 ?? null, labels)}
                </Text>
                <Text style={[s.cellMoney, s.tableText]}>
                  {cell(gender.row?.q1 ?? null, labels)}
                </Text>
                <Text style={[s.cellMoney, s.tableText]}>
                  {cell(gender.row?.median ?? null, labels)}
                </Text>
                <Text style={[s.cellMoney, s.tableText]}>
                  {cell(gender.row?.q3 ?? null, labels)}
                </Text>
                <Text style={[s.cellMoney, s.tableText]}>
                  {cell(gender.row?.p90 ?? null, labels)}
                </Text>
              </View>
            ))}
          </View>
          {doc.chartData.spread.women !== null &&
            doc.chartData.spread.men !== null && (
              <View wrap={false} style={s.chartBlock}>
                <SpreadBandsChart
                  women={doc.chartData.spread.women}
                  men={doc.chartData.spread.men}
                  womenLabel={labels.colWomen}
                  menLabel={labels.colMen}
                  width={CHART_WIDTH}
                />
                <PdfGenderLegend
                  womenLabel={labels.colWomen}
                  menLabel={labels.colMen}
                />
                <Text style={s.note}>{labels.chartSpreadCaption}</Text>
              </View>
            )}
          {/* The quartile figure opens its own page: table plus the app's
              captured chart is a full-page object, and mid-page it always
              straddled the break. */}
          <View wrap={false} break>
            <Text style={s.subHeading}>{labels.quartilesTitle}</Text>
            <View style={s.headerRow}>
              <Text style={[s.cellGroup, s.label, s.tableText]} />
              <Text style={[s.cellNum, s.label, s.tableText]}>
                {labels.colWomen}
              </Text>
              <Text style={[s.cellNum, s.label, s.tableText]}>
                {labels.colMen}
              </Text>
            </View>
            {doc.quartiles.map((quartile, index) => (
              <View key={labels.quartileRow(index)} style={s.row}>
                <Text style={[s.cellGroup, s.tableText]}>
                  {labels.quartileRow(index)}
                </Text>
                <Text style={[s.cellNum, s.tableText]}>{quartile.women}</Text>
                <Text style={[s.cellNum, s.tableText]}>{quartile.men}</Text>
              </View>
            ))}
          </View>
          {chartImages?.quartiles !== undefined ? (
            <View wrap={false} style={s.chartBlock}>
              <CapturedChartImage chart={chartImages.quartiles} />
              <PdfGenderLegend
                womenLabel={labels.colWomen}
                menLabel={labels.colMen}
              />
              <Text style={s.note}>{labels.chartQuartilesCaption}</Text>
            </View>
          ) : (
            doc.quartiles.length > 0 && (
              <View wrap={false} style={s.chartBlock}>
                <PairedBarsChart
                  width={CHART_WIDTH}
                  rows={doc.quartiles.map((quartile, index) => ({
                    label: labels.quartileRow(index),
                    women: quartile.women,
                    men: quartile.men,
                    womenText: String(quartile.women),
                    menText: String(quartile.men),
                  }))}
                />
                <PdfGenderLegend
                  womenLabel={labels.colWomen}
                  menLabel={labels.colMen}
                />
                <Text style={s.note}>{labels.chartQuartilesCaption}</Text>
              </View>
            )
          )}
        </Section>
      </BrandedPage>

      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.collaborationTitle}
          number={num("collaboration")}
          onRenderPage={resolve("collaboration")}
        >
          {doc.collaboration === null ? (
            <Text style={s.para}>{labels.notDocumented}</Text>
          ) : (
            <View>
              <Text style={s.fieldLabel}>{labels.participantsLabel}</Text>
              <Text style={s.fieldValue}>{doc.collaboration.participants}</Text>
              <Text style={s.fieldLabel}>{labels.descriptionLabel}</Text>
              <Text style={s.fieldValue}>{doc.collaboration.description}</Text>
            </View>
          )}
        </Section>

        <Section
          title={labels.praxisTitle}
          number={num("praxis")}
          onRenderPage={resolve("praxis")}
        >
          <Text style={s.para}>{labels.praxisIntro}</Text>
          {doc.praxis.map((area) => (
            <View key={area.key} wrap={false}>
              <Text style={s.groupHeading}>
                {labels.praxisAreaTitle(area.key)}
              </Text>
              <Text style={s.para}>{labels.findingLabel(area.finding)}</Text>
              {area.note !== null && <Text style={s.note}>{area.note}</Text>}
            </View>
          ))}
        </Section>
      </BrandedPage>

      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equalWorkTitle}
          number={num("equalWork")}
          onRenderPage={resolve("equalWork")}
        >
          <Text style={s.para}>{labels.equalWorkIntro}</Text>
          {labels.equalWorkStatusLine !== null && (
            <Text style={s.para}>{labels.equalWorkStatusLine}</Text>
          )}
          {doc.equalWork.length === 0 ? (
            <Text style={s.para}>{labels.emptyEqualWork}</Text>
          ) : (
            <GroupTable
              tableId="equalWork"
              rows={doc.equalWork}
              labels={labels}
              requiresDocumentation={requiresDocumentation}
              onRowPage={onRowPage}
              headerBreaks={headerBreaks}
            />
          )}
          {/* Every analysed group is accounted for by identity, not only the
              primary flow (published documents list every group): women-ahead
              groups with their figures, single-gender groups by identity and
              count. Singletons stay a count in the method section
              (ADR-0015). */}
          {doc.reverseGroups.length > 0 && (
            // Its own page: a second full table squeezed under the main one
            // read as one wall, and its tail spilled anyway.
            <View break>
              <Text style={s.subHeading}>{labels.reverseTitle}</Text>
              <GroupTable
                tableId="reverse"
                rows={doc.reverseGroups}
                labels={labels}
                requiresDocumentation={() => false}
                onRowPage={onRowPage}
                headerBreaks={headerBreaks}
              />
            </View>
          )}
          {doc.genderPureGroups.length > 0 && (
            <View>
              <Text style={s.subHeading} minPresenceAhead={60}>
                {labels.genderPureTitle}
              </Text>
              {doc.genderPureGroups.map((row) => (
                <View key={row.key} style={s.row} wrap={false}>
                  <Text style={s.tableText}>{labels.genderPureRow(row)}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
      </BrandedPage>

      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equivalentTitle}
          number={num("equivalentWork")}
          onRenderPage={resolve("equivalentWork")}
        >
          <Text style={s.para}>{labels.equivalentIntro}</Text>
          {labels.wdStatusLine !== null && (
            <Text style={s.para}>{labels.wdStatusLine}</Text>
          )}
          <Text style={s.subHeading} minPresenceAhead={80}>
            {labels.levelsTitle}
          </Text>
          <GroupTable
            tableId="levels"
            rows={doc.equivalentWorkLevels}
            labels={labels}
            requiresDocumentation={() => false}
            showLabelFor={(row) => labels.levelRowLabel(row.level)}
            onRowPage={onRowPage}
            headerBreaks={headerBreaks}
          />
          <Text style={s.note}>{labels.levelsSignNote}</Text>
          {/* The chapter's main object (one table per women-dominated
              group) opens its own page, like the reverse and quartile
              blocks. */}
          <View break>
            <Text style={s.subHeading}>{labels.womenDominatedTitle}</Text>
            <Text style={s.para}>{labels.womenDominatedIntro}</Text>
          </View>
          {doc.womenDominated.length === 0 ? (
            <Text style={s.para}>{labels.emptyWomenDominated}</Text>
          ) : (
            doc.womenDominated.map((group) => {
              const [firstComparison, ...restComparisons] = group.comparisons
              // The heading travels ATOMICALLY with its first content (the
              // table header and first row, or the no-comparators line):
              // minPresenceAhead on the heading is not honored reliably at
              // this nesting depth (react-pdf ignores it on a wrapper's
              // first child), which left a heading orphaned at a page
              // bottom with its one-line body alone on the next page. The
              // atomic unit is only allowed while it is BOUNDED: when the
              // group carries its own documentation (an unbounded free-text
              // note), the wrapper turns breakable, because react-pdf draws
              // an oversized wrap={false} block off the page edge and the
              // overflow is silently lost. The header + first row pair
              // stays atomic on its own in that case.
              const groupDocumented =
                group.reasons.length > 0 || group.note !== null
              return (
                <View key={group.key}>
                  <View wrap={groupDocumented}>
                    <Text style={s.groupHeading}>
                      {labels.wdGroupLine(group)}
                    </Text>
                    {/* The group's own row discharges its documentation duty
                        through its COMPARISONS (each carries its own reasons,
                        analyses.ts), so its summary block is never "required":
                        a complete run may legitimately leave it empty. */}
                    <DocumentationBlock
                      reasons={group.reasons}
                      note={group.note}
                      required={false}
                      labels={labels}
                    />
                    {firstComparison === undefined ? (
                      <Text style={s.note}>{labels.noComparators}</Text>
                    ) : (
                      <View wrap={false}>
                        <ComparatorHeader labels={labels} />
                        <WdComparisonRow
                          rowId={`wd:${group.key}:${firstComparison.key}`}
                          comparison={firstComparison}
                          labels={labels}
                          onRowPage={onRowPage}
                        />
                      </View>
                    )}
                  </View>
                  {firstComparison !== undefined && (
                    <>
                      {/* Every comparator row is itself a difference the
                          law asks to be assessed (gap.ts: deliberately no
                          materiality threshold), so an unexplained one in
                          a draft export states that openly. */}
                      <DocumentationBlock
                        reasons={firstComparison.reasons}
                        note={firstComparison.note}
                        required={true}
                        labels={labels}
                      />
                      {restComparisons.map((comparison) => (
                        <View key={comparison.key}>
                          <WdComparisonRow
                            rowId={`wd:${group.key}:${comparison.key}`}
                            comparison={comparison}
                            labels={labels}
                            onRowPage={onRowPage}
                            continuationHeader={
                              headerBreaks?.has(
                                `wd:${group.key}:${comparison.key}`
                              ) ?? false
                            }
                          />
                          <DocumentationBlock
                            reasons={comparison.reasons}
                            note={comparison.note}
                            required={true}
                            labels={labels}
                          />
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )
            })
          )}
        </Section>
      </BrandedPage>

      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.actionsTitle}
          number={num("actions")}
          onRenderPage={resolve("actions")}
        >
          <Text style={s.para}>{labels.actionsIntro}</Text>
          {doc.actions.length === 0 ? (
            <Text style={s.para}>{labels.noActions}</Text>
          ) : (
            <View>
              <ActionsHeader labels={labels} />
              {doc.actions.map((action, index) => (
                <View key={action.id}>
                  {/* The Sysarb-style scope band: actions grouped by which
                      comparison they belong to. */}
                  {(index === 0 ||
                    doc.actions[index - 1]?.scope !== action.scope) && (
                    <Text style={s.summaryBand}>
                      {labels.actionScopeLabel(action.scope)}
                    </Text>
                  )}
                  {/* The continuation header shares the row's atomic unit
                      (a preceding sibling strands at the previous page's
                      bottom); the unit turns breakable past the free-text
                      bound, see BREAKABLE_ROW_TEXT_LENGTH. */}
                  <View
                    wrap={
                      action.problem.length + action.plannedAction.length >
                      BREAKABLE_ROW_TEXT_LENGTH
                    }
                  >
                    {headerBreaks?.has(`actions:${action.id}`) && (
                      <ActionsHeader labels={labels} />
                    )}
                    <View style={s.row}>
                      <View style={s.cellGroup}>
                        <CapturedText
                          style={s.tableText}
                          id={`actions:${action.id}`}
                          onRowPage={onRowPage}
                          text={action.label}
                        />
                        {/* An individual- or comparison-anchored measure says
                          so: the group label alone would hide that the plan
                          reaches individual level (DO: individually set pay
                          normally needs individual-level assessment). */}
                        {action.kind !== "group" && (
                          <Text style={s.medianText}>
                            {labels.targetKindLabel(action.kind)}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 3 }}>
                        <Text style={s.tableText}>{action.problem}</Text>
                        <Text style={[s.tableText, { color: "#555" }]}>
                          {action.plannedAction}
                        </Text>
                        {action.reason !== null && (
                          <Text style={[s.tableText, { color: "#555" }]}>
                            {labels.reasonsLabel}:{" "}
                            {labels.reasonLabel(action.reason)}
                          </Text>
                        )}
                      </View>
                      <Text style={[s.cellMoney, s.tableText]}>
                        {action.ownerName}
                      </Text>
                      <Text style={[s.cellMoney, s.tableText]}>
                        {action.plannedDate}
                      </Text>
                      <Text style={[s.cellMoney, s.tableText]}>
                        {cell(action.cost, labels)}
                      </Text>
                      <Text style={[s.cellNum, s.tableText]}>
                        {labels.priorityLabel(action.priority)}
                      </Text>
                      <Text style={[s.cellStatus, s.tableText]}>
                        {labels.statusLabel(action.status)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
          {doc.actionTotals.count > 0 && (
            <Text style={s.note}>{labels.actionTotalsLine}</Text>
          )}
          <Text style={s.subHeading} minPresenceAhead={60}>
            {labels.notesTitle}
          </Text>
          {doc.notes.length === 0 ? (
            <Text style={s.para}>{labels.noNotes}</Text>
          ) : (
            doc.notes.map((note) => (
              // Atomic only while bounded; see BREAKABLE_ROW_TEXT_LENGTH.
              <View
                key={note.id}
                style={s.row}
                wrap={note.text.length > BREAKABLE_ROW_TEXT_LENGTH}
              >
                <Text style={[s.cellGroup, s.tableText]}>{note.label}</Text>
                <Text style={[s.cellMoney, s.tableText]}>
                  {labels.noteTypeLabel(note.noteType)}
                </Text>
                <View style={{ flex: 3 }}>
                  <Text style={s.tableText}>{note.text}</Text>
                  <Text style={[s.tableText, { color: "#555" }]}>
                    {note.authorName}, {note.date}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Section>
      </BrandedPage>

      {doc.previousEvaluation !== null && (
        <BrandedPage footerLeft={labels.footer} runningHeader>
          <Section
            title={labels.evaluationTitle}
            number={num("evaluation")}
            onRenderPage={resolve("evaluation")}
          >
            <Text style={s.para}>{labels.evaluationIntro}</Text>
            <Text style={s.para}>
              {labels.findingLabel(doc.previousEvaluation.finding)}
            </Text>
            {doc.previousEvaluation.note !== null && (
              <Text style={s.para}>{doc.previousEvaluation.note}</Text>
            )}
            {doc.previousEvaluation.actions.length === 0 ? (
              <Text style={s.para}>{labels.noPreviousActions}</Text>
            ) : (
              <View>
                <PrevActionsHeader labels={labels} />
                {doc.previousEvaluation.actions.map((action) => (
                  // The continuation header shares the row's atomic unit;
                  // atomic only while bounded (BREAKABLE_ROW_TEXT_LENGTH).
                  <View
                    key={action.id}
                    wrap={
                      action.plannedAction.length > BREAKABLE_ROW_TEXT_LENGTH
                    }
                  >
                    {headerBreaks?.has(`prevActions:${action.id}`) && (
                      <PrevActionsHeader labels={labels} />
                    )}
                    <View style={s.row}>
                      <CapturedText
                        style={[s.cellGroup, s.tableText]}
                        id={`prevActions:${action.id}`}
                        onRowPage={onRowPage}
                        text={action.label}
                      />
                      <Text style={[{ flex: 3 }, s.tableText]}>
                        {action.plannedAction}
                      </Text>
                      <Text style={[s.cellMoney, s.tableText]}>
                        {action.plannedDate}
                      </Text>
                      <Text style={[s.cellMoney, s.tableText]}>
                        {cell(action.cost, labels)}
                      </Text>
                      <Text style={[s.cellStatus, s.tableText]}>
                        {labels.statusLabel(action.status)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <Text style={s.note}>{labels.evaluationStatusNote}</Text>
          </Section>
        </BrandedPage>
      )}

      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.methodTitle}
          number={num("method")}
          onRenderPage={resolve("method")}
        >
          <Text style={s.para}>{labels.methodBody}</Text>
          <View wrap={false}>
            <Text style={s.subHeading}>{labels.criteriaTitle}</Text>
            <View style={s.headerRow}>
              <Text style={[s.cellGroup, s.label, s.tableText]}>
                {labels.colCriterion}
              </Text>
              <Text style={[s.cellNum, s.label, s.tableText]}>
                {labels.colWeight}
              </Text>
              <Text style={[s.cellNum, s.label, s.tableText]}>
                {labels.colShare}
              </Text>
            </View>
            {doc.method.criteria.map((criterion) => (
              <View key={criterion.name} style={s.row}>
                <Text style={[s.cellGroup, s.tableText]}>{criterion.name}</Text>
                <Text style={[s.cellNum, s.tableText]}>
                  {criterion.weightPoints}
                </Text>
                <Text style={[s.cellNum, s.tableText]}>
                  {criterion.sharePct}
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.note}>{labels.pointBudgetLine}</Text>
          <Text style={s.note}>{labels.measuresNote}</Text>
          <Text style={s.note}>{labels.statisticsNote}</Text>
          <Text style={s.note}>{labels.individualNote}</Text>
          <Text style={s.note}>{labels.coverageNote}</Text>
          <Text style={s.note}>{labels.maskingNote}</Text>
          <Text style={s.note}>{labels.scopeNote}</Text>
        </Section>
      </BrandedPage>
    </BrandedDocument>
  )
}

function ComparatorHeader({ labels }: { labels: PayMappingReportLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellGroup, s.label, s.tableText]}>
        {labels.colComparator}
      </Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colLevel}</Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>
        {labels.colHeadcount}
      </Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>
        {labels.colWomenShare}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colMean}</Text>
      <Text style={[s.cellSpread, s.label, s.tableText]}>
        {labels.colSpread}
      </Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colDiffPct}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colDiffKr}
      </Text>
    </View>
  )
}

// One comparator row of a women-dominated group's table: the unbreakable
// figures line. Its documentation block renders separately (it stays
// breakable, a long note may exceed a page).
function WdComparisonRow({
  rowId,
  comparison,
  labels,
  onRowPage,
  continuationHeader = false,
}: {
  rowId: string
  comparison: ReportWomenDominatedGroup["comparisons"][number]
  labels: PayMappingReportLabels
  onRowPage?: (id: string, page: number) => void
  // The re-rendered table header joins the row's unbreakable unit; as a
  // preceding sibling it strands at the previous page's bottom, because
  // minPresenceAhead is silently ignored on a wrapper's first child.
  continuationHeader?: boolean
}) {
  return (
    <View wrap={false}>
      {continuationHeader && <ComparatorHeader labels={labels} />}
      <View style={s.row}>
        <CapturedText
          style={[s.cellGroup, s.tableText]}
          id={rowId}
          onRowPage={onRowPage}
          text={comparison.label}
        />
        <Text style={[s.cellCount, s.tableText]}>
          {labels.levelText(comparison.level)}
        </Text>
        <Text style={[s.cellNum, s.tableText]}>{comparison.headcount}</Text>
        <Text style={[s.cellNum, s.tableText]}>{comparison.womenSharePct}</Text>
        <Text style={[s.cellMoney, s.tableText]}>
          {cell(comparison.meanComp, labels)}
        </Text>
        <Text style={[s.cellSpread, s.tableText]}>
          {cell(comparison.spread, labels)}
        </Text>
        <Text style={[s.cellNum, s.tableText]}>
          {cell(comparison.diffPct, labels)}
        </Text>
        <Text style={[s.cellMoney, s.tableText]}>
          {cell(comparison.diffKr, labels)}
        </Text>
      </View>
    </View>
  )
}

function ActionsHeader({ labels }: { labels: PayMappingReportLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellGroup, s.label, s.tableText]}>{labels.colGroup}</Text>
      <Text style={[{ flex: 3 }, s.label, s.tableText]}>
        {labels.colAction}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colOwner}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colDate}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colCost}</Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>
        {labels.colPriority}
      </Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>
        {labels.colActionStatus}
      </Text>
    </View>
  )
}

function PrevActionsHeader({ labels }: { labels: PayMappingReportLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellGroup, s.label, s.tableText]}>{labels.colGroup}</Text>
      <Text style={[{ flex: 3 }, s.label, s.tableText]}>
        {labels.colAction}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colDate}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colCost}</Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>
        {labels.colActionStatus}
      </Text>
    </View>
  )
}
