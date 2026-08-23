import messages from "@workspace/i18n/messages/en.json"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import {
  BreadcrumbAdornment,
  BreadcrumbAside,
  BreadcrumbSlotProvider,
} from "@/components/page-breadcrumb-slots"

afterEach(cleanup)

describe("the page header's slots", () => {
  // The header is rendered by a persistent route layout while what belongs
  // beside its title is derived far below it. The kartläggning's analysis
  // section is the case: its instrument is drawn from a queue two layouts
  // down.
  it("lets a page fill the title's adornment and its aside from below", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BreadcrumbSlotProvider>
          <PageBreadcrumbRow segments={[{ label: "Analysis" }]} />
          <div>
            <BreadcrumbAdornment>
              <button type="button">?</button>
            </BreadcrumbAdornment>
            <BreadcrumbAside>
              <div data-testid="instrument" />
            </BreadcrumbAside>
          </div>
        </BreadcrumbSlotProvider>
      </NextIntlClientProvider>
    )
    const _heading = screen.getByRole("heading")
    // The adornment sits with the title; the aside opposite it, both inside
    // the header rather than in the subtree that rendered them.
    const header = container.querySelector("header") as HTMLElement
    expect(header.contains(screen.getByRole("button", { name: "?" }))).toBe(
      true
    )
    expect(header.contains(screen.getByTestId("instrument"))).toBe(true)
    // The adornment slot renders right after the trail inside the same
    // left-hand group as the crumb naming the page.
    expect(
      screen
        .getByRole("button", { name: "?" })
        .closest("header")
        ?.textContent?.includes("Analysis")
    ).toBe(true)
  })

  // A page that fills neither renders exactly what it always did: the slots
  // are empty spans that take no layout of their own.
  it("changes nothing for a row that fills neither", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PageBreadcrumbRow segments={[{ label: "Roles" }]} />
      </NextIntlClientProvider>
    )
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Roles")
  })
})
