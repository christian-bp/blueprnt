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

const setUiLocaleMock = vi.fn()
const setPreviewLocaleMock = vi.fn()
const signOutMock = vi.fn()

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { name: "HR Person", email: "hr@acme.se" } },
    }),
    signOut: (...args: unknown[]) => signOutMock(...args),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("convex/react", () => ({
  useMutation: () => setUiLocaleMock,
  // undefined keeps the platform-admin link hidden for this non-admin user.
  useQuery: () => undefined,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      onboarding: { setUiLocale: "accounts.onboarding.setUiLocale" },
    },
    platform: {
      admin: { isPlatformAdmin: "platform.admin.isPlatformAdmin" },
    },
  },
}))

vi.mock("@/components/locale-provider", () => ({
  useSetPreviewLocale: () => setPreviewLocaleMock,
}))

// The sidebar context is irrelevant here; pass the menu structure through.
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

import { NavUser } from "@/components/nav-user"

const nav = messages.dashboard.nav
const languages = messages.dashboard.languages

function renderNavUser() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NavUser />
    </NextIntlClientProvider>
  )
}

// Radix menus open on pointerdown + click (the established idiom from
// onboarding-header.test.tsx).
function openMenu() {
  const trigger = screen.getByText("HR Person").closest("button")
  if (!trigger) throw new Error("trigger not found")
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(trigger)
}

describe("NavUser", () => {
  beforeEach(() => {
    setUiLocaleMock.mockReset()
    setUiLocaleMock.mockResolvedValue(null)
    setPreviewLocaleMock.mockReset()
    signOutMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows the current language (flag + autonym) as the submenu trigger", async () => {
    renderNavUser()
    openMenu()
    // Locale is en in the test provider, so the trigger row reads English.
    const subTrigger = await screen.findByRole("menuitem", {
      name: languages.en,
    })
    expect(subTrigger.querySelector("img")?.getAttribute("src")).toContain(
      "/flags/s/GB.svg"
    )
    expect(screen.getByText(nav.signOut)).toBeDefined()
  })

  it("picking a language previews it and persists the per-user override", async () => {
    renderNavUser()
    openMenu()

    // Open the submenu via keyboard (the Radix way that works in happy-dom).
    const subTrigger = await screen.findByRole("menuitem", {
      name: languages.en,
    })
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" })

    const item = await screen.findByRole("menuitemradio", {
      name: languages.sv,
    })
    fireEvent.click(item)

    expect(setPreviewLocaleMock).toHaveBeenCalledWith("sv")
    await waitFor(() => {
      expect(setUiLocaleMock).toHaveBeenCalledWith({ locale: "sv" })
    })
  })

  it("drops the preview when the persist rejects", async () => {
    setUiLocaleMock.mockRejectedValue(new Error("ConvexError: invalidInput"))
    renderNavUser()
    openMenu()

    const subTrigger = await screen.findByRole("menuitem", {
      name: languages.en,
    })
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" })
    const item = await screen.findByRole("menuitemradio", {
      name: languages.fi,
    })
    fireEvent.click(item)

    await waitFor(() => {
      expect(setPreviewLocaleMock).toHaveBeenCalledWith(null)
    })
  })
})
