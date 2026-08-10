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

const setRatingMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: () => setRatingMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: { ratings: { setRating: "assessment.ratings.setRating" } },
  },
}))

import { RatingStepper } from "@/components/rating/rating-stepper"

const labels = messages.dashboard.rating

const CRITERIA = [
  {
    criterionId: "c-scope",
    name: "Scope",
    description: "How wide the role reaches.",
    helpText: "Judge against the anchors.",
    anchors: [0, 1, 2, 3, 4, 5].map((step) => ({
      step,
      text: `Scope anchor ${step}`,
    })),
  },
  {
    criterionId: "c-risk",
    name: "Risk",
    description: "Consequence of mistakes.",
    helpText: "Judge against the anchors.",
    anchors: [0, 1, 2, 3, 4, 5].map((step) => ({
      step,
      text: `Risk anchor ${step}`,
    })),
  },
]

function renderStepper(overrides?: {
  ratings?: { criterionId: string; value: number; motivation: string | null }[]
  onCompleted?: () => void
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RatingStepper
        orgId="org-1"
        roleId={"role-1" as never}
        criteria={CRITERIA as never}
        ratings={overrides?.ratings ?? []}
        onCompleted={overrides?.onCompleted ?? vi.fn()}
      />
    </NextIntlClientProvider>
  )
}

describe("RatingStepper", () => {
  beforeEach(() => {
    setRatingMock.mockReset()
    setRatingMock.mockResolvedValue(null)
  })
  afterEach(() => {
    cleanup()
  })

  it("starts at the first unrated criterion (resume)", () => {
    renderStepper({
      ratings: [{ criterionId: "c-scope", value: 2, motivation: null }],
    })
    expect(screen.getByText("Risk")).toBeDefined()
  })

  it("requires a selection before advancing and persists on next", async () => {
    renderStepper()
    const next = screen.getByRole("button", { name: labels.nextCta })
    expect(next.hasAttribute("disabled")).toBe(true)
    fireEvent.click(screen.getByText("Scope anchor 3"))
    fireEvent.click(screen.getByRole("button", { name: labels.nextCta }))
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        criterionId: "c-scope",
        value: 3,
      })
    })
    await waitFor(() => {
      expect(screen.getByText("Risk")).toBeDefined()
    })
  })

  it("includes the motivation when given and finishes on the last step", async () => {
    const onCompleted = vi.fn()
    renderStepper({
      ratings: [{ criterionId: "c-scope", value: 2, motivation: null }],
      onCompleted,
    })
    fireEvent.click(screen.getByText("Risk anchor 4"))
    fireEvent.change(screen.getByLabelText(labels.motivationLabel), {
      target: { value: "Broad consequence" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.finishCta }))
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        criterionId: "c-risk",
        value: 4,
        motivation: "Broad consequence",
      })
    })
    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalled()
    })
  })

  it("never renders score or level during the steps (blindness)", () => {
    renderStepper()
    expect(screen.queryByText(labels.result.scoreLabel)).toBeNull()
    expect(screen.queryByText(labels.result.levelLabel)).toBeNull()
  })

  it("selects an anchor by its number key and advances on Enter", async () => {
    renderStepper()
    fireEvent.keyDown(document.body, { key: "3" })
    expect(
      screen
        .getByText("Scope anchor 3")
        .closest("button")
        ?.getAttribute("aria-checked")
    ).toBe("true")
    fireEvent.keyDown(document.body, { key: "Enter" })
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        criterionId: "c-scope",
        value: 3,
      })
    })
    await waitFor(() => {
      expect(screen.getByText("Risk")).toBeDefined()
    })
  })

  it("does not hijack number keys typed in the motivation field", () => {
    renderStepper()
    fireEvent.keyDown(screen.getByLabelText(labels.motivationLabel), {
      key: "3",
    })
    expect(
      screen
        .getByText("Scope anchor 3")
        .closest("button")
        ?.getAttribute("aria-checked")
    ).toBe("false")
    expect(
      screen
        .getByRole("button", { name: labels.nextCta })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("ignores Enter until an anchor is selected", () => {
    renderStepper()
    fireEvent.keyDown(document.body, { key: "Enter" })
    expect(setRatingMock).not.toHaveBeenCalled()
    expect(screen.getByText("Scope")).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // The step is frozen while its save is in flight
  //
  // handleNext reads the step and motivation ONCE and then awaits, so a change
  // landing mid-save never reaches the server. Left unguarded it also survived
  // into local state, so the stepper showed a value the role was never rated
  // with. These hold the mutation open to assert the freeze.
  // ---------------------------------------------------------------------------

  function holdSave() {
    let release: () => void = () => {}
    setRatingMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          release = () => resolve(null)
        })
    )
    return () => release()
  }

  function anchor(name: string) {
    return screen.getByText(name).closest("button") as HTMLButtonElement
  }

  it("ignores a number key pressed while the step is saving", async () => {
    const release = holdSave()
    renderStepper()
    fireEvent.keyDown(document.body, { key: "3" })
    fireEvent.keyDown(document.body, { key: "Enter" })
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledTimes(1)
    })

    // Mid-save: the digit must not move the selection.
    fireEvent.keyDown(document.body, { key: "4" })
    expect(anchor("Scope anchor 3").getAttribute("aria-checked")).toBe("true")
    expect(anchor("Scope anchor 4").getAttribute("aria-checked")).toBe("false")

    release()
    await waitFor(() => {
      expect(screen.getByText("Risk")).toBeDefined()
    })
    // Only the submitted value was ever written.
    expect(setRatingMock).toHaveBeenCalledTimes(1)
    expect(setRatingMock).toHaveBeenCalledWith(
      expect.objectContaining({ criterionId: "c-scope", value: 3 })
    )
  })

  it("leaves the completed step showing the value that was saved", async () => {
    const release = holdSave()
    renderStepper()
    fireEvent.keyDown(document.body, { key: "3" })
    fireEvent.keyDown(document.body, { key: "Enter" })
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledTimes(1)
    })
    fireEvent.keyDown(document.body, { key: "4" })
    release()
    await waitFor(() => {
      expect(screen.getByText("Risk")).toBeDefined()
    })

    // Back to the saved step: it must agree with the server. Unguarded, the
    // late "4" stuck here while the role was rated 3.
    fireEvent.click(screen.getByRole("button", { name: labels.backCta }))
    await waitFor(() => {
      expect(screen.getByText("Scope")).toBeDefined()
    })
    expect(anchor("Scope anchor 3").getAttribute("aria-checked")).toBe("true")
    expect(anchor("Scope anchor 4").getAttribute("aria-checked")).toBe("false")
  })

  it("ignores an anchor click while the step is saving", async () => {
    const release = holdSave()
    renderStepper()
    fireEvent.click(anchor("Scope anchor 3"))
    fireEvent.click(screen.getByRole("button", { name: labels.nextCta }))
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledTimes(1)
    })

    // The anchors are disabled mid-save, so the click cannot land.
    expect(anchor("Scope anchor 4").hasAttribute("disabled")).toBe(true)
    fireEvent.click(anchor("Scope anchor 4"))
    expect(anchor("Scope anchor 3").getAttribute("aria-checked")).toBe("true")
    expect(anchor("Scope anchor 4").getAttribute("aria-checked")).toBe("false")

    release()
    await waitFor(() => {
      expect(screen.getByText("Risk")).toBeDefined()
    })
    expect(setRatingMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: 3 })
    )
  })

  it("holds the motivation read-only while the step is saving", async () => {
    const release = holdSave()
    renderStepper()
    const motivation = screen.getByLabelText(labels.motivationLabel)
    fireEvent.change(motivation, { target: { value: "Wide remit" } })
    fireEvent.keyDown(document.body, { key: "3" })
    fireEvent.keyDown(document.body, { key: "Enter" })
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledTimes(1)
    })

    // The motivation was read before the await, so it is held until the write
    // lands rather than accepting text that would be dropped.
    expect(motivation.hasAttribute("readonly")).toBe(true)
    expect(setRatingMock).toHaveBeenCalledWith(
      expect.objectContaining({ motivation: "Wide remit" })
    )

    release()
    await waitFor(() => {
      expect(screen.getByText("Risk")).toBeDefined()
    })
    // Editable again on the next step.
    expect(
      screen.getByLabelText(labels.motivationLabel).hasAttribute("readonly")
    ).toBe(false)
  })

  it("submits once when Enter is pressed twice quickly", async () => {
    const release = holdSave()
    renderStepper()
    fireEvent.keyDown(document.body, { key: "3" })
    fireEvent.keyDown(document.body, { key: "Enter" })
    fireEvent.keyDown(document.body, { key: "Enter" })
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledTimes(1)
    })
    release()
    await waitFor(() => {
      expect(screen.getByText("Risk")).toBeDefined()
    })
    expect(setRatingMock).toHaveBeenCalledTimes(1)
  })
})
