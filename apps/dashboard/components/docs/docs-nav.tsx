"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { InnerSidebar } from "@/components/inner-sidebar"
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

const DOCS_PREFIX = "/docs/"

// The guide navigation's section tree. Replaces the native
// <details>/<summary> this surface used to use: that shipped the browser's own
// disclosure triangle, which no amount of styling makes match the app, and it
// could not animate. A chevron rotating 90 degrees is the app's one disclosure
// idiom (see accordion-section.tsx), so both surfaces read the same.
//
// Muted rather than brand: brand is for links, CTAs, judgement values and data
// viz, and twelve rose chevrons stacked in a nav column shout over the page.
export function DocsNav({ sections }: { sections: DocsNavSection[] }) {
  const pathname = usePathname()
  const currentSlug = pathname.startsWith(DOCS_PREFIX)
    ? pathname.slice(DOCS_PREFIX.length)
    : ""
  const currentSection = sections.find((section) =>
    section.pages.some((page) => page.slug === currentSlug)
  )?.section
  // Sections the reader opened or closed by hand, overriding the
  // current-section default. This state is why the nav lives in a layout: it
  // has to outlive a navigation between guides, and a per-page render would
  // reset it on every click.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  return (
    <ul className="space-y-0.5">
      {sections.map((section) => {
        const open =
          overrides[section.section] ?? section.section === currentSection
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
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
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
  )
}

// The docs surface's frame: the nav column beside the guide. Unlike the
// assistant's conversations panel this one does NOT collapse. The guide nav is
// the only navigation a reading surface has, so hiding it buys a reader
// nothing: the article beside it is capped at max-w-3xl and would not use the
// reclaimed width. That is also why there is no open state, no persistence and
// no expand affordance here.
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
        open
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
          <Link
            href="/docs"
            aria-current={atIndex ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 font-medium text-foreground text-sm hover:bg-accent hover:text-accent-foreground",
              atIndex && "bg-accent"
            )}
          >
            <span className="truncate">{t("index.title")}</span>
          </Link>
        }
      >
        <DocsNav sections={sections} />
      </InnerSidebar>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
