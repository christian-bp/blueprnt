import { cleanup, render, screen } from "@testing-library/react"
import { cloneElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

// Pass the sidebar structure through as plain elements, and expose isActive as
// a data attribute so the active-section logic is assertable.
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
    render?: React.ReactElement<Record<string, unknown>>
    isActive?: boolean
    tooltip?: string
  }) => {
    const { render: renderProp, isActive, tooltip, ...rest } = props
    return (
      <button type="button" data-active={isActive ? "true" : "false"} {...rest}>
        {renderProp ? cloneElement(renderProp, undefined, children) : children}
      </button>
    )
  },
}))

import { NavMain, type NavItem } from "@/components/nav-main"

const ITEMS: NavItem[] = [
  { title: "Home", url: "/" },
  { title: "Work", url: "/work", match: ["/roles"] },
  { title: "Model", url: "/model" },
]

function renderNav() {
  return render(<NavMain items={ITEMS} />)
}

function activeOf(name: string) {
  return screen.getByText(name).closest("button")?.getAttribute("data-active")
}

describe("NavMain", () => {
  beforeEach(() => {
    pathState.current = "/"
  })
  afterEach(() => cleanup())

  it("renders each item as a single leaf link", () => {
    renderNav()
    expect(
      screen.getByRole("link", { name: "Home" }).getAttribute("href")
    ).toBe("/")
    expect(
      screen.getByRole("link", { name: "Work" }).getAttribute("href")
    ).toBe("/work")
    expect(
      screen.getByRole("link", { name: "Model" }).getAttribute("href")
    ).toBe("/model")
  })

  it("marks Home active only on the root", () => {
    pathState.current = "/"
    renderNav()
    expect(activeOf("Home")).toBe("true")
    expect(activeOf("Work")).toBe("false")
  })

  it("keeps Work active across /work and any nested /roles path", () => {
    pathState.current = "/roles/r1"
    renderNav()
    expect(activeOf("Work")).toBe("true")
    expect(activeOf("Home")).toBe("false")
    expect(activeOf("Model")).toBe("false")
  })

  it("fills the active page with the brand via --sidebar-primary", () => {
    renderNav()
    const homeButton = screen.getByText("Home").closest("button")
    expect(homeButton?.className).toContain("data-active:bg-sidebar-primary")
    expect(homeButton?.className).toContain(
      "data-active:text-sidebar-primary-foreground"
    )
  })
})
