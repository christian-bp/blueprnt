import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AssistantChatMessage } from "@/components/assistant/assistant-message"

vi.mock("@/components/assistant/assistant-message", () => ({
  AssistantMessage: ({ message }: { message: AssistantChatMessage }) => (
    <div data-testid="message" data-id={message._id} />
  ),
}))

import { AssistantThread } from "@/components/assistant/assistant-thread"

afterEach(cleanup)

function renderThread(props: {
  loading: boolean
  messages: AssistantChatMessage[]
  onSuggestion: (text: string) => void
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantThread {...props} />
    </NextIntlClientProvider>
  )
}

describe("AssistantThread", () => {
  it("shows a content-shaped skeleton while loading", () => {
    const { container } = renderThread({
      loading: true,
      messages: [],
      onSuggestion: vi.fn(),
    })
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(2)
  })

  // Every branch here is a direct flex child of AssistantPanel's bounded
  // min-h-0/flex-1 column (assistant-panel.tsx): each must carry min-h-0
  // itself (and flex-1, to actually fill that space) or it refuses to
  // shrink below its own content height, which is exactly what let the
  // page grow past the viewport and push the composer out of reach.
  it("carries min-h-0 and flex-1 on the loading branch", () => {
    const { container } = renderThread({
      loading: true,
      messages: [],
      onSuggestion: vi.fn(),
    })
    const wrapper = container.firstElementChild as HTMLElement
    const classes = wrapper.className.split(/\s+/)
    expect(classes).toContain("min-h-0")
    expect(classes).toContain("flex-1")
  })

  it("carries min-h-0 and flex-1 on the empty-state branch", () => {
    const { container } = renderThread({
      loading: false,
      messages: [],
      onSuggestion: vi.fn(),
    })
    const empty = container.querySelector('[data-slot="empty"]') as HTMLElement
    const classes = empty.className.split(/\s+/)
    expect(classes).toContain("min-h-0")
    expect(classes).toContain("flex-1")
  })

  it("carries flex-1 on the message-scroller branch (min-h-0 is the vendor's own default)", () => {
    const { container } = renderThread({
      loading: false,
      messages: [{ _id: "1", role: "user", status: "complete", parts: [] }],
      onSuggestion: vi.fn(),
    })
    const scroller = container.querySelector(
      '[data-slot="message-scroller"]'
    ) as HTMLElement
    const classes = scroller.className.split(/\s+/)
    expect(classes).toContain("flex-1")
    expect(classes).toContain("min-h-0")
  })

  it("shows the empty state with three suggestion buttons calling onSuggestion with localized text", () => {
    const onSuggestion = vi.fn()
    renderThread({ loading: false, messages: [], onSuggestion })

    expect(
      screen.getByText(messages.dashboard.assistant.emptyTitle)
    ).toBeDefined()

    const suggestionTexts = [
      messages.dashboard.assistant.suggestionCriterion,
      messages.dashboard.assistant.suggestionGapTrend,
      messages.dashboard.assistant.suggestionPayMapping,
    ]
    const buttons = screen.getAllByRole("button")
    expect(buttons.length).toBe(3)

    for (const text of suggestionTexts) {
      fireEvent.click(screen.getByRole("button", { name: text }))
    }
    expect(onSuggestion).toHaveBeenCalledTimes(3)
    for (const text of suggestionTexts) {
      expect(onSuggestion).toHaveBeenCalledWith(text)
    }
  })

  it("renders one AssistantMessage per message", () => {
    const msgs: AssistantChatMessage[] = [
      { _id: "1", role: "user", status: "complete", parts: [] },
      { _id: "2", role: "assistant", status: "complete", parts: [] },
      { _id: "3", role: "assistant", status: "streaming", parts: [] },
    ]
    renderThread({ loading: false, messages: msgs, onSuggestion: vi.fn() })
    const rendered = screen.getAllByTestId("message")
    expect(rendered.length).toBe(3)
    expect(rendered.map((el) => el.dataset.id)).toEqual(["1", "2", "3"])
  })
})
