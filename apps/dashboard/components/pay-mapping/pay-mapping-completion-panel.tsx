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
import { FrameCard, FrameCardSection } from "@/components/frame-card"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"
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
// own version of this gate, which meant three answers to "is the duty met"
// derived from the same state. This is the only one now: the completion
// action with its remaining hint, the completed note, and Reopen. Its one
// home is the end of a chapter's worklist: finishing is the last thing you
// do in the flow, so it lives where the work does, not on a dashboard tile
// beside the figures.
//
// It used to open with a per-chapter breakdown of the standing. That is the
// analysis section's job: the spine's segments are weighted by how much work
// each chapter holds and the tab row marks the finished ones, so the list
// here was the same four numbers in a place where nothing could act on them.
export function PayMappingCompletionPanel({
  queue,
  run,
  lead,
}: {
  queue: ReviewQueue
  run: PayMappingRunDetail
  // A sentence the surface needs stated before the gate itself, passed only
  // where there is no row to speak for it (an equivalent-work chapter with
  // nothing to answer).
  lead?: string
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tDoc = useTranslations("dashboard.payMapping.documentation")
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

  return (
    // The same frame every step in the journey draws, so finishing reads as
    // the last station of the ladder rather than as a different kind of
    // surface: the note in the header, the completion action in the foot
    // where every other step keeps its primary, and a panel only where the
    // completed state actually has something to put in one.
    <>
      <FrameCard
        // No title: the completion action names itself, and a heading over a
        // single line would title the same thing twice. The note says what
        // completing does NOT cover, stated once before the button runs it.
        description={
          lead === undefined ? (
            t("finishActionsNote")
          ) : (
            <>
              <p>{lead}</p>
              <p>{t("finishActionsNote")}</p>
            </>
          )
        }
        {...(completed
          ? {}
          : {
              footer: (
                <ReviewStepActions
                  primaryLabel={tDoc("complete")}
                  onPrimary={handleComplete}
                  primaryDisabled={!gateMet || completing}
                  hint={
                    gateMet
                      ? undefined
                      : tDoc("remaining", { count: remaining })
                  }
                />
              ),
            })}
      >
        {completed && (
          // The completed state has something to hold: what the lock means
          // and the way out of it. The open state is one line and an action,
          // which is a header and a foot, not a panel of its own.
          <FrameCardSection>
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
          </FrameCardSection>
        )}
      </FrameCard>
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
    </>
  )
}
