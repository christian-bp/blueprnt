"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { criteriaLibraryContent } from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  type DimensionKey,
} from "@workspace/core"
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
import { ChapterStatusAlert } from "@/components/model/chapter-status-alert"
import { CriterionComplianceDialog } from "@/components/model/criterion-compliance-dialog"
import { DimensionFrame } from "@/components/model/dimension-frame"
import { PlacedCriterionCard } from "@/components/model/placed-criterion-card"
import { WorkingConditionsEmptyColumn } from "@/components/model/working-conditions-empty-column"
import { useOrganization } from "@/components/org-context"
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
  // The method content READS for every member (the chapter's own query is an
  // orgQuery), but documenting a criterion and approving one are both
  // adminMutations. An editor therefore reads the cards, the statuses and the
  // flags, and exports the appendix, without being offered the one control
  // that would change any of it: the same split the approval card draws.
  const { role } = useOrganization()
  const isAdmin = role === "admin"
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

  if (data === undefined)
    return <MethodPanelSkeleton orgId={orgId} isAdmin={isAdmin} />
  if (data === null) return null // no model yet; keep layout stable

  const target =
    targetId === null
      ? null
      : (data.criteria.find((c) => c.criterionId === targetId) ?? null)

  // Mirrors the Viktning chapter's budget block through the same
  // ChapterStatusAlert: a check + neutral tint when the model is fully
  // approved, an amber heads-up while documentation is still outstanding.
  const allApproved =
    data.progress.total > 0 && data.progress.approved === data.progress.total

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
      <ChapterStatusAlert
        ok={allApproved}
        title={
          <>
            {t("documented", {
              documented: data.progress.documented,
              total: data.progress.total,
            })}
            {" · "}
            {t("approved", {
              approved: data.progress.approved,
              total: data.progress.total,
            })}
          </>
        }
        actions={<MethodAppendixDownload orgId={orgId} />}
      />
      {data.criteria.length === 0 ? (
        // Never a bare page: the chapter has nothing to document until the
        // first one has been chosen, and it says so with the way back. The
        // status block above stays: 0/0 is an honest reading of this state,
        // and it is where the appendix export lives.
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
                        // The dialog behind this action is a write surface end to
                        // end (the protokoll form, the bias review and the
                        // per-criterion approve), so an editor is not offered its
                        // entry point at all. The status badge beside it still
                        // says where the criterion stands, and the appendix
                        // export above carries the documented text itself.
                        onDocument: isAdmin
                          ? () => setTargetId(criterion.criterionId)
                          : undefined,
                      }}
                    />
                  ))}
                </AnimatePresence>
              </DimensionSection>
            )
          })}
        </div>
      )}
      {/* Not mounted at all for an editor: with no way to open it there is
          nothing for it to do, and a write form on the page is a write form on
          the page. */}
      {isAdmin && (
        <CriterionComplianceDialog
          orgId={orgId}
          target={target}
          onClose={() => setTargetId(null)}
        />
      )}
    </div>
  )
}

// One dimension's column: its name over the cards chosen for it. Shared by the
// loaded chapter and its skeleton, so the heading's box and the gap between
// cards are one decision and the two states cannot measure differently.
function DimensionSection({
  title,
  children,
  empty,
}: {
  title: string
  // The dimension's cards, as list ITEMS: the section owns the <ul>, so a card
  // cannot end up an orphan <li> in whichever state mounted it.
  children?: ReactNode
  // What stands in for the list where the dimension holds nothing: today only
  // the fourth column's explanation of its own emptiness. It REPLACES the
  // list rather than sitting beside it, because an empty <ul> is a list a
  // screen reader still announces.
  empty?: ReactNode
}) {
  return (
    // The same dashed frame every chapter draws its dimensions in. No share
    // figure beside the name, unlike the Viktning heading: this chapter
    // neither sets nor reads the weighting.
    <DimensionFrame
      heading={<h3 className="truncate font-medium text-sm">{title}</h3>}
    >
      {empty ?? <ul className="space-y-2">{children}</ul>}
    </DimensionFrame>
  )
}

// The chapter's loading state: the real status block over the real dimension
// columns, with placeholder cards inside them. The four dimensions are fixed
// method law (ADR-0021) and their names are locale-keyed library constants, so
// they never wait on org data; how many criteria each holds, and everything on
// a card, is exactly what is being waited for.
function MethodPanelSkeleton({
  orgId,
  isAdmin,
}: {
  orgId: string
  isAdmin: boolean
}) {
  const locale = useLocale()
  const content = criteriaLibraryContent(locale)
  return (
    <div className="space-y-4">
      {/* Reuse the real status block (with its icon) and skeleton only the
          not-yet-known counts, so the toolbar height is identical to the
          loaded state and the columns below do not shift. ok=undefined is the
          "not yet known" state: the info icon, no tint. */}
      <ChapterStatusAlert
        ok={undefined}
        title={<Skeleton className="h-5 w-52" />}
        // The real download button (static chrome): it loads its own data and
        // disables itself until ready.
        actions={<MethodAppendixDownload orgId={orgId} />}
      />
      <div className={CHAPTER_GRID_CLASS}>
        {DIMENSION_KEYS.map((key) => (
          <DimensionSection key={key} title={content.dimensions[key].name}>
            {/* Two placeholder cards, or the dimension's own cap where that is
                lower, so the fourth column never promises a second criterion
                the model cannot hold. */}
            {Array.from({ length: SKELETON_CARDS[key] }, (_, card) => (
              <MethodCardSkeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
                key={card}
                isAdmin={isAdmin}
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
function MethodCardSkeleton({ isAdmin }: { isAdmin: boolean }) {
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
        {isAdmin && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            className="pointer-events-none text-muted-foreground/50"
          >
            {t("openCta")}
          </Button>
        )}
      </ItemFooter>
    </Item>
  )
}
