import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import {
  AnchorRolesPanel,
  type AnchorRolesPanelRow,
} from "@/components/results/anchor-roles-panel"

const labels = messages.dashboard.results.anchors

function anchor(overrides: Partial<AnchorRolesPanelRow>): AnchorRolesPanelRow {
  return {
    roleId: "role-1",
    title: "Software Developer",
    expectedBand: 3,
    computedBand: 3,
    status: "active",
    ...overrides,
  }
}

function renderPanel(anchors: AnchorRolesPanelRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AnchorRolesPanel anchors={anchors} />
    </NextIntlClientProvider>
  )
}

describe("AnchorRolesPanel", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders nothing when there are no anchor roles", () => {
    renderPanel([])
    expect(screen.queryByText(labels.heading)).toBeNull()
  })

  it("renders nothing when every anchor is replaced", () => {
    renderPanel([anchor({ status: "replaced" })])
    expect(screen.queryByText(labels.heading)).toBeNull()
  })

  it("lists anchors with agreed and computed bands and links to the role", () => {
    renderPanel([
      anchor({ roleId: "role-7", expectedBand: 2, computedBand: 2 }),
    ])

    const link = screen.getByRole("link", { name: "Software Developer" })
    expect(link.getAttribute("href")).toBe("/roles/role-7")
    expect(screen.getByText(labels.expectedBand)).toBeDefined()
    expect(screen.getByText(labels.computedBand)).toBeDefined()
    // Matching bands: no deviation flag.
    expect(screen.queryByText(labels.mismatch)).toBeNull()
  })

  it("flags an anchor whose computed band deviates from the agreed band", () => {
    renderPanel([anchor({ expectedBand: 2, computedBand: 4 })])
    expect(screen.getByText(labels.mismatch)).toBeDefined()
  })

  it("omits the computed badge and the flag when the band is null", () => {
    // Null band: the model changed since designation (results-table
    // convention: no badge at all, and no mismatch verdict either).
    renderPanel([anchor({ computedBand: null })])
    expect(screen.queryByText(labels.computedBand)).toBeNull()
    expect(screen.queryByText(labels.mismatch)).toBeNull()
  })
})
