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
  result: {
    created: number
    updated: number
    unchanged: number
    skipped: number
    reactivated: number
    archived: number
    hourlyPay: number
  } = {
    created: 5,
    updated: 2,
    unchanged: 3,
    skipped: 1,
    reactivated: 0,
    archived: 0,
    hourlyPay: 0,
  }
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

  it("navigates to the classify surface via the primary action", () => {
    renderDone()
    fireEvent.click(screen.getByTestId("go-to-classify"))
    expect(pushMock).toHaveBeenCalledWith("/people/classify")
  })

  it("hides the reactivated and archived rows at zero", () => {
    renderDone()
    expect(screen.queryByTestId("done-reactivated")).toBeNull()
    expect(screen.queryByTestId("done-archived")).toBeNull()
  })

  it("shows the reactivated and archived rows when above zero", () => {
    renderDone({
      created: 0,
      updated: 0,
      unchanged: 9,
      skipped: 0,
      reactivated: 1,
      archived: 4,
      hourlyPay: 0,
    })
    const reactivated = screen.getByTestId("done-reactivated")
    expect(reactivated.textContent).toContain(m.reactivated)
    expect(reactivated.textContent).toContain("1")
    const archived = screen.getByTestId("done-archived")
    expect(archived.textContent).toContain(m.archived)
    expect(archived.textContent).toContain("4")
  })

  it("hides the hourlyPay row at zero", () => {
    renderDone()
    expect(screen.queryByTestId("done-hourlyPay")).toBeNull()
  })

  it("shows the hourlyPay row when above zero", () => {
    renderDone({
      created: 0,
      updated: 0,
      unchanged: 9,
      skipped: 0,
      reactivated: 0,
      archived: 0,
      hourlyPay: 2,
    })
    const hourlyPay = screen.getByTestId("done-hourlyPay")
    expect(hourlyPay.textContent).toContain(m.hourlyPay)
    expect(hourlyPay.textContent).toContain("2")
  })
})
