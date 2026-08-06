import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { cloneElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/" }))
const sidebarState = vi.hoisted(() => ({
  state: "expanded" as "expanded" | "collapsed",
  isMobile: false,
}))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

// Render motion elements synchronously as plain tags (the motion-only props
// are stripped so they never reach the DOM): with AnimatePresence pass-through,
// a section's sub-list mounts and unmounts instantly, which is what lets the
// visibility assertions below observe the open/closed states directly.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...rest
    }: Record<string, unknown> & { children?: ReactNode }) => (
      <div {...rest}>{children}</div>
    ),
  },
}))

// Pass the sidebar structure through as plain elements, and expose isActive as
// a data attribute so the active-section logic is assertable.
vi.mock("@workspace/ui/components/sidebar", () => ({
  useSidebar: () => sidebarState,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="group-label">{children}</div>
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
  SidebarMenuSub: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <ul data-testid="menu-sub" className={className}>
      {children}
    </ul>
  ),
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuSubButton: ({
    children,
    ...props
  }: React.ComponentProps<"span"> & {
    render?: React.ReactElement<Record<string, unknown>>
    isActive?: boolean
  }) => {
    const { render: renderProp, isActive, ...rest } = props
    return (
      <span
        data-testid="menu-sub-button"
        data-active={isActive ? "true" : "false"}
        {...rest}
      >
        {renderProp ? cloneElement(renderProp, undefined, children) : children}
      </span>
    )
  },
}))

import { NavMain, type NavItem } from "@/components/nav-main"

const ITEMS: NavItem[] = [
  { title: "Home", url: "/" },
  {
    title: "Work",
    url: "/work",
    match: ["/roles"],
    items: [
      { title: "Overview", url: "/work" },
      { title: "Roles", url: "/roles" },
    ],
  },
  {
    title: "Model",
    url: "/model",
    items: [
      { title: "Criteria", url: "/model" },
      { title: "Weighting", url: "/model/weighting" },
      { title: "Method", url: "/model/method" },
    ],
  },
  {
    title: "People",
    url: "/people",
    items: [
      { title: "Register", url: "/people" },
      { title: "Classify", url: "/people/classify" },
    ],
  },
]

function renderNav() {
  return render(<NavMain items={ITEMS} />)
}

function activeOf(name: string) {
  return screen.getByText(name).closest("button")?.getAttribute("data-active")
}

// The label sits in its own <span> inside the link, so climb to the mock's
// explicitly tagged wrapper instead of the nearest span (closest() would
// otherwise match the label itself).
function subButtonOf(name: string) {
  return screen.getByText(name).closest('[data-testid="menu-sub-button"]')
}

function subActiveOf(name: string) {
  return subButtonOf(name)?.getAttribute("data-active")
}

describe("NavMain", () => {
  beforeEach(() => {
    pathState.current = "/"
    sidebarState.state = "expanded"
    sidebarState.isMobile = false
  })
  afterEach(() => cleanup())

  it("renders each item as a section link", () => {
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

  it("marks the active page with a tinted brand wash, not a filled pill", () => {
    renderNav()
    const homeButton = screen.getByText("Home").closest("button")
    expect(homeButton?.className).toContain("data-active:bg-brand/10")
    expect(homeButton?.className).toContain("data-active:text-brand")
    // The vendor's gray active treatment must not survive in any state,
    // including the :active press that would otherwise flash through.
    expect(homeButton?.className).toContain("data-active:hover:bg-brand/15")
    expect(homeButton?.className).toContain("data-active:active:bg-brand/15")
  })

  it("renders a group heading only when the caller names the group", () => {
    const { rerender } = render(<NavMain items={ITEMS} />)
    expect(screen.queryByTestId("group-label")).toBeNull()
    rerender(<NavMain items={ITEMS} label="Job evaluation" />)
    expect(screen.getByTestId("group-label").textContent).toBe("Job evaluation")
  })

  it("hides every sub-page while no section is open", () => {
    pathState.current = "/"
    renderNav()
    expect(screen.queryByTestId("menu-sub")).toBeNull()
    expect(screen.queryByText("Weighting")).toBeNull()
  })

  it("reveals only the open section's sub-pages", () => {
    pathState.current = "/model"
    renderNav()
    // Model's sub-pages are out...
    expect(
      screen.getByRole("link", { name: "Weighting" }).getAttribute("href")
    ).toBe("/model/weighting")
    expect(
      screen.getByRole("link", { name: "Method" }).getAttribute("href")
    ).toBe("/model/method")
    // ...and the other sections stay flat.
    expect(screen.queryByText("Overview")).toBeNull()
    expect(screen.queryByText("Classify")).toBeNull()
  })

  it("marks the section index sub-page active only on the index itself", () => {
    pathState.current = "/model"
    renderNav()
    expect(subActiveOf("Criteria")).toBe("true")
    expect(subActiveOf("Weighting")).toBe("false")
    expect(
      screen
        .getByRole("link", { name: "Criteria" })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen
        .getByRole("link", { name: "Weighting" })
        .getAttribute("aria-current")
    ).toBeNull()
  })

  it("hands the index sub-page over to a deeper matching sibling", () => {
    pathState.current = "/model/weighting"
    renderNav()
    expect(subActiveOf("Weighting")).toBe("true")
    expect(subActiveOf("Criteria")).toBe("false")
  })

  it("keeps a register sub-page active on its detail pages", () => {
    pathState.current = "/people/abc123"
    renderNav()
    expect(subActiveOf("Register")).toBe("true")
    expect(subActiveOf("Classify")).toBe("false")
  })

  it("opens a section's sub-pages from a `match` path too", () => {
    pathState.current = "/roles/r1"
    renderNav()
    expect(subActiveOf("Roles")).toBe("true")
    expect(subActiveOf("Overview")).toBe("false")
  })

  it("marks the active sub-page with the same brand wash as the section", () => {
    pathState.current = "/model"
    renderNav()
    const subButton = subButtonOf("Criteria")
    expect(subButton?.className).toContain("data-active:bg-brand/10")
    expect(subButton?.className).toContain("data-active:text-brand")
  })

  it("aligns the sub-list's right edge with its section entry", () => {
    pathState.current = "/model"
    renderNav()
    const subList = screen.getByTestId("menu-sub")
    expect(subList.className).toContain("mr-0")
    expect(subList.className).toContain("pr-0")
  })

  it("closes the sub-pages with the icon rail so the space animates shut", () => {
    pathState.current = "/model"
    sidebarState.state = "collapsed"
    renderNav()
    expect(screen.queryByTestId("menu-sub")).toBeNull()
  })

  it("keeps sub-pages in the mobile sheet regardless of the rail state", () => {
    pathState.current = "/model"
    sidebarState.state = "collapsed"
    sidebarState.isMobile = true
    renderNav()
    expect(screen.getByText("Weighting")).toBeDefined()
  })
})
