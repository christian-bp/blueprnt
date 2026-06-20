import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TableSkeleton } from "@/components/table-skeleton"

const skeletons = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]')

describe("TableSkeleton", () => {
  afterEach(cleanup)

  it("renders rows x columns skeleton cells from a column count", () => {
    const { container } = render(
      <table>
        <TableSkeleton rows={3} columns={4} />
      </table>
    )
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(skeletons(container)).toHaveLength(12)
  })

  it("applies per-column shape classes from a column array", () => {
    const { container } = render(
      <table>
        <TableSkeleton rows={2} columns={[{ className: "rounded-full" }, {}]} />
      </table>
    )
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(skeletons(container)).toHaveLength(4)
    expect(
      container.querySelectorAll('[data-slot="skeleton"].rounded-full')
    ).toHaveLength(2)
  })
})
