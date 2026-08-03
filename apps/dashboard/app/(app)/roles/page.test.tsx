import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { buttonVariants } from "@workspace/ui/components/button"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { onQuery } from "@/test/convex-mocks"

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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import RolesPage from "@/app/(app)/roles/page"

const t = messages.dashboard.roles

// The register is the ONLY way into the AI import wizard, from this header and
// from the zero-roles empty state. If either link regresses the whole feature
// becomes unreachable, so both are pinned here.
const IMPORT_HREF = "/roles/import"

function modelFixture() {
  return {
    modelId: "model-1",
    name: "Standard",
    templateKey: "standard",
    criteria: [],
    tracks: [{ key: "IC", name: "Individual contributor", order: 1 }],
    bandThresholds: [],
  }
}

function roleFixture() {
  return {
    roleId: "role-1",
    slug: "senior-engineer",
    title: "Senior Engineer",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    trackName: "Individual contributor",
    ratedCount: 0,
    totalCriteria: 9,
    familyId: null,
    familyName: null,
    familySlug: null,
    employeeCount: 0,
    profileComplete: false,
  }
}

let currentRoles: unknown
let currentModel: unknown
let currentResults: unknown

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RolesPage />
    </NextIntlClientProvider>
  )
}

// The classes a variant contributes that the other one does not, so an
// emphasis assertion is about the variant and not about the whole utility
// string. Derived from the design system's own cva, so a token rename moves
// both sides together instead of breaking this test.
function variantClasses(variant: "default" | "outline"): Set<string> {
  return new Set(buttonVariants({ variant }).split(/\s+/))
}

function expectVariant(element: Element, variant: "default" | "outline") {
  const other = variant === "default" ? "outline" : "default"
  const own = variantClasses(variant)
  const rival = variantClasses(other)
  const classes = new Set(element.className.split(/\s+/))
  const missing = [...own].filter((cls) => !rival.has(cls) && !classes.has(cls))
  const wrong = [...rival].filter((cls) => !own.has(cls) && classes.has(cls))
  expect({ missing, wrong }).toEqual({ missing: [], wrong: [] })
}

function importLinks(): HTMLAnchorElement[] {
  return screen.getAllByRole("link", {
    name: t.import.cta,
  }) as HTMLAnchorElement[]
}

describe("RolesPage", () => {
  beforeEach(() => {
    currentRoles = [roleFixture()]
    currentModel = modelFixture()
    currentResults = { rows: [], bands: [] }
    useQueryMock.mockReset()
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.roles.listRoles") return currentRoles
      if (ref === "evaluationModel.model.getModel") return currentModel
      if (ref === "assessment.results.getResults") return currentResults
      return undefined
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("leads to the import wizard from the header", () => {
    renderPage()
    const links = importLinks()
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute("href")).toBe(IMPORT_HREF)
  })

  it("gives the import the primary emphasis and the create action the outline", () => {
    // Import is the primary: a register is built fastest in bulk. Demoting it
    // (or promoting Create beside it) would bury the feature in plain sight.
    renderPage()
    expectVariant(importLinks()[0] as Element, "default")
    expectVariant(screen.getByRole("button", { name: t.newCta }), "outline")
  })

  it("opens the create dialog from the header, rather than routing anywhere", () => {
    // There is no /roles/new route: the second header action is a dialog, so a
    // regression that turned it into a link would be a dead end.
    renderPage()
    expect(screen.queryByRole("link", { name: t.newCta })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: t.newCta }))
    expect(screen.getByRole("heading", { name: t.create.title })).toBeTruthy()
  })

  it("keeps the header actions real while the data loads", () => {
    // Static i18n chrome is never a skeleton bar: the import link works from
    // the first paint, and the create action stands in as a plain button until
    // the dialog has its tracks.
    currentRoles = undefined
    currentModel = undefined
    currentResults = undefined
    renderPage()

    const links = importLinks()
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute("href")).toBe(IMPORT_HREF)
    expectVariant(links[0] as Element, "default")

    const create = screen.getByRole("button", {
      name: t.newCta,
    }) as HTMLButtonElement
    expectVariant(create, "outline")
    expect(create.disabled).toBe(false)

    // The heading and the table's own toolbar are real too, not gray bars.
    expect(screen.getByText(t.heading)).toBeTruthy()
    expect(
      screen.getByRole("textbox", { name: t.toolbar.searchPlaceholder })
    ).toBeTruthy()
  })

  it("still renders the header while the model resolves to null", () => {
    // A org with no model yet takes the same loading branch (model === null),
    // so the import entry point must survive it.
    currentModel = null
    renderPage()
    expect(importLinks()[0]?.getAttribute("href")).toBe(IMPORT_HREF)
  })

  it("offers the import from the zero-roles empty state", () => {
    currentRoles = []
    renderPage()
    expect(screen.getByText(t.empty)).toBeTruthy()
    // Two now: the header's primary and the empty state's outline call to
    // action, which is the one a brand-new org actually lands on.
    const links = importLinks()
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link.getAttribute("href")).toBe(IMPORT_HREF)
    }
    expectVariant(links[1] as Element, "outline")
  })

  it("shows the table instead of the empty state once roles exist", () => {
    renderPage()
    expect(screen.queryByText(t.empty)).toBeNull()
    expect(screen.getByText("Senior Engineer")).toBeTruthy()
  })
})
