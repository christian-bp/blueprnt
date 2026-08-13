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

  it("greets by time of day with the first name in muted ink", () => {
    hoisted.sessionName = "Christian Ek"
    const { container } = renderGreeting()
    // The rich message splits the heading into nodes: the greeting text,
    // then the name inside its own muted span (the hero's treatment: the
    // greeting carries the weight, the name recedes).
    const heading = container.querySelector("h1")
    expect(heading?.textContent).toBe("Good morning, Christian")
    const muted = heading?.querySelector("span.text-muted-foreground")
    expect(muted?.textContent).toBe("Christian")
  })

  it("omits the name when the session has none", () => {
    hoisted.sessionName = undefined
    renderGreeting()
    expect(screen.getByText("Good morning")).toBeDefined()
  })

  it("always centers the heading", () => {
    hoisted.sessionName = "Christian Ek"
    renderGreeting()
    expect(screen.getByRole("heading").className).toContain("text-center")
  })
})
