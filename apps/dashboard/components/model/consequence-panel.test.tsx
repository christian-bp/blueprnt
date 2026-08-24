import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock("@workspace/backend/convex/_generated/api", async () => ({
  ...(await import("@/test/convex-mocks")).apiModule,
  // The zone-content import chain reaches the audit aggregates' component
  // handles. They are never called here; the shape only has to exist.
  components: {},
}))

import { ConsequencePanel } from "@/components/model/consequence-panel"
import { onQuery } from "@/test/convex-mocks"

const m = messages.dashboard.model.consequence

type Analysis = {
  comparable: boolean
  moved: number
  placed: number
  criteriaAdded: number
  criteriaRemoved: number
  distribution: { zone: string; now: number; approved: number }[]
  movers: {
    roleId: string
    title: string
    slug: string
    from: number
    to: number
  }[]
  families: {
    key: string
    label: string | null
    moved: number
    up: number
    down: number
    total: number
  }[]
  genders: {
    key: string
    label: string | null
    moved: number
    up: number
    down: number
    total: number
  }[]
}

// Deliberately NOT all-zero: a fixture that is silent on every count cannot
// tell the no-buffer guard from the nothing-moved guard, and each is a
// separate reason for the panel to say nothing.
const SILENT: Analysis = {
  comparable: false,
  moved: 3,
  placed: 0,
  criteriaAdded: 0,
  criteriaRemoved: 0,
  distribution: [],
  movers: [],
  families: [],
  genders: [],
}

const MOVED: Analysis = {
  comparable: true,
  moved: 2,
  placed: 9,
  criteriaAdded: 1,
  criteriaRemoved: 0,
  distribution: [
    { zone: "A", now: 2, approved: 1 },
    { zone: "B", now: 3, approved: 4 },
    { zone: "C", now: 2, approved: 2 },
    { zone: "D", now: 2, approved: 2 },
  ],
  movers: [
    {
      roleId: "r1",
      title: "Head of Data",
      slug: "head-of-data",
      from: 5,
      to: 3,
    },
    { roleId: "r2", title: "Analyst", slug: "analyst", from: 7, to: 8 },
  ],
  families: [
    { key: "f1", label: "Engineering", moved: 2, up: 1, down: 1, total: 5 },
    { key: "", label: null, moved: 0, up: 0, down: 0, total: 4 },
  ],
  genders: [
    { key: "women", label: null, moved: 1, up: 0, down: 1, total: 3 },
    { key: "unstaffed", label: null, moved: 1, up: 1, down: 0, total: 6 },
  ],
}

let analysis: Analysis | undefined = MOVED
onQuery((ref) =>
  ref === "evaluationModel.consequence.getConsequenceAnalysis"
    ? analysis
    : undefined
)

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ConsequencePanel orgId="org-1" />
    </NextIntlClientProvider>
  )
}

describe("ConsequencePanel", () => {
  afterEach(() => cleanup())

  // The silence rule. A panel that appeared on every visit to say "no change"
  // would be standing framing prose, and it would train the reader to skip the
  // one visit where it matters.
  it("renders nothing while the analysis is loading", () => {
    analysis = undefined
    const { container } = renderPanel()
    expect(container.textContent).toBe("")
  })

  it("renders nothing when there is no approval to compare against", () => {
    // Movement on the wire, but nothing to compare it against.
    analysis = SILENT
    const { container } = renderPanel()
    expect(container.textContent).toBe("")
  })

  it("renders nothing when approving would move nothing", () => {
    // Comparable, so only the movement guard can silence it.
    analysis = { ...MOVED, moved: 0, movers: [] }
    const { container } = renderPanel()
    expect(container.textContent).toBe("")
  })

  it("says how many placements would move, out of how many", () => {
    analysis = MOVED
    renderPanel()
    expect(
      screen.getByText(
        m.summary.replace("{moved}", "2").replace("{placed}", "9")
      )
    ).toBeDefined()
  })

  // Why they move at all: a changed criteria set is a different kind of change
  // from a reweighting, and the reader should not have to infer it.
  it("says when the criteria set itself changed", () => {
    analysis = MOVED
    renderPanel()
    expect(
      screen.getByText(
        m.criteriaChanged.replace("{added}", "1").replace("{removed}", "0")
      )
    ).toBeDefined()
  })

  it("stays quiet about the criteria when only the weights moved", () => {
    analysis = { ...MOVED, criteriaAdded: 0, criteriaRemoved: 0 }
    renderPanel()
    expect(
      screen.queryByText(
        m.criteriaChanged.replace("{added}", "0").replace("{removed}", "0")
      )
    ).toBeNull()
  })

  it("shows both sides of the zone distribution", () => {
    analysis = MOVED
    renderPanel()
    const row = screen
      .getByText((text) => text.startsWith("A."))
      .closest("tr") as HTMLElement
    // As approved, then after approval.
    expect(row.textContent).toContain("1")
    expect(row.textContent).toContain("2")
  })

  it("names every mover with both levels and a link to the role", () => {
    analysis = MOVED
    renderPanel()
    const link = screen.getByRole("link", { name: "Head of Data" })
    expect(link.getAttribute("href")).toBe("/roles/head-of-data")
    expect(
      screen.getByText(
        m.moverChange.replace("{from}", "5").replace("{to}", "3")
      )
    ).toBeDefined()
  })

  // The list is capped; the COUNT is not, because how many roles move is what
  // the approver is deciding on.
  it("says how many movers the list does not show", () => {
    analysis = { ...MOVED, moved: 14 }
    renderPanel()
    expect(
      screen.getByText(m.moreMovers.replace("{count}", "12"))
    ).toBeDefined()
  })

  it("shows only the groups where something moves", () => {
    analysis = MOVED
    renderPanel()
    expect(screen.getByText("Engineering")).toBeDefined()
    // The family with nothing moving says nothing.
    expect(screen.queryByText(m.noFamily)).toBeNull()
  })

  it("names the gender classes in the app's own words, never a person", () => {
    analysis = MOVED
    renderPanel()
    expect(screen.getByText(m.genderWomen)).toBeDefined()
    expect(screen.getByText(m.genderUnstaffed)).toBeDefined()
    // Counts only, no MARK: the gender-mark law governs marks, and drawing one
    // here would pull hue, shape and a legend into a column of integers. The
    // section is checked rather than the whole card, which carries the title's
    // help icon.
    const section = screen
      .getByText(m.gendersHeading)
      .closest("section") as HTMLElement
    expect(section.querySelector("svg")).toBeNull()
    expect(section.className).not.toContain("gender-")
  })
})
