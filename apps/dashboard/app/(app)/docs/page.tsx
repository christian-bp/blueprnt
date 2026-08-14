import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { AssistantPrompt } from "@/components/assistant/assistant-prompt"
import { getDoc } from "@/lib/docs/docs"
import { DOCS_NAV, POPULAR_DOCS, SECTION_LABEL_KEYS } from "@/lib/docs/docs-nav"

export default async function DocsIndexPage() {
  const locale = await getLocale()
  const t = await getTranslations("dashboard.docs")
  const popular = (
    await Promise.all(POPULAR_DOCS.map((slug) => getDoc(locale, slug)))
  ).filter((doc) => doc !== null)
  return (
    <div className="mx-auto max-w-4xl pb-16">
      {/* Deliberate deviation from PageHeading: the docs index is a reading
          surface and shares the article pages' editorial title scale, so the
          two look like one publication rather than a page and a document. */}
      <h1 className="font-semibold text-2xl">{t("index.title")}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{t("index.intro")}</p>
      <div className="mt-6 max-w-xl">
        <AssistantPrompt />
      </div>
      <h2 className="mt-12 font-semibold text-lg">{t("index.popular")}</h2>
      <ul className="mt-3 space-y-2">
        {popular.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/docs/${doc.slug}`}
              className="text-brand hover:underline"
            >
              {doc.frontmatter.title}
            </Link>
            <span className="ml-2 text-muted-foreground text-sm">
              {doc.frontmatter.description}
            </span>
          </li>
        ))}
      </ul>
      <h2 className="mt-12 font-semibold text-lg">{t("index.browse")}</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {
          await Promise.all(
            DOCS_NAV.map(async (section) => {
              const docs = (
                await Promise.all(section.pages.map((s) => getDoc(locale, s)))
              ).filter((doc) => doc !== null)
              return (
                <section key={section.section}>
                  <h3 className="font-medium text-sm">
                    {t(
                      SECTION_LABEL_KEYS[
                        section.section as keyof typeof SECTION_LABEL_KEYS
                      ]
                    )}
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {docs.map((doc) => (
                      <li key={doc.slug}>
                        <Link
                          href={`/docs/${doc.slug}`}
                          className="text-muted-foreground text-sm hover:text-foreground"
                        >
                          {doc.frontmatter.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )
        }
      </div>
    </div>
  )
}
