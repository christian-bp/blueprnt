import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { createRef } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { AnalysisSpine } from "@/components/pay-mapping/analysis-spine"

const m = messages.dashboard.payMapping.analysis

function renderSpine(
  overrides: Partial<{
    done: number
    total: number
    chapters: { key: string; done: number; total: number }[]
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

  it("labels the bar without repeating the overall count on screen", () => {
    // The visible surface carries ONE count, the open chapter's, under its
    // own segment. The overall pair used to sit in this heading too, which
    // put two unlabelled number pairs a line apart; the total lives on the
    // run's Overview now.
    const { container } = renderSpine()
    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading.textContent).toContain(m.progressLabel)
    expect(heading.querySelector(".sr-only")).not.toBeNull()
    // Visible heading text is the label alone.
    const visible = [...heading.childNodes]
      .filter(
        (node) =>
          node.nodeType === 3 ||
          !(node as HTMLElement).classList?.contains("sr-only")
      )
      .map((node) => node.textContent)
      .join("")
    expect(visible.trim()).toBe(m.progressLabel)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute("aria-valuenow")).toBe("39")
  })

  it("keeps the overall count as text for a screen reader", () => {
    // The per-chapter figure below is aria-hidden and the bar alone would
    // only announce a percentage, so dropping the visible pair must not
    // drop the fact.
    renderSpine()
    const srOnly = screen
      .getByRole("heading", { level: 3 })
      .querySelector(".sr-only")
    expect(srOnly?.textContent).toContain("12")
    expect(srOnly?.textContent).toContain("31")
  })

  it("weights each chapter's segment by how much work it holds", () => {
    // One chapter carrying 21 of 31 steps must own most of the bar: equal
    // segments would read "2 of 4 chapters done" as halfway when it is a
    // sixth of the work.
    const { container } = renderSpine()
    const bar = container.querySelector('[role="progressbar"]')
    const segments = [...(bar?.children ?? [])] as HTMLElement[]
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

  it("holds the open chapter's segment up and lets the rest recede", () => {
    // The segments and the tab row can never line up (segments are weighted
    // by work, tabs by name length), so simultaneous highlighting is what
    // ties the bar to the chapter you are on.
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
