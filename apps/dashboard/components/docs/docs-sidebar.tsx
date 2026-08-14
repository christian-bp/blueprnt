import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { getDoc } from "@/lib/docs/docs"
import { DOCS_NAV, SECTION_LABEL_KEYS } from "@/lib/docs/docs-nav"

// Deliberate deviation from the design system: the sections use native
// `<details>`/`<summary>` rather than the Collapsible/Accordion components.
// Those are client components, while this sidebar is an async server component
// that awaits the docs content from the filesystem, so adopting them would
// force a client boundary and ship the nav's data through it for a purely
// static open/closed toggle.
export async function DocsSidebar({
  locale,
  currentSlug,
}: {
  locale: string
  currentSlug: string
}) {
  const t = await getTranslations("dashboard.docs")
  return (
    <nav
      aria-label={t("index.title")}
      className="hidden w-56 shrink-0 lg:block"
    >
      <ul className="space-y-1">
        {
          await Promise.all(
            DOCS_NAV.map(async (section) => {
              const docs = await Promise.all(
                section.pages.map((slug) => getDoc(locale, slug))
              )
              const isCurrent = section.pages.includes(currentSlug)
              return (
                <li key={section.section}>
                  <details open={isCurrent}>
                    <summary className="cursor-pointer py-1.5 font-medium text-sm">
                      {t(
                        SECTION_LABEL_KEYS[
                          section.section as keyof typeof SECTION_LABEL_KEYS
                        ]
                      )}
                    </summary>
                    <ul className="mt-1 space-y-0.5 border-border border-l pl-3">
                      {docs.map(
                        (doc) =>
                          doc && (
                            <li key={doc.slug}>
                              <Link
                                href={`/docs/${doc.slug}`}
                                className={`block py-1 text-sm ${
                                  doc.slug === currentSlug
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {doc.frontmatter.title}
                              </Link>
                            </li>
                          )
                      )}
                    </ul>
                  </details>
                </li>
              )
            })
          )
        }
      </ul>
    </nav>
  )
}
