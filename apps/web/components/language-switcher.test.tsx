import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { LanguageSwitcher } from "@/components/language-switcher"

const replaceMock = vi.fn()
const currentPath = "/how-it-works"

// The switcher routes via the locale-aware navigation wrappers; mock them
// so we can assert the replace call without a mounted app router.
vi.mock("@workspace/i18n/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => currentPath,
}))

function renderSwitcher() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LanguageSwitcher />
    </NextIntlClientProvider>
  )
}

function openMenu() {
  const trigger = screen.getByRole("button", {
    name: messages.web.language.label,
  })
  // Radix menus need the pointerDown + click pair to mount under happy-dom;
  // see criterion-item.test.tsx for the same pattern.
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
  return trigger
}

describe("LanguageSwitcher", () => {
  afterEach(() => {
    cleanup()
    replaceMock.mockClear()
  })

  it("shows the current locale's native name on the trigger", () => {
    renderSwitcher()
    const trigger = screen.getByRole("button", {
      name: messages.web.language.label,
    })
    expect(trigger.textContent).toContain("English")
  })

  it("lists all five locales in the menu", () => {
    renderSwitcher()
    openMenu()
    const items = screen.getAllByRole("menuitem")
    expect(items.map((item) => item.textContent)).toEqual([
      "English",
      "Svenska",
      "Norsk",
      "Dansk",
      "Suomi",
    ])
  })

  it("switches locale preserving the path", () => {
    renderSwitcher()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Svenska" }))
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith(currentPath, { locale: "sv" })
  })
})
