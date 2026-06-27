import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const useConvexAuthMock = vi.fn()
vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthMock(),
}))

import { AuthGate } from "@/components/auth/auth-gate"

function renderGate() {
  return render(
    <AuthGate
      loading={<div data-testid="loading" />}
      unauthenticated={<div data-testid="signin" />}
    >
      <div data-testid="app" />
    </AuthGate>
  )
}

afterEach(() => cleanup())

describe("AuthGate", () => {
  it("shows the loading fallback before the first authentication", () => {
    useConvexAuthMock.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    })
    renderGate()
    expect(screen.getByTestId("loading")).toBeDefined()
    expect(screen.queryByTestId("app")).toBeNull()
  })

  it("shows the children when authenticated", () => {
    useConvexAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    })
    renderGate()
    expect(screen.getByTestId("app")).toBeDefined()
  })

  it("shows the unauthenticated fallback when not authenticated and not loading", () => {
    useConvexAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    })
    renderGate()
    expect(screen.getByTestId("signin")).toBeDefined()
    expect(screen.queryByTestId("app")).toBeNull()
  })

  it("keeps the children mounted across a transient re-auth blip (the enable() token refresh)", () => {
    // Authenticated first, then a transient loading=true/authenticated=false
    // (the token refresh). The subtree must stay mounted, not flip to loading,
    // or in-progress flows like the 2FA setup wizard lose their state.
    useConvexAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    })
    const { rerender } = renderGate()
    expect(screen.getByTestId("app")).toBeDefined()

    useConvexAuthMock.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    })
    rerender(
      <AuthGate
        loading={<div data-testid="loading" />}
        unauthenticated={<div data-testid="signin" />}
      >
        <div data-testid="app" />
      </AuthGate>
    )
    expect(screen.getByTestId("app")).toBeDefined()
    expect(screen.queryByTestId("loading")).toBeNull()
  })

  it("falls back to sign-in on a definitive sign-out after being authenticated", () => {
    useConvexAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    })
    const { rerender } = renderGate()
    expect(screen.getByTestId("app")).toBeDefined()

    useConvexAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    })
    rerender(
      <AuthGate
        loading={<div data-testid="loading" />}
        unauthenticated={<div data-testid="signin" />}
      >
        <div data-testid="app" />
      </AuthGate>
    )
    expect(screen.getByTestId("signin")).toBeDefined()
    expect(screen.queryByTestId("app")).toBeNull()
  })

  it("keeps the sign-in screen mounted across a transient blip during sign-in", () => {
    // Signed out, then a transient loading blip during the sign-in /
    // 2FA-challenge sequence. SignInScreen must stay mounted (not flip to the
    // loading spinner), or its phase state resets and the user is bounced back
    // to the credentials screen.
    useConvexAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    })
    const { rerender } = renderGate()
    expect(screen.getByTestId("signin")).toBeDefined()

    useConvexAuthMock.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    })
    rerender(
      <AuthGate
        loading={<div data-testid="loading" />}
        unauthenticated={<div data-testid="signin" />}
      >
        <div data-testid="app" />
      </AuthGate>
    )
    expect(screen.getByTestId("signin")).toBeDefined()
    expect(screen.queryByTestId("loading")).toBeNull()
  })
})
