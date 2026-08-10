import { NextIntlClientProvider } from "next-intl"
import messages from "@workspace/i18n/messages/en.json"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Module-level variables: useAction returns a closure over these so the
// component always calls the current mock, dispatched by the action's ref
// (the panel holds both the saved-role and the unsaved-role action). The
// describe-level beforeEach reassigns them to fresh vi.fn()s so each test
// starts from a clean identity. (bun correlates rejected Promises to a
// specific vi.fn() instance; a fresh identity per test prevents spurious
// unhandledRejection events when the error test runs after a success test.)
let draftSavedMock = vi.fn()
let draftNewMock = vi.fn()

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) =>
    String(ref) === "ai.draft.draftNewRoleProfile"
      ? draftNewMock
      : draftSavedMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import { RoleAiPanel } from "@/components/roles/role-ai-panel"
import type { RoleDraftIdentity } from "@/components/roles/role-ai-panel"

const labels = messages.dashboard.roles.ai

const IDENTITY: RoleDraftIdentity = {
  title: "Payroll Specialist",
  roleFunction: "People",
  team: "Comp & Ben",
  trackKey: "IC",
  familyId: null,
}

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

function draftCta() {
  return screen.getByRole("button", { name: labels.draftCta })
}

describe("RoleAiPanel", () => {
  beforeEach(() => {
    draftSavedMock = vi.fn()
    draftNewMock = vi.fn()
  })
  afterEach(() => cleanup())

  describe("saved role", () => {
    it("generates then fills via onFilled and closes via onDone", async () => {
      draftSavedMock.mockResolvedValue({
        purpose: "Runs the platform.",
        responsibilities: "Owns delivery",
      })
      const onFilled = vi.fn()
      const onDone = vi.fn()
      wrap(
        <RoleAiPanel
          orgId="org-1"
          source={{ kind: "saved", roleId: "role-1" as never }}
          onFilled={onFilled}
          onDone={onDone}
        />
      )
      fireEvent.click(draftCta())
      await waitFor(() =>
        expect(onFilled).toHaveBeenCalledWith({
          purpose: "Runs the platform.",
          responsibilities: "Owns delivery",
        })
      )
      expect(onDone).toHaveBeenCalledTimes(1)
      // The optional guidance is omitted when the description textarea is empty.
      expect(draftSavedMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        locale: "en",
      })
      expect(draftNewMock).not.toHaveBeenCalled()
    })

    it("forwards the optional guidance description", async () => {
      draftSavedMock.mockResolvedValue({ purpose: "P", responsibilities: "R" })
      wrap(
        <RoleAiPanel
          orgId="org-1"
          source={{ kind: "saved", roleId: "role-1" as never }}
          onFilled={vi.fn()}
        />
      )
      fireEvent.change(screen.getByLabelText(labels.descriptionLabel), {
        target: { value: "Owns payments" },
      })
      fireEvent.click(draftCta())
      await waitFor(() =>
        expect(draftSavedMock).toHaveBeenCalledWith({
          orgId: "org-1",
          roleId: "role-1",
          locale: "en",
          description: "Owns payments",
        })
      )
    })

    it("shows an error and stays retryable when generation fails", async () => {
      draftSavedMock.mockImplementation(async () => {
        throw new Error("AI unavailable")
      })
      const onFilled = vi.fn()
      wrap(
        <RoleAiPanel
          orgId="org-1"
          source={{ kind: "saved", roleId: "role-1" as never }}
          onFilled={onFilled}
        />
      )
      fireEvent.click(draftCta())
      await waitFor(() => expect(screen.getByRole("alert")).toBeDefined())
      expect(onFilled).not.toHaveBeenCalled()
      // The Generate button is still available to retry.
      expect(draftCta()).toBeDefined()
    })
  })

  describe("unsaved role", () => {
    it("drafts from the typed identity, without a familyId when unfiled", async () => {
      draftNewMock.mockResolvedValue({ purpose: "P", responsibilities: "R" })
      const onFilled = vi.fn()
      wrap(
        <RoleAiPanel
          orgId="org-1"
          source={{ kind: "draft", identity: IDENTITY }}
          onFilled={onFilled}
        />
      )
      fireEvent.click(draftCta())
      await waitFor(() =>
        expect(draftNewMock).toHaveBeenCalledWith({
          orgId: "org-1",
          locale: "en",
          title: "Payroll Specialist",
          function: "People",
          team: "Comp & Ben",
          trackKey: "IC",
        })
      )
      expect(draftSavedMock).not.toHaveBeenCalled()
      expect(onFilled).toHaveBeenCalledWith({
        purpose: "P",
        responsibilities: "R",
      })
    })

    it("passes the selected family through", async () => {
      draftNewMock.mockResolvedValue({ purpose: "P", responsibilities: "R" })
      wrap(
        <RoleAiPanel
          orgId="org-1"
          source={{
            kind: "draft",
            identity: { ...IDENTITY, familyId: "fam-1" },
          }}
          onFilled={vi.fn()}
        />
      )
      fireEvent.click(draftCta())
      await waitFor(() =>
        expect(draftNewMock).toHaveBeenCalledWith(
          expect.objectContaining({ familyId: "fam-1" })
        )
      )
    })

    it("states the title precondition instead of generating from nothing", () => {
      wrap(
        <RoleAiPanel
          orgId="org-1"
          source={{ kind: "draft", identity: { ...IDENTITY, title: "  " } }}
          onFilled={vi.fn()}
        />
      )
      expect(screen.getByText(labels.titleFirst)).toBeDefined()
      expect(draftCta().hasAttribute("disabled")).toBe(true)
      fireEvent.click(draftCta())
      expect(draftNewMock).not.toHaveBeenCalled()
    })
  })
})
