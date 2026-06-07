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
    anchors: [0, 1, 2, 3, 4, 5].map((level) => ({
      level,
      text: `Scope anchor ${level}`,
    })),
  },
  {
    criterionId: "c-risk",
    name: "Risk",
    description: "Consequence of mistakes.",
    helpText: "Judge against the anchors.",
    anchors: [0, 1, 2, 3, 4, 5].map((level) => ({
      level,
      text: `Risk anchor ${level}`,
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

  it("never renders score or band during the steps (blindness)", () => {
    renderStepper()
    expect(screen.queryByText(labels.result.scoreLabel)).toBeNull()
    expect(screen.queryByText(labels.result.bandLabel)).toBeNull()
  })
})
