import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

// Controls what the live-progress query returns per test.
const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: {
      importHelpers: {
        getImportProgress: "people.importHelpers.getImportProgress",
      },
    },
  },
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({
    orgId: "org-test",
    name: "Test Org",
    role: "admin",
  }),
}))

import { ImportingStep } from "./importing-step"

// The vendored shadcn Progress conveys the value through the indicator's
// translateX(-remaining%) style, so read the remaining percentage there.
function remaining() {
  const indicator = screen
    .getByTestId("import-progress")
    .querySelector('[data-slot="progress-indicator"]') as HTMLElement
  const match = indicator.style.transform.match(/translateX\(-([\d.]+)%\)/)
  return Number(match?.[1])
}

function renderStep() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ImportingStep importId="run-test" />
    </NextIntlClientProvider>
  )
}

describe("ImportingStep", () => {
  afterEach(() => {
    cleanup()
    useQueryMock.mockReset()
  })

  it("shows a spinner and keeps the bar at zero until real progress exists", () => {
    useQueryMock.mockReturnValue(null)
    renderStep()
    // The bar shows no fake progress during the setup phase.
    expect(remaining()).toBe(100)
    // The spinner with its label is the loading indicator meanwhile.
    expect(
      document.querySelector('[aria-hidden="true"].animate-spin')
    ).not.toBeNull()
    expect(
      screen.getByText(messages.dashboard.people.import.importing.working)
    ).toBeDefined()
    // No counts shown without real progress.
    expect(screen.getByTestId("import-progress-count").textContent).toBe("")
  })

  it("shows the real row counts and percentage when the action reports progress", () => {
    useQueryMock.mockReturnValue({ processed: 59, total: 118 })
    renderStep()
    // 59/118 = 50% done -> 50% remaining on the indicator.
    expect(remaining()).toBe(50)
    const count = screen.getByTestId("import-progress-count")
    expect(count.textContent).toContain("59")
    expect(count.textContent).toContain("118")
  })

  it("holds the last value when the progress row is cleared at completion", () => {
    useQueryMock.mockReturnValue({ processed: 118, total: 118 })
    const { rerender } = renderStep()
    expect(remaining()).toBe(0)
    // The action deletes the progress row just before it resolves; the bar
    // must hold rather than snapping back to zero for that final moment.
    useQueryMock.mockReturnValue(null)
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportingStep importId="run-test" />
      </NextIntlClientProvider>
    )
    expect(remaining()).toBe(0)
  })
})
