import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// The Convex/auth provider needs no real client for this mount check.
vi.mock("@convex-dev/better-auth/react", () => ({
  ConvexBetterAuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock("convex/react", () => ({ ConvexReactClient: class {} }))
vi.mock("@/lib/auth-client", () => ({ authClient: {} }))

import { Providers } from "@/components/providers"

describe("Providers", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("mounts the toaster so CRUD toasts have a host", () => {
    render(
      <Providers initialToken={null}>
        <div>child</div>
      </Providers>
    )
    // Sonner renders a <section aria-label="Notifications …"> in jsdom
    // (the data-sonner-toaster attribute is only set in a real browser context).
    expect(
      document.querySelector('section[aria-label^="Notifications"]')
    ).not.toBeNull()
  })
})
