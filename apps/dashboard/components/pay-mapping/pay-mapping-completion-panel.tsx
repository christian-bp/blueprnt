"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"
import { ANALYSIS_CHAPTERS } from "./analysis-chapters"
import type { PayMappingRunDetail } from "./pay-mapping-gap-types"
import type { ReviewQueue } from "./review-queue"
import { ReviewStepActions } from "./review-step-actions"

// Distinguishes the one reachable server-side rejection from a completed-gate
// attempt (the statutory documentation gate, re-derived authoritatively by
// completePayMappingRun from the frozen rows) from a transient failure, so
// the toast can name the real problem. Belt-and-braces: the primary button
// is already gated on the client's own gateMet (which mirrors the server
// rule via queue.progress), so this only fires on a desync, e.g. a
// concurrent edit from another tab.
export function isGateUnmetError(error: unknown): boolean {
  return (
    error instanceof ConvexError &&
    (error.data as { code?: string } | null)?.code ===
      "errors.payMappingGateUnmet"
  )
}

// The end of the ladder, in ONE place. Three surfaces used to render their
// own version of this gate (the analysis pane, the wizard's finale, the
// overview's journey card), which meant three answers to "is the duty met"
// derived from the same state. This is the only one now: the chapter
// breakdown, the completion action with its remaining hint, the completed
// note, and Reopen.
export function PayMappingCompletionPanel({
  queue,
  run,
}: {
  queue: ReviewQueue
  run: PayMappingRunDetail
  // Non-gating findings worth naming at the moment of finishing (ADR-0015
  // decision 2): the tvärnivå cases are not counted toward completion, so
  // this is where an employer who never opened the drawer still meets them.
  crossLevelCount?: number
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tChapters = useTranslations("dashboard.payMapping.review.chapters")
  const tDoc = useTranslations("dashboard.payMapping.documentation")
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const { orgId } = useOrganization()
  const completePayMappingRun = useMutation(
    api.payMapping.runs.completePayMappingRun
  )
  const reopenPayMappingRun = useMutation(
    api.payMapping.runs.reopenPayMappingRun
  )
  const [completing, setCompleting] = useState(false)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopening, setReopening] = useState(false)

  const gateMet = queue.progress.overall.done === queue.progress.overall.total
  const remaining = queue.progress.overall.total - queue.progress.overall.done
  const completed = run.status === "completed"

  async function handleComplete() {
    setCompleting(true)
    try {
      await completePayMappingRun({ orgId, runId: run.runId })
      toast.success(tToast("payMappingCompleted"))
    } catch (error) {
      toast.error(
        isGateUnmetError(error)
          ? tErrors("payMappingGateUnmet")
          : tToast("error")
      )
    } finally {
      setCompleting(false)
    }
  }

  async function handleReopen() {
    setReopening(true)
    try {
      await reopenPayMappingRun({ orgId, runId: run.runId })
      toast.success(tToast("payMappingReopened"))
      setReopenOpen(false)
    } catch {
      toast.error(tToast("error"))
    } finally {
      setReopening(false)
    }
  }

  // The start chapter is binary (the samverkan record is filled in or it is
  // not); the other three carry their own done/total.
  function chapterMetaFor(chapter: (typeof ANALYSIS_CHAPTERS)[number]) {
    if (chapter === "start")
      return tJourney(
        `state.${queue.progress.collaborationDone ? "done" : "notStarted"}`
      )
    const count = queue.progress[chapter]
    if (count.total === 0) return tJourney("state.done")
    return tJourney("count", count)
  }

  return (
    <div className="space-y-4">
      <dl className="space-y-1">
        {ANALYSIS_CHAPTERS.map((chapter) => (
          <div
            key={chapter}
            className="flex items-center justify-between gap-2"
          >
            <dt className="text-sm">{tChapters(chapter)}</dt>
            <dd className="text-muted-foreground text-sm tabular-nums">
              {chapterMetaFor(chapter)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-sm">{t("finishActionsNote")}</p>
      {completed ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            {tDoc("completedNote")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setReopenOpen(true)}
          >
            {tDoc("reopen")}
          </Button>
        </div>
      ) : (
        <ReviewStepActions
          primaryLabel={tDoc("complete")}
          onPrimary={handleComplete}
          primaryDisabled={!gateMet || completing}
          hint={gateMet ? undefined : tDoc("remaining", { count: remaining })}
        />
      )}
      <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDoc("reopenConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tDoc("reopenConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tDoc("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={reopening} onClick={handleReopen}>
              {tDoc("reopenConfirmCta")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
