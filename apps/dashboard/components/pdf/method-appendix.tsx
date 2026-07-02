import { StyleSheet, Text, View } from "@react-pdf/renderer"
import {
  BRAND,
  BrandedDocument,
  BrandedPage,
  Cover,
  Section,
} from "@/components/pdf/branded-document"
import type { MethodAppendixDoc } from "@/lib/pdf/method-appendix-data"

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
  },
  cellName: { flex: 3 },
  cellNum: { flex: 1, textAlign: "right" },
  // lineHeight lives on prose styles (not the page) so it is not inherited by
  // the fixed footer, which vanishes in the browser build under a page-level
  // lineHeight.
  para: { marginBottom: 3, lineHeight: 1.4 },
  label: { fontFamily: "Helvetica-Bold" },
  // Per-criterion detail page. The criterion name is the page's heading; the
  // eyebrow above it names the section, and a short brand rule anchors both.
  criterionEyebrow: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  criterionTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#111" },
  // Full-width rule under the criterion title (spans the content width, not a
  // short stub at the start).
  criterionRule: {
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    marginTop: 8,
    marginBottom: 16,
  },
  field: { marginBottom: 10 },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
    color: "#111",
  },
  fieldValue: { fontSize: 10, color: "#333", lineHeight: 1.4 },
  approval: { fontSize: 9, color: "#666", marginTop: 6 },
  // Cover "Contents" list (a page-numbered table of contents): the label on the
  // left, its page number right-aligned. Page numbers come from a first render
  // pass (see the download component's two-pass render).
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
    justifyContent: "space-between",
    marginBottom: 4,
  },
  tocRowSub: { marginLeft: 14, marginBottom: 3 },
  tocLabel: { fontSize: 11 },
  tocLabelSub: { fontSize: 10, color: "#555" },
  tocPage: { fontSize: 10, color: "#555" },
})

export type MethodAppendixLabels = {
  docTitle: string
  contentsTitle: string
  generatedOn: string
  model: string
  statusTag: string
  methodologyTitle: string
  methodologyBody: string
  criteriaTitle: string
  rationaleTitle: string
  bandsTitle: string
  colCriterion: string
  colWeight: string
  colShare: string
  colBand: string
  colMinScore: string
  purpose: string
  whyRelevant: string
  overlap: string
  biasRisk: string
  biasComment: string
  biasAction: string
  footer: string
  pointBudget: string
  riskLabel: (r: "low" | "medium" | "high") => string
  approval: (c: MethodAppendixDoc["criteria"][number]) => string
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
      <BrandedPage footerLeft={labels.footer}>
        <Cover
          docTitle={labels.docTitle}
          metaLines={[labels.model, labels.generatedOn]}
          statusTag={labels.statusTag}
        />
        <View style={s.contents}>
          <Text style={s.contentsTitle}>{labels.contentsTitle}</Text>
          <TocRow
            label={labels.methodologyTitle}
            page={pageRefs?.methodology}
          />
          <TocRow label={labels.criteriaTitle} page={pageRefs?.criteria} />
          <TocRow label={labels.bandsTitle} page={pageRefs?.bands} />
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
          title={labels.bandsTitle}
          onRenderPage={
            onResolvePage ? (p) => onResolvePage("bands", p) : undefined
          }
        >
          <View style={s.row}>
            <Text style={[s.cellName, s.label]}>{labels.colBand}</Text>
            <Text style={[s.cellNum, s.label]}>{labels.colMinScore}</Text>
          </View>
          {doc.bandThresholds.map((b) => (
            <View key={b.band} style={s.row}>
              <Text style={s.cellName}>{b.band}</Text>
              <Text style={s.cellNum}>{b.minScore}</Text>
            </View>
          ))}
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
            <Text style={s.approval}>{labels.approval(c)}</Text>
          </View>
        ))}
      </BrandedPage>
    </BrandedDocument>
  )
}
