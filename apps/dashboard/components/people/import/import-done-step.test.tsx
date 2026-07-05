import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ImportDoneStep } from "./import-done-step"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

const m = messages.dashboard.people.import.done

function renderDone(
  result = { created: 5, updated: 2, unchanged: 3, skipped: 1 } as const
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ImportDoneStep result={result} />
    </NextIntlClientProvider>
  )
}

describe("ImportDoneStep", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("shows the created, updated, and skipped counts with their labels", () => {
    renderDone()
    const created = screen.getByTestId("done-created")
    expect(created.textContent).toContain(m.created)
    expect(created.textContent).toContain("5")
    const updated = screen.getByTestId("done-updated")
    expect(updated.textContent).toContain(m.updated)
    expect(updated.textContent).toContain("2")
    const unchanged = screen.getByTestId("done-unchanged")
    expect(unchanged.textContent).toContain(m.unchanged)
    expect(unchanged.textContent).toContain("3")
    const skipped = screen.getByTestId("done-skipped")
    expect(skipped.textContent).toContain(m.skipped)
    expect(skipped.textContent).toContain("1")
  })

  it("navigates to the people list via the primary action", () => {
    renderDone()
    fireEvent.click(screen.getByTestId("go-to-people"))
    expect(pushMock).toHaveBeenCalledWith("/people")
  })
})
