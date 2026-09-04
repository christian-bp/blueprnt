import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { DatePicker } from "@/components/date-picker"

function picker(value: string, onChange: () => void, disabled = false) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <DatePicker
        value={value}
        onChange={onChange}
        ariaLabel="Start date"
        disabled={disabled}
      />
    </NextIntlClientProvider>
  )
}

function renderPicker(value: string, onChange = vi.fn()) {
  render(picker(value, onChange))
  return onChange
}

async function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: "Start date" }))
  // The caption dropdowns are react-day-picker's native selects.
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: /year/i })).toBeDefined()
  })
}

describe("DatePicker", () => {
  afterEach(() => cleanup())

  it("shows the formatted value on the trigger", () => {
    renderPicker("2015-08-17")
    expect(
      screen.getByRole("button", { name: "Start date" }).textContent
    ).toContain("Aug 17, 2015")
  })

  it("changing the year retargets the selection to the same day", async () => {
    const onChange = renderPicker("2015-08-17")
    await openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: /year/i }), {
      target: { value: "2020" },
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("2020-08-17")
    })
  })

  it("changing the month clamps the day to the new month's length", async () => {
    const onChange = renderPicker("2023-01-31")
    await openPicker()
    const monthSelect = screen.getByRole("combobox", { name: /month/i })
    // react-day-picker month option values are month indexes; February = 1.
    fireEvent.change(monthSelect, { target: { value: "1" } })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("2023-02-28")
    })
  })

  it("with no selection, navigation only navigates", async () => {
    const onChange = renderPicker("")
    await openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: /year/i }), {
      target: { value: "2019" },
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("a disabled picker does not open", () => {
    render(picker("2015-08-17", vi.fn(), true))
    fireEvent.click(screen.getByRole("button", { name: "Start date" }))
    expect(screen.queryByRole("combobox", { name: /year/i })).toBeNull()
  })

  it("locking the surface closes an open picker for good", async () => {
    const onChange = vi.fn()
    const { rerender } = render(picker("2015-08-17", onChange))
    await openPicker()
    rerender(picker("2015-08-17", onChange, true))
    await waitFor(() => {
      expect(screen.queryByRole("combobox", { name: /year/i })).toBeNull()
    })
    // Reopening the run must not pop the panel back open on its own.
    rerender(picker("2015-08-17", onChange, false))
    expect(screen.queryByRole("combobox", { name: /year/i })).toBeNull()
  })

  it("clicking a day still commits and closes", async () => {
    const onChange = renderPicker("2015-08-17")
    await openPicker()
    const day = screen
      .getAllByRole("button")
      .find((candidate) => candidate.textContent === "20")
    expect(day).toBeDefined()
    fireEvent.click(day as HTMLElement)
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("2015-08-20")
    })
  })
})
