import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AssistantMessage } from "@/components/assistant/assistant-message"

vi.mock("@/components/assistant/assistant-chart-part", () => ({
  AssistantChartPart: ({ chart }: { chart: string }) => (
    <div data-testid={`chart-${chart}`} />
  ),
}))

afterEach(cleanup)

function renderMessage(
  message: Parameters<typeof AssistantMessage>[0]["message"]
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantMessage message={message} />
    </NextIntlClientProvider>
  )
}

describe("AssistantMessage", () => {
  it("renders a user text part in a muted bubble", () => {
    const { container } = renderMessage({
      _id: "1",
      role: "user",
      status: "complete",
      parts: [{ type: "text", text: "hello" }],
    })
    expect(screen.getByText("hello")).toBeDefined()
    expect(container.querySelector('[data-variant="muted"]')).not.toBeNull()
  })

  it("renders assistant markdown and a chart part in order", () => {
    renderMessage({
      _id: "2",
      role: "assistant",
      status: "complete",
      parts: [
        { type: "chart", chart: "payGapTrend", summary: "s" },
        { type: "text", text: "**improving**" },
      ],
    })
    const chart = screen.getByTestId("chart-payGapTrend")
    const strong = screen.getByText("improving")
    expect(strong.tagName).toBe("STRONG")
    // jest-dom is not set up here; DOCUMENT_POSITION_FOLLOWING confirms the
    // chart part rendered before the text part, matching the parts array
    // order rather than merely both being present.
    expect(
      chart.compareDocumentPosition(strong) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("shows a shimmering thinking indicator while streaming with no parts yet", () => {
    renderMessage({
      _id: "3",
      role: "assistant",
      status: "streaming",
      parts: [],
    })
    const pending = screen.getByTestId("assistant-pending")
    expect(pending.className).toContain("shimmer")
    expect(pending.textContent).toBe(messages.dashboard.assistant.thinking)
  })

  it("shows the checking-data text in the pending slot when a tool call is the first stream event", () => {
    renderMessage({
      _id: "3a",
      role: "assistant",
      status: "streaming",
      parts: [],
      activity: "checkingData",
    })
    const pending = screen.getByTestId("assistant-pending")
    expect(pending.className).toContain("shimmer")
    expect(pending.textContent).toBe(messages.dashboard.assistant.checkingData)
    expect(screen.queryByText(messages.dashboard.assistant.thinking)).toBeNull()
  })

  it("shows the checking-data shimmer after already-streamed parts", () => {
    const { container } = renderMessage({
      _id: "3b",
      role: "assistant",
      status: "streaming",
      parts: [{ type: "text", text: "So far" }],
      activity: "checkingData",
    })
    const activity = screen.getByTestId("assistant-activity")
    expect(activity.className).toContain("shimmer")
    expect(activity.textContent).toBe(messages.dashboard.assistant.checkingData)
    // The already-streamed part stays visible, and the shimmer renders
    // after it, not instead of it. This message is still streaming, so
    // AssistantMarkdown animates its text: "So far" renders as two
    // per-word spans rather than one text node, so we query the paragraph
    // element directly and compare textContent instead of getByText("So far").
    const soFar = container.querySelector("p")
    expect(soFar?.textContent).toBe("So far")
    expect(
      soFar &&
        soFar.compareDocumentPosition(activity) &
          Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("does not show the checking-data shimmer once a reply is no longer streaming", () => {
    renderMessage({
      _id: "3c",
      role: "assistant",
      status: "complete",
      parts: [{ type: "text", text: "Done" }],
      activity: "checkingData",
    })
    expect(screen.queryByTestId("assistant-activity")).toBeNull()
  })

  it("shows the failure text for a failed reply", () => {
    renderMessage({ _id: "4", role: "assistant", status: "failed", parts: [] })
    expect(screen.getByText(messages.dashboard.assistant.failed)).toBeDefined()
  })

  it("shows the personal-data explanation for a screened reply", () => {
    renderMessage({
      _id: "4b",
      role: "assistant",
      status: "failed",
      parts: [],
      errorCode: "errors.assistantPersonalData",
    })
    expect(
      screen.getByText(messages.errors.assistantPersonalData)
    ).toBeDefined()
  })

  it("marks a stopped reply", () => {
    renderMessage({
      _id: "5",
      role: "assistant",
      status: "stopped",
      parts: [{ type: "text", text: "partial" }],
    })
    expect(screen.getByText("partial")).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.assistant.stoppedNote)
    ).toBeDefined()
  })
})
