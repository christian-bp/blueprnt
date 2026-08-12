// apps/dashboard/components/overview/welcome-greeting.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

// Fix the bucket so the assertion is deterministic (the hour comes from the
// real clock at runtime; greetingBucket itself is tested separately).
vi.mock("@/lib/greeting", () => ({ greetingBucket: () => "morning" }))

// vi.mock factories are hoisted above imports, so the mutable session name must
// come through vi.hoisted (a plain outer `let` would hit a TDZ / "only mock*
// vars" error in the factory).
const hoisted = vi.hoisted(() => ({
  sessionName: "Christian Ek" as string | undefined,
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: hoisted.sessionName } } }),
  },
}))

import { WelcomeGreeting } from "@/components/overview/welcome-greeting"

function renderGreeting() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WelcomeGreeting />
    </NextIntlClientProvider>
  )
}

describe("WelcomeGreeting", () => {
  afterEach(cleanup)

  it("greets by time of day with the first name", () => {
    hoisted.sessionName = "Christian Ek"
    renderGreeting()
    expect(screen.getByText("Good morning, Christian")).toBeDefined()
  })

  it("omits the name when the session has none", () => {
    hoisted.sessionName = undefined
    renderGreeting()
    expect(screen.getByText("Good morning")).toBeDefined()
  })

  it("stays left-aligned by default and centers only when asked", () => {
    hoisted.sessionName = "Christian Ek"
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WelcomeGreeting />
      </NextIntlClientProvider>
    )
    expect(screen.getByRole("heading").className).not.toContain("text-center")
    unmount()

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WelcomeGreeting centered />
      </NextIntlClientProvider>
    )
    expect(screen.getByRole("heading").className).toContain("text-center")
  })
})
