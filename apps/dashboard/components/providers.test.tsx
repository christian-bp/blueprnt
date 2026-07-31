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
    // The Base UI toast viewport is the host that the toast list renders into.
    // Assert on the data-slot rather than the vendor's own aria-label, so the
    // check survives an upstream label change.
    expect(
      document.querySelector('[data-slot="toast-viewport"]')
    ).not.toBeNull()
  })
})
