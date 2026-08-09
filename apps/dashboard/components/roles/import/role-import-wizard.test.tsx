import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MAX_FAMILIES, MAX_ROLES } from "@workspace/constants"
import messages from "@workspace/i18n/messages/en.json"
import { createTranslator, NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockAction, mockMutation, onQuery } from "@/test/convex-mocks"

const requestRoleImportMock = mockMutation("ai.suggest.requestRoleImport")
const confirmRoleImportMock = mockMutation("ai.suggest.confirmRoleImport")
const rejectSuggestionMock = mockMutation("ai.suggest.rejectSuggestion")
const prefillMock = mockAction("ai.prefill.prefillRoleProfiles")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

const pushMock = vi.fn()

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1" }),
}))
// The animated placeholder runs real timers; it has its own test file and
// only adds noise (act warnings) here.
vi.mock("@/components/typewriter-placeholder", () => ({
  TypewriterPlaceholder: () => null,
}))

// NumberFlow renders a custom element that happy-dom never upgrades, so its
// getSnapshotBeforeUpdate throws the moment the count CHANGES in place. The
// progress readout changes by definition; the digit animation is the
// library's business, these tests are about the figures.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { RoleImportWizard } from "@/components/roles/import/role-import-wizard"

const t = messages.dashboard.roles.import
const tTable = messages.dashboard.familyTable

// The create CTA is an ICU plural, so its rendered label is formatted from the
// message file rather than restated here.
const formatReview = createTranslator({
  locale: "en",
  messages,
  namespace: "dashboard.roles.import.review",
})
const createCta = (count: number) => formatReview("cta", { count })

// SubmitButton nests its Spinner unhidden, so the accessible name of a
// submitting CTA gains the spinner's own "Loading" label ("Analyse Loading"):
// matched by its stable prefix rather than the idle exact name.
const submittingCta = () =>
  screen.getByRole("button", { name: new RegExp(`^${t.paste.cta}`) })

const familyNameLabel = messages.dashboard.roles.family.nameLabel
const familyMenu = messages.dashboard.roles.family
const familyActions = (name: string) =>
  tTable.familyActions.replace("{name}", name)

/**
 * The family's one trailing row-actions menu, opened, and its items.
 *
 * Awaits the popup rather than reading it synchronously. The menu mounts its
 * content asynchronously, and the review step animates in, so a synchronous
 * read raced the mount and failed roughly one run in six. It also returns the
 * items so a caller asserting an item is ABSENT has to prove the menu opened
 * at all: `queryByRole(...)).toBeNull()` on its own passes just as happily
 * when nothing ever mounted, which is the state this race produced.
 */
async function openFamilyMenu(name: string) {
  const trigger = screen.getByRole("button", { name: familyActions(name) })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
  return await screen.findAllByRole("menuitem")
}

/** Closes any open row-actions menu and waits for it to actually leave. */
async function closeFamilyMenu() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
  await waitFor(() => {
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0)
  })
}

/** Picks one item out of a family's open row-actions menu. */
async function chooseFamilyAction(name: string, item: string) {
  await openFamilyMenu(name)
  fireEvent.click(await screen.findByRole("menuitem", { name: item }))
}

/** Opens a created family's name field, which is closed until asked for. */
async function openFamilyName(name: string) {
  await chooseFamilyAction(name, familyMenu.renameCta)
  return await screen.findByRole("textbox", { name: familyNameLabel })
}
const removeRole = (title: string) =>
  tTable.removeRole.replace("{title}", title)

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
    levelThresholds: [],
  }
}

// The org already has Engineering with a Developer in it, which is what makes
// this an additive import rather than a starter set.
function familiesFixture() {
  return [{ familyId: "fam-eng", name: "Engineering", roleCount: 1 }]
}

function rolesFixture() {
  return [
    {
      roleId: "role-dev",
      title: "Developer",
      trackKey: "IC",
      trackName: "Individual Contributor",
      familyId: "fam-eng",
      familyName: "Engineering",
      profileComplete: true,
    },
  ]
}

// A proposal that lands one new role in the existing family, one duplicate of
// what is already there, and one role in a brand-new family.
function suggestionFixture() {
  return [
    {
      suggestionId: "sugg-1",
      kind: "role.import",
      status: "suggested",
      suggestedValue: {
        truncated: false,
        families: [
          {
            name: "Engineering",
            roles: [
              { title: "SRE", trackKey: "IC" },
              { title: "Developer", trackKey: "IC" },
            ],
          },
          {
            name: "Legal",
            roles: [{ title: "Legal Counsel", trackKey: "IC" }],
          },
        ],
      },
      errorCode: null,
      createdAt: 1,
      roleId: null,
    },
  ]
}

// The proposal mid-generation. createdAt must be fresh: the shared flow reads a
// long-running generating row as a crashed one.
function generatingFixture() {
  return [
    {
      suggestionId: "sugg-1",
      kind: "role.import",
      status: "generating",
      suggestedValue: null,
      errorCode: null,
      createdAt: Date.now(),
      roleId: null,
    },
  ]
}

// A generation that ended in an error. Only reachable as a leftover: this
// visit's own failure is driven through the request instead.
function failedFixture() {
  return [
    {
      suggestionId: "sugg-1",
      kind: "role.import",
      status: "failed",
      suggestedValue: null,
      errorCode: "errors.aiGenerationFailed",
      createdAt: 1,
      roleId: null,
    },
  ]
}

// Each query's value, so a test can leave one undefined (still loading) the way
// independent Convex subscriptions resolve.
let currentSuggestions: unknown
let currentFamilies: unknown
let currentRoles: unknown

function renderWizard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleImportWizard />
    </NextIntlClientProvider>
  )
}

// Re-renders a mounted wizard so it re-reads the mocked subscriptions, the way
// a Convex update would deliver a row that was not there before.
function rerender(view: ReturnType<typeof renderWizard>) {
  view.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleImportWizard />
    </NextIntlClientProvider>
  )
}

// Paste and Analyse, with the request opening the generating row the way the
// mutation does. The wizard only ever waits for a generation it started
// itself, so this is the only way onto that screen.
async function startGenerating() {
  requestRoleImportMock.mockImplementation(() => {
    currentSuggestions = generatingFixture()
    return Promise.resolve("sugg-1")
  })
  const view = renderWizard()
  fireEvent.change(screen.getByRole("textbox", { name: t.paste.label }), {
    target: { value: "SRE\nLegal Counsel" },
  })
  fireEvent.click(screen.getByRole("button", { name: t.paste.cta }))
  // Let the request resolve: it returns the id every fixture carries, which is
  // what makes the row that arrives next this visit's own.
  await act(async () => {})
  return view
}

// Drives the wizard to the review the only way a user can reach it: paste,
// Analyse, and the proposal this visit asked for lands. Mounting straight into
// a suggested row does NOT work any more (and must not): the wizard opens on an
// empty paste screen every visit and dismisses whatever was already open, so
// only a proposal its own Analyse click created can seed the review.
/**
 * Waits for ScreenShell to finish revealing the screen (screen-shell.tsx
 * drops `pointer-events: none` when it does), rather than returning as soon as
 * the heading mounts.
 *
 * Added against a ~1-in-6 full-suite flake where a row-actions menu never
 * mounted its popup. Note the mechanism is NOT that the click was blocked:
 * fireEvent dispatches straight at the node and ignores pointer-events. What
 * this actually does is flush the reveal's out-of-act state update before the
 * interaction, so the tree is settled when the menu opens. The flake has not
 * recurred in 30+ full-suite runs since, but the causal chain is inferred
 * rather than proven; if it returns, start here.
 */
async function screenRevealed(heading: HTMLElement) {
  await waitFor(() => {
    // Only THIS screen's own ancestors, never a document-wide scan: Base UI
    // sets inline pointer-events: none on its own hover-scope and popup
    // elements, so a global check would hang on any menu that happened to be
    // mounted rather than on the shell this is waiting for.
    for (
      let node = heading.parentElement;
      node !== null;
      node = node.parentElement
    ) {
      expect(node.style.pointerEvents).not.toBe("none")
    }
  })
}

async function openReview(rows: unknown = suggestionFixture()) {
  const view = await startGenerating()
  currentSuggestions = rows
  rerender(view)
  await screenRevealed(await screen.findByText(t.review.heading))
  return view
}

function backButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: messages.dashboard.roles.detail.backToRoles,
  }) as HTMLButtonElement
}

// The value cell of one done-screen summary row. Scoped to the list because
// "Roles added" is both the screen's heading and the first row's label.
function summaryValue(container: HTMLElement, label: string): string {
  const list = container.querySelector("dl")
  if (list === null) throw new Error("no summary list on screen")
  const term = within(list).getByText(label)
  return term.parentElement?.querySelector("dd")?.textContent ?? ""
}

// The confirm's arguments, as the wizard sends them.
interface ConfirmArgs {
  orgId: string
  suggestionId: string
  families: {
    familyId?: string
    name: string
    roles: { title: string; trackKey: string }[]
  }[]
  skippedInReview: number
}

interface ConfirmResult {
  createdRoleIds: string[]
  familyCount: number
  roleCount: number
  skippedCount: number
}

// A stand-in for insertAdditiveRoles that COUNTS THE PAYLOAD IT IS GIVEN,
// instead of returning a fixed number. A canned `skippedCount: 1` hid the real
// defect for as long as it existed: the resolver strips duplicates out of the
// payload before submitting, so the server can only ever skip what collides
// inside what it received, which for a reviewed list is nothing. Only a mock
// that applies the real rule can show whether the screen's number is true.
function fakeConfirmRoleImport(args: ConfirmArgs): ConfirmResult {
  const key = (title: string) => title.trim().toLowerCase()
  // Titles already live per family, exactly the set the mutation builds.
  const taken = new Map<string, Set<string>>()
  for (const role of (currentRoles ?? []) as {
    title: string
    familyId: string | null
  }[]) {
    if (role.familyId === null) continue
    const titles = taken.get(role.familyId) ?? new Set<string>()
    titles.add(key(role.title))
    taken.set(role.familyId, titles)
  }

  const createdRoleIds: string[] = []
  let familyCount = 0
  let skippedCount = 0
  for (const family of args.families) {
    const pending: string[] = []
    const seenInNewFamily = new Set<string>()
    for (const role of family.roles) {
      if (family.familyId !== undefined) {
        const titles = taken.get(family.familyId) ?? new Set<string>()
        taken.set(family.familyId, titles)
        if (titles.has(key(role.title))) {
          skippedCount += 1
          continue
        }
        titles.add(key(role.title))
      } else {
        if (seenInNewFamily.has(key(role.title))) {
          skippedCount += 1
          continue
        }
        seenInNewFamily.add(key(role.title))
      }
      pending.push(role.title)
    }
    if (pending.length === 0) continue
    if (family.familyId === undefined) familyCount += 1
    for (const title of pending) {
      createdRoleIds.push(`role-${key(title).replace(/\s+/g, "-")}`)
    }
  }
  return {
    createdRoleIds,
    familyCount,
    roleCount: createdRoleIds.length,
    skippedCount,
  }
}

/** The family groups of the review table: one <tbody> each. */
const groupCount = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="table-body"]').length

describe("RoleImportWizard", () => {
  beforeEach(() => {
    requestRoleImportMock.mockReset()
    requestRoleImportMock.mockResolvedValue("sugg-1")
    confirmRoleImportMock.mockReset()
    confirmRoleImportMock.mockImplementation((args: ConfirmArgs) =>
      Promise.resolve(fakeConfirmRoleImport(args))
    )
    rejectSuggestionMock.mockReset()
    rejectSuggestionMock.mockResolvedValue(null)
    prefillMock.mockReset()
    prefillMock.mockResolvedValue({ generated: 0, failed: 0 })
    pushMock.mockReset()
    currentSuggestions = []
    currentFamilies = familiesFixture()
    currentRoles = rolesFixture()
    useQueryMock.mockReset()
    useQueryMock.mockImplementation((ref: unknown) => {
      if (ref === "ai.suggest.getOpenSuggestions") return currentSuggestions
      if (ref === "assessment.families.listRoleFamilies") return currentFamilies
      if (ref === "assessment.roles.listRoles") return currentRoles
      return modelFixture()
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("starts on the paste step with the analyse CTA disabled", () => {
    renderWizard()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    const cta = screen.getByRole("button", { name: t.paste.cta })
    expect((cta as HTMLButtonElement).disabled).toBe(true)
  })

  it("sends the pasted text on analyse", async () => {
    renderWizard()
    // By role, not by label: the paste step's dot in the footer nav carries the
    // same "Your roles" accessible name as the field.
    fireEvent.change(screen.getByRole("textbox", { name: t.paste.label }), {
      target: { value: "SRE\nLegal Counsel" },
    })
    fireEvent.click(screen.getByRole("button", { name: t.paste.cta }))
    await waitFor(() => {
      expect(requestRoleImportMock).toHaveBeenCalledWith({
        orgId: "org-1",
        rawText: "SRE\nLegal Counsel",
        locale: "en",
      })
    })
  })

  // The happy path spelled out step by step (the other review cases take the
  // same route through openReview): this is the one place the wait, the
  // arriving proposal and the seed are each asserted on their own.
  it("walks paste to generating to review as the proposal arrives", async () => {
    const view = await startGenerating()

    // Generating: the field stays on screen (disabled, holding what was
    // pasted) and the heading does not move, so the content box is the same
    // height it was on the paste step and stays that height into the review.
    // The CTA stays too, now in its own submitting state.
    const generatingCta = submittingCta()
    expect((generatingCta as HTMLButtonElement).disabled).toBe(true)
    expect(within(generatingCta).getByRole("status")).toBeTruthy()
    const generatingField = screen.getByRole("textbox", {
      name: t.paste.label,
    }) as HTMLTextAreaElement
    expect(generatingField.disabled).toBe(true)
    expect(generatingField.value).toBe("SRE\nLegal Counsel")
    expect(screen.getByText(t.paste.heading)).toBeTruthy()

    // The generation lands: the review seeds from it, resolved against the
    // register (Engineering already exists, Developer already exists in it).
    currentSuggestions = suggestionFixture()
    rerender(view)
    expect(await screen.findByText(t.review.heading)).toBeTruthy()
    // Engineering is the org's own family, so its group carries the stored
    // name as static text instead of an editable field.
    expect(screen.getByText("Engineering")).toBeTruthy()
    // The proposed Developer never becomes a row: Engineering already has one.
    expect(screen.queryByText(tTable.duplicate)).toBeNull()
    expect(screen.getByRole("button", { name: createCta(2) })).toBeTruthy()
    // Its own proposal is never swept: the entry dismissal is for what was
    // already there when the wizard mounted.
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
  })

  it("leaves the paste field usable while the proposals query is still loading", () => {
    // getOpenSuggestions unresolved. Nothing can arrive and take the screen
    // any more (a proposal that was already open is dismissed, never seeded),
    // so there is nothing to hold for: the field is live from the first paint
    // and a paste typed into it survives the query landing.
    currentSuggestions = undefined
    renderWizard()
    const field = screen.getByRole("textbox", {
      name: t.paste.label,
    }) as HTMLTextAreaElement
    expect(field.disabled).toBe(false)
    // Not holding: the CTA carries no submitting state (it is still disabled
    // here, but because the field is empty, not because a request is out).
    expect(
      within(screen.getByRole("button", { name: t.paste.cta })).queryByRole(
        "status"
      )
    ).toBeNull()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
  })

  // The reported bug: the generation used to render a bare spinner line under
  // the heading, a SHORT screen that WizardShell's my-auto then centered; when
  // the real (tall) paste screen replaced it, the heading rode up. Rendering
  // the identical heading, field, hint and CTA in both states is what keeps
  // the content box's height from changing between them, so this asserts that
  // structural sameness directly: a future change that drops the field, the
  // hint or the CTA from one of them (and shortens its content box relative to
  // the other) fails here. The CTA itself is the one thing allowed to differ,
  // via its own submitting state, so both variants are checked here too.
  it("keeps the same heading, field, hint and CTA, differing only in the CTA's and field's own state, while generating and pasting", async () => {
    // Generating: the request is in flight.
    const generating = await startGenerating()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    expect(
      (
        screen.getByRole("textbox", {
          name: t.paste.label,
        }) as HTMLTextAreaElement
      ).disabled
    ).toBe(true)
    expect(screen.getByText(t.paste.hint)).toBeTruthy()
    const generatingCta = submittingCta() as HTMLButtonElement
    expect(generatingCta.disabled).toBe(true)
    expect(within(generatingCta).getByRole("status")).toBeTruthy()
    generating.unmount()

    // Paste: the same heading, field, hint and CTA, now interactive: the
    // field is enabled and the CTA carries no submitting state.
    currentSuggestions = []
    renderWizard()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    expect(
      (
        screen.getByRole("textbox", {
          name: t.paste.label,
        }) as HTMLTextAreaElement
      ).disabled
    ).toBe(false)
    expect(screen.getByText(t.paste.hint)).toBeTruthy()
    const pasteCta = screen.getByRole("button", {
      name: t.paste.cta,
    }) as HTMLButtonElement
    expect(within(pasteCta).queryByRole("status")).toBeNull()
  })

  // The decision this wizard is built on: nothing is saved until Create, so
  // nothing is carried across visits either. A proposal left open last time is
  // not restored, and it is not left dangling either (a suggestion's lifecycle
  // always ends in confirmed or rejected, ADR-0003): entering closes it.
  it("opens on the paste screen and dismisses a proposal left over from a previous visit", async () => {
    currentSuggestions = suggestionFixture()
    renderWizard()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    expect(screen.queryByText(t.review.heading)).toBeNull()
    // Live, not held: the leftover is on its way out, so it must not disable
    // the field the user came here to type into.
    expect(
      (
        screen.getByRole("textbox", {
          name: t.paste.label,
        }) as HTMLTextAreaElement
      ).disabled
    ).toBe(false)
    await waitFor(() => {
      expect(rejectSuggestionMock).toHaveBeenCalledWith({
        orgId: "org-1",
        suggestionId: "sugg-1",
      })
    })
  })

  // A generation that failed while nobody was watching is the same leftover:
  // its error belongs to a run the user walked away from, so the fresh paste
  // screen must not open with a red alert about it.
  it("dismisses a leftover failed generation without showing its error", async () => {
    currentSuggestions = failedFixture()
    renderWizard()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByText(t.paste.error)).toBeNull()
    await waitFor(() => {
      expect(rejectSuggestionMock).toHaveBeenCalledWith({
        orgId: "org-1",
        suggestionId: "sugg-1",
      })
    })
    // Still the paste screen after the dismissal round trip.
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("holds the review until the register it resolves against loads", async () => {
    // The register decides which families read as existing and which titles are
    // duplicates, so seeding before it lands would badge everything new and
    // then silently change. The proposal is this visit's own here, so nothing
    // dismisses it: the review just waits.
    currentRoles = undefined
    const view = await startGenerating()
    currentSuggestions = suggestionFixture()
    rerender(view)
    expect(screen.queryByText(t.review.heading)).toBeNull()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
  })

  // With the whole register on screen, "existing" is the default state, so
  // there is no badge for either state: what separates the two is structural.
  // Both names read as static text; only a family this import would create
  // can be renamed into a field, and that is the ONLY signal it is new, so
  // this is the test that pins it.
  it("shows a matched family as the stored one and a created one as renameable", async () => {
    await openReview()
    expect(screen.getByText("Engineering")).toBeTruthy()
    expect(screen.getByText("Legal")).toBeTruthy()
    // The menu opened and simply has no Rename: asserted off the item list
    // rather than as a bare absence, so a menu that never mounted fails here
    // instead of passing.
    const stored = await openFamilyMenu("Engineering")
    expect(stored.map((item) => item.textContent)).not.toContain(
      familyMenu.renameCta
    )
    await closeFamilyMenu()
    const field = (await openFamilyName("Legal")) as HTMLInputElement
    expect(field.value).toBe("Legal")
  })

  // The review carries no help control: what it used to explain is now
  // visible on sight (a muted static row beside an editable one, a text name
  // beside a field), and the domain terms moved to the paste screen, which is
  // where the flow first uses them.
  it("carries no help control on the review", async () => {
    await openReview()
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.help.familiesReviewLabel,
      })
    ).toBeNull()
  })

  // The terms did not just disappear with that control: this repo requires a
  // surface introducing a domain term to explain it inline, and the paste
  // screen is now the only place in this flow that defines either one.
  it("defines role family and track in the paste help popover", () => {
    renderWizard()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.roles.import.paste.helpLabel,
      })
    )
    const body = messages.dashboard.roles.import.paste.helpBody
    expect(body).toContain("A role family groups roles")
    expect(body).toContain("A track is the kind of job")
    expect(
      screen.getByText((content) => content.includes("A role family groups"))
    ).toBeTruthy()
  })

  // The confirm is purely additive: it cannot rename, re-track or delete
  // anything. A remove control on a family the org already has would confirm,
  // empty the card off the screen, and change nothing, leaving a user who
  // believes they tidied their register.
  it("offers no way to remove a family the org already has", async () => {
    await openReview()
    const stored = await openFamilyMenu("Engineering")
    expect(stored.map((item) => item.textContent)).not.toContain(
      familyMenu.removeCta
    )
    await closeFamilyMenu()
    // The family this import would create keeps its remove item.
    const created = await openFamilyMenu("Legal")
    expect(created.map((item) => item.textContent)).toContain(
      familyMenu.removeCta
    )
  })

  // Only the review takes the wide shell. The reading steps (paste, the waits,
  // the three-row done summary) keep the column they have always had, and the
  // width lives on the crossfading element rather than the shell so an exiting
  // screen is not resized while it is still visible mid-fade.
  it("widens the review step only, leaving the paste step its reading column", async () => {
    // The crossfading element, read off the shell's own content box rather
    // than by position, so this cannot silently start measuring some other div.
    const stepWidth = (container: HTMLElement) =>
      container.querySelector(".max-w-5xl")?.firstElementChild?.className ?? ""

    const paste = renderWizard()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    expect(stepWidth(paste.container)).toContain("max-w-3xl")
    paste.unmount()

    const review = await openReview()
    expect(screen.getByText(t.review.heading)).toBeTruthy()
    expect(stepWidth(review.container)).not.toContain("max-w-3xl")
  })

  it("puts a family the proposal never targeted on screen as a group of its own", async () => {
    currentFamilies = [
      ...familiesFixture(),
      { familyId: "fam-fin", name: "Finance", roleCount: 1 },
    ]
    currentRoles = [
      ...rolesFixture(),
      {
        roleId: "role-controller",
        title: "Controller",
        trackKey: "IC",
        trackName: "Individual Contributor",
        familyId: "fam-fin",
        familyName: "Finance",
        profileComplete: true,
      },
    ]
    const view = await openReview()
    expect(screen.getByText("Finance")).toBeTruthy()
    // Three families, three groups of ONE table: Engineering, Legal and the
    // one this import adds nothing to, all in the same shape and all with
    // their own row-actions menu.
    expect(view.container.querySelectorAll("table")).toHaveLength(1)
    // One tbody per family (Engineering, Legal, Finance). Add-family sits
    // below the table's frame, so it is no longer a group of the table.
    expect(groupCount(view.container)).toBe(3)
    for (const family of ["Engineering", "Legal", "Finance"]) {
      expect(
        screen.getByRole("button", { name: familyActions(family) })
      ).toBeTruthy()
    }
    expect(screen.getByText("Controller")).toBeTruthy()
    // Nothing removable on a family the org already has.
    const untouched = await openFamilyMenu("Finance")
    expect(untouched.map((item) => item.textContent)).not.toContain(
      familyMenu.removeCta
    )
  })

  // The roles the org has are on screen from the first paint, so the register
  // the import is being added to is visible while it is reviewed. They are read
  // only: nothing on this screen can change a role that already exists, so a
  // field there would discard what it took.
  it("shows an existing family's roles read only, with nothing to expand", async () => {
    await openReview()
    // The one place a title renders as TEXT is a register row: every proposed
    // row is a field.
    const row = screen.getByText("Developer").closest("tr")
    if (row === null) throw new Error("no existing role row")
    expect(
      row.querySelectorAll("input, select, button, [role='combobox']")
    ).toHaveLength(0)
  })

  // The product decision this rebuild is about: a proposal to add a role the
  // family already has is a proposal to do nothing, so it never becomes a row.
  // It used to render faded, directly under the identical row Engineering
  // already had, noted "already exists, will be skipped".
  it("never renders the already-present proposal, and excludes it from the count", async () => {
    await openReview()
    // Developer is on screen exactly once, as the register row Engineering
    // already had, and it is not a field.
    expect(screen.getAllByText("Developer")).toHaveLength(1)
    expect(screen.queryByDisplayValue("Developer")).toBeNull()
    expect(screen.queryByText(tTable.duplicate)).toBeNull()
    // The rows that ARE proposed are still there, and the count is theirs.
    expect(screen.getByDisplayValue("SRE")).toBeTruthy()
    expect(screen.getByDisplayValue("Legal Counsel")).toBeTruthy()
    expect(screen.getByRole("button", { name: createCta(2) })).toBeTruthy()
  })

  // The seed only filters what the AI proposed. A user can still type a title
  // the family already has, and the resolver is the safety net that keeps that
  // from creating a second one.
  it("still catches a duplicate the user types by hand", async () => {
    await openReview()
    fireEvent.change(screen.getByDisplayValue("SRE"), {
      target: { value: "Developer" },
    })
    expect(screen.getByText(tTable.duplicate)).toBeTruthy()
    // Only Legal Counsel is left to create, and the typed row is not sent.
    expect(screen.getByRole("button", { name: createCta(1) })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: createCta(1) }))
    await waitFor(() => {
      expect(confirmRoleImportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          families: [
            {
              name: "Legal",
              roles: [{ title: "Legal Counsel", trackKey: "IC" }],
            },
          ],
          // Both halves: the row the seed dropped and the one the review did.
          skippedInReview: 2,
        })
      )
    })
  })

  it("submits the resolved payload, merging into the existing family", async () => {
    await openReview()
    fireEvent.click(screen.getByRole("button", { name: createCta(2) }))
    await waitFor(() => {
      expect(confirmRoleImportMock).toHaveBeenCalledWith({
        orgId: "org-1",
        suggestionId: "sugg-1",
        families: [
          {
            familyId: "fam-eng",
            name: "Engineering",
            roles: [{ title: "SRE", trackKey: "IC" }],
          },
          {
            name: "Legal",
            roles: [{ title: "Legal Counsel", trackKey: "IC" }],
          },
        ],
        // Developer is already in Engineering, so the review filtered it out.
        // The count travels with the payload because the payload no longer
        // contains the row it is about, and the audit trail records the total.
        skippedInReview: 1,
      })
    })
  })

  it("prefills only the created roles, then shows the done counts", async () => {
    const view = await openReview()
    fireEvent.click(screen.getByRole("button", { name: createCta(2) }))
    await waitFor(() => {
      expect(prefillMock).toHaveBeenCalledWith({
        orgId: "org-1",
        locale: "en",
        via: "roleImportPrefill",
        roleIds: ["role-sre", "role-legal-counsel"],
      })
    })
    // The done heading, not getByText: "Roles added" is also the label of the
    // created-roles row in the summary list below it.
    expect(
      await screen.findByRole("heading", { name: t.done.title })
    ).toBeTruthy()
    // The numbers, not just their labels: a screen reporting zero on a
    // successful import would otherwise pass.
    expect(summaryValue(view.container, t.done.roles)).toBe("2")
    expect(summaryValue(view.container, t.done.families)).toBe("1")
    // The review flagged Developer as already present and dropped it from the
    // payload, so the SERVER skipped nothing. Reporting the server's number
    // alone made this row structurally zero on every import that skipped
    // anything, contradicting the duplicate note the same screen had shown.
    expect(summaryValue(view.container, t.done.skipped)).toBe("1")
    // A clean run says nothing about failed profiles.
    expect(screen.queryByRole("alert")).toBeNull()
  })

  // The server's own count still has to reach the screen: it covers the race
  // where a colliding role appeared between review and confirm.
  it("adds the server's own skips to the reviewed ones", async () => {
    confirmRoleImportMock.mockImplementation((args: ConfirmArgs) => {
      const outcome = fakeConfirmRoleImport(args)
      // One of the submitted titles turned out to be taken after all.
      return Promise.resolve({
        ...outcome,
        createdRoleIds: outcome.createdRoleIds.slice(1),
        roleCount: outcome.roleCount - 1,
        skippedCount: outcome.skippedCount + 1,
      })
    })
    const view = await openReview()
    fireEvent.click(screen.getByRole("button", { name: createCta(2) }))
    expect(
      await screen.findByRole("heading", { name: t.done.title })
    ).toBeTruthy()
    expect(summaryValue(view.container, t.done.skipped)).toBe("2")
  })

  it("shows the scoped drafting progress while the profiles fill", async () => {
    // The denominator is this import's roles, not the org's. The org already
    // holds one role with a complete profile, so an unscoped measurement would
    // read "1 of 1" (and look finished) instead of "0 of 2".
    const deferred: { resolve: () => void } = { resolve: () => {} }
    prefillMock.mockImplementation(
      () =>
        new Promise<{ generated: number; failed: number }>((resolve) => {
          deferred.resolve = () => resolve({ generated: 2, failed: 0 })
        })
    )
    await openReview()
    fireEvent.click(screen.getByRole("button", { name: createCta(2) }))

    expect(await screen.findByText(t.prefilling.heading)).toBeTruthy()
    expect(screen.getByText(t.prefilling.body)).toBeTruthy()
    expect(screen.getByRole("progressbar")).toBeTruthy()
    expect(
      // The figures are NumberFlow nodes inside the message now, so the text
      // is split across elements: match on the whole line's content.
      screen.getByText((_, element) =>
        element?.textContent ===
        t.prefilling.progress
          .replace("<done></done>", "0")
          .replace("<total></total>", "2")
          ? element?.tagName === "P"
          : false
      )
    ).toBeTruthy()

    deferred.resolve()
    expect(
      await screen.findByRole("heading", { name: t.done.title })
    ).toBeTruthy()
  })

  it("reports the missing profiles, not a failed import, when the prefill throws", async () => {
    // The roles ARE created at this point, so the counts stand; only the
    // profiles are missing. Saying the import failed here would send the user
    // to re-run a consumed proposal.
    prefillMock.mockRejectedValue(new Error("transport blew up"))
    const view = await openReview()
    fireEvent.click(screen.getByRole("button", { name: createCta(2) }))

    expect(
      await screen.findByRole("heading", { name: t.done.title })
    ).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toBe(t.done.profilesFailed)
    expect(screen.queryByText(t.review.error)).toBeNull()
    expect(summaryValue(view.container, t.done.roles)).toBe("2")
  })

  it("sends one confirm and locks the exit while it is on the wire", async () => {
    // A confirm consumes its suggestion, so a second send hits a closed
    // proposal and throws notFound, which would overwrite a real success with a
    // permanent false error. And once the mutation is sent there is no honest
    // answer to "discard this import?", so leaving is barred rather than
    // promising that nothing was created.
    const deferred: { resolve: () => void } = { resolve: () => {} }
    confirmRoleImportMock.mockImplementation(
      (args: ConfirmArgs) =>
        new Promise((resolve) => {
          deferred.resolve = () => resolve(fakeConfirmRoleImport(args))
        })
    )
    await openReview()
    const create = screen.getByRole("button", {
      name: createCta(2),
    }) as HTMLButtonElement
    fireEvent.click(create)

    await waitFor(() => {
      expect(create.disabled).toBe(true)
    })
    fireEvent.click(create)
    expect(confirmRoleImportMock).toHaveBeenCalledTimes(1)

    // The exit is barred, and clicking it neither navigates nor offers the
    // (now untrue) discard.
    expect(backButton().disabled).toBe(true)
    fireEvent.click(backButton())
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.queryByText(t.discard.title)).toBeNull()

    deferred.resolve()
    expect(
      await screen.findByRole("heading", { name: t.done.title })
    ).toBeTruthy()
  })

  // A list of roles the org already has produces a review with nothing added
  // anywhere: the rows never render, so the screen would otherwise show the
  // untouched register and say nothing about where the pasted list went.
  it("blocks create and says how many already exist when the whole list was already there", async () => {
    await openReview([
      {
        ...suggestionFixture()[0],
        suggestedValue: {
          truncated: false,
          families: [
            {
              name: "Engineering",
              roles: [{ title: "Developer", trackKey: "IC" }],
            },
          ],
        },
      },
    ])
    expect(
      screen.getByText(formatReview("nothingToAdd", { count: 1 }))
    ).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: createCta(0),
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  // The "every role already exists" line is the only explanation the review
  // offers below the CTA, so it must never appear for a draft that is blocked
  // for a different reason: it points at the wrong fix (edit a title) while
  // the card's own alert points at the right one.

  // Rename opens the field by deferring to the menu's onOpenChangeComplete,
  // which in a browser fires after the close animation and so after the menu
  // has returned focus to its trigger. With no animation to outlast (a reader
  // who prefers reduced motion, and any environment that does not run them)
  // "complete" fires first and the restoration blurs the field this gesture
  // just opened, turning Rename into a flash of a field that shuts itself. The
  // field survives its own opening gesture whichever way the two land.
  it("keeps the rename field open after the menu returns focus", async () => {
    await openReview()
    const field = await openFamilyName("Legal")
    expect(field).toBeTruthy()
    // Past every pending task, so the menu's focus restoration has run.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(
      screen.queryByRole("textbox", { name: familyNameLabel })
    ).not.toBeNull()
  })

  it("does not claim everything exists when a family is missing its name", async () => {
    // The already-taken Developer is what gives this its teeth: the draft HAS
    // something skipped, so "everything already exists" is reachable. Without
    // it nothing is skipped, the blocker falls through to "empty" whichever way
    // the priority runs, and the assertion below stays green even with the rule
    // reversed.
    await openReview()
    // Nothing left that WOULD be created: SRE goes, and Legal's rows stop
    // counting the moment its name does.
    fireEvent.click(screen.getByRole("button", { name: removeRole("SRE") }))
    fireEvent.click(
      await screen.findByRole("button", { name: tTable.removeRoleConfirm })
    )
    // Engineering's name is the stored one, so the only field on screen is
    // Legal's.
    fireEvent.change(await openFamilyName("Legal"), {
      target: { value: "" },
    })
    // The group says what is wrong...
    expect(screen.getByText(tTable.nameMissing)).toBeTruthy()
    // ...and nothing below the CTA contradicts it.
    expect(screen.queryByText(t.review.nothingToAdd)).toBeNull()
  })

  // The step dots are a progress indicator, never a control. Going back from
  // the review drops the proposal server-side and loses the edited list, which
  // only a labelled control (Start over, the discard confirmation) may do; a
  // dot whose accessible name is just "Your roles" must not. Enabling them
  // again would either resurrect the dead no-op dot or hand a one-click
  // unconfirmed discard to a control that cannot say so.
  it("keeps every step dot inert, on every phase", async () => {
    function expectDotsInert() {
      const dots = [t.steps.paste, t.steps.review].map(
        (label) =>
          screen.getByRole("button", { name: label }) as HTMLButtonElement
      )
      for (const dot of dots) {
        expect(dot.disabled).toBe(true)
        fireEvent.click(dot)
      }
      // No dot reaches restart, whose one visible effect is the dismissal.
      expect(rejectSuggestionMock).not.toHaveBeenCalled()
    }

    await openReview()
    // Review: the phase where a click would have been destructive.
    expect(screen.getByText(t.review.heading)).toBeTruthy()
    expectDotsInert()

    fireEvent.click(screen.getByRole("button", { name: createCta(2) }))
    await screen.findByRole("heading", { name: t.done.title })
    // Done: the roles exist, so there is nothing to go back to at all.
    expectDotsInert()
    expect(screen.getByRole("heading", { name: t.done.title })).toBeTruthy()
  })

  // The server rejects an over-limit payload WHOLE, with one untargeted
  // invalidInput. With a hundred rows on screen there is no way to find what
  // went wrong, and the only exit (Start over) discards the reviewed list. So
  // the review has to hold the line the write does, before it is submitted.
  it("blocks an over-limit list and names the cap instead of letting it be sent", async () => {
    await openReview([
      {
        ...suggestionFixture()[0],
        suggestedValue: {
          truncated: false,
          families: [
            {
              name: "Legal",
              roles: Array.from({ length: MAX_ROLES + 1 }, (_, index) => ({
                title: `Role ${index}`,
                trackKey: "IC",
              })),
            },
          ],
        },
      },
    ])
    const cta = screen.getByRole("button", {
      name: createCta(MAX_ROLES + 1),
    }) as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    expect(
      screen.getByText(
        formatReview("tooManyRoles", {
          max: MAX_ROLES,
          count: MAX_ROLES + 1,
        })
      )
    ).toBeTruthy()
    fireEvent.click(cta)
    expect(confirmRoleImportMock).not.toHaveBeenCalled()
  })

  it("blocks too many families and names that cap instead", async () => {
    await openReview([
      {
        ...suggestionFixture()[0],
        suggestedValue: {
          truncated: false,
          families: Array.from({ length: MAX_FAMILIES + 1 }, (_, index) => ({
            name: `Family ${index}`,
            roles: [{ title: `Role ${index}`, trackKey: "IC" }],
          })),
        },
      },
    ])
    expect(
      (
        screen.getByRole("button", {
          name: createCta(MAX_FAMILIES + 1),
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      screen.getByText(formatReview("tooManyFamilies", { max: MAX_FAMILIES }))
    ).toBeTruthy()
  })

  // A payload the client thought was fine can still be rejected (a limit
  // changed, a race). "Try again" invites a pointless retry of the same list;
  // the rejection needs its own words.
  it("tells a rejected payload apart from a transient failure", async () => {
    confirmRoleImportMock.mockRejectedValue(
      new Error("[Request ID: x] Server Error: errors.invalidInput")
    )
    await openReview()
    fireEvent.click(screen.getByRole("button", { name: createCta(2) }))
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toBe(t.review.invalid)
    expect(screen.queryByText(t.review.error)).toBeNull()
  })

  // The clamp happens at the AI trust boundary, so the review shows only the
  // survivors and looks complete. Without the notice, a 150-role paste reports
  // "Roles added: 100" and the loss is discovered (if ever) in the register.
  it("says so when the proposal was clamped to the import's caps", async () => {
    await openReview([
      {
        ...suggestionFixture()[0],
        suggestedValue: {
          ...(suggestionFixture()[0]?.suggestedValue as object),
          truncated: true,
        },
      },
    ])
    expect(
      screen.getByText(
        formatReview("truncated", {
          roles: MAX_ROLES,
          families: MAX_FAMILIES,
        })
      )
    ).toBeTruthy()
  })

  it("shows no truncation notice for a proposal that fit", async () => {
    await openReview()
    expect(
      screen.queryByText(
        formatReview("truncated", {
          roles: MAX_ROLES,
          families: MAX_FAMILIES,
        })
      )
    ).toBeNull()
  })

  // The alert reports one submission's verdict. Left standing after the edit
  // that fixed the problem, it contradicts a CTA that has gone back to green.
  it("clears the failure alert as soon as the list is edited", async () => {
    confirmRoleImportMock.mockRejectedValue(new Error("transport blew up"))
    await openReview()
    fireEvent.click(screen.getByRole("button", { name: createCta(2) }))
    expect(await screen.findByRole("alert")).toBeTruthy()

    fireEvent.change(
      screen.getAllByLabelText(
        messages.dashboard.roles.create.titleLabel
      )[0] as HTMLInputElement,
      { target: { value: "Site Reliability Engineer" } }
    )
    expect(screen.queryByText(t.review.error)).toBeNull()
  })

  // The resolver already models the empty state; the view used to render
  // nothing for it, leaving a disabled "Create 0 roles" and no explanation.
  // Emptying a list that held nothing already-present is its own state: the
  // user removed the rows, so pointing at duplicates would explain the wrong
  // thing, and saying nothing at all leaves a disabled "Create 0 roles".
  it("explains an emptied list instead of leaving a silent disabled CTA", async () => {
    await openReview([
      {
        ...suggestionFixture()[0],
        suggestedValue: {
          truncated: false,
          families: [
            { name: "Legal", roles: [{ title: "Counsel", trackKey: "IC" }] },
          ],
        },
      },
    ])
    await chooseFamilyAction("Legal", familyMenu.removeCta)
    fireEvent.click(
      await screen.findByRole("button", { name: tTable.removeFamilyConfirm })
    )
    expect(screen.getByText(t.review.nothingHere)).toBeTruthy()
    expect(screen.queryByText(tTable.duplicate)).toBeNull()
    // Engineering stays exactly the group it was, showing only the role the
    // org already has: emptying the import never changes a group into
    // something else.
    expect(screen.getByText("Developer")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: familyActions("Engineering") })
    ).toBeTruthy()
  })

  // A row emptied in review still looks like a role while the count quietly
  // drops it.
  it("annotates a row whose title was cleared", async () => {
    await openReview()
    fireEvent.change(
      screen.getAllByLabelText(
        messages.dashboard.roles.create.titleLabel
      )[0] as HTMLInputElement,
      { target: { value: "  " } }
    )
    expect(screen.getByText(tTable.blankTitle)).toBeTruthy()
    // SRE is gone from the count; Legal Counsel remains.
    expect(screen.getByRole("button", { name: createCta(1) })).toBeTruthy()
  })

  // Nothing from a blocked card is created, so labelling its rows "already
  // exists, will be skipped" names a consequence that is not happening and
  // sends the user to edit a title when the card's name is the problem.
  it("drops the duplicate note from rows inside a blocked card", async () => {
    // A new family repeating a title inside itself. A card matched to an
    // existing family can no longer be blocked at all (its name is the stored
    // one and cannot be emptied), so the rule is exercised where it still
    // reaches: a family this import would create.
    await openReview([
      {
        ...suggestionFixture()[0],
        suggestedValue: {
          truncated: false,
          families: [
            {
              name: "Legal",
              roles: [
                { title: "Counsel", trackKey: "IC" },
                { title: "Counsel", trackKey: "IC" },
              ],
            },
          ],
        },
      },
    ])
    expect(screen.getAllByText(tTable.duplicate)).toHaveLength(1)
    // Clearing the card's name blocks it; nothing in it is submitted, so no
    // row in it may claim it will be skipped as a duplicate.
    fireEvent.change(await openFamilyName("Legal"), {
      target: { value: "" },
    })
    expect(screen.getByText(tTable.nameMissing)).toBeTruthy()
    expect(screen.queryByText(tTable.duplicate)).toBeNull()
  })

  // An added family with no rows contributes nothing to the payload, so the
  // server never sees its name. Flagging it collided with a real one and
  // blocked the whole import over a family that does not exist to the write.
  it("does not let an empty added family collide with a real one", async () => {
    await openReview()
    fireEvent.click(screen.getByRole("button", { name: tTable.addFamily }))
    const names = screen.getAllByLabelText(familyNameLabel)
    fireEvent.change(names[names.length - 1] as HTMLInputElement, {
      target: { value: "Legal" },
    })
    expect(screen.queryByText(tTable.collision)).toBeNull()
    expect(
      (
        screen.getByRole("button", {
          name: createCta(2),
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  })

  it("start over dismisses the proposal and returns to the paste step", async () => {
    await openReview()
    fireEvent.click(screen.getByRole("button", { name: t.review.restart }))
    await waitFor(() => {
      expect(rejectSuggestionMock).toHaveBeenCalledWith({
        orgId: "org-1",
        suggestionId: "sugg-1",
      })
    })
    // The fixture still reports the proposal as suggested; the dismissal guard
    // must keep it from instantly re-seeding the review.
    expect(await screen.findByText(t.paste.heading)).toBeTruthy()
  })

  it("leaves straight to roles from the untouched paste step", () => {
    renderWizard()
    fireEvent.click(backButton())
    expect(pushMock).toHaveBeenCalledWith("/roles")
  })

  it("confirms before leaving a reviewed list", async () => {
    await openReview()
    fireEvent.click(backButton())
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByText(t.discard.title)).toBeTruthy()
  })

  // Discard rejects the proposal rather than leaving it for the next visit's
  // entry sweep to close: the user is answering the question, so the dismissal
  // is theirs and is recorded now.
  it("discarding rejects the suggestion and navigates away", async () => {
    await openReview()
    fireEvent.click(backButton())
    fireEvent.click(screen.getByRole("button", { name: t.discard.discard }))
    await waitFor(() => {
      expect(rejectSuggestionMock).toHaveBeenCalledWith({
        orgId: "org-1",
        suggestionId: "sugg-1",
      })
    })
    expect(pushMock).toHaveBeenCalledWith("/roles")
  })

  // "Keep reviewing" must change nothing: only the explicit Discard choice may
  // reject the proposal, never the dialog's dismissal path.
  it("keep reviewing closes the dialog and rejects nothing", async () => {
    await openReview()
    fireEvent.click(backButton())
    fireEvent.click(screen.getByRole("button", { name: t.discard.keep }))
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.queryByText(t.discard.title)).toBeNull()
    expect(screen.getByText(t.review.heading)).toBeTruthy()
  })
})
