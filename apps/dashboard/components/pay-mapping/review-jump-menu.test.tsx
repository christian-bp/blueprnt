import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReviewJumpMenu } from "@/components/pay-mapping/review-jump-menu"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingGapResult,
  WomenDominatedComparisonWire,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { buildReviewQueue } from "@/components/pay-mapping/review-queue"

const t = messages.dashboard.payMapping.review
const tJourney = messages.dashboard.payMapping.journey

function equalWorkGroup(overrides: Partial<GapGroup> = {}): GapGroup {
  return {
    key: "k",
    roleTitle: "Role",
    level: "Level",
    band: 3,
    womenCount: 2,
    menCount: 2,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
    ...overrides,
  }
}

const COMPARISON: WomenDominatedComparisonWire = {
  key: "cmp-1",
  roleTitle: "Technician",
  level: "Mid",
  band: 3,
  headcount: 4,
  womenSharePct: 25,
  meanComp: 44000,
  diffPct: 10,
  diffSek: 4000,
}

function womenDominatedGroup(
  overrides: Partial<WomenDominatedGroupWire> = {}
): WomenDominatedGroupWire {
  return {
    key: "wd",
    roleTitle: "Nurse",
    level: "Senior",
    band: 3,
    headcount: 10,
    womenSharePct: 90,
    meanComp: 40000,
    comparisons: [],
    ...overrides,
  }
}

// SWE (elevated, undone) and Sales (critical, done) are required queue
// members; QA (ok flag) is a non-queue group that always shows "no remark".
const GAP: PayMappingGapResult = {
  currency: "SEK",
  org: {
    womenCount: 6,
    menCount: 6,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
  },
  equalWork: [
    equalWorkGroup({
      key: "swe",
      roleTitle: "SWE",
      level: "Senior",
      gapPct: 8,
      flag: "elevated",
    }),
    equalWorkGroup({
      key: "sales",
      roleTitle: "Sales",
      level: "Mid",
      gapPct: 15,
      flag: "critical",
    }),
    equalWorkGroup({
      key: "qa",
      roleTitle: "QA",
      level: "Mid",
      gapPct: 2,
      flag: "ok",
    }),
  ],
  equivalentWork: [],
  womenDominated: [
    womenDominatedGroup({
      key: "wd-1",
      roleTitle: "Nurse",
      level: "Senior",
      comparisons: [COMPARISON],
    }),
    womenDominatedGroup({
      key: "wd-2",
      roleTitle: "Receptionist",
      level: "Junior",
      comparisons: [],
    }),
  ],
  population: { women: 6, men: 6 },
  quartiles: [
    { women: 1, men: 1 },
    { women: 1, men: 1 },
    { women: 2, men: 2 },
    { women: 2, men: 2 },
  ],
  age: {
    buckets: Array.from({ length: 7 }, () => ({ women: 0, men: 0 })),
    unknown: 0,
  },
}

const ANALYSES: GroupAnalysis[] = [
  {
    scope: "praxis",
    groupKey: "payPolicy",
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  },
  {
    scope: "equalWork",
    groupKey: "sales",
    reasons: ["experience"],
    note: null,
    done: true,
    finding: null,
  },
]

function renderMenu(
  overrides: Partial<{
    analyses: GroupAnalysis[]
    currentIndex: number
    onJumpToIndex: (index: number) => void
    onOpenExtraGroup: (
      scope: "equalWork" | "equivalentWork",
      key: string
    ) => void
  }> = {}
) {
  const analyses = overrides.analyses ?? ANALYSES
  const queue = buildReviewQueue({
    gap: GAP,
    analyses,
    collaboration: null,
    hasPreviousCompletedRun: false,
  })
  const onJumpToIndex = overrides.onJumpToIndex ?? vi.fn()
  const onOpenExtraGroup = overrides.onOpenExtraGroup ?? vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewJumpMenu
        queue={queue}
        gap={GAP}
        analyses={analyses}
        currentIndex={overrides.currentIndex ?? 0}
        onJumpToIndex={onJumpToIndex}
        onOpenExtraGroup={onOpenExtraGroup}
      />
    </NextIntlClientProvider>
  )
  return { queue, onJumpToIndex, onOpenExtraGroup }
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: t.allSteps }))
}

// Scopes a status assertion to the row's own button (several rows can
// legitimately share the same plain status word, e.g. several undone praxis
// areas all say "to review"), so this never risks a getByText collision.
function rowFor(label: string): HTMLElement {
  const row = screen.getByText(label).closest("button")
  if (row === null) throw new Error(`no row button found for label ${label}`)
  return row
}

afterEach(() => cleanup())

describe("ReviewJumpMenu", () => {
  // The rows show only a done icon + the label (the shared review-checklist
  // presentation); the done/remaining state is sr-only text and the gap
  // details live on the step cards, so no gap or status word is visible.
  it("lists the non-queue ok-flag equal-work group as a plain icon + label row with an sr-only state", () => {
    renderMenu()
    openMenu()
    // Exact content: the icon is an svg (no text), so the row's text is the
    // label + the sr-only state and NOTHING else (no gap, no status word).
    expect(rowFor("QA · Mid").textContent).toBe(`QA · Mid${t.status.toReview}`)
  })

  it("marks queue equal-work groups done/to-review via the sr-only state, with no visible gap text", () => {
    renderMenu()
    openMenu()
    expect(rowFor("SWE · Senior").textContent).toBe(
      `SWE · Senior${t.status.toReview}`
    )
    expect(rowFor("Sales · Mid").textContent).toBe(
      `Sales · Mid${t.status.done}`
    )
  })

  it("shows praxis areas with a done/to-review state", () => {
    renderMenu()
    openMenu()
    const praxis = t.praxis
    expect(rowFor(praxis.payPolicy.title).textContent).toContain(t.status.done)
    expect(rowFor(praxis.collectiveAgreements.title).textContent).toContain(
      t.status.toReview
    )
  })

  it("lists a zero-comparison women-dominated group as a plain icon + label row", () => {
    renderMenu()
    openMenu()
    expect(rowFor("Receptionist · Junior").textContent).toBe(
      `Receptionist · Junior${t.status.toReview}`
    )
  })

  it("renders chapters as accordion sections with the journey count as right-aligned meta", () => {
    renderMenu()
    openMenu()
    const trigger = screen
      .getAllByRole("button")
      .find(
        (button) =>
          button.getAttribute("data-slot") === "accordion-trigger" &&
          (button.textContent ?? "").startsWith(t.chapters.praxis)
      )
    expect(trigger?.textContent).toContain(
      tJourney.count.replace("{done}", "1").replace("{total}", "4")
    )
  })

  it("filters rows by label via the search field, hiding non-matching sections too", () => {
    renderMenu()
    openMenu()
    fireEvent.change(screen.getByPlaceholderText(t.searchSteps), {
      target: { value: "sales" },
    })
    expect(screen.getByText("Sales · Mid")).toBeDefined()
    expect(screen.queryByText("SWE · Senior")).toBeNull()
    expect(screen.queryByText("QA · Mid")).toBeNull()
    expect(screen.queryByText(t.chapters.praxis)).toBeNull()
  })

  it("jumps a queue step by index and closes the sheet", () => {
    const { onJumpToIndex, onOpenExtraGroup, queue } = renderMenu()
    openMenu()
    fireEvent.click(screen.getByText("Sales · Mid"))

    const expectedIndex = queue.steps.findIndex(
      (s) =>
        s.kind === "group" && s.scope === "equalWork" && s.group.key === "sales"
    )
    expect(onJumpToIndex).toHaveBeenCalledWith(expectedIndex)
    expect(onOpenExtraGroup).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText(t.searchSteps)).toBeNull()
  })

  it("opens a non-queue group via onOpenExtraGroup and closes the sheet", () => {
    const { onJumpToIndex, onOpenExtraGroup } = renderMenu()
    openMenu()
    fireEvent.click(screen.getByText("QA · Mid"))

    expect(onOpenExtraGroup).toHaveBeenCalledWith("equalWork", "qa")
    expect(onJumpToIndex).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText(t.searchSteps)).toBeNull()
  })

  it("jumps to the start step from the collaboration row", () => {
    const { onJumpToIndex } = renderMenu()
    openMenu()
    fireEvent.click(screen.getByText(t.collaborationTitle))
    expect(onJumpToIndex).toHaveBeenCalledWith(0)
  })
})
