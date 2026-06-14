import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

import { mockAction, mockMutation, onQuery } from "@/test/convex-mocks"

const createStarterSetMock = mockMutation(
  "assessment.starters.createStarterSet"
)
const reconcileStarterSetMock = mockMutation(
  "assessment.starters.reconcileStarterSet"
)
const completeOnboardingMock = mockMutation(
  "accounts.organization.completeOnboarding"
)
const requestStarterImportMock = mockMutation("ai.suggest.requestStarterImport")
const confirmStarterImportMock = mockMutation("ai.suggest.confirmStarterImport")
const rejectSuggestionMock = mockMutation("ai.suggest.rejectSuggestion")
// The prefill action runs after persist on every advance; the action itself
// skips non-empty roles, so an unchanged revisit makes no model call. The mock
// resolves with zero counts by default so finish() flows through to onAdvance.
const prefillRoleProfilesMock = mockAction("ai.prefill.prefillRoleProfiles")
// The query mock dispatches on the api ref (see beforeEach): getIndustryStarter
// returns the seed fixture, getModel the tracks fixture, getOpenSuggestions the
// AI rows for the import flow, and listRoleFamilies/listRoles the already-created
// set on a revisit (empty in the forward flow, so the resume block stays off).
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
let currentFamilies: unknown
let currentRoles: unknown

// An already-created set the way listRoleFamilies + listRoles return it on a
// revisit: families carry their id, roles carry their id/title/trackKey and the
// familyId they belong to (null for an unfamilied role).
function existingFamiliesFixture() {
  return [
    { familyId: "fam-eng", name: "Engineering", roleCount: 2 },
    { familyId: "fam-sales", name: "Sales", roleCount: 1 },
  ]
}

function existingRolesFixture() {
  return [
    {
      roleId: "role-dev",
      title: "Developer",
      trackKey: "IC",
      familyId: "fam-eng",
      familyName: "Engineering",
    },
    {
      roleId: "role-lead",
      title: "Tech Lead",
      trackKey: "Lead",
      familyId: "fam-eng",
      familyName: "Engineering",
    },
    {
      roleId: "role-ae",
      title: "Account Executive",
      trackKey: "IC",
      familyId: "fam-sales",
      familyName: "Sales",
    },
  ]
}

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

// Picking the template now CREATES immediately: createStarterSet is awaited,
// then the created set appears via listRoleFamilies/listRoles (the resume
// block seeds the editable review from it). The mock populates those query
// fixtures so a re-render reflects the now-created set, mirroring how the live
// Convex queries update after the mutation resolves.
async function seedFromTemplate() {
  createStarterSetMock.mockResolvedValue(null)
  createStarterSetMock.mockImplementation(() => {
    currentFamilies = existingFamiliesFixture()
    currentRoles = existingRolesFixture()
    return Promise.resolve(null)
  })
  fireEvent.click(screen.getByRole("button", { name: t.templateCta }))
  await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)
}

describe("FamiliesStep", () => {
  beforeEach(() => {
    createStarterSetMock.mockReset()
    reconcileStarterSetMock.mockReset()
    completeOnboardingMock.mockReset()
    requestStarterImportMock.mockReset()
    confirmStarterImportMock.mockReset()
    rejectSuggestionMock.mockReset()
    prefillRoleProfilesMock.mockReset()
    prefillRoleProfilesMock.mockResolvedValue({ generated: 0, failed: 0 })
    useQueryMock.mockReset()
    currentStarter = starterFixture()
    currentModel = modelFixture()
    currentSuggestions = []
    // Forward flow: no roles exist yet, so the resume-from-existing block must
    // not fire and the paste/template/AI create flow stays in charge.
    currentFamilies = []
    currentRoles = []
    useQueryMock.mockImplementation((ref: unknown) => {
      if (ref === "assessment.starters.getIndustryStarter")
        return currentStarter
      if (ref === "ai.suggest.getOpenSuggestions") return currentSuggestions
      if (ref === "assessment.families.listRoleFamilies") return currentFamilies
      if (ref === "assessment.roles.listRoles") return currentRoles
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

  it("use template creates immediately, shows a spinner, then renders the editable review", async () => {
    // The template create is deferred until the queries reflect it, so the
    // mock holds the listRoles/listRoleFamilies update behind a manual resolve
    // and we can observe the spinner gate between the click and the review.
    // The deferred resolver is captured synchronously (the Promise executor
    // runs synchronously) into an explicitly-typed holder so it stays callable.
    const deferred: { resolve: () => void } = { resolve: () => {} }
    createStarterSetMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          deferred.resolve = () => {
            currentFamilies = existingFamiliesFixture()
            currentRoles = existingRolesFixture()
            resolve(null)
          }
        })
    )
    renderStep()

    fireEvent.click(screen.getByRole("button", { name: t.templateCta }))

    // createStarterSet runs on the pick (NOT deferred to Next) with the
    // industry families, and the paste view is replaced by the spinner.
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
    expect(screen.queryByLabelText(t.pasteLabel)).toBeNull()
    expect(
      screen.queryAllByLabelText(messages.dashboard.roles.family.nameLabel)
    ).toHaveLength(0)

    // Once the created set appears, the resume-from-existing seed renders the
    // editable review (the same families, now carrying their real ids).
    deferred.resolve()
    const nameInputs = (await screen.findAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    )) as HTMLInputElement[]
    expect(nameInputs.map((input) => input.value)).toEqual([
      "Engineering",
      "Sales",
    ])
    // AI provenance is not shown: the review is the freshly-created set.
    expect(screen.queryByText(messages.dashboard.ai.provenance)).toBeNull()
  })

  it("template choice persists across a remount/revisit", async () => {
    // The regression for the reported bug: after the template create, a remount
    // (e.g. the user navigated back a step then forward, dropping local state)
    // with the created set present resumes straight into the editable review,
    // never offering the paste/template choice again.
    await (async () => {
      const { unmount } = renderStep()
      await seedFromTemplate()
      unmount()
    })()

    // currentFamilies/currentRoles are now populated (seedFromTemplate created
    // them); a fresh mount has no local draft, yet must resume into the review.
    renderStep()
    const nameInputs = (await screen.findAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    )) as HTMLInputElement[]
    expect(nameInputs.map((input) => input.value)).toEqual([
      "Engineering",
      "Sales",
    ])
    expect(screen.queryByLabelText(t.pasteLabel)).toBeNull()
  })

  it("start over in the just-created template review discards via reconcile-empty", async () => {
    reconcileStarterSetMock.mockImplementation(() => {
      // Discarding archives all roles and removes all families: the queries go
      // back to empty, so the paste/template/AI choice can show again.
      currentFamilies = []
      currentRoles = []
      return Promise.resolve(null)
    })
    renderStep()
    await seedFromTemplate()

    fireEvent.click(screen.getByRole("button", { name: t.restartCta }))

    await waitFor(() => {
      expect(reconcileStarterSetMock).toHaveBeenCalledTimes(1)
    })
    expect(reconcileStarterSetMock).toHaveBeenCalledWith({
      orgId: "org-1",
      families: [],
    })
    expect(await screen.findByLabelText(t.pasteLabel)).toBeDefined()
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
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

  it("the template review wins even when a suggested AI proposal is open during the in-flight create", async () => {
    // The hijack regression. seedFromTemplate fires flow.reject()
    // fire-and-forget and awaits createStarterSet, but sets no seededFrom
    // synchronously and (without the fix) leaves lastDismissedId untouched.
    // flow.status is derived from getOpenSuggestions and does NOT flip on the
    // (in-flight, not-yet-round-tripped) reject. So there is a render after the
    // create resolves but before listRoles reports the new roles where
    // seededFrom === null, existingRoles is resolved-empty [], and
    // flow.status === "suggested" with the id un-latched: the AI seed block's
    // gate is fully satisfied and it hijacks the screen onto the abandoned AI
    // proposal (provenance shown), and Next would confirm a walked-away-from
    // suggestion instead of reconciling the created set.
    //
    // Reproduce that exact window deterministically: the suggestion is NOT
    // "suggested" at mount (so the paste view, with its template CTA, is
    // reachable); the create mock makes it "suggested" while the create is in
    // flight and resolves WITHOUT yet reporting roles, so the next render is the
    // vulnerable one. Resolving the roles afterward lets the resume-from-existing
    // seed claim the review.
    rejectSuggestionMock.mockResolvedValue(null)
    reconcileStarterSetMock.mockResolvedValue(null)
    const deferred: { resolve: () => void } = { resolve: () => {} }
    createStarterSetMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          deferred.resolve = () => {
            // The create resolved: the open-suggestion query now reports the
            // proposal as "suggested" (the window the bug exploits), but the
            // roles subscription has NOT yet reported the new roles (they stay
            // empty until the explicit rerender below). This is the single
            // vulnerable render the bug exploits.
            currentSuggestions = [suggestedImportFixture()]
            resolve(null)
          }
        })
    )
    const onFinished = vi.fn()
    const view = renderStep(onFinished)

    fireEvent.click(screen.getByRole("button", { name: t.templateCta }))
    await waitFor(() => {
      expect(createStarterSetMock).toHaveBeenCalledTimes(1)
    })

    // The create resolves into the vulnerable window (suggestion "suggested",
    // existingRoles resolved-empty []). The post-await re-render (the create's
    // finally clearing templatePending) reads the queries here. The AI seed
    // block must NOT fire: with the fix the spinner holds (createdViaTemplate +
    // no roles yet), so no AI provenance and no AI single-family review appear.
    // On the buggy code the AI block hijacks the screen onto the abandoned
    // proposal and the provenance line shows.
    deferred.resolve()
    await waitFor(() => {
      expect(createStarterSetMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText(messages.dashboard.ai.provenance)).toBeNull()

    // The roles subscription now reports the created set; a re-render lets the
    // resume-from-existing seed render the TEMPLATE set (both families), never
    // the single-family AI proposal, and never the provenance line.
    currentFamilies = existingFamiliesFixture()
    currentRoles = existingRolesFixture()
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FamiliesStep
          orgId="org-1"
          organizationName="Acme"
          onAdvance={onFinished}
        />
      </NextIntlClientProvider>
    )
    const nameInputs = (await screen.findAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    )) as HTMLInputElement[]
    expect(nameInputs.map((input) => input.value)).toEqual([
      "Engineering",
      "Sales",
    ])
    expect(screen.queryByText(messages.dashboard.ai.provenance)).toBeNull()

    // Advancing reconciles the created set; it must NOT confirm the abandoned
    // import.
    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))
    await waitFor(() => {
      expect(reconcileStarterSetMock).toHaveBeenCalledTimes(1)
    })
    expect(confirmStarterImportMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("removing a family in the just-created review reconciles it away on next", async () => {
    // Template now creates on pick, so the review is the created set: Next
    // reconciles the edited list against the stored roles (never re-creates).
    reconcileStarterSetMock.mockResolvedValue(null)
    completeOnboardingMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)
    await seedFromTemplate()

    // Remove the Sales family (arm the morph confirm, then confirm), then
    // reconcile on Next.
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
      expect(reconcileStarterSetMock).toHaveBeenCalledTimes(1)
    })
    const payload = reconcileStarterSetMock.mock.calls[0]?.[0] as {
      families: { name: string }[]
    }
    expect(payload.families.map((family) => family.name)).toEqual([
      "Engineering",
    ])
    expect(createStarterSetMock).toHaveBeenCalledTimes(1) // the create-on-pick
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("emptying every family in the just-created review reconciles to an empty set on next", async () => {
    // Template creates on pick, then deleting all role-family names empties the
    // list; Next reconciles to an empty set (archives every created role,
    // removes every family) rather than re-creating. Onboarding is NOT
    // completed here (the score step owns completion).
    reconcileStarterSetMock.mockResolvedValue(null)
    completeOnboardingMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)
    await seedFromTemplate()

    for (const input of screen.getAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    )) {
      fireEvent.change(input, { target: { value: "   " } })
    }
    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(reconcileStarterSetMock).toHaveBeenCalledTimes(1)
    expect(reconcileStarterSetMock).toHaveBeenCalledWith({
      orgId: "org-1",
      families: [],
    })
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

  it("shows the translated duplicate alert and returns to the paste view when the template create is rejected", async () => {
    // The create now runs on pick, so a duplicate-name rejection surfaces there:
    // the flag/pending reset and the paste view comes back with the alert.
    createStarterSetMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    const onFinished = vi.fn()
    renderStep(onFinished)

    fireEvent.click(screen.getByRole("button", { name: t.templateCta }))

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        messages.errors.roleFamilyExists
      )
    })
    expect(screen.getByLabelText(t.pasteLabel)).toBeDefined()
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

  it("resumes into an editable review of the existing roles and reconciles on advance", async () => {
    // A revisit: the families step was finished once, so families + roles
    // already exist. The step must seed the review straight from them (no
    // paste view) and route the advance to reconcileStarterSet, carrying the
    // existing ids.
    currentFamilies = existingFamiliesFixture()
    currentRoles = existingRolesFixture()
    reconcileStarterSetMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)

    // The editable review shows the existing role families; the paste/import
    // entry is gone.
    const nameInputs = (await screen.findAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    )) as HTMLInputElement[]
    expect(nameInputs.map((input) => input.value)).toEqual([
      "Engineering",
      "Sales",
    ])
    expect(screen.queryByLabelText(t.pasteLabel)).toBeNull()
    // A genuine revisit (not created this session) offers NO one-click Start
    // over: it would archive everything. Editing happens in place.
    expect(screen.queryByRole("button", { name: t.restartCta })).toBeNull()
    // The existing role titles are visible and editable.
    const titleInputs = screen.getAllByLabelText(
      messages.dashboard.roles.create.titleLabel
    ) as HTMLInputElement[]
    expect(titleInputs.map((input) => input.value)).toEqual([
      "Developer",
      "Tech Lead",
      "Account Executive",
    ])

    // Edit one title to prove the user's edits ride along.
    fireEvent.change(titleInputs[0] as HTMLInputElement, {
      target: { value: "Senior Developer" },
    })

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))
    await waitFor(() => {
      expect(reconcileStarterSetMock).toHaveBeenCalledTimes(1)
    })
    expect(reconcileStarterSetMock).toHaveBeenCalledWith({
      orgId: "org-1",
      families: [
        {
          familyId: "fam-eng",
          name: "Engineering",
          roles: [
            { roleId: "role-dev", title: "Senior Developer", trackKey: "IC" },
            { roleId: "role-lead", title: "Tech Lead", trackKey: "Lead" },
          ],
        },
        {
          familyId: "fam-sales",
          name: "Sales",
          roles: [
            { roleId: "role-ae", title: "Account Executive", trackKey: "IC" },
          ],
        },
      ],
    })
    // The reconcile path never re-creates: no create/confirm calls.
    expect(createStarterSetMock).not.toHaveBeenCalled()
    expect(confirmStarterImportMock).not.toHaveBeenCalled()
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("holds the spinner while listRoles is still loading, even with a coincident open AI suggestion", async () => {
    // The loading-window defect: Convex useQuery subscriptions resolve
    // independently, so on a revisit the suggestion + families + model can be
    // resolved while listRoles is still loading (existingRoles === undefined).
    // In that window nothing must seed: the AI block must NOT fire (it would
    // seed the stale import and route finish() to confirmStarterImport), and
    // the spinner must hold until roles resolve so the resume-from-existing
    // path can win once they do. Roles still loading: listRoles returns
    // undefined while families + model are resolved and a suggested import is
    // open.
    currentRoles = undefined
    currentSuggestions = [suggestedImportFixture()]
    reconcileStarterSetMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)

    // The spinner holds: no review (no family-name inputs), no AI provenance
    // line, and no paste view. Nothing has seeded yet.
    expect(
      screen.queryAllByLabelText(messages.dashboard.roles.family.nameLabel)
    ).toHaveLength(0)
    expect(screen.queryByText(messages.dashboard.ai.provenance)).toBeNull()
    expect(screen.queryByLabelText(t.pasteLabel)).toBeNull()
    // Nothing is created, confirmed, or reconciled while roles are loading.
    expect(confirmStarterImportMock).not.toHaveBeenCalled()
    expect(createStarterSetMock).not.toHaveBeenCalled()
    expect(reconcileStarterSetMock).not.toHaveBeenCalled()
  })

  it("resume from existing wins over a coincident open AI suggestion", async () => {
    // The coincidence the ordering defect mishandled: a revisit (existing
    // families + roles) AND a still-open suggested import row resolving in the
    // same render. Resume-from-existing must win regardless of block order:
    // the review shows the EXISTING role titles, not the suggested import's,
    // and advancing reconciles the real ids (never confirms the stale import).
    currentFamilies = existingFamiliesFixture()
    currentRoles = existingRolesFixture()
    currentSuggestions = [suggestedImportFixture()]
    reconcileStarterSetMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderStep(onFinished)

    // The existing set seeded the review, not the suggested import (which is a
    // single "Engineering" family). The provenance line (AI-seeded only) is
    // absent.
    const nameInputs = (await screen.findAllByLabelText(
      messages.dashboard.roles.family.nameLabel
    )) as HTMLInputElement[]
    expect(nameInputs.map((input) => input.value)).toEqual([
      "Engineering",
      "Sales",
    ])
    expect(screen.queryByText(messages.dashboard.ai.provenance)).toBeNull()
    const titleInputs = screen.getAllByLabelText(
      messages.dashboard.roles.create.titleLabel
    ) as HTMLInputElement[]
    expect(titleInputs.map((input) => input.value)).toEqual([
      "Developer",
      "Tech Lead",
      "Account Executive",
    ])

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))
    await waitFor(() => {
      expect(reconcileStarterSetMock).toHaveBeenCalledTimes(1)
    })
    expect(reconcileStarterSetMock).toHaveBeenCalledWith({
      orgId: "org-1",
      families: [
        {
          familyId: "fam-eng",
          name: "Engineering",
          roles: [
            { roleId: "role-dev", title: "Developer", trackKey: "IC" },
            { roleId: "role-lead", title: "Tech Lead", trackKey: "Lead" },
          ],
        },
        {
          familyId: "fam-sales",
          name: "Sales",
          roles: [
            { roleId: "role-ae", title: "Account Executive", trackKey: "IC" },
          ],
        },
      ],
    })
    // The stale import is never confirmed and nothing is re-created.
    expect(confirmStarterImportMock).not.toHaveBeenCalled()
    expect(createStarterSetMock).not.toHaveBeenCalled()
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("prefills role profiles after reconcile and before advancing on the existing path", async () => {
    // After the persist step (reconcile here), Next must prefill the role
    // profiles, then advance. The action skips non-empty roles server-side, so
    // it is always safe to call; the order is persist -> prefill -> advance.
    currentFamilies = existingFamiliesFixture()
    currentRoles = existingRolesFixture()
    const order: string[] = []
    reconcileStarterSetMock.mockImplementation(() => {
      order.push("reconcile")
      return Promise.resolve(null)
    })
    prefillRoleProfilesMock.mockImplementation(() => {
      order.push("prefill")
      return Promise.resolve({ generated: 0, failed: 0 })
    })
    const onFinished = vi.fn(() => order.push("advance"))
    renderStep(onFinished)
    await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(prefillRoleProfilesMock).toHaveBeenCalledTimes(1)
    expect(prefillRoleProfilesMock).toHaveBeenCalledWith({ orgId: "org-1" })
    // persist -> prefill -> advance, strictly ordered.
    expect(order).toEqual(["reconcile", "prefill", "advance"])
  })

  it("prefills role profiles after the AI confirm and before advancing", async () => {
    currentSuggestions = [suggestedImportFixture()]
    const order: string[] = []
    confirmStarterImportMock.mockImplementation(() => {
      order.push("confirm")
      return Promise.resolve(null)
    })
    prefillRoleProfilesMock.mockImplementation(() => {
      order.push("prefill")
      return Promise.resolve({ generated: 1, failed: 0 })
    })
    const onFinished = vi.fn(() => order.push("advance"))
    renderStep(onFinished)
    await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(prefillRoleProfilesMock).toHaveBeenCalledTimes(1)
    expect(prefillRoleProfilesMock).toHaveBeenCalledWith({ orgId: "org-1" })
    expect(order).toEqual(["confirm", "prefill", "advance"])
  })

  it("shows the Next button loading state across persist + prefill, then advances when prefill resolves", async () => {
    // The whole finish() (persist + prefill) is one loading span on the Next
    // button: it disables and shows the spinner until prefill resolves, then
    // advances. We hold the prefill behind a manual resolve to observe it.
    currentFamilies = existingFamiliesFixture()
    currentRoles = existingRolesFixture()
    reconcileStarterSetMock.mockResolvedValue(null)
    const deferred: { resolve: () => void } = { resolve: () => {} }
    prefillRoleProfilesMock.mockImplementation(
      () =>
        new Promise<{ generated: number; failed: number }>((resolve) => {
          deferred.resolve = () => resolve({ generated: 0, failed: 0 })
        })
    )
    const onFinished = vi.fn()
    renderStep(onFinished)
    await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)

    const next = screen.getByRole("button", {
      name: t.nextCta,
    }) as HTMLButtonElement
    fireEvent.click(next)

    // While the prefill action is in flight the button is disabled and the
    // spinner (role=status) is visible, so the user sees the generating state.
    await waitFor(() => {
      expect(next.disabled).toBe(true)
    })
    expect(prefillRoleProfilesMock).toHaveBeenCalledTimes(1)
    expect(within(next).getByRole("status")).toBeDefined()
    expect(onFinished).not.toHaveBeenCalled()

    // Once prefill resolves, the step advances.
    deferred.resolve()
    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
  })

  it("surfaces the generic error and lets the user retry when prefill rejects", async () => {
    // A hard/transport prefill reject must not advance: the error shows and the
    // loading state resets so Next is clickable again.
    currentFamilies = existingFamiliesFixture()
    currentRoles = existingRolesFixture()
    reconcileStarterSetMock.mockResolvedValue(null)
    prefillRoleProfilesMock
      .mockRejectedValueOnce(new Error("transport blew up"))
      .mockResolvedValueOnce({ generated: 0, failed: 0 })
    const onFinished = vi.fn()
    renderStep(onFinished)
    await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)

    fireEvent.click(screen.getByRole("button", { name: t.nextCta }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onFinished).not.toHaveBeenCalled()
    const next = screen.getByRole("button", {
      name: t.nextCta,
    }) as HTMLButtonElement
    expect(next.disabled).toBe(false)

    // Retry: prefill now resolves and the step advances.
    fireEvent.click(next)
    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(prefillRoleProfilesMock).toHaveBeenCalledTimes(2)
  })
})
