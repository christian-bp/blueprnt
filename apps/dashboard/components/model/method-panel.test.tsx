import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { criteriaLibraryContent } from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: orgRole }),
}))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { CHAPTER_GRID_CLASS } from "@/components/model/chapter-grid"
import { MethodPanel } from "@/components/model/method-panel"
import { onQuery } from "@/test/convex-mocks"

// The library's own content, read the way the panel reads it: the dimension
// names the columns are titled by and each criterion's one-liner are library
// constants, so the test asserts the panel shows THEM rather than repeating
// their wording and failing on a copy edit.
const library = criteriaLibraryContent("en")

// Three criteria across two dimensions, so the grouping has something to get
// wrong and two of the four dimensions hold nothing at all.
const METHOD_MODEL = {
  modelName: "Standard model",
  pointBudget: 27,
  criteria: [
    {
      criterionId: "c1",
      libraryKey: "knowledge-depth",
      dimensionKey: "competence",
      name: "Scope",
      description: "What the criterion covers, at length.",
      weightPoints: 3,
      share: 33,
      order: 1,
      purpose: null,
      whyRelevant: null,
      overlapNotes: null,
      biasRisk: null,
      biasComment: null,
      biasAction: null,
      status: "notStarted",
      decidedByName: null,
      decidedAt: null,
    },
    {
      criterionId: "c2",
      libraryKey: "knowledge-breadth",
      dimensionKey: "competence",
      name: "Risk",
      description: "What the second criterion covers, at length.",
      weightPoints: 3,
      share: 33,
      order: 2,
      purpose: "p",
      whyRelevant: "w",
      overlapNotes: null,
      biasRisk: "low",
      biasComment: "b",
      biasAction: null,
      status: "approved",
      decidedByName: "Alex",
      decidedAt: 1,
    },
    {
      criterionId: "c3",
      libraryKey: "scope-impact",
      dimensionKey: "responsibility",
      name: "Impact",
      description: "What the third criterion covers, at length.",
      weightPoints: 3,
      share: 34,
      order: 3,
      purpose: "p",
      whyRelevant: "w",
      overlapNotes: null,
      biasRisk: "low",
      biasComment: "b",
      biasAction: null,
      status: "documented",
      decidedByName: null,
      decidedAt: null,
    },
  ],
  progress: { documented: 2, approved: 1, total: 3 },
  modelApproved: false,
}

// The engine's ten checks, as the chapter reads them: overlapPairs and the
// materiality decision are what this surface reads, so the rest stay green.
function methodChecks(
  pairs: string[][],
  decision: { status: "active" | "testedNotMaterial" } | null
) {
  return {
    checks: [
      {
        key: "overlapPairs",
        level: "warning",
        ok: pairs.length === 0,
        ...(pairs.length > 0 ? { pairs } : {}),
      },
    ],
    approval: null,
    lastApprovedAt: null,
    workingConditions:
      decision === null
        ? null
        : { ...decision, motivation: "m", decidedBy: "u1", decidedAt: 1 },
    dimensionShares: [],
  }
}

// The same model with its fourth dimension staffed: the dimension caps at one
// criterion, so this is the only shape the column's filled state has.
const STAFFED_MODEL = {
  ...METHOD_MODEL,
  criteria: [
    ...METHOD_MODEL.criteria,
    {
      ...METHOD_MODEL.criteria[0],
      criterionId: "c4",
      libraryKey: "safety-exposure",
      dimensionKey: "workingConditions",
      name: "Exposure",
      order: 4,
    },
  ],
}

// The same model with every competence criterion signed off, which is what
// fills a column's chip in.
const APPROVED_MODEL = {
  ...METHOD_MODEL,
  criteria: METHOD_MODEL.criteria.map((criterion) =>
    criterion.dimensionKey === "competence"
      ? { ...criterion, status: "approved" }
      : criterion
  ),
}

// The model as a brand-new org has it: a model exists, nothing is chosen for
// it yet. Reachable in the app, because choosing the criteria is the chapter
// before this one.
const EMPTY_MODEL = {
  ...METHOD_MODEL,
  criteria: [],
  progress: { documented: 0, approved: 0, total: 0 },
}

let overlapPairs: string[][] = []
let loading = false
let empty = false
// The recorded materiality decision, and whether the model holds a
// working-conditions criterion: the fourth column's two inputs.
let approvedAll = false
let materiality: { status: "active" | "testedNotMaterial" } | null = null
let checksLoading = false
let staffed = false

const m = messages.dashboard.model.method
const weighting = messages.dashboard.model.weighting
const criteria = messages.dashboard.model.criteria
const workingConditions = criteria.workingConditions

// The empty line's own words, with the link tag taken off: the message is one
// sentence with a link inside it, and the test asserts the sentence the reader
// sees rather than the markup around it.
const EMPTY_TEXT = m.empty.replace(/<\/?link>/g, "")
const EMPTY_LINK_TEXT = /<link>(.*)<\/link>/.exec(m.empty)?.[1] ?? ""

// The line itself, matched on the whole paragraph: the link inside it splits
// the sentence across elements, which the default text matcher does not join.
const emptyLine = () =>
  screen.queryByText(
    (_, node) => node?.tagName === "P" && node.textContent === EMPTY_TEXT
  )

function renderPanel(orgId = "org1") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MethodPanel orgId={orgId} />
    </NextIntlClientProvider>
  )
}

// The grid every column sits in, reached from a column rather than by class
// name, so the assertion fails when the grid is REPLACED and not merely
// restyled.
const gridOf = (container: HTMLElement) =>
  container.querySelector("section")?.parentElement

// A dimension column's own count chip, and the words it carries.
const chipIn = (name: string) =>
  screen
    .getByRole("heading", { name })
    .parentElement?.querySelector('[data-slot="badge"]')
const chipText = (approved: number, total: number) =>
  m.approved
    .replace("{approved}", String(approved))
    .replace("{total}", String(total))

// The column a dimension's name titles, with its cards inside it.
function column(name: string) {
  const heading = screen.getByRole("heading", { name })
  const section = heading.closest("section")
  if (section === null) throw new Error(`no column for ${name}`)
  return within(section)
}

describe("MethodPanel", () => {
  beforeEach(() => {
    orgRole = "admin"
    overlapPairs = []
    loading = false
    empty = false
    materiality = null
    checksLoading = false
    staffed = false
    approvedAll = false
    onQuery((ref) => {
      if (ref === "evaluationModel.method.getMethodModel") {
        if (loading) return undefined
        if (empty) return EMPTY_MODEL
        if (approvedAll) return APPROVED_MODEL
        return staffed ? STAFFED_MODEL : METHOD_MODEL
      }
      if (ref === "evaluationModel.approval.getMethodChecks") {
        return checksLoading
          ? undefined
          : methodChecks(overlapPairs, materiality)
      }
      return undefined
    })
  })
  afterEach(() => {
    cleanup()
  })

  // The progress that used to stand in a block of its own above the grid is in
  // the columns now, one count per dimension, where the criteria it counts
  // are. Nothing stands between the framing row and the grid.
  it("counts each dimension's approved criteria in its own heading chip", () => {
    renderPanel()
    // Competence holds two, one of them approved; responsibility holds one,
    // documented but not signed off.
    expect(chipIn(library.dimensions.competence.name)?.textContent).toBe(
      chipText(1, 2)
    )
    expect(chipIn(library.dimensions.responsibility.name)?.textContent).toBe(
      chipText(0, 1)
    )
  })

  // APPROVED, not merely documented: it is the count the spine's own method
  // segment moves on, so a chip cannot run ahead of the bar above it.
  it("counts approvals, not filled-in forms", () => {
    renderPanel()
    // c3 is "documented" and c2 "approved": a chip counting documentation
    // would read 1 of 1 on responsibility.
    expect(
      chipIn(library.dimensions.responsibility.name)?.textContent
    ).not.toBe(chipText(1, 1))
  })

  // A finished column fills its chip in, the way the Kriterier column's does
  // when its dimension is full: there is nothing left to ask for there.
  it("fills the chip in once every criterion in the dimension is approved", () => {
    renderPanel()
    expect(
      chipIn(library.dimensions.competence.name)?.getAttribute("data-slot")
    ).toBe("badge")
    cleanup()
    approvedAll = true
    renderPanel()
    const chip = chipIn(library.dimensions.competence.name)
    expect(chip?.textContent).toBe(chipText(2, 2))
    expect(chip?.className).toContain("bg-secondary")
  })

  // The aggregate block is gone: its counts said the same thing four column
  // chips now say, in a block that pushed this chapter's grid below the other
  // chapters' and made switching tabs a jump.
  it("stands no block between the chapter's top and its grid", () => {
    const { container } = renderPanel()
    const root = container.firstElementChild as HTMLElement
    // The action row is the TAB row now, mounted by the section shell above
    // this component, so the chapter itself opens straight onto its grid.
    expect(root.children[0]?.className).toContain("sm:grid-cols-2")
    expect(screen.queryByRole("status")).toBeNull()
  })

  // The same dimension columns the Kriterier and Viktning chapters draw, on the
  // same grid: a criterion stays where the reader last saw it across all three.
  it("groups the criteria into their dimension columns", () => {
    const { container } = renderPanel()
    expect(gridOf(container)?.className).toBe(CHAPTER_GRID_CLASS)
    expect(
      column(library.dimensions.competence.name).getByText("Scope")
    ).toBeDefined()
    expect(
      column(library.dimensions.competence.name).getByText("Risk")
    ).toBeDefined()
    expect(
      column(library.dimensions.responsibility.name).getByText("Impact")
    ).toBeDefined()
    // A criterion never appears under a dimension it does not belong to.
    expect(
      column(library.dimensions.competence.name).queryByText("Impact")
    ).toBeNull()
  })

  // Never a bare page: with nothing chosen there is nothing to document, and
  // the chapter says so with the way back rather than an empty grid.
  describe("with no criteria chosen yet", () => {
    beforeEach(() => {
      empty = true
    })

    it("says where to start, linking the chapter that starts it", () => {
      const { container } = renderPanel()
      expect(emptyLine()).not.toBeNull()
      const link = screen.getByRole("link", { name: EMPTY_LINK_TEXT })
      expect(link.getAttribute("href")).toBe("/model/criteria")
      // No grid, and no column standing empty in it.
      expect(container.querySelector("section")).toBeNull()
    })

    // The export still renders, from this chapter, even with nothing to
    // document: it lands in the tab row above via the action slot, so the
    // chapter itself shows only its empty line. No column chips, because
    // there are no columns.
    it("still offers its export, and no headings", () => {
      renderPanel()
      expect(screen.queryByRole("heading")).toBeNull()
      expect(emptyLine()).not.toBeNull()
    })
  })

  it("says nothing about starting once a criterion exists", () => {
    renderPanel()
    expect(emptyLine()).toBeNull()
    expect(screen.queryByRole("link", { name: EMPTY_LINK_TEXT })).toBeNull()
  })

  // Every chapter draws its dimensions in the one shared frame, so a tweak to
  // the box lands on all three at once.
  it("draws every column in the shared dimension frame", () => {
    const { container } = renderPanel()
    // Competence, responsibility, and the fourth column that never vanishes.
    expect(
      container.querySelectorAll('[data-slot="dimension-frame"]')
    ).toHaveLength(3)
  })

  // A dimension the model holds nothing in has nothing to document, so it
  // draws no column at all (choosing a criterion for it is Kriterier's job).
  // The fourth is the exception, and has its own describe below.
  it("draws no column for a dimension the model holds nothing in", () => {
    renderPanel()
    expect(
      screen.queryByRole("heading", { name: library.dimensions.effort.name })
    ).toBeNull()
  })

  // What the card carries, in full: the name, the library's one-liner, where
  // the documentation stands, and the way in. Nothing else.
  it("carries the name, the one-liner, the status and the action on a card", () => {
    renderPanel()
    const card = screen.getByText("Scope").closest("li")
    expect(card).not.toBeNull()
    const inCard = within(card as HTMLElement)
    expect(
      inCard.getByText(library.criteria["knowledge-depth"].shortUiText)
    ).toBeDefined()
    // Nobody has documented this one, and absence is that status: the footer
    // holds the action and nothing else.
    expect(inCard.getByRole("button", { name: m.openCta })).toBeDefined()
    expect(inCard.queryByRole("button", { name: m.editCta })).toBeNull()
  })

  // The two states that have something to say, said in the checklist's own
  // language; the third says nothing.
  it("shows each criterion's own documentation status", () => {
    renderPanel()
    expect(screen.getByText(m.status.approved)).toBeDefined()
    expect(screen.getByText(m.status.documented)).toBeDefined()
    // Two of the three carry a mark and a word, so two of the three offer to
    // change what is written rather than to write it.
    expect(screen.getAllByRole("button", { name: m.editCta })).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: m.openCta })).toHaveLength(1)
  })

  // The weighting is Viktning's lens, and a figure repeated on a chapter that
  // cannot change it is one allocation read twice.
  it("repeats no weight share, on the cards or the headings", () => {
    renderPanel()
    const shareText = weighting.shareOfWeight.replace("<share></share>", "")
    expect(screen.queryByText(new RegExp(shareText.trim()))).toBeNull()
    expect(screen.queryByText(/33%/)).toBeNull()
  })

  // Every criterion has a way in; what the way in is CALLED depends on whether
  // anything is written yet.
  it("offers the documentation action on every criterion for an admin", () => {
    renderPanel()
    expect([
      ...screen.getAllByRole("button", { name: m.openCta }),
      ...screen.getAllByRole("button", { name: m.editCta }),
    ]).toHaveLength(3)
  })

  // The long definition left the card for the dialog, which is where the
  // documentation is written: the card's action is what puts it on screen.
  it("opens the documentation dialog from a card, with the criterion's definition", () => {
    renderPanel()
    expect(screen.queryByRole("dialog")).toBeNull()
    const card = screen.getByText("Scope").closest("li") as HTMLElement
    fireEvent.click(within(card).getByRole("button", { name: m.openCta }))
    const dialog = within(screen.getByRole("dialog"))
    expect(dialog.getByText("Scope")).toBeDefined()
    expect(
      dialog.getByText(METHOD_MODEL.criteria[0]?.description as string)
    ).toBeDefined()
    expect(dialog.getByText(m.purpose)).toBeDefined()
  })

  // Documenting a criterion is member-level work: admin covers org
  // administration and the audit log, so an editor gets the same cards and the
  // same way in.
  it("gives an editor the documentation and its write", () => {
    orgRole = "editor"
    renderPanel()
    expect(screen.getByText("Scope")).toBeDefined()
    expect(screen.getByText("Risk")).toBeDefined()
    expect(screen.getByText(m.status.approved)).toBeDefined()
    expect(chipIn(library.dimensions.competence.name)?.textContent).toBe(
      chipText(1, 2)
    )
    expect(screen.getByRole("button", { name: m.openCta })).toBeDefined()
  })

  // The fourth dimension never vanishes: an empty competence column is a gap
  // on the way to being filled, while an empty working-conditions column can
  // be the finished answer, and only the column itself can say which.
  describe("the working-conditions column", () => {
    const wc = () => column(library.dimensions.workingConditions.name)
    const hatch = () => wc().queryByRole("img", { name: criteria.columnEmpty })
    const line = (key: keyof typeof workingConditions) =>
      workingConditions[key].replace(/<\/?link>/g, "")
    // The sentence as one paragraph: two of the three carry a link, which
    // splits them across elements, and the default matcher does not join those.
    const lineNode = (key: keyof typeof workingConditions) =>
      wc().queryByText(
        (_, node) => node?.tagName === "P" && node.textContent === line(key)
      )

    it("stands empty with the materiality test still to take", () => {
      materiality = null
      renderPanel()
      expect(lineNode("columnUndecided")).not.toBeNull()
      expect(
        wc()
          .getByRole("link", { name: /Criteria chapter/ })
          .getAttribute("href")
      ).toBe("/model/criteria")
      expect(hatch()).not.toBeNull()
    })

    it("stands empty, judged material, pointing at where its criterion is chosen", () => {
      materiality = { status: "active" }
      renderPanel()
      expect(lineNode("columnMaterial")).not.toBeNull()
      expect(wc().getByRole("link", { name: /Criteria chapter/ })).toBeDefined()
      expect(hatch()).not.toBeNull()
    })

    // A finished answer, so there is nowhere to be sent: the dimension is
    // settled and no criterion is coming.
    it("stands empty, tested and found not material, with nowhere to go", () => {
      materiality = { status: "testedNotMaterial" }
      renderPanel()
      expect(lineNode("columnNotMaterial")).not.toBeNull()
      expect(wc().queryByRole("link")).toBeNull()
      expect(hatch()).not.toBeNull()
    })

    // Which of the three sentences is true is precisely what the checks query
    // carries, so none of them is guessed before it lands.
    it("says nothing while the decision is still loading", () => {
      checksLoading = true
      renderPanel()
      for (const key of [
        "columnUndecided",
        "columnMaterial",
        "columnNotMaterial",
      ] as const) {
        expect(lineNode(key)).toBeNull()
      }
      expect(hatch()).not.toBeNull()
    })

    // Staffed, the column is every other column: its criterion's card, and no
    // explanation of an emptiness that is not there.
    it("draws its criterion's card, and no hatch, once one is chosen", () => {
      staffed = true
      materiality = { status: "active" }
      renderPanel()
      expect(wc().getByText("Exposure")).toBeDefined()
      expect(wc().getByRole("button", { name: m.openCta })).toBeDefined()
      expect(hatch()).toBeNull()
      expect(lineNode("columnMaterial")).toBeNull()
    })
  })

  // The Godkännande checklist can only say that SOME pair is unreviewed; the
  // note that clears it is written behind an individual criterion's Document
  // button, so the flag belongs on the card that can answer it.
  describe("unreviewed overlaps", () => {
    const flag = (names: string) => m.overlapFlag.replace("{names}", names)

    it("marks both members of an unacknowledged pair, naming the partner", () => {
      overlapPairs = [["knowledge-depth", "knowledge-breadth"]]
      renderPanel()
      // Each card names the OTHER criterion, never itself.
      const scope = screen.getByText("Scope").closest("li") as HTMLElement
      const risk = screen.getByText("Risk").closest("li") as HTMLElement
      expect(within(scope).getByText(flag("Risk"))).toBeDefined()
      expect(within(risk).getByText(flag("Scope"))).toBeDefined()
    })

    it("raises no flag once the engine reports the pair acknowledged", () => {
      overlapPairs = []
      renderPanel()
      expect(screen.queryByText(flag("Risk"))).toBeNull()
      expect(screen.queryByText(flag("Scope"))).toBeNull()
      // The cards are otherwise untouched by the flag being absent.
      expect([
        ...screen.getAllByRole("button", { name: m.openCta }),
        ...screen.getAllByRole("button", { name: m.editCta }),
      ]).toHaveLength(3)
    })

    // A pair whose partner is not in the model cannot be named, so it is not
    // flagged either: the engine only reports pairs whose BOTH members are
    // selected, and a half-known pair would render "Overlap with  not noted".
    it("names no partner the model does not hold", () => {
      overlapPairs = [["knowledge-depth", "domain-knowledge"]]
      renderPanel()
      expect(screen.queryByText(/Overlap with/)).toBeNull()
    })
  })

  // The loading state is the same chapter with its data missing: the columns
  // are the four dimensions (fixed method law, their names locale-keyed
  // library constants), on the same grid, with placeholder cards inside.
  describe("while the model loads", () => {
    beforeEach(() => {
      loading = true
    })

    it("draws the real dimension headings on the same grid", () => {
      const { container } = renderPanel()
      expect(gridOf(container)?.className).toBe(CHAPTER_GRID_CLASS)
      // Four framed columns, the same box the loaded chapter draws.
      expect(
        container.querySelectorAll('[data-slot="dimension-frame"]')
      ).toHaveLength(4)
      for (const dimension of Object.values(library.dimensions)) {
        expect(
          screen.getByRole("heading", { name: dimension.name })
        ).toBeDefined()
      }
    })

    it("stands placeholder cards in the columns, with the real action", () => {
      const { container } = renderPanel()
      // Two per column, for the three dimensions whose staffed shape is the
      // near-certain one. The fourth waits as a neutral bar instead (below).
      const cards = container.querySelectorAll("ul li")
      expect(cards).toHaveLength(6)
      // The action's label is static i18n text, so it renders as itself
      // (muted and inert) rather than as a gray bar. The placeholder is out of
      // the accessibility tree and out of the tab order, so the inert copy is
      // never offered to anyone: queried by text for exactly that reason.
      const actions = screen.getAllByText(m.openCta)
      expect(actions).toHaveLength(6)
      expect(actions[0]?.getAttribute("tabindex")).toBe("-1")
      expect(cards[0]?.getAttribute("aria-hidden")).toBe("true")
    })

    // The fourth dimension resolves as readily to a sentence over a hatch as
    // to a card (many organizations test it and find it not material), so its
    // loading shape guesses neither: a text-line bar that either outcome fills
    // in, rather than a card that would have to become a paragraph.
    it("waits for the fourth dimension with a neutral bar, not a card", () => {
      const { container } = renderPanel()
      const wc = screen
        .getByRole("heading", {
          name: library.dimensions.workingConditions.name,
        })
        .closest("section") as HTMLElement
      expect(wc.querySelector("li")).toBeNull()
      expect(within(wc).queryByRole("img")).toBeNull()
      expect(within(wc).queryByText(m.openCta)).toBeNull()
      expect(
        wc.querySelectorAll('[data-slot="skeleton"]').length
      ).toBeGreaterThan(0)
      // The other three still stand their card placeholders up.
      expect(container.querySelectorAll("ul li")).toHaveLength(6)
    })

    it("offers an editor no action, loading or loaded", () => {
      orgRole = "editor"
      renderPanel()
      expect(screen.queryByRole("button", { name: m.openCta })).toBeNull()
    })

    // The chip's placeholder holds the Badge's own box, so the heading row
    // does not resize when the count lands. Pinned by comparing the two
    // rendered boxes rather than by matching the Badge's classes from
    // memory, the same way the card's placeholder is pinned to the Item.
    it("stands the count chip's own box while the count loads", () => {
      const { container } = renderPanel()
      // Scoped to a column's own heading ROW, not to the first pill-shaped
      // bar on the page: the card placeholders below carry a status pill of
      // their own, and a loose query would compare the wrong one.
      const headingRow = container.querySelector(
        '[data-slot="dimension-frame"]'
      )?.firstElementChild as HTMLElement
      const chip = headingRow.querySelector(
        '[data-slot="skeleton"]'
      ) as HTMLElement
      expect(chip).not.toBeNull()
      cleanup()

      loading = false
      renderPanel()
      const badge = chipIn(library.dimensions.competence.name) as HTMLElement
      const box = (node: HTMLElement) =>
        node.className
          .split(/\s+/)
          .filter((token) => /^(h-\d+|rounded-\w+|shrink-0)$/.test(token))
          .sort()
      expect(box(chip)).toEqual(box(badge))
    })

    // The placeholder's BOX is the loaded card's box: the same design-system
    // Item, in the same variant and size, so the two states cannot measure
    // differently. A placeholder that copied those classes by hand would drift
    // the first time the card's own box changed.
    it("builds the placeholder from the same Item the loaded card is", () => {
      const { container } = renderPanel()
      const placeholder = container.querySelector('[data-slot="item"]')
      expect(placeholder?.tagName).toBe("LI")
      expect(placeholder?.getAttribute("data-variant")).toBe("outline")
      expect(placeholder?.getAttribute("data-size")).toBe("default")
      expect(
        placeholder?.querySelector('[data-slot="item-footer"]')
      ).not.toBeNull()

      cleanup()
      loading = false
      const { container: loaded } = renderPanel()
      const card = loaded.querySelector('[data-slot="item"]')
      expect(card?.className).toBe(placeholder?.className)
    })
  })
})
