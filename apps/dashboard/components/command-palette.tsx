"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { useDocsIndex } from "@/hooks/use-docs-index"
import {
  filterItems,
  guideItems,
  type PaletteItem,
  pageItems,
  sectionItems,
} from "@/lib/command-palette"

// How many guide and heading rows one group may show. Pages are a short,
// bounded registry and stay complete; the guide corpus is 56 pages and 330
// headings, and a list nobody scrolls to the end of is noise rather than an
// answer. Ranking puts the best rows first, so the cap only ever removes
// weaker matches.
const DOC_RESULT_LIMIT = 8

// The widths of the placeholder rows shown while the guide index is in
// flight. Three rows rather than DOC_RESULT_LIMIT: the placeholder says "the
// guides are still coming", and eight identical bars in a 288px list say it
// no better than three while filling the whole dialog. Uneven widths so the
// block reads as titles rather than as a table.
const GUIDE_SKELETON_WIDTHS = ["w-48", "w-64", "w-40"]

// The return-key glyph. It is the key's engraving rather than a word, so it is
// the same in every locale; the key's NAME is translated and rides on the
// element's aria-label, because "↵" read aloud is nothing at all.
const ENTER_GLYPH = "↵"

// The guides group while its index loads. Shaped like the rows it stands in
// for (the same icon slot, the same px-2 py-1.5 box) and carrying the group's
// real heading, so the arriving rows land where the bars were instead of
// pushing the list around. The bar sits in a min-h-5 line box because the real
// row is sized by a text-sm line, not by its 16px icon.
function GuideResultsSkeleton(props: { heading: string }) {
  return (
    <CommandGroup heading={props.heading}>
      {GUIDE_SKELETON_WIDTHS.map((width) => (
        <div
          key={width}
          aria-hidden="true"
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <div className="flex min-h-5 items-center">
            <Skeleton className="size-4 rounded-sm" />
          </div>
          <div className="flex min-h-5 items-center">
            <Skeleton className={`h-4 ${width}`} />
          </div>
        </div>
      ))}
    </CommandGroup>
  )
}

// Navigation only, and deliberately so: the palette answers "where is X",
// never "do X". Matching is plain client-side text over page names, guide
// titles and headings (lib/command-palette.ts). It is NOT the assistant's
// semantic search, which costs an embedding call per query; a keystroke-rate
// surface has to answer from what is already in the browser.
export function CommandPalette(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dashboard")
  const router = useRouter()
  const { role } = useOrganization()
  const [query, setQuery] = useState("")
  // The guide index is only fetched once the palette has been opened; until
  // then the palette costs a session nothing at all.
  const index = useDocsIndex(props.open)
  // Undefined is "not known yet", and it has to stay distinguishable from an
  // index that arrived empty: guides and headings are the overwhelming
  // majority of the rows, so collapsing the two would answer nearly every
  // query with a confident "nothing matches" while the request is in flight.
  const loading = index === undefined

  const pages = useMemo(() => pageItems(role, (key) => t(key)), [role, t])
  const guides = useMemo(() => guideItems(index ?? []), [index])
  const sections = useMemo(() => sectionItems(index ?? []), [index])

  const results = useMemo(
    () => ({
      pages: filterItems(pages, query, pages.length),
      guides: filterItems(guides, query, DOC_RESULT_LIMIT),
      // Sections are suppressed until the user types. Pages and guides both
      // read as a table of contents when unfiltered, but an arbitrary eight
      // headings out of the corpus's several hundred answer nothing: the
      // opening view offered "Land" and "Bransch" as standing suggestions.
      sections:
        query.trim() === ""
          ? []
          : filterItems(sections, query, DOC_RESULT_LIMIT),
    }),
    [pages, guides, sections, query]
  )
  const total =
    results.pages.length + results.guides.length + results.sections.length

  const close = (open: boolean) => {
    props.onOpenChange(open)
    // The next open starts from a clean slate rather than from whatever the
    // last visit was looking for.
    if (!open) setQuery("")
  }

  const go = (href: string) => {
    close(false)
    router.push(href)
  }

  const group = (heading: string, items: PaletteItem[]) =>
    items.length === 0 ? null : (
      <CommandGroup heading={heading}>
        {items.map((item) => (
          <CommandItem
            key={item.key}
            value={item.key}
            onSelect={() => go(item.href)}
          >
            <HugeiconsIcon icon={item.icon} strokeWidth={2} />
            <span className="min-w-0 truncate">{item.label}</span>
            {item.detail === undefined ? null : (
              // The vendor row ends in a selection tick that is permanently
              // invisible here, and it carries an ml-auto of its own: two auto
              // margins split the free space between them, so the detail
              // landed at a different x on every row. data-slot is the row's
              // own escape hatch, which both suppresses the tick and leaves
              // this the only auto margin, so every detail ends at the same
              // right edge. The typography stays ours: a page title is not a
              // keyboard chord, so it takes no letter-spacing.
              <span
                data-slot="command-shortcut"
                className="ml-auto min-w-0 truncate pl-4 text-muted-foreground text-xs"
              >
                {item.detail}
              </span>
            )}
          </CommandItem>
        ))}
      </CommandGroup>
    )

  return (
    <CommandDialog
      open={props.open}
      onOpenChange={close}
      title={t("commandPalette.title")}
      description={t("commandPalette.description")}
      // Two deviations from the dialog defaults, both measured in the browser
      // rather than guessed. sm:max-w-md is too narrow: a result row is a name
      // plus the guide or section it sits in, and at the default width the
      // second half is truncated away on most rows. gap-0 removes the dialog
      // grid's 24px row gap, which sat between the scrolling list and the
      // footer hint and read as a band of dead space under a half-clipped row.
      // The list keeps the Command box's own 4px padding off the footer rule.
      className="gap-0 sm:max-w-xl"
    >
      {/* cmdk's own filter is off: ours folds diacritics (so "nivaer" finds
          "Nivåer"), ranks a name hit above a description hit, and caps each
          guide group, none of which the built-in scorer does. */}
      <Command
        shouldFilter={false}
        loop
        // cmdk renders this into the hidden label the input points at with
        // aria-labelledby; without it the input is named by an empty element.
        label={t("commandPalette.title")}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("commandPalette.placeholder")}
        />
        {/* cmdk's default list label is the English "Suggestions", which a
            screen reader would read out verbatim in every locale. */}
        <CommandList label={t("commandPalette.results")}>
          {total === 0 && !loading ? (
            <CommandEmpty>{t("commandPalette.empty")}</CommandEmpty>
          ) : null}
          {group(t("commandPalette.groups.pages"), results.pages)}
          {loading ? (
            <GuideResultsSkeleton heading={t("commandPalette.groups.guides")} />
          ) : (
            <>
              {group(t("commandPalette.groups.guides"), results.guides)}
              {group(t("commandPalette.groups.sections"), results.sections)}
            </>
          )}
        </CommandList>
      </Command>
      {/* Sibling of the Command, not of the list: CommandDialog renders its
          children straight into the dialog content, so the hint sits below the
          scrolling list instead of scrolling away with it. */}
      <div className="flex items-center gap-2 border-t px-3 py-2 text-muted-foreground text-xs">
        <Kbd aria-label={t("commandPalette.enterKey")}>{ENTER_GLYPH}</Kbd>
        <span>{t("commandPalette.goToPage")}</span>
      </div>
    </CommandDialog>
  )
}
