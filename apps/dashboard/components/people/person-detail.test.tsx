import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org_1", name: "Acme", role: "admin" }),
}))
vi.mock("@/hooks/use-page-title", () => ({ usePageTitle: () => {} }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }))
// Links: mock next/link with a plain <a> so href is inspectable.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

import { PersonDetail } from "./person-detail"

// Fixtures
const PERSON = {
  personId: "p1",
  publicId: "pub-p1",
  displayName: "Alex Doe",
  gender: "Kvinna",
  externalRef: "E-1",
  birthDate: null,
  employmentStartDate: "2021-01-01",
  ftePercent: 100,
  country: "SE",
  isManager: false,
  statisticalCode: null,
  department: "Engineering",
  archivedAt: null,
}

const ASSIGNMENT = {
  assignmentId: "a1",
  personId: "p1",
  roleId: "r1",
  level: "IC3",
  levelSource: "confirmed",
  effectiveAt: 1000,
  endedAt: null,
}

const SALARY = [
  {
    payRecordId: "pr1",
    personId: "p1",
    payYear: 2026,
    source: "manual",
    basicMonthly: 50000,
    currency: "SEK",
    components: [],
    totalMonthlyComp: 50000,
    effectiveAt: 1000,
    createdAt: 1000,
  },
]

const ROLES = [
  {
    roleId: "r1",
    title: "Engineer",
    slug: "engineer",
    trackKey: "IC",
    trackName: "IC",
  },
]

const m = messages.dashboard.people.detail

// Route queries by the stringified function ref path, exactly as the proxy in
// convex-mocks.ts stringifies api.people.people.getPersonByPublicId to
// "people.people.getPersonByPublicId". This is the same robust pattern used in
// people-section.test.tsx: no call-order counters, no render-phase side effects.
function queryRouter(ref: string): unknown {
  if (ref === "people.people.getPersonByPublicId") return PERSON
  if (ref === "people.assignments.getCurrentAssignment") return ASSIGNMENT
  if (ref === "people.pay.getSalaryHistory") return SALARY
  if (ref === "assessment.roles.listRoles") return ROLES
  return undefined
}

function renderDetail() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PersonDetail publicId="pub-p1" />
    </NextIntlClientProvider>
  )
}

describe("PersonDetail", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders identity, current level, role title, and salary history", () => {
    onQuery((ref) => queryRouter(ref))
    renderDetail()
    // Person name appears at least once (in the page header title and/or breadcrumb)
    expect(screen.getAllByText("Alex Doe").length).toBeGreaterThanOrEqual(1)
    // Classification block: level badge
    expect(screen.getByText("IC3")).toBeDefined()
    // Classification block: role title resolved from listRoles
    expect(screen.getByText("Engineer")).toBeDefined()
    // Salary history: basicMonthly and totalMonthlyComp both render (both are 50000 in fixture)
    expect(screen.getAllByText("50000").length).toBeGreaterThanOrEqual(1)
  })

  it("shows the loading skeleton when the person is still resolving", () => {
    onQuery((ref) => {
      if (ref === "people.people.getPersonByPublicId") return undefined
      return queryRouter(ref)
    })
    renderDetail()
    // In loading state, person name is absent
    expect(screen.queryByText("Alex Doe")).toBeNull()
  })

  it("shows not-found state when the publicId resolves to nothing", () => {
    onQuery((ref) => {
      if (ref === "people.people.getPersonByPublicId") return null
      // salary must also be defined to pass the undefined loading gate
      if (ref === "people.pay.getSalaryHistory") return []
      return queryRouter(ref)
    })
    renderDetail()
    expect(screen.getByText(m.notFound)).toBeDefined()
    // Back link renders
    const backLink = screen.getByRole("link", { name: m.backToPeople })
    expect((backLink as HTMLAnchorElement).href).toContain("/people")
  })

  it("shows no-assignment message when getCurrentAssignment is null", () => {
    onQuery((ref) => {
      if (ref === "people.assignments.getCurrentAssignment") return null
      return queryRouter(ref)
    })
    renderDetail()
    expect(screen.getByText(m.noAssignment)).toBeDefined()
  })

  it("shows salary-empty message when getSalaryHistory returns []", () => {
    onQuery((ref) => {
      if (ref === "people.pay.getSalaryHistory") return []
      return queryRouter(ref)
    })
    renderDetail()
    expect(screen.getByText(m.salaryEmpty)).toBeDefined()
  })
})
