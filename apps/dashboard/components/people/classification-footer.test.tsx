import messages from "@workspace/i18n/messages/en.json"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Person = {
  currentAssignment: { senioritySource: "suggested" | "confirmed" } | null
}
let summaryState: { loading: boolean; people: Person[] }
vi.mock("@/hooks/use-classification-summary", () => ({
  useClassificationSummary: () => summaryState,
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))
// The digit animation is the library's business; these tests are about the
// count's value.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { ClassificationFooter } from "@/components/people/classification-footer"

const conf: Person = { currentAssignment: { senioritySource: "confirmed" } }
const sug: Person = { currentAssignment: { senioritySource: "suggested" } }
const none: Person = { currentAssignment: null }

function renderFooter() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ClassificationFooter />
    </NextIntlClientProvider>
  )
}

describe("ClassificationFooter", () => {
  beforeEach(() => {
    summaryState = { loading: true, people: [] }
  })
  afterEach(() => cleanup())

  it("renders nothing while the summary loads", () => {
    const { container } = renderFooter()
    expect(container.firstElementChild).toBeNull()
  })

  it("renders nothing before the first import", () => {
    summaryState = { loading: false, people: [] }
    const { container } = renderFooter()
    expect(container.firstElementChild).toBeNull()
  })

  it("shows the split across the classify surface's own states", () => {
    summaryState = { loading: false, people: [conf, conf, sug, none] }
    renderFooter()
    expect(
      screen.getByText(messages.dashboard.classify.statusHeading)
    ).toBeTruthy()
    const states = messages.dashboard.classify.state
    for (const [label, count] of [
      [states.confirmed, "2"],
      [states.pending, "1"],
      [states.unclassified, "1"],
    ] as const) {
      const row = screen.getByText(label).parentElement as HTMLElement
      expect(row.textContent).toContain(count)
    }
  })

  it("sizes each share bar to its state's proportion", () => {
    summaryState = { loading: false, people: [conf, conf, sug, none] }
    const { container } = renderFooter()
    const bars = [
      ...container.querySelectorAll<HTMLElement>("[aria-hidden] > span"),
    ]
    expect(bars.map((bar) => bar.style.width)).toEqual(["50%", "25%", "25%"])
  })

  // The regression this pins: with 118 / 2 / 0 the three-digit row's bar sat
  // further left than its siblings', because the value column had no
  // reserved width. Every row shares one width sized from the block's
  // largest count, so the bars hold one vertical line and a live count
  // crossing a digit boundary never nudges its bar.
  it("reserves one value-column width for the whole block", () => {
    summaryState = {
      loading: false,
      people: [...Array.from({ length: 118 }, () => conf), sug, sug],
    }
    const { container } = renderFooter()
    const values = [...container.querySelectorAll<HTMLElement>(".tabular-nums")]
    expect(values).toHaveLength(3)
    expect(values.map((cell) => cell.style.width)).toEqual([
      "3ch",
      "3ch",
      "3ch",
    ])

    cleanup()
    summaryState = { loading: false, people: [conf, sug, none] }
    const { container: small } = renderFooter()
    const smallValues = [
      ...small.querySelectorAll<HTMLElement>(".tabular-nums"),
    ]
    // Never under 2ch: a single-digit block keeps some air, and the common
    // 9 -> 10 crossing does not resize the column.
    expect(smallValues.map((cell) => cell.style.width)).toEqual([
      "2ch",
      "2ch",
      "2ch",
    ])
  })
})
