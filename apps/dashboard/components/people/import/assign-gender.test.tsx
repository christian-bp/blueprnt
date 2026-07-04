import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AssignGender } from "./assign-gender"

const m = messages.dashboard.people.import

function renderAssign({
  flagged = [
    { externalRef: "E001", rowIndex: 0 },
    { externalRef: "E014", rowIndex: 3 },
  ],
  value = {},
  onChange = vi.fn(),
}: {
  flagged?: Array<{ externalRef: string; rowIndex: number }>
  value?: Record<string, "Man" | "Kvinna">
  onChange?: (next: Record<string, "Man" | "Kvinna">) => void
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssignGender flagged={flagged} value={value} onChange={onChange} />
    </NextIntlClientProvider>
  )
}

describe("AssignGender", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders one control row per flagged externalRef", () => {
    renderAssign()
    expect(screen.getByTestId("assign-gender-E001")).toBeDefined()
    expect(screen.getByTestId("assign-gender-E014")).toBeDefined()
  })

  it("shows the Man and Kvinna option labels", () => {
    renderAssign()
    expect(screen.getAllByText(m.gender.Man).length).toBeGreaterThan(0)
    expect(screen.getAllByText(m.gender.Kvinna).length).toBeGreaterThan(0)
  })

  it("calls onChange with the ref -> choice map when a gender is picked", () => {
    const onChange = vi.fn()
    renderAssign({ onChange })
    fireEvent.click(screen.getByTestId("assign-gender-E001-Kvinna"))
    expect(onChange).toHaveBeenCalledWith({ E001: "Kvinna" })
  })

  it("merges a second choice into the existing map (last-wins per ref)", () => {
    const onChange = vi.fn()
    renderAssign({ value: { E001: "Kvinna" }, onChange })
    fireEvent.click(screen.getByTestId("assign-gender-E014-Man"))
    expect(onChange).toHaveBeenCalledWith({ E001: "Kvinna", E014: "Man" })
  })
})
