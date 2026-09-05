import { Text, View } from "@react-pdf/renderer"
import { INK_SECONDARY } from "@/lib/pdf/palette"
import type { PayGapReason, PraxisAreaKey } from "@workspace/constants"
import {
  equalWorkGroupRequiresDocumentation,
  type PayGapFlag,
} from "@workspace/core"
import {
  BrandedDocument,
  BrandedPage,
  Section,
} from "@/components/pdf/branded-document"
import {
  IdentityCover,
  type IdentityLabels,
} from "@/components/pdf/identity-block"
import {
  BREAKABLE_ROW_TEXT_LENGTH,
  CapturedText,
  cellText,
  type RowPaginationProps,
  tableStyles as s,
  TocRow,
} from "@/components/pdf/pdf-table"
import type { AnalysisStatus } from "./analysis-status"
import {
  type ActionPriority,
  actionRef,
  type ActionStatus,
  type NoteType,
} from "./pay-mapping-gap-types"
import type {
  ReportGenderPureRow,
  ReportGroupRow,
  ReportLinkedAction,
  ReportMedianText,
  ReportMetricText,
  ReportPraxisRow,
  ReportWomenDominatedGroup,
} from "./pay-mapping-report-data"
import type { DetailAppendixDoc } from "./signing-report-data"

// The detail appendix (detaljbilaga, ADR-0030): the complete written
// documentation behind the signing report. Every comparison, group, amount,
// reason, action and the frozen method; nothing masked. Four chapters after
// the cover, each its own page. i18n-free like the rest of the kit.
//
// Page-break protection: a table ROW (figures + meta) is an unbreakable
// unit, and every table re-renders its own header at each page it continues
// onto. The continuation headers come from a MULTI-PASS render: each row
// reports the page it landed on through a render-prop capture (onRowPage),
// the export hook derives which rows start a new page (headerBreaks, from
// computeHeaderBreaks over detailAppendixTables) and re-renders until the
// layout is stable.

export const APPENDIX_SECTIONS = [
  "equalWork",
  "equivalentWork",
  "praxis",
  "method",
] as const

export type AppendixSectionId = (typeof APPENDIX_SECTIONS)[number]

// The subordinate face inside a cell: a secondary line under the cell's
// first read (the planned measure under the problem, a note's author line).
const mutedText = [s.tableText, { color: INK_SECONDARY }]
// The action tables' number column, shared by the header cell and the body
// cells: a header whose alignment drifts from the column below it reads as
// a different column.
const numberHeaderCell = [
  s.cellCount,
  s.label,
  s.tableText,
  { textAlign: "left" } as const,
]
const numberCell = [s.cellCount, s.tableText, { textAlign: "left" } as const]

export type DetailAppendixLabels = {
  footer: string
  identity: IdentityLabels
  classification: string
  contentsTitle: string
  equalWorkTitle: string
  equivalentTitle: string
  // How a comparison is selected, stated once at the top of the chapter: a
  // reader checking the calculations has to know the chain the rows enact
  // before the rows mean anything, and this document stands alone.
  equivalentChainLine: string
  praxisTitle: string
  methodTitle: string
  // The group table.
  colGroup: string
  colLevel: string
  colWomen: string
  colMen: string
  colTccWomen: string
  colTccMen: string
  colTccGapKr: string
  colTccGapPct: string
  colStatus: string
  medianLine: (median: ReportMedianText) => string
  baseLine: (base: ReportMetricText) => string
  flagLabel: (flag: PayGapFlag) => string
  statusLabel: (status: AnalysisStatus) => string
  baseDrivenMarker: string
  baseDrivenNote: string
  prevYearLine: (gapPct: string) => string
  reasonsLabel: string
  noteLabel: string
  actionsLabel: string
  reasonLabel: (reason: PayGapReason) => string
  linkedActionLine: (action: ReportLinkedAction) => string
  undocumented: string
  levelText: (level: number | null) => string
  emptyEqualWork: string
  reverseTitle: string
  genderPureTitle: string
  genderPureRow: (row: ReportGenderPureRow) => string
  // Equivalent work.
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
  // Practice, collaboration, actions, notes.
  praxisAreaTitle: (key: PraxisAreaKey) => string
  findingLabel: (finding: "none" | "found" | null) => string
  praxisActionLine: (action: NonNullable<ReportPraxisRow["action"]>) => string
  previousEvaluationTitle: string
  noPreviousActions: string
  collaborationTitle: string
  participantsLabel: string
  descriptionLabel: string
  collaborationDateLabel: string
  collaborationRemarksLabel: string
  notDocumented: string
  actionsTitle: string
  colNumber: string
  colTarget: string
  colProblem: string
  colReason: string
  colOwner: string
  colDate: string
  colCost: string
  colPriority: string
  colActionStatus: string
  targetKindLabel: (kind: "person" | "comparison" | "praxis") => string
  actionStatusLabel: (status: ActionStatus) => string
  priorityLabel: (priority: ActionPriority) => string
  erasedContent: string
  noActions: string
  notesTitle: string
  noteTypeLabel: (type: NoteType) => string
  noNotes: string
  // Method and calculation basis. The chapter opens with the two statutory
  // terms defined in full: this document stands alone, so a reader who never
  // opened the signing report still finds out what it compares.
  definitionsTitle: string
  defEqualWork: string
  defEquivalentWork: string
  criteriaTitle: string
  // The frozen documentation printed under each criterion's row.
  criterionPurpose: string
  criterionRelevance: string
  criterionWeightMotivation: string
  colCriterion: string
  colDimension: string
  colWeight: string
  colShare: string
  dimensionLabel: (key: string) => string
  pointBudgetLine: string
  dimensionSharesTitle: string
  levelRulesTitle: string
  colMinScore: string
  zoneRulesTitle: string
  zoneRuleLine: (rule: { zone: string; minStep: number }) => string
  workingConditionsLine: string
  scaleNote: string
  // How a difference is computed, including the two chapters' different
  // denominators: a party recomputing a printed percentage cannot otherwise
  // tell whether the document or their own arithmetic is wrong.
  differenceNote: string
  measuresNote: string
  thresholdsNote: string
  hourlyDefaultLine: string
  hourlyNote: string | null
  coverageNote: string
  unmaskedNote: string
  maskedCell: string
}

// The row-id lists every table reports through onRowPage, in document
// order, for computeHeaderBreaks.
// The criteria table's column header, drawn once at the top and again on
// every page the table continues onto. Without it a continuation page shows
// four unlabelled columns, two of which are a bare weight in POINTS and a
// bare share in PERCENT: the one pair in this model a reader must never
// confuse.
function CriteriaTableHeader({ labels }: { labels: DetailAppendixLabels }) {
  return (
    <View style={s.headerRow}>
      <Text style={[s.cellGroup, s.label, s.tableText]}>
        {labels.colCriterion}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colDimension}
      </Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colWeight}</Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colShare}</Text>
    </View>
  )
}

export function detailAppendixTables(doc: DetailAppendixDoc): string[][] {
  return [
    doc.equalWork.map((row) => `equalWork:${row.key}`),
    doc.reverseGroups.map((row) => `reverse:${row.key}`),
    ...doc.womenDominated.map((group) =>
      group.comparisons.map((comparison) => `wd:${group.key}:${comparison.key}`)
    ),
    doc.previousEvaluation?.actions.map(
      (action) => `prevActions:${action.id}`
    ) ?? [],
    doc.actions.map((action) => `actions:${action.id}`),
    doc.method.criteria.map((criterion) => `criteria:${criterion.name}`),
  ]
}

// The reasons, note and cited actions under a group or comparison row.
// Renders nothing when the row carries no documentation and needs none; a
// row with a duty and nothing on file states that openly. Breakable (a long
// note may exceed a page), but it never starts with less than a couple of
// lines of room.
function DocumentationBlock({
  reasons,
  note,
  actions,
  required,
  labels,
}: {
  reasons: PayGapReason[]
  note: string | null
  actions: ReportLinkedAction[]
  required: boolean
  labels: DetailAppendixLabels
}) {
  const empty = reasons.length === 0 && note === null && actions.length === 0
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
      {actions.length > 0 && (
        <Text style={s.docText}>
          <Text style={s.docLabel}>{labels.actionsLabel}: </Text>
          {actions.map((action) => labels.linkedActionLine(action)).join("; ")}
        </Text>
      )}
      {empty && required && (
        <Text style={s.docText}>{labels.undocumented}</Text>
      )}
    </View>
  )
}

function GroupTableHeader({ labels }: { labels: DetailAppendixLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellGroup, s.label, s.tableText]}>{labels.colGroup}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colLevel}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colWomen}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colMen}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colTccWomen}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colTccMen}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colTccGapKr}
      </Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>
        {labels.colTccGapPct}
      </Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>
        {labels.colStatus}
      </Text>
    </View>
  )
}

function GroupTableRow({
  row,
  labels,
  required,
  pageId,
  onRowPage,
  continuationHeader,
}: {
  row: ReportGroupRow
  labels: DetailAppendixLabels
  required: boolean
  pageId: string
  onRowPage?: (id: string, page: number) => void
  // The re-rendered table header joins the row's unbreakable unit: as a
  // preceding sibling it strands at the previous page's bottom, because
  // minPresenceAhead is silently ignored on a wrapper's first child.
  continuationHeader: boolean
}) {
  const dash = labels.maskedCell
  const labelText = `${row.label}${row.baseDriven ? ` ${labels.baseDrivenMarker}` : ""}`
  return (
    <View>
      {/* The figures row, its median line and its meta lines are ONE
          unbreakable unit: a page break must never split a group's numbers
          from each other. */}
      <View wrap={false}>
        {continuationHeader && <GroupTableHeader labels={labels} />}
        <View style={s.row}>
          <CapturedText
            style={[s.cellGroup, s.tableText]}
            id={pageId}
            onRowPage={onRowPage}
            text={labelText}
          />
          <Text style={[s.cellCount, s.tableText]}>
            {labels.levelText(row.level)}
          </Text>
          <Text style={[s.cellCount, s.tableText]}>{row.womenCount}</Text>
          <Text style={[s.cellCount, s.tableText]}>{row.menCount}</Text>
          <Text style={[s.cellMoney, s.tableText]}>
            {cellText(row.tcc.womenMean, dash)}
          </Text>
          <Text style={[s.cellMoney, s.tableText]}>
            {cellText(row.tcc.menMean, dash)}
          </Text>
          <Text style={[s.cellMoney, s.tableText]}>
            {cellText(row.tcc.gapKr, dash)}
          </Text>
          <Text style={[s.cellNum, s.tableText]}>
            {cellText(row.tcc.gapPct, dash)}
          </Text>
          <Text style={[s.cellStatus, s.tableText]}>
            {labels.flagLabel(row.flag)}
          </Text>
        </View>
        <View style={s.docBlock}>
          {/* Base salary rides under the row rather than in it: eleven
              columns do not fit an A4 portrait page at this size, and the
              base and total amounts ran into each other. Beside the
              medians, so the row's two secondary measures share one line. */}
          <View style={s.metricLines}>
            <Text style={[s.medianText, s.metricLine]}>
              {labels.baseLine(row.base)}
            </Text>
            <Text style={[s.medianText, s.metricLine]}>
              {labels.medianLine(row.tccMedian)}
            </Text>
          </View>
          <Text style={s.medianText}>{labels.statusLabel(row.status)}</Text>
          {row.previousGapPct !== null && (
            <Text style={s.medianText}>
              {labels.prevYearLine(row.previousGapPct)}
            </Text>
          )}
        </View>
      </View>
      <DocumentationBlock
        reasons={row.reasons}
        note={row.note}
        actions={row.actions}
        required={required}
        labels={labels}
      />
    </View>
  )
}

function GroupTable({
  tableId,
  rows,
  labels,
  requiresDocumentation,
  onRowPage,
  headerBreaks,
}: {
  tableId: string
  rows: ReportGroupRow[]
  labels: DetailAppendixLabels
  requiresDocumentation: (row: ReportGroupRow) => boolean
} & RowPaginationProps) {
  return (
    <View>
      <GroupTableHeader labels={labels} />
      {rows.map((row) => (
        <GroupTableRow
          key={row.key}
          row={row}
          labels={labels}
          required={requiresDocumentation(row)}
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

function ComparatorHeader({ labels }: { labels: DetailAppendixLabels }) {
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
      <Text style={[s.cellStatus, s.label, s.tableText]}>
        {labels.colStatus}
      </Text>
    </View>
  )
}

function ActionsHeader({ labels }: { labels: DetailAppendixLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={numberHeaderCell}>{labels.colNumber}</Text>
      <Text style={[s.cellGroup, s.label, s.tableText]}>
        {labels.colTarget}
      </Text>
      <Text style={[s.cellWide, s.label, s.tableText]}>
        {labels.colProblem}
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

function PrevActionsHeader({ labels }: { labels: DetailAppendixLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={numberHeaderCell}>{labels.colNumber}</Text>
      <Text style={[s.cellGroup, s.label, s.tableText]}>
        {labels.colTarget}
      </Text>
      <Text style={[s.cellWide, s.label, s.tableText]}>
        {labels.colProblem}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colDate}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colCost}</Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>
        {labels.colActionStatus}
      </Text>
    </View>
  )
}

// The free text one criterion draws, for the unbreakable-block bound. All
// three fields render inside the same block, so all three have to count: the
// backend caps each at 2,000 characters, and a criterion written to that
// length is exactly the case that used to fall off the page edge.
function criterionTextLength(criterion: {
  purpose: string | null
  whyRelevant: string | null
  weightMotivation: string | null
}): number {
  return (
    (criterion.purpose?.length ?? 0) +
    (criterion.whyRelevant?.length ?? 0) +
    (criterion.weightMotivation?.length ?? 0)
  )
}

export function DetailAppendixPdf({
  doc,
  labels,
  pageRefs,
  onResolvePage,
  onRowPage,
  headerBreaks,
}: {
  doc: DetailAppendixDoc
  labels: DetailAppendixLabels
  pageRefs?: Record<string, number>
  onResolvePage?: (id: AppendixSectionId, page: number) => void
} & RowPaginationProps) {
  const resolve = (id: AppendixSectionId) =>
    onResolvePage ? (page: number) => onResolvePage(id, page) : undefined
  const num = (id: AppendixSectionId) =>
    String(APPENDIX_SECTIONS.indexOf(id) + 1)
  const dash = labels.maskedCell
  // The gate's own predicate (ADR-0012), so the appendix's "not documented
  // yet" blocks and the signing report's required count can never drift; the
  // appendix states an empty documentation block instead of hiding it.
  const requiresDocumentation = (row: ReportGroupRow) =>
    equalWorkGroupRequiresDocumentation(row.flag)

  return (
    <BrandedDocument>
      {/* The cover: the document's name, the version being read and who may
          read it. */}
      <IdentityCover
        labels={labels.identity}
        classification={labels.classification}
      />

      {/* The contents, on the page after the cover. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <View style={s.contents}>
          <Text style={s.contentsTitle}>{labels.contentsTitle}</Text>
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
            number={num("praxis")}
            label={labels.praxisTitle}
            page={pageRefs?.praxis}
          />
          <TocRow
            number={num("method")}
            label={labels.methodTitle}
            page={pageRefs?.method}
          />
        </View>
      </BrandedPage>

      {/* 2. Equal work, in full. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equalWorkTitle}
          number={num("equalWork")}
          onRenderPage={resolve("equalWork")}
        >
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
          <Text style={s.note}>{labels.baseDrivenNote}</Text>
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

      {/* 3. Equivalent work, in full: one block per women-dominated group,
          one row per comparison. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equivalentTitle}
          number={num("equivalentWork")}
          onRenderPage={resolve("equivalentWork")}
        >
          <Text style={s.para}>{labels.equivalentChainLine}</Text>
          {doc.womenDominated.length === 0 ? (
            <Text style={s.para}>{labels.emptyWomenDominated}</Text>
          ) : (
            doc.womenDominated.map((group) => {
              const [firstComparison, ...restComparisons] = group.comparisons
              // The heading travels atomically with its first content while
              // the unit is BOUNDED; a documented group (unbounded note) turns
              // breakable, because react-pdf draws an oversized wrap={false}
              // block off the page edge and the overflow is silently lost.
              const groupDocumented =
                group.reasons.length > 0 ||
                group.note !== null ||
                group.actions.length > 0
              const comparisonRow = (
                comparison: ReportWomenDominatedGroup["comparisons"][number],
                continuationHeader: boolean
              ) => (
                <View wrap={false}>
                  {continuationHeader && <ComparatorHeader labels={labels} />}
                  <View style={s.row}>
                    <CapturedText
                      style={[s.cellGroup, s.tableText]}
                      id={`wd:${group.key}:${comparison.key}`}
                      onRowPage={onRowPage}
                      text={comparison.label}
                    />
                    <Text style={[s.cellCount, s.tableText]}>
                      {labels.levelText(comparison.level)}
                    </Text>
                    <Text style={[s.cellNum, s.tableText]}>
                      {comparison.headcount}
                    </Text>
                    <Text style={[s.cellNum, s.tableText]}>
                      {comparison.womenSharePct}
                    </Text>
                    <Text style={[s.cellMoney, s.tableText]}>
                      {cellText(comparison.meanComp, dash)}
                    </Text>
                    <Text style={[s.cellSpread, s.tableText]}>
                      {cellText(comparison.spread, dash)}
                    </Text>
                    <Text style={[s.cellNum, s.tableText]}>
                      {cellText(comparison.diffPct, dash)}
                    </Text>
                    <Text style={[s.cellMoney, s.tableText]}>
                      {cellText(comparison.diffKr, dash)}
                    </Text>
                    <Text style={[s.cellStatus, s.tableText]}>
                      {labels.statusLabel(comparison.status)}
                    </Text>
                  </View>
                </View>
              )
              return (
                <View key={group.key}>
                  <View wrap={groupDocumented}>
                    <Text style={s.groupHeading}>
                      {labels.wdGroupLine(group)}
                    </Text>
                    <DocumentationBlock
                      reasons={group.reasons}
                      note={group.note}
                      actions={group.actions}
                      required={false}
                      labels={labels}
                    />
                    {firstComparison === undefined ? (
                      <Text style={s.note}>{labels.noComparators}</Text>
                    ) : (
                      <View wrap={false}>
                        <ComparatorHeader labels={labels} />
                        {comparisonRow(firstComparison, false)}
                      </View>
                    )}
                  </View>
                  {firstComparison !== undefined && (
                    <>
                      <DocumentationBlock
                        reasons={firstComparison.reasons}
                        note={firstComparison.note}
                        actions={firstComparison.actions}
                        required={true}
                        labels={labels}
                      />
                      {restComparisons.map((comparison) => (
                        <View key={comparison.key}>
                          {comparisonRow(
                            comparison,
                            headerBreaks?.has(
                              `wd:${group.key}:${comparison.key}`
                            ) ?? false
                          )}
                          <DocumentationBlock
                            reasons={comparison.reasons}
                            note={comparison.note}
                            actions={comparison.actions}
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

      {/* 4. Practice, collaboration remarks and actions. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.praxisTitle}
          number={num("praxis")}
          onRenderPage={resolve("praxis")}
        >
          {doc.praxis.map((area) => (
            // An area travels atomically while the free text it DRAWS is
            // bounded; past the bound it gives up unbreakability, because
            // react-pdf draws an oversized wrap={false} block off the page
            // edge and the overflow is silently lost. The action's planned
            // measure counts toward the bound because it renders inside this
            // same block: bounding the note alone read "short, stay atomic"
            // while the block carried an unbounded action.
            <View
              key={area.key}
              wrap={
                (area.note?.length ?? 0) +
                  (area.action?.plannedAction.length ?? 0) >
                BREAKABLE_ROW_TEXT_LENGTH
              }
            >
              <Text style={s.groupHeading}>
                {labels.praxisAreaTitle(area.key)}
              </Text>
              <Text style={s.para}>{labels.findingLabel(area.finding)}</Text>
              {area.note !== null && <Text style={s.note}>{area.note}</Text>}
              {area.action !== null && (
                <Text style={s.note}>
                  {labels.praxisActionLine(area.action)}
                </Text>
              )}
            </View>
          ))}
          {doc.previousEvaluation !== null && (
            <View>
              <Text style={s.groupHeading} minPresenceAhead={60}>
                {labels.previousEvaluationTitle}
              </Text>
              <Text style={s.para}>
                {labels.findingLabel(doc.previousEvaluation.finding)}
              </Text>
              {doc.previousEvaluation.note !== null && (
                <Text style={s.note}>{doc.previousEvaluation.note}</Text>
              )}
              {doc.previousEvaluation.actions.length === 0 ? (
                <Text style={s.note}>{labels.noPreviousActions}</Text>
              ) : (
                <View>
                  <PrevActionsHeader labels={labels} />
                  {doc.previousEvaluation.actions.map((action) => (
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
                          style={numberCell}
                          id={`prevActions:${action.id}`}
                          onRowPage={onRowPage}
                          text={actionRef(action.number)}
                        />
                        <Text style={[s.cellGroup, s.tableText]}>
                          {action.label}
                        </Text>
                        <Text style={[s.cellWide, s.tableText]}>
                          {action.erased
                            ? labels.erasedContent
                            : action.plannedAction}
                        </Text>
                        <Text style={[s.cellMoney, s.tableText]}>
                          {action.plannedDate}
                        </Text>
                        <Text style={[s.cellMoney, s.tableText]}>
                          {cellText(action.cost, dash)}
                        </Text>
                        <Text style={[s.cellStatus, s.tableText]}>
                          {labels.actionStatusLabel(action.status)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <Text style={s.subHeading} minPresenceAhead={60}>
            {labels.collaborationTitle}
          </Text>
          {doc.collaboration === null ? (
            <Text style={s.para}>{labels.notDocumented}</Text>
          ) : (
            <View>
              <Text style={s.fieldLabel}>{labels.participantsLabel}</Text>
              <Text style={s.fieldValue}>{doc.collaboration.participants}</Text>
              <Text style={s.fieldLabel}>{labels.descriptionLabel}</Text>
              <Text style={s.fieldValue}>{doc.collaboration.description}</Text>
              <Text style={s.fieldLabel}>{labels.collaborationDateLabel}</Text>
              <Text style={s.fieldValue}>
                {cellText(doc.collaboration.date, dash)}
              </Text>
              {/* The samverkanssynpunkter this chapter is titled for. */}
              <Text style={s.fieldLabel}>
                {labels.collaborationRemarksLabel}
              </Text>
              <Text style={s.fieldValue}>
                {cellText(doc.collaboration.remarks, dash)}
              </Text>
            </View>
          )}

          <Text style={s.subHeading} minPresenceAhead={60}>
            {labels.actionsTitle}
          </Text>
          {doc.actions.length === 0 ? (
            <Text style={s.para}>{labels.noActions}</Text>
          ) : (
            <View>
              <ActionsHeader labels={labels} />
              {doc.actions.map((action) => (
                <View
                  key={action.id}
                  wrap={
                    action.problem.length + action.plannedAction.length >
                    BREAKABLE_ROW_TEXT_LENGTH
                  }
                >
                  {headerBreaks?.has(`actions:${action.id}`) && (
                    <ActionsHeader labels={labels} />
                  )}
                  <View style={s.row}>
                    <CapturedText
                      style={numberCell}
                      id={`actions:${action.id}`}
                      onRowPage={onRowPage}
                      text={actionRef(action.number)}
                    />
                    <View style={s.cellGroup}>
                      <Text style={s.tableText}>{action.label}</Text>
                      {action.kind !== "group" && (
                        <Text style={s.medianText}>
                          {labels.targetKindLabel(action.kind)}
                        </Text>
                      )}
                    </View>
                    <View style={s.cellWide}>
                      {action.erased ? (
                        <Text style={mutedText}>{labels.erasedContent}</Text>
                      ) : (
                        <>
                          <Text style={s.tableText}>{action.problem}</Text>
                          <Text style={mutedText}>{action.plannedAction}</Text>
                        </>
                      )}
                      {action.reason !== null && (
                        <Text style={mutedText}>
                          {labels.colReason}:{" "}
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
                      {cellText(action.cost, dash)}
                    </Text>
                    <Text style={[s.cellNum, s.tableText]}>
                      {labels.priorityLabel(action.priority)}
                    </Text>
                    <Text style={[s.cellStatus, s.tableText]}>
                      {labels.actionStatusLabel(action.status)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={s.subHeading} minPresenceAhead={60}>
            {labels.notesTitle}
          </Text>
          {doc.notes.length === 0 ? (
            <Text style={s.para}>{labels.noNotes}</Text>
          ) : (
            doc.notes.map((note) => (
              <View
                key={note.id}
                style={s.row}
                wrap={note.text.length > BREAKABLE_ROW_TEXT_LENGTH}
              >
                <Text style={[s.cellGroup, s.tableText]}>{note.label}</Text>
                {/* The note's kind rides the meta line rather than a column of
                    its own: as a cell it wraps into the text beside it, and
                    the label is a sentence fragment, not a figure. */}
                <View style={s.cellWide}>
                  <Text style={s.tableText}>
                    {note.erased ? labels.erasedContent : note.text}
                  </Text>
                  <Text style={mutedText}>
                    {labels.noteTypeLabel(note.noteType)} · {note.authorName} ·{" "}
                    {note.date}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Section>
      </BrandedPage>

      {/* 5. Method and calculation basis. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.methodTitle}
          number={num("method")}
          onRenderPage={resolve("method")}
        >
          <View wrap={false}>
            <Text style={s.subHeading}>{labels.definitionsTitle}</Text>
            <Text style={s.note}>{labels.defEqualWork}</Text>
            <Text style={s.note}>{labels.defEquivalentWork}</Text>
          </View>
          {/* The criteria block wraps: a documented model prints three
              sub-lines under every row, which no single page holds. Each
              criterion keeps its own row and sub-lines together instead. */}
          <View>
            <Text style={s.subHeading}>{labels.criteriaTitle}</Text>
            <CriteriaTableHeader labels={labels} />
            {doc.method.criteria.map((criterion) => (
              // A criterion travels atomically while its documentation is
              // BOUNDED, and gives up unbreakability once the three free-text
              // fields together pass the bound: react-pdf draws an oversized
              // wrap={false} block off the page edge and the overflow is
              // silently lost, with no error and a page count that FALLS as
              // content grows. This was the one unbreakable block in the kit
              // without a bound, and each of its three fields is capped at
              // 2,000 characters by the backend, so a criterion written to
              // the length the product itself allows lost text.
              <View
                key={criterion.name}
                wrap={
                  criterionTextLength(criterion) > BREAKABLE_ROW_TEXT_LENGTH
                }
              >
                {headerBreaks?.has(`criteria:${criterion.name}`) && (
                  <CriteriaTableHeader labels={labels} />
                )}
                <View style={s.rowOpen}>
                  <CapturedText
                    style={[s.cellGroup, s.tableText]}
                    id={`criteria:${criterion.name}`}
                    onRowPage={onRowPage}
                    text={criterion.name}
                  />
                  <Text style={[s.cellMoney, s.tableText]}>
                    {criterion.dimensionKey === null
                      ? dash
                      : labels.dimensionLabel(criterion.dimensionKey)}
                  </Text>
                  <Text style={[s.cellNum, s.tableText]}>
                    {criterion.weightPoints}
                  </Text>
                  <Text style={[s.cellNum, s.tableText]}>
                    {criterion.sharePct}
                  </Text>
                </View>
                {(criterion.purpose !== null ||
                  criterion.whyRelevant !== null ||
                  criterion.weightMotivation !== null) && (
                  <View style={s.docBlock}>
                    {criterion.purpose !== null && (
                      <Text style={s.docText}>
                        <Text style={s.docLabel}>
                          {labels.criterionPurpose}:{" "}
                        </Text>
                        {criterion.purpose}
                      </Text>
                    )}
                    {criterion.whyRelevant !== null && (
                      <Text style={s.docText}>
                        <Text style={s.docLabel}>
                          {labels.criterionRelevance}:{" "}
                        </Text>
                        {criterion.whyRelevant}
                      </Text>
                    )}
                    {criterion.weightMotivation !== null && (
                      <Text style={s.docText}>
                        <Text style={s.docLabel}>
                          {labels.criterionWeightMotivation}:{" "}
                        </Text>
                        {criterion.weightMotivation}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
            <Text style={s.note}>{labels.pointBudgetLine}</Text>
          </View>
          {doc.method.dimensionShares.length > 0 && (
            <View wrap={false}>
              <Text style={s.subHeading}>{labels.dimensionSharesTitle}</Text>
              {doc.method.dimensionShares.map((share) => (
                <View key={share.dimensionKey} style={s.row}>
                  <Text style={[s.cellGroup, s.tableText]}>
                    {labels.dimensionLabel(share.dimensionKey)}
                  </Text>
                  <Text style={[s.cellNum, s.tableText]}>{share.sharePct}</Text>
                </View>
              ))}
            </View>
          )}
          {doc.method.levelRules.length > 0 && (
            <View wrap={false}>
              <Text style={s.subHeading}>{labels.levelRulesTitle}</Text>
              <View style={s.headerRow}>
                <Text style={[s.cellGroup, s.label, s.tableText]}>
                  {labels.colLevel}
                </Text>
                <Text style={[s.cellNum, s.label, s.tableText]}>
                  {labels.colMinScore}
                </Text>
              </View>
              {doc.method.levelRules.map((rule) => (
                <View key={rule.level} style={s.row}>
                  <Text style={[s.cellGroup, s.tableText]}>{rule.level}</Text>
                  <Text style={[s.cellNum, s.tableText]}>{rule.minScore}</Text>
                </View>
              ))}
            </View>
          )}
          {doc.method.zoneProfileRules.length > 0 && (
            <View wrap={false}>
              <Text style={s.subHeading}>{labels.zoneRulesTitle}</Text>
              {doc.method.zoneProfileRules.map((rule) => (
                <Text key={rule.zone} style={s.note}>
                  {labels.zoneRuleLine(rule)}
                </Text>
              ))}
            </View>
          )}
          <Text style={s.note}>{labels.workingConditionsLine}</Text>
          <Text style={s.note}>{labels.scaleNote}</Text>
          <Text style={s.note}>{labels.differenceNote}</Text>
          <Text style={s.note}>{labels.measuresNote}</Text>
          <Text style={s.note}>{labels.thresholdsNote}</Text>
          <Text style={s.note}>{labels.hourlyDefaultLine}</Text>
          {labels.hourlyNote !== null && (
            <Text style={s.note}>{labels.hourlyNote}</Text>
          )}
          <Text style={s.note}>{labels.coverageNote}</Text>
          <Text style={s.note}>{labels.unmaskedNote}</Text>
        </Section>
      </BrandedPage>
    </BrandedDocument>
  )
}
