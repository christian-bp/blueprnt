import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

// NumberFlow renders a custom element happy-dom never upgrades, so its
// getSnapshotBeforeUpdate throws the moment the value CHANGES in place. The
// digit animation is the library's business; this test is about the figures.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { ModelSpine } from "@/components/model/model-spine"

const m = messages.dashboard.model.chapters
const mProgress = messages.dashboard.progress

// The bar's own segments, in chapter order.
const segmentsOf = (container: HTMLElement) =>
  [
    ...(container.querySelector('[role="progressbar"]')?.children ?? []),
  ] as HTMLElement[]

function renderSpine(
  overrides: Partial<Parameters<typeof ModelSpine>[0]> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelSpine
        done={4}
        total={17}
        chapters={[
          { key: "criteria", done: 6, total: 6 },
          { key: "weighting", done: 3, total: 3 },
          { key: "method", done: 1, total: 7 },
          { key: "approval", done: 0, total: 1 },
        ]}
        {...overrides}
      />
    </NextIntlClientProvider>
  )
}

describe("ModelSpine", () => {
  afterEach(cleanup)

  // The heading names what the section is building; the reading is the
  // instrument opposite it on the same row.
  it("names the model and states its own progress on the title row", () => {
    const { container } = renderSpine()
    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading.textContent).toBe(m.heading)
    // The counter is on screen now, so it is no longer a screen reader's own
    // copy of the pair.
    expect(heading.querySelector(".sr-only")).toBeNull()
    // 4 of 17: the same work units the announced percentage is computed from,
    // so eye and ear agree.
    const counter = container.querySelector(".tabular-nums")
    expect(counter?.textContent).toBe("4 of 17")
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-valuenow")
    ).toBe(String(Math.round((4 / 17) * 100)))
    // Both figures move while the reader works, so each is its OWN element
    // carrying NumberFlow rather than text interpolated into the sentence
    // (the mock above stands in for it). A concatenated string would leave
    // this row empty.
    expect(
      [...(counter?.children ?? [])].map((node) => node.textContent)
    ).toEqual(["4", "17"])
  })

  // This section's chapters are stations of one build, so they are equally
  // wide whatever they hold: Metod carries a step per criterion and would
  // otherwise be most of the bar.
  it("gives every chapter the same width whatever it holds", () => {
    const { container } = renderSpine()
    const segments = [
      ...(container.querySelector('[role="progressbar"]')?.children ?? []),
    ] as HTMLElement[]
    expect(segments.map((segment) => segment.style.flexGrow)).toEqual([
      "1",
      "1",
      "1",
      "1",
    ])
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-label")
    ).toBe(m.progressBarLabel)
  })

  // Equal segments are geometry only: the announced figure is still the work
  // done over the whole model, so a section of four chapters where one holds
  // seven steps cannot read as further along than it is.
  it("still announces the work-weighted percentage", () => {
    const { container } = renderSpine()
    // 4 of 17 steps, not 2 of 4 chapters.
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-valuenow")
    ).toBe("24")
  })

  // Nothing annotates the instrument: no per-chapter figure under it. The
  // counter beside it is the JOURNEY's, and a chapter answers for itself on
  // hover.
  it("prints no per-chapter figure beside the instrument", () => {
    const { container } = renderSpine({ activeChapter: "method" })
    const counter = container.querySelector(".tabular-nums")
    expect(counter?.textContent).toBe("4 of 17")
    expect(
      container.querySelector('[aria-hidden="true"][class*="h-4"]')
    ).toBeNull()
  })

  // A segment is two pixels tall and carries no name of its own, so resting
  // on one answers both questions at once: which chapter, and where it
  // stands.
  it("names a hovered chapter and states where it stands", async () => {
    const { container } = renderSpine({ activeChapter: "criteria" })
    const segment = segmentsOf(container)[2]
    if (segment === undefined) throw new Error("no segment")
    fireEvent.pointerEnter(segment, { pointerType: "mouse" })
    fireEvent.mouseEnter(segment)
    await waitFor(() => {
      const tooltip = document.querySelector('[data-slot="tooltip-content"]')
      expect(tooltip?.textContent).toContain(m.method)
      expect(tooltip?.textContent).toContain("1")
      expect(tooltip?.textContent).toContain("7")
    })
  })

  // The section's own explainer, not the kartläggning's: two guided sections
  // count different things.
  it("explains what the bar counts", () => {
    renderSpine()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.modelProgressLabel,
      })
    ).toBeDefined()
  })

  // "17 of 17" is a sum that has stopped being a reading: it asks the reader
  // to compare two numbers to learn a fact the section can simply state.
  it("says the word instead of counting itself once nothing is left", () => {
    const { container } = renderSpine({
      done: 17,
      total: 17,
      chapters: [
        { key: "criteria", done: 6, total: 6 },
        { key: "weighting", done: 3, total: 3 },
        { key: "method", done: 7, total: 7 },
        { key: "approval", done: 1, total: 1 },
      ],
    })
    expect(screen.getByText(mProgress.done)).toBeDefined()
    // The pair is gone, not merely joined by the word.
    expect(container.textContent).not.toContain("17 of 17")
    expect(container.querySelector(".tabular-nums")).toBeNull()
    // The success ink the Metod cards' signed-off status already uses; the
    // word alone, because at this size a mark beside it reads as decoration.
    const word = screen.getByText(mProgress.done)
    expect(word.className).toContain("text-success")
    expect(word.querySelector("svg")).toBeNull()
    // The announced percentage is untouched by the visual word.
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-valuenow")
    ).toBe("100")
  })

  // A model can move backwards: an approval reopens, a criterion is removed.
  // The counter has to come back with it, numbers and all.
  it("counts itself again when a finished model reopens", async () => {
    const finished = [
      { key: "criteria" as const, done: 6, total: 6 },
      { key: "weighting" as const, done: 3, total: 3 },
      { key: "method" as const, done: 7, total: 7 },
      { key: "approval" as const, done: 1, total: 1 },
    ]
    const { container, rerender } = renderSpine({
      done: 17,
      total: 17,
      chapters: finished,
    })
    expect(screen.getByText(mProgress.done)).toBeDefined()

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ModelSpine
          done={16}
          total={17}
          chapters={[
            ...finished.slice(0, 3),
            {
              key: "approval" as const,
              done: 0,
              total: 1,
            },
          ]}
        />
      </NextIntlClientProvider>
    )
    await waitFor(() => {
      expect(container.querySelector(".tabular-nums")?.textContent).toBe(
        "16 of 17"
      )
      expect(screen.queryByText(mProgress.done)).toBeNull()
    })
  })

  // An empty journey is not a finished one: a section whose data has not
  // arrived reads 0 of 0, and congratulating that would be the first thing it
  // ever said.
  it("does not congratulate a journey with no work in it", () => {
    const { container } = renderSpine({ done: 0, total: 0, chapters: [] })
    expect(screen.queryByText(mProgress.done)).toBeNull()
    expect(container.querySelector(".tabular-nums")?.textContent).toBe("0 of 0")
  })

  // The model spine is the one guided section that opts SegmentedProgress
  // into its shared celebration (the kartläggning's analysis spine does
  // not): a chapter finishing plays the same burst a finished to-do card
  // does.
  it("celebrates a chapter that crosses from incomplete to complete", async () => {
    const chapters = [
      { key: "criteria" as const, done: 5, total: 6 },
      { key: "weighting" as const, done: 3, total: 3 },
      { key: "method" as const, done: 1, total: 7 },
      { key: "approval" as const, done: 0, total: 1 },
    ]
    const { container, rerender } = renderSpine({ chapters })
    expect(
      container.querySelector('[data-testid="success-confetti"]')
    ).toBeNull()

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ModelSpine
          done={5}
          total={17}
          chapters={[
            { key: "criteria", done: 6, total: 6 },
            { key: "weighting", done: 3, total: 3 },
            { key: "method", done: 1, total: 7 },
            { key: "approval", done: 0, total: 1 },
          ]}
        />
      </NextIntlClientProvider>
    )
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="success-confetti"]')
      ).not.toBeNull()
    })
  })
})
