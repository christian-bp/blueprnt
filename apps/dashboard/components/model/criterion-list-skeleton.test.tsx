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

  it("stands the library cards in as bars under a real Add button", () => {
    const { container } = renderBuildGrid()
    // The dimension libraries minus their caps: 5-2, 5-2, 7-3 and 4-1.
    expect(rows(container)).toHaveLength(3 + 3 + 4 + 3)
    // Two bars per card (name, one-liner) plus one per zone's count chip.
    expect(skeletons(container)).toHaveLength(13 * 2 + 4)
    // The Add button's label is static i18n text, so it renders as itself
    // rather than as a gray bar; it is inert because WHICH criterion it would
    // add is exactly the unknown. Queried through the DOM rather than by role:
    // the placeholder list is aria-hidden, so none of it reaches the
    // accessibility tree, which is the point of a placeholder.
    const adds = Array.from(container.querySelectorAll("ul li button"))
    expect(adds).toHaveLength(13)
    expect(
      adds.every(
        (add) =>
          add.textContent === build.addCta &&
          add.className.includes("pointer-events-none")
      )
    ).toBe(true)
  })
})
