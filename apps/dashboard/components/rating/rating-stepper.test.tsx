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
const completeMock = vi.fn()

// Two mutations now, not one: the last step saves its rating AND completes the
// assessment, so the mock has to tell them apart or a test could not see which
// of the two a press reached.
vi.mock("convex/react", () => ({
  useMutation: (ref: string) =>
    ref === "assessment.completion.completeAssessment"
      ? completeMock
      : setRatingMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      ratings: { setRating: "assessment.ratings.setRating" },
      completion: {
        completeAssessment: "assessment.completion.completeAssessment",
      },
    },
  },
}))

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { RatingStepper } from "@/components/rating/rating-stepper"

const labels = messages.dashboard.rating

const CRITERIA = [
  {
    criterionId: "c-scope",
    name: "Scope",
    question: "How wide does this role's impact reach?",
    measures: "The role's reach across the organization.",
    notMeasures: "Formal people responsibility.",
    dimensionKey: "responsibility",
    anchors: [1, 2, 3, 4, 5].map((step) => ({
      step,
      text: `Scope anchor ${step}`,
    })),
  },
  {
    criterionId: "c-risk",
    name: "Risk",
    question: "What is the consequence of this role's mistakes?",
    measures: "Consequences of errors or shortcomings.",
    notMeasures: "The individual's stress level.",
    dimensionKey: "responsibility",
    anchors: [1, 2, 3, 4, 5].map((step) => ({
      step,
      text: `Risk anchor ${step}`,
    })),
  },
]

const WC_CRITERIA = [
  {
    criterionId: "c-oncall",
    name: "On-call",
    question: "How much standby duty does this role carry?",
    measures: "A recurring requirement to be available outside hours.",
    notMeasures: "Occasional overtime.",
    dimensionKey: "workingConditions",
    anchors: [1, 2, 3, 4, 5].map((step) => ({
      step,
      text: `On-call anchor ${step}`,
    })),
  },
]

function renderStepper(overrides?: {
  criteria?: typeof CRITERIA
  ratings?: { criterionId: string; value: number; motivation: string | null }[]
  onCompleted?: () => void
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RatingStepper
        orgId="org-1"
        roleId={"role-1" as never}
        criteria={(overrides?.criteria ?? CRITERIA) as never}
        ratings={overrides?.ratings ?? []}
      />
    </NextIntlClientProvider>
  )
}

describe("RatingStepper", () => {
  beforeEach(() => {
    setRatingMock.mockReset()
    setRatingMock.mockResolvedValue(null)
    completeMock.mockReset()
    completeMock.mockResolvedValue(null)
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

  it("renders the criterion's assessment question as the step description", () => {
    renderStepper()
    expect(
      screen.getByText("How wide does this role's impact reach?")
    ).toBeDefined()
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

  it("includes the motivation when given and completes on the last step", async () => {
    renderStepper({
      ratings: [{ criterionId: "c-scope", value: 2, motivation: null }],
    })
    fireEvent.click(screen.getByText("Risk anchor 4"))
    fireEvent.change(screen.getByLabelText(labels.motivationLabel), {
      target: { value: "Broad consequence" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.completeCta }))
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        criterionId: "c-risk",
        value: 4,
        motivation: "Broad consequence",
      })
    })
    // The ending is the same gesture, not a handoff to a screen that would
    // then have to ask for a second press.
    await waitFor(() => {
      expect(completeMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
  })

  it("never renders score or level during the steps (blindness)", () => {
    renderStepper()
    expect(screen.queryByText(labels.result.scoreLabel)).toBeNull()
    expect(screen.queryByText(labels.result.levelLabel)).toBeNull()
  })

  it("names the shared step on every graded option", () => {
    renderStepper()
    for (const step of [1, 2, 3, 4, 5] as const) {
      const name = labels.scale[`step${step}`].name
      const option = screen.getByText(`Scope anchor ${step}`).closest("button")
      expect(option?.textContent).toContain(name)
    }
  })

  it("leaves the not-covered option ungraded", () => {
    renderStepper({ criteria: WC_CRITERIA })
    const notCovered = screen
      .getByText(labels.notCoveredOption)
      .closest("button")
    for (const step of [1, 2, 3, 4, 5] as const) {
      expect(notCovered?.textContent).not.toContain(
        labels.scale[`step${step}`].name
      )
    }
  })

  it("makes every step's meaning reachable from the stepper", () => {
    renderStepper()
    for (const step of [1, 2, 3, 4, 5] as const) {
      expect(screen.queryByText(labels.scale[`step${step}`].meaning)).toBeNull()
    }
    fireEvent.click(
      screen.getByRole("button", { name: labels.scale.meaningsToggle })
    )
    for (const step of [1, 2, 3, 4, 5] as const) {
      expect(
        screen.getByText(labels.scale[`step${step}`].meaning)
      ).toBeDefined()
    }
  })

  it("explains the midpoints on steps 2 and 4 only", () => {
    renderStepper()
    fireEvent.click(
      screen.getByRole("button", { name: labels.scale.meaningsToggle })
    )
    const explained = screen
      .getAllByText(labels.scale.midpointExplanation)
      .map((node) => {
        const entry = node.closest("dd")
        return entry?.parentElement?.querySelector("dt")?.textContent
      })
    expect(explained).toEqual(["2", "4"])
  })

  it("keeps the weighting vocabulary out of the rating view (firewall)", () => {
    const { container } = renderStepper()
    fireEvent.click(
      screen.getByRole("button", { name: labels.scale.meaningsToggle })
    )
    const rendered = container.textContent ?? ""
    // The assessor grades requirements, never their consequences: the model's
    // weighting, its budget, the resulting weighting/level and the level's
    // zone all belong to the reveal after the assessment is completed.
    for (const term of [
      messages.model.weightPoints,
      messages.assessment.score,
      messages.assessment.level,
      messages.dashboard.model.methodAppendix.colWeight,
    ]) {
      expect(rendered).not.toContain(term)
    }
    expect(rendered).not.toMatch(/\b(weight|weighting|weighted|zone|band)\b/i)
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
  // The motivation-required law (1, 4, 5)
  // ---------------------------------------------------------------------------

  // Method 17.3.3: the motivation is required at 1, 4 or 5, and at no other
  // value. Declared once and walked across the whole graded domain, so both
  // widening and narrowing the set fail the rule's own test rather than
  // surfacing by accident in a test about something else.
  const MOTIVATION_REQUIRED_VALUES = [1, 4, 5]

  it("requires a motivation at exactly 1, 4 and 5, and nowhere else", async () => {
    for (const value of [1, 2, 3, 4, 5]) {
      cleanup()
      setRatingMock.mockClear()
      renderStepper()
      fireEvent.click(screen.getByText(`Scope anchor ${value}`))
      fireEvent.click(screen.getByRole("button", { name: labels.nextCta }))
      if (MOTIVATION_REQUIRED_VALUES.includes(value)) {
        expect(setRatingMock).not.toHaveBeenCalled()
        expect(screen.getByText(labels.motivationRequiredError)).toBeTruthy()
        // Still on the same step: the save never fired.
        expect(screen.getByText("Scope")).toBeDefined()
      } else {
        await waitFor(() => {
          expect(setRatingMock).toHaveBeenCalledWith({
            orgId: "org-1",
            roleId: "role-1",
            criterionId: "c-scope",
            value,
          })
        })
        expect(screen.queryByText(labels.motivationRequiredError)).toBeNull()
      }
    }
  })

  it("lets 1, 4 and 5 advance once a motivation is given", async () => {
    for (const value of MOTIVATION_REQUIRED_VALUES) {
      cleanup()
      setRatingMock.mockClear()
      renderStepper()
      fireEvent.click(screen.getByText(`Scope anchor ${value}`))
      fireEvent.change(screen.getByLabelText(labels.motivationLabel), {
        target: { value: "The role carries this to a marked degree." },
      })
      fireEvent.click(screen.getByRole("button", { name: labels.nextCta }))
      await waitFor(() => {
        expect(setRatingMock).toHaveBeenCalledWith({
          orgId: "org-1",
          roleId: "role-1",
          criterionId: "c-scope",
          value,
          motivation: "The role carries this to a marked degree.",
        })
      })
    }
  })

  it("clears the motivation-required message once a motivation is typed", () => {
    renderStepper()
    fireEvent.click(screen.getByText("Scope anchor 4"))
    fireEvent.click(screen.getByRole("button", { name: labels.nextCta }))
    expect(screen.getByText(labels.motivationRequiredError)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(labels.motivationLabel), {
      target: { value: "Advanced, cross-team reach." },
    })
    expect(screen.queryByText(labels.motivationRequiredError)).toBeNull()
  })

  it("clears the motivation-required message once a non-required value is picked", () => {
    renderStepper()
    fireEvent.click(screen.getByText("Scope anchor 1"))
    fireEvent.click(screen.getByRole("button", { name: labels.nextCta }))
    expect(screen.getByText(labels.motivationRequiredError)).toBeTruthy()
    fireEvent.click(screen.getByText("Scope anchor 3"))
    expect(screen.queryByText(labels.motivationRequiredError)).toBeNull()
  })

  it("does not carry a shown motivation-required message into the next step", async () => {
    renderStepper()
    fireEvent.click(screen.getByText("Scope anchor 5"))
    fireEvent.click(screen.getByRole("button", { name: labels.nextCta }))
    expect(screen.getByText(labels.motivationRequiredError)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(labels.motivationLabel), {
      target: { value: "Company-wide impact." },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.nextCta }))
    await waitFor(() => {
      expect(screen.getByText("Risk")).toBeDefined()
    })
    expect(screen.queryByText(labels.motivationRequiredError)).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // The measures/notMeasures collapsible context
  // ---------------------------------------------------------------------------

  it("keeps the measures/notMeasures context collapsed until toggled", () => {
    renderStepper()
    expect(
      screen.queryByText("The role's reach across the organization.")
    ).toBeNull()
    fireEvent.click(screen.getByText(labels.contextToggleLabel))
    expect(
      screen.getByText("The role's reach across the organization.")
    ).toBeDefined()
    expect(screen.getByText("Formal people responsibility.")).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // The working-conditions "omfattas inte" (0) option
  // ---------------------------------------------------------------------------

  it("offers the omfattas-inte (0) option only for a workingConditions criterion", () => {
    renderStepper({ criteria: WC_CRITERIA })
    expect(screen.getByText(labels.notCoveredOption)).toBeDefined()
    expect(screen.getByText(labels.notCoveredExplanation)).toBeDefined()
  })

  it("never offers the omfattas-inte (0) option for a non-workingConditions criterion", () => {
    renderStepper()
    expect(screen.queryByText(labels.notCoveredOption)).toBeNull()
  })

  it("saves a workingConditions 0 with no motivation required", async () => {
    renderStepper({ criteria: WC_CRITERIA })
    fireEvent.click(screen.getByText(labels.notCoveredOption))
    fireEvent.click(screen.getByRole("button", { name: labels.completeCta }))
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        criterionId: "c-oncall",
        value: 0,
      })
    })
    // 0 is not a sixth step, so the 1/4/5 motivation rule does not reach it:
    // "omfattas inte" is explained by the option's own standing explanation.
    expect(screen.queryByText(labels.motivationRequiredError)).toBeNull()
    expect(screen.getByText(labels.notCoveredExplanation)).toBeDefined()
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
