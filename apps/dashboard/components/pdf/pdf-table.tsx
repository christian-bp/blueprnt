import { StyleSheet, Text, View } from "@react-pdf/renderer"
import type { ComponentProps } from "react"
import { BRAND } from "./branded-document"

// The kit's table vocabulary, shared by every document that prints a table
// (the two pay-mapping documents, the method appendix's criteria table).
// Rows follow the flex-row pattern; lineHeight stays off table rows (the
// fixed-footer landmine, see branded-document.tsx).

// A row whose free text reaches this length may exceed a full page as one
// block, and react-pdf draws an oversized wrap={false} block off the page
// edge with only a console warning: the overflow is silently lost from the
// document (measured at roughly 2,100 characters on an action row's
// geometry). Rows under the bound stay atomic; longer ones give up
// unbreakability so every word stays on a page.
export const BREAKABLE_ROW_TEXT_LENGTH = 600

// View's style type, not Text's: the Text typing unions in the SVG text
// variant's attributes, which the plain Text overload then rejects.
export type PdfStyle = ComponentProps<typeof View>["style"]

export const tableStyles = StyleSheet.create({
  para: { marginBottom: 4, lineHeight: 1.4 },
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
  cellWide: { flex: 3 },
  tableText: { fontSize: 9 },
  // The median line under a mean cell: same figure family, visually
  // subordinate so the mean stays the row's first read.
  medianText: { fontSize: 8, color: "#555" },
  // The measure lines under a group row, side by side (base salary beside
  // the medians). A measure whose columns do not fit the page rides here
  // instead, and two of them stack into a wall unless they share a line.
  metricLines: { flexDirection: "row" },
  metricLine: { flex: 1, paddingRight: 8 },
  // The documentation block under a table row: the row's reasons, note and
  // cited actions, indented so it reads as belonging to the row above.
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
  // A table's band heading (the action table's chapter bands): the app's
  // rounded muted band, not a bare rule.
  band: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginTop: 14,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
  },
  note: { fontSize: 9, color: "#555", marginTop: 4, lineHeight: 1.4 },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
    color: "#111",
  },
  fieldValue: { fontSize: 10, color: "#333", lineHeight: 1.4, marginBottom: 8 },
  // A bordered status box (the signing summary's four boxes): a titled
  // card holding label/value lines.
  box: {
    borderWidth: 0.5,
    borderColor: "#ccc",
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
    width: "48%",
  },
  boxGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
  },
  boxTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  boxRow: { flexDirection: "row", justifyContent: "space-between" },
  chartBlock: { marginTop: 12, marginBottom: 10 },
  contents: { marginTop: 28 },
  contentsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tocRow: { flexDirection: "row", marginBottom: 4 },
  // A fixed number column keeps the TOC titles left-aligned with each other.
  tocNumber: { fontSize: 11, color: BRAND, width: 18 },
  tocLabel: { fontSize: 11, flex: 1 },
  tocPage: { fontSize: 10, color: "#555" },
})

// A masked or absent figure renders the caller's dash.
export function cellText(value: string | null, dash: string): string {
  return value ?? dash
}

// The multi-pass pagination hooks: rows report where they landed (pass N),
// and the export loop answers with the rows that start a new page so their
// table's header re-renders above them (pass N+1).
export interface RowPaginationProps {
  onRowPage?: (id: string, page: number) => void
  headerBreaks?: ReadonlySet<string>
}

// A table cell text that reports its page for the continuation-header
// passes when a capture callback is wired, and renders as plain text
// otherwise. The render prop must be ABSENT (not undefined) on the plain
// path: react-pdf treats any node carrying the prop as dynamic and calls it.
export function CapturedText({
  style,
  id,
  onRowPage,
  text,
}: {
  style: PdfStyle
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

export function TocRow({
  number,
  label,
  page,
}: {
  number: string
  label: string
  page: number | undefined
}) {
  return (
    <View style={tableStyles.tocRow}>
      <Text style={tableStyles.tocNumber}>{number}</Text>
      <Text style={tableStyles.tocLabel}>{label}</Text>
      {page !== undefined && <Text style={tableStyles.tocPage}>{page}</Text>}
    </View>
  )
}

// The continuation-header derivation for the multi-pass render: given the
// row ids of every table in document order and where each row landed
// (captured by CapturedText's onRowPage), the rows that START a new page
// within their table get their table's header re-rendered above them. A
// table's first row never does; a row with no reported page is skipped.
// Pure over (tables, rowPages) so an export loop can iterate to a fixed
// point and tests can pin the derivation.
export function computeHeaderBreaks(
  tables: readonly (readonly string[])[],
  rowPages: Record<string, number>
): Set<string> {
  const breaks = new Set<string>()
  for (const ids of tables) {
    let previousPage: number | undefined
    for (const id of ids) {
      const page = rowPages[id]
      if (page === undefined) continue
      if (previousPage !== undefined && page > previousPage) breaks.add(id)
      previousPage = page
    }
  }
  return breaks
}
