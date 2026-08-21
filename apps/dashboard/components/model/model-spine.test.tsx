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

// The reserved-height strip the shared bar renders under its segments. Matched
// on its own box, not on a bare aria-hidden: the help trigger's icon carries
// that attribute too and comes first in the DOM.
const countRowOf = (container: HTMLElement) =>
  container.querySelector('[aria-hidden="true"][class*="h-4"]')

// The reserved-height strip ABOVE the bar, carrying the open chapter's name.
// Matched on its own box for the same reason the count row is.
const titleRowOf = (container: HTMLElement) =>
  container.querySelector('[aria-hidden="true"][class*="h-5"]')

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

  // The heading names what the section is building; the progress reading is
  // the bar below it and its per-chapter counts.
  it("names the model and keeps the overall count for a screen reader only", () => {
    renderSpine()
    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading.textContent).toContain(m.heading)
    const srOnly = heading.querySelector(".sr-only")
    expect(srOnly?.textContent).toContain("4")
    expect(srOnly?.textContent).toContain("17")
    // Visible heading text is the label alone: two unlabelled pairs of numbers
    // a line apart read as clutter.
    const visible = [...heading.childNodes]
      .filter(
        (node) =>
          node.nodeType === 3 ||
          !(node as HTMLElement).classList?.contains("sr-only")
      )
      .map((node) => node.textContent)
      .join("")
    expect(visible.trim()).toBe(m.heading)
  })

  // Metod carries a step per criterion plus the materiality decision, so it is
  // the widest segment: the weighting is what makes that honest rather than
  // "one chapter of four".
  it("weights the chapters' segments by the work they hold", () => {
    const { container } = renderSpine()
    const segments = [
      ...(container.querySelector('[role="progressbar"]')?.children ?? []),
    ] as HTMLElement[]
    expect(segments.map((segment) => segment.style.flexGrow)).toEqual([
      "6",
      "3",
      "7",
      "1",
    ])
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-label")
    ).toBe(m.progressBarLabel)
  })

  // The open chapter's name sits ABOVE the bar, over its own segment, and its
  // count keeps the mirror position below: the reader gets the name and the
  // figures without matching either against the tab row by position, and
  // neither row has to carry both.
  it("names the open chapter above the bar and counts it below", () => {
    const { container } = renderSpine({ activeChapter: "method" })
    expect(titleRowOf(container)?.textContent).toContain(m.method)
    const countRow = countRowOf(container)
    expect(countRow?.textContent).toContain("1")
    expect(countRow?.textContent).toContain("7")
    // The name is the title row's job alone, so the count row does not repeat
    // it, and neither row carries a chapter that is not open.
    expect(countRow?.textContent).not.toContain(m.method)
    expect(titleRowOf(container)?.textContent).not.toContain(m.criteria)
  })

  it("switches the name with the chapter", () => {
    const { container } = renderSpine({ activeChapter: "criteria" })
    expect(titleRowOf(container)?.textContent).toContain(m.criteria)
    expect(titleRowOf(container)?.textContent).not.toContain(m.method)
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
