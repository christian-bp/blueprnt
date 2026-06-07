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

// String refs stand in for the generated api function references. useMutation
// dispatches through an explicit map keyed on those refs, so a typo or a
// renamed ref throws instead of silently returning the wrong mock.
const requestModelDraftMock = vi.fn()
const confirmModelDraftMock = vi.fn()
const rejectSuggestionMock = vi.fn()
const useQueryMock = vi.fn()

const mutationByRef = new Map<unknown, ReturnType<typeof vi.fn>>([
  ["ai.suggest.requestModelDraft", requestModelDraftMock],
  ["ai.suggest.confirmModelDraft", confirmModelDraftMock],
  ["ai.suggest.rejectSuggestion", rejectSuggestionMock],
])

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const mock = mutationByRef.get(ref)
    if (mock === undefined)
      throw new Error(`unexpected useMutation ref: ${ref}`)
    return mock
  },
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    ai: {
      suggest: {
        getOpenSuggestions: "ai.suggest.getOpenSuggestions",
        requestModelDraft: "ai.suggest.requestModelDraft",
        confirmModelDraft: "ai.suggest.confirmModelDraft",
        rejectSuggestion: "ai.suggest.rejectSuggestion",
      },
    },
  },
}))

import { ModelDraftPanel } from "@/components/onboarding/model-draft-panel"

const ai = messages.dashboard.ai
const errors = messages.errors

function draftCriteria() {
  return [
    {
      name: "Problem solving",
      description: "How the role tackles novel problems.",
      helpText: "Assess complexity.",
      // Level 5 maps to the "Important" label; the raw weight (13) must never
      // surface in the UI.
      importanceLevel: 5,
      anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
    },
    {
      name: "Autonomy",
      description: "How independently the role operates.",
      helpText: "Assess oversight.",
      importanceLevel: 3,
      anchors: ["b0", "b1", "b2", "b3", "b4", "b5"],
    },
  ]
}

function suggestedRow(createdAt = Date.now()) {
  return [
    {
      suggestionId: "sug-1",
      kind: "model.draft",
      status: "suggested",
      suggestedValue: { criteria: draftCriteria() },
      errorCode: null,
      createdAt,
    },
  ]
}

function renderPanel(orgId = "org-123") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelDraftPanel orgId={orgId} />
    </NextIntlClientProvider>
  )
}

describe("ModelDraftPanel", () => {
  beforeEach(() => {
    requestModelDraftMock.mockReset()
    confirmModelDraftMock.mockReset()
    rejectSuggestionMock.mockReset()
    useQueryMock.mockReset()
    useQueryMock.mockReturnValue([])
  })

  afterEach(() => {
    cleanup()
  })

  it("omits the description when the textarea is empty", async () => {
    requestModelDraftMock.mockResolvedValue("sug-1")
    renderPanel("org-abc")

    fireEvent.click(screen.getByRole("button", { name: ai.draftCta }))

    await waitFor(() => {
      expect(requestModelDraftMock).toHaveBeenCalledTimes(1)
    })
    expect(requestModelDraftMock).toHaveBeenCalledWith({
      orgId: "org-abc",
      locale: "en",
    })
  })

  it("sends a trimmed description when the textarea is non-empty", async () => {
    requestModelDraftMock.mockResolvedValue("sug-1")
    renderPanel("org-abc")

    fireEvent.change(screen.getByLabelText(ai.draftDescriptionLabel), {
      target: { value: "  A small clinic  " },
    })
    fireEvent.click(screen.getByRole("button", { name: ai.draftCta }))

    await waitFor(() => {
      expect(requestModelDraftMock).toHaveBeenCalledWith({
        orgId: "org-abc",
        locale: "en",
        description: "A small clinic",
      })
    })
  })

  it("renders criteria with importance LABELS, never raw weight numbers", () => {
    useQueryMock.mockReturnValue(suggestedRow())
    renderPanel()

    // Importance shows as the label, never the weight behind the level.
    expect(screen.getByText(messages.model.importance.high)).toBeDefined()
    expect(screen.getByText(messages.model.importance.moderate)).toBeDefined()
    // The raw weight (13 for level 5) must not appear anywhere.
    expect(screen.queryByText(/\b13\b/)).toBeNull()
    expect(screen.getByText("Problem solving")).toBeDefined()
  })

  it("confirms only the still-checked criteria after one is unchecked", async () => {
    useQueryMock.mockReturnValue(suggestedRow())
    confirmModelDraftMock.mockResolvedValue(null)
    renderPanel("org-xyz")

    // Both default to checked; uncheck the first (Problem solving, index 0).
    fireEvent.click(screen.getByLabelText(/Problem solving/))
    fireEvent.click(screen.getByRole("button", { name: ai.confirmCta }))

    await waitFor(() => {
      expect(confirmModelDraftMock).toHaveBeenCalledTimes(1)
    })
    expect(confirmModelDraftMock).toHaveBeenCalledWith({
      orgId: "org-xyz",
      suggestionId: "sug-1",
      acceptedIndexes: [1],
    })
  })

  it("shows the translated generation-failure message and a retry button", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "sug-1",
        kind: "model.draft",
        status: "failed",
        suggestedValue: null,
        errorCode: "errors.aiGenerationFailed",
        createdAt: Date.now(),
      },
    ])
    renderPanel()

    expect(screen.getByRole("alert").textContent).toBe(
      errors.aiGenerationFailed
    )
    expect(screen.getByRole("button", { name: ai.draftCta })).toBeDefined()
  })

  it("treats a stale generating row as a failure with a retry button", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "sug-1",
        kind: "model.draft",
        status: "generating",
        suggestedValue: null,
        errorCode: null,
        // Five minutes ago: older than the 90s staleness window.
        createdAt: Date.now() - 5 * 60_000,
      },
    ])
    renderPanel()

    // The failed UI renders the generic generation-failure message, not the
    // spinner / generating text.
    expect(screen.getByRole("alert").textContent).toBe(
      errors.aiGenerationFailed
    )
    expect(screen.queryByText(ai.generating)).toBeNull()
    expect(screen.getByRole("button", { name: ai.draftCta })).toBeDefined()
  })
})
