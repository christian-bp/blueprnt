import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { PendingRoles } from "@/components/levels/pending-roles"
import type { LevelRoleRow } from "@/lib/levels"

function role(overrides: Partial<LevelRoleRow>): LevelRoleRow {
  return {
    roleId: "r1",
    slug: "r1",
    title: "Data Analyst",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: null,
    level: null,
    ratedCount: 3,
    totalCriteria: 9,
    readyToLock: false,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderPending(rows: LevelRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PendingRoles rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("PendingRoles", () => {
  afterEach(() => cleanup())

  it("lists roles without a level and a link, with no rating count", () => {
    renderPending([role({})])
    expect(
      screen.getByText(messages.dashboard.levels.pendingHeading)
    ).toBeDefined()
    // The per-role rating count is intentionally not shown.
    expect(screen.queryByText("3/9 rated")).toBeNull()
    expect(
      screen.getByRole("link", { name: /Data Analyst/ }).getAttribute("href")
    ).toBe("/roles/r1")
  })

  it("badges a complete-but-unlocked role as ready to read", () => {
    renderPending([
      role({ roleId: "r3", title: "Ready Role", readyToLock: true }),
    ])
    expect(
      screen.getByText(messages.dashboard.levels.readyToRead)
    ).toBeDefined()
  })

  it("does not badge a role that is merely still being rated", () => {
    renderPending([role({})])
    expect(screen.queryByText(messages.dashboard.levels.readyToRead)).toBeNull()
  })

  it("ignores roles that already have a level", () => {
    renderPending([
      role({ roleId: "r2", title: "Engineer", level: 5, score: 58 }),
    ])
    expect(
      screen.queryByText(messages.dashboard.levels.pendingHeading)
    ).toBeNull()
  })

  it("renders nothing when there are no pending roles", () => {
    const { container } = renderPending([])
    expect(container.firstChild).toBeNull()
  })
})
