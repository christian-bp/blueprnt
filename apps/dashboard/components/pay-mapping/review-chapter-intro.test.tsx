import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReviewChapterIntro } from "@/components/pay-mapping/review-chapter-intro"

const t = messages.dashboard.payMapping.review
const tHelp = messages.dashboard.help
const tForm = messages.dashboard.payMapping.analysisForm

function renderIntro(
  overrides: Partial<{
    chapter: "equalWork" | "equivalentWork"
    groupCount: number
    locked: boolean
    onNext: () => void
    onPrevious: () => void
  }> = {}
) {
  const onNext = overrides.onNext ?? vi.fn()
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewChapterIntro
        chapter={overrides.chapter ?? "equalWork"}
        groupCount={overrides.groupCount ?? 3}
        locked={overrides.locked ?? false}
        onNext={onNext}
        onPrevious={overrides.onPrevious}
      />
    </NextIntlClientProvider>
  )
  return { onNext, container }
}

afterEach(() => cleanup())

describe("ReviewChapterIntro", () => {
  it("renders the equalWork chapter's title, body and both reused help triggers, one per row (never stacked on the heading)", () => {
    const { container } = renderIntro({ chapter: "equalWork" })
    expect(screen.getByText(t.chapters.intro.equalWork.title)).toBeDefined()
    expect(screen.getByText(t.chapters.intro.equalWork.body)).toBeDefined()
    const headingButton = screen.getByRole("button", {
      name: tHelp.payGapEqualWorkLabel,
    })
    const bodyButton = screen.getByRole("button", {
      name: tHelp.payGapFlagsLabel,
    })
    expect(headingButton).toBeDefined()
    expect(bodyButton).toBeDefined()
    // The heading row (the CardTitle's own flex container) carries only the
    // chapter concept's help; the flags concept's help sits beside the body
    // paragraph instead, never a second popover stacked on the heading.
    const headingRow = container.querySelector(
      '[data-slot="card-title"]'
    )?.parentElement
    expect(headingRow?.contains(headingButton)).toBe(true)
    expect(headingRow?.contains(bodyButton)).toBe(false)
  })

  it("renders the equivalentWork chapter's title, body and both reused help triggers, one per row (never stacked on the heading)", () => {
    const { container } = renderIntro({ chapter: "equivalentWork" })
    expect(
      screen.getByText(t.chapters.intro.equivalentWork.title)
    ).toBeDefined()
    expect(screen.getByText(t.chapters.intro.equivalentWork.body)).toBeDefined()
    const headingButton = screen.getByRole("button", {
      name: tHelp.payGapEquivalentWorkLabel,
    })
    const bodyButton = screen.getByRole("button", {
      name: tHelp.womenDominatedLabel,
    })
    expect(headingButton).toBeDefined()
    expect(bodyButton).toBeDefined()
    const headingRow = container.querySelector(
      '[data-slot="card-title"]'
    )?.parentElement
    expect(headingRow?.contains(headingButton)).toBe(true)
    expect(headingRow?.contains(bodyButton)).toBe(false)
  })

  it("shows the equalWork empty reassurance only when groupCount is 0", () => {
    renderIntro({ chapter: "equalWork", groupCount: 0 })
    expect(screen.getByText(t.chapters.intro.equalWork.empty)).toBeDefined()
    cleanup()

    renderIntro({ chapter: "equalWork", groupCount: 2 })
    expect(screen.queryByText(t.chapters.intro.equalWork.empty)).toBeNull()
  })

  it("shows the equivalentWork empty reassurance only when groupCount is 0", () => {
    renderIntro({ chapter: "equivalentWork", groupCount: 0 })
    expect(
      screen.getByText(t.chapters.intro.equivalentWork.empty)
    ).toBeDefined()
    cleanup()

    renderIntro({ chapter: "equivalentWork", groupCount: 1 })
    expect(screen.queryByText(t.chapters.intro.equivalentWork.empty)).toBeNull()
  })

  it("fires onNext from the primary Continue action", () => {
    const { onNext } = renderIntro()
    fireEvent.click(screen.getByRole("button", { name: t.continue }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("hides Previous when its callback is undefined, and shows it (firing on click) otherwise", () => {
    renderIntro()
    expect(screen.queryByRole("button", { name: t.previous })).toBeNull()
    cleanup()

    const onPrevious = vi.fn()
    renderIntro({ onPrevious })
    fireEvent.click(screen.getByRole("button", { name: t.previous }))
    expect(onPrevious).toHaveBeenCalledTimes(1)
  })

  it("shows the locked hint when locked", () => {
    renderIntro({ locked: true })
    expect(screen.getByText(tForm.lockedHint)).toBeDefined()
  })
})
