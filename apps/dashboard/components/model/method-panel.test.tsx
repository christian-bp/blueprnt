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
  levelRules: [],
  progress: { documented: 2, approved: 1, total: 3 },
  modelApproved: false,
}

// The engine's twelve checks, as the chapter reads them: only overlapPairs
// matters to this surface, so the rest stay green.
function methodChecks(pairs: string[][]) {
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
    workingConditions: null,
    dimensionShares: [],
  }
}

let overlapPairs: string[][] = []
let loading = false

const m = messages.dashboard.model.method
const weighting = messages.dashboard.model.weighting

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
    onQuery((ref) => {
      if (ref === "evaluationModel.method.getMethodModel") {
        return loading ? undefined : METHOD_MODEL
      }
      if (ref === "evaluationModel.approval.getMethodChecks") {
        return methodChecks(overlapPairs)
      }
      return undefined
    })
  })
  afterEach(() => {
    cleanup()
  })

  it("shows the documentation progress", () => {
    renderPanel()
    expect(screen.getByText(/2\/3 documented/)).toBeDefined()
    expect(screen.getByText(/1\/3 approved/)).toBeDefined()
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

  // A dimension the model holds nothing in has nothing to document, so it
  // draws no column at all (choosing a criterion for it is Kriterier's job).
  it("draws no column for a dimension the model holds nothing in", () => {
    renderPanel()
    expect(
      screen.queryByRole("heading", { name: library.dimensions.effort.name })
    ).toBeNull()
    expect(
      screen.queryByRole("heading", {
        name: library.dimensions.workingConditions.name,
      })
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
    expect(inCard.getByText(m.status.notStarted)).toBeDefined()
    expect(inCard.getByRole("button", { name: m.openCta })).toBeDefined()
  })

  it("shows each criterion's own documentation status", () => {
    renderPanel()
    expect(screen.getByText(m.status.notStarted)).toBeDefined()
    expect(screen.getByText(m.status.approved)).toBeDefined()
    expect(screen.getByText(m.status.documented)).toBeDefined()
  })

  // The weighting is Viktning's lens, and a figure repeated on a chapter that
  // cannot change it is one allocation read twice.
  it("repeats no weight share, on the cards or the headings", () => {
    renderPanel()
    const shareText = weighting.criterionShare.replace("<share></share>", "")
    expect(screen.queryByText(new RegExp(shareText.trim()))).toBeNull()
    expect(screen.queryByText(/33%/)).toBeNull()
  })

  it("offers the documentation action on every criterion for an admin", () => {
    renderPanel()
    expect(screen.getAllByRole("button", { name: m.openCta })).toHaveLength(3)
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

  // The method content READS for every member (its query is an orgQuery), but
  // documenting and approving a criterion are both adminMutations. An editor
  // reads the cards and the statuses, and is offered neither.
  it("shows an editor the documentation without offering the writes", () => {
    orgRole = "editor"
    renderPanel()
    // The read surface is intact.
    expect(screen.getByText("Scope")).toBeDefined()
    expect(screen.getByText("Risk")).toBeDefined()
    expect(screen.getByText(m.status.approved)).toBeDefined()
    expect(screen.getByText(/2\/3 documented/)).toBeDefined()
    // The only entry point to the write dialog is gone, and so is the dialog.
    expect(screen.queryByRole("button", { name: m.openCta })).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByText(m.dialogTitle)).toBeNull()
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
      expect(screen.getAllByRole("button", { name: m.openCta })).toHaveLength(3)
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
      for (const dimension of Object.values(library.dimensions)) {
        expect(
          screen.getByRole("heading", { name: dimension.name })
        ).toBeDefined()
      }
    })

    it("stands placeholder cards in the columns, with the real action", () => {
      const { container } = renderPanel()
      const cards = container.querySelectorAll("ul li")
      expect(cards).toHaveLength(8)
      // The action's label is static i18n text, so it renders as itself
      // (muted and inert) rather than as a gray bar. The placeholder is out of
      // the accessibility tree and out of the tab order, so the inert copy is
      // never offered to anyone: queried by text for exactly that reason.
      const actions = screen.getAllByText(m.openCta)
      expect(actions).toHaveLength(8)
      expect(actions[0]?.getAttribute("tabindex")).toBe("-1")
      expect(cards[0]?.getAttribute("aria-hidden")).toBe("true")
    })

    it("offers an editor no action, loading or loaded", () => {
      orgRole = "editor"
      renderPanel()
      expect(screen.queryByRole("button", { name: m.openCta })).toBeNull()
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
