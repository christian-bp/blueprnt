import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"

import {
  CalibratedBadge,
  LockedBadge,
  LockedIncompleteNotice,
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
  // A lock glyph beside the word "Locked" adds nothing the word does not, and
  // a row of small icons reads as a toolbar rather than as state.
  it.each([
    ["locked", <LockedBadge key="l" />, detail.lockedBadge],
    ["calibrated", <CalibratedBadge key="c" />, detail.calibratedBadge],
    ["method drift", <MethodDriftBadge key="d" />, detail.methodDriftBadge],
  ])("renders %s as a word with no icon", (_name, node, label) => {
    const { container } = renderStatus(node)
    expect(screen.getByText(label)).toBeDefined()
    expect(container.querySelector("svg")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("says what a locked-but-incomplete assessment needs", () => {
    renderStatus(<LockedIncompleteNotice />)
    const notice = screen.getByText(detail.lockedIncomplete)
    // Running text a user reads as sentences, so it floors at text-sm.
    expect(notice.className).toContain("text-sm")
  })
})
