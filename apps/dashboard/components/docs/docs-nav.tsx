"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { PAGE_PADDING } from "@/components/app-shell"
import { InnerSidebar } from "@/components/inner-sidebar"
import { TableSearchField } from "@/components/table-search-field"
import { matchScore } from "@/lib/command-palette"
import { SPRING } from "@/lib/motion"

export interface DocsNavPage {
  slug: string
  title: string
}

export interface DocsNavSection {
  section: string
  label: string
  pages: DocsNavPage[]
}

// The nav's own filter. Exported for its own test, because this is where a nav
// search actually goes wrong: a section kept on screen with nothing left in
// it, or a match lost because the reader typed "lonekartlaggning" for a page
// called "Lönekartläggning".
//
// Matching goes through the command palette's matchScore rather than a second
// normalizer, so one folding rule serves the whole docs surface: it lowercases,
// transliterates the Nordic letters and keeps word boundaries, and it is
// order-insensitive across tokens.
//
// A section whose own LABEL matches keeps ALL of its pages: a reader typing
// "roller" wants that whole part of the guide, not just the pages that happen
// to repeat the word in their title.
export function filterSections(
  sections: DocsNavSection[],
  query: string
): DocsNavSection[] {
  if (query.trim() === "") return sections
  return sections
    .map((section) => ({
      ...section,
      pages:
        matchScore(query, section.label) > 0
          ? section.pages
          : section.pages.filter((page) => matchScore(query, page.title) > 0),
    }))
    .filter((section) => section.pages.length > 0)
}

// The guide navigation's section tree. A chevron rotating 90 degrees is the
// app's one disclosure idiom (see accordion-section.tsx), so both surfaces
// read the same.
//
// Muted rather than brand: brand is for links, CTAs, judgement values and data
// viz, and twelve rose chevrons stacked in a nav column shout over the page.
export function DocsNav({ sections }: { sections: DocsNavSection[] }) {
  const t = useTranslations("dashboard.docs.nav")
  const pathname = usePathname()
  const currentSlug = pathname.startsWith("/docs/")
    ? pathname.slice("/docs/".length)
    : ""
  const currentSection = sections.find((section) =>
    section.pages.some((page) => page.slug === currentSlug)
  )?.section
  // Sections the reader opens or closes by hand. This state is why the nav
  // lives in a layout: it has to outlive a navigation between guides, and a
  // per-page render would reset it on every click. A manual toggle governs
  // every other section; the section containing the current page is always
  // open, so entering it by a route the nav did not drive (back/forward, the
  // guide index, a footer link) never hides the page being read.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState("")
  const searching = query.trim() !== ""
  const filtered = filterSections(sections, query)

  return (
    <>
      {/* Sticky rather than scrolling away with the tree: the corpus is 56
          pages under thirteen sections, so the list this field filters is
          taller than the column, and a filter you have to scroll back up to
          reach is one the reader stops using. The fill is what keeps the rows
          from showing through as they pass under it.
          pt-2 is not spacing, it is room for the FOCUS RING: the scroll
          container this sits in carries no padding of its own at the top, and
          a scroll container clips at its padding box, so a field flush against
          that edge loses the 3px ring along its whole top edge (which reads as
          two clipped corners). The padding belongs on this sticky element
          rather than on the scroller, because sticky pins to the scrollport:
          padding on the scroller would scroll away and take the room with it. */}
      <div className="sticky top-0 z-10 bg-background py-2">
        <TableSearchField
          className="w-full"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={setQuery}
        />
      </div>
      {filtered.length === 0 ? (
        // One muted line, not NoMatchesEmpty: that block carries a title, a
        // description and a clear button, which is a page-sized answer inside
        // a 280px column whose own field is right above it.
        <p className="px-2 py-6 text-center text-muted-foreground text-sm">
          {t("noMatches")}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {filtered.map((section) => {
            // While filtering, a section defaults to OPEN so the matches are
            // visible without a click, but an explicit toggle still wins:
            // `searching` is the default the override falls back to, not an
            // override of its own. The section holding the current page stays
            // open either way, as it does with no query.
            const open =
              section.section === currentSection ||
              (overrides[section.section] ?? searching)
            return (
              <li key={section.section}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setOverrides((previous) => ({
                      ...previous,
                      [section.section]: !open,
                    }))
                  }
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-medium text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2}
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                      open && "rotate-90"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {section.label}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="pages"
                      // Carries ONLY geometry, never padding or a border
                      // (docs/ui-animation.md #2): a border-box element with
                      // padding never reaches a true height of 0, so the collapse
                      // would stall and the unmount would jump.
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={SPRING}
                      className="overflow-hidden"
                    >
                      <ul className="mt-1 ml-4 space-y-0.5 border-border border-l pl-3">
                        {section.pages.map((page) => {
                          const isCurrent = page.slug === currentSlug
                          return (
                            <li key={page.slug}>
                              <Link
                                href={`/docs/${page.slug}`}
                                aria-current={isCurrent ? "page" : undefined}
                                className={cn(
                                  "block rounded-md px-2 py-1 text-sm",
                                  isCurrent
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {page.title}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// The docs surface's frame: the nav column beside the guide. Its open state is
// derived from the ROUTE, never from the reader: closed on the guide's index,
// open inside a guide.
//
// Closed on the index because that page IS the navigation (a hero that answers
// questions directly, the popular guides, then every section listed); the
// column beside it would be the same links a second time, and it would push
// the page's centred hero off the pane's centre. Inside a guide the column is
// the only navigation on screen, so it opens and stays open: unlike the
// assistant's conversations panel this one carries no collapse control, since
// hiding it would buy a reader nothing (the article is capped at max-w-3xl and
// would not use the reclaimed width). Hence no persistence and no expand
// affordance either, only the route.
//
// `children` is the server-rendered page, passed straight through as a slot.
export function DocsNavPanel({
  sections,
  children,
}: {
  sections: DocsNavSection[]
  children: ReactNode
}) {
  const t = useTranslations("dashboard.docs")
  const pathname = usePathname()
  const atIndex = pathname === "/docs"

  return (
    <div className="flex w-full flex-1">
      <InnerSidebar
        open={!atIndex}
        label={t("nav.label")}
        // The docs route is NOT height-locked: the page scrolls, so the column
        // pins itself instead of filling a locked parent.
        height="sticky"
        // Today's `hidden lg:block` treatment, preserved deliberately: a
        // permanent 280px column on a 375px viewport is worse than no column,
        // and small screens still reach every guide through the /docs index's
        // own "All guides" grid. A real mobile treatment is a sheet (what the
        // app sidebar itself does), not a narrower default here.
        className="hidden lg:flex"
        // The way back to the top level from anywhere in the guide. It reuses
        // the index's own title rather than introducing a key, since that
        // string already names this destination in every locale.
        actions={
          // No current-page treatment: this link's own destination is the one
          // route where the column does not render at all, so it can never be
          // the current page while it is on screen.
          <Link
            href="/docs"
            className="flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 font-medium text-foreground text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <span className="truncate">{t("index.title")}</span>
          </Link>
        }
      >
        <DocsNav sections={sections} />
      </InnerSidebar>
      {/* The page padding the shell does not apply on this route (app-shell.tsx:
          hasInnerSidebar), so the nav column beside this one stays flush. */}
      <div className={cn("min-w-0 flex-1", PAGE_PADDING)}>{children}</div>
    </div>
  )
}
