import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"

import {
  CalibratedBadge,
  CompletedIncompleteNotice,
  MethodDriftBadge,
} from "@/components/assessment-status"

const detail = messages.dashboard.roles.detail

function renderStatus(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

describe("assessment status", () => {
  afterEach(() => cleanup())

  // The owner's standing ruling: statuses at chip scale are words, not icons.
  // A glyph beside the word "Completed" adds nothing the word does not, and
  // a row of small icons reads as a toolbar rather than as state.
  it.each([
    [
      "calibrated",
      <CalibratedBadge calibrated key="c" />,
      detail.calibratedBadge,
    ],
    ["method drift", <MethodDriftBadge key="d" />, detail.methodDriftBadge],
  ])("renders %s as a word with no icon", (_name, node, label) => {
    const { container } = renderStatus(node)
    expect(screen.getByText(label)).toBeDefined()
    expect(container.querySelector("svg")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  // Nothing at all while the assessment is merely completed. Every surface
  // that showed a "Completed" chip also proved completion beside it: a level
  // chip, a weighting figure, or a notice already saying the word. A chip that
  // repeats what the thing next to it demonstrates is one the reader has to
  // read before discovering it says nothing.
  it("says nothing until a placement is confirmed", () => {
    const { container } = renderStatus(<CalibratedBadge calibrated={false} />)
    expect(container.textContent).toBe("")
  })

  it("says what a completed-but-incomplete assessment needs", () => {
    renderStatus(<CompletedIncompleteNotice />)
    const notice = screen.getByText(detail.completedIncomplete)
    // Running text a user reads as sentences, so it floors at text-sm.
    expect(notice.className).toContain("text-sm")
  })
})
