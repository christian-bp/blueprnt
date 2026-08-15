import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { cloneElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

// Pass the sidebar structure through as plain elements, and expose the props
// the collapsed rail depends on (isActive, tooltip) as data attributes so they
// are assertable without a real sidebar context.
vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    ...props
  }: React.ComponentProps<"button"> & {
    render?: React.ReactElement<Record<string, unknown>>
    isActive?: boolean
    tooltip?: string
  }) => {
    const { render: renderProp, isActive, tooltip, ...rest } = props
    return (
      <button
        type="button"
        data-active={isActive ? "true" : "false"}
        data-tooltip={tooltip}
        {...rest}
      >
        {renderProp ? cloneElement(renderProp, undefined, children) : children}
      </button>
    )
  },
}))

// The palette belongs to the provider above the sidebar, not to the footer.
// It is stubbed here so that a footer that mounted one again would be visible
// to the assertion below rather than failing on the router and organization
// context the real one needs.
vi.mock("@/components/command-palette", () => ({
  CommandPalette: () => <div data-testid="palette" />,
}))

// The search row's own state comes from that provider; its behaviour is
// covered by nav-search's test.
vi.mock("@/components/command-palette-provider", () => ({
  useCommandPaletteControls: () => ({
    open: false,
    setOpen: vi.fn(),
    isMac: true,
  }),
}))

import { NavFooter } from "@/components/nav-footer"

const docsLabel = messages.dashboard.nav.docs
const searchLabel = messages.dashboard.commandPalette.trigger

function renderFooter() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NavFooter />
    </NextIntlClientProvider>
  )
}

describe("NavFooter", () => {
  beforeEach(() => {
    pathState.current = "/"
  })
  afterEach(() => cleanup())

  it("links to the user guide with its translated label", () => {
    renderFooter()
    expect(
      screen.getByRole("link", { name: docsLabel }).getAttribute("href")
    ).toBe("/docs")
  })

  it("marks itself active only inside the guide", () => {
    renderFooter()
    expect(
      screen.getByText(docsLabel).closest("button")?.getAttribute("data-active")
    ).toBe("false")
    cleanup()
    pathState.current = "/docs/roles"
    renderFooter()
    expect(
      screen.getByText(docsLabel).closest("button")?.getAttribute("data-active")
    ).toBe("true")
  })

  it("puts the search row under the guide, as a row and not a link", () => {
    renderFooter()
    const rows = screen.getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain(docsLabel)
    expect(rows[1]?.textContent).toContain(searchLabel)
    // A row that opens a dialog, so it must not be a link like the one above.
    expect(screen.queryByRole("link", { name: searchLabel })).toBeNull()
  })

  it("collapses like a nav entry: rail padding, tooltip and brand wash", () => {
    renderFooter()
    const button = screen.getByText(docsLabel).closest("button")
    // The label is display-none in the icon rail, so the tooltip is the only
    // thing naming the row there.
    expect(button?.getAttribute("data-tooltip")).toBe(docsLabel)
    expect(button?.className).toContain("group-data-[collapsible=icon]:p-1.5!")
    expect(button?.className).toContain("data-active:bg-brand/10")
  })

  // The regression this guards: the palette used to be mounted here, in the
  // sidebar footer. Below 768px the sidebar renders inside a sheet that
  // unmounts its children while closed, so the palette and its global
  // shortcut did not exist at all on a narrow window. It now belongs to
  // CommandPaletteProvider, above the sidebar; the footer contributes the
  // trigger row and nothing else.
  it("mounts no palette of its own", () => {
    renderFooter()
    expect(screen.queryByTestId("palette")).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })
})
