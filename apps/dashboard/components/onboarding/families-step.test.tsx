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

const createStarterSetMock = mockMutation(
  "assessment.starters.createStarterSet"
)
const completeOnboardingMock = mockMutation(
  "accounts.organization.completeOnboarding"
)
const requestStarterImportMock = mockMutation("ai.suggest.requestStarterImport")
const confirmStarterImportMock = mockMutation("ai.suggest.confirmStarterImport")
const rejectSuggestionMock = mockMutation("ai.suggest.rejectSuggestion")
// The query mock dispatches on the api ref (see beforeEach): getIndustryStarter
// returns the seed fixture, getModel the tracks fixture, and
// getOpenSuggestions the AI rows for the import flow.
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

// The animated placeholder runs real timers; it has its own test file and
// only adds noise (act warnings) here.
vi.mock("@/components/onboarding/typewriter-placeholder", () => ({
  TypewriterPlaceholder: () => null,
}))

import { FamiliesStep } from "@/components/onboarding/families-step"

const t = messages.dashboard.onboarding.families
const nextCta = messages.dashboard.onboarding.screens.nextCta

// A two-family starter; the second family is removable in its own test.
function starterFixture() {
  return {
    families: [
      {
        name: "Engineering",
        roles: [
          { title: "Developer", trackKey: "IC" },
          { title: "Tech Lead", trackKey: "Lead" },
        ],
      },
      {
        name: "Sales",
        roles: [{ title: "Account Executive", trackKey: "IC" }],
      },
    ],
  }
}

// Tracks fixture; only the keys/names the Select needs to render.
function modelFixture() {
  return {
    modelId: "model-1",
    name: "Standard",
    templateKey: "standard",
    criteria: [],
    tracks: [
      { key: "IC", name: "Individual Contributor", order: 1 },
      { key: "Lead", name: "Lead", order: 2 },
    ],
    bandThresholds: [],
  }
}

function suggestedImportFixture() {
  return {
    suggestionId: "sugg-1",
    kind: "starter.import",
    status: "suggested",
    suggestedValue: {
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            // Unknown track keys from the model are coerced to the first track.
            { title: "Tech Lead", trackKey: "Boss" },
          ],
        },
      ],
    },
    errorCode: null,
    createdAt: Date.now(),
    roleId: null,
  }
}

let currentStarter: unknown
let currentModel: unknown
let currentSuggestions: unknown

function renderStep(onFinished: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamiliesStep
        orgId="org-1"
        organizationName="Acme"
        onAdvance={onFinished}
      />
    </NextIntlClientProvider>
  )
}

async function seedFromTemplate() {
  fireEvent.click(screen.getByRole("button", { name: t.templateCta }))
  await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)
}

describe("FamiliesStep", () => {
  beforeEach(() => {
    createStarterSetMock.mockReset()
    completeOnboardingMock.mockReset()
    requestStarterImportMock.mockReset()
    confirmStarterImportMock.mockReset()
    rejectSuggestionMock.mockReset()
    useQueryMock.mockReset()
    currentStarter = starterFixture()
    currentModel = modelFixture()
    currentSuggestions = []
    useQueryMock.mockImplementation((ref: unknown) => {
      if (ref === "assessment.starters.getIndustryStarter")
        return currentStarter
      if (ref === "ai.suggest.getOpenSuggestions") return currentSuggestions
      return currentModel
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("starts in the paste view with a disabled next button", () => {
    renderStep()
    expect(screen.getByLabelText(t.pasteLabel)).toBeDefined()
    expect(
      screen.queryAllByLabelText(messages.dashboard.roles.family.nameLabel)
    ).toHaveLength(0)
    const next = screen.getByRole("button", {
      name: nextCta,
    }) as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })

  it("sends the pasted text to the AI on next", async () => {
    requestStarterImportMock.mockResolvedValue("sugg-1")
    renderStep()
    fireEvent.change(screen.getByLabelText(t.pasteLabel), {
      target: { value: "Developer\nTech Lead\nAccountant" },
    })
    fireEvent.click(screen.getByRole("button", { name: nextCta }))
    await waitFor(() => {
      expect(requestStarterImportMock).toHaveBeenCalledTimes(1)
    })
    expect(requestStarterImportMock).toHaveBeenCalledWith({
      orgId: "org-1",
      rawText: "Developer\nTech Lead\nAccountant",
      locale: "en",
    })
  })

  it("shows the progress state while the import is generating", async () => {
    currentSuggestions = [
      {
        suggestionId: "sugg-1",
        kind: "starter.import",
        status: "generating",
        suggestedValue: null,
        errorCode: null,
        createdAt: Date.now(),
        roleId: null,
      },
    ]
    renderStep()
    expect(await screen.findByText(t.generating)).toBeDefined()
    expect(screen.queryByLabelText(t.pasteLabel)).toBeNull()
  })

  it("shows the translated error and keeps the textarea when the import failed", async () => {
    currentSuggestions = [
      {
        suggestionId: "sugg-1",
        kind: "starter.import",
        status: "failed",
        suggestedValue: null,
        errorCode: "errors.aiGenerationFailed",
        createdAt: Date.now(),
        roleId: null,
      },
    ]
    renderStep()
    expect((await screen.findByRole("alert")).textContent).toBe(
      messages.errors.aiGenerationFailed
    )
    expect(screen.getByLabelText(t.pasteLabel)).toBeDefined()
  })

  it("seeds review from a suggested import, coerces unknown tracks, and confirms with the edited list", async () => {
    currentSuggestions = [suggestedImportFixture()]
    confirmStarterImportMock.mockResolvedValue(null)
    completeOnboardingMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)

    // The AI proposal seeds the editable review list directly.
    const nameInputs = (await screen.findAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    )) as HTMLInputElement[]
    expect(nameInputs.map((input) => input.value)).toEqual(["Engineering"])
    expect(screen.getByText(messages.dashboard.ai.provenance)).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))
    await waitFor(() => {
      expect(confirmStarterImportMock).toHaveBeenCalledTimes(1)
    })
    expect(confirmStarterImportMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            { title: "Tech Lead", trackKey: "IC" },
          ],
        },
      ],
    })
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(createStarterSetMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("the template button seeds from the industry starter and creates via createStarterSet", async () => {
    createStarterSetMock.mockResolvedValue(null)
    completeOnboardingMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)
    await seedFromTemplate()

    const nameInputs = screen.getAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    ) as HTMLInputElement[]
    expect(nameInputs.map((input) => input.value)).toEqual([
      "Engineering",
      "Sales",
    ])

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))
    await waitFor(() => {
      expect(createStarterSetMock).toHaveBeenCalledTimes(1)
    })
    expect(createStarterSetMock).toHaveBeenCalledWith({
      orgId: "org-1",
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            { title: "Tech Lead", trackKey: "Lead" },
          ],
        },
        {
          name: "Sales",
          roles: [{ title: "Account Executive", trackKey: "IC" }],
        },
      ],
    })
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(confirmStarterImportMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("choosing the template dismisses an open AI proposal", async () => {
    currentSuggestions = [
      {
        suggestionId: "sugg-1",
        kind: "starter.import",
        status: "failed",
        suggestedValue: null,
        errorCode: "errors.aiGenerationFailed",
        createdAt: Date.now(),
        roleId: null,
      },
    ]
    rejectSuggestionMock.mockResolvedValue(null)
    renderStep()
    await seedFromTemplate()
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
    })
  })

  it("excludes a removed family from the createStarterSet payload", async () => {
    createStarterSetMock.mockResolvedValue(null)
    completeOnboardingMock.mockResolvedValue(null)
    renderStep()
    await seedFromTemplate()

    // Remove the Sales family (arm the morph confirm, then confirm), then
    // create.
    fireEvent.click(
      screen.getByRole("button", {
        name: t.removeFamilyLabel.replace("{name}", "Sales"),
      })
    )
    fireEvent.click(
      await screen.findByRole("button", {
        name: t.removeFamilyConfirm,
      })
    )
    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))

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

  it("finishing with only blank families advances without creating", async () => {
    completeOnboardingMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)
    await seedFromTemplate()

    // Empty every prefilled family name; cleaned input is then empty and
    // nothing is created. The step still advances, and onboarding is NOT
    // completed here (the score step owns completion).
    for (const input of screen.getAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    )) {
      fireEvent.change(input, { target: { value: "   " } })
    }
    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(createStarterSetMock).not.toHaveBeenCalled()
    expect(completeOnboardingMock).not.toHaveBeenCalled()
  })

  it("renders a drag handle per role in the review list", async () => {
    renderStep()
    await seedFromTemplate()
    for (const title of ["Developer", "Tech Lead", "Account Executive"]) {
      expect(
        screen.getByRole("button", {
          name: t.dragHandleLabel.replace("{title}", title),
        })
      ).toBeDefined()
    }
  })

  it("start over from an AI review dismisses the suggestion and returns to the paste view", async () => {
    currentSuggestions = [suggestedImportFixture()]
    rejectSuggestionMock.mockResolvedValue(null)
    renderStep()
    await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)

    fireEvent.click(screen.getByRole("button", { name: t.restartCta }))

    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
    })
    // The fixture still reports the suggestion as suggested; the dismissal
    // guard must keep it from instantly re-seeding the review.
    expect(await screen.findByLabelText(t.pasteLabel)).toBeDefined()
  })

  it("start over from a template review returns to the paste view without dismissing anything", async () => {
    renderStep()
    await seedFromTemplate()

    fireEvent.click(screen.getByRole("button", { name: t.restartCta }))

    expect(await screen.findByLabelText(t.pasteLabel)).toBeDefined()
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
  })

  it("shows the translated duplicate alert and stays when create is rejected", async () => {
    createStarterSetMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    const onFinished = vi.fn()
    renderStep(onFinished)
    await seedFromTemplate()

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        messages.errors.roleFamilyExists
      )
    })
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(onFinished).not.toHaveBeenCalled()
  })

  it("there is no skip: the create button is the only way forward in review", async () => {
    renderStep()
    await seedFromTemplate()
    const buttons = screen.getAllByRole("button")
    expect(buttons.filter((b) => b.textContent === t.nextCta)).toHaveLength(1)
    expect(screen.queryByText("Skip for now")).toBeNull()
  })

  it("shows the duplicate alert when the AI confirm is rejected", async () => {
    currentSuggestions = [suggestedImportFixture()]
    confirmStarterImportMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    const onFinished = vi.fn()
    renderStep(onFinished)
    await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        messages.errors.roleFamilyExists
      )
    })
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(onFinished).not.toHaveBeenCalled()
  })

  it("retrying after a failed creation re-runs the confirm only", async () => {
    currentSuggestions = [suggestedImportFixture()]
    confirmStarterImportMock
      .mockRejectedValueOnce(new Error("ConvexError: errors.notFound"))
      .mockResolvedValueOnce(null)
    const onFinished = vi.fn()
    renderStep(onFinished)
    await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)

    // First attempt: the confirm throws, the step stays and shows the alert.
    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onFinished).not.toHaveBeenCalled()

    // Retry: the confirm re-runs and now succeeds, then the step advances.
    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))
    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(confirmStarterImportMock).toHaveBeenCalledTimes(2)
    expect(completeOnboardingMock).not.toHaveBeenCalled()
  })
})
