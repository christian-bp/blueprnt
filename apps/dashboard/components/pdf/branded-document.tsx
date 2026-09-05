// Reusable branded PDF kit built on @react-pdf/renderer. This is the app-wide
// foundation for exportable documents; per-document templates (e.g. the
// metodbilaga) compose these primitives. All strings are passed in as props so
// this layer stays i18n-free. Charts are drawn as vectors on react-pdf's own
// SVG primitives (see pay-mapping-report-charts.tsx): a document renders the
// same on every machine, and nothing has to rasterize the app's live charts.
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import type { ReactNode } from "react"
// Imported for its side effect: registering the kit's typefaces. Every
// document reaches the renderer through this module, so this is the one place
// that has to remember.
import "@/lib/pdf/fonts"
import { INK, INK_MUTED, INK_SECONDARY } from "@/lib/pdf/palette"
import { WORDMARK_DATA_URI } from "@/lib/pdf/wordmark"

// No hyphenation, in any document built on this kit: the default splits
// mid-word with an inserted hyphen, which broke money ranges ("53 523 -" /
// "kr–89 863 kr") inside table cells. Word-boundary wrapping is right for
// every string these documents carry.
Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
    // NOTE: no page-level lineHeight. A lineHeight here is inherited by the
    // `fixed` footer/header and makes the footer vanish in the browser build
    // (auto-height absolute + inherited lineHeight). Set lineHeight on the
    // specific prose text styles instead (see method-appendix `para`/`fieldValue`).
  },
  // Chapter typography: at most three heading levels in a document, each a
  // clear size step above the next (16 / 12 / 10 against 10pt body), with
  // more space before a heading than after it. The chapter number recedes to
  // the muted ink: it is a transition marker rather than title text, and the
  // documents carry no accent colour of their own (see lib/pdf/palette).
  sectionTitleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  sectionNumber: {
    color: INK_MUTED,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 9,
    color: INK_SECONDARY,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // Running header logo: top-right, level with the content's first line (the
  // page title), so it reads as a header in line with the titles.
  runningLogo: { position: "absolute", top: 60, right: 48 },
})

export function BrandedDocument({ children }: { children: ReactNode }) {
  return <Document>{children}</Document>
}

export function BrandedPage({
  footerLeft,
  runningHeader = false,
  children,
}: {
  footerLeft: string
  runningHeader?: boolean
  children: ReactNode
}) {
  return (
    // A running-header page starts its content BELOW the fixed logo (top 60
    // + ~19pt wordmark height): the default 64pt top padding let a page
    // break drop a full-width line straight through the wordmark.
    <Page
      size="A4"
      style={[styles.page, ...(runningHeader ? [{ paddingTop: 88 }] : [])]}
    >
      {/* Running header: a small wordmark top-right on every page of this Page.
          Enabled for content pages; the cover is a separate Page without it so
          its full logo is not doubled. */}
      {runningHeader && (
        <View fixed style={styles.runningLogo}>
          <BlueprntWordmark width={64} />
        </View>
      )}
      {children}
      <View style={styles.footer} fixed>
        <Text>{footerLeft}</Text>
        {/* `fixed` on the render Text is what makes totalPages resolve and the
            number update on every page, not just the first. */}
        <Text
          fixed
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </Page>
  )
}

// The blueprnt wordmark, rendered from an embedded PNG (see lib/pdf/wordmark).
// A raster Image sizes reliably in react-pdf's browser build; the inline SVG
// wordmark's viewBox transform crashed there ("unsupported number"). Height is
// left to the intrinsic aspect ratio so only width needs to be set.
function BlueprntWordmark({ width = 132 }: { width?: number }) {
  return <Image src={WORDMARK_DATA_URI} style={{ width }} />
}

export function Section({
  title,
  number,
  onRenderPage,
  children,
}: {
  title: string
  // Chapter number, shown before the title in the muted ink. A separate
  // Text (not part of the title string) because the title renders through a
  // render prop, which must return a plain string.
  number?: string
  onRenderPage?: (page: number) => void
  children: ReactNode
}) {
  return (
    // No wrap={false}: a section (and the per-item blocks inside it) must be able
    // to paginate. A wrap={false} block taller than a page overlaps in react-pdf,
    // so long content is allowed to break across pages rather than being kept
    // together.
    <View>
      <View style={styles.sectionTitleRow}>
        {number !== undefined && (
          <Text style={[styles.sectionTitle, styles.sectionNumber]}>
            {number}
          </Text>
        )}
        {/* render (not a static child) lets a caller capture the page this
            title lands on, for a page-numbered table of contents. Returning
            the title string is layout-safe; an empty capturer element writes
            an invalid coordinate in the browser build. */}
        <Text
          style={styles.sectionTitle}
          render={({ pageNumber }) => {
            onRenderPage?.(pageNumber)
            return title
          }}
        />
      </View>
      {children}
    </View>
  )
}
