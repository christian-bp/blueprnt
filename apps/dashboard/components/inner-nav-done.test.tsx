import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { InnerNavDone } from "@/components/inner-nav-done"
import type { InnerNavDoneId } from "@/lib/navigation"
import { onQuery } from "@/test/convex-mocks"

const doneLabel = messages.dashboard.nav.chapterDoneLabel

// The same all-ok fixture the model section shell's own tests run on, so the
// mark derives from the derivation the spine reads, not a parallel one.
const CHECKS = [
  { key: "dimensionCoverage", level: "blocker", ok: true },
  { key: "workingConditionsTested", level: "blocker", ok: true },
  { key: "criterionCount", level: "blocker", ok: true, count: 6 },
  { key: "dimensionCaps", level: "blocker", ok: true },
  { key: "anchorsComplete", level: "blocker", ok: true },
  { key: "documentationComplete", level: "blocker", ok: true },
  { key: "weightBudget", level: "blocker", ok: true, count: 6 },
  { key: "levelRulesValid", level: "blocker", ok: true },
  { key: "zoneProfileMonotonic", level: "blocker", ok: true },
  { key: "dimensionWeightBalance", level: "warning", ok: true },
  { key: "peopleLeadershipWeight", level: "warning", ok: true, applies: false },
  { key: "overlapPairs", level: "warning", ok: true },
]

let checksResult: unknown

function renderDone(id: InnerNavDoneId) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InnerNavDone id={id} />
    </NextIntlClientProvider>
  )
}

describe("InnerNavDone", () => {
  beforeEach(() => {
    checksResult = {
      checks: CHECKS,
      approval: null,
      weightsSaved: true,
      workingConditions: { status: "testedNotMaterial", motivation: "x" },
    }
    onQuery((ref) =>
      ref === "evaluationModel.approval.getMethodChecks"
        ? checksResult
        : undefined
    )
  })
  afterEach(() => cleanup())

  it("ticks a finished chapter and stays silent on an unfinished one", () => {
    // The fixture finishes criteria/weighting/method and leaves the approval
    // outstanding, so three ids tick and the fourth renders nothing.
    for (const id of [
      "modelCriteria",
      "modelWeighting",
      "modelMethod",
    ] as const) {
      renderDone(id)
      expect(screen.getByText(doneLabel)).toBeDefined()
      cleanup()
    }
    renderDone("modelApproval")
    expect(screen.queryByText(doneLabel)).toBeNull()
  })

  it("renders nothing at all while the checks load", () => {
    checksResult = undefined
    const { container } = renderDone("modelCriteria")
    expect(container.innerHTML).toBe("")
  })

  it("tracks the same derivation the spine reads", () => {
    // Break the criterion count: the criteria chapter reopens, so its tick
    // must come off while weighting's stays.
    checksResult = {
      checks: CHECKS.map((check) =>
        check.key === "criterionCount"
          ? { ...check, ok: false, count: 4 }
          : check
      ),
      approval: null,
      weightsSaved: true,
      workingConditions: { status: "testedNotMaterial", motivation: "x" },
    }
    renderDone("modelCriteria")
    expect(screen.queryByText(doneLabel)).toBeNull()
    cleanup()
    renderDone("modelWeighting")
    expect(screen.getByText(doneLabel)).toBeDefined()
  })
})
