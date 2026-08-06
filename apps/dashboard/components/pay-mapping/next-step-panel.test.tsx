import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ANALYSIS_CHAPTERS,
  NextStepPanel,
} from "@/components/pay-mapping/next-step-panel"

const m = messages.dashboard.payMapping.analysis
const tChapters = messages.dashboard.payMapping.review.chapters

function renderPanel(
  overrides: Partial<{
    chapter: (typeof ANALYSIS_CHAPTERS)[number]
    label: string
    remainingAfter: number
    onOpen: () => void
  }> = {}
) {
  const onOpen = overrides.onOpen ?? vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NextStepPanel
        chapter={overrides.chapter ?? "equalWork"}
        label={overrides.label ?? "Software Developer · IC5"}
        remainingAfter={overrides.remainingAfter ?? 19}
        onOpen={onOpen}
      />
    </NextIntlClientProvider>
  )
  return { onOpen }
}

describe("NextStepPanel", () => {
  afterEach(() => {
    cleanup()
  })

  it("names the chapter, the next step and what the work is", () => {
    renderPanel()
    expect(
      screen.getByText(
        m.chapterPosition
          .replace("{position}", "3")
          .replace("{total}", "4")
          .replace("{chapter}", tChapters.equalWork)
      )
    ).toBeDefined()
    expect(
      screen.getByText(
        m.nextStepLabel.replace("{label}", "Software Developer · IC5")
      )
    ).toBeDefined()
    expect(screen.getByText(m.nextAction.equalWork)).toBeDefined()
  })

  it("carries nothing heavier than one button: no chart, no table, no form", () => {
    const { onOpen } = renderPanel()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0] as HTMLElement)
    expect(onOpen).toHaveBeenCalled()
  })

  it("states how much is left after this step, and stays silent on the last one", () => {
    renderPanel({ remainingAfter: 19 })
    expect(screen.getByText("19 steps left after this one")).toBeDefined()
    cleanup()
    renderPanel({ remainingAfter: 1 })
    expect(screen.getByText("1 step left after this one")).toBeDefined()
    cleanup()
    renderPanel({ remainingAfter: 0 })
    expect(screen.queryByText(/left after this one/)).toBeNull()
  })

  it("positions every chapter in the checklist's own order", () => {
    for (const [index, chapter] of ANALYSIS_CHAPTERS.entries()) {
      cleanup()
      renderPanel({ chapter })
      expect(
        screen.getByText(
          m.chapterPosition
            .replace("{position}", String(index + 1))
            .replace("{total}", "4")
            .replace("{chapter}", tChapters[chapter])
        )
      ).toBeDefined()
    }
  })
})
