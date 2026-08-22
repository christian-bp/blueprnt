import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { PageHeader } from "@/components/page-header"
import {
  PageHeaderAdornment,
  PageHeaderAside,
  PageHeaderSlotProvider,
} from "@/components/page-header-slot"

afterEach(cleanup)

describe("the page header's slots", () => {
  // The header is rendered by a persistent route layout while what belongs
  // beside its title is derived far below it. The kartläggning's analysis
  // section is the case: its instrument is drawn from a queue two layouts
  // down.
  it("lets a page fill the title's adornment and its aside from below", () => {
    const { container } = render(
      <PageHeaderSlotProvider>
        <PageHeader title="Analysis" />
        <div>
          <PageHeaderAdornment>
            <button type="button">?</button>
          </PageHeaderAdornment>
          <PageHeaderAside>
            <div data-testid="instrument" />
          </PageHeaderAside>
        </div>
      </PageHeaderSlotProvider>
    )
    const heading = screen.getByRole("heading")
    // The adornment sits with the title; the aside opposite it, both inside
    // the header rather than in the subtree that rendered them.
    const header = container.firstElementChild as HTMLElement
    expect(header.contains(screen.getByRole("button", { name: "?" }))).toBe(
      true
    )
    expect(header.contains(screen.getByTestId("instrument"))).toBe(true)
    expect(heading.parentElement?.textContent).toBe("Analysis?")
  })

  // A page that fills neither renders exactly what it always did: the slots
  // are empty spans that take no layout of their own.
  it("changes nothing for a header that fills neither", () => {
    const { container } = render(<PageHeader title="Roles" />)
    expect(container.textContent).toBe("Roles")
  })
})
