import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { pickSelectOption } from "@/test/select"

const queryMock = vi.fn()

// Mock motion/react so a filter or a page change removes a row synchronously
// instead of leaving it mounted mid-exit-animation (AnimatePresence's real
// behavior), which would make the search/pagination assertions below flaky.
// Components are cached per tag: a fresh function per `motion.tr` access
// would change the element type every render and force React to remount the
// subtree (same rationale as check-step.test.tsx's mock).
vi.mock("motion/react", () => {
  const cache = new Map<string, React.ComponentType<Record<string, unknown>>>()
  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get(_target, tag: string) {
          let el = cache.get(tag)
          if (el === undefined) {
            el = function MockEl({
              children,
              ...rest
            }: Record<string, unknown> & { children?: ReactNode }) {
              return React.createElement(String(tag), rest, children)
            }
            cache.set(tag, el)
          }
          return el
        },
      }
    ),
  }
})

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => queryMock(...args),
  // StartPayMappingDialog (rendered as the header action and, when empty, the
  // empty-state CTA) calls useMutation; these tests never submit it.
  useMutation: () => vi.fn(),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    payMapping: {
      runs: {
        listPayMappingRuns: "payMapping.runs.listPayMappingRuns",
        startPayMappingRun: "payMapping.runs.startPayMappingRun",
      },
    },
  },
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Rows link to the run detail route: mock next/link with a plain <a> (Link
// requires app-router context that these unit tests do not provide).
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import {
  matchesPayMappingQuery,
  PayMappingsSection,
} from "@/components/pay-mapping/pay-mappings-section"

const m = messages.dashboard.payMapping

const RUNS = [
  {
    runId: "run1",
    slug: "lonekartlaggning-2026",
    label: "Lonekartlaggning 2026",
    status: "active" as const,
    referenceDate: Date.UTC(2026, 6, 1),
    initiatedBy: "user1",
    initiatedByName: "Anna Svensson",
    populationCount: 42,
    withPayCount: 40,
  },
  {
    runId: "run2",
    slug: "lonekartlaggning-2025",
    label: "Lonekartlaggning 2025",
    status: "completed" as const,
    referenceDate: Date.UTC(2025, 6, 1),
    initiatedBy: "user1",
    initiatedByName: "Anna Svensson",
    populationCount: 38,
    withPayCount: 35,
  },
]

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingsSection />
    </NextIntlClientProvider>
  )
}

describe("PayMappingsSection", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders a skeleton while the query is loading, not the empty state or rows", () => {
    queryMock.mockReturnValue(undefined)
    renderSection()
    expect(screen.queryByText(m.empty)).toBeNull()
    expect(screen.queryByText("Lonekartlaggning 2026")).toBeNull()
    // The header start action is a stable slot, rendered in every state.
    expect(screen.getByRole("button", { name: m.startCta })).toBeDefined()
    // The real search toolbar renders during loading too: static chrome
    // (an i18n-labeled control) is never a skeleton bar.
    expect(screen.getByLabelText(m.toolbar.searchPlaceholder)).toBeDefined()
    // The status filter is real chrome too, enabled and showing "All".
    const statusFilter = screen.getByRole("combobox", {
      name: m.table.status,
    })
    expect(statusFilter).toBeDefined()
    expect(statusFilter.getAttribute("aria-disabled")).toBeNull()
    expect(screen.getByText(m.toolbar.statusAll)).toBeDefined()
  })

  it("renders the empty state with the start CTA when there are no runs", () => {
    queryMock.mockReturnValue([])
    renderSection()
    expect(screen.getByText(m.empty)).toBeDefined()
    // Both the header action and the empty-state CTA render the same trigger.
    expect(
      screen.getAllByRole("button", { name: m.startCta }).length
    ).toBeGreaterThanOrEqual(2)
    expect(
      document.querySelector('[data-slot="empty-icon"] svg')
    ).not.toBeNull()
  })

  it("renders a row per run when loaded, linking to its detail route", () => {
    queryMock.mockReturnValue(RUNS)
    renderSection()
    expect(screen.queryByText(m.empty)).toBeNull()

    const firstLink = screen.getByRole("link", {
      name: "Lonekartlaggning 2026",
    })
    expect((firstLink as HTMLAnchorElement).href).toContain(
      "/pay-mappings/lonekartlaggning-2026"
    )
    const secondLink = screen.getByRole("link", {
      name: "Lonekartlaggning 2025",
    })
    expect((secondLink as HTMLAnchorElement).href).toContain(
      "/pay-mappings/lonekartlaggning-2025"
    )

    // Status is localized, and the population count renders as-is.
    expect(screen.getByText(m.status.active)).toBeDefined()
    expect(screen.getByText(m.status.completed)).toBeDefined()
    expect(screen.getByText("42")).toBeDefined()
    expect(screen.getByText("38")).toBeDefined()

    // The "Started by" column renders the resolved operator name, never the
    // raw initiatedBy actor id.
    expect(screen.getAllByText("Anna Svensson")).toHaveLength(2)
    expect(screen.queryByText("user1")).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Search and pagination
  // ---------------------------------------------------------------------------

  it("search narrows rows by label and shows the result count", () => {
    queryMock.mockReturnValue(RUNS)
    renderSection()
    const search = screen.getByLabelText(m.toolbar.searchPlaceholder)
    fireEvent.change(search, { target: { value: "2026" } })
    expect(screen.getByText("Lonekartlaggning 2026")).toBeDefined()
    expect(screen.queryByText("Lonekartlaggning 2025")).toBeNull()
    expect(screen.getByText("1 of 2 pay mappings")).toBeDefined()
  })

  it("search also matches the started-by name", () => {
    const runs = [RUNS[0], { ...RUNS[1], initiatedByName: "Erik Bergstrom" }]
    queryMock.mockReturnValue(runs)
    renderSection()
    fireEvent.change(screen.getByLabelText(m.toolbar.searchPlaceholder), {
      target: { value: "erik" },
    })
    expect(screen.getByText("Lonekartlaggning 2025")).toBeDefined()
    expect(screen.queryByText("Lonekartlaggning 2026")).toBeNull()
  })

  it("shows the no-matches empty state and clears the search from it", () => {
    queryMock.mockReturnValue(RUNS)
    renderSection()
    fireEvent.change(screen.getByLabelText(m.toolbar.searchPlaceholder), {
      target: { value: "zzz" },
    })
    expect(screen.getByText(m.toolbar.noMatches)).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", { name: m.toolbar.clearFilters })
    )
    expect(screen.getByText("Lonekartlaggning 2026")).toBeDefined()
    expect(screen.getByText("Lonekartlaggning 2025")).toBeDefined()
  })

  it("paginates past 25 runs and navigates with Next", () => {
    // 30 runs: page 1 shows 25 rows, page 2 the last 5.
    const manyRuns = Array.from({ length: 30 }, (_, i) => ({
      runId: `run${i + 1}`,
      slug: `run-${i + 1}`,
      label: `Run ${String(i + 1).padStart(2, "0")}`,
      status: "active" as const,
      referenceDate: Date.UTC(2026, 0, i + 1),
      initiatedBy: "user1",
      initiatedByName: "Anna Svensson",
      populationCount: 10,
      withPayCount: 10,
    }))
    queryMock.mockReturnValue(manyRuns)
    renderSection()

    // 1 header row + 25 data rows on the first page.
    expect(screen.getAllByRole("row")).toHaveLength(26)
    expect(screen.getByText("Run 01")).toBeDefined()
    expect(screen.queryByText("Run 26")).toBeNull()

    fireEvent.click(screen.getByLabelText(m.toolbar.next))
    expect(screen.getAllByRole("row")).toHaveLength(6)
    expect(screen.getByText("Run 26")).toBeDefined()
    expect(screen.queryByText("Run 01")).toBeNull()

    fireEvent.click(screen.getByLabelText(m.toolbar.previous))
    expect(screen.getByText("Run 01")).toBeDefined()
  })

  it("hides the pagination control when everything fits on one page", () => {
    queryMock.mockReturnValue(RUNS)
    renderSection()
    expect(screen.queryByLabelText(m.toolbar.next)).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Status filter
  // ---------------------------------------------------------------------------

  it("filters by status: Not completed excludes completed runs, Completed excludes the rest", async () => {
    queryMock.mockReturnValue(RUNS)
    renderSection()
    const statusFilter = () =>
      screen.getByRole("combobox", { name: m.table.status })

    await pickSelectOption(statusFilter(), m.toolbar.statusNotCompleted)
    expect(screen.getByText("Lonekartlaggning 2026")).toBeDefined()
    expect(screen.queryByText("Lonekartlaggning 2025")).toBeNull()
    expect(screen.getByText("1 of 2 pay mappings")).toBeDefined()

    await pickSelectOption(statusFilter(), m.status.completed)
    expect(screen.getByText("Lonekartlaggning 2025")).toBeDefined()
    expect(screen.queryByText("Lonekartlaggning 2026")).toBeNull()

    await pickSelectOption(statusFilter(), m.toolbar.statusAll)
    expect(screen.getByText("Lonekartlaggning 2026")).toBeDefined()
    expect(screen.getByText("Lonekartlaggning 2025")).toBeDefined()
  })

  it("combines the status filter with search, and clears both from the no-matches state", async () => {
    queryMock.mockReturnValue(RUNS)
    renderSection()
    fireEvent.change(screen.getByLabelText(m.toolbar.searchPlaceholder), {
      target: { value: "2025" },
    })
    await pickSelectOption(
      screen.getByRole("combobox", { name: m.table.status }),
      m.toolbar.statusNotCompleted
    )
    // 2025 is completed, so the search+status combination matches nothing.
    expect(screen.getByText(m.toolbar.noMatches)).toBeDefined()

    fireEvent.click(
      screen.getByRole("button", { name: m.toolbar.clearFilters })
    )
    expect(screen.getByText("Lonekartlaggning 2026")).toBeDefined()
    expect(screen.getByText("Lonekartlaggning 2025")).toBeDefined()
  })
})

describe("matchesPayMappingQuery", () => {
  it("matches case-insensitive substrings of the label and started-by name", () => {
    const run = {
      label: "Lonekartlaggning 2026",
      initiatedByName: "Anna Svensson",
    }
    expect(matchesPayMappingQuery(run, "2026")).toBe(true)
    expect(matchesPayMappingQuery(run, "SVENS")).toBe(true)
    expect(matchesPayMappingQuery(run, "2025")).toBe(false)
  })

  it("matches everything on an empty or whitespace query", () => {
    const run = {
      label: "Lonekartlaggning 2026",
      initiatedByName: "Anna Svensson",
    }
    expect(matchesPayMappingQuery(run, "")).toBe(true)
    expect(matchesPayMappingQuery(run, "   ")).toBe(true)
  })
})
