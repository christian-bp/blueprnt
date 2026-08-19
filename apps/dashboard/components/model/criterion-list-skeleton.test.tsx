import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import {
  CriterionListSkeleton,
  DefineCriterionListSkeleton,
} from "@/components/model/criterion-list-skeleton"

const skeletons = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]')
const rows = (container: HTMLElement) => container.querySelectorAll("ul li")
const picker = messages.dashboard.model.picker

function renderSkeleton(props: {
  rows?: number
  variant: "weight" | "method"
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriterionListSkeleton {...props} />
    </NextIntlClientProvider>
  )
}

function renderDefineSkeleton(rowsPerSection?: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DefineCriterionListSkeleton orgId="org-1" rows={rowsPerSection} />
    </NextIntlClientProvider>
  )
}

describe("CriterionListSkeleton", () => {
  afterEach(cleanup)

  it("renders the requested number of placeholder rows", () => {
    const { container } = renderSkeleton({ rows: 4, variant: "weight" })
    expect(rows(container)).toHaveLength(4)
  })

  it("shapes the weight variant: the real 1-5 group plus a share-note bar", () => {
    const { container } = renderSkeleton({ rows: 3, variant: "weight" })
    // 3 bars per row: name, description, note. The 1-5 digits are static
    // chrome, rendered as real (non-interactive) buttons.
    expect(skeletons(container)).toHaveLength(9)
    expect(container.querySelectorAll("button")).toHaveLength(15)
  })

  it("shapes the method variant: a status-badge bar and the real Open action", () => {
    const { container } = renderSkeleton({ rows: 3, variant: "method" })
    // 4 bars per row: name, description, status badge, note. The Open action
    // is static chrome, rendered as its real (non-interactive) button.
    expect(skeletons(container)).toHaveLength(12)
    expect(container.querySelectorAll("button")).toHaveLength(3)
  })
})

describe("DefineCriterionListSkeleton", () => {
  afterEach(cleanup)

  it("mirrors the loaded Define phase: four real dimension sections", () => {
    renderDefineSkeleton()
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    ).toEqual([
      "Competence",
      "Effort and complexity",
      "Responsibility and impact",
      "Working conditions",
    ])
    // The Add picker is the real, working LibraryPickerDialog, one per
    // dimension, not a skeleton bar.
    expect(screen.getAllByRole("button", { name: picker.addCta })).toHaveLength(
      4
    )
  })

  it("shapes each section's placeholder rows: bars for name + description, the row menu as its real icon, no note", () => {
    const { container } = renderDefineSkeleton(2)
    // 4 sections x 2 rows/section.
    expect(rows(container)).toHaveLength(8)
    // 2 bars per row (name, description); the row-menu trigger is static
    // chrome, rendered as its real (muted) icon rather than a bar; no note.
    expect(skeletons(container)).toHaveLength(16)
  })

  it("honors a custom rows-per-section count", () => {
    const { container } = renderDefineSkeleton(1)
    expect(rows(container)).toHaveLength(4)
  })
})
