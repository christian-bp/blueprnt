import { cleanup, render, screen, waitFor } from "@testing-library/react"
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

  // The heading names what the section is building; the reading opposite it
  // is the instrument alone. No figure of its own: the open chapter's tab
  // under this row prints the only pair on the surface.
  it("names the model and carries the instrument as its only reading", () => {
    const { container } = renderSpine()
    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading.textContent).toBe(m.heading)
    expect(heading.querySelector(".sr-only")).toBeNull()
    expect(container.querySelector(".tabular-nums")).toBeNull()
    expect(container.textContent).toBe(m.heading)
    // The screen reader keeps the overall number even though the eye no
    // longer gets one.
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-valuenow")
    ).toBe(String(Math.round((4 / 17) * 100)))
  })

  // A fixed width on the title row, never a bar measuring the page, and the
  // same width in both guided sections.
  it("holds a fixed width on its title row", () => {
    const { container } = renderSpine()
    const tokens = (
      container.querySelector('[role="progressbar"]')?.className ?? ""
    ).split(/\s+/)
    expect(tokens).toContain("w-64")
    expect(tokens).toContain("shrink-0")
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

  // Nothing annotates the instrument, in any direction: no figure beside it,
  // none under a segment, and nothing to hover. The tab row under this one is
  // where a chapter's own figures are read.
  it("annotates the instrument in no direction at all", () => {
    const { container } = renderSpine({ activeChapter: "method" })
    expect(container.querySelector(".tabular-nums")).toBeNull()
    expect(
      container.querySelector('[aria-hidden="true"][class*="h-4"]')
    ).toBeNull()
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeNull()
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
