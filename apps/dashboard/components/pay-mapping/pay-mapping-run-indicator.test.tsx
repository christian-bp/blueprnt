import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({
  current: "/pay-mappings/pay-2026",
}))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))

import type { PayMappingRunDetail } from "@/components/pay-mapping/pay-mapping-gap-types"
import { PayMappingRunIndicator } from "@/components/pay-mapping/pay-mapping-run-indicator"
import { onQuery } from "@/test/convex-mocks"

const t = messages.dashboard.payMapping

const RUN_2026: PayMappingRunDetail = {
  runId: "run-2026" as PayMappingRunDetail["runId"],
  label: "Pay mapping 2026",
  status: "active",
  referenceDate: Date.UTC(2026, 6, 1),
  rows: [],
  collaboration: null,
}

const RUNS_LIST = [
  { runId: "run-2026", slug: "pay-2026", label: "Pay mapping 2026" },
  { runId: "run-2025", slug: "pay-2025", label: "Pay mapping 2025" },
]

const state: {
  run: PayMappingRunDetail | null | undefined
  runs: typeof RUNS_LIST | undefined
} = { run: RUN_2026, runs: RUNS_LIST }

onQuery((ref) => {
  if (ref === "payMapping.runs.getPayMappingRunBySlug") return state.run
  if (ref === "payMapping.runs.listPayMappingRuns") return state.runs
  return undefined
})

function renderIndicator() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingRunIndicator />
    </NextIntlClientProvider>
  )
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: /Pay mapping 2026/ })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
}

beforeEach(() => {
  state.run = RUN_2026
  state.runs = RUNS_LIST
  pathState.current = "/pay-mappings/pay-2026"
})

afterEach(() => cleanup())

describe("PayMappingRunIndicator", () => {
  it("renders nothing outside a run (no slug segment)", () => {
    pathState.current = "/pay-mappings"
    const { container } = renderIndicator()
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for an unknown run (not found)", () => {
    state.run = null
    const { container } = renderIndicator()
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing on the /review takeover (the overlay only covers the header visually)", () => {
    pathState.current = "/pay-mappings/pay-2026/review"
    const { container } = renderIndicator()
    expect(container.innerHTML).toBe("")
  })

  it("shows the current run's label and status on the trigger", () => {
    renderIndicator()
    expect(screen.getByText("Pay mapping 2026")).toBeDefined()
    expect(screen.getByText(t.status.active)).toBeDefined()
  })

  it("lists every run in the switcher menu, marking only the active one aria-current", () => {
    renderIndicator()
    openMenu()
    const menu = screen.getByRole("menu")
    const activeItem = within(menu).getByRole("menuitem", {
      name: "Pay mapping 2026",
    })
    const otherItem = within(menu).getByRole("menuitem", {
      name: "Pay mapping 2025",
    })
    expect(activeItem.getAttribute("aria-current")).toBe("true")
    expect(otherItem.getAttribute("aria-current")).toBeNull()
  })

  it("links each switcher item to the same sub-page under its own slug", () => {
    pathState.current = "/pay-mappings/pay-2026/analysis"
    renderIndicator()
    openMenu()
    const menu = screen.getByRole("menu")
    const otherLink = within(menu).getByRole("menuitem", {
      name: "Pay mapping 2025",
    })
    expect(otherLink.getAttribute("href")).toBe(
      "/pay-mappings/pay-2025/analysis"
    )
  })

  it('links the switcher\'s "all" item back to the plain list', () => {
    renderIndicator()
    openMenu()
    const menu = screen.getByRole("menu")
    const allItem = within(menu).getByRole("menuitem", {
      name: t.switcher.all,
    })
    expect(allItem.getAttribute("href")).toBe("/pay-mappings")
  })

  it("shows a skeleton in place of the label/status while the run is loading", () => {
    state.run = undefined
    renderIndicator()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText("Pay mapping 2026")).toBeNull()
  })
})
