import { cleanup, render, screen } from "@testing-library/react"
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

  it("labels the bar and keeps the overall count for a screen reader only", () => {
    renderSpine()
    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading.textContent).toContain(m.progressLabel)
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
    expect(visible.trim()).toBe(m.progressLabel)
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

  it("shows the open chapter's own count under its own segment", () => {
    renderSpine({ activeChapter: "method" })
    expect(screen.getByText("1")).toBeDefined()
    expect(screen.getByText("7")).toBeDefined()
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
})
