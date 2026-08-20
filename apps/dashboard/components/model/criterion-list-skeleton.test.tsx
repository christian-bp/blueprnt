import { cleanup, render } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { CriterionListSkeleton } from "@/components/model/criterion-list-skeleton"

const skeletons = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]')
const rows = (container: HTMLElement) => container.querySelectorAll("ul li")

function renderSkeleton(rowCount?: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriterionListSkeleton rows={rowCount} />
    </NextIntlClientProvider>
  )
}

describe("CriterionListSkeleton", () => {
  afterEach(cleanup)

  it("renders the requested number of placeholder rows", () => {
    const { container } = renderSkeleton(4)
    expect(rows(container)).toHaveLength(4)
  })

  it("shapes the method row: a status-badge bar and the real Open action", () => {
    const { container } = renderSkeleton(3)
    // 4 bars per row: name, description, status badge, note. The Open action
    // is static chrome, rendered as its real (non-interactive) button.
    expect(skeletons(container)).toHaveLength(12)
    expect(container.querySelectorAll("button")).toHaveLength(3)
  })
})
