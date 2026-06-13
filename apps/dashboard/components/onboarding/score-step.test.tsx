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

const completeOnboardingMock = mockMutation(
  "accounts.organization.completeOnboarding"
)
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

// The per-role wrapper is mocked as a marker; the step's own tests cover the
// fork, the list, and completion.
vi.mock("@/components/onboarding/score-role", () => ({
  ScoreRole: (props: { roleId: string; onDone: () => void }) => (
    <div data-testid="score-role">
      <span data-testid="score-role-id">{props.roleId}</span>
      <button type="button" onClick={() => props.onDone()}>
        role-done
      </button>
    </div>
  ),
}))

import { ScoreStep } from "@/components/onboarding/score-step"

const t = messages.dashboard.onboarding.score

// getResults rows: each row has complete + ratedCount + a non-empty title.
function resultsFixture(rows: Array<Record<string, unknown>>) {
  return {
    rows: rows.map((row) => ({
      roleId: "role-x",
      title: "Role",
      trackKey: "IC",
      trackName: "IC",
      status: "draft",
      complete: false,
      ratedCount: 0,
      totalCriteria: 5,
      score: null,
      band: null,
      familyId: null,
      familyName: null,
      ...row,
    })),
    bands: [],
  }
}

let currentResults: unknown

function renderStep(onFinish: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ScoreStep orgId="org-1" onFinish={onFinish} />
    </NextIntlClientProvider>
  )
}

describe("ScoreStep", () => {
  beforeEach(() => {
    completeOnboardingMock.mockReset()
    useQueryMock.mockReset()
    completeOnboardingMock.mockResolvedValue(null)
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.results.getResults") return currentResults
      return undefined
    })
  })

  afterEach(() => cleanup())

  it("shows the fork when no role has been started", () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 0, complete: false },
      { roleId: "role-2", title: "B", ratedCount: 0, complete: false },
    ])
    renderStep()
    expect(screen.getByText(t.forkHeading)).toBeDefined()
    // OptionCard folds the description into the button's accessible name, so
    // an exact-name lookup no longer matches; use a regex on the title (the
    // approach model-setup-step.test.tsx uses for its choice cards).
    expect(
      screen.getByRole("button", { name: new RegExp(t.scoreNowCta) })
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: new RegExp(t.laterCta) })
    ).toBeDefined()
    // The fork's explanatory text replaces the lone help popover.
    expect(
      screen.getByText(messages.dashboard.help.onboardingScoreBody)
    ).toBeDefined()
  })

  it("'I'll do this later' completes onboarding and finishes", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 0, complete: false },
    ])
    const onFinish = vi.fn()
    renderStep(onFinish)
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(t.laterCta) })
    )
    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledWith({ orgId: "org-1" })
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it("'Score now' opens the scoring list with the save-and-exit affordance", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 0, complete: false },
    ])
    renderStep()
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(t.scoreNowCta) })
    )
    // mode="wait" holds the fork phase mounted until its exit crossfade ends,
    // then mounts the list phase; await the swap like the wizard tests do.
    expect(await screen.findByText(t.saveExitLine)).toBeDefined()
    expect(screen.getByRole("button", { name: t.saveExitCta })).toBeDefined()
  })

  it("skips the fork when a role is already started (ratedCount > 0)", () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 2, complete: false },
    ])
    renderStep()
    // No fork: it lands straight on the scoring list.
    expect(screen.queryByText(t.forkHeading)).toBeNull()
    expect(screen.getByText(t.saveExitLine)).toBeDefined()
  })

  it("'Save and exit' completes onboarding and finishes", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 2, complete: false },
    ])
    const onFinish = vi.fn()
    renderStep(onFinish)
    fireEvent.click(screen.getByRole("button", { name: t.saveExitCta }))
    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledWith({ orgId: "org-1" })
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it("shows the done state and completes when every role is complete", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 5, complete: true },
      { roleId: "role-2", title: "B", ratedCount: 5, complete: true },
    ])
    const onFinish = vi.fn()
    renderStep(onFinish)
    expect(screen.getByText(t.doneHeading)).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: t.doneCta }))
    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledWith({ orgId: "org-1" })
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it("opens a role from the list and returns after the role is done", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 1, complete: false },
    ])
    renderStep()
    fireEvent.click(screen.getByRole("button", { name: t.resumeRoleCta }))
    // The per-role view mounts after the list phase crossfades out.
    expect((await screen.findByTestId("score-role-id")).textContent).toBe(
      "role-1"
    )
    fireEvent.click(screen.getByText("role-done"))
    await waitFor(() => {
      expect(screen.queryByTestId("score-role")).toBeNull()
    })
    expect(await screen.findByText(t.saveExitLine)).toBeDefined()
  })
})
