import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import {
  BuildGridSkeleton,
  CriterionListSkeleton,
} from "@/components/model/criterion-list-skeleton"

const skeletons = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]')
const rows = (container: HTMLElement) => container.querySelectorAll("ul li")
const build = messages.dashboard.model.build

function renderSkeleton(rowCount?: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriterionListSkeleton rows={rowCount} />
    </NextIntlClientProvider>
  )
}

function renderBuildGrid() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BuildGridSkeleton />
    </NextIntlClientProvider>
  )
}

describe("CriterionListSkeleton", () => {
  afterEach(cleanup)

  it("renders the requested number of placeholder rows", () => {
    const { container } = renderSkeleton(4)
    expect(rows(container)).toHaveLength(4)
  })

  it("shapes the method row: a status-badge bar and the real Open action", () => {
    const { container } = renderSkeleton(3)
    // 4 bars per row: name, description, status badge, note. The Open action
    // is static chrome, rendered as its real (non-interactive) button.
    expect(skeletons(container)).toHaveLength(12)
    expect(container.querySelectorAll("button")).toHaveLength(3)
  })
})

describe("BuildGridSkeleton", () => {
  afterEach(cleanup)

  // The four dimensions are fixed method law and their names come from a
  // locale-keyed constant, not from the org's data, so they are real from the
  // first paint: what the reader is waiting for is which criteria are in.
  it("mirrors the loaded grid: four real dimension zones", () => {
    renderBuildGrid()
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    ).toEqual([
      "Competence",
      "Effort and complexity",
      "Responsibility and impact",
      "Working conditions",
    ])
    // Each zone's help is the real morph trigger, one per dimension.
    expect(
      screen.getAllByRole("button", {
        name: messages.dashboard.help.dimensionLabel,
      })
    ).toHaveLength(4)
  })

  it("fills every empty zone with the shared hatch, as the loaded zone does", () => {
    const { container } = renderBuildGrid()
    expect(
      container.querySelectorAll('[class*="repeating-linear-gradient"]')
    ).toHaveLength(4)
  })

  // Sized to the whole library, because the state this page exists for is an
  // organization with nothing selected yet: that is also the widest a column
  // ever gets, so the columns only ever shrink as criteria move into a zone.
  it("stands the library cards in as bars under a real Add button", () => {
    const { container } = renderBuildGrid()
    // Every dimension's whole library: 5, 5, 7 and 4.
    expect(rows(container)).toHaveLength(5 + 5 + 7 + 4)
    // Two bars per card (name, one-liner), one per zone's count chip, two for
    // the budget's figures, one for its status line.
    expect(skeletons(container)).toHaveLength(21 * 2 + 4 + 3)
    // The Add button's label is static i18n text, so it renders as itself
    // rather than as a gray bar; it is inert because WHICH criterion it would
    // add is exactly the unknown. Queried through the DOM rather than by role:
    // the placeholder list is aria-hidden, so none of it reaches the
    // accessibility tree, which is the point of a placeholder.
    const adds = Array.from(container.querySelectorAll("ul li button"))
    expect(adds).toHaveLength(21)
    expect(
      adds.every(
        (add) =>
          add.textContent === build.addCta &&
          add.className.includes("pointer-events-none")
      )
    ).toBe(true)
  })

  // The budget bar is the page's chrome, not its data: it renders for real
  // from the first paint, in the same shell the loaded bar uses, so the grid
  // above it cannot shift when the model arrives.
  it("renders the budget bar for real, with only its figures as bars", () => {
    renderBuildGrid()
    // The sentence around the two unknown figures is real text.
    expect(
      screen.getByText(/weight points allocated/, { exact: false })
    ).toBeDefined()
    // The weighting concept's help is a live control, not a placeholder.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.weightingLabel,
      })
    ).toBeDefined()
    // The save renders as itself and disabled, which is the loaded bar's own
    // initial state on a clean model.
    const save = screen.getByRole("button", { name: build.saveCta })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    // The AI review's slot is reserved so the bar cannot change height when
    // the trigger appears, and hidden so it can be neither reached nor
    // announced while there is nothing to review.
    const review = screen.getByText(messages.dashboard.ai.openReviewCta)
    expect(review.closest("[aria-hidden='true']")?.className).toContain(
      "invisible"
    )
  })
})
