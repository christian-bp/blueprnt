import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { FamilyFilter } from "@/components/bands/family-filter"

const OPTIONS = [
  { id: "f1", name: "Engineering" },
  { id: "f2", name: "Sales" },
]

function renderFilter(hidden: Set<string>, onHiddenChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamilyFilter
        options={OPTIONS}
        hidden={hidden}
        onHiddenChange={onHiddenChange}
      />
    </NextIntlClientProvider>
  )
  return onHiddenChange
}

// Radix menus open on pointerdown + click (the nav-user.test idiom).
function openMenu() {
  const trigger = screen.getByRole("button")
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(trigger)
}

describe("FamilyFilter", () => {
  afterEach(() => cleanup())

  it("labels the trigger 'All families' when nothing is hidden", () => {
    renderFilter(new Set())
    expect(screen.getByText(messages.dashboard.roles.family.all)).toBeDefined()
  })

  it("shows a checked item per family and hides one on toggle", async () => {
    const onHiddenChange = renderFilter(new Set())
    openMenu()
    const eng = await screen.findByRole("menuitemcheckbox", {
      name: "Engineering",
    })
    expect(eng.getAttribute("aria-checked")).toBe("true")
    fireEvent.click(eng)
    expect(onHiddenChange).toHaveBeenCalledWith(new Set(["f1"]))
  })

  it("counts the shown families when some are hidden, and re-shows on toggle", async () => {
    const onHiddenChange = renderFilter(new Set(["f1"]))
    expect(
      screen.getByText(
        messages.dashboard.bands.familiesShown
          .replace("{shown}", "1")
          .replace("{total}", "2")
      )
    ).toBeDefined()
    openMenu()
    const eng = await screen.findByRole("menuitemcheckbox", {
      name: "Engineering",
    })
    expect(eng.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(eng)
    expect(onHiddenChange).toHaveBeenCalledWith(new Set())
  })

  it("'Select all' shows every family again", async () => {
    const onHiddenChange = renderFilter(new Set(["f1", "f2"]))
    openMenu()
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: messages.dashboard.bands.selectAll,
      })
    )
    expect(onHiddenChange).toHaveBeenCalledWith(new Set())
  })
})
