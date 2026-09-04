import { Text, View } from "@react-pdf/renderer"
import {
  BrandedDocument,
  BrandedPage,
  Section,
} from "@/components/pdf/branded-document"
import {
  IdentityBlock,
  type IdentityLabels,
} from "@/components/pdf/identity-block"
import {
  cellText,
  type PdfStyle,
  tableStyles as s,
} from "@/components/pdf/pdf-table"
import {
  SignatureBlock,
  type SignatureLabels,
} from "@/components/pdf/signature-block"
import { PairedBarsChart, PdfGenderLegend } from "./pay-mapping-report-charts"
import type { SigningReportDoc } from "./signing-report-data"

// The signing report (signeringsrapport, ADR-0030): six to eight pages
// shared with the employer and the union parties for samverkan and signing.
// Aggregates, counts, statuses, conclusions and the action plan; never a
// group name or a group amount (the projection's type cannot carry one).
// Every section is its own page. i18n-free like the rest of the kit: every
// string arrives resolved through `labels`, most of them already composed
// into the rows the tables print, so this file is layout only.

// A4 content width (595pt minus the page's 48pt horizontal padding).
const CHART_WIDTH = 480

export const SIGNING_SECTIONS = [
  "formalities",
  "summary",
  "scope",
  "praxis",
  "equalWork",
  "equivalentWork",
  "actionPlan",
  "method",
] as const

export type SigningSectionId = (typeof SIGNING_SECTIONS)[number]

// One style per table column, shared by the column's header cell and its
// body cells: a header whose padding or alignment drifts from the column
// below it fuses into the neighbouring header at the column boundary.
const rowLabelCell = [{ flex: 4 }, s.tableText]
const scopeValueCell = [s.cellWide, s.tableText, { paddingLeft: 6 }]
const praxisAreaCell = [s.cellGroup, s.tableText]
const praxisConclusionCell = [
  s.cellMoney,
  s.tableText,
  { textAlign: "left", paddingLeft: 6 } as const,
]
const praxisFollowUpCell = [s.cellWide, s.tableText, { paddingLeft: 6 }]
const actionAreaCell = [
  s.cellMoney,
  s.tableText,
  { textAlign: "left" } as const,
]
// Seven columns share the row, so the observation gives up a step of its
// width (2.4 -> 2) to the responsible-function column rather than squeezing
// the figure columns, whose headers already touch at their boundaries.
const actionObservationCell = [{ flex: 2 }, s.tableText, { paddingLeft: 6 }]
const actionCountCell = [s.cellNum, s.tableText]
const actionStatusCell = [s.cellSpread, s.tableText]
// A left-aligned text column: the value is a function name, not a figure.
const actionResponsibleCell = [{ flex: 1.6 }, s.tableText, { paddingLeft: 6 }]
// The cost header is the table's longest word pair in every locale, so the
// column takes the wide figure width and the short date column the narrow
// one; the other way round the two headers touch.
const actionCostCell = [s.cellSpread, s.tableText]
const actionDatesCell = [s.cellMoney, s.tableText]
// The narrow right-aligned figure column: the default value column of a
// label/value table.
const moneyCell = [s.cellMoney, s.tableText]

// The bold label face on top of a column's own style, derived from the
// column so a header can never drift from the cells under it.
function bolded<T>(cell: readonly T[]): (T | (typeof s)["label"])[] {
  return [...cell, s.label]
}

type LabeledRow = { label: string; value: string }

export type SigningReportLabels = {
  footer: string
  identity: IdentityLabels
  // 1. Formalities and signing.
  formalitiesTitle: string
  collaborationDateLine: string
  participantsLabel: string
  descriptionLabel: string
  notDocumented: string
  appendixReference: string
  signature: SignatureLabels & { employer: string; union: string }
  // 2. Summary and result picture: four boxes, the quartile chart, the
  // closing sentences.
  summaryTitle: string
  boxes: { title: string; rows: LabeledRow[] }[]
  quartilesTitle: string
  quartileRow: (index: number) => string
  colWomen: string
  colMen: string
  chartQuartilesCaption: string
  closingSentences: string[]
  // 3. Scope, method and confidentiality.
  scopeTitle: string
  scopeRows: LabeledRow[]
  confidentialityNote: string
  // 4. Provisions, practice and collaboration.
  praxisTitle: string
  colArea: string
  colConclusion: string
  colFollowUp: string
  praxisRows: { area: string; conclusion: string; followUp: string }[]
  // 5. Equal work.
  equalWorkTitle: string
  equalWorkRows: LabeledRow[]
  equalWorkConclusion: string
  // 6. Equivalent work.
  equivalentTitle: string
  chainLine: string
  equivalentRows: LabeledRow[]
  // 7. Action plan and follow-up.
  actionPlanTitle: string
  colObservation: string
  colActions: string
  colStatusSplit: string
  colResponsible: string
  colCost: string
  colDates: string
  actionPlanRows: {
    area: string
    observation: string
    actions: string
    statusSplit: string
    // The area's responsible FUNCTION, a templated label: this document
    // never prints a person's name.
    responsible: string
    // Null when the area has no cost estimate: the component prints
    // `maskedCell`, so the dash has one source.
    cost: string | null
    dates: string
  }[]
  noActions: string
  // 8. Method note and the pre-signing checklist.
  methodTitle: string
  methodLines: string[]
  checklistTitle: string
  checklistRows: { label: string; done: boolean }[]
  checklistDone: string
  checklistOpen: string
  maskedCell: string
}

// A label/value table. The value column defaults to the narrow right-aligned
// money cell (the counted rows); a sentence-length value passes a wide
// left-aligned style instead so it does not wrap into two ragged lines.
function LabeledRows({
  rows,
  valueStyle = moneyCell,
}: {
  rows: LabeledRow[]
  valueStyle?: PdfStyle
}) {
  return (
    <View>
      {rows.map((row) => (
        <View key={row.label} style={s.row} wrap={false}>
          <Text style={rowLabelCell}>{row.label}</Text>
          <Text style={valueStyle}>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}

export function SigningReportPdf({
  doc,
  labels,
  onResolvePage,
}: {
  doc: SigningReportDoc
  labels: SigningReportLabels
  onResolvePage?: (id: SigningSectionId, page: number) => void
}) {
  const resolve = (id: SigningSectionId) =>
    onResolvePage ? (page: number) => onResolvePage(id, page) : undefined
  const num = (id: SigningSectionId) => String(SIGNING_SECTIONS.indexOf(id) + 1)

  return (
    <BrandedDocument>
      {/* 1. Formalities and signing: the identity block, the samverkan
          record and the signature lines, on the cover page itself. */}
      <BrandedPage footerLeft={labels.footer}>
        <IdentityBlock labels={labels.identity} />
        <Section
          title={labels.formalitiesTitle}
          number={num("formalities")}
          onRenderPage={resolve("formalities")}
        >
          <Text style={s.para}>{labels.collaborationDateLine}</Text>
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
          <Text style={s.note}>{labels.appendixReference}</Text>
          <SignatureBlock
            columns={[labels.signature.employer, labels.signature.union]}
            labels={labels.signature}
          />
        </Section>
      </BrandedPage>

      {/* 2. Summary and result picture. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.summaryTitle}
          number={num("summary")}
          onRenderPage={resolve("summary")}
        >
          <View style={s.boxGrid}>
            {labels.boxes.map((box) => (
              <View key={box.title} style={s.box} wrap={false}>
                <Text style={s.boxTitle}>{box.title}</Text>
                {box.rows.map((row) => (
                  <View key={row.label} style={s.boxRow}>
                    <Text style={[s.tableText, { flex: 3 }]}>{row.label}</Text>
                    {/* The box is 48% of the page, so its value column is
                        the wide one: a short phrase ("100% women") wraps in
                        the narrow count cell, and every locale runs longer
                        than English here. */}
                    <Text style={[s.tableText, s.cellSpread]}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          {doc.quartiles.length > 0 && (
            <View wrap={false} style={s.chartBlock}>
              <Text style={s.subHeading}>{labels.quartilesTitle}</Text>
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
          )}
          {labels.closingSentences.map((sentence) => (
            <Text key={sentence} style={s.para}>
              {sentence}
            </Text>
          ))}
        </Section>
      </BrandedPage>

      {/* 3. Scope, method and confidentiality. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.scopeTitle}
          number={num("scope")}
          onRenderPage={resolve("scope")}
        >
          {/* Scope values are sentences ("13 people (7 women, 6 men), 13
              with pay"), not figures, so they take the wide left column. */}
          <LabeledRows rows={labels.scopeRows} valueStyle={scopeValueCell} />
          <Text style={s.note}>{labels.confidentialityNote}</Text>
        </Section>
      </BrandedPage>

      {/* 4. Provisions, practice and collaboration. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.praxisTitle}
          number={num("praxis")}
          onRenderPage={resolve("praxis")}
        >
          <View style={s.headerRow}>
            <Text style={bolded(praxisAreaCell)}>{labels.colArea}</Text>
            <Text style={bolded(praxisConclusionCell)}>
              {labels.colConclusion}
            </Text>
            <Text style={bolded(praxisFollowUpCell)}>{labels.colFollowUp}</Text>
          </View>
          {labels.praxisRows.map((row) => (
            <View key={row.area} style={s.row} wrap={false}>
              <Text style={praxisAreaCell}>{row.area}</Text>
              <Text style={praxisConclusionCell}>{row.conclusion}</Text>
              <Text style={praxisFollowUpCell}>{row.followUp}</Text>
            </View>
          ))}
        </Section>
      </BrandedPage>

      {/* 5. Equal work: the measures table and the conclusion box. No
          group names, no amounts. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equalWorkTitle}
          number={num("equalWork")}
          onRenderPage={resolve("equalWork")}
        >
          <LabeledRows rows={labels.equalWorkRows} />
          <View style={[s.box, { width: "100%", marginTop: 16 }]} wrap={false}>
            <Text style={s.docText}>{labels.equalWorkConclusion}</Text>
          </View>
        </Section>
      </BrandedPage>

      {/* 6. Equivalent work: the chain line and the measures table. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equivalentTitle}
          number={num("equivalentWork")}
          onRenderPage={resolve("equivalentWork")}
        >
          <Text style={s.para}>{labels.chainLine}</Text>
          <LabeledRows rows={labels.equivalentRows} />
        </Section>
      </BrandedPage>

      {/* 7. Action plan and follow-up: one row per area, counts, the
          responsible function and cost. The responsible cell is a templated
          function label, never an owner name (the appendix carries those). */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.actionPlanTitle}
          number={num("actionPlan")}
          onRenderPage={resolve("actionPlan")}
        >
          {labels.actionPlanRows.length === 0 ? (
            <Text style={s.para}>{labels.noActions}</Text>
          ) : (
            <View>
              <View style={s.headerRow}>
                <Text style={bolded(actionAreaCell)}>{labels.colArea}</Text>
                <Text style={bolded(actionObservationCell)}>
                  {labels.colObservation}
                </Text>
                <Text style={bolded(actionCountCell)}>{labels.colActions}</Text>
                <Text style={bolded(actionStatusCell)}>
                  {labels.colStatusSplit}
                </Text>
                <Text style={bolded(actionResponsibleCell)}>
                  {labels.colResponsible}
                </Text>
                <Text style={bolded(actionCostCell)}>{labels.colCost}</Text>
                <Text style={bolded(actionDatesCell)}>{labels.colDates}</Text>
              </View>
              {labels.actionPlanRows.map((row) => (
                <View key={row.area} style={s.row} wrap={false}>
                  <Text style={actionAreaCell}>{row.area}</Text>
                  <Text style={actionObservationCell}>{row.observation}</Text>
                  <Text style={actionCountCell}>{row.actions}</Text>
                  <Text style={actionStatusCell}>{row.statusSplit}</Text>
                  <Text style={actionResponsibleCell}>{row.responsible}</Text>
                  <Text style={actionCostCell}>
                    {cellText(row.cost, labels.maskedCell)}
                  </Text>
                  <Text style={actionDatesCell}>{row.dates}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
      </BrandedPage>

      {/* 8. Method note (half a page) and the pre-signing checklist. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.methodTitle}
          number={num("method")}
          onRenderPage={resolve("method")}
        >
          {labels.methodLines.map((line) => (
            <Text key={line} style={s.para}>
              {line}
            </Text>
          ))}
          <Text style={s.subHeading}>{labels.checklistTitle}</Text>
          {labels.checklistRows.map((row) => (
            <View key={row.label} style={s.row} wrap={false}>
              <Text style={rowLabelCell}>{row.label}</Text>
              <Text style={bolded(moneyCell)}>
                {row.done ? labels.checklistDone : labels.checklistOpen}
              </Text>
            </View>
          ))}
        </Section>
      </BrandedPage>
    </BrandedDocument>
  )
}
