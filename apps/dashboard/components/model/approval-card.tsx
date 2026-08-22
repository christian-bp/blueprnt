"use client"

import {
  Alert02Icon,
  Cancel01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { METHOD_CHECK_KEYS } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { type ReactNode, useId, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { CheckRemedy } from "@/components/model/check-remedy"
import { RestoreApprovedDialog } from "@/components/model/restore-approved-dialog"
import { WARNING_TEXT_CLASS } from "@/lib/alert-tone"
import { methodErrorMessage } from "@/lib/method-error"
import { toast } from "@/lib/toast"

// One line of the twelve-item gate.
//
// A passing row RECEDES and a failing one LEADS: the reader of this chapter is
// looking for what is left, and a checklist that shouts every settled item as
// loudly as the one outstanding thing makes them find it themselves. Passed is
// muted text behind a small calm mark; failing keeps the full-strength ink,
// its own mark, and the remedy line under it.
//
// The marks are small and bare: size-4, no circle chrome. The icons carry
// their intrinsic 24px unless a size class says otherwise, which is how a
// checklist ends up with twelve badges down its left edge, and the circle
// around a checkmark at that size reads as a control rather than a state.
// One level's rows, under a label that NAMES the group to a screen reader as
// well as to the eye.
//
// The label used to be a bare paragraph in front of a plain list, which reads
// on screen and is silent everywhere else: a reader moving by list or by group
// met twelve items with nothing saying which of them block approval, and that
// level is exactly what the per-row parenthetical used to carry. A labelled
// group is the app's established answer (dimension-frame.tsx does the same for
// a dimension column), and it puts the level back where the grouping put it,
// once per group rather than once per row.
//
// A section rather than a div carrying role="group": a titled part of the page
// holding its own content is what a section IS, it needs no explicit role to
// say so, and naming it makes it a place a reader can jump straight to, which
// is how someone looking for what still blocks approval gets there. The same
// reasoning (and the same shape) as a dimension column's frame.
function CheckGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className="space-y-1.5">
      <p
        id={labelId}
        className="font-semibold text-muted-foreground text-xs uppercase tracking-wide"
      >
        {label}
      </p>
      {/* Tighter than the old rhythm: most of these rows are settled most of
          the time, and a settled row does not need the air an outstanding one
          does. */}
      <ul className="space-y-1.5">{children}</ul>
    </section>
  )
}

// The two groups, in the order the gate reads: what blocks approval first.
const CHECK_GROUPS = [
  { level: "blocker", labelKey: "requiredChecks" },
  { level: "warning", labelKey: "recommendedChecks" },
] as const

function CheckRow({
  ok,
  level,
  label,
  stateLabel,
  remedy,
}: {
  ok: boolean
  level: "blocker" | "warning"
  label: string
  // Met or not met, for a screen reader. The mark is the only thing that
  // carries this on screen, and a mark is decorative by definition, so the
  // state is said in text that is not painted.
  stateLabel: string
  // The "how to fix it" line, rendered under the row when the check fails.
  remedy?: ReactNode
}) {
  const icon = ok
    ? Tick02Icon
    : level === "blocker"
      ? Cancel01Icon
      : Alert02Icon
  const tone = ok
    ? "text-success"
    : level === "blocker"
      ? "text-destructive"
      : WARNING_TEXT_CLASS
  return (
    // The row's own line stays a flex row; the remedy sits UNDER it in flow, so
    // a long instruction wraps under the finding instead of squeezing it.
    <li className={cn("text-sm", ok && "text-muted-foreground")}>
      <span className="flex items-start gap-2">
        {/* mt-0.5 rather than items-center: a label that wraps should keep its
            mark on the FIRST line, where the eye starts, not centred against
            two lines of text. */}
        <HugeiconsIcon
          icon={icon}
          strokeWidth={2}
          className={cn("mt-0.5 size-4 shrink-0", tone)}
          aria-hidden="true"
        />
        <span>
          <span className="sr-only">{stateLabel} </span>
          {label}
        </span>
      </span>
      {remedy}
    </li>
  )
}

// The reading measure inside the card. The card's FRAME takes the page like
// every other chapter's content; what must not run the width of a monitor is
// the text, which is twelve check lines each with a remedy under it.
//
// Capped here rather than around the card, so the status row can span the
// whole width and put its action against the card's own right edge. One
// constant, used by every block a reader reads as sentences, so the
// description, the restore hint and the checklist can never drift into three
// different measures.
export const CARD_READING_MEASURE = "max-w-3xl"

export function ApprovalCard({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.method")
  const tHelp = useTranslations("dashboard.help")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const format = useFormatter()
  const data = useQuery(api.evaluationModel.approval.getMethodChecks, {
    orgId,
  })
  const approve = useMutation(api.evaluationModel.approval.approveModel)
  const [restoreOpen, setRestoreOpen] = useState(false)

  if (data === undefined) {
    // Content-shaped loading state: the card's own chrome (title/description)
    // is static i18n text and renders immediately; only the checklist rows
    // and the approval state are unknown until the query resolves.
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            {t("approvalHeading")}
            <HelpMorphButton label={tHelp("modelApprovalLabel")}>
              {tHelp("modelApprovalBody")}
            </HelpMorphButton>
          </CardTitle>
          {/* Reading text, so it keeps its measure while the card around it
            takes the page. CARD_READING_MEASURE is the one cap this card
            uses, on every block a reader reads as sentences. */}
          <CardDescription className={CARD_READING_MEASURE}>
            {t("approvalDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <ul className="space-y-2">
            {METHOD_CHECK_KEYS.map((key) => (
              <li key={key} className="flex items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }
  if (data === null) return null // no model yet; keep layout stable

  const checksByKey = new Map(data.checks.map((check) => [check.key, check]))
  const hasFailingBlocker = data.checks.some(
    (check) => check.level === "blocker" && !check.ok
  )

  // The restore is offered only where it is meaningful: approval re-opened by a
  // method-affecting edit, AND restoring would actually change something. An
  // approved model already IS its last-approved state; a model edited and
  // manually reverted back to it reopens approval while having nothing to
  // restore, and a control promising a change it will not make is worse than
  // no control at all.
  //
  // The buffer's mere existence is subsumed: restoreWouldChange is false
  // whenever there is no buffer (a model approved before the buffer existed
  // has nothing to go back to), so the old lastApprovedAt condition would only
  // repeat what the flag already says. The DATE below still reads
  // lastApprovedAt, because the flag says whether to offer the control and the
  // date says which state it goes back to.
  const canRestore = data.approval === null && data.restoreWouldChange

  async function onApprove() {
    try {
      await approve({ orgId })
      toast.success(tToast("modelApproved"))
    } catch (error) {
      toast.error(methodErrorMessage(error, tErrors, tToast("error")))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {t("approvalHeading")}
          <HelpMorphButton label={tHelp("modelApprovalLabel")}>
            {tHelp("modelApprovalBody")}
          </HelpMorphButton>
        </CardTitle>
        {/* Reading text, so it keeps its measure while the card around it
            takes the page. CARD_READING_MEASURE is the one cap this card
            uses, on every block a reader reads as sentences. */}
        <CardDescription className={CARD_READING_MEASURE}>
          {t("approvalDescription")}
        </CardDescription>
        {/* The chapter's actions, level with the card's title and against the
            card's own right edge: the same anatomy the journey row uses, and
            the design system's own slot for it rather than a hand-rolled flex
            row.

            The cluster is what it always was, in the order it always had:
            restore as the outline option first, approve as the primary last.
            Both belong to the DRAFT state, and they coexist there, because a
            reopened model can be approved afresh or put back to what it last
            was.

            The slot is ALWAYS mounted and keeps the button's height, because
            an approved model carries neither action. Without the reservation
            the title row would stand shorter in that state and the header
            would jump on every approval. */}
        <CardAction className="flex min-h-9 items-center gap-2">
          {canRestore && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRestoreOpen(true)}
            >
              {t("restoreCta")}
            </Button>
          )}
          {data.approval === null && (
            <Button
              type="button"
              disabled={hasFailingBlocker}
              onClick={onApprove}
            >
              {t("approveModelCta")}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The state, and what a restore would go back to. Reading text now
            that the action has moved up to the title row: with nothing beside
            them to hold against the card's edge, these are two sentences and
            they take the card's reading measure like the description above
            them. */}
        <div className={cn("space-y-1", CARD_READING_MEASURE)}>
          <p className="text-sm">
            {data.approval
              ? t("decidedBy", {
                  name: data.approval.approvedByName ?? "",
                  date: format.dateTime(new Date(data.approval.approvedAt), {
                    dateStyle: "medium",
                  }),
                })
              : t("draftState")}
          </p>
          {canRestore && data.lastApprovedAt !== null && (
            <p className="text-muted-foreground text-sm">
              {t("restoreHint", {
                date: format.dateTime(new Date(data.lastApprovedAt), {
                  dateStyle: "medium",
                }),
              })}
            </p>
          )}
        </div>
        {canRestore && (
          <RestoreApprovedDialog
            orgId={orgId}
            open={restoreOpen}
            onOpenChange={setRestoreOpen}
          />
        )}
        {/* Two groups, in the engine's own order within each: what BLOCKS the
            approval and what is merely recommended. The distinction used to
            ride every row as a parenthetical, which put the same two words
            twelve times on one card and still left the reader to sort them;
            the group says it once, and the rows underneath are then only
            themselves. */}
        <div className={cn("space-y-4", CARD_READING_MEASURE)}>
          {CHECK_GROUPS.map(({ level, labelKey }) => {
            const checks = METHOD_CHECK_KEYS.flatMap((key) => {
              const check = checksByKey.get(key)
              return check !== undefined && check.level === level ? [check] : []
            })
            if (checks.length === 0) return null
            return (
              <CheckGroup key={level} label={t(labelKey)}>
                {checks.map((check) => (
                  <CheckRow
                    key={check.key}
                    ok={check.ok}
                    level={check.level}
                    label={t(`checks.${check.key}`)}
                    stateLabel={t(check.ok ? "checkMet" : "checkNotMet")}
                    remedy={
                      <CheckRemedy
                        check={check}
                        dimensionShares={data.dimensionShares}
                      />
                    }
                  />
                ))}
              </CheckGroup>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
