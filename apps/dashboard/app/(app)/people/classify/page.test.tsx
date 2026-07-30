import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

import { onQuery } from "@/test/convex-mocks"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

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

import ClassifyPage from "@/app/(app)/people/classify/page"

const m = messages.dashboard.classify

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ClassifyPage />
    </NextIntlClientProvider>
  )
}

describe("ClassifyPage loading skeleton", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  // The bulk toolbar sits above the table as a fixed-height row. If the
  // loading branch omitted it, the table would visibly shift down the
  // moment data arrives and the loaded branch mounts its own toolbar; the
  // skeleton must render the exact same slot, as real (if inert) chrome.
  it("renders the bulk toolbar slot, CTA disabled and no count text, while queries are loading", () => {
    useQueryMock.mockImplementation(() => undefined)
    renderPage()
    const cta = screen.getByRole("button", {
      name: m.bulk.cta,
    }) as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    // The count <p> is the CTA's sibling in the toolbar row; empty at zero
    // selection (not just "no digits", since the CTA's own label contains
    // the word "selected").
    const countText = cta.parentElement?.querySelector("p")?.textContent
    expect(countText).toBe("")
  })
})
