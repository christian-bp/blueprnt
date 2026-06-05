import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

// Use vi.hoisted so the spies are initialised before the vi.mock factory runs.
const { pushMock, signOutMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  signOutMock: vi.fn(),
}))

// Mock next/navigation (used by onboarding-header for router.push after sign-out).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

// Mock auth-client: expose signOut as a spy and useSession returning a user.
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { name: "HR Person", email: "hr@acme.se" } },
    }),
    signOut: signOutMock,
  },
}))

import { OnboardingHeader } from "@/components/onboarding/onboarding-header"

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OnboardingHeader />
    </NextIntlClientProvider>
  )
}

// Helper: open the Radix DropdownMenu trigger via the pointerdown event Radix
// listens on (happy-dom does not synthesise click -> pointerdown automatically).
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(trigger)
}

describe("OnboardingHeader", () => {
  beforeEach(() => {
    signOutMock.mockReset()
    pushMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the blueprnt text logo", () => {
    renderHeader()
    // dashboard.title = "blueprnt"
    expect(screen.getByText("blueprnt")).toBeDefined()
  })

  it("renders the avatar with user initials derived from the display name", () => {
    renderHeader()
    // "HR Person" -> first letter of each word, up to two words -> "HP"
    expect(screen.getByText("HP")).toBeDefined()
  })

  it("renders the account-menu trigger with an accessible label", () => {
    renderHeader()
    // dashboard.onboarding.accountMenu = "Account menu"
    expect(screen.getByRole("button", { name: "Account menu" })).toBeDefined()
  })

  it("calls authClient.signOut when the sign-out menu item is clicked", async () => {
    signOutMock.mockResolvedValue(undefined)
    renderHeader()

    // Open the Radix dropdown (it listens on pointerdown, not click).
    const trigger = screen.getByRole("button", { name: "Account menu" })
    openDropdown(trigger)

    // The Radix DropdownMenuContent is portalled into document.body.
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeDefined()
    })

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }))

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1)
    })
  })
})
