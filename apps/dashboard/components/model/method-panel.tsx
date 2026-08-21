"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { criteriaLibraryContent } from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  type DimensionKey,
} from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Item, ItemContent, ItemFooter } from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { AnimatePresence } from "motion/react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { CHAPTER_GRID_CLASS } from "@/components/model/chapter-grid"
import { ChapterFraming } from "@/components/model/chapter-framing"
import { CriterionComplianceDialog } from "@/components/model/criterion-compliance-dialog"
import { DimensionFrame } from "@/components/model/dimension-frame"
import { PlacedCriterionCard } from "@/components/model/placed-criterion-card"
import {
  WorkingConditionsColumnSkeleton,
  WorkingConditionsEmptyColumn,
} from "@/components/model/working-conditions-empty-column"
import { chapterHref } from "@/lib/model-chapters"

// How many placeholder cards a dimension's column stands up while the model
// loads: two, or the dimension's own cap where that is lower.
const SKELETON_CARDS: Record<DimensionKey, number> = Object.fromEntries(
  DIMENSION_KEYS.map((key) => [key, Math.min(2, DIMENSION_MAX_ACTIVE[key])])
) as Record<DimensionKey, number>

const MethodAppendixDownload = dynamic(
  () =>
    import("@/components/pdf/method-appendix-download").then(
      (m) => m.MethodAppendixDownload
    ),
  { ssr: false }
)

// The Metod chapter: each criterion's rationale and bias review.
//
// The same dimension columns the Kriterier and Viktning chapters draw, on the
// same CHAPTER_GRID_CLASS, so a criterion stays where the reader last saw it
// through all three chapters. What the card carries is this chapter's decision
// and nothing else: where the documentation stands, whether an overlap is still
// unreviewed, and the way into the dialog that answers both. The weight share
// is deliberately absent, here and from the headings: it is Viktning's lens,
// and a figure repeated on a chapter that cannot change it is a second reading
// of one allocation.
export function MethodPanel({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.method")
  const locale = useLocale()
  const data = useQuery(api.evaluationModel.method.getMethodModel, {
    orgId,
    locale,
  })
  // The ENGINE's unacknowledged overlap pairs, from the same query the section's
  // spine and the Godkännande checklist already subscribe to. Never a second
  // derivation of the rule: a pair reads acknowledged once EITHER member carries
  // an overlap note, and a surface that re-implemented that would eventually
  // flag a criterion the gate considers done.
  const checks = useQuery(api.evaluationModel.approval.getMethodChecks, {
    orgId,
  })

  const [targetId, setTargetId] = useState<Id<"criteria"> | null>(null)

  // The library's own content, in the reader's language: the dimension names
  // the columns are titled by and each criterion's one-liner. Read here rather
  // than added to the chapter's wire because the loading state needs the same
  // names before any data has arrived, and one source is what keeps the
  // skeleton's headings and the loaded chapter's from drifting.
  const content = criteriaLibraryContent(locale)

  if (data === undefined) return <MethodPanelSkeleton orgId={orgId} />
  if (data === null) return null // no model yet; keep layout stable

  const target =
    targetId === null
      ? null
      : (data.criteria.find((c) => c.criterionId === targetId) ?? null)

  const unacknowledgedPairs =
    checks?.checks.find((check) => check.key === "overlapPairs")?.pairs ?? []
  // Keyed by plain string, not the strict library union: the pairs come off the
  // wire as strings, and narrowing them back only to look up a name would be
  // ceremony for nothing.
  const nameByLibraryKey = new Map<string, string>(
    data.criteria.map((criterion) => [criterion.libraryKey, criterion.name])
  )
  // The criteria this one still has an unreviewed overlap against, by name.
  function unreviewedPartners(libraryKey: string): string[] {
    const names: string[] = []
    for (const pair of unacknowledgedPairs) {
      // Two-string arrays over the wire, not tuples (a Convex array validator
      // cannot express a fixed length), so the members are read defensively.
      const [first, second] = pair
      if (first === undefined || second === undefined) continue
      const partner =
        first === libraryKey
          ? second
          : second === libraryKey
            ? first
            : undefined
      if (partner === undefined) continue
      const name = nameByLibraryKey.get(partner)
      if (name !== undefined) names.push(name)
    }
    return names
  }

  return (
    <div className="space-y-4">
      {/* The chapter's only chrome above the grid, so its columns begin at the
          same height as every other chapter's and switching tabs holds them
          still. The progress that used to stand in a block of its own here is
          in the columns now, one count per dimension, where the criteria it
          counts actually are. */}
      <ChapterFraming action={<MethodAppendixDownload orgId={orgId} />} />
      {data.criteria.length === 0 ? (
        // Never a bare page: the chapter has nothing to document until the
        // first one has been chosen, and it says so with the way back. The
        // framing row above stays: it is the chapter's own sentence, and it is
        // where the appendix export lives.
        <p className="text-muted-foreground text-sm">
          {t.rich("empty", {
            link: (chunks) => (
              <Link
                href={chapterHref("criteria")}
                className="text-brand underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        <div className={CHAPTER_GRID_CLASS}>
          {DIMENSION_KEYS.map((key) => {
            const placed = data.criteria.filter(
              (criterion) => criterion.dimensionKey === key
            )
            const isWorkingConditions = key === "workingConditions"
            // A dimension the model holds nothing in has nothing to document,
            // so it draws no column at all (the same rule the Viktning chapter
            // follows; choosing a criterion for it is the Kriterier
            // chapter's). The fourth is the exception, because its emptiness
            // can be the finished answer rather than a gap, and the column
            // itself says which.
            if (placed.length === 0 && !isWorkingConditions) return null
            return (
              <DimensionSection
                key={key}
                title={content.dimensions[key].name}
                // APPROVED, not merely documented: it is the count the spine's
                // own method segment moves on (the engine's
                // documentationComplete check reads a criterion as done only
                // once it carries an explicit sign-off), and a column chip
                // that counted filled-in forms would run ahead of the bar
                // above it.
                approved={
                  placed.filter((criterion) => criterion.status === "approved")
                    .length
                }
                total={placed.length}
                empty={
                  placed.length === 0 ? (
                    // Only ever the fourth column, and the decision rides the
                    // checks query this chapter already subscribes to.
                    <WorkingConditionsEmptyColumn
                      decision={checks?.workingConditions}
                    />
                  ) : undefined
                }
              >
                {/* Nothing on this chapter adds or removes a criterion, but the
                  model is a live query: a criterion removed on the Kriterier
                  chapter, or in another tab, still leaves this column.
                  popLayout takes it out of flow at once so the cards under it
                  close the gap in one pass rather than waiting out the fade
                  (ui-animation.md rules 3 and 6), and initial={false} keeps
                  arriving on the page from animating. */}
                <AnimatePresence initial={false} mode="popLayout">
                  {placed.map((criterion) => (
                    <PlacedCriterionCard
                      key={criterion.criterionId}
                      criterion={{
                        criterionId: criterion.criterionId,
                        name: criterion.name,
                        shortUiText:
                          content.criteria[criterion.libraryKey].shortUiText,
                      }}
                      documentation={{
                        status: criterion.status,
                        partners: unreviewedPartners(criterion.libraryKey),
                        onDocument: () => setTargetId(criterion.criterionId),
                      }}
                    />
                  ))}
                </AnimatePresence>
              </DimensionSection>
            )
          })}
        </div>
      )}
      <CriterionComplianceDialog
        orgId={orgId}
        target={target}
        onClose={() => setTargetId(null)}
      />
    </div>
  )
}

// One dimension's column: its name over the cards chosen for it. Shared by the
// loaded chapter and its skeleton, so the heading's box and the gap between
// cards are one decision and the two states cannot measure differently.
function DimensionSection({
  title,
  approved,
  total,
  children,
  empty,
}: {
  title: string
  // The dimension's own documentation count, for the heading's chip. Absent
  // while the model loads, where the count is precisely what is unknown.
  approved?: number
  total?: number
  // The dimension's cards, as list ITEMS: the section owns the <ul>, so a card
  // cannot end up an orphan <li> in whichever state mounted it.
  children?: ReactNode
  // What stands in for the list where the dimension holds nothing: today only
  // the fourth column's explanation of its own emptiness. It REPLACES the
  // list rather than sitting beside it, because an empty <ul> is a list a
  // screen reader still announces.
  empty?: ReactNode
}) {
  const t = useTranslations("dashboard.model.method")
  return (
    // The same dashed frame every chapter draws its dimensions in. No share
    // figure beside the name, unlike the Viktning heading: this chapter
    // neither sets nor reads the weighting.
    <DimensionFrame
      heading={
        <>
          <h3 className="truncate font-medium text-sm">{title}</h3>
          {/* The count opposite the name, in the slot the Kriterier column
              puts its own chip in, and filling in the way that one does when
              its dimension is done: a column whose criteria are all approved
              has nothing left to ask for. A dimension holding nothing shows no
              chip at all, because 0 of 0 is not progress, it is the empty
              state the column below already explains. */}
          {approved === undefined || total === undefined ? (
            // The count is the data. A pill-shaped bar holds its box while it
            // loads, the same stand-in the Kriterier column's own chip uses.
            <Skeleton className="h-5 w-24 shrink-0 rounded-4xl" />
          ) : (
            total > 0 && (
              <Badge
                variant={approved === total ? "secondary" : "outline"}
                className="shrink-0 tabular-nums"
              >
                {t("approved", { approved, total })}
              </Badge>
            )
          )}
        </>
      }
    >
      {empty ?? <ul className="space-y-2">{children}</ul>}
    </DimensionFrame>
  )
}

// The chapter's loading state: the real framing row over the real dimension
// columns, with placeholder cards inside them. The four dimensions are fixed
// method law (ADR-0021) and their names are locale-keyed library constants, so
// they never wait on org data; how many criteria each holds, its documentation
// count, and everything on a card, is exactly what is being waited for.
function MethodPanelSkeleton({ orgId }: { orgId: string }) {
  const locale = useLocale()
  const content = criteriaLibraryContent(locale)
  return (
    <div className="space-y-4">
      {/* The real framing row: its sentence, its help and its export are all
          chapter chrome rather than data, so the row renders in full and the
          columns below it never move when the model lands. The export button
          loads its own data and disables itself until ready. */}
      <ChapterFraming action={<MethodAppendixDownload orgId={orgId} />} />
      <div className={CHAPTER_GRID_CLASS}>
        {DIMENSION_KEYS.map((key) => (
          <DimensionSection
            key={key}
            title={content.dimensions[key].name}
            // The fourth dimension is as likely to resolve to a sentence over
            // a hatch as to a card, so it waits as a neutral bar rather than
            // as a card that would have to become a paragraph.
            empty={
              key === "workingConditions" ? (
                <WorkingConditionsColumnSkeleton />
              ) : undefined
            }
          >
            {/* Two placeholder cards, or the dimension's own cap where that is
                lower, so a column never promises a second criterion the model
                cannot hold. */}
            {Array.from({ length: SKELETON_CARDS[key] }, (_, card) => (
              <MethodCardSkeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
                key={card}
              />
            ))}
          </DimensionSection>
        ))}
      </div>
    </div>
  )
}

// One placeholder card. The BOX is the real thing: the same Item, variant and
// slots the loaded card is built from, so the two can never measure
// differently, and only what is unknown until the data arrives is a bar. The
// action's label is static i18n text, so it renders as its real button, muted
// and inert.
function MethodCardSkeleton() {
  const t = useTranslations("dashboard.model.method")
  return (
    <Item variant="outline" render={<li aria-hidden="true" />}>
      <ItemContent>
        {/* Line boxes rather than bare bars: ItemTitle and ItemDescription are
            both text-sm (a 20px line), and a bar centred in its own line box is
            what makes the placeholder measure like the text it stands in for.
            The one-liner's two lines sit in ONE block, because ItemContent's
            gap falls between the title and the description, not inside it. */}
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
        <div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </ItemContent>
      <ItemFooter>
        {/* The status pill's box: a Badge is h-5 and pill-shaped. */}
        <Skeleton className="h-5 w-24 rounded-4xl" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          tabIndex={-1}
          className="pointer-events-none text-muted-foreground/50"
        >
          {t("openCta")}
        </Button>
      </ItemFooter>
    </Item>
  )
}
