import { getLocale, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { DocsNavPanel, type DocsNavSection } from "@/components/docs/docs-nav"
import { getDoc } from "@/lib/docs/docs"
import { DOCS_NAV, SECTION_LABEL_KEYS } from "@/lib/docs/docs-nav"

// The guide navigation lives in the LAYOUT, not in each page: a layout does
// not remount between guides, so a section the reader opened stays open on
// their next click.
//
// The tree is built here, on the server, and handed to the client component
// as plain serializable data (roughly fifty slugs and titles). That is what
// buys a real disclosure control without a client boundary around the
// filesystem reads: getDoc stays here, and only its result crosses.
export default async function DocsLayout({
  children,
}: {
  children: ReactNode
}) {
  const locale = await getLocale()
  const t = await getTranslations("dashboard.docs")
  const sections: DocsNavSection[] = await Promise.all(
    DOCS_NAV.map(async (section) => {
      const docs = await Promise.all(
        section.pages.map((slug) => getDoc(locale, slug))
      )
      return {
        section: section.section,
        label: t(SECTION_LABEL_KEYS[section.section]),
        pages: docs
          .filter((doc) => doc !== null)
          .map((doc) => ({ slug: doc.slug, title: doc.frontmatter.title })),
      }
    })
  )
  return <DocsNavPanel sections={sections}>{children}</DocsNavPanel>
}
