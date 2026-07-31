import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { Suspense } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"
import { pickSelectOption } from "@/test/select"

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
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import FamilyPage from "@/app/(app)/roles/families/[familySlug]/page"

const toolbar = messages.dashboard.roles.toolbar

const TRACKS = [
  { key: "IC", name: "Individual contributor", order: 1 },
  { key: "M", name: "Manager", order: 2 },
]

function role(overrides: Record<string, unknown>) {
  return {
    roleId: "r1",
    title: "Senior Engineer",
    slug: "senior-engineer",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    trackName: "Individual contributor",
    ratedCount: 9,
    totalCriteria: 9,
    profileComplete: true,
    familyId: "f-eng",
    familyName: "Engineering",
    familySlug: "engineering",
    trackOrder: 1,
    employeeCount: 0,
    ...overrides,
  }
}

const ROLES = [
  role({}),
  role({
    roleId: "r2",
    title: "Engineering Manager",
    slug: "engineering-manager",
    team: "Platform",
    trackKey: "M",
    trackName: "Manager",
    trackOrder: 2,
  }),
  // A role in another family: never part of this page's list.
  role({
    roleId: "r3",
    title: "Account Executive",
    slug: "account-executive",
    familyId: "f-sales",
    familyName: "Sales",
    familySlug: "sales",
  }),
]

// Query dispatcher for the loaded page; pass a role list to vary it.
function loaded(roles: Array<Record<string, unknown>> = ROLES) {
  return (ref: string) => {
    if (ref === "assessment.families.listRoleFamilies") {
      return [
        {
          familyId: "f-eng",
          name: "Engineering",
          slug: "engineering",
          roleCount: 2,
        },
        { familyId: "f-sales", name: "Sales", slug: "sales", roleCount: 1 },
      ]
    }
    if (ref === "assessment.roles.listRoles") return roles
    if (ref === "assessment.results.getResults") {
      return { rows: [], bands: [{ band: 1, minScore: 0 }] }
    }
    if (ref === "evaluationModel.model.getModel") {
      return {
        modelId: "m1",
        name: "Model",
        templateKey: null,
        criteria: [],
        tracks: TRACKS,
        bandThresholds: [{ band: 1, minScore: 0 }],
      }
    }
    return undefined
  }
}

// One promise per family for the whole file: the page reads its params with
// use(), so a fresh promise per render would suspend again on every rerender.
const PARAMS = Promise.resolve({ familySlug: "engineering" })
const OTHER_PARAMS = Promise.resolve({ familySlug: "sales" })

function page(params: typeof PARAMS = PARAMS) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <Suspense fallback={null}>
        <FamilyPage params={params} />
      </Suspense>
    </NextIntlClientProvider>
  )
}

async function renderPage() {
  // use(params) suspends the first mount, so the act scope has to cover the
  // render itself for the resolution to be flushed before the assertions.
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(page())
  })
  if (result === undefined) throw new Error("render did not run")
  return result
}

function trackFilter() {
  return screen.getByRole("combobox", {
    name: messages.dashboard.roles.table.track,
  })
}

function search() {
  return screen.getByPlaceholderText(
    toolbar.searchPlaceholder
  ) as HTMLInputElement
}

function count(shown: number, total: number) {
  return toolbar.resultCount
    .replace("{shown}", String(shown))
    .replace("{total}", String(total))
}

describe("FamilyPage", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  it("shows the toolbar over the family's own roles", async () => {
    useQueryMock.mockImplementation(loaded())
    await renderPage()
    expect(trackFilter().textContent).toContain(toolbar.trackAll)
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    expect(screen.getByText("Engineering Manager")).toBeDefined()
    // A role from another family stays out, and the counter is hidden while
    // nothing narrows the table.
    expect(screen.queryByText("Account Executive")).toBeNull()
    expect(screen.queryByText(count(2, 2))).toBeNull()
  })

  it("narrows the table by search and shows the counter", async () => {
    useQueryMock.mockImplementation(loaded())
    await renderPage()
    fireEvent.change(search(), { target: { value: "platform" } })
    // The shared matcher covers team, not just the title.
    expect(screen.getByText("Engineering Manager")).toBeDefined()
    expect(screen.queryByText("Senior Engineer")).toBeNull()
    expect(screen.getByText(count(1, 2))).toBeDefined()
  })

  it("narrows the table by track", async () => {
    useQueryMock.mockImplementation(loaded())
    await renderPage()
    await pickSelectOption(trackFilter(), "Manager")
    expect(screen.getByText("Engineering Manager")).toBeDefined()
    expect(screen.queryByText("Senior Engineer")).toBeNull()
    expect(screen.getByText(count(1, 2))).toBeDefined()
  })

  it("offers a way back from a zero-match search", async () => {
    useQueryMock.mockImplementation(loaded())
    await renderPage()
    fireEvent.change(search(), { target: { value: "no such role" } })
    expect(screen.getByText(toolbar.noMatches)).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: toolbar.clearFilters }))
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    expect(search().value).toBe("")
  })

  it("carries a query typed during loading into the loaded table", async () => {
    useQueryMock.mockImplementation(() => undefined)
    const { rerender } = await renderPage()
    fireEvent.change(search(), { target: { value: "platform" } })
    useQueryMock.mockImplementation(loaded())
    rerender(page())
    expect(search().value).toBe("platform")
    expect(screen.getByText("Engineering Manager")).toBeDefined()
    expect(screen.queryByText("Senior Engineer")).toBeNull()
  })

  it("drops the filters when another family opens on the same route", async () => {
    useQueryMock.mockImplementation(loaded())
    const { rerender } = await renderPage()
    fireEvent.change(search(), { target: { value: "platform" } })
    expect(search().value).toBe("platform")

    // Sibling families share this route and this component instance, so a
    // carried-over filter would open the new family already narrowed. The new
    // params promise suspends, so the act scope has to cover the rerender.
    await act(async () => {
      rerender(page(OTHER_PARAMS))
    })
    expect(search().value).toBe("")
    expect(screen.getByText("Account Executive")).toBeDefined()
  })

  it("keeps the no-roles empty state without a toolbar", async () => {
    useQueryMock.mockImplementation(loaded([]))
    await renderPage()
    expect(
      screen.getByText(messages.dashboard.roles.family.rolesEmpty)
    ).toBeDefined()
    expect(screen.queryByPlaceholderText(toolbar.searchPlaceholder)).toBeNull()
  })
})
