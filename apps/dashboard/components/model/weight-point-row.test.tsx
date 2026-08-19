import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WeightPointRow } from "@/components/model/weight-point-row"

const build = messages.dashboard.model.build

function renderRow(value: number, onChange = vi.fn(), disabled = false) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WeightPointRow
        name="Problem solving"
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </NextIntlClientProvider>
  )
  return {
    onChange,
    group: screen.getByRole("group", {
      name: build.setWeightPoints.replace("{name}", "Problem solving"),
    }),
  }
}

describe("WeightPointRow", () => {
  afterEach(cleanup)

  // The allocation is 1-5 weight points under a fixed budget (ADR-0004), so
  // the control offers exactly the five values and nothing in between. They
  // run low to high, the direction every other scale in the product reads,
  // including this row's own hover copy.
  it("offers the five weight points ascending and presses the current one", () => {
    const { group } = renderRow(4)
    const options = within(group).getAllByRole("button")
    expect(options.map((option) => option.textContent)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ])
    expect(
      options.map((option) => option.getAttribute("aria-pressed"))
    ).toEqual(["false", "false", "false", "true", "false"])
  })

  it("reports the point the user picked", () => {
    const { group, onChange } = renderRow(4)
    fireEvent.click(within(group).getByRole("button", { name: "2" }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it("takes no input while the allocation is being saved", () => {
    const { group, onChange } = renderRow(4, vi.fn(), true)
    for (const option of within(group).getAllByRole("button")) {
      expect((option as HTMLButtonElement).disabled).toBe(true)
    }
    fireEvent.click(within(group).getByRole("button", { name: "2" }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
