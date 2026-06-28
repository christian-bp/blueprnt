import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const setActiveMock = vi.fn()
let orgsData: { id: string; name: string }[] = []
let activeData: { id: string; name: string } | null = null

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useListOrganizations: () => ({ data: orgsData }),
    useActiveOrganization: () => ({ data: activeData }),
    organization: { setActive: (...a: unknown[]) => setActiveMock(...a) },
  },
}))

// The switcher resolves the active org's logo via this query; undefined here
// (no logo) so the avatars fall back to initials.
vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}))
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: { getOrganizationSettings: "getOrganizationSettings" },
    },
  },
}))

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
  }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  useSidebar: () => ({ isMobile: false }),
}))

import { NavOrganization } from "@/components/nav-organization"

function renderSwitcher() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NavOrganization />
    </NextIntlClientProvider>
  )
}

// Radix menus open on pointerdown + click (idiom from nav-user.test.tsx).
function openMenu(triggerText: string) {
  const trigger = screen.getByText(triggerText).closest("button")
  if (!trigger) throw new Error("trigger not found")
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(trigger)
}

describe("NavOrganization", () => {
  beforeEach(() => {
    setActiveMock.mockReset()
    setActiveMock.mockResolvedValue(undefined)
    orgsData = [
      { id: "a", name: "Acme" },
      { id: "b", name: "Beta" },
    ]
    activeData = { id: "a", name: "Acme" }
  })
  afterEach(() => cleanup())

  it("shows the active company on the trigger", () => {
    renderSwitcher()
    expect(screen.getByText("Acme")).toBeDefined()
  })

  it("lists the companies and marks the active one", async () => {
    renderSwitcher()
    openMenu("Acme")
    const acme = await screen.findByRole("menuitem", { name: /Acme/ })
    const beta = await screen.findByRole("menuitem", { name: /Beta/ })
    expect(acme.getAttribute("aria-current")).toBe("true")
    expect(beta.getAttribute("aria-current")).toBeNull()
  })

  it("switches to another company on click and never offers create", async () => {
    renderSwitcher()
    openMenu("Acme")
    const beta = await screen.findByRole("menuitem", { name: /Beta/ })
    fireEvent.click(beta)
    await waitFor(() => {
      expect(setActiveMock).toHaveBeenCalledWith({ organizationId: "b" })
    })
    expect(screen.queryByText(/add/i)).toBeNull()
  })

  it("does not switch when the active company is reselected", async () => {
    renderSwitcher()
    openMenu("Acme")
    const acme = await screen.findByRole("menuitem", { name: /Acme/ })
    fireEvent.click(acme)
    expect(setActiveMock).not.toHaveBeenCalled()
  })

  it("renders a single company with no other targets", async () => {
    orgsData = [{ id: "a", name: "Acme" }]
    activeData = { id: "a", name: "Acme" }
    renderSwitcher()
    openMenu("Acme")
    expect(await screen.findByRole("menuitem", { name: /Acme/ })).toBeDefined()
    expect(screen.queryByRole("menuitem", { name: /Beta/ })).toBeNull()
  })
})
