import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

// Mock motion/react to avoid animation complexity in tests.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children?: React.ReactNode
    }) => <div {...props}>{children}</div>,
  },
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

// Mock the account menu to avoid its Convex dependencies.
vi.mock("@/components/account-menu", () => ({
  AccountMenu: () => null,
}))

import { handleCsvText } from "./upload-step"
import { UploadStep } from "./upload-step"

const FIXTURE_CSV = `name,department,gender,salary
Alice Svensson,Engineering,Kvinna,55000
Bob Lindgren,Marketing,Man,62000
Carol Johansson,HR,Kvinna,48000`

const m = messages.dashboard.people.import

function renderUploadStep({
  parsed = null,
  onParsed = vi.fn(),
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

  it("renders the choose-file button and drop hint", () => {
    renderUploadStep()
    expect(
      screen.getByRole("button", { name: m.upload.chooseFile })
    ).toBeDefined()
    expect(screen.getByText(m.upload.dropHint)).toBeDefined()
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

  it("calls onParsed and clears error when a valid CSV file is dropped", async () => {
    const onParsed = vi.fn()
    renderUploadStep({ onParsed })

    const dropZone = screen.getByRole("region")
    const file = new File([FIXTURE_CSV], "payroll.csv", { type: "text/csv" })

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledOnce()
    })
    const [arg] = onParsed.mock.calls[0] as [
      { headers: string[]; rows: string[][] },
    ]
    expect(arg.headers).toEqual(["name", "department", "gender", "salary"])
    expect(arg.rows).toHaveLength(3)
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
