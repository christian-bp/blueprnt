import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

// Stub next/navigation so we can control the search params per test.
const { useSearchParams } = vi.hoisted(() => ({
  useSearchParams: vi.fn(() => new URLSearchParams("")),
}))
vi.mock("next/navigation", () => ({ useSearchParams }))

// Stub next/link (not used in this page, but avoids module resolution issues).
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

// SuccessCheck uses framer motion; stub it to a simple marker so tests can
// assert on its presence or absence without running animations.
vi.mock("@/components/auth/success-check", () => ({
  SuccessCheck: () => <div data-testid="success-check" />,
}))

// Logo is decorative; stub it to avoid SVG rendering in tests.
vi.mock("@/components/logo", () => ({
  Logo: () => <div data-testid="logo" />,
}))

import ChangeEmailPage from "./page"

function renderPage(params: string) {
  useSearchParams.mockReturnValue(new URLSearchParams(params))
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ChangeEmailPage />
    </NextIntlClientProvider>
  )
}

describe("ChangeEmailPage", () => {
  afterEach(() => {
    cleanup()
    useSearchParams.mockReset()
    useSearchParams.mockReturnValue(new URLSearchParams(""))
  })

  describe("step=confirmed (hop 1, old inbox)", () => {
    it("shows the confirmed heading", () => {
      renderPage("step=confirmed")
      expect(
        screen.getByRole("heading", {
          name: en.dashboard.changeEmail.confirmedTitle,
        })
      ).toBeDefined()
    })

    it("shows the confirmed body text", () => {
      renderPage("step=confirmed")
      expect(
        screen.getByText(en.dashboard.changeEmail.confirmedBody)
      ).toBeDefined()
    })

    it("does NOT show the done/sign-in copy", () => {
      renderPage("step=confirmed")
      expect(screen.queryByText(en.dashboard.changeEmail.doneBody)).toBeNull()
      expect(
        screen.queryByRole("heading", {
          name: en.dashboard.changeEmail.doneTitle,
        })
      ).toBeNull()
    })

    it("renders the SuccessCheck animation", () => {
      renderPage("step=confirmed")
      expect(screen.getByTestId("success-check")).toBeDefined()
    })

    it("shows the close hint", () => {
      renderPage("step=confirmed")
      expect(screen.getByText(en.dashboard.changeEmail.closeHint)).toBeDefined()
    })
  })

  describe("step=done (hop 2, new inbox)", () => {
    it("shows the done heading", () => {
      renderPage("step=done")
      expect(
        screen.getByRole("heading", {
          name: en.dashboard.changeEmail.doneTitle,
        })
      ).toBeDefined()
    })

    it("shows the done body text", () => {
      renderPage("step=done")
      expect(screen.getByText(en.dashboard.changeEmail.doneBody)).toBeDefined()
    })

    it("renders the SuccessCheck animation", () => {
      renderPage("step=done")
      expect(screen.getByTestId("success-check")).toBeDefined()
    })

    it("shows the close hint", () => {
      renderPage("step=done")
      expect(screen.getByText(en.dashboard.changeEmail.closeHint)).toBeDefined()
    })
  })

  describe("error param present", () => {
    it("shows the invalid heading", () => {
      renderPage("error=INVALID_TOKEN")
      expect(
        screen.getByRole("heading", {
          name: en.dashboard.changeEmail.invalidTitle,
        })
      ).toBeDefined()
    })

    it("shows the invalid body text", () => {
      renderPage("error=INVALID_TOKEN")
      expect(
        screen.getByText(en.dashboard.changeEmail.invalidBody)
      ).toBeDefined()
    })

    it("does NOT render the SuccessCheck", () => {
      renderPage("error=INVALID_TOKEN")
      expect(screen.queryByTestId("success-check")).toBeNull()
    })

    it("does NOT show the done copy", () => {
      renderPage("error=INVALID_TOKEN")
      expect(screen.queryByText(en.dashboard.changeEmail.doneBody)).toBeNull()
    })

    it("does NOT show the confirmed copy", () => {
      renderPage("error=INVALID_TOKEN")
      expect(
        screen.queryByText(en.dashboard.changeEmail.confirmedBody)
      ).toBeNull()
    })
  })
})
