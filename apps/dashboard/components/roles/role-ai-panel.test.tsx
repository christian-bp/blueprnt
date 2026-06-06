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

const useQueryMock = vi.fn()
const requestMock = vi.fn()
const confirmMock = vi.fn()
const rejectMock = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (ref: unknown) => {
    if (ref === "ai.requestRoleProfileDraft") return requestMock
    if (ref === "ai.confirmRoleProfileDraft") return confirmMock
    if (ref === "ai.rejectSuggestion") return rejectMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    ai: {
      suggest: {
        getOpenSuggestions: "ai.getOpenSuggestions",
        requestRoleProfileDraft: "ai.requestRoleProfileDraft",
        confirmRoleProfileDraft: "ai.confirmRoleProfileDraft",
        rejectSuggestion: "ai.rejectSuggestion",
      },
    },
  },
}))

import { RoleAiPanel } from "@/components/roles/role-ai-panel"

const aiLabels = messages.dashboard.ai
const roleAiLabels = messages.dashboard.roles.ai
const roleLabels = messages.assessment.role
const errorLabels = messages.errors

const ROLE_ID = "role-1" as never
const ORG_ID = "org-1"

function makeSuggestedRow(overrides?: Record<string, unknown>) {
  return {
    suggestionId: "sug-1" as never,
    kind: "role.profile",
    status: "suggested",
    suggestedValue: {
      profile: {
        purpose: "Build reliable software",
        responsibilities: "Code review and feature delivery",
      },
    },
    errorCode: null,
    createdAt: 1,
    roleId: ROLE_ID,
    ...overrides,
  }
}

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleAiPanel orgId={ORG_ID} roleId={ROLE_ID} />
    </NextIntlClientProvider>
  )
}

describe("RoleAiPanel", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    requestMock.mockReset()
    confirmMock.mockReset()
    rejectMock.mockReset()
    // Default: no open suggestions.
    useQueryMock.mockReturnValue([])
  })
  afterEach(() => {
    cleanup()
  })

  describe("idle state (no open suggestion)", () => {
    it("renders the description textarea and the draft CTA button", () => {
      renderPanel()
      expect(screen.getByLabelText(roleAiLabels.descriptionLabel)).toBeDefined()
      expect(
        screen.getByRole("button", { name: roleAiLabels.draftCta })
      ).toBeDefined()
    })

    it("calls requestRoleProfileDraft without description when the textarea is empty", async () => {
      requestMock.mockResolvedValue(null)
      renderPanel()
      fireEvent.click(
        screen.getByRole("button", { name: roleAiLabels.draftCta })
      )
      await waitFor(() => {
        expect(requestMock).toHaveBeenCalledWith({
          orgId: ORG_ID,
          roleId: ROLE_ID,
        })
      })
      // The description key must not be present when the textarea is empty.
      expect(requestMock.mock.calls[0]?.[0]).not.toHaveProperty("description")
    })

    it("includes description in the request when entered", async () => {
      requestMock.mockResolvedValue(null)
      renderPanel()
      fireEvent.change(screen.getByLabelText(roleAiLabels.descriptionLabel), {
        target: { value: "Senior backend engineer" },
      })
      fireEvent.click(
        screen.getByRole("button", { name: roleAiLabels.draftCta })
      )
      await waitFor(() => {
        expect(requestMock).toHaveBeenCalledWith({
          orgId: ORG_ID,
          roleId: ROLE_ID,
          description: "Senior backend engineer",
        })
      })
    })
  })

  describe("suggested state", () => {
    beforeEach(() => {
      useQueryMock.mockReturnValue([makeSuggestedRow()])
    })

    it("renders a row per suggested field with the field label and content", () => {
      renderPanel()
      // Label from assessment.role.*
      expect(screen.getByText(roleLabels.purpose)).toBeDefined()
      expect(screen.getByText(roleLabels.responsibilities)).toBeDefined()
      // Suggested text values
      expect(screen.getByText("Build reliable software")).toBeDefined()
      expect(screen.getByText("Code review and feature delivery")).toBeDefined()
    })

    it("defaults all checkboxes to checked", () => {
      renderPanel()
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes).toHaveLength(2)
      // Radix Checkbox exposes state via data-state, not the native .checked
      // property (the underlying button role element carries data-state).
      for (const cb of checkboxes) {
        expect((cb as HTMLElement).getAttribute("data-state")).toBe("checked")
      }
    })

    it("calls confirmRoleProfileDraft with all accepted fields on apply", async () => {
      confirmMock.mockResolvedValue(null)
      renderPanel()
      fireEvent.click(screen.getByRole("button", { name: aiLabels.applyCta }))
      await waitFor(() => {
        expect(confirmMock).toHaveBeenCalledWith({
          orgId: ORG_ID,
          suggestionId: "sug-1",
          acceptedFields: expect.arrayContaining([
            "purpose",
            "responsibilities",
          ]),
        })
      })
    })

    it("excludes unchecked fields from acceptedFields", async () => {
      confirmMock.mockResolvedValue(null)
      renderPanel()
      // Uncheck "purpose" (the first checkbox)
      const checkboxes = screen.getAllByRole("checkbox")
      const firstCheckbox = checkboxes[0]
      if (firstCheckbox === undefined) throw new Error("no checkboxes found")
      fireEvent.click(firstCheckbox)
      fireEvent.click(screen.getByRole("button", { name: aiLabels.applyCta }))
      await waitFor(() => {
        expect(confirmMock).toHaveBeenCalled()
      })
      const { acceptedFields } = (confirmMock.mock.calls[0]?.[0] ?? {}) as {
        acceptedFields: string[]
      }
      expect(acceptedFields).not.toContain("purpose")
      expect(acceptedFields).toContain("responsibilities")
    })

    it("calls rejectSuggestion on dismiss", async () => {
      rejectMock.mockResolvedValue(null)
      renderPanel()
      fireEvent.click(screen.getByRole("button", { name: aiLabels.rejectCta }))
      await waitFor(() => {
        expect(rejectMock).toHaveBeenCalledWith({
          orgId: ORG_ID,
          suggestionId: "sug-1",
        })
      })
    })
  })

  describe("failed state", () => {
    it("shows the translated error and a retry button for errorCode errors.aiUnavailable", () => {
      useQueryMock.mockReturnValue([
        {
          suggestionId: "sug-2" as never,
          kind: "role.profile",
          status: "failed",
          suggestedValue: null,
          errorCode: "errors.aiUnavailable",
          createdAt: 1,
          roleId: ROLE_ID,
        },
      ])
      renderPanel()
      expect(screen.getByRole("alert")).toBeDefined()
      expect(screen.getByText(errorLabels.aiUnavailable)).toBeDefined()
      expect(
        screen.getByRole("button", { name: roleAiLabels.draftCta })
      ).toBeDefined()
    })
  })

  describe("filtering by roleId and kind", () => {
    it("ignores suggestions for other roles and stays idle", () => {
      useQueryMock.mockReturnValue([
        {
          suggestionId: "sug-3" as never,
          kind: "role.profile",
          status: "suggested",
          suggestedValue: { profile: { purpose: "Other role purpose" } },
          errorCode: null,
          createdAt: 1,
          roleId: "role-2" as never,
        },
      ])
      renderPanel()
      // Should remain in idle state, not suggested state.
      expect(screen.getByLabelText(roleAiLabels.descriptionLabel)).toBeDefined()
      expect(screen.queryByText("Other role purpose")).toBeNull()
    })

    it("ignores suggestions with a different kind and stays idle", () => {
      useQueryMock.mockReturnValue([
        {
          suggestionId: "sug-4" as never,
          kind: "model.draft",
          status: "suggested",
          suggestedValue: { profile: { purpose: "Wrong kind purpose" } },
          errorCode: null,
          createdAt: 1,
          roleId: ROLE_ID,
        },
      ])
      renderPanel()
      expect(screen.getByLabelText(roleAiLabels.descriptionLabel)).toBeDefined()
      expect(screen.queryByText("Wrong kind purpose")).toBeNull()
    })
  })
})
