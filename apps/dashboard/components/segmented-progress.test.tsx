import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  type ProgressSegment,
  SegmentedProgress,
} from "@/components/segmented-progress"

const BURST = '[data-testid="success-confetti"]'
const TOOLTIP = '[data-slot="tooltip-content"]'

const CHAPTERS: ProgressSegment[] = [
  { key: "start", name: "Collaboration", done: 1, total: 1 },
  { key: "praxis", name: "Practice", done: 4, total: 4 },
  { key: "equalWork", name: "Equal work", done: 7, total: 5 },
  { key: "equivalentWork", name: "Equivalent work", done: 0, total: 21 },
]

function renderBar(
  overrides: Partial<Parameters<typeof SegmentedProgress>[0]> = {}
) {
  return render(
    <SegmentedProgress
      barLabel="Overall progress"
      done={12}
      total={31}
      segments={CHAPTERS}
      renderCount={(segment) => `${segment.done} of ${segment.total}`}
      {...overrides}
    />
  )
}

const segmentsOf = (container: HTMLElement) =>
  [
    ...(container.querySelector('[role="progressbar"]')?.children ?? []),
  ] as HTMLElement[]

describe("SegmentedProgress", () => {
  afterEach(cleanup)

  // Chapters are stations, so their widths say nothing about the work behind
  // them: the fixture's totals run 1, 4, 5 and 21 and every segment is the
  // same width. The one geometry there is, for both guided sections.
  it("gives every segment the same width whatever it holds", () => {
    const { container } = renderBar()
    const segments = segmentsOf(container)
    expect(segments).toHaveLength(4)
    expect(segments.map((segment) => segment.style.flexGrow)).toEqual([
      "1",
      "1",
      "1",
      "1",
    ])
    // A finished chapter's fill runs the whole segment; an untouched one
    // shows none. This is where a chapter's own progress reads, and it is per
    // chapter, so an equal width costs nothing.
    const fillOf = (segment: HTMLElement | undefined) =>
      (segment?.querySelector(".bg-primary") as HTMLElement | null)?.style.width
    expect(fillOf(segments[1])).toBe("100%")
    expect(fillOf(segments[3])).toBe("0%")
  })

  // A fixed, compact width: the instrument states where the journey stands,
  // it does not measure the page, and it never shrinks below its own size on
  // a narrow viewport.
  it("holds a fixed compact width rather than filling its row", () => {
    const { container } = renderBar()
    const bar = container.querySelector('[role="progressbar"]')
    const tokens = (bar?.className ?? "").split(/\s+/)
    expect(tokens).toContain("w-52")
    expect(tokens).toContain("shrink-0")
    expect(tokens).not.toContain("w-full")
  })

  // Nothing annotates the instrument: no name over a segment, no figure under
  // one. At this size those are what the surface around it already says, and
  // the hover is where a chapter answers for itself.
  it("draws no annotation rows of its own", () => {
    const { container } = renderBar({ activeSegment: "praxis" })
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(container.textContent).toBe("")
  })

  // Equal widths must not launder a skewed journey into a flattering number:
  // the honesty moved to the announced percentage, which is work done over the
  // whole journey and not chapters closed.
  it("announces the work-weighted percentage, not the chapter count", () => {
    const { container } = renderBar({
      done: 22,
      total: 29,
      segments: [
        { key: "criteria", name: "Criteria", done: 21, total: 21 },
        { key: "weighting", name: "Weighting", done: 1, total: 1 },
        { key: "method", name: "Method", done: 0, total: 6 },
        { key: "approval", name: "Approval", done: 0, total: 1 },
      ],
    })
    // Two of four chapters done, but 22 of 29 steps: 76%, not 50%.
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-valuenow")
    ).toBe("76")
  })

  it("announces the journey's own percentage under its own name", () => {
    const { container } = renderBar()
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute("aria-label")).toBe("Overall progress")
    expect(bar?.getAttribute("aria-valuenow")).toBe("39")
  })

  it("reads zero rather than dividing by zero when nothing is required", () => {
    const { container } = renderBar({ done: 0, total: 0, segments: [] })
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-valuenow")
    ).toBe("0")
  })

  it("holds the open segment up and lets the rest recede", () => {
    const { container } = renderBar({ activeSegment: "equalWork" })
    expect(segmentsOf(container).map((s) => s.dataset.active)).toEqual([
      "false",
      "false",
      "true",
      "false",
    ])
  })

  // With no segment open, dimming three quarters of the bar would say
  // something untrue about where the reader is.
  it("reads the whole bar at full strength with no open segment", () => {
    const { container } = renderBar()
    expect(
      segmentsOf(container).every((s) => s.dataset.active === "true")
    ).toBe(true)
  })

  // A sliver two pixels tall is not a shape anyone can read a chapter off, so
  // resting on one answers both questions at once. The tab row under the bar
  // is what names the chapters on screen; this is the same fact where the
  // pointer already is.
  it("names a hovered chapter and states where it stands", async () => {
    const { container } = renderBar({ activeSegment: "praxis" })
    expect(document.querySelector(TOOLTIP)).toBeNull()

    const closed = segmentsOf(container)[3]
    if (closed === undefined) throw new Error("no segment")
    fireEvent.pointerEnter(closed, { pointerType: "mouse" })
    fireEvent.mouseEnter(closed)

    await waitFor(() => {
      const tooltip = document.querySelector(TOOLTIP)
      expect(tooltip?.textContent).toContain("Equivalent work")
      expect(tooltip?.textContent).toContain("0 of 21")
    })
  })

  // The open chapter is not an exception: its own hover answers too, so the
  // gesture means the same thing on all four.
  it("answers on the open chapter as well", async () => {
    const { container } = renderBar({ activeSegment: "praxis" })
    const open = segmentsOf(container)[1]
    if (open === undefined) throw new Error("no segment")
    fireEvent.pointerEnter(open, { pointerType: "mouse" })
    fireEvent.mouseEnter(open)
    await waitFor(() => {
      const tooltip = document.querySelector(TOOLTIP)
      expect(tooltip?.textContent).toContain("Practice")
      expect(tooltip?.textContent).toContain("4 of 4")
    })
  })
})

// The same celebration the overview to-do row throws (CelebrationBurst), over
// a segment the instant it finishes. Opt-in and transition-only: see
// celebration-burst.test.tsx for the burst itself and todo-actions.test.tsx
// for the row's own arrival version.
describe("SegmentedProgress celebration", () => {
  afterEach(cleanup)

  function oneSegment(done: number, total = 4): ProgressSegment[] {
    return [{ key: "only", name: "Only", done, total }]
  }

  it("fires when a mounted segment crosses from incomplete to complete", async () => {
    const { container, rerender } = renderBar({
      done: 1,
      total: 4,
      segments: oneSegment(1),
      celebrateOnComplete: true,
    })
    expect(container.querySelector(BURST)).toBeNull()

    rerender(
      <SegmentedProgress
        barLabel="Overall progress"
        done={4}
        total={4}
        segments={oneSegment(4)}
        renderCount={(segment) => `${segment.done} of ${segment.total}`}
        celebrateOnComplete
      />
    )
    await waitFor(() => {
      expect(container.querySelector(BURST)).not.toBeNull()
    })
  })

  it("never fires for a segment that is already complete on mount", () => {
    const { container } = renderBar({
      done: 4,
      total: 4,
      segments: oneSegment(4),
      celebrateOnComplete: true,
    })
    // No waitFor: nothing here is on a timer or a frame, so whatever is true
    // once mount's effects have flushed is true for good.
    expect(container.querySelector(BURST)).toBeNull()
  })

  it("fires a second time for a different segment, independently of the first", async () => {
    const start: ProgressSegment[] = [
      { key: "a", name: "A", done: 1, total: 2 },
      { key: "b", name: "B", done: 0, total: 2 },
    ]
    const { container, rerender } = renderBar({
      done: 1,
      total: 4,
      segments: start,
      celebrateOnComplete: true,
    })

    rerender(
      <SegmentedProgress
        barLabel="Overall progress"
        done={2}
        total={4}
        segments={[
          { key: "a", name: "A", done: 2, total: 2 },
          { key: "b", name: "B", done: 0, total: 2 },
        ]}
        renderCount={(segment) => `${segment.done} of ${segment.total}`}
        celebrateOnComplete
      />
    )
    await waitFor(() => {
      expect(container.querySelectorAll(BURST)).toHaveLength(1)
    })

    rerender(
      <SegmentedProgress
        barLabel="Overall progress"
        done={4}
        total={4}
        segments={[
          { key: "a", name: "A", done: 2, total: 2 },
          { key: "b", name: "B", done: 2, total: 2 },
        ]}
        renderCount={(segment) => `${segment.done} of ${segment.total}`}
        celebrateOnComplete
      />
    )
    // Both fire: the second segment's own crossing, and the first segment's
    // burst still parked from its own earlier one.
    await waitFor(() => {
      expect(container.querySelectorAll(BURST)).toHaveLength(2)
    })
  })

  it("renders no celebration markup at all without the prop, even across a completing transition", () => {
    const { container, rerender } = renderBar({
      done: 1,
      total: 4,
      segments: oneSegment(1),
    })
    rerender(
      <SegmentedProgress
        barLabel="Overall progress"
        done={4}
        total={4}
        segments={oneSegment(4)}
        renderCount={(segment) => `${segment.done} of ${segment.total}`}
      />
    )
    expect(container.querySelector(BURST)).toBeNull()
  })
})
