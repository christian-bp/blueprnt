import { StyleSheet, Text, View } from "@react-pdf/renderer"
import { INK, INK_SECONDARY } from "@/lib/pdf/palette"

// The signing report's signature block: one column per signing party, each
// with a labeled line for name, signature, place and date. Lines are ruled
// blanks (the document is signed on paper; there is no in-app signing).
export interface SignatureLabels {
  name: string
  signature: string
  place: string
  date: string
}

const s = StyleSheet.create({
  block: { flexDirection: "row", gap: 24, marginTop: 28 },
  column: { flex: 1 },
  columnTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  line: { marginBottom: 16 },
  lineLabel: { fontSize: 8, color: INK_SECONDARY, marginBottom: 14 },
  rule: { borderBottomWidth: 0.5, borderBottomColor: INK },
})

export function SignatureBlock({
  columns,
  labels,
}: {
  columns: readonly string[]
  labels: SignatureLabels
}) {
  const lines = [labels.name, labels.signature, labels.place, labels.date]
  return (
    <View style={s.block} wrap={false}>
      {columns.map((title) => (
        <View key={title} style={s.column}>
          <Text style={s.columnTitle}>{title}</Text>
          {lines.map((line) => (
            <View key={line} style={s.line}>
              <Text style={s.lineLabel}>{line}</Text>
              <View style={s.rule} />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
