import { cleanup, renderHook } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { usePageTitle } from "@/hooks/use-page-title"

// dashboard.title is the brand ("blueprnt") and is the same in every locale.
function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

describe("usePageTitle", () => {
  afterEach(() => cleanup())

  it("sets the document title to '<page> · blueprnt'", () => {
    renderHook(() => usePageTitle("Roles"), { wrapper })
    expect(document.title).toBe("Roles · blueprnt")
  })

  it("joins segments and drops a still-loading one", () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      wrapper,
      initialProps: {
        title: ["Admin", "Users"] as Array<string | undefined>,
      },
    })
    expect(document.title).toBe("Admin · Users · blueprnt")

    rerender({ title: [undefined, "Users"] })
    expect(document.title).toBe("Users · blueprnt")
  })

  it("falls back to the brand alone while a dynamic title loads", () => {
    renderHook(() => usePageTitle(undefined), { wrapper })
    expect(document.title).toBe("blueprnt")
  })

  it("updates when the label changes (live locale switch)", () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      wrapper,
      initialProps: { title: "Roles" as string | undefined },
    })
    expect(document.title).toBe("Roles · blueprnt")

    rerender({ title: "Roller" })
    expect(document.title).toBe("Roller · blueprnt")
  })
})
