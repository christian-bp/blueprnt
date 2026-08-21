import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { SegmentedProgress } from "@/components/segmented-progress"

const BURST = '[data-testid="success-confetti"]'

const CHAPTERS = [
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

  // One chapter carrying 21 of 31 steps must own most of the bar: equal
  // segments would read "2 of 4 chapters done" as halfway when it is a sixth
  // of the work. This is the rule both guided sections share, which is why it
  // is tested here rather than twice.
  it("weights each segment by how much work it holds", () => {
    const { container } = renderBar()
    const segments = segmentsOf(container)
    expect(segments).toHaveLength(4)
    expect(segments[0]?.style.flexGrow).toBe("1")
    expect(segments[3]?.style.flexGrow).toBe("21")
    // A finished chapter's fill runs the whole segment; an untouched one
    // shows none.
    expect(
      (segments[1]?.firstElementChild as HTMLElement | null)?.style.width
    ).toBe("100%")
    expect(
      (segments[3]?.firstElementChild as HTMLElement | null)?.style.width
    ).toBe("0%")
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

  // The count belongs to the open segment and sits under it, which is what
  // makes "1 of 3" mean that chapter rather than the journey.
  it("shows only the open segment's own count, in the caller's words", () => {
    const { container, getByText } = renderBar({ activeSegment: "praxis" })
    expect(getByText("4 of 4")).toBeDefined()
    // The reserved row keeps its height whichever segment is open, so lighting
    // one up never reflows the page.
    const countRow = container.querySelector('[aria-hidden="true"]')
    expect(countRow?.className).toContain("h-4")
    expect(countRow?.textContent).toBe("4 of 4")
  })
})

// The same celebration the overview to-do row throws (CelebrationBurst), over
// a segment the instant it finishes. Opt-in and transition-only: see
// celebration-burst.test.tsx for the burst itself and todo-actions.test.tsx
// for the row's own arrival version.
describe("SegmentedProgress celebration", () => {
  afterEach(cleanup)

  function oneSegment(done: number, total = 4) {
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
    const start = [
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
        segments={[
          { key: "a", done: 2, total: 2 },
          { key: "b", done: 0, total: 2 },
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
          { key: "a", done: 2, total: 2 },
          { key: "b", done: 2, total: 2 },
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
