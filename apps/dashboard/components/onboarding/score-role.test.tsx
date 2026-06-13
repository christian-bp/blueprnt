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

const updateRoleMock = mockMutation("assessment.roles.updateRole")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

// The stepper and result and AI panel are reused unchanged; mock them as
// markers so this test asserts only the wrapper's phase machine. The AI panel
// mock exposes an onDone button so the open/close state can be exercised.
vi.mock("@/components/rating/rating-stepper", () => ({
  RatingStepper: (props: { onCompleted: () => void }) => (
    <div data-testid="stepper">
      <button type="button" onClick={() => props.onCompleted()}>
        stepper-done
      </button>
    </div>
  ),
}))
vi.mock("@/components/rating/rating-result", () => ({
  RatingResult: () => <div data-testid="result" />,
}))
vi.mock("@/components/roles/role-ai-panel", () => ({
  RoleAiPanel: (props: { onDone: () => void }) => (
    <div data-testid="ai-panel">
      <button type="button" onClick={() => props.onDone()}>
        ai-done
      </button>
    </div>
  ),
}))

import { ScoreRole } from "@/components/onboarding/score-role"

const t = messages.dashboard.onboarding.score
const tAi = messages.dashboard.ai

// getRole returns a role with empty profile, getModel returns the criteria.
function roleFixture(overrides: Record<string, unknown> = {}) {
  return {
    roleId: "role-1",
    title: "Developer",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    trackName: "Individual Contributor",
    purpose: "",
    responsibilities: "",
    status: "draft",
    archived: false,
    profileComplete: false,
    ratedCount: 0,
    totalCriteria: 5,
    familyId: null,
    familyName: null,
    anchorRole: null,
    ratings: [],
    ...overrides,
  }
}

function modelFixture() {
  return {
    modelId: "model-1",
    name: "Standard",
    templateKey: "standard",
    criteria: [
      {
        criterionId: "c1",
        name: "Knowledge",
        description: "",
        helpText: "",
        weightPoints: 3,
        order: 1,
        isCustom: false,
        anchors: [{ level: 0, text: "none" }],
      },
    ],
    tracks: [],
    bandThresholds: [],
  }
}

let currentRole: unknown
let currentModel: unknown

function renderRole(onDone: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ScoreRole orgId="org-1" roleId="role-1" onDone={onDone} />
    </NextIntlClientProvider>
  )
}

describe("ScoreRole", () => {
  beforeEach(() => {
    updateRoleMock.mockReset()
    useQueryMock.mockReset()
    currentRole = roleFixture()
    currentModel = modelFixture()
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.roles.getRole") return currentRole
      if (ref === "evaluationModel.model.getModel") return currentModel
      return undefined
    })
  })

  afterEach(() => cleanup())

  it("opens on profile capture when the profile is empty", () => {
    renderRole()
    expect(screen.getByLabelText(t.purposeLabel)).toBeDefined()
    expect(screen.getByLabelText(t.responsibilitiesLabel)).toBeDefined()
    expect(screen.queryByTestId("stepper")).toBeNull()
  })

  it("names the role in the capture heading", () => {
    renderRole()
    // captureHeading interpolates the role title instead of "this role".
    expect(screen.getByText("First, describe Developer")).toBeDefined()
  })

  it("offers a back-to-roles button on the capture phase that returns to the list", () => {
    const onDone = vi.fn()
    renderRole(onDone)
    // Still on capture (no stepper yet).
    expect(screen.queryByTestId("stepper")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: t.backToRolesCta }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("offers a back-to-roles button on the stepper phase that returns to the list", () => {
    currentRole = roleFixture({
      profileComplete: true,
      purpose: "p",
      responsibilities: "r",
    })
    const onDone = vi.fn()
    renderRole(onDone)
    expect(screen.getByTestId("stepper")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: t.backToRolesCta }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("hosts the AI panel in a provenance popover and keeps it open across a keystroke", async () => {
    renderRole()
    // The AI panel is collapsed behind the "AI draft" popover trigger.
    expect(screen.queryByTestId("ai-panel")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: tAi.openDraftCta }))
    expect(screen.getByTestId("ai-panel")).toBeDefined()
    // The provenance line is always visible while open (ADR-0003): nothing is
    // applied automatically.
    expect(screen.getByText(tAi.provenance)).toBeDefined()
    // Typing in the purpose field re-renders the parent; the popover stays
    // open because MorphPopover owns its own open state (Radix/Motion), not a
    // parent flag that a remount would reset.
    fireEvent.change(screen.getByLabelText(t.purposeLabel), {
      target: { value: "Builds the product." },
    })
    expect(screen.getByTestId("ai-panel")).toBeDefined()
    // Closing the panel via its onDone (the close() passed by MorphPopover)
    // morphs it back to the trigger.
    fireEvent.click(screen.getByRole("button", { name: "ai-done" }))
    await waitFor(() => {
      expect(screen.queryByTestId("ai-panel")).toBeNull()
    })
    expect(screen.getByRole("button", { name: tAi.openDraftCta })).toBeDefined()
  })

  it("saves the profile and advances to the blind stepper", async () => {
    updateRoleMock.mockResolvedValue(null)
    renderRole()
    fireEvent.change(screen.getByLabelText(t.purposeLabel), {
      target: { value: "Builds the product." },
    })
    fireEvent.change(screen.getByLabelText(t.responsibilitiesLabel), {
      target: { value: "Ships features." },
    })
    fireEvent.click(screen.getByRole("button", { name: t.captureContinueCta }))
    await waitFor(() => {
      expect(updateRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        purpose: "Builds the product.",
        responsibilities: "Ships features.",
      })
    })
    expect(await screen.findByTestId("stepper")).toBeDefined()
  })

  it("skips capture and opens the stepper when the profile is already complete", () => {
    currentRole = roleFixture({
      profileComplete: true,
      purpose: "p",
      responsibilities: "r",
    })
    renderRole()
    expect(screen.getByTestId("stepper")).toBeDefined()
    expect(screen.queryByLabelText(t.purposeLabel)).toBeNull()
  })

  it("refills the purpose textarea when an AI accept reactively patches the role", () => {
    // Start on the capture screen with an empty profile.
    const { rerender } = renderRole()
    const purposeField = screen.getByLabelText(
      t.purposeLabel
    ) as HTMLTextAreaElement
    expect(purposeField.value).toBe("")
    // An AI accept patches only purpose; getRole reactively returns the new
    // value. responsibilities stays empty so profileComplete is still false
    // and the capture screen stays.
    currentRole = roleFixture({ purpose: "Builds the product." })
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ScoreRole orgId="org-1" roleId="role-1" onDone={() => {}} />
      </NextIntlClientProvider>
    )
    // The textarea now reflects the accepted draft, still on the capture
    // screen (no stepper yet).
    expect(
      (screen.getByLabelText(t.purposeLabel) as HTMLTextAreaElement).value
    ).toBe("Builds the product.")
    expect(
      (screen.getByLabelText(t.responsibilitiesLabel) as HTMLTextAreaElement)
        .value
    ).toBe("")
    expect(screen.queryByTestId("stepper")).toBeNull()
  })

  it("reveals the result after the stepper completes, then returns to the list", async () => {
    currentRole = roleFixture({
      profileComplete: true,
      purpose: "p",
      responsibilities: "r",
    })
    const onDone = vi.fn()
    renderRole(onDone)
    fireEvent.click(screen.getByText("stepper-done"))
    expect(await screen.findByTestId("result")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: t.backToRolesCta }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
