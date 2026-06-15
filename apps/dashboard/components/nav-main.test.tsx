import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/" }))
const sidebarState = vi.hoisted(
  () => ({ current: "expanded" }) as { current: "expanded" | "collapsed" }
)

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

// Pass the sidebar structure through as plain elements and drive the
// expanded/collapsed branch from the mocked useSidebar state. Real radix
// DropdownMenu and Collapsible stay in place.
vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
    asChild?: boolean
    isActive?: boolean
    tooltip?: string
  }) => {
    const { asChild, isActive, tooltip, ...rest } = props
    return (
      <button type="button" {...rest}>
        {children}
      </button>
    )
  },
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuSubButton: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useSidebar: () => ({ state: sidebarState.current, isMobile: false }),
}))

// Collapsible passthrough so the expanded submenu content renders
// deterministically in the test (the real radix open/close is not the unit
// under test here).
vi.mock("@workspace/ui/components/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

import { NavMain, type NavItem } from "@/components/nav-main"

const ITEMS: NavItem[] = [
  { title: "Home", url: "/" },
  {
    title: "Work",
    items: [
      { title: "Overview", url: "/work" },
      { title: "Roles", url: "/roles" },
    ],
  },
  { title: "Model", url: "/model" },
]

function renderNav() {
  return render(<NavMain items={ITEMS} />)
}

// Radix menus open on pointerdown + click (the idiom from nav-user.test).
function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(trigger)
}

describe("NavMain", () => {
  beforeEach(() => {
    pathState.current = "/"
    sidebarState.current = "expanded"
  })
  afterEach(() => cleanup())

  it("renders the Work submenu inline when the sidebar is expanded", () => {
    sidebarState.current = "expanded"
    pathState.current = "/work"
    renderNav()
    expect(
      screen.getByRole("link", { name: "Overview" }).getAttribute("href")
    ).toBe("/work")
    expect(
      screen.getByRole("link", { name: "Roles" }).getAttribute("href")
    ).toBe("/roles")
  })

  it("exposes the submenu via a flyout when the sidebar is collapsed", async () => {
    sidebarState.current = "collapsed"
    pathState.current = "/"
    renderNav()
    // The inline submenu is gone; children are not in the DOM until the
    // flyout opens (this is the bug the flyout fixes).
    expect(screen.queryByRole("link", { name: "Roles" })).toBeNull()

    openMenu(screen.getByRole("button", { name: "Work" }))

    const roles = await screen.findByRole("menuitem", { name: "Roles" })
    expect(roles.getAttribute("href")).toBe("/roles")
    const overview = await screen.findByRole("menuitem", { name: "Overview" })
    expect(overview.getAttribute("href")).toBe("/work")
  })
})
