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
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/model/criteria",
}))

let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: orgRole }),
}))

import { ModelSectionShell } from "@/components/model/model-section-shell"
import { onQuery } from "@/test/convex-mocks"

const m = messages.dashboard.model.chapters

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
  { key: "peopleLeadershipWeight", level: "warning", ok: true },
  { key: "overlapPairs", level: "warning", ok: true },
]

let checksResult: unknown = {
  checks: CHECKS,
  approval: null,
  workingConditions: { status: "testedNotMaterial", motivation: "x" },
}

function renderShell() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelSectionShell>
        <p>chapter body</p>
      </ModelSectionShell>
    </NextIntlClientProvider>
  )
}

describe("ModelSectionShell", () => {
  beforeEach(() => {
    orgRole = "admin"
    checksResult = {
      checks: CHECKS,
      approval: null,
      workingConditions: { status: "testedNotMaterial", motivation: "x" },
    }
    onQuery((ref) =>
      ref === "evaluationModel.approval.getMethodChecks"
        ? checksResult
        : undefined
    )
  })
  afterEach(() => cleanup())

  it("mounts the spine and the chapter row above the chapter's own body", () => {
    renderShell()
    expect(screen.getByRole("heading", { name: /Decided/ })).toBeDefined()
    expect(screen.getByRole("navigation", { name: m.nav })).toBeDefined()
    expect(screen.getByText("chapter body")).toBeDefined()
  })

  // The shell reads getMethodChecks from the LAYOUT, so an admin-gated query
  // there throws in render and takes all four chapters down for an editor.
  // The read is open to every member; the writes behind it are not.
  it("renders for an editor member, not just an admin", () => {
    orgRole = "editor"
    renderShell()
    expect(screen.getByRole("navigation", { name: m.nav })).toBeDefined()
    expect(screen.getByText("chapter body")).toBeDefined()
    // The first chapter is where /model lands, and its tab is reachable.
    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href"))
    ).toContain("/model/criteria")
  })

  // An org with no model yet still has the same four chapters ahead of it, so
  // the bar reads empty rather than the section refusing to render.
  it("draws an empty bar when the org has no model yet", () => {
    checksResult = null
    renderShell()
    const bar = screen.getByRole("progressbar", { name: m.progressBarLabel })
    expect(bar.getAttribute("aria-valuenow")).toBe("0")
    expect(screen.getByText("chapter body")).toBeDefined()
  })

  // Content-shaped: the spine's real heading over a flat track and the
  // reserved count line, so nothing reflows when the query resolves.
  it("shows the spine's own skeleton while the checks load", () => {
    checksResult = undefined
    const { container } = renderShell()
    expect(screen.getByRole("heading", { name: m.progressLabel })).toBeDefined()
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(container.querySelector(".bg-primary\\/12")).not.toBeNull()
    // The chapter row and the chapter's body are never held back by the bar.
    expect(screen.getByRole("navigation", { name: m.nav })).toBeDefined()
    expect(screen.getByText("chapter body")).toBeDefined()
  })
})
