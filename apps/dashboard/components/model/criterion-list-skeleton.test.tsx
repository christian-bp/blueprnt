import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CriterionListSkeleton } from "@/components/model/criterion-list-skeleton"

const skeletons = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]')
const rows = (container: HTMLElement) => container.querySelectorAll("ul li")

describe("CriterionListSkeleton", () => {
  afterEach(cleanup)

  it("renders the requested number of placeholder rows", () => {
    const { container } = render(
      <CriterionListSkeleton rows={4} variant="define" />
    )
    expect(rows(container)).toHaveLength(4)
  })

  it("shapes the define variant with name + description + menu, no note", () => {
    const { container } = render(
      <CriterionListSkeleton rows={3} variant="define" />
    )
    // 3 skeletons per row: name, description, reserved menu square.
    expect(skeletons(container)).toHaveLength(9)
  })

  it("shapes the weight variant with a weight slot and share note", () => {
    const { container } = render(
      <CriterionListSkeleton rows={3} variant="weight" />
    )
    // 4 skeletons per row: name, description, weight slot, note.
    expect(skeletons(container)).toHaveLength(12)
  })

  it("shapes the method variant with a status badge, action, and note", () => {
    const { container } = render(
      <CriterionListSkeleton rows={3} variant="method" />
    )
    // 5 skeletons per row: name, description, status badge, action, note.
    expect(skeletons(container)).toHaveLength(15)
  })
})
