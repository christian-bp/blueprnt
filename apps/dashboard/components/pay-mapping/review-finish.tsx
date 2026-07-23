"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"
import type { PayMappingRunDetail } from "./pay-mapping-gap-types"
import type { ReviewQueue } from "./review-queue"
import { ReviewStepActions } from "./review-step-actions"

// Distinguishes the one reachable server-side rejection from a completed-gate
// attempt (the statutory documentation gate, re-derived authoritatively by
// completePayMappingRun from the frozen rows) from a transient failure, so
// the toast can name the real problem. Same instanceof-ConvexError +
// data.code idiom as the group/praxis steps' own isDocumentationRequiredError.
// Belt-and-braces: the primary button is already gated on the client's own
// `gateMet` (which mirrors the server rule via queue.progress), so this is
// only expected to fire on a desync (e.g. a concurrent edit from another tab
// between this screen loading and the click). Exported: pay-mapping-summary.tsx
// renders the same gate section and imports this rather than keep a second
// copy of the same check (one home, no duplication).
export function isGateUnmetError(error: unknown): boolean {
  return (
    error instanceof ConvexError &&
    (error.data as { code?: string } | null)?.code ===
      "errors.payMappingGateUnmet"
  )
}

// The review journey's last step: a bare finale, not a documentation mirror.
// The full listing (collaboration, praxis findings, every
// equalWork/women-dominated group's status, the hand-off note) lives in
// pay-mapping-summary.tsx, the Analysis tab's steady state and the natural
// place to keep re-reading or re-opening what the journey collected. What
// is left here is the all-reviewed affirmation, the SAME completion gate
// the summary also renders (Complete when met, a remaining hint when not),
// and a primary link into that summary. Reopen intentionally does NOT live
// here: a completed run shows the completed note and a plain link back to
// the overview, where the journey card owns Reopen.
export function ReviewFinish({
  queue,
  run,
  onPrevious,
}: {
  queue: ReviewQueue
  run: PayMappingRunDetail
  onPrevious?: () => void
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tFinish = useTranslations("dashboard.payMapping.review.finish")
  const tDoc = useTranslations("dashboard.payMapping.documentation")
  const tTabs = useTranslations("dashboard.payMapping.tabs")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const completePayMappingRun = useMutation(
    api.payMapping.runs.completePayMappingRun
  )
  const [completing, setCompleting] = useState(false)

  // The run's own overview and its summary both sit at the review takeover's
  // sibling routes, same slug derivation as pay-mapping-review.tsx's own
  // analysisHref and pay-mapping-summary.tsx's own overviewHref/reviewHref.
  const [, slug] = pathname.split("/").filter(Boolean)
  const overviewHref = `/pay-mappings/${slug}`
  const summaryHref = `/pay-mappings/${slug}/analysis`

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

  const gateMet = queue.progress.overall.done === queue.progress.overall.total
  const remaining = queue.progress.overall.total - queue.progress.overall.done

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tFinish("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Link href={summaryHref} className={buttonVariants()}>
          {t("openSummary")}
        </Link>
      </CardContent>
      <CardFooter>
        {run.status === "completed" ? (
          <div className="flex w-full flex-col items-start gap-3">
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                {tDoc("completedNote")}
              </p>
              <Link
                href={overviewHref}
                className="text-sm underline underline-offset-4"
              >
                {tTabs("overview")}
              </Link>
            </div>
            {onPrevious && (
              <Button type="button" variant="outline" onClick={onPrevious}>
                {t("previous")}
              </Button>
            )}
          </div>
        ) : (
          <ReviewStepActions
            onPrevious={onPrevious}
            primaryLabel={tDoc("complete")}
            onPrimary={handleComplete}
            primaryDisabled={!gateMet || completing}
            hint={gateMet ? undefined : tDoc("remaining", { count: remaining })}
          />
        )}
      </CardFooter>
    </Card>
  )
}
