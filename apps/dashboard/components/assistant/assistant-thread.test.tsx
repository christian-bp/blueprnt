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
