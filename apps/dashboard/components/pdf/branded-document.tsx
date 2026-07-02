// Reusable branded PDF kit built on @react-pdf/renderer. This is the app-wide
// foundation for exportable documents; per-document templates (e.g. the
// metodbilaga) compose these primitives. All strings are passed in as props so
// this layer stays i18n-free. Charts (future): embed via react-pdf-charts (SVG,
// isAnimationActive={false}) or a rasterized PNG; not used by the metodbilaga.
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import type { ReactNode } from "react"
import { WORDMARK_DATA_URI } from "@/lib/pdf/wordmark"

export const BRAND = "#f43f5e"

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    color: "#111",
    fontFamily: "Helvetica",
    // NOTE: no page-level lineHeight. A lineHeight here is inherited by the
    // `fixed` footer/header and makes the footer vanish in the browser build
    // (auto-height absolute + inherited lineHeight). Set lineHeight on the
    // specific prose text styles instead (see method-appendix `para`/`fieldValue`).
  },
  cover: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: BRAND,
    paddingBottom: 12,
  },
  coverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 16,
  },
  coverTitleCol: { flex: 1, paddingRight: 16 },
  coverMeta: { alignItems: "flex-end" },
  docTitle: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#666", marginTop: 4, textAlign: "right" },
  statusTag: {
    fontSize: 9,
    color: BRAND,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
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
    fontSize: 9,
    color: "#555",
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
    <Page size="A4" style={styles.page}>
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
      <BlueprntWordmark />
      {/* Two columns: the document identity (title + status) on the left, the
          metadata (model, generated date) right-aligned on the right. */}
      <View style={styles.coverRow}>
        <View style={styles.coverTitleCol}>
          <Text style={styles.docTitle}>{docTitle}</Text>
          <Text style={styles.statusTag}>{statusTag}</Text>
        </View>
        <View style={styles.coverMeta}>
          {metaLines.map((line) => (
            <Text key={line} style={styles.meta}>
              {line}
            </Text>
          ))}
        </View>
      </View>
    </View>
  )
}

export function Section({
  title,
  onRenderPage,
  children,
}: {
  title: string
  onRenderPage?: (page: number) => void
  children: ReactNode
}) {
  return (
    // No wrap={false}: a section (and the per-item blocks inside it) must be able
    // to paginate. A wrap={false} block taller than a page overlaps in react-pdf,
    // so long content is allowed to break across pages rather than being kept
    // together.
    <View>
      {/* render (not a static child) lets a caller capture the page this title
          lands on, for a page-numbered table of contents. Returning the title
          string is layout-safe; an empty capturer element writes an invalid
          coordinate in the browser build. */}
      <Text
        style={styles.sectionTitle}
        render={({ pageNumber }) => {
          onRenderPage?.(pageNumber)
          return title
        }}
      />
      {children}
    </View>
  )
}
