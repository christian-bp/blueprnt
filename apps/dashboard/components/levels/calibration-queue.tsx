"use client"

import NumberFlow from "@number-flow/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { ConfirmPlacementDialog } from "@/components/levels/confirm-placement-dialog"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SectionTitleRow } from "@/components/section-title-row"
import { DisclosureToggle } from "@/components/disclosure-toggle"
import {
  type CalibrationClass,
  type CalibrationInput,
  type CalibrationRow,
  calibrationClasses,
  calibrationQueue,
} from "@/lib/calibration-queue"

// The calibration queue: the flags the results wire has always carried, turned
// into a list of things a person can do something about.
//
// Every row states its REASON in words, because the three classes are answered
// differently and a row that only said "needs review" would leave the reader to
// work out which of three questions is being asked. The profile-limited class
// names the requirement that held the role back, which is the one place
// profileFailures becomes visible in the product.
//
// Role-level data only: a title, a level, a criterion name and two step
// numbers. Nothing here knows about a person.
export function CalibrationQueue({
  orgId,
  rows,
  modelApproved,
}: {
  orgId: string
  rows: readonly CalibrationInput[]
  // Placement happens under an approved method (ADR-0023). Stated in words
  // rather than by hiding the section, so a reader who expected a queue learns
  // why there is none.
  modelApproved: boolean
}) {
  const t = useTranslations("dashboard.levels.calibration")
  const tHelp = useTranslations("dashboard.help")
  const [target, setTarget] = useState<{
    roleId: Id<"roles">
    title: string
  } | null>(null)

  const queue = calibrationQueue(rows)
  const showQueue = modelApproved && queue.length > 0
  // The ONE condition the whole section reads: the heading's count, the list,
  // and which empty state shows all follow it. Deriving the queue and then
  // gating only the list left the count rendering beside a "not approved yet"
  // message, claiming three things to review on a surface that was showing
  // none. A count is a promise about what is below it.

  return (
    <section className="space-y-3">
      <SectionTitleRow
        help={
          <HelpMorphButton label={tHelp("calibrationLabel")}>
            {tHelp("calibrationBody")}
          </HelpMorphButton>
        }
        heading={
          <span className="flex items-center gap-2">
            {t("heading")}
            {/* A live count: rows leave the queue as they are confirmed, while
                the reader is looking at it, so the number rolls rather than
                swapping (the NumberFlow law). Hidden at zero, where the empty
                state below says it in words instead. */}
            {showQueue && (
              <Badge variant="outline" className="rounded-full tabular-nums">
                <NumberFlow value={queue.length} />
              </Badge>
            )}
          </span>
        }
      />
      {!modelApproved ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("unapprovedTitle")}</EmptyTitle>
            <EmptyDescription>{t("unapprovedDescription")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/model"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("unapprovedCta")}
          </Link>
        </Empty>
      ) : !showQueue ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {calibrationClasses(queue).map((group) => (
            <QueueClass
              key={group.reason}
              group={group}
              onConfirm={(entry) =>
                setTarget({
                  roleId: entry.row.roleId as Id<"roles">,
                  title: entry.row.title,
                })
              }
            />
          ))}
        </div>
      )}
      <ConfirmPlacementDialog
        orgId={orgId}
        target={target}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
      />
    </section>
  )
}

// How many rows of ONE class stand open before the rest go behind a press.
// Small on purpose: the cap exists for the flood case, and a reader who needs
// more than five of one question is going to open it anyway.
const CLASS_CAP = 5

// One class of question, with its own count and its own cap. The heading names
// the class so the three are told apart before any row is read, and the count
// is on the heading rather than only in the section total, because "12 to
// review" splits very differently into "1 placement, 11 stale" than into "12
// placements".
function QueueClass({
  group,
  onConfirm,
}: {
  group: CalibrationClass
  onConfirm: (entry: CalibrationRow) => void
}) {
  const t = useTranslations("dashboard.levels.calibration")
  const tHelp = useTranslations("dashboard.help")
  const tLevels = useTranslations("dashboard.levels")
  const [expanded, setExpanded] = useState(false)
  const hidden = group.rows.length - CLASS_CAP
  const shown = expanded ? group.rows : group.rows.slice(0, CLASS_CAP)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2">
        <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t(`class.${group.reason}`)}
        </h4>
        {/* The profile requirement is a section-14 term this surface
            introduces and never explains: the rows below it read "needs step
            4, this row has 3" to a reader who has not met either idea. Its
            help sits on its own class heading rather than beside the queue's,
            which already carries calibration's: one concept per anchor, and
            never two popovers on one row. */}
        {group.reason === "profileLimited" && (
          <HelpMorphButton label={tHelp("profileRequirementLabel")}>
            {tHelp("profileRequirementBody")}
          </HelpMorphButton>
        )}
        <span className="text-muted-foreground text-xs tabular-nums">
          {tLevels("roleCount", { count: group.rows.length })}
        </span>
      </div>
      <ul className="space-y-2">
        {shown.map((entry) => (
          <QueueRow
            key={entry.row.roleId}
            entry={entry}
            onConfirm={() => onConfirm(entry)}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <DisclosureToggle
          label={expanded ? t("showFewer") : t("showMore", { count: hidden })}
          open={expanded}
          onToggle={() => setExpanded((current) => !current)}
        />
      )}
    </div>
  )
}

function QueueRow({
  entry,
  onConfirm,
}: {
  entry: CalibrationRow
  onConfirm: () => void
}) {
  const t = useTranslations("dashboard.levels.calibration")
  const tLevels = useTranslations("dashboard.levels")
  const { row, reason } = entry
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <Link
            href={`/roles/${row.slug}`}
            className="truncate font-medium text-sm underline-offset-4 hover:underline"
          >
            {row.title}
          </Link>
          {/* Meta rides in a CHIP, not in a sentence and not as loose grey
              text beside the title: the row is a feed row, and a feed row's
              meta is scanned, never read. */}
          {row.level !== null && (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {tLevels("levelRow", { level: row.level })}
            </Badge>
          )}
        </div>
        {/* The reason, in words. Running text, so it floors at text-sm. */}
        <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
          {reason === "profileLimited"
            ? t("profileLimitedReason")
            : reason === "anchorDeviation"
              ? t("anchorDeviationReason", {
                  level: row.level ?? 0,
                  expected: entry.expectedLevel ?? 0,
                })
              : t("staleMethodReason")}
        </p>
        {entry.failures.length > 0 && (
          // WHICH requirement held the role back: the criterion by name, what
          // the zone asked of it, and what the role actually scored. Without
          // these three the sentence above is a verdict with no evidence.
          // Chips rather than a bulleted list of sentences: each is a name and
          // two numbers, which is meta a reader scans, and a role failing
          // three criteria used to stack three full-width lines under one row.
          <ul className="flex flex-wrap gap-1">
            {entry.failures.map((failure) => (
              <li key={failure.criterionId}>
                <Badge variant="outline" className="font-normal">
                  {t("profileLimitedFailure", {
                    name: failure.name,
                    required: failure.required,
                    actual: failure.actual,
                  })}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {reason === "profileLimited" ? (
          // The only class with an act of its own: the placement is what is in
          // question and confirming it is the answer.
          <Button type="button" size="sm" onClick={onConfirm}>
            {t("confirmCta")}
          </Button>
        ) : reason === "staleMethod" ? (
          // Answered by completing the assessment again under the current
          // method, which happens on the role's own assessment.
          <Link
            href={`/roles/${row.slug}/rate`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("rateCta")}
          </Link>
        ) : (
          // An anchor deviation is a question about the MODEL, not a placement
          // to confirm: the answer is on the role, where the agreed level and
          // the assessment both live.
          <Link
            href={`/roles/${row.slug}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("openRoleCta")}
          </Link>
        )}
      </div>
    </li>
  )
}
