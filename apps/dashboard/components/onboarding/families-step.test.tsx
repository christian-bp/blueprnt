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

const createStarterSetMock = vi.fn()
const completeOnboardingMock = vi.fn()
const useQueryMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "assessment.starters.createStarterSet")
      return createStarterSetMock
    if (ref === "accounts.organization.completeOnboarding")
      return completeOnboardingMock
    return vi.fn()
  },
  // The mock dispatches on the api ref (see beforeEach): getIndustryStarter
  // returns the seed fixture, getModel returns the tracks/levels fixture.
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: {
        completeOnboarding: "accounts.organization.completeOnboarding",
      },
    },
    assessment: {
      starters: {
        getIndustryStarter: "assessment.starters.getIndustryStarter",
        createStarterSet: "assessment.starters.createStarterSet",
      },
    },
    evaluationModel: {
      model: { getModel: "evaluationModel.model.getModel" },
    },
  },
}))

import { FamiliesStep } from "@/components/onboarding/families-step"

const t = messages.dashboard.onboarding.families

// A two-family starter; the second family is removable in its own test.
function starterFixture() {
  return {
    families: [
      {
        name: "Engineering",
        roles: [
          { title: "Developer", trackKey: "IC", levelKey: "IC1" },
          { title: "Tech Lead", trackKey: "Lead", levelKey: "Lead2" },
        ],
      },
      {
        name: "Sales",
        roles: [
          { title: "Account Executive", trackKey: "IC", levelKey: "IC2" },
        ],
      },
    ],
  }
}

// Tracks/levels fixture; only the keys/names the Select needs to render.
function modelFixture() {
  return {
    modelId: "model-1",
    name: "Standard",
    templateKey: "standard",
    criteria: [],
    tracks: [
      {
        trackId: "t-ic",
        key: "IC",
        name: "Individual Contributor",
        order: 1,
        levels: [
          { levelId: "l-ic1", key: "IC1", name: "Level 1", order: 1 },
          { levelId: "l-ic2", key: "IC2", name: "Level 2", order: 2 },
        ],
      },
      {
        trackId: "t-lead",
        key: "Lead",
        name: "Lead",
        order: 2,
        levels: [
          { levelId: "l-lead2", key: "Lead2", name: "Level 2", order: 1 },
        ],
      },
    ],
    bandThresholds: [],
  }
}

let currentStarter: unknown
let currentModel: unknown

function renderStep(onFinished: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamiliesStep orgId="org-1" onFinished={onFinished} />
    </NextIntlClientProvider>
  )
}

describe("FamiliesStep", () => {
  beforeEach(() => {
    createStarterSetMock.mockReset()
    completeOnboardingMock.mockReset()
    useQueryMock.mockReset()
    currentStarter = starterFixture()
    currentModel = modelFixture()
    useQueryMock.mockImplementation((ref: unknown) =>
      ref === "assessment.starters.getIndustryStarter"
        ? currentStarter
        : currentModel
    )
  })

  afterEach(() => {
    cleanup()
  })

  it("seeds the editable list from the industry starter", () => {
    renderStep()
    const nameInputs = screen.getAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    ) as HTMLInputElement[]
    expect(nameInputs.map((input) => input.value)).toEqual([
      "Engineering",
      "Sales",
    ])
  })

  it("creates and sends the cleaned payload, then completes, then finishes", async () => {
    createStarterSetMock.mockResolvedValue(null)
    completeOnboardingMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)

    fireEvent.click(screen.getByRole("button", { name: t.createCta }))

    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledTimes(1)
    })
    expect(createStarterSetMock).toHaveBeenCalledTimes(1)
    expect(createStarterSetMock).toHaveBeenCalledWith({
      orgId: "org-1",
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC", levelKey: "IC1" },
            { title: "Tech Lead", trackKey: "Lead", levelKey: "Lead2" },
          ],
        },
        {
          name: "Sales",
          roles: [
            { title: "Account Executive", trackKey: "IC", levelKey: "IC2" },
          ],
        },
      ],
    })
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("excludes a removed family from the createStarterSet payload", async () => {
    createStarterSetMock.mockResolvedValue(null)
    completeOnboardingMock.mockResolvedValue(null)
    renderStep()

    // Remove the Sales family, then create.
    fireEvent.click(
      screen.getByRole("button", {
        name: t.removeFamilyLabel.replace("{name}", "Sales"),
      })
    )
    fireEvent.click(screen.getByRole("button", { name: t.createCta }))

    await waitFor(() => {
      expect(createStarterSetMock).toHaveBeenCalledTimes(1)
    })
    const payload = createStarterSetMock.mock.calls[0]?.[0] as {
      families: { name: string }[]
    }
    expect(payload.families.map((family) => family.name)).toEqual([
      "Engineering",
    ])
  })

  it("skip completes onboarding without creating a starter set", async () => {
    completeOnboardingMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)

    fireEvent.click(screen.getByRole("button", { name: t.skipCta }))

    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledTimes(1)
    })
    expect(createStarterSetMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("shows the translated duplicate alert and stays when create is rejected", async () => {
    createStarterSetMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    const onFinished = vi.fn()
    renderStep(onFinished)

    fireEvent.click(screen.getByRole("button", { name: t.createCta }))

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        messages.errors.roleFamilyExists
      )
    })
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(onFinished).not.toHaveBeenCalled()
  })
})
