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

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))

import { AssistantPrompt } from "@/components/assistant/assistant-prompt"
import { mockMutation } from "@/test/convex-mocks"

const sendMessageMock = mockMutation("assistant.chat.sendMessage")
const tAssistant = messages.dashboard.assistant

function renderPrompt() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantPrompt />
    </NextIntlClientProvider>
  )
}

describe("AssistantPrompt", () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => cleanup())

  it("sends the typed message on Enter and navigates to the assistant page", async () => {
    sendMessageMock.mockResolvedValue(undefined)
    renderPrompt()
    const input = screen.getByPlaceholderText(tAssistant.inputPlaceholder)
    fireEvent.change(input, { target: { value: "How many roles do we have?" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledExactlyOnceWith({
        orgId: "org-1",
        text: "How many roles do we have?",
        locale: "en",
        fresh: true,
      })
    })
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledExactlyOnceWith("/assistant")
    )
  })

  it("does not send on Shift+Enter", () => {
    renderPrompt()
    const input = screen.getByPlaceholderText(tAssistant.inputPlaceholder)
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true })
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it("does not send while composing an IME candidate", () => {
    renderPrompt()
    const input = screen.getByPlaceholderText(tAssistant.inputPlaceholder)
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it("disables the send button for empty input, and while a send is pending", async () => {
    let resolveSend: () => void = () => {}
    sendMessageMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve
        })
    )
    renderPrompt()
    const sendButton = screen.getByRole("button", {
      name: tAssistant.send,
    }) as HTMLButtonElement
    expect(sendButton.disabled).toBe(true)

    const input = screen.getByPlaceholderText(tAssistant.inputPlaceholder)
    fireEvent.change(input, { target: { value: "hello" } })
    expect(sendButton.disabled).toBe(false)

    fireEvent.click(sendButton)
    await waitFor(() => expect(sendButton.disabled).toBe(true))
    resolveSend()
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledExactlyOnceWith("/assistant")
    )
  })

  it("sends a suggestion chip's localized text and navigates", async () => {
    sendMessageMock.mockResolvedValue(undefined)
    renderPrompt()
    fireEvent.click(
      screen.getByRole("button", { name: tAssistant.suggestionCriterion })
    )
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledExactlyOnceWith({
        orgId: "org-1",
        text: tAssistant.suggestionCriterion,
        locale: "en",
        fresh: true,
      })
    })
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledExactlyOnceWith("/assistant")
    )
  })

  it("renders a translated inline error on failure and does not navigate", async () => {
    sendMessageMock.mockRejectedValue(
      new ConvexError({ code: "errors.assistantRateLimited" })
    )
    renderPrompt()
    const input = screen.getByPlaceholderText(tAssistant.inputPlaceholder)
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => {
      expect(
        screen.getByText(messages.errors.assistantRateLimited)
      ).toBeDefined()
    })
    expect(pushMock).not.toHaveBeenCalled()

    // The failed send re-enables the button (sending cleared, text kept) so
    // the user can retry without retyping the message.
    const sendButton = screen.getByRole("button", {
      name: tAssistant.send,
    }) as HTMLButtonElement
    expect(sendButton.disabled).toBe(false)
  })
})
