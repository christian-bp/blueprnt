import { cleanup, renderHook } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { useBasePayFormat } from "@/hooks/use-base-pay-format"

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

describe("useBasePayFormat", () => {
  afterEach(() => cleanup())

  it("formats an hourly figure through payUnit.hourly", () => {
    const { result } = renderHook(() => useBasePayFormat(), { wrapper })
    // Intl.NumberFormat separates the currency code and amount with a
    // non-breaking space (U+00A0), not a regular one.
    expect(result.current(195, "hourly", "SEK")).toBe("SEK 195/h")
  })

  it("keeps two fraction digits for a non-whole hourly rate", () => {
    const { result } = renderHook(() => useBasePayFormat(), { wrapper })
    expect(result.current(158.5, "hourly", "SEK")).toBe("SEK 158.50/h")
  })

  it("formats a monthly figure through payUnit.monthly", () => {
    const { result } = renderHook(() => useBasePayFormat(), { wrapper })
    expect(result.current(32000, "monthly", "SEK")).toBe("SEK 32,000/mo")
  })

  it("keeps a monthly figure whole-unit even when it is not a whole number", () => {
    const { result } = renderHook(() => useBasePayFormat(), { wrapper })
    expect(result.current(32000.5, "monthly", "SEK")).toBe("SEK 32,001/mo")
  })
})
