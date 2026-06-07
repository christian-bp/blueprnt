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

const requestImportanceReviewMock = vi.fn()
const confirmImportanceReviewMock = vi.fn()
const rejectSuggestionMock = vi.fn()
const useQueryMock = vi.fn()

const mutationByRef = new Map<unknown, ReturnType<typeof vi.fn>>([
  ["ai.suggest.requestImportanceReview", requestImportanceReviewMock],
  ["ai.suggest.confirmImportanceReview", confirmImportanceReviewMock],
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
        requestImportanceReview: "ai.suggest.requestImportanceReview",
        confirmImportanceReview: "ai.suggest.confirmImportanceReview",
        rejectSuggestion: "ai.suggest.rejectSuggestion",
      },
    },
  },
}))

import { ImportanceReviewPanel } from "@/components/onboarding/importance-review-panel"

const ai = messages.dashboard.ai

// The model prop mirrors the relevant slice of the getModel result.
const model = {
  criteria: [
    {
      criterionId: "c1" as never,
      name: "Problem solving",
      importanceLevel: 4,
    },
    { criterionId: "c2" as never, name: "Autonomy", importanceLevel: 3 },
  ],
}

function renderPanel(orgId = "org-123") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ImportanceReviewPanel orgId={orgId} model={model} />
    </NextIntlClientProvider>
  )
}

describe("ImportanceReviewPanel autoRequest", () => {
  beforeEach(() => {
    requestImportanceReviewMock.mockReset()
    requestImportanceReviewMock.mockResolvedValue(null)
    useQueryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("fires one review request on mount when nothing is open", async () => {
    useQueryMock.mockReturnValue([])
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportanceReviewPanel orgId="org-123" model={model} autoRequest />
      </NextIntlClientProvider>
    )
    await waitFor(() => {
      expect(requestImportanceReviewMock).toHaveBeenCalledTimes(1)
    })
    expect(requestImportanceReviewMock).toHaveBeenCalledWith({
      orgId: "org-123",
      locale: "en",
    })
  })

  it("does not request while the suggestions query is still loading", () => {
    useQueryMock.mockReturnValue(undefined)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportanceReviewPanel orgId="org-123" model={model} autoRequest />
      </NextIntlClientProvider>
    )
    expect(requestImportanceReviewMock).not.toHaveBeenCalled()
  })

  it("does not request when an open review already exists", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "s1",
        kind: "model.importanceReview",
        status: "generating",
        createdAt: Date.now(),
      },
    ])
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportanceReviewPanel orgId="org-123" model={model} autoRequest />
      </NextIntlClientProvider>
    )
    expect(requestImportanceReviewMock).not.toHaveBeenCalled()
  })
})

describe("ImportanceReviewPanel dismissOnUnmount", () => {
  beforeEach(() => {
    rejectSuggestionMock.mockReset()
    rejectSuggestionMock.mockResolvedValue(null)
    requestImportanceReviewMock.mockReset()
    useQueryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("rejects an open suggested review when the panel unmounts (popover closed)", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "s9",
        kind: "model.importanceReview",
        status: "suggested",
        suggestedValue: { adjustments: [] },
        createdAt: Date.now(),
      },
    ])
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportanceReviewPanel orgId="org-123" model={model} dismissOnUnmount />
      </NextIntlClientProvider>
    )
    view.unmount()
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-123",
      suggestionId: "s9",
    })
  })

  it("leaves a generating row alone on unmount", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "s10",
        kind: "model.importanceReview",
        status: "generating",
        createdAt: Date.now(),
      },
    ])
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportanceReviewPanel orgId="org-123" model={model} dismissOnUnmount />
      </NextIntlClientProvider>
    )
    view.unmount()
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
  })
})

describe("ImportanceReviewPanel", () => {
  beforeEach(() => {
    requestImportanceReviewMock.mockReset()
    confirmImportanceReviewMock.mockReset()
    rejectSuggestionMock.mockReset()
    useQueryMock.mockReset()
    useQueryMock.mockReturnValue([])
  })

  afterEach(() => {
    cleanup()
  })

  it("resolves criterion names from the model and applies only the checked ids", async () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "sug-1",
        kind: "model.importanceReview",
        status: "suggested",
        suggestedValue: {
          adjustments: [
            {
              criterionId: "c1",
              suggestedImportanceLevel: 6,
              motivation: "Highly technical context.",
            },
            {
              criterionId: "c2",
              suggestedImportanceLevel: 5,
              motivation: "More independent than the default.",
            },
          ],
        },
        errorCode: null,
        createdAt: Date.now(),
      },
    ])
    confirmImportanceReviewMock.mockResolvedValue(null)
    renderPanel("org-rev")

    // The name comes from the model prop, not the adjustment payload.
    expect(screen.getByText("Problem solving")).toBeDefined()
    expect(screen.getByText("Autonomy")).toBeDefined()
    // Importance is shown as a label, never a number.
    expect(screen.queryByText(/\b13\b/)).toBeNull()

    // Both default to checked; uncheck Autonomy (c2), then apply.
    fireEvent.click(screen.getByRole("checkbox", { name: /Autonomy/ }))
    fireEvent.click(screen.getByRole("button", { name: ai.applyCta }))

    await waitFor(() => {
      expect(confirmImportanceReviewMock).toHaveBeenCalledTimes(1)
    })
    expect(confirmImportanceReviewMock).toHaveBeenCalledWith({
      orgId: "org-rev",
      suggestionId: "sug-1",
      acceptedCriterionIds: ["c1"],
    })
  })

  it("shows noAdjustments and only a dismiss button for an empty adjustment list", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "sug-1",
        kind: "model.importanceReview",
        status: "suggested",
        suggestedValue: { adjustments: [] },
        errorCode: null,
        createdAt: Date.now(),
      },
    ])
    renderPanel()

    expect(screen.getByText(ai.noAdjustments)).toBeDefined()
    expect(screen.getByRole("button", { name: ai.rejectCta })).toBeDefined()
    expect(screen.queryByRole("button", { name: ai.applyCta })).toBeNull()
  })
})
