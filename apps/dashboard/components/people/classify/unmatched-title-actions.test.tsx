import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Module mocks (declared before the module under test is imported)
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { toast } from "sonner"
import { mockMutation } from "@/test/convex-mocks"
import { UnmatchedTitleActions } from "@/components/people/classify/unmatched-title-actions"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const m = messages.dashboard.classify
const tCreate = messages.dashboard.classify.createRole

const TRACKS = [
  { key: "IC", name: "Individual contributor", order: 0 },
  { key: "M", name: "Manager", order: 1 },
]

const createRoleMock = vi.fn()

function renderActions({
  title = "Product Manager",
  onRoleCreated = vi.fn(),
  onMapExisting = vi.fn(),
}: {
  title?: string
  onRoleCreated?: (roleId: string) => void
  onMapExisting?: () => void
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UnmatchedTitleActions
        orgId="org-1"
        title={title}
        tracks={TRACKS}
        onRoleCreated={onRoleCreated}
        onMapExisting={onMapExisting}
      />
    </NextIntlClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UnmatchedTitleActions", () => {
  beforeEach(() => {
    mockMutation("assessment.roles.createRole").mockImplementation(
      createRoleMock
    )
    createRoleMock.mockReset()
    vi.mocked(toast.success).mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders the createRoleCta and mapExistingCta buttons", () => {
    renderActions()
    expect(screen.getByRole("button", { name: m.createRoleCta })).toBeDefined()
    expect(screen.getByRole("button", { name: m.mapExistingCta })).toBeDefined()
  })

  it("opens the create-role dialog when createRoleCta is clicked", async () => {
    renderActions()
    fireEvent.click(screen.getByRole("button", { name: m.createRoleCta }))
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined()
    })
    expect(screen.getByText(tCreate.title)).toBeDefined()
  })

  it("prefills the title field with the group title", async () => {
    renderActions({ title: "Product Manager" })
    fireEvent.click(screen.getByRole("button", { name: m.createRoleCta }))
    await waitFor(() => {
      const titleInput = screen.getByLabelText(
        tCreate.titleLabel
      ) as HTMLInputElement
      expect(titleInput.value).toBe("Product Manager")
    })
  })

  it("opens an empty title field when title prop is empty (no-title group)", async () => {
    renderActions({ title: "" })
    fireEvent.click(screen.getByRole("button", { name: m.createRoleCta }))
    await waitFor(() => {
      const titleInput = screen.getByLabelText(
        tCreate.titleLabel
      ) as HTMLInputElement
      expect(titleInput.value).toBe("")
    })
  })

  it("submits createRole WITHOUT familyId and shows roleCreated toast on success", async () => {
    const onRoleCreated = vi.fn()
    createRoleMock.mockResolvedValue({ roleId: "role-new", slug: "role-new" })

    renderActions({ title: "Product Manager", onRoleCreated })
    fireEvent.click(screen.getByRole("button", { name: m.createRoleCta }))

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined()
    })

    // Fill in required fields
    fireEvent.change(screen.getByLabelText(tCreate.functionLabel), {
      target: { value: "Product" },
    })
    fireEvent.change(screen.getByLabelText(tCreate.teamLabel), {
      target: { value: "Core" },
    })

    // Submit the form
    const form = screen
      .getByLabelText(tCreate.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        title: "Product Manager",
        function: "Product",
        team: "Core",
        trackKey: "IC",
        // NO familyId: classification create is family-less
      })
    })

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        messages.dashboard.toast.roleCreated
      )
    })

    // onRoleCreated should be called with the new role id
    expect(onRoleCreated).toHaveBeenCalledWith("role-new")
  })

  it("calls onMapExisting when the mapExistingCta button is clicked", () => {
    const onMapExisting = vi.fn()
    renderActions({ onMapExisting })
    fireEvent.click(screen.getByRole("button", { name: m.mapExistingCta }))
    expect(onMapExisting).toHaveBeenCalledTimes(1)
  })
})
