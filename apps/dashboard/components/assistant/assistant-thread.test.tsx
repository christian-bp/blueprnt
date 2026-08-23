import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AssistantChatMessage } from "@/components/assistant/assistant-message"
import type { AssistantChatPhase } from "@/hooks/use-assistant-chat"
import { ASSISTANT_SUGGESTION_POOL } from "@/lib/assistant-suggestions"

vi.mock("@/components/assistant/assistant-message", () => ({
  AssistantMessage: ({ message }: { message: AssistantChatMessage }) => (
    <div data-testid="message" data-id={message._id} />
  ),
}))

import { AssistantThread } from "@/components/assistant/assistant-thread"

afterEach(cleanup)

function renderThread(props: {
  phase: AssistantChatPhase
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
  // The regression this pins: while the active thread was still resolving,
  // the surface showed message-bubble bars, and a fresh visitor's settled
  // state is the centered empty hero, so the flash looked nothing like what
  // followed. The resolving beat mirrors the hero instead.
  it("mirrors the empty hero while nobody knows whether a conversation exists", () => {
    const { container } = renderThread({
      phase: "resolving",
      messages: [],
      onSuggestion: vi.fn(),
    })
    expect(container.querySelector('[data-slot="empty"]')).not.toBeNull()
    // One chip-shaped bar per suggestion group, like the settled hero's one
    // chip per group.
    const chips = container.querySelectorAll(
      '[data-slot="skeleton"].rounded-full'
    )
    expect(chips).toHaveLength(ASSISTANT_SUGGESTION_POOL.length)
    // No real, clickable chips yet.
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("shows message-shaped bars only once a conversation is known to exist", () => {
    const { container } = renderThread({
      phase: "loadingMessages",
      messages: [],
      onSuggestion: vi.fn(),
    })
    expect(container.querySelector('[data-slot="empty"]')).toBeNull()
    const bars = container.querySelectorAll('[data-slot="skeleton"]')
    expect(bars).toHaveLength(2)
    expect((bars[0] as HTMLElement).className).toContain("self-end")
  })

  // The chips escaped the vendor's max-w-sm (which stacked every chip on its
  // own line) through the same width override in BOTH branches, so the
  // skeleton always measures what the hero measures.
  it("widens the chip row identically in the resolving and settled states", () => {
    const { container: resolving } = renderThread({
      phase: "resolving",
      messages: [],
      onSuggestion: vi.fn(),
    })
    const resolvingContent = resolving.querySelector(
      '[data-slot="empty-content"]'
    ) as HTMLElement
    expect(resolvingContent.className).toContain("max-w-2xl")
    cleanup()
    const { container: ready } = renderThread({
      phase: "ready",
      messages: [],
      onSuggestion: vi.fn(),
    })
    const readyContent = ready.querySelector(
      '[data-slot="empty-content"]'
    ) as HTMLElement
    expect(readyContent.className).toContain("max-w-2xl")
  })

  // Every branch here is a direct flex child of AssistantPanel's bounded
  // min-h-0/flex-1 column (assistant-panel.tsx): each must carry min-h-0
  // itself (and flex-1, to actually fill that space) or it refuses to
  // shrink below its own content height, which is exactly what let the
  // page grow past the viewport and push the composer out of reach.
  it("carries min-h-0 and flex-1 on the resolving branch", () => {
    const { container } = renderThread({
      phase: "resolving",
      messages: [],
      onSuggestion: vi.fn(),
    })
    const wrapper = container.firstElementChild as HTMLElement
    const classes = wrapper.className.split(/\s+/)
    expect(classes).toContain("min-h-0")
    expect(classes).toContain("flex-1")
  })

  it("carries min-h-0 and flex-1 on the message-loading branch", () => {
    const { container } = renderThread({
      phase: "loadingMessages",
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
      phase: "ready",
      messages: [],
      onSuggestion: vi.fn(),
    })
    const empty = container.querySelector('[data-slot="empty"]') as HTMLElement
    const classes = empty.className.split(/\s+/)
    expect(classes).toContain("min-h-0")
    expect(classes).toContain("flex-1")
  })

  it("carries flex-1 on the conversation branch (min-h-0 is the component's own default)", () => {
    const { container } = renderThread({
      phase: "ready",
      messages: [{ _id: "1", role: "user", status: "complete", parts: [] }],
      onSuggestion: vi.fn(),
    })
    const conversation = container.querySelector(
      '[data-slot="assistant-conversation"]'
    ) as HTMLElement
    const classes = conversation.className.split(/\s+/)
    expect(classes).toContain("flex-1")
    expect(classes).toContain("min-h-0")
  })

  // assistant-panel.tsx's composer wrapper carries the same px-8 on the
  // same max-w-3xl, so the two columns' visible content lines up
  // left/right, not just their outer box.
  it("aligns the message column's inset with the composer", () => {
    const { container } = renderThread({
      phase: "ready",
      messages: [{ _id: "1", role: "user", status: "complete", parts: [] }],
      onSuggestion: vi.fn(),
    })
    const content = container.querySelector(
      '[data-slot="assistant-conversation-content"]'
    ) as HTMLElement
    const classes = content.className.split(/\s+/)
    expect(classes).toContain("px-8")
    expect(classes).toContain("max-w-3xl")
  })

  it("shows the empty state with three suggestion buttons calling onSuggestion with localized text", () => {
    const onSuggestion = vi.fn()
    renderThread({ phase: "ready", messages: [], onSuggestion })

    expect(
      screen.getByText(messages.dashboard.assistant.emptyTitle)
    ).toBeDefined()

    // The chips are DRAWN from a pool at mount, so the test reads what this
    // mount rendered rather than naming questions: one chip per capability
    // family, each carrying a translated label from the pool.
    const buttons = screen.getAllByRole("button")
    expect(buttons.length).toBe(ASSISTANT_SUGGESTION_POOL.length)
    const suggestionTexts = buttons.map((button) => button.textContent ?? "")
    for (const text of suggestionTexts) {
      expect(Object.values(messages.dashboard.assistant)).toContain(text)
    }

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
    renderThread({ phase: "ready", messages: msgs, onSuggestion: vi.fn() })
    const rendered = screen.getAllByTestId("message")
    expect(rendered.length).toBe(3)
    expect(rendered.map((el) => el.dataset.id)).toEqual(["1", "2", "3"])
  })
})
