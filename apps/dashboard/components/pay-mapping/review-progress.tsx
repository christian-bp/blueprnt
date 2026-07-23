"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import type { ReviewQueue, ReviewStep } from "./review-queue"

// A step's own chapter, for the sr-only step announcement (review.chapters.*):
// a chapterIntro reads as the chapter it introduces (the reader's first beat
// of that chapter), a group step as its scope's chapter. Exported for
// pay-mapping-review.tsx's own live-region text: each step's own card
// already carries its own heading (the praxis area title, the chapter
// intro's title), so the announcement is the one place left that still
// needs a chapter name.
export function chapterKeyFor(
  step: ReviewStep
): "start" | "praxis" | "equalWork" | "equivalentWork" | "finish" {
  switch (step.kind) {
    case "start":
      return "start"
    case "praxis":
      return "praxis"
    case "chapterIntro":
      return step.chapter
    case "group":
      return step.scope
    case "finish":
      return "finish"
  }
}

type ReviewProgressProps =
  | { loading: true }
  | {
      loading?: false
      queue: ReviewQueue
    }

// The review journey's FOOTER chrome (WizardShell's footer slot): a done
// count ("X of Y done") on the left and a thin completion progress bar
// filling the rest of the row, both reading from the same
// queue.progress.overall numbers (a position counter would describe where
// you stand, not how much is done, and the wizard is non-linear: skip,
// jump menu, resume). The chapter label and the jump-menu trigger that used to sit
// alongside this in the old in-page header row have both moved out: the
// chapter name is now only announced via pay-mapping-review.tsx's sr-only
// live region (chapterKeyFor above), and the jump trigger now lives in
// WizardShell's headerRight (pay-mapping-review.tsx renders ReviewJumpMenu
// there directly, no longer through this component).
//
// Loading (run/gap/analyses not yet resolved): a skeleton bar stands in for
// the counter text (data-driven, unknown until the queue exists) while the
// bar's own fill renders empty rather than at some fabricated width.
export function ReviewProgress(props: ReviewProgressProps) {
  if (props.loading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-24 shrink-0" />
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-0 rounded-full bg-primary" />
        </div>
      </div>
    )
  }

  return <ReviewProgressBar {...props} />
}

function ReviewProgressBar({ queue }: { queue: ReviewQueue }) {
  const t = useTranslations("dashboard.payMapping.review")
  const done = queue.progress.overall.done
  const total = queue.progress.overall.total
  const doneFraction = total === 0 ? 0 : done / total

  return (
    <div className="flex items-center gap-3">
      <p className="shrink-0 text-muted-foreground text-xs">
        {t("progressDone", { done, total })}
      </p>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${doneFraction * 100}%` }}
        />
      </div>
    </div>
  )
}
