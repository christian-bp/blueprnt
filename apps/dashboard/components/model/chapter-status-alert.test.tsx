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

import { CHAPTER_ACTION_BUTTON_SIZE } from "@/components/model/chapter-status-alert"
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
  sharedScale: [],
  midpoints: { step2: "", step4: "" },
  dimensions: [
    { key: "effort", name: "Effort and complexity", question: "", why: "" },
    {
      key: "workingConditions",
      name: "Working conditions",
      question: "",
      why: "",
    },
  ],
  tracks: [],
  levelRules: [],
  zoneProfileRules: [],
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

describe("the chapter status block's actions", () => {
  beforeEach(() => {
    onQuery((ref) => {
      if (ref === "evaluationModel.model.getModel") return MODEL
      if (ref === "evaluationModel.method.getMethodModel") return null
      if (ref === "evaluationModel.approval.getMethodChecks") return null
      if (ref === "ai.suggest.getWeightReviewLock") return false
      return undefined
    })
  })
  afterEach(cleanup)

  // One size across the section: the blocks sit at the same place on four
  // chapters, and a reader moving between them should not meet a row of
  // controls that changes height as they go.
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

  // Viktning's own actions (the AI review trigger and the save) had drifted to
  // `sm` while Metod's export stayed at the default. Both chapters are read
  // here, from their real render, because a constant nothing points at is a
  // constant a new chapter can quietly ignore.
  it("gives every chapter's status-block action the same size", () => {
    const { container: reference } = wrap(<Button>Reference</Button>)
    const expected = heightOf(reference.querySelector("button") as Element)

    const { container: weighting } = wrap(<WeightingChapter orgId="org-1" />)
    const weightingActions = [
      ...weighting.querySelectorAll(
        '[data-slot="chapter-status-actions"] button'
      ),
    ]
    // The review trigger and the save, both of them.
    expect(weightingActions).toHaveLength(2)
    for (const action of weightingActions) {
      expect(heightOf(action)).toBe(expected)
    }

    wrap(<MethodAppendixDownload orgId="org-1" />)
    expect(
      heightOf(screen.getByRole("button", { name: method.downloadPdf }))
    ).toBe(expected)
  })
})
