import { act, cleanup, render, screen } from "@testing-library/react"
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
      <ImportingStep />
    </NextIntlClientProvider>
  )
}

describe("ImportingStep", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    useQueryMock.mockReset()
  })

  it("falls back to a simulated advancing bar while no real progress exists", () => {
    vi.useFakeTimers()
    useQueryMock.mockReturnValue(null)
    renderStep()
    const initial = remaining()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    const later = remaining()
    expect(later).toBeLessThan(initial)
    // The simulated progress never claims completion (caps at 90%).
    expect(later).toBeGreaterThanOrEqual(10)
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
})
