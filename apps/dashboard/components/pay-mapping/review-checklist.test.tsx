import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider, useTranslations } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  chapterMeta,
  type ChecklistRowBase,
  ChecklistRows,
  ChecklistSearchSection,
} from "./review-checklist"

const tJourney = messages.dashboard.payMapping.journey

// chapterMeta takes the real useTranslations return value (typed to the
// journey namespace), so a probe component renders it through the actual
// hook rather than a hand-rolled stand-in for next-intl's formatting.
function ChapterMetaProbe({ done, total }: { done: number; total: number }) {
  const t = useTranslations("dashboard.payMapping.journey")
  const meta = chapterMeta({ done, total }, t)
  return <span data-testid="meta">{meta ?? "(undefined)"}</span>
}

function renderMeta(done: number, total: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChapterMetaProbe done={done} total={total} />
    </NextIntlClientProvider>
  )
}

function row(overrides: Partial<ChecklistRowBase> = {}): ChecklistRowBase {
  return {
    id: "row-1",
    label: "Row label",
    srStatus: "To review",
    done: false,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe("chapterMeta", () => {
  it("returns undefined when the chapter's total is zero (nothing requires documentation)", () => {
    renderMeta(0, 0)
    expect(screen.getByTestId("meta").textContent).toBe("(undefined)")
  })

  it("returns the journey's own 'done of total' string once the chapter has a total", () => {
    renderMeta(2, 4)
    expect(screen.getByTestId("meta").textContent).toBe(
      tJourney.count.replace("{done}", "2").replace("{total}", "4")
    )
  })

  it("still reports the count when done is zero but total is not", () => {
    renderMeta(0, 3)
    expect(screen.getByTestId("meta").textContent).toBe(
      tJourney.count.replace("{done}", "0").replace("{total}", "3")
    )
  })
})

describe("ChecklistRows", () => {
  it("renders each row's label and sr-only status, marks the current row aria-current, and fires onSelect with the clicked row", () => {
    const rows = [
      row({ id: "a", label: "Start", srStatus: "Done", done: true }),
      row({ id: "b", label: "Praxis", srStatus: "To review", done: false }),
    ]
    const onSelect = vi.fn()
    render(<ChecklistRows rows={rows} currentId="b" onSelect={onSelect} />)

    const startButton = screen.getByText("Start").closest("button")
    const praxisButton = screen.getByText("Praxis").closest("button")
    expect(startButton?.getAttribute("aria-current")).toBeNull()
    expect(praxisButton?.getAttribute("aria-current")).toBe("true")

    // The done state is sr-only text next to the label, not a visible badge.
    expect(startButton?.querySelector(".sr-only")?.textContent).toBe("Done")
    expect(praxisButton?.querySelector(".sr-only")?.textContent).toBe(
      "To review"
    )

    fireEvent.click(startButton as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith(rows[0])
  })

  it("marks no row as current when currentId matches none of them", () => {
    const rows = [row({ id: "a" })]
    render(<ChecklistRows rows={rows} currentId={null} onSelect={vi.fn()} />)
    expect(
      screen
        .getByText("Row label")
        .closest("button")
        ?.getAttribute("aria-current")
    ).toBeNull()
  })
})

describe("ChecklistSearchSection", () => {
  it("renders nothing when its rows are empty (a chapter with no search hits)", () => {
    const { container } = render(
      <ChecklistSearchSection
        title="Praxis"
        meta="2 of 4"
        rows={[]}
        currentId={null}
        onSelect={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe("")
  })

  it("renders the title, the meta, and every matching row", () => {
    const rows = [row({ id: "a", label: "Pay policy" })]
    const onSelect = vi.fn()
    render(
      <ChecklistSearchSection
        title="Praxis"
        meta="2 of 4"
        rows={rows}
        currentId="a"
        onSelect={onSelect}
      />
    )
    expect(screen.getByText("Praxis")).toBeDefined()
    expect(screen.getByText("2 of 4")).toBeDefined()
    const rowButton = screen.getByText("Pay policy").closest("button")
    expect(rowButton?.getAttribute("aria-current")).toBe("true")

    fireEvent.click(rowButton as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith(rows[0])
  })

  it("omits the meta span entirely when meta is undefined (the start row, never countable)", () => {
    render(
      <ChecklistSearchSection
        title="Collaboration"
        meta={undefined}
        rows={[row()]}
        currentId={null}
        onSelect={vi.fn()}
      />
    )
    const heading = screen.getByText("Collaboration").closest("h4")
    expect(heading?.textContent).toBe("Collaboration")
  })
})
