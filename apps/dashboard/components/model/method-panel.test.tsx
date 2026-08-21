import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: orgRole }),
}))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { MethodPanel } from "@/components/model/method-panel"
import { onQuery } from "@/test/convex-mocks"

const METHOD_MODEL = {
  modelName: "Standard model",
  pointBudget: 27,
  criteria: [
    {
      criterionId: "c1",
      libraryKey: "knowledge-depth",
      name: "Scope",
      description: "",
      helpText: "",
      weightPoints: 3,
      share: 33,
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
    {
      criterionId: "c2",
      libraryKey: "knowledge-breadth",
      name: "Risk",
      description: "",
      helpText: "",
      weightPoints: 3,
      share: 33,
      order: 2,
      purpose: "p",
      whyRelevant: "w",
      overlapNotes: null,
      biasRisk: "low",
      biasComment: "b",
      biasAction: null,
      status: "approved",
      decidedByName: "Alex",
      decidedAt: 1,
    },
  ],
  levelRules: [],
  progress: { documented: 1, approved: 1, total: 2 },
}

// The engine's twelve checks, as the chapter reads them: only overlapPairs
// matters to this surface, so the rest stay green.
function methodChecks(pairs: string[][]) {
  return {
    checks: [
      {
        key: "overlapPairs",
        level: "warning",
        ok: pairs.length === 0,
        ...(pairs.length > 0 ? { pairs } : {}),
      },
    ],
    approval: null,
    lastApprovedAt: null,
    workingConditions: null,
    dimensionShares: [],
  }
}

let overlapPairs: string[][] = []

const weighting = messages.dashboard.model.weighting

function renderPanel(orgId = "org1") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MethodPanel orgId={orgId} />
    </NextIntlClientProvider>
  )
}

describe("MethodPanel", () => {
  beforeEach(() => {
    orgRole = "admin"
    overlapPairs = []
    onQuery((ref) => {
      if (ref === "evaluationModel.method.getMethodModel") return METHOD_MODEL
      if (ref === "evaluationModel.approval.getMethodChecks") {
        return methodChecks(overlapPairs)
      }
      return undefined
    })
  })
  afterEach(() => {
    cleanup()
  })

  it("lists criteria with their status and shows progress", () => {
    renderPanel()
    expect(screen.getByText("Scope")).toBeDefined()
    expect(screen.getByText("Risk")).toBeDefined()
    expect(screen.getByText(/1\/2 documented/)).toBeDefined()
    expect(screen.getByText("Approved")).toBeDefined()
    expect(screen.getByText("Not started")).toBeDefined()
    // Share line mirrors the Weighting page format
    // The phrase shortened when the Viktning card unified its two figures onto
    // one line: the full "of the total weight" lives in the budget block, and
    // repeating it on every row was the longer half of a line nobody reads
    // twice.
    expect(
      screen.getAllByText(new RegExp(weighting.shareOfTotal)).length
    ).toBeGreaterThan(0)
  })

  const m = messages.dashboard.model.method

  it("offers the documentation action on every criterion for an admin", () => {
    renderPanel()
    expect(screen.getAllByRole("button", { name: m.openCta })).toHaveLength(2)
  })

  // The method content READS for every member (its query is an orgQuery), but
  // documenting and approving a criterion are both adminMutations. An editor
  // reads the list, the statuses and the shares, and is offered neither.
  it("shows an editor the documentation without offering the writes", () => {
    orgRole = "editor"
    renderPanel()
    // The read surface is intact.
    expect(screen.getByText("Scope")).toBeDefined()
    expect(screen.getByText("Risk")).toBeDefined()
    expect(screen.getByText("Approved")).toBeDefined()
    expect(screen.getByText(/1\/2 documented/)).toBeDefined()
    // The only entry point to the write dialog is gone, and so is the dialog.
    expect(screen.queryByRole("button", { name: m.openCta })).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByText(m.dialogTitle)).toBeNull()
  })

  // The Godkännande checklist can only say that SOME pair is unreviewed; the
  // note that clears it is written behind an individual criterion's Document
  // button, so the flag belongs on the row that can answer it.
  describe("unreviewed overlaps", () => {
    const flag = (names: string) => m.overlapFlag.replace("{names}", names)

    it("marks both members of an unacknowledged pair, naming the partner", () => {
      overlapPairs = [["knowledge-depth", "knowledge-breadth"]]
      renderPanel()
      // Each row names the OTHER criterion, never itself.
      expect(screen.getByText(flag("Risk"))).toBeDefined()
      expect(screen.getByText(flag("Scope"))).toBeDefined()
    })

    it("raises no flag once the engine reports the pair acknowledged", () => {
      overlapPairs = []
      renderPanel()
      expect(screen.queryByText(flag("Risk"))).toBeNull()
      expect(screen.queryByText(flag("Scope"))).toBeNull()
      // The share readout is untouched by the flag being absent.
      expect(
        screen.getAllByText(new RegExp(weighting.shareOfTotal)).length
      ).toBeGreaterThan(0)
    })

    // A pair whose partner is not in the model cannot be named, so it is not
    // flagged either: the engine only reports pairs whose BOTH members are
    // selected, and a half-known pair would render "Overlap with  not noted".
    it("names no partner the model does not hold", () => {
      overlapPairs = [["knowledge-depth", "domain-knowledge"]]
      renderPanel()
      expect(screen.queryByText(/Overlap with/)).toBeNull()
    })
  })
})
