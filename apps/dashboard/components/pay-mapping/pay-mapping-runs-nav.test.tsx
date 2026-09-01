import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { PayMappingRunsNav } from "@/components/pay-mapping/pay-mapping-runs-nav"
import { onQuery } from "@/test/convex-mocks"

const RUNS = [
  { runId: "run-2", slug: "2027", label: "2027", status: "active" },
  { runId: "run-1", slug: "2026", label: "2026", status: "completed" },
]

afterEach(cleanup)

describe("PayMappingRunsNav", () => {
  it("lists every run as a link to its workspace, in the query's order", () => {
    onQuery(() => RUNS)
    render(<PayMappingRunsNav />)
    // Base UI's polymorphic Button keeps role="button" on the rendered
    // anchor (the run sidebar's rows read the same way).
    const rows = screen.getAllByRole("button")
    expect(rows.map((row) => row.textContent)).toEqual(["2027", "2026"])
    expect(rows[0]?.getAttribute("href")).toBe("/pay-mappings/2027")
    expect(rows[1]?.getAttribute("href")).toBe("/pay-mappings/2026")
  })

  it("holds measured placeholder rows while the runs load", () => {
    onQuery(() => undefined)
    const { container } = render(<PayMappingRunsNav />)
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2)
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("renders nothing when the register is empty", () => {
    onQuery(() => [])
    const { container } = render(<PayMappingRunsNav />)
    expect(container.firstChild).toBeNull()
  })
})
