import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  type ProgressSegment,
  SegmentedProgress,
} from "@/components/segmented-progress"

const BURST = '[data-testid="success-confetti"]'

const CHAPTERS: ProgressSegment[] = [
  { key: "start", done: 1, total: 1 },
  { key: "praxis", done: 4, total: 4 },
  { key: "equalWork", done: 7, total: 5 },
  { key: "equivalentWork", done: 0, total: 21 },
]

function renderBar(
  overrides: Partial<Parameters<typeof SegmentedProgress>[0]> = {}
) {
  return render(
    <SegmentedProgress
      barLabel="Overall progress"
      done={12}
      total={31}
      renderCount={(segment) => `${segment.done} of ${segment.total}`}
      renderTitle={(segment) => segment.key}
      segments={CHAPTERS}
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
    const tokens = (container.firstElementChild?.className ?? "").split(/\s+/)
    expect(tokens).toContain("w-[28rem]")
    expect(tokens).toContain("shrink-0")
    expect(tokens).not.toContain("w-full")
    // It floats over the page, so anything it covers stays clickable through
    // it: the instrument is a shape, never a control.
    expect(tokens).toContain("pointer-events-none")
  })

  // The open chapter's own NAME, above its own segment. Only the open one: a
  // name on all four is the tab row's job, and the instrument would be
  // repeating it.
  it("names the open chapter above its own segment", () => {
    const { container } = renderBar({ activeSegment: "praxis" })
    const titleRow = container.querySelector(
      '[aria-hidden="true"][class*="h-4"]'
    )
    expect(
      [...(titleRow?.children ?? [])].map(
        (slot) => (slot as HTMLElement).style.flexGrow
      )
    ).toEqual(["1", "1", "1", "1"])
    expect(
      [...(titleRow?.children ?? [])].map((slot) => slot.textContent)
    ).toEqual(["", "praxis", "", ""])
  })

  // Two reserved lines, mirrored around the bar: the name above, the figures
  // below. Both hold their height with no chapter open, so the rail's total
  // height is constant and the pills stacked above it never move.
  it("reserves a line above and below the bar, whatever is open", () => {
    const { container } = renderBar()
    const lines = container.querySelectorAll(
      '[aria-hidden="true"][class*="h-4"]'
    )
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(line.textContent).toBe("")
      expect(line.children).toHaveLength(4)
    }
    // The bar sits between them.
    const bar = container.querySelector('[role="progressbar"]')
    expect(lines[0]?.nextElementSibling).toBe(bar)
    expect(bar?.nextElementSibling).toBe(lines[1])
  })

  // The one annotation the instrument carries: the OPEN chapter's own pair,
  // under its own segment, on a line that is always there.
  it("counts the open chapter under its own segment", () => {
    const { container } = renderBar({ activeSegment: "praxis" })
    const countRow = container.querySelectorAll(
      '[aria-hidden="true"][class*="h-4"]'
    )[1]
    // Reserved height, one slot per segment on the bar's own flex, so the
    // figure sits beneath the part of the bar it describes.
    expect(
      [...(countRow?.children ?? [])].map(
        (slot) => (slot as HTMLElement).style.flexGrow
      )
    ).toEqual(["1", "1", "1", "1"])
    // Only the open chapter's slot is filled.
    expect(
      [...(countRow?.children ?? [])].map((slot) => slot.textContent)
    ).toEqual(["", "4 of 4", "", ""])
  })

  // The line holds its height with no chapter open, so a figure sliding in
  // never pushes the title row up or the journey row below it down.
  // Nothing annotates the instrument, in any direction: no name over a
  // segment, no figure under one, and nothing to hover. Everything it could
  // have said is said by the tab row under it, whose open tab prints that
  // chapter's own figures.
  // The segments themselves stay a shape: the only text the instrument holds
  // is the count line under it, and nothing in it can be hovered or clicked.
  it("keeps the bar itself textless and non-interactive", () => {
    const { container } = renderBar({ activeSegment: "praxis" })
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.textContent).toBe("")
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeNull()
    expect(container.querySelector("button")).toBeNull()
    expect(container.querySelector("a")).toBeNull()
  })

  // Equal widths must not launder a skewed journey into a flattering number:
  // the honesty moved to the announced percentage, which is work done over the
  // whole journey and not chapters closed.
  it("announces the work-weighted percentage, not the chapter count", () => {
    const { container } = renderBar({
      done: 22,
      total: 29,
      segments: [
        { key: "criteria", done: 21, total: 21 },
        { key: "weighting", done: 1, total: 1 },
        { key: "method", done: 0, total: 6 },
        { key: "approval", done: 0, total: 1 },
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
})

// The same celebration the overview to-do row throws (CelebrationBurst), over
// a segment the instant it finishes. Opt-in and transition-only: see
// celebration-burst.test.tsx for the burst itself and todo-actions.test.tsx
// for the row's own arrival version.
describe("SegmentedProgress celebration", () => {
  afterEach(cleanup)

  function oneSegment(done: number, total = 4): ProgressSegment[] {
    return [{ key: "only", done, total }]
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
        renderCount={(segment) => `${segment.done} of ${segment.total}`}
        renderTitle={(segment) => segment.key}
        segments={oneSegment(4)}
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
      { key: "a", done: 1, total: 2 },
      { key: "b", done: 0, total: 2 },
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
        renderCount={(segment) => `${segment.done} of ${segment.total}`}
        renderTitle={(segment) => segment.key}
        segments={[
          { key: "a", done: 2, total: 2 },
          { key: "b", done: 0, total: 2 },
        ]}
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
        renderCount={(segment) => `${segment.done} of ${segment.total}`}
        renderTitle={(segment) => segment.key}
        segments={[
          { key: "a", done: 2, total: 2 },
          { key: "b", done: 2, total: 2 },
        ]}
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
        renderCount={(segment) => `${segment.done} of ${segment.total}`}
        renderTitle={(segment) => segment.key}
        segments={oneSegment(4)}
      />
    )
    expect(container.querySelector(BURST)).toBeNull()
  })
})
