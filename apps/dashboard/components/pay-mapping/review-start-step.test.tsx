import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { ConvexError } from "convex/values"
import { toast } from "sonner"
import { ReviewStartStep } from "@/components/pay-mapping/review-start-step"
import { mockMutation } from "@/test/convex-mocks"

const setCollaborationMock = mockMutation(
  "payMapping.runs.setPayMappingCollaboration"
)

const t = messages.dashboard.payMapping.review
const tHelp = messages.dashboard.help
const tForm = messages.dashboard.payMapping.analysisForm
const tErrors = messages.errors

const RUN_ID = "run-1" as Id<"payMappingRuns">

function renderStep(
  overrides: Partial<{
    collaboration: { participants: string; description: string } | null
    locked: boolean
    animated: boolean
    onNext: () => void
    onPrevious: () => void
    onSkip: () => void
  }> = {}
) {
  const onNext = overrides.onNext ?? vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewStartStep
        runId={RUN_ID}
        collaboration={overrides.collaboration ?? null}
        locked={overrides.locked ?? false}
        animated={overrides.animated ?? true}
        onNext={onNext}
        onPrevious={overrides.onPrevious}
        onSkip={overrides.onSkip}
      />
    </NextIntlClientProvider>
  )
  return { onNext }
}

describe("ReviewStartStep", () => {
  beforeEach(() => {
    setCollaborationMock.mockReset()
    setCollaborationMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the intro copy, the collaboration help trigger, and both labeled fields", () => {
    renderStep()
    expect(screen.getByText(t.introTitle)).toBeDefined()
    expect(screen.getByText(t.introBody)).toBeDefined()
    expect(screen.getByText(t.cycleBody)).toBeDefined()
    expect(screen.getByText(t.autosaveHint)).toBeDefined()
    expect(
      screen.getByRole("button", { name: tHelp.collaborationLabel })
    ).toBeDefined()
    expect(screen.getByLabelText(t.collaborationParticipants)).toBeDefined()
    expect(screen.getByLabelText(t.collaborationDescription)).toBeDefined()
  })

  it("seeds the fields from the collaboration prop", () => {
    renderStep({
      collaboration: {
        participants: "Union reps",
        description: "Monthly meeting",
      },
    })
    expect(
      (
        screen.getByLabelText(
          t.collaborationParticipants
        ) as HTMLTextAreaElement
      ).value
    ).toBe("Union reps")
    expect(
      (screen.getByLabelText(t.collaborationDescription) as HTMLTextAreaElement)
        .value
    ).toBe("Monthly meeting")
  })

  it("fires setPayMappingCollaboration with the exact payload on blur, carrying the other field's current value", async () => {
    renderStep({ collaboration: { participants: "", description: "Existing" } })
    const participants = screen.getByLabelText(t.collaborationParticipants)

    fireEvent.change(participants, { target: { value: "Union reps" } })
    fireEvent.blur(participants)

    await waitFor(() => {
      expect(setCollaborationMock).toHaveBeenCalledTimes(1)
    })
    expect(setCollaborationMock).toHaveBeenCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      participants: "Union reps",
      description: "Existing",
    })
  })

  it("debounces the autosave 800ms after typing without a blur", async () => {
    vi.useFakeTimers()
    renderStep()
    const description = screen.getByLabelText(t.collaborationDescription)

    fireEvent.change(description, { target: { value: "Quarterly meeting" } })
    expect(setCollaborationMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(800)
    await vi.waitFor(() => {
      expect(setCollaborationMock).toHaveBeenCalledTimes(1)
    })
    vi.useRealTimers()
  })

  it("skips the no-op mutation when a blur fires with nothing changed", async () => {
    renderStep({
      collaboration: { participants: "Union reps", description: "Existing" },
    })
    const participants = screen.getByLabelText(t.collaborationParticipants)

    fireEvent.focus(participants)
    fireEvent.blur(participants)

    expect(setCollaborationMock).not.toHaveBeenCalled()
  })

  it("shows the collaboration hint while either field is empty, and hides it once both are filled", () => {
    renderStep({ collaboration: { participants: "", description: "" } })
    expect(screen.getByText(t.collaborationHint)).toBeDefined()
    cleanup()

    renderStep({
      collaboration: { participants: "Union reps", description: "Existing" },
    })
    expect(screen.queryByText(t.collaborationHint)).toBeNull()
  })

  it("never disables the primary Continue action, even while the hint is showing", () => {
    const { onNext } = renderStep({
      collaboration: { participants: "", description: "" },
    })
    const continueButton = screen.getByRole("button", {
      name: t.continue,
    }) as HTMLButtonElement
    expect(continueButton.disabled).toBe(false)

    fireEvent.click(continueButton)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("toasts an error and does not throw when the save rejects", async () => {
    setCollaborationMock.mockRejectedValue(new Error("network error"))
    renderStep()
    const participants = screen.getByLabelText(t.collaborationParticipants)

    fireEvent.change(participants, { target: { value: "Union reps" } })
    fireEvent.blur(participants)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(messages.dashboard.toast.error)
    })
  })

  it("shows the run-completed message distinctly from a generic failure when the save is rejected with that code", async () => {
    setCollaborationMock.mockRejectedValue(
      new ConvexError({ code: "errors.payMappingRunCompleted" })
    )
    renderStep()
    const participants = screen.getByLabelText(t.collaborationParticipants)

    fireEvent.change(participants, { target: { value: "Union reps" } })
    fireEvent.blur(participants)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(tErrors.payMappingRunCompleted)
    })
  })

  it("disables both textareas and shows the locked hint when locked", () => {
    renderStep({
      locked: true,
      collaboration: { participants: "Union reps", description: "Existing" },
    })
    expect(screen.getByText(tForm.lockedHint)).toBeDefined()
    expect(
      (
        screen.getByLabelText(
          t.collaborationParticipants
        ) as HTMLTextAreaElement
      ).disabled
    ).toBe(true)
    expect(
      (screen.getByLabelText(t.collaborationDescription) as HTMLTextAreaElement)
        .disabled
    ).toBe(true)

    fireEvent.change(screen.getByLabelText(t.collaborationParticipants), {
      target: { value: "Changed" },
    })
    fireEvent.blur(screen.getByLabelText(t.collaborationParticipants))
    expect(setCollaborationMock).not.toHaveBeenCalled()
  })

  it("hides Previous/Skip when their callbacks are undefined", () => {
    renderStep()
    expect(screen.queryByRole("button", { name: t.previous })).toBeNull()
    expect(screen.queryByRole("button", { name: t.skip })).toBeNull()
  })

  it("renders a plain heading with the content immediately interactive when animated is false (the summary pane)", () => {
    renderStep({ animated: false })
    const heading = screen.getByRole("heading", { name: t.introTitle })
    expect(heading.querySelector(".sr-only")).toBeNull()
    expect(screen.getByLabelText(t.collaborationParticipants)).toBeDefined()
  })
})
