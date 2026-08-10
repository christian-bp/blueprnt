import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const pushMock = vi.fn()

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { toast } from "@/lib/toast"
import { mockAction, mockMutation, onQuery } from "@/test/convex-mocks"
import { CreateRoleDialog } from "@/components/roles/create-role-dialog"

const createRoleMock = mockMutation("assessment.roles.createRole")
const draftMock = mockAction("ai.draft.draftNewRoleProfile")
// The nested FamilyPicker lists families; no families needed for these tests.
onQuery(() => [])

const labels = messages.dashboard.roles.create
const profile = messages.assessment.role
const ai = messages.dashboard.ai
const rolesAi = messages.dashboard.roles.ai

const TRACKS = [
  { key: "IC", name: "Individual contributor", order: 1 },
  { key: "M", name: "Manager", order: 2 },
] as const

function renderDialog(
  options: {
    existing?: { title: string; familyId: string | null }[]
    triggerVariant?: React.ComponentProps<
      typeof CreateRoleDialog
    >["triggerVariant"]
  } = {}
) {
  const { existing = [], triggerVariant } = options
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CreateRoleDialog
        orgId="org-1"
        tracks={[...TRACKS]}
        triggerLabel={labels.title}
        existing={existing}
        triggerVariant={triggerVariant}
      />
    </NextIntlClientProvider>
  )
}

describe("CreateRoleDialog", () => {
  beforeEach(() => {
    createRoleMock.mockReset()
    draftMock.mockReset()
    pushMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("renders its trigger as the default primary button", () => {
    renderDialog()
    const trigger = screen.getByRole("button", { name: labels.title })
    // A substring check for "border" would never fail either way: the
    // vendor Button's BASE classes (packages/ui/src/components/button.tsx)
    // apply "border border-transparent" to every variant, so it is present
    // even on the default button. bg-primary is the class the default
    // variant alone owns, so its presence is a real signal. It reads as the
    // brand rose because globals.css sets --primary to var(--brand).
    expect(trigger.className).toContain("bg-primary")
  })

  it("renders its trigger in the requested variant", () => {
    renderDialog({ triggerVariant: "outline" })
    const trigger = screen.getByRole("button", { name: labels.title })
    // bg-background is the class the outline variant alone owns.
    expect(trigger.className).toContain("bg-background")
    expect(trigger.className).not.toContain("bg-primary")
  })

  it("opens on the trigger and submits the basics, then navigates", async () => {
    createRoleMock.mockResolvedValue({ roleId: "role-new", slug: "role-new" })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Junior Developer" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "Engineering" },
    })
    fireEvent.change(screen.getByLabelText(labels.teamLabel), {
      target: { value: "Core" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      // Exact match: with no family picked, createRole carries no familyId key.
      expect(createRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        title: "Junior Developer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
      })
    })
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/roles/role-new")
    })
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      messages.dashboard.toast.roleCreated
    )
  })

  it("keeps the dialog open and shows an alert when create fails", async () => {
    createRoleMock.mockRejectedValue(new Error("ConvexError: invalidInput"))
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "X" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "F" },
    })
    fireEvent.change(screen.getByLabelText(labels.teamLabel), {
      target: { value: "T" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(screen.getByLabelText(labels.titleLabel)).toBeDefined()
  })

  it("blocks submit and shows required errors when the basics are empty", async () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(
        screen.getAllByText(messages.dashboard.validation.required).length
      ).toBeGreaterThan(0)
      expect(createRoleMock).not.toHaveBeenCalled()
    })
  })

  it("blocks a title already taken in the selected family without calling the server", async () => {
    renderDialog({ existing: [{ title: "Manager", familyId: null }] })
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Manager" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "F" },
    })
    fireEvent.change(screen.getByLabelText(labels.teamLabel), {
      target: { value: "T" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByText(messages.errors.roleExists)).toBeDefined()
    })
    // The duplicate never reaches the server (no thrown ConvexError).
    expect(createRoleMock).not.toHaveBeenCalled()
  })

  it("submits the job profile when purpose and responsibilities are filled", async () => {
    createRoleMock.mockResolvedValue({ roleId: "role-new", slug: "role-new" })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Junior Developer" },
    })
    fireEvent.change(screen.getByLabelText(profile.purpose), {
      target: { value: "Builds the product." },
    })
    fireEvent.change(screen.getByLabelText(profile.responsibilities), {
      target: { value: "Ships features\nReviews code" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        title: "Junior Developer",
        function: "",
        team: "",
        trackKey: "IC",
        purpose: "Builds the product.",
        responsibilities: "Ships features\nReviews code",
      })
    })
  })

  it("fills both profile fields from the AI draft, keyed to the typed identity", async () => {
    draftMock.mockResolvedValue({
      purpose: "Builds and runs the services.",
      responsibilities: "Owns delivery",
    })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Backend Developer" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "Engineering" },
    })

    fireEvent.click(screen.getByRole("button", { name: ai.fillCta }))
    fireEvent.click(
      await screen.findByRole("button", { name: rolesAi.draftCta })
    )

    await waitFor(() => {
      // The draft is generated from what is CURRENTLY typed, not from the
      // values the dialog opened with.
      expect(draftMock).toHaveBeenCalledWith({
        orgId: "org-1",
        locale: "en",
        title: "Backend Developer",
        function: "Engineering",
        team: "",
        trackKey: "IC",
      })
    })
    await waitFor(() => {
      expect(
        (screen.getByLabelText(profile.purpose) as HTMLTextAreaElement).value
      ).toBe("Builds and runs the services.")
    })
    expect(
      (screen.getByLabelText(profile.responsibilities) as HTMLTextAreaElement)
        .value
    ).toBe("Owns delivery")
    // Drafting never creates the role: the user reviews, then submits.
    expect(createRoleMock).not.toHaveBeenCalled()
  })

  it("creates the role in the given family and hides the family picker", async () => {
    createRoleMock.mockResolvedValue({ roleId: "role-new", slug: "role-new" })
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CreateRoleDialog
          orgId="org-1"
          tracks={[...TRACKS]}
          triggerLabel={labels.title}
          existing={[]}
          defaultFamilyId="fam-1"
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    // The family is fixed by context, so the picker is not rendered.
    expect(screen.queryByText(messages.model.roleFamily)).toBeNull()
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Backend Developer" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "Engineering" },
    })
    fireEvent.change(screen.getByLabelText(labels.teamLabel), {
      target: { value: "Core" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        title: "Backend Developer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
        familyId: "fam-1",
      })
    })
  })
})
