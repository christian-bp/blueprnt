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

import { mockMutation, onQuery } from "@/test/convex-mocks"

const requestWeightReviewMock = mockMutation("ai.suggest.requestWeightReview")
const confirmWeightReviewMock = mockMutation("ai.suggest.confirmWeightReview")
const rejectSuggestionMock = mockMutation("ai.suggest.rejectSuggestion")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import { WeightReviewPanel } from "@/components/onboarding/weight-review-panel"

const ai = messages.dashboard.ai

// The model prop mirrors the relevant slice of the getModel result.
const model = {
  criteria: [
    { criterionId: "c1" as never, name: "Problem solving", weightPoints: 4 },
    { criterionId: "c2" as never, name: "Autonomy", weightPoints: 3 },
    { criterionId: "c3" as never, name: "Formal merit", weightPoints: 2 },
  ],
}

function renderPanel(orgId = "org-123") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WeightReviewPanel orgId={orgId} model={model} />
    </NextIntlClientProvider>
  )
}

describe("WeightReviewPanel autoRequest", () => {
  beforeEach(() => {
    requestWeightReviewMock.mockReset()
    requestWeightReviewMock.mockResolvedValue(null)
    useQueryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("fires one review request on mount when nothing is open", async () => {
    useQueryMock.mockReturnValue([])
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WeightReviewPanel orgId="org-123" model={model} autoRequest />
      </NextIntlClientProvider>
    )
    await waitFor(() => {
      expect(requestWeightReviewMock).toHaveBeenCalledTimes(1)
    })
    expect(requestWeightReviewMock).toHaveBeenCalledWith({
      orgId: "org-123",
      locale: "en",
    })
  })

  it("does not request while the suggestions query is still loading", () => {
    useQueryMock.mockReturnValue(undefined)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WeightReviewPanel orgId="org-123" model={model} autoRequest />
      </NextIntlClientProvider>
    )
    expect(requestWeightReviewMock).not.toHaveBeenCalled()
  })

  it("does not request when an open review already exists", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "s1",
        kind: "model.weightReview",
        status: "generating",
        createdAt: Date.now(),
      },
    ])
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WeightReviewPanel orgId="org-123" model={model} autoRequest />
      </NextIntlClientProvider>
    )
    expect(requestWeightReviewMock).not.toHaveBeenCalled()
  })
})

describe("WeightReviewPanel close behavior", () => {
  beforeEach(() => {
    rejectSuggestionMock.mockReset()
    rejectSuggestionMock.mockResolvedValue(null)
    requestWeightReviewMock.mockReset()
    useQueryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("keeps an open suggested review when the panel unmounts (closing is not a dismiss)", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "s9",
        kind: "model.weightReview",
        status: "suggested",
        suggestedValue: { moves: [] },
        createdAt: Date.now(),
      },
    ])
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WeightReviewPanel orgId="org-123" model={model} />
      </NextIntlClientProvider>
    )
    view.unmount()
    // Only an explicit apply or dismiss settles the suggestion; reopening
    // must show the same review again.
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
  })

  it("leaves a generating row alone on unmount", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "s10",
        kind: "model.weightReview",
        status: "generating",
        createdAt: Date.now(),
      },
    ])
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WeightReviewPanel orgId="org-123" model={model} />
      </NextIntlClientProvider>
    )
    view.unmount()
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
  })
})

describe("WeightReviewPanel", () => {
  beforeEach(() => {
    requestWeightReviewMock.mockReset()
    confirmWeightReviewMock.mockReset()
    rejectSuggestionMock.mockReset()
    useQueryMock.mockReset()
    useQueryMock.mockReturnValue([])
  })

  afterEach(() => {
    cleanup()
  })

  it("renders moves with current points and applies only the checked indexes", async () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "sug-1",
        kind: "model.weightReview",
        status: "suggested",
        suggestedValue: {
          moves: [
            {
              fromCriterionId: "c3",
              toCriterionId: "c1",
              points: 1,
              motivation: "Highly technical context.",
            },
            {
              fromCriterionId: "c3",
              toCriterionId: "c2",
              points: 1,
              motivation: "More independent than the default.",
            },
          ],
        },
        errorCode: null,
        createdAt: Date.now(),
      },
    ])
    confirmWeightReviewMock.mockResolvedValue(null)
    renderPanel("org-rev")

    // One suggestion = one sentence (the zero-sum transfer), with the
    // numbers detailed below it.
    expect(
      screen.getByText(
        "Move 1 weight point from Formal merit to Problem solving"
      )
    ).toBeDefined()
    expect(screen.getAllByText("Problem solving")).toHaveLength(1)
    expect(screen.getAllByText("Formal merit")).toHaveLength(2)
    expect(screen.getByText("Highly technical context.")).toBeDefined()

    // Both default to checked; uncheck the second move (to Autonomy), apply.
    fireEvent.click(screen.getByRole("checkbox", { name: /Autonomy/ }))
    fireEvent.click(screen.getByRole("button", { name: ai.applyCta }))

    await waitFor(() => {
      expect(confirmWeightReviewMock).toHaveBeenCalledTimes(1)
    })
    expect(confirmWeightReviewMock).toHaveBeenCalledWith({
      orgId: "org-rev",
      suggestionId: "sug-1",
      acceptedMoveIndexes: [0],
    })
  })

  it("shows noMoves and only a dismiss button for an empty move list", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "sug-1",
        kind: "model.weightReview",
        status: "suggested",
        suggestedValue: { moves: [] },
        errorCode: null,
        createdAt: Date.now(),
      },
    ])
    renderPanel()

    expect(screen.getByText(ai.noMoves)).toBeDefined()
    expect(screen.getByRole("button", { name: ai.rejectCta })).toBeDefined()
    expect(screen.queryByRole("button", { name: ai.applyCta })).toBeNull()
  })

  it("treats a review whose moves cannot be resolved as empty", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "sug-2",
        kind: "model.weightReview",
        status: "suggested",
        suggestedValue: {
          moves: [
            {
              fromCriterionId: "ghost",
              toCriterionId: "c1",
              points: 1,
              motivation: "Stale criterion.",
            },
          ],
        },
        errorCode: null,
        createdAt: Date.now(),
      },
    ])
    renderPanel()

    expect(screen.getByText(ai.noMoves)).toBeDefined()
    expect(screen.queryByRole("button", { name: ai.applyCta })).toBeNull()
  })

  it("treats a malformed stored payload as empty (Zod gate before render)", () => {
    useQueryMock.mockReturnValue([
      {
        suggestionId: "sug-3",
        kind: "model.weightReview",
        status: "suggested",
        // Free text instead of the moves object: must never render as a move.
        suggestedValue: { moves: "I suggest increasing everything!" },
        errorCode: null,
        createdAt: Date.now(),
      },
    ])
    renderPanel()

    expect(screen.getByText(ai.noMoves)).toBeDefined()
    expect(screen.queryByRole("checkbox")).toBeNull()
    expect(screen.queryByRole("button", { name: ai.applyCta })).toBeNull()
  })
})
