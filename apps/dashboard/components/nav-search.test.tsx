import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The sidebar chrome, passed through as plain elements, with the props the
// collapsed rail depends on exposed as data attributes (as in nav-footer's
// test) so they are assertable without a real sidebar context.
vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    ...props
  }: React.ComponentProps<"button"> & {
    isActive?: boolean
    tooltip?: string
  }) => {
    const { isActive, tooltip, ...rest } = props
    return (
      <button type="button" data-tooltip={tooltip} {...rest}>
        {children}
      </button>
    )
  },
}))

// The row reads the palette's state from the provider above the sidebar; the
// provider's own test covers the mounting and the shortcut, so here the
// controls are supplied directly and the row is the only subject.
const controls = vi.hoisted(() => ({
  open: false,
  setOpen: vi.fn(),
  isMac: true as boolean | null,
}))
vi.mock("@/components/command-palette-provider", () => ({
  useCommandPaletteControls: () => controls,
}))

import { NavSearch } from "@/components/nav-search"

const label = messages.dashboard.commandPalette.trigger

function renderRow(isMac: boolean | null = true) {
  controls.isMac = isMac
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NavSearch />
    </NextIntlClientProvider>
  )
}

describe("NavSearch", () => {
  beforeEach(() => {
    controls.open = false
    controls.isMac = true
    controls.setOpen.mockClear()
  })
  afterEach(() => cleanup())

  it("renders a row that reads like the nav rows above it", () => {
    renderRow()
    const button = screen.getByRole("button")
    expect(button.textContent).toContain(label)
    // The label is display-none in the icon rail, so the tooltip is the only
    // thing naming the row there.
    expect(button.getAttribute("data-tooltip")).toBe(label)
    expect(button.className).toContain("group-data-[collapsible=icon]:p-1.5!")
  })

  it("shows the mac shortcut on a mac and the ctrl one elsewhere", () => {
    renderRow(true)
    expect(screen.getByRole("button").textContent).toBe(`${label}⌘K`)
    cleanup()
    renderRow(false)
    expect(screen.getByRole("button").textContent).toBe(`${label}CtrlK`)
  })

  it("hides the shortcut hint in the icon rail", () => {
    renderRow()
    const hint = screen
      .getByRole("button")
      .querySelector("[data-slot=kbd-group]")
    expect(hint?.className).toContain("group-data-[collapsible=icon]:hidden")
  })

  it("asks its owner to open the palette", () => {
    renderRow()
    fireEvent.click(screen.getByRole("button"))
    expect(controls.setOpen).toHaveBeenCalledWith(true)
  })

  it("announces the dialog it opens, and whether it is open", () => {
    renderRow()
    const button = screen.getByRole("button")
    expect(button.getAttribute("aria-haspopup")).toBe("dialog")
    expect(button.getAttribute("aria-expanded")).toBe("false")
    cleanup()
    controls.open = true
    renderRow()
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe(
      "true"
    )
  })

  // The modifier is unknown until after mount, and a hint that renders the
  // wrong key and then swaps it is worse than one that arrives a frame late.
  it("shows no shortcut until the platform is known", () => {
    renderRow(null)
    expect(screen.getByRole("button").textContent).toBe(label)
  })
})
