import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { ConvexError } from "convex/values"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AssistantChatMessage } from "@/components/assistant/assistant-message"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

// AssistantThread/AssistantComposer are mocked with a minimal interactive
// stand-in so this file stays focused on the panel's own data wiring; their
// own behavior is covered by assistant-thread.test.tsx and
// assistant-composer.test.tsx.
vi.mock("@/components/assistant/assistant-thread", () => ({
  AssistantThread: (props: {
    loading: boolean
    messages: AssistantChatMessage[]
    onSuggestion: (text: string) => void
  }) => (
    <div
      data-testid="thread"
      data-loading={String(props.loading)}
      data-count={props.messages.length}
    >
      <button type="button" onClick={() => props.onSuggestion("Suggested")}>
        suggest
      </button>
    </div>
  ),
}))
vi.mock("@/components/assistant/assistant-composer", () => ({
  AssistantComposer: (props: {
    busy: boolean
    onSend: (text: string) => void
    onStop: () => void
    error?: string
  }) => (
    <div data-testid="composer" data-busy={String(props.busy)}>
      <button type="button" onClick={() => props.onSend("Hello")}>
        send
      </button>
      <button type="button" onClick={props.onStop}>
        stop
      </button>
      {props.error !== undefined ? (
        <p data-testid="send-error">{props.error}</p>
      ) : null}
    </div>
  ),
}))

import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const sendMessageMock = mockMutation("assistant.chat.sendMessage")
const stopGenerationMock = mockMutation("assistant.chat.stopGeneration")

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantPanel />
    </NextIntlClientProvider>
  )
}

describe("AssistantPanel", () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    stopGenerationMock.mockReset()
  })
  afterEach(() => cleanup())

  it("reports loading with no messages while the active-thread query has not resolved", () => {
    onQuery(() => undefined)
    renderPanel()
    const thread = screen.getByTestId("thread")
    expect(thread.dataset.loading).toBe("true")
    expect(thread.dataset.count).toBe("0")
  })

  // min-h-0 lets this div shrink inside the page's bounded height (page.tsx)
  // instead of forcing it to grow past the viewport, which is what pushed
  // the composer below the fold before this fix; flex-1 is what makes it
  // fill that bounded height in the first place.
  it("carries min-h-0 and flex-1 so it can shrink inside the page's bounded height", () => {
    onQuery(() => undefined)
    const { container } = renderPanel()
    const wrapper = container.firstElementChild as HTMLElement
    const classes = wrapper.className.split(/\s+/)
    expect(classes).toContain("min-h-0")
    expect(classes).toContain("flex-1")
  })

  // Matches AssistantThread's own AssistantConversationContent inset
  // (assistant-thread.test.tsx): the same max-w-3xl px-8 on both keeps the
  // composer and the message column's visible content left/right aligned.
  it("insets the composer wrapper the same way as the message column", () => {
    onQuery(() => undefined)
    renderPanel()
    const wrapper = screen.getByTestId("composer").parentElement as HTMLElement
    const classes = wrapper.className.split(/\s+/)
    expect(classes).toContain("px-8")
    expect(classes).toContain("max-w-3xl")
  })

  it("resolves to the empty thread (not loading) when there is no active conversation", () => {
    onQuery((ref) =>
      ref === "assistant.chat.getActiveThread" ? null : undefined
    )
    renderPanel()
    const thread = screen.getByTestId("thread")
    expect(thread.dataset.loading).toBe("false")
    expect(thread.dataset.count).toBe("0")
  })

  it("passes resolved messages and derives busy from the last message's status", () => {
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0 }
      }
      if (ref === "assistant.chat.listMessages") {
        return [
          {
            _id: "m1",
            role: "user",
            status: "complete",
            parts: [{ type: "text", text: "Hi" }],
          },
          { _id: "m2", role: "assistant", status: "streaming", parts: [] },
        ]
      }
      return undefined
    })
    renderPanel()
    const thread = screen.getByTestId("thread")
    expect(thread.dataset.loading).toBe("false")
    expect(thread.dataset.count).toBe("2")
    expect(screen.getByTestId("composer").dataset.busy).toBe("true")
  })

  it("stops generation for the last message while busy", () => {
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0 }
      }
      if (ref === "assistant.chat.listMessages") {
        return [
          { _id: "m2", role: "assistant", status: "streaming", parts: [] },
        ]
      }
      return undefined
    })
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "stop" }))
    expect(stopGenerationMock).toHaveBeenCalledExactlyOnceWith({
      orgId: "org-1",
      messageId: "m2",
    })
  })

  it("sends a message and surfaces a translated error on failure", async () => {
    onQuery((ref) =>
      ref === "assistant.chat.getActiveThread" ? null : undefined
    )
    sendMessageMock.mockRejectedValue(
      new ConvexError({ code: "errors.assistantRateLimited" })
    )
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "send" }))
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledExactlyOnceWith({
        orgId: "org-1",
        text: "Hello",
        locale: "en",
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId("send-error").textContent).toBe(
        messages.errors.assistantRateLimited
      )
    })
  })
})
