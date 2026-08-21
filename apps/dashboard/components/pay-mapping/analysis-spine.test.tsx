import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// NumberFlow renders a custom element happy-dom never upgrades, so its
// getSnapshotBeforeUpdate throws the moment the value CHANGES in place. The
// digit animation is the library's business; this test is about the figures.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import type { AnalysisChapter } from "@/components/pay-mapping/analysis-chapters"
import { AnalysisSpine } from "@/components/pay-mapping/analysis-spine"

const m = messages.dashboard.payMapping.analysis
const mReview = messages.dashboard.payMapping.review
const mProgress = messages.dashboard.progress

function renderSpine(
  overrides: Partial<{
    done: number
    total: number
    chapters: { key: AnalysisChapter; done: number; total: number }[]
    activeChapter: string
  }> = {}
) {
  const result = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AnalysisSpine
        done={overrides.done ?? 12}
        total={overrides.total ?? 31}
        activeChapter={overrides.activeChapter}
        chapters={
          overrides.chapters ?? [
            { key: "start", done: 1, total: 1 },
            { key: "praxis", done: 4, total: 4 },
            { key: "equalWork", done: 7, total: 5 },
            { key: "equivalentWork", done: 0, total: 21 },
          ]
        }
        headingRef={createRef<HTMLHeadingElement>()}
      />
    </NextIntlClientProvider>
  )
  return result
}

describe("AnalysisSpine", () => {
  afterEach(() => {
    cleanup()
  })

  it("labels the instrument and states the mapping's own figures beside it", () => {
    const { container } = renderSpine()
    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading.textContent).toBe(m.progressLabel)
    // The pair used to be a screen reader's only copy of itself, because
    // nothing on the surface showed it. It is on screen for everyone now.
    expect(heading.querySelector(".sr-only")).toBeNull()
    const counter = container.querySelector(".tabular-nums")
    expect(counter?.textContent).toBe("12 of 31")
    // Both figures move while the reader works, so each is its OWN element
    // carrying NumberFlow rather than text interpolated into the sentence
    // (the mock above stands in for it). A concatenated string would leave
    // this row empty.
    expect(
      [...(counter?.children ?? [])].map((node) => node.textContent)
    ).toEqual(["12", "31"])
    // The same work units the announced percentage is computed from, so eye
    // and ear agree.
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute("aria-valuenow")).toBe("39")
  })

  // A fixed, compact width on the title row, never a bar measuring the page.
  it("holds a fixed compact width on its title row", () => {
    const { container } = renderSpine()
    const tokens = (
      container.querySelector('[role="progressbar"]')?.className ?? ""
    ).split(/\s+/)
    expect(tokens).toContain("w-52")
    expect(tokens).toContain("shrink-0")
  })

  it("gives every chapter the same width whatever it holds", () => {
    // The fixture's chapters run 1, 4, 5 and 21 steps and every segment is the
    // same width: a chapter is a station, and a station's width is not a claim
    // about the work behind it. Where the work reads instead is the fill (per
    // chapter), the count under the open one, and the announced percentage,
    // which stays work-weighted.
    const { container } = renderSpine()
    const bar = container.querySelector('[role="progressbar"]')
    const segments = [...(bar?.children ?? [])] as HTMLElement[]
    expect(segments).toHaveLength(4)
    expect(segments.map((segment) => segment.style.flexGrow)).toEqual([
      "1",
      "1",
      "1",
      "1",
    ])
    // Nothing annotates the instrument: no per-chapter figure under it.
    expect(
      container.querySelector('[aria-hidden="true"][class*="h-4"]')
    ).toBeNull()
    // A finished chapter's fill runs the whole segment; an untouched one
    // shows none.
    const fillOf = (segment: HTMLElement | undefined) =>
      (segment?.querySelector(".bg-primary") as HTMLElement | null)?.style.width
    expect(fillOf(segments[1])).toBe("100%")
    expect(fillOf(segments[3])).toBe("0%")
  })

  // The chapters are named on screen by the tab row under the bar; a segment
  // says which one it is when the pointer rests on it, with the same short
  // name that row uses.
  it("names a hovered chapter and states where it stands", async () => {
    const { container } = renderSpine({ activeChapter: "equalWork" })
    const segment = [
      ...(container.querySelector('[role="progressbar"]')?.children ?? []),
    ][3] as HTMLElement
    fireEvent.pointerEnter(segment, { pointerType: "mouse" })
    fireEvent.mouseEnter(segment)
    await waitFor(() => {
      const tooltip = document.querySelector('[data-slot="tooltip-content"]')
      expect(tooltip?.textContent).toContain(
        mReview.chaptersShort.equivalentWork
      )
      expect(tooltip?.textContent).toContain("0")
      expect(tooltip?.textContent).toContain("21")
    })
  })

  it("holds the open chapter's segment up and lets the rest recede", () => {
    // The segments and the tab row can never line up (segments are equally
    // wide, tabs as wide as their names), so simultaneous highlighting is
    // what ties the bar to the chapter you are on.
    const { container } = renderSpine({ activeChapter: "equalWork" })
    const segments = [
      ...(container.querySelector('[role="progressbar"]')?.children ?? []),
    ] as HTMLElement[]
    expect(segments.map((s) => s.dataset.active)).toEqual([
      "false",
      "false",
      "true",
      "false",
    ])
  })

  it("reads the whole bar at full strength on Läget", () => {
    // No chapter is open there, so dimming three quarters of the bar would
    // say something untrue about where the user is.
    const { container } = renderSpine()
    const segments = [
      ...(container.querySelector('[role="progressbar"]')?.children ?? []),
    ] as HTMLElement[]
    expect(segments.every((s) => s.dataset.active === "true")).toBe(true)
  })

  // The same shared slot the model spine uses: a finished mapping states the
  // fact rather than asking the reader to compare two equal numbers.
  it("says the word instead of counting itself once nothing is left", () => {
    const { container } = renderSpine({
      done: 31,
      total: 31,
      chapters: [
        { key: "start", done: 1, total: 1 },
        { key: "praxis", done: 4, total: 4 },
        { key: "equalWork", done: 5, total: 5 },
        { key: "equivalentWork", done: 21, total: 21 },
      ],
    })
    const word = screen.getByText(mProgress.done)
    expect(word.className).toContain("text-success")
    expect(container.textContent).not.toContain("31 of 31")
    expect(container.querySelector(".tabular-nums")).toBeNull()
    // The announced percentage is untouched by the visual word.
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-valuenow")
    ).toBe("100")
  })

  // A mapping moves backwards too: a klarmarkering is undone and the figures
  // have to come back.
  it("counts itself again when a finished mapping reopens", async () => {
    const { container, rerender } = renderSpine({
      done: 31,
      total: 31,
      chapters: [
        { key: "start", done: 1, total: 1 },
        { key: "praxis", done: 4, total: 4 },
        { key: "equalWork", done: 5, total: 5 },
        { key: "equivalentWork", done: 21, total: 21 },
      ],
    })
    expect(screen.getByText(mProgress.done)).toBeDefined()

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AnalysisSpine
          done={30}
          total={31}
          chapters={[
            { key: "start", done: 1, total: 1 },
            { key: "praxis", done: 4, total: 4 },
            { key: "equalWork", done: 5, total: 5 },
            { key: "equivalentWork", done: 20, total: 21 },
          ]}
        />
      </NextIntlClientProvider>
    )
    await waitFor(() => {
      expect(container.querySelector(".tabular-nums")?.textContent).toBe(
        "30 of 31"
      )
      expect(screen.queryByText(mProgress.done)).toBeNull()
    })
  })

  it("reads zero rather than dividing by zero when nothing is required", () => {
    const { container } = renderSpine({ done: 0, total: 0, chapters: [] })
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute("aria-valuenow")).toBe("0")
  })
})
