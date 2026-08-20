import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: orgRole }),
}))

vi.mock("convex/react", () => ({
  useQuery: () => ({
    modelName: "Standard model",
    pointBudget: 27,
    criteria: [
      {
        criterionId: "c1",
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
  }),
  useMutation: () => vi.fn(),
}))

import { MethodPanel } from "@/components/model/method-panel"

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
    expect(screen.getAllByText(/of the total weight/).length).toBeGreaterThan(0)
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
})
