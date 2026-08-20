import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { CriterionItem } from "@/components/model/criterion-item"

function renderItem(
  props: Partial<{
    description: string
    extendedDescription: string
    importanceNode: ReactNode
    note: ReactNode
  }> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ul>
        <CriterionItem name="Complexity" {...props} />
      </ul>
    </NextIntlClientProvider>
  )
}

describe("CriterionItem", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the name and description", () => {
    renderItem({ description: "How hard the problems are" })
    expect(screen.getByText("Complexity")).toBeDefined()
    expect(screen.getByText("How hard the problems are")).toBeDefined()
  })

  it("renders no description when none is given", () => {
    renderItem()
    expect(screen.getByText("Complexity")).toBeDefined()
    expect(screen.queryByText("How hard the problems are")).toBeNull()
  })

  // The extended description sits behind a morph help icon named for the
  // criterion, rather than always being on screen.
  it("reveals the extended description behind a help button named for the criterion", () => {
    renderItem({ extendedDescription: "Judges how tangled the work is." })
    expect(screen.queryByText("Judges how tangled the work is.")).toBeNull()
    expect(screen.getByRole("button", { name: "Complexity" })).toBeDefined()
  })

  it("renders no help button when no extended description is given", () => {
    renderItem()
    expect(screen.queryByRole("button", { name: "Complexity" })).toBeNull()
  })

  // The weight slot is omitted entirely rather than left empty, so a row with
  // no weighting does not carry a blank column.
  it("renders the importance slot only when given one", () => {
    const { rerender } = renderItem({ importanceNode: <span>3</span> })
    expect(screen.getByText("3")).toBeDefined()
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ul>
          <CriterionItem name="Complexity" />
        </ul>
      </NextIntlClientProvider>
    )
    expect(screen.queryByText("3")).toBeNull()
  })

  // The note is the reserved-height share line under the row; also omitted
  // entirely rather than left as an empty line when the surface has none.
  it("renders the note only when given one", () => {
    const { container } = renderItem({ note: "33% of total" })
    expect(screen.getByText("33% of total")).toBeDefined()
    expect(container.querySelector(".mt-1")).not.toBeNull()
    cleanup()
    const { container: withoutNote } = renderItem()
    expect(withoutNote.querySelector(".mt-1")).toBeNull()
  })

  // The method surface documents and approves criteria; it never removes
  // them. There is no row menu and no confirm dialog on this surface at all.
  it("offers no row menu or removal affordance", () => {
    renderItem()
    expect(screen.queryByRole("button", { name: /actions/i })).toBeNull()
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })
})
