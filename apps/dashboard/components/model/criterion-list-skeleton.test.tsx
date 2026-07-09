import { cleanup, render } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { CriterionListSkeleton } from "@/components/model/criterion-list-skeleton"

const skeletons = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]')
const rows = (container: HTMLElement) => container.querySelectorAll("ul li")

function renderSkeleton(props: {
  rows?: number
  variant: "define" | "weight" | "method"
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriterionListSkeleton {...props} />
    </NextIntlClientProvider>
  )
}

describe("CriterionListSkeleton", () => {
  afterEach(cleanup)

  it("renders the requested number of placeholder rows", () => {
    const { container } = renderSkeleton({ rows: 4, variant: "define" })
    expect(rows(container)).toHaveLength(4)
  })

  it("shapes the define variant: bars for name + description, the row menu as its real icon, no note", () => {
    const { container } = renderSkeleton({ rows: 3, variant: "define" })
    // 2 bars per row: name, description. The row-menu trigger is static
    // chrome, rendered as its real (muted) icon rather than a bar.
    expect(skeletons(container)).toHaveLength(6)
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
