import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Hoist mocks so vi.mock factory closures can reference them.
const { setUiLocale, setPreviewLocale } = vi.hoisted(() => ({
  setUiLocale: vi.fn(async () => {}),
  setPreviewLocale: vi.fn(),
}))

// Mock convex/react: useMutation returns the spy directly.
vi.mock("convex/react", () => ({
  useMutation: () => setUiLocale,
}))

// Mock the locale-provider hook.
vi.mock("@/components/locale-provider", () => ({
  useSetPreviewLocale: () => setPreviewLocale,
}))

// Mock next-intl's useLocale; the provider supplies locale but useLocale needs
// explicit mocking here because we call it as a hook directly inside the component.
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useLocale: () => "en",
  }
})

// Replace the shadcn Select with a minimal native <select> so tests can
// interact with Radix-free DOM elements. The real Radix Select uses portals and
// pointer events that jsdom does not support; mocking at this level keeps the
// focus on the locale-change logic, not the widget internals.
vi.mock("@workspace/ui/components/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange: (v: string) => void
    children: React.ReactNode
  }) => (
    <select
      data-testid="locale-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>,
}))

import { LanguageSection } from "./language-section"

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LanguageSection />
    </NextIntlClientProvider>
  )
}

describe("LanguageSection", () => {
  beforeEach(() => {
    setUiLocale.mockReset()
    setUiLocale.mockResolvedValue(undefined)
    setPreviewLocale.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("renders the card title as the section heading", () => {
    renderSection()
    // CardTitle renders the language label; assert it appears in the document.
    const label = en.dashboard.account.profile.languageLabel
    // There must be at least one element with this text (the card title).
    expect(screen.getAllByText(label).length).toBeGreaterThan(0)
  })

  it("renders the locale select element", () => {
    renderSection()
    // The Select mock renders a native <select> with data-testid="locale-select".
    // This test is distinct from the heading test: it asserts the interactive
    // control (not just the label text) is present.
    expect(screen.getByTestId("locale-select")).toBeDefined()
  })

  it("renders all five locale options", () => {
    renderSection()
    const select = screen.getByTestId("locale-select") as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toContain("en")
    expect(values).toContain("sv")
    expect(values).toContain("nb")
    expect(values).toContain("da")
    expect(values).toContain("fi")
  })

  it("sets current locale as the selected value", () => {
    renderSection()
    const select = screen.getByTestId("locale-select") as HTMLSelectElement
    expect(select.value).toBe("en")
  })

  it("calls setPreviewLocale and setUiLocale when a locale is selected", async () => {
    renderSection()
    const select = screen.getByTestId("locale-select")
    fireEvent.change(select, { target: { value: "sv" } })

    expect(setPreviewLocale).toHaveBeenCalledWith("sv")
    await waitFor(() => {
      expect(setUiLocale).toHaveBeenCalledWith({ locale: "sv" })
    })
  })

  it("calls setPreviewLocale(null) on setUiLocale failure to rollback", async () => {
    setUiLocale.mockRejectedValueOnce(new Error("network error"))
    renderSection()

    const select = screen.getByTestId("locale-select")
    fireEvent.change(select, { target: { value: "sv" } })

    await waitFor(() => {
      expect(setPreviewLocale).toHaveBeenLastCalledWith(null)
    })
  })
})
