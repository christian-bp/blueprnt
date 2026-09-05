import { StyleSheet, Text, View } from "@react-pdf/renderer"
import {
  BrandedDocument,
  BrandedPage,
  Section,
} from "@/components/pdf/branded-document"
import { CoverPage } from "@/components/pdf/cover-page"
import { PROSE_LINE_HEIGHT, PROSE_MEASURE_EM } from "@/components/pdf/pdf-table"
import {
  INK,
  INK_BODY,
  INK_MUTED,
  INK_SECONDARY,
  RULE,
} from "@/lib/pdf/palette"
import type { MethodAppendixDoc } from "@/lib/pdf/method-appendix-data"

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 3,
  },
  cellName: { flex: 3 },
  cellNum: { flex: 1, textAlign: "right" },
  // Leading is set per style and never on the page; see pdf-table.tsx for the
  // measurement and for why the page style must stay free of it.
  para: { marginBottom: 3, lineHeight: PROSE_LINE_HEIGHT },
  label: { fontFamily: "Helvetica-Bold" },
  // Per-criterion detail page. The criterion name is the page's heading; the
  // eyebrow above it names the section, and a hairline anchors both.
  criterionEyebrow: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: INK_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  criterionTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: INK },
  // Full-width hairline under the criterion title (spans the content width,
  // not a short stub at the start).
  criterionRule: {
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
    marginTop: 8,
    marginBottom: 16,
  },
  field: { marginBottom: 10 },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
    color: INK,
  },
  fieldValue: {
    fontSize: 10,
    color: INK_BODY,
    lineHeight: PROSE_LINE_HEIGHT,
    maxWidth: PROSE_MEASURE_EM * 10,
  },
  approval: {
    fontSize: 9,
    color: INK_SECONDARY,
    marginTop: 6,
    lineHeight: PROSE_LINE_HEIGHT,
  },
  // Cover "Contents" list (a page-numbered table of contents): the label on the
  // left, its page number right-aligned. Page numbers come from a first render
  // pass (see the download component's two-pass render).
  contents: { marginTop: 28 },
  contentsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: INK_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tocRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  tocRowSub: { marginLeft: 14, marginBottom: 3 },
  tocLabel: { fontSize: 11 },
  cellStep: { width: 16 },
  note: {
    fontSize: 9,
    color: INK_SECONDARY,
    marginTop: 4,
    lineHeight: PROSE_LINE_HEIGHT,
    maxWidth: PROSE_MEASURE_EM * 9,
  },
  zoneBlock: { marginBottom: 12 },
  zoneHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  anchorRow: { flexDirection: "row", marginBottom: 3 },
  anchorText: {
    flex: 1,
    fontSize: 10,
    color: INK_BODY,
    lineHeight: PROSE_LINE_HEIGHT,
    maxWidth: PROSE_MEASURE_EM * 10,
  },
  tocLabelSub: { fontSize: 10, color: INK_SECONDARY },
  tocPage: { fontSize: 10, color: INK_SECONDARY },
})

export type MethodAppendixLabels = {
  docTitle: string
  // The organization the appendix belongs to, above its name on the cover.
  eyebrow: string
  // The cover's label column, one per fact.
  footLabel: string
  factLabels: { model: string; generatedOn: string }
  contentsTitle: string
  generatedOn: string
  model: string
  // Present only while the appendix is a draft; it rides in the cover's
  // band beside the logo.
  draftMarker?: string
  // The sentence a draft owes its reader, under the cover's colophon: the
  // band's marker says the state, this says what the state means for the
  // figures.
  statusNote?: string
  methodologyTitle: string
  methodologyBody: string
  scaleTitle: string
  midpointNote: string
  criteriaTitle: string
  rationaleTitle: string
  zonesTitle: string
  materialityTitle: string
  colCriterion: string
  colWeight: string
  colShare: string
  colLevel: string
  colMinScore: string
  definition: string
  anchorsLabel: string
  purpose: string
  whyRelevant: string
  overlap: string
  biasRisk: string
  biasComment: string
  biasAction: string
  footer: string
  pointBudget: string
  motivationLabel: string
  riskLabel: (r: "low" | "medium" | "high") => string
  approval: (c: MethodAppendixDoc["criteria"][number]) => string
  zoneHeading: (zone: MethodAppendixDoc["zones"][number]) => string
  zoneProfileLine: (minStep: number | null) => string
  materialityLine: (wc: MethodAppendixDoc["workingConditions"]) => string
}

// One labelled field on a criterion page: the field name above its value, so a
// full page of rationale reads as a document rather than a dense inline list.
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value ?? "-"}</Text>
    </View>
  )
}

// One table-of-contents row: label on the left, page number right-aligned.
function TocRow({
  label,
  page,
  sub = false,
}: {
  label: string
  page: number | undefined
  sub?: boolean
}) {
  return (
    <View style={sub ? [s.tocRow, s.tocRowSub] : s.tocRow}>
      <Text style={sub ? s.tocLabelSub : s.tocLabel}>{label}</Text>
      {page !== undefined && <Text style={s.tocPage}>{page}</Text>}
    </View>
  )
}

export function MethodAppendix({
  doc,
  labels,
  pageRefs,
  onResolvePage,
}: {
  doc: MethodAppendixDoc
  labels: MethodAppendixLabels
  pageRefs?: Record<string, number>
  onResolvePage?: (id: string, page: number) => void
}) {
  return (
    <BrandedDocument>
      {/* The kit's cover, the same one both pay-mapping documents open
          with. Its contents list starts on the page after it. */}
      <CoverPage
        title={labels.docTitle}
        subtitle={labels.eyebrow}
        markLabel={labels.draftMarker}
        facts={[
          { label: labels.factLabels.model, value: labels.model },
          { label: labels.factLabels.generatedOn, value: labels.generatedOn },
        ]}
        {...(labels.statusNote === undefined
          ? {}
          : { notes: [labels.statusNote] })}
        footLabel={labels.footLabel}
      />
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <View style={s.contents}>
          <Text style={s.contentsTitle}>{labels.contentsTitle}</Text>
          <TocRow
            label={labels.methodologyTitle}
            page={pageRefs?.methodology}
          />
          <TocRow label={labels.scaleTitle} page={pageRefs?.scale} />
          <TocRow label={labels.criteriaTitle} page={pageRefs?.criteria} />
          <TocRow label={labels.zonesTitle} page={pageRefs?.levels} />
          <TocRow
            label={labels.materialityTitle}
            page={pageRefs?.materiality}
          />
          <TocRow label={labels.rationaleTitle} page={undefined} />
          {doc.criteria.map((c) => (
            <TocRow
              key={c.criterionId}
              label={c.name}
              page={pageRefs?.[c.criterionId]}
              sub
            />
          ))}
        </View>
      </BrandedPage>
      {/* Content pages carry the running-header logo; the cover above does not,
          so its full logo is not doubled. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.methodologyTitle}
          onRenderPage={
            onResolvePage ? (p) => onResolvePage("methodology", p) : undefined
          }
        >
          <Text style={s.para}>{labels.methodologyBody}</Text>
          <Text style={s.para}>{doc.biasStatement}</Text>
        </Section>
        <Section
          title={labels.scaleTitle}
          onRenderPage={
            onResolvePage ? (p) => onResolvePage("scale", p) : undefined
          }
        >
          {doc.scaleSteps.map((step) => (
            <View key={step.step} style={s.row}>
              <Text style={[s.cellStep, s.label]}>{step.step}</Text>
              <Text style={s.cellName}>
                <Text style={s.label}>{step.name}. </Text>
                {step.meaning}
              </Text>
            </View>
          ))}
          <Text style={s.note}>{labels.midpointNote}</Text>
        </Section>
        <Section
          title={labels.criteriaTitle}
          onRenderPage={
            onResolvePage ? (p) => onResolvePage("criteria", p) : undefined
          }
        >
          <Text style={s.para}>{labels.pointBudget}</Text>
          <View style={s.row}>
            <Text style={[s.cellName, s.label]}>{labels.colCriterion}</Text>
            <Text style={[s.cellNum, s.label]}>{labels.colWeight}</Text>
            <Text style={[s.cellNum, s.label]}>{labels.colShare}</Text>
          </View>
          {doc.criteria.map((c) => (
            <View key={c.criterionId} style={s.row}>
              <Text style={s.cellName}>{c.name}</Text>
              <Text style={s.cellNum}>{c.weightPoints}</Text>
              <Text style={s.cellNum}>{c.share}%</Text>
            </View>
          ))}
        </Section>
        <Section
          title={labels.zonesTitle}
          onRenderPage={
            onResolvePage ? (p) => onResolvePage("levels", p) : undefined
          }
        >
          {doc.zones.map((zone) => (
            <View key={zone.key} style={s.zoneBlock}>
              <Text style={s.zoneHeading}>{labels.zoneHeading(zone)}</Text>
              <View style={s.row}>
                <Text style={[s.cellName, s.label]}>{labels.colLevel}</Text>
                <Text style={[s.cellNum, s.label]}>{labels.colMinScore}</Text>
              </View>
              {zone.levels.map((b) => (
                <View key={b.level} style={s.row}>
                  <Text style={s.cellName}>{b.level}</Text>
                  <Text style={s.cellNum}>{b.minScore}</Text>
                </View>
              ))}
              <Text style={s.note}>{labels.zoneProfileLine(zone.minStep)}</Text>
            </View>
          ))}
        </Section>
        <Section
          title={labels.materialityTitle}
          onRenderPage={
            onResolvePage ? (p) => onResolvePage("materiality", p) : undefined
          }
        >
          <Text style={s.para}>
            {labels.materialityLine(doc.workingConditions)}
          </Text>
          {doc.workingConditions !== null && (
            <Field
              label={labels.motivationLabel}
              value={doc.workingConditions.motivation}
            />
          )}
        </Section>
        {/* One criterion per page: `break` starts each on a fresh page. No
            wrap={false}, so a long rationale paginates instead of overlapping. */}
        {doc.criteria.map((c) => (
          <View key={c.criterionId} break>
            {/* render on the eyebrow captures this criterion's page for the TOC
                and returns its text; layout-safe (returns a string). */}
            <Text
              style={s.criterionEyebrow}
              render={({ pageNumber }) => {
                onResolvePage?.(c.criterionId, pageNumber)
                return labels.rationaleTitle
              }}
            />
            <Text style={s.criterionTitle}>{c.name}</Text>
            <View style={s.criterionRule} />
            <Field label={labels.definition} value={c.description} />
            <Field label={labels.purpose} value={c.purpose} />
            <Field label={labels.whyRelevant} value={c.whyRelevant} />
            {c.overlapNotes !== null && (
              <Field label={labels.overlap} value={c.overlapNotes} />
            )}
            <Field
              label={labels.biasRisk}
              value={c.biasRisk ? labels.riskLabel(c.biasRisk) : "-"}
            />
            <Field label={labels.biasComment} value={c.biasComment} />
            {c.biasAction !== null && (
              <Field label={labels.biasAction} value={c.biasAction} />
            )}
            <View style={s.field}>
              <Text style={s.fieldLabel}>{labels.anchorsLabel}</Text>
              {c.anchors.map((anchor) => (
                <View key={anchor.step} style={s.anchorRow}>
                  <Text style={[s.cellStep, s.label]}>{anchor.step}</Text>
                  <Text style={s.anchorText}>{anchor.text}</Text>
                </View>
              ))}
            </View>
            <Text style={s.approval}>{labels.approval(c)}</Text>
          </View>
        ))}
      </BrandedPage>
    </BrandedDocument>
  )
}
