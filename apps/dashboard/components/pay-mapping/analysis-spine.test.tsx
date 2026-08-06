import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AnalysisSpine } from "@/components/pay-mapping/analysis-spine"

const m = messages.dashboard.payMapping.analysis

function renderSpine(
  overrides: Partial<{
    done: number
    total: number
    collaboration: { participants: string; description: string } | null
    onOpenCollaboration: () => void
  }> = {}
) {
  const onOpenCollaboration = overrides.onOpenCollaboration ?? vi.fn()
  const result = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AnalysisSpine
        done={overrides.done ?? 12}
        total={overrides.total ?? 31}
        collaboration={
          "collaboration" in overrides
            ? (overrides.collaboration ?? null)
            : { participants: "Anna Berg, Karin Ek", description: "Meetings" }
        }
        onOpenCollaboration={onOpenCollaboration}
        headingRef={createRef<HTMLHeadingElement>()}
      />
    </NextIntlClientProvider>
  )
  return { ...result, onOpenCollaboration }
}

describe("AnalysisSpine", () => {
  afterEach(() => {
    cleanup()
  })

  it("states where the whole mapping stands, with the count and the bar", () => {
    const { container } = renderSpine()
    // The heading IS the standing: no second page title, the count inside
    // it. (NumberFlow renders its digits into the DOM.)
    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading.textContent).toContain(m.progressLabel)
    expect(heading.textContent).toContain("12")
    expect(heading.textContent).toContain("31")
    expect(screen.getByText(m.lead)).toBeDefined()
    const readout = container.querySelector(".tabular-nums")
    expect(readout?.textContent).toContain("12")
    expect(readout?.textContent).toContain("31")
    const bar = container.querySelector('[data-slot="progress"]')
    expect(bar?.getAttribute("aria-valuenow")).toBe("39")
  })

  it("reads zero rather than dividing by zero when nothing is required", () => {
    const { container } = renderSpine({ done: 0, total: 0 })
    const bar = container.querySelector('[data-slot="progress"]')
    expect(bar?.getAttribute("aria-valuenow")).toBe("0")
  })

  it("shows the recorded samverkan participants and opens the start step", () => {
    const { onOpenCollaboration } = renderSpine()
    expect(screen.getByText("Anna Berg, Karin Ek")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: m.collaborationChange }))
    expect(onOpenCollaboration).toHaveBeenCalled()
  })

  it("says samverkan is missing rather than rendering an empty line", () => {
    renderSpine({ collaboration: null })
    expect(screen.getByText(m.collaborationEmpty)).toBeDefined()
    expect(
      screen.getByRole("button", { name: m.collaborationAdd })
    ).toBeDefined()
  })

  it("treats a blank participants record as not recorded", () => {
    renderSpine({ collaboration: { participants: "   ", description: "x" } })
    expect(screen.getByText(m.collaborationEmpty)).toBeDefined()
  })
})
