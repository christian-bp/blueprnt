import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import daMessages from "@workspace/i18n/messages/da.json"
import messages from "@workspace/i18n/messages/en.json"
import fiMessages from "@workspace/i18n/messages/fi.json"
import nbMessages from "@workspace/i18n/messages/nb.json"
import svMessages from "@workspace/i18n/messages/sv.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

// Every configured locale, so the null-side copy is checked as rendered words
// rather than as a message-file value.
type ContentLocale = "en" | "sv" | "nb" | "da" | "fi"

const localeMessages: Record<ContentLocale, typeof messages> = {
  en: messages,
  sv: svMessages,
  nb: nbMessages,
  da: daMessages,
  fi: fiMessages,
}

type Analysis = {
  comparable: boolean
  moved: number
  losing: number
  gaining: number
  placed: number
  criteriaAdded: number
  criteriaRemoved: number
  distribution: { zone: string; now: number; approved: number }[]
  movers: {
    roleId: string
    title: string
    slug: string
    from: number | null
    to: number | null
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
  losing: 0,
  gaining: 0,
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
  losing: 0,
  gaining: 0,
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

// Re-claimed per test, not once at module scope: onQuery installs ONE module
// singleton, so whichever test file imports last owns it for every file in the
// worker. Registering here makes this file's handler the live one whenever its
// own tests run.
function install() {
  onQuery((ref) =>
    ref === "evaluationModel.consequence.getConsequenceAnalysis"
      ? analysis
      : undefined
  )
}

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ConsequencePanel orgId="org-1" />
    </NextIntlClientProvider>
  )
}

// The three group breakdowns ship COLLAPSED (they are evidence for a decision
// the sentences above already answer), so a test about their content opens
// them first. Opening every section rather than naming one keeps each test
// about what it asserts instead of about which accordion holds it.
const GROUP_HEADINGS = [m.moversHeading, m.familiesHeading, m.gendersHeading]

function groupTriggers() {
  // By NAME, not by aria-expanded: the help popover on the card title carries
  // aria-expanded too, and a blanket sweep opened it as a fourth "section".
  return GROUP_HEADINGS.flatMap((heading) =>
    screen.queryAllByRole("button", { name: new RegExp(heading) })
  )
}

// ONE at a time, because the accordion is single-open by default and that is
// deliberate: opening "By gender" closes "Roles that would move", so the card
// can never grow back into the five-section report this change removed.
function openGroup(heading: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(heading) }))
}

describe("ConsequencePanel", () => {
  beforeEach(() => install())
  afterEach(() => cleanup())

  // The density rule this panel was corrected for: it lands directly above the
  // twelve-check approval gate, and shipping five sections open made a report
  // out of a one-decision moment. The summary and the zone table stay standing
  // because they ARE the decision; the rest is opt-in.
  // SINGLE-open, and load-bearing: it is what stops the card growing back
  // into the five-section report above the Approve button. It holds only
  // because Base UI's accordion `multiple` defaults to false, which is a
  // vendor default a dependency bump could change under us, so the choice is
  // asserted rather than assumed.
  it("closes the open breakdown when another is opened", () => {
    analysis = MOVED
    renderPanel()
    openGroup(m.moversHeading)
    expect(screen.getByText("Head of Data")).toBeDefined()
    openGroup(m.familiesHeading)
    expect(screen.getByText("Engineering")).toBeDefined()
    expect(screen.queryByText("Head of Data")).toBeNull()
  })

  it("keeps the group breakdowns closed until asked", () => {
    analysis = MOVED
    renderPanel()
    expect(screen.queryByText("Engineering")).toBeNull()
    const triggers = groupTriggers()
    expect(triggers.length).toBe(GROUP_HEADINGS.length)
    for (const trigger of triggers) {
      expect(trigger.getAttribute("aria-expanded")).toBe("false")
    }
  })

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

  it("says how many placements would move, out of how many", () => {
    analysis = MOVED
    const { container } = renderPanel()
    // Rendered text, not a hand-substituted template: these messages carry ICU
    // plurals now, and a `.replace()` on the raw source would assert against a
    // string the app never shows.
    expect(container.textContent).toContain("2 of 9 completed placements")
  })

  // Why they move at all: a changed criteria set is a different kind of change
  // from a reweighting, and the reader should not have to infer it.
  it("says when the criteria set itself changed", () => {
    analysis = MOVED
    const { container } = renderPanel()
    // Agreement, not "1 criteria added": the commonest case is exactly one.
    expect(container.textContent).toContain("1 criterion added")
    expect(container.textContent).toContain("none removed")
  })

  it("stays quiet about the criteria when only the weights moved", () => {
    analysis = { ...MOVED, criteriaAdded: 0, criteriaRemoved: 0 }
    const { container } = renderPanel()
    expect(container.textContent).not.toContain("no criteria added")
  })

  it("shows both sides of the zone distribution", () => {
    analysis = MOVED
    renderPanel()
    const row = screen
      .getByText((text) =>
        text.startsWith(
          `${messages.dashboard.levels.zoneLabel.replace("{zone}", "A")}:`
        )
      )
      .closest("tr") as HTMLElement
    // As approved, then after approval.
    expect(row.textContent).toContain("1")
    expect(row.textContent).toContain("2")
  })

  it("names every mover with both levels and a link to the role", () => {
    analysis = MOVED
    renderPanel()
    openGroup(m.moversHeading)
    const link = screen.getByRole("link", { name: "Head of Data" })
    expect(link.getAttribute("href")).toBe("/roles/head-of-data")
    expect(
      screen.getByText(
        m.moverChange.replace("{from}", "5").replace("{to}", "3")
      )
    ).toBeDefined()
  })

  // THE CRITICAL CASE. Approving a method that added a criterion leaves every
  // already-completed role unrated on it, so the engine returns no level and the
  // role falls off the ladder. The panel used to gate its silence on `moved`
  // alone and therefore said nothing at all about the largest consequence
  // there is.
  it("speaks when a role would lose its level, even though nothing moves", () => {
    analysis = {
      ...MOVED,
      moved: 1,
      losing: 1,
      gaining: 0,
      criteriaAdded: 1,
      movers: [
        { roleId: "r9", title: "Nurse", slug: "nurse", from: 6, to: null },
      ],
    }
    const { container } = renderPanel()
    openGroup(m.moversHeading)
    expect(container.textContent).toContain("1 role would lose its level")
    // And the mover says so in words rather than showing a level it no longer
    // has.
    expect(screen.getByText(m.moverLoses.replace("{from}", "6"))).toBeDefined()
    // THE CONTRADICTION THIS CLOSES: a losing role is a mover, so counting it
    // in the summary too made one role carry two opposite claims, and a
    // pure-losing analysis asserted that N placements move to another level
    // when zero do. The summary is silent here because nothing moves BETWEEN
    // levels.
    expect(container.textContent).not.toContain("would move to another level")
  })

  it("counts only between-level moves in the summary when both happen", () => {
    analysis = {
      ...MOVED,
      placed: 9,
      moved: 3,
      losing: 1,
      gaining: 1,
      movers: [
        { roleId: "a", title: "Shifts", slug: "shifts", from: 5, to: 3 },
        { roleId: "b", title: "Falls", slug: "falls", from: 6, to: null },
        { roleId: "c", title: "Joins", slug: "joins", from: null, to: 4 },
      ],
    }
    const { container } = renderPanel()
    // Three movers, but only ONE of them moves between levels.
    expect(container.textContent).toContain(
      "1 of 9 completed placements would move to another level"
    )
    expect(container.textContent).toContain("1 role would lose its level")
    expect(container.textContent).toContain("1 role would gain a level")
  })

  // A group whose roles all left or joined the ladder moved in no direction,
  // and "(0 up, 0 down)" beside "1 of 3 moves" reads as a contradiction.
  it("drops the direction parenthetical when there is no direction", () => {
    analysis = {
      ...MOVED,
      moved: 1,
      losing: 1,
      movers: [
        { roleId: "b", title: "Falls", slug: "falls", from: 6, to: null },
      ],
      families: [
        { key: "f1", label: "Engineering", moved: 1, up: 0, down: 0, total: 3 },
      ],
      genders: [],
    }
    const { container } = renderPanel()
    openGroup(m.familiesHeading)
    expect(container.textContent).toContain("1 of 3 moves")
    expect(container.textContent).not.toContain("0 up")
    expect(container.textContent).not.toContain("0 down")
  })

  it("keeps the direction parenthetical when roles really move up or down", () => {
    analysis = {
      ...MOVED,
      families: [
        { key: "f1", label: "Engineering", moved: 2, up: 1, down: 1, total: 5 },
      ],
      genders: [],
    }
    const { container } = renderPanel()
    openGroup(m.familiesHeading)
    expect(container.textContent).toContain("1 up")
    expect(container.textContent).toContain("1 down")
  })

  it("speaks when a role would gain a level it could not reach", () => {
    analysis = {
      ...MOVED,
      moved: 1,
      losing: 0,
      gaining: 1,
      movers: [
        { roleId: "r9", title: "Nurse", slug: "nurse", from: null, to: 4 },
      ],
    }
    const { container } = renderPanel()
    openGroup(m.moversHeading)
    expect(container.textContent).toContain("1 role would gain a level")
    expect(screen.getByText(m.moverGains.replace("{to}", "4"))).toBeDefined()
  })

  // A losing role IS a mover with a null side, so `moved` already counts it;
  // this is the one state where nothing at all would change. Comparable, so
  // only the movement guard can silence it.
  it("stays silent only when nothing changes on either side", () => {
    analysis = { ...MOVED, moved: 0, losing: 0, gaining: 0, movers: [] }
    const { container } = renderPanel()
    expect(container.textContent).toBe("")
  })

  // The list is capped; the COUNT is not, because how many roles move is what
  // the approver is deciding on.
  it("says how many movers the list does not show", () => {
    analysis = { ...MOVED, moved: 14 }
    renderPanel()
    openGroup(m.moversHeading)
    expect(
      screen.getByText(m.moreMovers.replace("{count}", "12"))
    ).toBeDefined()
  })

  it("shows only the groups where something moves", () => {
    analysis = MOVED
    renderPanel()
    openGroup(m.familiesHeading)
    expect(screen.getByText("Engineering")).toBeDefined()
    // The family with nothing moving says nothing.
    expect(screen.queryByText(m.noFamily)).toBeNull()
  })

  // The null side is the one place these locales can go wrong grammatically:
  // nivå/niveau are NEUTER, so an elliptical "til ingen" reads "to nobody" on a
  // screen about roles and people, and a Finnish negative pronoun with no
  // negative verb is not a well-formed phrase. Rendered per locale rather than
  // asserted against the message file, so a regression shows as the words a
  // reader would actually see.
  it.each([
    ["nb", "Fra nivå 6 til uten nivå", "Uten nivå til nivå 4"],
    ["da", "Fra niveau 6 til uden niveau", "Uden niveau til niveau 4"],
    ["fi", "Vaativuustasolta 6 ei tasoa", "Ei tasoa vaativuustasolle 4"],
    ["sv", "Från nivå 6 till ingen nivå", "Ingen nivå till nivå 4"],
    ["en", "From level 6 to no level", "No level to level 4"],
  ] as [ContentLocale, string, string][])(
    "says the null side grammatically in %s",
    (locale, loses, gains) => {
      analysis = {
        ...MOVED,
        moved: 2,
        losing: 1,
        gaining: 1,
        movers: [
          { roleId: "b", title: "Falls", slug: "falls", from: 6, to: null },
          { roleId: "c", title: "Joins", slug: "joins", from: null, to: 4 },
        ],
      }
      const { container } = render(
        <NextIntlClientProvider
          locale={locale}
          messages={localeMessages[locale]}
        >
          <ConsequencePanel orgId="org-1" />
        </NextIntlClientProvider>
      )
      // The movers list is behind its disclosure, named in the locale under
      // test rather than in English.
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(
            localeMessages[locale].dashboard.model.consequence.moversHeading
          ),
        })
      )
      expect(container.textContent).toContain(loses)
      expect(container.textContent).toContain(gains)
      // And never the reading these corrections exist to remove.
      expect(container.textContent).not.toContain("til ingen")
      expect(container.textContent).not.toContain("ei millekään")
    }
  )

  it("names the gender classes in the app's own words, never a person", () => {
    analysis = MOVED
    renderPanel()
    openGroup(m.gendersHeading)
    expect(screen.getByText(m.genderWomen)).toBeDefined()
    expect(screen.getByText(m.genderUnstaffed)).toBeDefined()
    // Counts only, no MARK: the gender-mark law governs marks, and drawing one
    // here would pull hue, shape and a legend into a column of integers. The
    // ROWS are checked rather than the whole section: the section is a
    // disclosure now, and its trigger carries the accordion chevron, which is
    // chrome rather than a mark.
    const rows = screen.getByText(m.genderWomen).closest("ul") as HTMLElement
    expect(rows.querySelector("svg")).toBeNull()
    expect(rows.className).not.toContain("gender-")
  })
})
