import { Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { COVER_BAND_DATA_URI } from "@/lib/pdf/cover-band"
import { COVER_LOGO_DATA_URI } from "@/lib/pdf/cover-logo"
import { MONO, SANS } from "@/lib/pdf/fonts"
import {
  COVER_BAND,
  COVER_BAND_LINE,
  COVER_PAPER,
  INK,
  INK_MUTED,
  INK_SECONDARY,
  RULE,
} from "@/lib/pdf/palette"

// The cover every document in the kit opens with: a framed off-white sheet, a
// tinted photo band across its head carrying the wordmark and the year, the
// document's name below it, and the facts that identify the version being
// read set small above one mono label at the foot. Nothing else. A cover that
// also carried a section pushed the document's first real page into the fold
// and made the title compete with a signature block; sections start on page 2.
//
// The identity facts are the sheet's quietest element on purpose. They are
// what the document IS rather than what it says, so they sit at the foot in
// the size the design reserves for labels, under a rule, and the title block
// keeps the upper half to itself.
//
// Full bleed: the page's own padding IS the visual margin, so the sheet is
// laid out at fixed A4 and nothing about it is conditional. This is also the
// one page in the kit WITHOUT the running footer -- a cover carries no folio,
// and the page numbers on the pages after it are unaffected.

// A4 is 595.28 x 841.89pt. Everything below is stated in the design's own
// units and converted here, so the numbers can be read against the handoff.
const MM = 2.834645669
const PAGE_HEIGHT = 841.89
// The design's hairline is one CSS pixel, which is 1/96in in print.
const HAIRLINE = 0.75
const PAGE_PADDING = 12 * MM
// The band is 38% of the frame's inner height. Resolved to points here rather
// than left as a percentage because the band's image has to be given the SAME
// height: an Image is the one child react-pdf will not stretch reliably to a
// percentage-sized parent.
const FRAME_HEIGHT = PAGE_HEIGHT - 2 * PAGE_PADDING - 2 * HAIRLINE
const BAND_HEIGHT = FRAME_HEIGHT * 0.38

// CSS centres a line's glyphs in its line box, so a line-height BELOW the
// font's own content height lifts the first line by half the difference;
// react-pdf hangs the baseline off the ascent and leaves it where it is.
// Measured against the design's own render, that is this much at the title's
// size: taken off the title, and given back to the line under it so the
// design's 5mm gap survives.
const TITLE_LINE_LIFT = 4.6

const styles = StyleSheet.create({
  page: { backgroundColor: "#ffffff", padding: PAGE_PADDING },
  frame: {
    flex: 1,
    borderWidth: HAIRLINE,
    borderColor: RULE,
    backgroundColor: COVER_PAPER,
  },
  band: {
    height: BAND_HEIGHT,
    backgroundColor: COVER_BAND,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: COVER_BAND_LINE,
  },
  // In flow rather than absolute, and first: react-pdf paints an absolutely
  // positioned Image OVER its later siblings, which buries the logo row.
  bandImage: { width: "100%", height: BAND_HEIGHT - HAIRLINE },
  // The band's padding, as insets on the row that floats over the picture.
  bandRow: {
    position: "absolute",
    top: 12 * MM,
    left: 16 * MM,
    right: 16 * MM,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  // Width only: the height follows the mark's own aspect, as it does in the
  // design.
  logo: { width: 50 * MM },
  markLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.14 * 9,
    color: INK_SECONDARY,
    textTransform: "uppercase",
    // CSS puts the tracking after the LAST character too, inside the box, so
    // the ink stops one letter-space short of the padding edge; react-pdf
    // does not. This is that space, so the label ends where the design's does.
    marginRight: 0.14 * 9,
  },
  content: {
    flex: 1,
    padding: 16 * MM,
    justifyContent: "space-between",
  },
  title: {
    fontFamily: SANS,
    fontWeight: 500,
    fontSize: 40,
    lineHeight: 1.02,
    letterSpacing: -0.025 * 40,
    color: INK,
    marginTop: -TITLE_LINE_LIFT,
  },
  subtitle: {
    fontFamily: SANS,
    fontSize: 14,
    color: INK_SECONDARY,
    marginTop: 5 * MM + TITLE_LINE_LIFT,
  },
  // A fixed label column keeps every value on one left edge, which is what
  // makes five lines read as a block rather than as five sentences.
  facts: {
    paddingTop: 4 * MM,
    borderTopWidth: HAIRLINE,
    borderTopColor: RULE,
    marginBottom: 8 * MM,
  },
  factRow: { flexDirection: "row", marginBottom: 4 },
  factLabel: { fontFamily: SANS, fontSize: 8, color: INK_MUTED, width: 118 },
  factValue: { fontFamily: SANS, fontSize: 8, flex: 1, color: INK_SECONDARY },
  note: {
    fontFamily: SANS,
    fontSize: 8,
    color: INK_SECONDARY,
    marginTop: 3 * MM,
    lineHeight: 1.4,
  },
  footLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.14 * 9,
    color: INK_MUTED,
    textTransform: "uppercase",
  },
})

export interface CoverFact {
  label: string
  value: string
}

export function CoverPage({
  title,
  subtitle,
  markLabel,
  facts,
  notes,
  footLabel,
}: {
  // The document's own name, at the sheet's one large size.
  title: string
  // The organization the document belongs to.
  subtitle: string
  // The band's top-right label: the year the document covers, and the draft
  // marker when it has one. Absent on a document that covers no period.
  markLabel?: string
  // The version facts, as a key/value block at the foot.
  facts: CoverFact[]
  // The sentences that qualify the document rather than identify it: what a
  // draft's figures are worth, and who may read the appendix. Under the same
  // rule as the facts, because they are read at the same moment.
  notes?: string[]
  // The small label at the sheet's foot, naming what kind of document this
  // is. Passed in the locale's own case; the style uppercases it.
  footLabel: string
}) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.frame}>
        <View style={styles.band}>
          <Image src={COVER_BAND_DATA_URI} style={styles.bandImage} />
          <View style={styles.bandRow}>
            <Image src={COVER_LOGO_DATA_URI} style={styles.logo} />
            {markLabel !== undefined && (
              <Text style={styles.markLabel}>{markLabel}</Text>
            )}
          </View>
        </View>
        <View style={styles.content}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View>
            <View style={styles.facts}>
              {facts.map((fact) => (
                <View key={fact.label} style={styles.factRow}>
                  <Text style={styles.factLabel}>{fact.label}</Text>
                  <Text style={styles.factValue}>{fact.value}</Text>
                </View>
              ))}
              {notes?.map((note) => (
                <Text key={note} style={styles.note}>
                  {note}
                </Text>
              ))}
            </View>
            <Text style={styles.footLabel}>{footLabel}</Text>
          </View>
        </View>
      </View>
    </Page>
  )
}
