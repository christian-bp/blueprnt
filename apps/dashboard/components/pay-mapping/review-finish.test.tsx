import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// The finale is a step inside the /review takeover now; its own href
// derivation (overviewHref/summaryHref) reads the slug the same way
// regardless of the trailing segment.
vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026/review",
}))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))

import { ConvexError } from "convex/values"
import { toast } from "sonner"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingRunDetail,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { ReviewFinish } from "@/components/pay-mapping/review-finish"
import { buildReviewQueue } from "@/components/pay-mapping/review-queue"
import { mockMutation } from "@/test/convex-mocks"

const completeMock = mockMutation("payMapping.runs.completePayMappingRun")

const t = messages.dashboard.payMapping.review
const tFinish = t.finish
const tDoc = messages.dashboard.payMapping.documentation
const tTabs = messages.dashboard.payMapping.tabs
const tToast = messages.dashboard.toast
const tErrors = messages.errors

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

const GAP = {
  currency: "SEK",
  org: {
    womenCount: 6,
    menCount: 6,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated" as const,
  },
  equalWork: [equalWorkGroup()],
  equivalentWork: [],
  womenDominated: [],
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

const ANALYSES_PARTIAL: GroupAnalysis[] = [
  {
    scope: "praxis",
    groupKey: "payPolicy",
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  },
]

const ANALYSES_ALL_DONE: GroupAnalysis[] = [
  ...ANALYSES_PARTIAL,
  {
    scope: "praxis",
    groupKey: "collectiveAgreements",
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  },
  {
    scope: "praxis",
    groupKey: "benefits",
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  },
  {
    scope: "praxis",
    groupKey: "payPractices",
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  },
  {
    scope: "equalWork",
    groupKey: "k",
    reasons: ["experience"],
    note: null,
    done: true,
    finding: null,
  },
]

const RUN_ACTIVE: PayMappingRunDetail = {
  runId: "run-1" as PayMappingRunDetail["runId"],
  label: "Pay mapping 2026",
  status: "active",
  referenceDate: Date.UTC(2026, 6, 1),
  rows: [],
  collaboration: null,
}

const RUN_COMPLETED: PayMappingRunDetail = {
  ...RUN_ACTIVE,
  status: "completed",
}

const COLLABORATION_FILLED = {
  participants: "Union reps",
  description: "Monthly meeting",
}

function renderFinish(
  overrides: Partial<{
    analyses: GroupAnalysis[]
    collaboration: { participants: string; description: string } | null
    run: PayMappingRunDetail
    onPrevious: () => void
  }> = {}
) {
  const analyses = overrides.analyses ?? ANALYSES_PARTIAL
  const collaboration = overrides.collaboration ?? null
  const queue = buildReviewQueue({
    gap: GAP,
    analyses,
    collaboration,
    hasPreviousCompletedRun: false,
  })
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewFinish
        queue={queue}
        run={overrides.run ?? RUN_ACTIVE}
        onPrevious={overrides.onPrevious}
      />
    </NextIntlClientProvider>
  )
  return { queue }
}

afterEach(() => cleanup())

describe("ReviewFinish", () => {
  beforeEach(() => {
    completeMock.mockReset()
    completeMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("shows the all-reviewed affirmation", () => {
    renderFinish()
    expect(screen.getByText(tFinish.title)).toBeDefined()
  })

  it("shows the primary link to open the summary", () => {
    renderFinish()
    const link = screen.getByRole("link", { name: t.openSummary })
    expect(link.getAttribute("href")).toBe("/pay-mappings/pay-2026/analysis")
  })

  it("no longer renders the documentation listing: the summary owns it now", () => {
    renderFinish()
    expect(screen.queryByText(t.collaborationTitle)).toBeNull()
    expect(screen.queryByText(t.chapters.praxis)).toBeNull()
    expect(screen.queryByText(t.chapters.equalWork)).toBeNull()
    expect(screen.queryByText(t.chapters.equivalentWork)).toBeNull()
    expect(screen.queryByText(t.finishActionsNote)).toBeNull()
  })

  it("disables Complete with the remaining-count hint while the gate is unmet", () => {
    const { queue } = renderFinish()
    const button = screen.getByRole("button", {
      name: tDoc.complete,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    const remaining = queue.progress.overall.total - queue.progress.overall.done
    expect(remaining).toBeGreaterThan(0)
    expect(
      screen.getByText(
        remaining === 1
          ? "1 step remains before the pay mapping can be completed"
          : `${remaining} steps remain before the pay mapping can be completed`
      )
    ).toBeDefined()
  })

  it("enables Complete and fires the mutation + toast once the gate is met", async () => {
    const { queue } = renderFinish({
      collaboration: COLLABORATION_FILLED,
      analyses: ANALYSES_ALL_DONE,
    })
    expect(queue.progress.overall.done).toBe(queue.progress.overall.total)
    const button = screen.getByRole("button", {
      name: tDoc.complete,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)

    fireEvent.click(button)
    await vi.waitFor(() => {
      expect(completeMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: "run-1",
      })
    })
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingCompleted)
  })

  it("shows the statutory gate-unmet error distinctly from a generic failure", async () => {
    completeMock.mockRejectedValueOnce(
      new ConvexError({ code: "errors.payMappingGateUnmet" })
    )
    renderFinish({
      collaboration: COLLABORATION_FILLED,
      analyses: ANALYSES_ALL_DONE,
    })
    fireEvent.click(screen.getByRole("button", { name: tDoc.complete }))

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(tErrors.payMappingGateUnmet)
    })
  })

  it("shows the completed note and a link to the overview instead of the Complete action, alongside the summary link", () => {
    renderFinish({ run: RUN_COMPLETED, analyses: ANALYSES_ALL_DONE })
    expect(screen.getByText(tDoc.completedNote)).toBeDefined()
    expect(screen.queryByRole("button", { name: tDoc.complete })).toBeNull()

    const overviewLink = screen.getByRole("link", { name: tTabs.overview })
    expect(overviewLink.getAttribute("href")).toBe("/pay-mappings/pay-2026")
    expect(screen.getByRole("link", { name: t.openSummary })).toBeDefined()
  })

  it("shows the Previous action when a previous step exists", () => {
    const onPrevious = vi.fn()
    renderFinish({ onPrevious })
    fireEvent.click(screen.getByRole("button", { name: t.previous }))
    expect(onPrevious).toHaveBeenCalledTimes(1)
  })
})
