import { cleanup, render, screen } from "@testing-library/react"
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

  // The title names the section; the reading opposite it is the instrument
  // alone. No figure of its own: the open chapter's tab under this row prints
  // the only pair on the surface.
  it("labels the instrument and carries no figure of its own", () => {
    const { container } = renderSpine()
    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading.textContent).toBe(m.progressLabel)
    expect(heading.querySelector(".sr-only")).toBeNull()
    expect(container.querySelector(".tabular-nums")).toBeNull()
    expect(container.textContent).toBe(m.progressLabel)
    // The screen reader keeps the overall number even though the eye no
    // longer gets one.
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute("aria-valuenow")).toBe("39")
  })

  // A fixed, compact width on the title row, never a bar measuring the page.
  it("holds a fixed compact width on its title row", () => {
    const { container } = renderSpine()
    const tokens = (
      container.querySelector('[role="progressbar"]')?.className ?? ""
    ).split(/\s+/)
    expect(tokens).toContain("w-64")
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

  it("reads zero rather than dividing by zero when nothing is required", () => {
    const { container } = renderSpine({ done: 0, total: 0, chapters: [] })
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute("aria-valuenow")).toBe("0")
  })
})
