import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

import { mockMutation, onQuery } from "@/test/convex-mocks"

// Register the mutations ModelEditor wires up so useMutation resolves.
mockMutation("evaluationModel.criteria.rebalanceWeights")
mockMutation("evaluationModel.criteria.removeCriterion")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import { ModelEditor } from "@/components/model/model-editor"

const editor = messages.dashboard.model.editor

// Minimal getModel payload: one criterion at the full weight budget, so the
// derived share is 100.0% and the read-mode label is unambiguous.
const MODEL = {
  criteria: [
    {
      criterionId: "c1",
      name: "Complexity",
      description: "How hard the problems are",
      helpText: "",
      weightPoints: 5,
      anchors: [
        { level: 0, text: "a0" },
        { level: 1, text: "a1" },
        { level: 2, text: "a2" },
        { level: 3, text: "a3" },
        { level: 4, text: "a4" },
        { level: 5, text: "a5" },
      ],
    },
  ],
}

function dispatch(ref: string) {
  if (ref === "evaluationModel.model.getModel") return MODEL
  if (ref === "ai.suggest.getWeightReviewLock") return false
  return undefined
}

function renderEditor() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelEditor orgId="org-1" />
    </NextIntlClientProvider>
  )
}

describe("ModelEditor read-mode importance label", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    useQueryMock.mockImplementation((ref: string) => dispatch(ref))
  })
  afterEach(() => {
    cleanup()
  })

  it("prefixes the importance value with the Importance label", () => {
    renderEditor()
    // The label, the points, and the derived share all render in the row.
    expect(screen.getByText(editor.importance)).toBeDefined()
    expect(
      screen.getByText("5", { selector: "span.tabular-nums" })
    ).toBeDefined()
    expect(screen.getByText(/100[.,]0\s*%/)).toBeDefined()
  })
})
