import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"

import {
  AssessmentStatusBadge,
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
      "completed",
      <AssessmentStatusBadge calibrated={false} key="l" />,
      detail.completedBadge,
    ],
    [
      "calibrated",
      <AssessmentStatusBadge calibrated key="c" />,
      detail.calibratedBadge,
    ],
    ["method drift", <MethodDriftBadge key="d" />, detail.methodDriftBadge],
  ])("renders %s as a word with no icon", (_name, node, label) => {
    const { container } = renderStatus(node)
    expect(screen.getByText(label)).toBeDefined()
    expect(container.querySelector("svg")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  // The two states are ONE chip, so a calibrated assessment shows the
  // confirmed word INSTEAD of the completed one, never both. Two chips side by
  // side said one fact twice: calibrating requires a completed assessment, so
  // the second could never appear without the first.
  it("shows one chip, not two, once a placement is confirmed", () => {
    renderStatus(<AssessmentStatusBadge calibrated />)
    expect(screen.getByText(detail.calibratedBadge)).toBeDefined()
    expect(screen.queryByText(detail.completedBadge)).toBeNull()
  })

  it("says what a completed-but-incomplete assessment needs", () => {
    renderStatus(<CompletedIncompleteNotice />)
    const notice = screen.getByText(detail.completedIncomplete)
    // Running text a user reads as sentences, so it floors at text-sm.
    expect(notice.className).toContain("text-sm")
  })
})
