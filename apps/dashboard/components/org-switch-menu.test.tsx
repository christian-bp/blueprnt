import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

import { OrgSwitchMenuSub } from "@/components/org-switch-menu"
import { openMenu } from "@/test/menu"

function renderSub() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DropdownMenu>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <OrgSwitchMenuSub />
        </DropdownMenuContent>
      </DropdownMenu>
    </NextIntlClientProvider>
  )
}

function openSwitcher() {
  return openMenu(screen.getByRole("button", { name: "open" }))
}

describe("OrgSwitchMenuSub", () => {
  beforeEach(() => {
    setActiveMock.mockReset()
    setActiveMock.mockResolvedValue(undefined)
    orgsData = [
      { id: "a", name: "Acme" },
      { id: "b", name: "Blueprnt" },
    ]
    activeData = { id: "a", name: "Acme" }
  })
  afterEach(() => cleanup())

  it("switches to another company from the submenu", async () => {
    renderSub()
    await openSwitcher()
    // The submenu trigger shows the active company; open it via ArrowRight.
    const subTrigger = await screen.findByRole("menuitem", { name: /Acme/ })
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" })

    const other = await screen.findByRole("menuitem", { name: /Blueprnt/ })
    fireEvent.click(other)

    await waitFor(() => {
      expect(setActiveMock).toHaveBeenCalledWith({ organizationId: "b" })
    })
  })

  it("renders nothing when the user belongs to fewer than two companies", async () => {
    orgsData = [{ id: "a", name: "Acme" }]
    activeData = { id: "a", name: "Acme" }
    renderSub()
    await openSwitcher()
    // Single company => no switch submenu at all.
    expect(screen.queryByText("Acme")).toBeNull()
  })
})
