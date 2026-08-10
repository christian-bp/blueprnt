import { cleanup, render, screen, within } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026/analysis/equal-work",
}))

// The tabs read only `queue` off the run context. Mocking the hook keeps
// the test on the row's own logic (which label, which mark, which href)
// instead of on assembling a gap fixture that happens to produce the
// per-chapter counts each case needs.
const queueRef: { current: ReviewQueue | null } = { current: null }
vi.mock("@/components/pay-mapping/pay-mapping-run-context", () => ({
  usePayMappingRun: () => ({ queue: queueRef.current }),
}))

import { AnalysisChapterTabs } from "@/components/pay-mapping/analysis-chapter-tabs"
import type { ReviewQueue } from "@/components/pay-mapping/review-queue"

const m = messages.dashboard.payMapping.review
const mAnalysis = messages.dashboard.payMapping.analysis

function queue(
  overrides: Partial<ReviewQueue["progress"]> = {}
): ReviewQueue["progress"] {
  return {
    overall: { done: 5, total: 29 },
    praxis: { done: 4, total: 4 },
    equalWork: { done: 0, total: 3 },
    equivalentWork: { done: 0, total: 21 },
    collaborationDone: true,
    ...overrides,
  }
}

function renderTabs(progress: ReviewQueue["progress"] | null = queue()) {
  queueRef.current =
    progress === null
      ? null
      : ({ steps: [], resumeIndex: 0, progress } as ReviewQueue)
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AnalysisChapterTabs />
    </NextIntlClientProvider>
  )
}

function tab(label: string) {
  return screen
    .getAllByRole("link")
    .find((link) => link.textContent?.includes(label))
}

afterEach(() => cleanup())

describe("AnalysisChapterTabs", () => {
  it("names the four chapters and nothing else, with the short labels", () => {
    // Four tabs, all of them work. A fifth for the section index existed
    // briefly and named a page that listed no steps.
    renderTabs()
    const nav = screen.getByRole("navigation", { name: mAnalysis.chapterNav })
    const links = within(nav).getAllByRole("link")
    expect(links).toHaveLength(4)
    // Short names: the descriptive titles read as a paragraph in a row that
    // also carries four counts.
    expect(links[2]?.textContent).toContain(m.chaptersShort.equalWork)
    expect(links[2]?.textContent).not.toContain(m.chapters.equalWork)
  })

  it("links each chapter to its own page", () => {
    renderTabs()
    expect(tab(m.chaptersShort.equivalentWork)?.getAttribute("href")).toBe(
      "/pay-mappings/pay-2026/analysis/equivalent-work"
    )
    expect(tab(m.chaptersShort.start)?.getAttribute("href")).toBe(
      "/pay-mappings/pay-2026/analysis/start"
    )
  })

  it("carries a done mark but never a count", () => {
    // Four pairs of numbers in one row, when the reader only ever needs the
    // one they are working in. That count is the spine's heading now, and
    // the four side by side live on the completion panel.
    renderTabs()
    const praxis = tab(m.chaptersShort.praxis)
    expect(praxis?.textContent).toContain(m.status.done)
    expect(praxis?.textContent).not.toMatch(/\d+ of \d+/)

    const equalWork = tab(m.chaptersShort.equalWork)
    expect(equalWork?.textContent).not.toMatch(/\d+ of \d+/)
    expect(equalWork?.textContent).not.toContain(m.status.done)
  })

  it("treats the one-step start chapter's boolean as done", () => {
    // The queue carries start as `collaborationDone`, not as a done/total
    // pair, so it needs normalising before it can read as done.
    renderTabs()
    expect(tab(m.chaptersShort.start)?.textContent).toContain(m.status.done)
    cleanup()
    renderTabs(queue({ collaborationDone: false }))
    expect(tab(m.chaptersShort.start)?.textContent).not.toContain(m.status.done)
  })

  it("marks the current chapter, and only it, as the current page", () => {
    renderTabs()
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toContain(m.chaptersShort.equalWork)
  })

  // The done slot is always in the layout, so an underline measured against
  // the whole tab ran 20px past the start of the text on every chapter that
  // was not yet finished, reading as a bar left behind by a missing mark. It
  // is anchored to the label instead, which also makes its width independent
  // of whether the chapter is done. jsdom cannot measure boxes, so what is
  // pinned here is the anchoring: the underline's own positioning parent holds
  // the label text and not the mark.
  it("anchors the current chapter's underline to its label, not the whole tab", () => {
    renderTabs()
    const current = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("aria-current") === "page")
    const underline = current?.querySelector(".bg-foreground")
    const anchor = underline?.parentElement
    expect(anchor).not.toBe(current)
    expect(anchor?.className).toContain("relative")
    expect(anchor?.textContent).toContain(m.chaptersShort.equalWork)
    // The mark and its screen-reader text stay outside, so the bar cannot
    // stretch to cover them.
    expect(anchor?.querySelector("[aria-hidden]")).toBeNull()
  })

  it("renders the real labels while the queue is still loading", () => {
    // Static i18n text renders as its real control during a load; only the
    // counts, which are unknown until the data lands, are held back.
    renderTabs(null)
    expect(screen.getAllByRole("link")).toHaveLength(4)
    // Nothing claims to be done before the queue says so.
    expect(tab(m.chaptersShort.praxis)?.textContent).not.toContain(
      m.status.done
    )
  })
})
