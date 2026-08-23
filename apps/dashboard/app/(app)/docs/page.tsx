import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { AssistantPrompt } from "@/components/assistant/assistant-prompt"
import { DOCS_SUGGESTION_POOL } from "@/lib/assistant-suggestions"
import { getDoc } from "@/lib/docs/docs"
import { DOCS_NAV, POPULAR_DOCS, SECTION_LABEL_KEYS } from "@/lib/docs/docs-nav"

// The small uppercase label that opens each band of this page. Editorial
// vocabulary the rest of the app does not use, deliberately: the guide is a
// publication, and its bands are named quietly above the content rather than
// titled like the rest of the app. One constant, used by all three.
const EYEBROW = "text-muted-foreground text-xs uppercase tracking-widest"

// The hero band. It reserves most of the first screen and centres its content
// in what it reserved, the way the overview's own hero does: the prompt has to
// land near the middle of the viewport, because a question sitting just under
// the header reads as a page title with an input under it, not as the page
// asking the reader what they need.
//
// Deliberately a share of the first screen rather than all of it (the
// overview's PAGE_MIN_H takes the whole thing): the popular guides have to
// stay visible below the fold, or nothing tells the reader the page continues.
// svh, not vh, so a mobile browser's own chrome cannot lie about the height,
// and -3rem is the site header above this column.
const HERO =
  "flex min-h-[calc(62svh-3rem)] flex-col justify-center md:min-h-[calc(68svh-3rem)]"

// The guide's front door: a centered hero that asks the reader's question and
// hands them the assistant, then the two ways into the corpus (a short list of
// the guides most people need first, then everything by section).
//
// The hero is deliberately the page's whole first impression rather than a
// title band, because the assistant answers a question faster than any nav
// can: the reader who knows what they want types it, and the reader who does
// not scrolls into the guides below.
export default async function DocsIndexPage() {
  const locale = await getLocale()
  const t = await getTranslations("dashboard.docs")
  const popular = (
    await Promise.all(POPULAR_DOCS.map((slug) => getDoc(locale, slug)))
  ).filter((doc) => doc !== null)
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <div className={HERO}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={EYEBROW}>{t("index.title")}</p>
          {/* Deliberate deviation from the breadcrumb-title norm: the guide is a reading
              surface, so its front door opens in the app's display serif at
              hero scale, the same voice the overview's greeting uses. The
              serif is a single-weight family; never add a bold utility here,
              the browser would synthesize a faux bold. Size carries it. */}
          <h1 className="mt-3 font-serif text-3xl md:text-4xl">
            {t("index.heading")}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground leading-relaxed">
            {t("index.intro")}
          </p>
          <div className="mt-8">
            {/* The guide's own chips, and the one-row pill: here the prompt
                is a way INTO an answer, not the page's working surface. */}
            <AssistantPrompt
              align="center"
              size="sm"
              suggestions={DOCS_SUGGESTION_POOL}
            />
          </div>
        </div>
      </div>
      <section>
        {/* The band labels stay real headings under the EYEBROW styling, so
            restyling them as eyebrows costs the page nothing in its outline:
            a screen reader still finds both bands where it did before. Only
            the hero's own label above the h1 is a plain <p>, because it names
            the page rather than a section of it. */}
        <h2 className={EYEBROW}>{t("index.popular")}</h2>
        {/* A hairline grid: the cells carry their own right and bottom rules
            and the container closes the top and left, so the figure stays
            correct when the last row is short (five guides in two columns).
            The alternative idiom, a bg-border container showing through
            gap-px, paints the empty cell of an incomplete row as a solid
            block, which is exactly the case here. */}
        {/* Two columns, where the same grid elsewhere takes three: this page
            is capped at max-w-4xl, so the grid is never wider than 896px, and
            our frontmatter descriptions are full sentences. Three columns
            there is a 298px cell wrapping every description to four lines.
            No wide-screen third column for the same reason: the cap, not the
            viewport, is what limits this grid. */}
        <div className="mt-4 grid border-border border-t border-l sm:grid-cols-2">
          {popular.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="border-border border-r border-b p-5 transition-colors hover:bg-accent"
            >
              <span className="block font-medium text-sm">
                {doc.frontmatter.title}
              </span>
              <span className="mt-1 block text-muted-foreground text-sm">
                {doc.frontmatter.description}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-16">
        <h2 className={EYEBROW}>{t("index.browse")}</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {
            await Promise.all(
              DOCS_NAV.map(async (section) => {
                const docs = (
                  await Promise.all(section.pages.map((s) => getDoc(locale, s)))
                ).filter((doc) => doc !== null)
                return (
                  <div key={section.section}>
                    <h3 className="font-medium text-sm">
                      {t(
                        SECTION_LABEL_KEYS[
                          section.section as keyof typeof SECTION_LABEL_KEYS
                        ]
                      )}
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {docs.map((doc) => (
                        <li key={doc.slug}>
                          <Link
                            href={`/docs/${doc.slug}`}
                            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                          >
                            {doc.frontmatter.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })
            )
          }
        </div>
      </section>
    </div>
  )
}
