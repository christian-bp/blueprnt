import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { ConvexError } from "convex/values"
import { ASSISTANT_SUGGESTION_POOL } from "@/lib/assistant-suggestions"
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

// The chips are DRAWN from a pool at mount, so no fixed question can be looked
// for here. Every chip is a plain button; the send control is the only one in
// the prompt carrying an aria-label, which is what separates them.
function suggestionChips() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-label") === null)
}

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

  it('renders the send control as a round icon button with no visible "Send" text, but keeps its accessible name', () => {
    renderPrompt()
    const button = screen.getByRole("button", { name: tAssistant.send })
    expect(button.className).toContain("rounded-full")
    expect(button.textContent?.trim()).toBe("")
  })

  it("renders the send control gray until there is typed text, then switches to the brand look", () => {
    renderPrompt()
    const button = screen.getByRole("button", {
      name: tAssistant.send,
    }) as HTMLButtonElement
    expect(button.className).toContain("bg-secondary")
    expect(button.className).not.toContain("bg-primary")

    const input = screen.getByPlaceholderText(tAssistant.inputPlaceholder)
    fireEvent.change(input, { target: { value: "hello" } })
    expect(button.className).toContain("bg-primary")
    expect(button.className).not.toContain("bg-secondary")
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

  it("offers one chip per group and sends the chip's own localized text", async () => {
    sendMessageMock.mockResolvedValue(undefined)
    renderPrompt()
    const chips = suggestionChips()
    // One per capability family, whatever this mount happened to draw.
    expect(chips).toHaveLength(ASSISTANT_SUGGESTION_POOL.length)
    const label = chips[0]?.textContent ?? ""
    // Drawn from the pool, and translated: a raw key would fail both checks.
    expect(Object.values(tAssistant)).toContain(label)

    fireEvent.click(chips[0] as HTMLElement)
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledExactlyOnceWith({
        orgId: "org-1",
        text: label,
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

  it("reserves a minimum height for the error slot instead of a fixed one, so wrapped text can grow it", () => {
    const { container } = renderPrompt()
    const slot = container.querySelector("p.text-destructive")
    expect(slot?.className).toContain("min-h-5")
    expect(slot?.className).not.toMatch(/(?<!min-)h-5\b/)
  })
})
