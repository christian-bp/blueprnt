import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/model/criteria",
}))

let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: orgRole }),
}))

import { ModelSectionShell } from "@/components/model/model-section-shell"
import { onQuery } from "@/test/convex-mocks"

const m = messages.dashboard.model.chapters

const CHECKS = [
  { key: "dimensionCoverage", level: "blocker", ok: true },
  { key: "workingConditionsTested", level: "blocker", ok: true },
  { key: "criterionCount", level: "blocker", ok: true, count: 6 },
  { key: "dimensionCaps", level: "blocker", ok: true },
  { key: "anchorsComplete", level: "blocker", ok: true },
  { key: "documentationComplete", level: "blocker", ok: true },
  { key: "weightBudget", level: "blocker", ok: true, count: 6 },
  { key: "levelRulesValid", level: "blocker", ok: true },
  { key: "zoneProfileMonotonic", level: "blocker", ok: true },
  { key: "dimensionWeightBalance", level: "warning", ok: true },
  // No people-leadership criterion in this fixture, so the engine reports
  // that obligation as not applying and the weighting chapter does not count
  // a unit for it.
  { key: "peopleLeadershipWeight", level: "warning", ok: true, applies: false },
  { key: "overlapPairs", level: "warning", ok: true },
]

let checksResult: unknown = {
  checks: CHECKS,
  approval: null,
  // A model whose weighting a human has saved: the Viktning chapter counts
  // the act, not the budget arithmetic, so an unsaved fixture would read as
  // an untouched chapter.
  weightsSaved: true,
  workingConditions: { status: "testedNotMaterial", motivation: "x" },
}

function renderShell() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelSectionShell>
        <p>chapter body</p>
      </ModelSectionShell>
    </NextIntlClientProvider>
  )
}

describe("ModelSectionShell", () => {
  beforeEach(() => {
    orgRole = "admin"
    checksResult = {
      checks: CHECKS,
      approval: null,
      weightsSaved: true,
      workingConditions: { status: "testedNotMaterial", motivation: "x" },
    }
    onQuery((ref) =>
      ref === "evaluationModel.approval.getMethodChecks"
        ? checksResult
        : undefined
    )
  })
  afterEach(() => cleanup())

  // The instrument rides the BREADCRUMB row and floats nowhere: over the
  // reader's data was the cost the float carried. It sits opposite the trail,
  // which is where the kartläggning's analysis journey already puts its own.
  it("places the instrument on the breadcrumb row", () => {
    const { container } = renderShell()
    const row = document.querySelector(
      '[data-slot="page-breadcrumb-row"]'
    ) as HTMLElement
    const bar = screen.getByRole("progressbar", { name: m.progressBarLabel })
    const instrument = bar.parentElement as HTMLElement
    expect(row.contains(instrument)).toBe(true)
    // Opposite the trail, not laid out after it: the row splits its ends.
    expect(row.className).toContain("justify-between")
    expect(container.querySelector('[class*="fixed"]')).toBeNull()
    // The fixture leaves only the approval outstanding: 15 of 16 STEPS, so
    // 94%, not the 75% three closed chapters of four would read as.
    expect(bar.getAttribute("aria-valuenow")).toBe("94")
    const tokens = instrument.className.split(/\s+/)
    expect(tokens).toContain("w-[28rem]")
    expect(tokens).toContain("shrink-0")
    // One segment per chapter, all the same width whatever each holds, with
    // the open one held up while the rest recede.
    const segments = [...bar.children] as HTMLElement[]
    expect(segments.map((segment) => segment.style.flexGrow)).toEqual([
      "1",
      "1",
      "1",
      "1",
    ])
    expect(segments.map((segment) => segment.dataset.active)).toEqual([
      "true",
      "false",
      "false",
      "false",
    ])
    // And NOT on the journey row: an instrument there is the drift back to
    // the shape the owner rejected.
    const nav = screen.getByRole("navigation", { name: m.nav })
    expect(nav.parentElement?.querySelector('[role="progressbar"]')).toBeNull()
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1)
  })

  // The journey's continuation: a chapter whose own work is done ends by
  // naming the next one, so finishing a station never leaves the reader to
  // work out from the tabs where the build goes on. The fixture's criteria
  // chapter (the pinned pathname) is complete, so the shell offers Weighting.
  it("offers the next chapter once the open chapter's work is done", () => {
    renderShell()
    const link = screen.getByRole("link", {
      name: m.nextCta.replace("{chapter}", m.weighting),
    })
    expect(link.getAttribute("href")).toBe("/model/weighting")
  })

  it("offers no continuation while the open chapter's work remains", () => {
    checksResult = {
      checks: CHECKS.map((check) =>
        check.key === "criterionCount"
          ? { ...check, ok: false, count: 4 }
          : check
      ),
      approval: null,
      weightsSaved: true,
      workingConditions: { status: "testedNotMaterial", motivation: "x" },
    }
    renderShell()
    expect(
      screen.queryByRole("link", {
        name: m.nextCta.replace("{chapter}", m.weighting),
      })
    ).toBeNull()
  })

  // One instrument, and no fixed rail at all on a chapter whose body carries
  // no pill: an empty rail is a fixed element left behind for nothing.
  it("mounts one instrument and no empty rail", () => {
    const { container } = renderShell()
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1)
    expect(container.querySelector('[data-slot="floating-stack"]')).toBeNull()
  })

  // THE STAGE LABEL IS GONE. It led this section's title with "Method
  // building" so a reader knew which half of the method they were in; the
  // to-do guidance and the section's own identity carry that now (owner
  // ruling 2026-08-25). Pinned as an absence so it cannot creep back with the
  // next reading of deviation 10, whose surviving half is the rate route's
  // link isolation rather than any label.
  it("names no stage beside the section title", () => {
    const { container } = renderShell()
    expect(container.querySelector('[data-slot="stage-eyebrow"]')).toBeNull()
  })

  it("mounts the spine and the chapter row above the chapter's own body", () => {
    const { container } = renderShell()
    // THE TRAIL IS THE TITLE. The section carried a heading of its own and no
    // breadcrumbs, which made it the one area a reader could not place from
    // its first row; the trail names it now, and the sr-only h1 the row
    // derives from the last crumb is what assistive tech reads.
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.textContent).toBe(messages.dashboard.nav.model)
    expect(heading.className).toContain("sr-only")
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull()
    expect(container.querySelector(".tabular-nums")?.textContent).toContain(
      "of"
    )
    expect(screen.getByRole("navigation", { name: m.nav })).toBeDefined()
    expect(screen.getByText("chapter body")).toBeDefined()
  })

  // THE TRAIL, and where it stops.
  //
  // "Home > Model", and no chapter. The four chapters navigate by href, but
  // the nav registry deliberately lists none of them: they are one guided
  // journey with an in-page tab row, and /work sets the precedent that a
  // section's tabs are not crumbs (its trail ends at its sub-page, never at
  // Stege/Matris/Familjer). Crumbing the open chapter here would put this
  // section's tabs in the trail while /work's stay out of it.
  it("names the area and stops there, whatever chapter is open", () => {
    renderShell()
    const trail = screen.getByRole("navigation", {
      name: "breadcrumb",
    }).textContent
    expect(trail).toContain(messages.dashboard.nav.home)
    expect(trail).toContain(messages.dashboard.nav.model)
    for (const chapter of ["criteria", "weighting", "method", "approval"]) {
      const name = (m as Record<string, string>)[chapter]
      if (name !== undefined) expect(trail).not.toContain(name)
    }
  })

  // The help rides AFTER the last crumb, which is the /work precedent and the
  // help-after-a-title rule: the trail's last segment is the title it
  // explains.
  it("hangs the section's help off the last crumb", () => {
    renderShell()
    const row = document.querySelector(
      '[data-slot="page-breadcrumb-row"]'
    ) as HTMLElement
    const help = screen.getByRole("button", {
      name: messages.dashboard.help.modelProgressLabel,
    })
    const nav = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(row.contains(help)).toBe(true)
    // After the trail, not inside it and not on the row's far side.
    expect(
      nav.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  // The shell reads getMethodChecks from the LAYOUT, so an admin-gated query
  // there throws in render and takes all four chapters down for an editor.
  // The read is open to every member; the writes behind it are not.
  it("renders for an editor member, not just an admin", () => {
    orgRole = "editor"
    renderShell()
    expect(screen.getByRole("navigation", { name: m.nav })).toBeDefined()
    expect(screen.getByText("chapter body")).toBeDefined()
    // The first chapter is where /model lands, and its tab is reachable.
    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href"))
    ).toContain("/model/criteria")
  })

  // An org with no model yet still has the same four chapters ahead of it, so
  // the bar reads empty rather than the section refusing to render.
  it("draws an empty bar when the org has no model yet", () => {
    checksResult = null
    renderShell()
    const bar = screen.getByRole("progressbar", { name: m.progressBarLabel })
    expect(bar.getAttribute("aria-valuenow")).toBe("0")
    expect(screen.getByText("chapter body")).toBeDefined()
  })

  // The section IS its own skeleton: the title, the four chapter links and
  // the instrument's empty track are all known without the query, so they
  // render for real and only the figures wait.
  it("renders the whole journey row while the checks load", () => {
    checksResult = undefined
    renderShell()
    expect(
      screen.getByRole("heading", { name: messages.dashboard.nav.model })
    ).toBeDefined()
    expect(screen.getByRole("navigation", { name: m.nav })).toBeDefined()
    // No count on any tab: a figure the section does not know yet is one it
    // would have to replace a moment later.
    for (const link of screen.getAllByRole("link")) {
      expect(link.textContent).not.toMatch(/\d+ of \d+/)
    }
    expect(screen.getByText("chapter body")).toBeDefined()
  })
})
