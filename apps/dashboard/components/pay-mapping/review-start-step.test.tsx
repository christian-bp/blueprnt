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

vi.mock("@/lib/toast", () => ({
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
import { isoToMs } from "@/lib/iso-date"
import { toast } from "@/lib/toast"
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
    collaboration: {
      participants: string
      description: string
      // Omitted by the tests that predate the date and remarks fields: they
      // render a collaboration with no day and no remarks set.
      date?: number | null
      remarks?: string | null
    } | null
    locked: boolean
    continuationShown: boolean
    onNext: () => void
    onPrevious: () => void
    onSkip: () => void
  }> = {}
) {
  const onNext = overrides.onNext ?? vi.fn()
  const collaboration = overrides.collaboration ?? null
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewStartStep
        runId={RUN_ID}
        collaboration={
          collaboration === null
            ? null
            : {
                ...collaboration,
                date: collaboration.date ?? null,
                remarks: collaboration.remarks ?? null,
              }
        }
        locked={overrides.locked ?? false}
        continuationShown={overrides.continuationShown ?? false}
        onNext={onNext}
        onPrevious={overrides.onPrevious}
        onSkip={overrides.onSkip}
      />
    </NextIntlClientProvider>
  )
  return { onNext, container }
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

  it("renders the heading, the collaboration help trigger, and both labeled fields", () => {
    renderStep()
    expect(screen.getByText(t.introTitle)).toBeDefined()
    expect(
      screen.getByRole("button", { name: tHelp.collaborationLabel })
    ).toBeDefined()
    expect(screen.getByLabelText(t.collaborationParticipants)).toBeDefined()
    expect(screen.getByLabelText(t.collaborationDescription)).toBeDefined()
  })

  // The step used to open with three paragraphs on what a pay mapping is and
  // how its annual cycle runs, above the fields. Framing prose: the reader is
  // inside a run, in a chapter the sidebar names, and the step's own heading
  // and help say the same thing. What is left is the gate stated in words,
  // and once the gate is met, nothing at all.
  it("carries no standing prose beyond the gate hint", () => {
    const { container } = renderStep()
    expect(
      Array.from(container.querySelectorAll("p"), (node) => node.textContent)
    ).toEqual([t.collaborationHint])
  })

  it("carries no standing prose at all once the gate is met", () => {
    const { container } = renderStep({
      collaboration: { participants: "Union reps", description: "Monthly" },
    })
    expect(container.querySelectorAll("p").length).toBe(0)
  })

  // One control per destination: the section itself links on to the next
  // chapter once this one is finished, so the step drops its own primary
  // rather than putting two ways forward on one screen.
  it("drops Continue while the section is showing the chapter continuation", () => {
    renderStep({ continuationShown: true })
    expect(screen.queryByRole("button", { name: t.continue })).toBeNull()
  })

  it("keeps Continue while the section is not showing the continuation", () => {
    renderStep({ continuationShown: false })
    expect(screen.getByRole("button", { name: t.continue })).toBeDefined()
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

  // Both fields filled means the step is finished, and Continue would only
  // navigate: the chapter's own continuation below the card already offers
  // that, so a second button for the same destination comes off.
  it("drops Continue once both collaboration fields are filled", () => {
    renderStep({
      collaboration: { participants: "Union reps", description: "Monthly" },
    })
    expect(screen.queryByRole("button", { name: t.continue })).toBeNull()
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

  it("shows the recorded collaboration date and sends it with every save", async () => {
    renderStep({
      collaboration: {
        participants: "Union rep",
        description: "Monthly",
        date: Date.UTC(2026, 8, 15),
      },
    })
    const picker = screen.getByRole("button", { name: t.collaborationDate })
    expect(picker.textContent).toContain("Sep 15, 2026")

    const participants = screen.getByLabelText(t.collaborationParticipants)
    fireEvent.change(participants, { target: { value: "Union rep, HR" } })
    fireEvent.blur(participants)
    await waitFor(() => {
      expect(setCollaborationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        participants: "Union rep, HR",
        description: "Monthly",
        date: Date.UTC(2026, 8, 15),
      })
    })
  })

  it("saves a picked day at once instead of waiting for the text fields' debounce", async () => {
    renderStep({
      collaboration: {
        participants: "Union rep",
        description: "Monthly",
        date: Date.UTC(2026, 8, 15),
      },
    })
    fireEvent.click(screen.getByRole("button", { name: t.collaborationDate }))
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /year/i })).toBeDefined()
    })
    const day = screen
      .getAllByRole("button")
      .find((candidate) => candidate.textContent === "20")
    expect(day).toBeDefined()
    fireEvent.click(day as HTMLElement)
    await waitFor(() => {
      expect(setCollaborationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        participants: "Union rep",
        description: "Monthly",
        date: isoToMs("2026-09-20"),
      })
    })
  })

  it("clears the stored day when the picker is cleared", async () => {
    const clearLabel = messages.dashboard.datePicker.clear
    renderStep({
      collaboration: {
        participants: "Union rep",
        description: "Monthly",
        date: Date.UTC(2026, 8, 15),
      },
    })
    fireEvent.click(screen.getByRole("button", { name: t.collaborationDate }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: clearLabel })).toBeDefined()
    })
    fireEvent.click(screen.getByRole("button", { name: clearLabel }))
    await waitFor(() => {
      expect(setCollaborationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        participants: "Union rep",
        description: "Monthly",
      })
    })
  })

  it("omits the date when none is set and disables the picker on a locked run", () => {
    renderStep({
      collaboration: { participants: "A", description: "B", date: null },
      locked: true,
    })
    const picker = screen.getByRole("button", {
      name: t.collaborationDate,
    }) as HTMLButtonElement
    expect(picker.disabled).toBe(true)
    expect(picker.textContent).toContain(
      messages.dashboard.datePicker.placeholder
    )
  })

  it("hides Previous/Skip when their callbacks are undefined", () => {
    renderStep()
    expect(screen.queryByRole("button", { name: t.previous })).toBeNull()
    expect(screen.queryByRole("button", { name: t.skip })).toBeNull()
  })

  it("renders a plain heading with the content immediately interactive", () => {
    renderStep()
    const heading = screen.getByRole("heading", { name: t.introTitle })
    expect(heading.querySelector(".sr-only")).toBeNull()
    expect(screen.getByLabelText(t.collaborationParticipants)).toBeDefined()
  })
})
