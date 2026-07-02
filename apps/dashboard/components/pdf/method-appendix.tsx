import { StyleSheet, Text, View } from "@react-pdf/renderer"
import {
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
  para: { marginBottom: 3 },
  label: { fontFamily: "Helvetica-Bold" },
  block: { marginBottom: 10 },
  blockName: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
})

export type MethodAppendixLabels = {
  docTitle: string
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
  riskLabel: (r: "low" | "medium" | "high") => string
  approval: (c: MethodAppendixDoc["criteria"][number]) => string
}

export function MethodAppendix({
  doc,
  labels,
}: {
  doc: MethodAppendixDoc
  labels: MethodAppendixLabels
}) {
  return (
    <BrandedDocument>
      <BrandedPage footerLeft={labels.footer}>
        <Cover
          docTitle={labels.docTitle}
          metaLines={[labels.model, labels.generatedOn]}
          statusTag={labels.statusTag}
        />
        <Section title={labels.methodologyTitle}>
          <Text style={s.para}>{labels.methodologyBody}</Text>
          <Text style={s.para}>{doc.biasStatement}</Text>
        </Section>
        <Section title={labels.criteriaTitle}>
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
        <Section title={labels.rationaleTitle}>
          {doc.criteria.map((c) => (
            <View key={c.criterionId} style={s.block} wrap={false}>
              <Text style={s.blockName}>{c.name}</Text>
              <Text style={s.para}>
                <Text style={s.label}>{labels.purpose}: </Text>
                {c.purpose ?? "-"}
              </Text>
              <Text style={s.para}>
                <Text style={s.label}>{labels.whyRelevant}: </Text>
                {c.whyRelevant ?? "-"}
              </Text>
              {c.overlapNotes !== null && (
                <Text style={s.para}>
                  <Text style={s.label}>{labels.overlap}: </Text>
                  {c.overlapNotes}
                </Text>
              )}
              <Text style={s.para}>
                <Text style={s.label}>{labels.biasRisk}: </Text>
                {c.biasRisk ? labels.riskLabel(c.biasRisk) : "-"}
              </Text>
              <Text style={s.para}>
                <Text style={s.label}>{labels.biasComment}: </Text>
                {c.biasComment ?? "-"}
              </Text>
              {c.biasAction !== null && (
                <Text style={s.para}>
                  <Text style={s.label}>{labels.biasAction}: </Text>
                  {c.biasAction}
                </Text>
              )}
              <Text style={s.para}>{labels.approval(c)}</Text>
            </View>
          ))}
        </Section>
        <Section title={labels.bandsTitle}>
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
      </BrandedPage>
    </BrandedDocument>
  )
}
