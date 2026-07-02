// Reusable branded PDF kit built on @react-pdf/renderer. This is the app-wide
// foundation for exportable documents; per-document templates (e.g. the
// metodbilaga) compose these primitives. All strings are passed in as props so
// this layer stays i18n-free. Charts (future): embed via react-pdf-charts (SVG,
// isAnimationActive={false}) or a rasterized PNG; not used by the metodbilaga.
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { ReactNode } from "react"

const BRAND = "#f43f5e"

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    color: "#111",
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  cover: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: BRAND,
    paddingBottom: 12,
  },
  wordmark: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BRAND },
  docTitle: { fontSize: 16, marginTop: 8, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#666", marginTop: 4 },
  statusTag: {
    fontSize: 9,
    color: BRAND,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#999",
    flexDirection: "row",
    justifyContent: "space-between",
  },
})

export function BrandedDocument({ children }: { children: ReactNode }) {
  return <Document>{children}</Document>
}

export function BrandedPage({
  footerLeft,
  children,
}: {
  footerLeft: string
  children: ReactNode
}) {
  return (
    <Page size="A4" style={styles.page}>
      {children}
      <View style={styles.footer} fixed>
        <Text>{footerLeft}</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </Page>
  )
}

export function Cover({
  docTitle,
  metaLines,
  statusTag,
}: {
  docTitle: string
  metaLines: string[]
  statusTag: string
}) {
  return (
    <View style={styles.cover}>
      <Text style={styles.wordmark}>blueprnt</Text>
      <Text style={styles.docTitle}>{docTitle}</Text>
      {metaLines.map((line) => (
        <Text key={line} style={styles.meta}>
          {line}
        </Text>
      ))}
      <Text style={styles.statusTag}>{statusTag}</Text>
    </View>
  )
}

export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    // No wrap={false}: a section (and the per-item blocks inside it) must be able
    // to paginate. A wrap={false} block taller than a page overlaps in react-pdf,
    // so long content is allowed to break across pages rather than being kept
    // together.
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}
