import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ImportWizard } from "./import-wizard"

// Motion passthrough component: strips motion-specific props and renders a
// plain element so tests are unaffected by animation details.
function MotionEl(tag: string) {
  return function MockMotionElement({
    children,
    // Strip props that are only valid on motion elements, not DOM elements.
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    variants: _v,
    style,
    className,
    ...rest
  }: Record<string, unknown> & { children?: React.ReactNode }) {
    return React.createElement(tag, { style, className, ...rest }, children)
  }
}

// Mock motion/react to avoid animation complexity in tests.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: new Proxy(
    {},
    {
      get(_target, tag: string) {
        return MotionEl(tag)
      },
    }
  ),
  useReducedMotion: () => false,
  MotionConfig: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

// Mock next/link with a plain <a>.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => null),
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({
    orgId: "org-test",
    name: "Test Org",
    role: "admin",
  }),
}))

// Mock the account menu to avoid its Convex dependencies.
vi.mock("@/components/account-menu", () => ({
  AccountMenu: () => null,
}))

// Mock WizardShell to a plain pass-through so wizard tests avoid layout
// details (scroll cues, header slots) that are not relevant to the
// button-gating assertion.
vi.mock("@/components/wizard-shell", () => ({
  WizardShell: ({
    children,
    footer,
  }: {
    children: React.ReactNode
    footer?: React.ReactNode
    headerLeft?: React.ReactNode
    headerRight?: React.ReactNode
    contentClassName?: string
  }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}))

// Mock OnboardingDots to avoid its internal motion dependencies.
vi.mock("@/components/onboarding/onboarding-dots", () => ({
  OnboardingDots: () => null,
}))

import { handleCsvText } from "./upload-step"
import { UploadStep } from "./upload-step"
import type { ParsedCsv } from "./import-wizard"

const FIXTURE_CSV = `name,department,gender,salary
Alice Svensson,Engineering,Kvinna,55000
Bob Lindgren,Marketing,Man,62000
Carol Johansson,HR,Kvinna,48000`

const m = messages.dashboard.people.import

function renderUploadStep({
  parsed = null,
  onParsed = vi.fn() as Parameters<typeof UploadStep>[0]["onParsed"],
}: {
  parsed?: Parameters<typeof UploadStep>[0]["parsed"]
  onParsed?: Parameters<typeof UploadStep>[0]["onParsed"]
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UploadStep parsed={parsed} onParsed={onParsed} />
    </NextIntlClientProvider>
  )
}

describe("handleCsvText (pure parse handler)", () => {
  it("returns parsed headers and rows for a valid CSV string", () => {
    const result = handleCsvText(FIXTURE_CSV)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.parsed.headers).toEqual([
      "name",
      "department",
      "gender",
      "salary",
    ])
    expect(result.parsed.rows).toHaveLength(3)
    expect(result.parsed.rows[0]).toEqual([
      "Alice Svensson",
      "Engineering",
      "Kvinna",
      "55000",
    ])
  })

  it("returns errorEmpty for a blank string", () => {
    const result = handleCsvText("")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("errorEmpty")
  })

  it("returns errorEmpty for a whitespace-only string", () => {
    const result = handleCsvText("   \n\n  ")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("errorEmpty")
  })

  it("returns errorEmpty when CSV has headers but no data rows", () => {
    const result = handleCsvText("name,department,gender")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("errorEmpty")
  })

  it("handles a BOM-prefixed UTF-8 CSV", () => {
    const bom = "﻿"
    const result = handleCsvText(`${bom}name,salary\nAlice,50000`)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.parsed.headers).toEqual(["name", "salary"])
    expect(result.parsed.rows).toHaveLength(1)
  })
})

describe("UploadStep component", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the drop title and browse hint", () => {
    renderUploadStep()
    expect(screen.getByText(m.upload.dropTitle)).toBeDefined()
    expect(screen.getByText(m.upload.browseHint)).toBeDefined()
  })

  it("does not show the detection summary when no file has been parsed", () => {
    renderUploadStep({ parsed: null })
    expect(screen.queryByTestId("detected-summary")).toBeNull()
  })

  it("shows the detection summary when a parsed result is provided", () => {
    renderUploadStep({
      parsed: {
        headers: ["name", "salary", "dept"],
        rows: [
          ["Alice", "50000", "HR"],
          ["Bob", "60000", "Eng"],
        ],
      },
    })
    const summary = screen.getByTestId("detected-summary")
    expect(summary.textContent).toContain("2")
    expect(summary.textContent).toContain("3")
  })

  it("calls onParsed with parsed result and raw csvText when a valid CSV file is dropped", async () => {
    const onParsed = vi.fn<(result: ParsedCsv, csvText: string) => void>()
    renderUploadStep({ onParsed })

    const dropZone = screen.getByRole("region")
    const file = new File([FIXTURE_CSV], "payroll.csv", { type: "text/csv" })

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledOnce()
    })
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by toHaveBeenCalledOnce above
    const [parsed, csvText] = onParsed.mock.calls[0]!
    expect(parsed.headers).toEqual(["name", "department", "gender", "salary"])
    expect(parsed.rows).toHaveLength(3)
    // Raw text must be forwarded so Task 5's importPayroll action can use it.
    expect(csvText).toBe(FIXTURE_CSV)
  })

  it("shows errorNotCsv when a non-CSV file is selected via file input", async () => {
    renderUploadStep()

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["<html></html>"], "report.html", {
      type: "text/html",
    })
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        m.upload.errorNotCsv
      )
    })
  })

  it("shows errorEmpty when an empty CSV file is selected", async () => {
    const onParsed = vi.fn()
    renderUploadStep({ onParsed })

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File([""], "empty.csv", { type: "text/csv" })
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        m.upload.errorEmpty
      )
    })
    // onParsed must not have been called.
    expect(onParsed).not.toHaveBeenCalled()
  })
})

describe("ImportWizard — Next button gating", () => {
  afterEach(() => {
    cleanup()
  })

  function renderWizard() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportWizard />
      </NextIntlClientProvider>
    )
  }

  it("disables the Next button before a CSV is parsed", () => {
    renderWizard()
    const nextButton = screen.getByRole("button", {
      name: messages.dashboard.people.import.next,
    })
    expect(nextButton).toHaveProperty("disabled", true)
  })

  it("enables the Next button after a valid CSV is successfully parsed", async () => {
    renderWizard()

    const dropZone = screen.getByRole("region")
    const file = new File([FIXTURE_CSV], "payroll.csv", { type: "text/csv" })

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.queryByTestId("detected-summary")).not.toBeNull()
    })

    const nextButton = screen.getByRole("button", {
      name: messages.dashboard.people.import.next,
    })
    expect(nextButton).toHaveProperty("disabled", false)
  })
})
