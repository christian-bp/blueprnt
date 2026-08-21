import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { Button } from "@workspace/ui/components/button"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
// NumberFlow renders a custom element happy-dom never upgrades; the figures
// are not what this file is about.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))
// The export button's document is built with @react-pdf/renderer, whose
// stylesheet runs at module load. Nothing here presses the button, so the
// document and the renderer are both stood aside.
vi.mock("@react-pdf/renderer", () => ({ pdf: vi.fn() }))
vi.mock("@/components/pdf/method-appendix", () => ({
  MethodAppendix: () => null,
}))

import {
  CHAPTER_ACTION_BUTTON_SIZE,
  ChapterFraming,
} from "@/components/model/chapter-framing"
import { CriteriaChapter } from "@/components/model/criteria-chapter"
import { MethodPanel } from "@/components/model/method-panel"
import { WeightingChapter } from "@/components/model/weighting-chapter"
import { MethodAppendixDownload } from "@/components/pdf/method-appendix-download"
import { onQuery } from "@/test/convex-mocks"

const method = messages.dashboard.model.method

const MODEL = {
  modelId: "model-1",
  name: "Standard",
  approval: null,
  workingConditions: null,
  criteria: [
    {
      weightMotivation: null,
      criterionId: "c1",
      libraryKey: "complexity-ambiguity",
      dimensionKey: "effort",
      name: "Complexity and ambiguity",
      shortUiText: "",
      weightPoints: 3,
      order: 1,
    },
  ],
  midpoints: { step2: "", step4: "" },
  dimensions: [
    { key: "effort", name: "Effort and complexity" },
    {
      key: "workingConditions",
      name: "Working conditions",
    },
  ],
  tracks: [],
  levelRules: [],
  zoneProfileRules: [],
}

// The same one criterion, as the Metod chapter's own query serves it.
const METHOD_MODEL = {
  modelName: "Standard",
  pointBudget: 3,
  criteria: [
    {
      criterionId: "c1",
      libraryKey: "complexity-ambiguity",
      dimensionKey: "effort",
      name: "Complexity and ambiguity",
      description: "",
      weightPoints: 3,
      share: 100,
      order: 1,
      purpose: null,
      whyRelevant: null,
      overlapNotes: null,
      biasRisk: null,
      biasComment: null,
      biasAction: null,
      status: "notStarted",
      decidedByName: null,
      decidedAt: null,
    },
  ],
  levelRules: [],
  progress: { documented: 0, approved: 0, total: 1 },
  modelApproved: false,
}

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

// The one class that decides how tall a Button stands. Compared as a token
// rather than by matching the whole class string, which carries variant,
// radius and icon rules the size has no say over.
const heightOf = (button: Element) =>
  button.className.split(/\s+/).find((token) => /^h-\d+$/.test(token))

describe("the chapter framing row", () => {
  beforeEach(() => {
    onQuery((ref) => {
      if (ref === "evaluationModel.model.getModel") return MODEL
      if (ref === "evaluationModel.method.getMethodModel") return METHOD_MODEL
      if (ref === "evaluationModel.approval.getMethodChecks") return null
      if (ref === "accounts.organization.getOrganizationSettings") {
        return { industry: null }
      }
      if (ref === "ai.suggest.getWeightReviewLock") return false
      return undefined
    })
  })
  afterEach(cleanup)

  // One size across the section: the rows sit at the same place on four
  // chapters, and a reader moving between them should not meet a control that
  // changes height as they go.
  it("is the design system's default size, not a hand-picked one", () => {
    const { container } = wrap(
      <>
        <Button size={CHAPTER_ACTION_BUTTON_SIZE}>Chapter action</Button>
        <Button>Reference</Button>
        <Button size="sm">Smaller</Button>
      </>
    )
    const [chapterAction, reference, smaller] = [
      ...container.querySelectorAll("button"),
    ]
    expect(heightOf(chapterAction as Element)).toBe(
      heightOf(reference as Element)
    )
    // The sanity half of the pin: the two sizes really are different, so the
    // assertion above cannot pass by both being the same thing.
    expect(heightOf(smaller as Element)).not.toBe(
      heightOf(reference as Element)
    )
  })

  // Both chapters are read here, from their real render, because a constant
  // nothing points at is a constant a new chapter can quietly ignore.
  it("gives every chapter's framing-row action the same size", () => {
    const { container: reference } = wrap(<Button>Reference</Button>)
    const expected = heightOf(reference.querySelector("button") as Element)

    const { container: weighting } = wrap(<WeightingChapter orgId="org-1" />)
    const weightingActions = [
      ...weighting.querySelectorAll('[data-slot="chapter-action"] button'),
    ]
    // The AI review trigger, which is this chapter's framing-row action.
    expect(weightingActions).toHaveLength(1)
    for (const action of weightingActions) {
      expect(heightOf(action)).toBe(expected)
    }

    wrap(<MethodAppendixDownload orgId="org-1" />)
    expect(
      heightOf(screen.getByRole("button", { name: method.downloadPdf }))
    ).toBe(expected)
  })

  // The whole point of the row: every chapter's grid begins directly under it,
  // at the same height, so switching chapters holds the columns still.
  // Anything between the two (the budget block, the documentation counts, the
  // framing sentence the row used to carry) moved one chapter's grid down and
  // made the switch a jump.
  it("stands nothing between itself and the chapter's grid", () => {
    const chapters = [
      <CriteriaChapter key="criteria" orgId="org-1" />,
      <WeightingChapter key="weighting" orgId="org-1" />,
      <MethodPanel key="method" orgId="org-1" />,
    ]
    for (const node of chapters) {
      const { container } = wrap(node)
      const root = container.firstElementChild as HTMLElement
      // First the row, reserving the action slot's height and nothing else.
      expect(root.children[0]?.className).toContain("min-h-9")
      // Then the grid. Nothing in between.
      expect(root.children[1]?.className).toContain("sm:grid-cols-2")
      cleanup()
    }
  })

  // The chapter surfaces speak for themselves: the spine names the chapter and
  // marks it current, the columns carry their own titles and counts. A
  // permanent sentence restating that is prose the reader passes through on
  // every visit to reach the work.
  it("carries no framing sentence of its own", () => {
    for (const node of [
      <CriteriaChapter key="criteria" orgId="org-1" />,
      <WeightingChapter key="weighting" orgId="org-1" />,
      <MethodPanel key="method" orgId="org-1" />,
    ]) {
      const { container } = wrap(node)
      const row = container.firstElementChild?.firstElementChild as HTMLElement
      expect(row.className).toContain("min-h-9")
      // Only the action slot, or nothing at all: no text of the row's own.
      expect(row.textContent).toBe(
        row.querySelector('[data-slot="chapter-action"]')?.textContent ?? ""
      )
      cleanup()
    }
  })

  // The row keeps the action slot's height even where a chapter offers none,
  // so Kriterier's grid does not sit a control higher than the other two.
  it("keeps its height on a chapter with no action", () => {
    const { container } = wrap(<ChapterFraming />)
    const row = container.firstElementChild as HTMLElement
    expect(row.className.split(/\s+/)).toContain("min-h-9")
    expect(row.querySelector('[data-slot="chapter-action"]')).toBeNull()
  })
})
