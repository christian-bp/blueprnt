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
    // The simulated setup phase claims at most 10% progress, so it can never
    // race ahead of the real counts and freeze the ratcheted bar high.
    expect(later).toBeGreaterThanOrEqual(90)
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

  it("never moves backwards when real progress arrives below the simulated value", () => {
    vi.useFakeTimers()
    useQueryMock.mockReturnValue(null)
    const { rerender } = renderStep()
    // Let the simulated bar ease well past the first real percentage.
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    const before = remaining()
    // First real data point: ~1% done, far below the simulated bar. The bar
    // must hold its position (ratchet), not jump backwards.
    useQueryMock.mockReturnValue({ processed: 1, total: 118 })
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportingStep />
      </NextIntlClientProvider>
    )
    expect(remaining()).toBeLessThanOrEqual(before)
    // Once reality overtakes, the bar moves forward again.
    useQueryMock.mockReturnValue({ processed: 118, total: 118 })
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportingStep />
      </NextIntlClientProvider>
    )
    expect(remaining()).toBe(0)
  })
})
