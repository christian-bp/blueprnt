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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { ContinueReviewItem } from "./continue-review-item"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"
import { WidgetCard } from "@/components/widget-card"
import { usePayMappingRun } from "./pay-mapping-run-context"
import { buildReviewQueue, type ReviewQueue } from "./review-queue"

type ChapterKey = "start" | "praxis" | "equalWork" | "equivalentWork"
type ChapterState = "notStarted" | "inProgress" | "done"

// The start chapter (collaboration) is binary and never shows a count; the
// three countable chapters (praxis/equalWork/equivalentWork) carry their
// done/total fraction from queue.progress, rendered alongside the state
// word.
interface ChapterStatus {
  state: ChapterState
  count: { done: number; total: number } | null
}

const CHAPTER_KEYS: ChapterKey[] = [
  "start",
  "praxis",
  "equalWork",
  "equivalentWork",
]

// A countable chapter's own state (praxis/equalWork/equivalentWork): nothing
// required reads as done (there is nothing left to do), otherwise the
// done/total fraction from queue.progress picks the word.
function countableChapterState(done: number, total: number): ChapterState {
  if (total === 0) return "done"
  if (done === 0) return "notStarted"
  if (done === total) return "done"
  return "inProgress"
}

function chapterStatusFor(key: ChapterKey, queue: ReviewQueue): ChapterStatus {
  if (key === "start")
    return {
      state: queue.progress.collaborationDone ? "done" : "notStarted",
      count: null,
    }
  const { done, total } = queue.progress[key]
  // Nothing required (total 0) already reads as "Done" on its own; a "0 of
  // 0" count would add noise without information, so it is omitted.
  return {
    state: countableChapterState(done, total),
    count: total === 0 ? null : { done, total },
  }
}

// The Overview hub's single progress source (ADR-0012): the four review
// chapters (collaboration/start, praxis, equalWork, equivalentWork) as
// rows, each showing its own derived state, and the ONE completion CTA the
// old KPI-strip flag summary and documentation card used to split across
// two widgets. Self-contained like the header components
// (usePayMappingRun + its own listPayMappingRuns subscription) so the
// Overview page's own prop surface stays untouched; buildReviewQueue is the
// SAME derivation the review wizard shell uses, so the two surfaces can
// never disagree on progress or on the completion gate.
export function PayMappingJourneyCard() {
  const t = useTranslations("dashboard.payMapping")
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const tDoc = useTranslations("dashboard.payMapping.documentation")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const { run, gap, analyses } = usePayMappingRun()
  const runsList = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  const completePayMappingRun = useMutation(
    api.payMapping.runs.completePayMappingRun
  )
  const reopenPayMappingRun = useMutation(
    api.payMapping.runs.reopenPayMappingRun
  )
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [completing, setCompleting] = useState(false)

  // The Overview page is the run's own index route, so the review takeover
  // nests directly under the current path (same derivation as the old
  // documentation card's link and the run indicator's own slug read). The
  // unmet-gate CTA points at the guided wizard (/review), not the summary
  // (/analysis): a run with steps left to do needs the journey, not just a
  // read of what it has collected so far.
  const [, slug] = pathname.split("/").filter(Boolean)
  const reviewHref = `/pay-mappings/${slug}/review`

  const collaboration = run?.collaboration ?? null
  const hasPreviousCompletedRun =
    run !== undefined &&
    (runsList?.some(
      (candidate) =>
        candidate.status === "completed" &&
        candidate.referenceDate < run.referenceDate
    ) ??
      false)

  const queue: ReviewQueue | null =
    run !== undefined &&
    gap !== undefined &&
    analyses !== undefined &&
    runsList !== undefined
      ? buildReviewQueue({
          gap,
          analyses,
          collaboration,
          hasPreviousCompletedRun,
        })
      : null

  const loading = queue === null || run === undefined

  const gateMet =
    queue !== null &&
    queue.progress.overall.done === queue.progress.overall.total
  const remaining =
    queue === null
      ? 0
      : queue.progress.overall.total - queue.progress.overall.done

  // Moved verbatim from the old PayMappingDocumentationCard: the
  // double-click guard (disabled while completing) and the same success/
  // error toast handling.
  async function handleComplete() {
    if (run === undefined) return
    setCompleting(true)
    try {
      await completePayMappingRun({ orgId, runId: run.runId })
      toast.success(tToast("payMappingCompleted"))
    } catch {
      toast.error(tToast("error"))
    } finally {
      setCompleting(false)
    }
  }

  async function handleReopen() {
    if (run === undefined) return
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
    <WidgetCard
      title={tJourney("title")}
      help={{ label: tHelp("payGapGateLabel"), body: tHelp("payGapGateBody") }}
      headerExtra={
        loading ? (
          // The CTA's own TYPE (Complete at the bottom vs the continue item
          // here) is derived from the queue's gate, so it is unknown, not
          // merely unstyled, until the queue resolves: a bar stands in, per
          // the data-driven-control case of the skeleton rule.
          <Skeleton className="h-9 w-40 rounded-lg" />
        ) : run?.status !== "completed" && !gateMet ? (
          <ContinueReviewItem href={reviewHref} remaining={remaining} />
        ) : undefined
      }
    >
      <div className="space-y-4">
        <dl className="space-y-1">
          {CHAPTER_KEYS.map((key) => {
            const status = queue === null ? null : chapterStatusFor(key, queue)
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-2"
              >
                <dt className="text-sm">{t(`review.chapters.${key}`)}</dt>
                <dd className="flex min-h-5 items-center text-muted-foreground text-sm">
                  {status === null ? (
                    <Skeleton className="h-4 w-20" />
                  ) : status.count === null ? (
                    tJourney(`state.${status.state}`)
                  ) : (
                    `${tJourney(`state.${status.state}`)} · ${tJourney("count", status.count)}`
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
        {run?.status === "completed" ? (
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
        ) : !loading && gateMet ? (
          <Button type="button" disabled={completing} onClick={handleComplete}>
            {tDoc("complete")}
          </Button>
        ) : null}
      </div>
      <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDoc("reopenConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tDoc("reopenConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopening}>
              {tDoc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction disabled={reopening} onClick={handleReopen}>
              {tDoc("reopenConfirmCta")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WidgetCard>
  )
}
