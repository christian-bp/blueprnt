import { StyleSheet, Text, View } from "@react-pdf/renderer"
import type { ComponentProps } from "react"
import {
  INK,
  INK_BODY,
  INK_MUTED,
  INK_SECONDARY,
  RULE,
  SURFACE,
} from "@/lib/pdf/palette"

// The kit's table vocabulary, shared by the two pay-mapping documents.
//
// Not by the method appendix: its table is two columns of criterion text and
// its contents list is nested and unnumbered, so the only piece it could
// share is the row rule itself. Pulling it onto this vocabulary would couple
// a document with different columns to every change these two need.
// LEADING is set per style, never on the page. Measured in this build with a
// probe rendered and read back with pdftotext: react-pdf's lineHeight SETS
// the pitch as a multiple of the font size, exactly as CSS does (10pt text
// at lineHeight 1.4 gives a 14.0pt pitch, 1.3 gives 13.0). An earlier
// comment here claimed it ADDED leading; it does not, and the claim came
// from a probe that only compared unset against larger values.
//
// What that probe did establish is that the font's own leading, which is
// what an unset lineHeight gives, is 1.10 -- tight enough to read as a wall
// once a paragraph wraps more than twice. Running prose therefore carries an
// explicit lineHeight and table rows do not: a cell is a label, not a
// paragraph, and leading between one-line cells only loosens the grid.
//
// Nothing type-related may sit on the PAGE style, whatever its value: the
// fixed footer inherits it and vanishes in the browser build (the landmine
// documented in branded-document.tsx).

// A block whose free text reaches this length may exceed a full page on its
// own, and react-pdf draws an oversized wrap={false} block off the page edge
// with only a console warning: the overflow is silently lost from the
// document, and the page count FALLS as the content grows, which is the
// signature to look for. Blocks under the bound stay atomic; longer ones
// give up unbreakability so every word stays on a page.
//
// The cliff sat near 2,100 characters on an action row's geometry at the
// font's own 1.10 leading; at the prose leading above it is near 1,650, so
// this bound keeps a margin of roughly 2.7x. It counts every string the
// block DRAWS, not the one that happens to be longest: a bound that read
// only the note while the block also carried an unbounded planned measure
// reported "short, stay atomic" on a block that ran off the page.
export const BREAKABLE_ROW_TEXT_LENGTH = 600

// View's style type, not Text's: the Text typing unions in the SVG text
// variant's attributes, which the plain Text overload then rejects.
export type PdfStyle = ComponentProps<typeof View>["style"]

// Leading for RUNNING PROSE. The font's own is 1.10, which puts less white
// between two lines than between two words on them (1.57pt of channel
// against a 2.50pt word space at 9pt), and a block whose vertical white is
// tighter than its horizontal white reads as a texture rather than as lines:
// nothing tells the eye to travel along a line rather than down the column.
// The floor is a channel of about 1.5x the word space, which is lineHeight
// 1.34; this sits above it, and above it rather than at it because these
// paragraphs still run wide.
export const PROSE_LINE_HEIGHT = 1.4
// Leading for free text inside a TABLE CELL. A cell's measure is a quarter of
// the prose column's, so its return sweep is short and the prose value would
// only spend row height. Leading tracks measure; that is the whole rule.
export const CELL_LINE_HEIGHT = 1.25
// How wide a block of running prose may get. A criterion's documentation ran
// the full 489pt column, which is 120 characters at 9pt against a
// comfortable 45-75, and no leading rescues a line that long: the eye loses
// the return. Held as a multiple of the font size so one number serves the
// 8, 9 and 10pt prose, and applied as a maxWidth so a block still shrinks
// with a narrower parent.
export const PROSE_MEASURE_EM = 42

export const tableStyles = StyleSheet.create({
  para: { marginBottom: 4, lineHeight: PROSE_LINE_HEIGHT },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 3,
  },
  // A row that OPENS a block rather than closing one: no rule under it, and
  // less space below than above, so it reads as the head of the thing under
  // it. The plain row draws the same hairline at both of a criterion's
  // boundaries, which said a criterion and its own description were as
  // unrelated as two different criteria.
  rowOpen: {
    flexDirection: "row",
    paddingTop: 3,
    paddingBottom: 1,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK_MUTED,
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
  cellWide: { flex: 3, lineHeight: CELL_LINE_HEIGHT },
  tableText: { fontSize: 9 },
  // The median line under a mean cell: same figure family, visually
  // subordinate so the mean stays the row's first read.
  medianText: { fontSize: 8, color: INK_SECONDARY },
  // The measure lines under a group row, side by side (base salary beside
  // the medians). A measure whose columns do not fit the page rides here
  // instead, and two of them stack into a wall unless they share a line.
  metricLines: { flexDirection: "row" },
  metricLine: { flex: 1, paddingRight: 8 },
  // The documentation block under a table row: the row's reasons, note and
  // cited actions, indented so it reads as belonging to the row above.
  docBlock: {
    paddingLeft: 12,
    paddingTop: 1,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  // marginBottom, not more leading: leading applies inside a paragraph too,
  // so it can never open a paragraph boundary relative to the body. Without
  // it the step from "what it measures" to "why it is relevant" was
  // byte-identical to the step between two wrapped lines of one sentence,
  // and the run-in label was the only thing marking a new paragraph.
  docText: {
    fontSize: 9,
    color: INK_BODY,
    lineHeight: PROSE_LINE_HEIGHT,
    marginBottom: 5,
    maxWidth: PROSE_MEASURE_EM * 9,
  },
  docLabel: { fontFamily: "Helvetica-Bold", color: INK },
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
    backgroundColor: SURFACE,
    borderRadius: 4,
  },
  note: {
    fontSize: 9,
    color: INK_SECONDARY,
    marginTop: 4,
    lineHeight: PROSE_LINE_HEIGHT,
    maxWidth: PROSE_MEASURE_EM * 9,
  },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
    color: INK,
  },
  fieldValue: {
    fontSize: 10,
    color: INK_BODY,
    marginBottom: 8,
    lineHeight: PROSE_LINE_HEIGHT,
    maxWidth: PROSE_MEASURE_EM * 10,
  },
  // A bordered aside: a full-width card holding label/value lines, set apart
  // from the prose around it. It used to be one of four boxes in a grid on
  // the signing summary; those are charts now, and this is the one survivor.
  box: {
    borderWidth: 0.5,
    borderColor: RULE,
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  chartBlock: { marginTop: 12, marginBottom: 10 },
  contents: { marginTop: 28 },
  contentsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: INK_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tocRow: { flexDirection: "row", marginBottom: 4 },
  // A fixed number column keeps the TOC titles left-aligned with each other.
  tocNumber: { fontSize: 11, color: INK_MUTED, width: 18 },
  tocLabel: { fontSize: 11, flex: 1 },
  tocPage: { fontSize: 10, color: INK_SECONDARY },
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
