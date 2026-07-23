import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { ReviewProgress } from "@/components/pay-mapping/review-progress"
import type { ReviewQueue } from "@/components/pay-mapping/review-queue"

const t = messages.dashboard.payMapping.review

// A minimal, hand-built queue: ReviewProgress only reads
// queue.progress.overall (for the counter and the bar), so a full
// buildReviewQueue fixture would be needless ceremony here.
const QUEUE: ReviewQueue = {
  steps: [
    { kind: "start" },
    { kind: "praxis", area: "payPolicy" },
    { kind: "finish" },
  ],
  resumeIndex: 1,
  progress: {
    overall: { done: 1, total: 2 },
    praxis: { done: 0, total: 1 },
    equalWork: { done: 0, total: 0 },
    equivalentWork: { done: 0, total: 0 },
    collaborationDone: true,
  },
}

function renderProgress(props: React.ComponentProps<typeof ReviewProgress>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewProgress {...props} />
    </NextIntlClientProvider>
  )
}

function barFill(): HTMLElement {
  const el = document.querySelector(".bg-primary")
  if (el === null) throw new Error("missing progress bar fill")
  return el as HTMLElement
}

afterEach(() => cleanup())

describe("ReviewProgress", () => {
  it("shows the done count and a bar filled to the same overall done fraction", () => {
    renderProgress({ queue: QUEUE })
    expect(
      screen.getByText(
        t.progressDone.replace("{done}", "1").replace("{total}", "2")
      )
    ).toBeDefined()
    expect(barFill().style.width).toBe("50%")
  })

  it("fills the bar completely once every actionable step is done", () => {
    const doneQueue: ReviewQueue = {
      ...QUEUE,
      progress: { ...QUEUE.progress, overall: { done: 2, total: 2 } },
    }
    renderProgress({ queue: doneQueue })
    expect(barFill().style.width).toBe("100%")
  })

  it("never shows the jump-menu trigger: that moved to the shell's own header", () => {
    renderProgress({ queue: QUEUE })
    expect(screen.queryByText(t.allSteps)).toBeNull()
  })

  it("shows a skeleton counter and an empty bar while loading, with no jump trigger", () => {
    renderProgress({ loading: true })
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(t.allSteps)).toBeNull()
  })
})
