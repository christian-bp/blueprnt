import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AssistantComposer } from "@/components/assistant/assistant-composer"

afterEach(cleanup)

function renderComposer(
  props: Partial<Parameters<typeof AssistantComposer>[0]> = {}
) {
  const onSend = vi.fn()
  const onStop = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantComposer
        busy={false}
        onSend={onSend}
        onStop={onStop}
        {...props}
      />
    </NextIntlClientProvider>
  )
  return { onSend, onStop }
}

describe("AssistantComposer", () => {
  it("disables send on empty input", () => {
    renderComposer()
    const button = screen.getByRole("button", {
      name: messages.dashboard.assistant.send,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it("sends on Enter and clears", () => {
    const { onSend } = renderComposer()
    const input = screen.getByPlaceholderText(
      messages.dashboard.assistant.inputPlaceholder
    ) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSend).toHaveBeenCalledWith("hello")
    expect(input.value).toBe("")
  })

  it("does not send on Shift+Enter", () => {
    const { onSend } = renderComposer()
    const input = screen.getByPlaceholderText(
      messages.dashboard.assistant.inputPlaceholder
    )
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it("does not send while composing an IME candidate", () => {
    const { onSend } = renderComposer()
    const input = screen.getByPlaceholderText(
      messages.dashboard.assistant.inputPlaceholder
    )
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it("renders the send control as a round icon button with no visible text label", () => {
    renderComposer()
    const button = screen.getByRole("button", {
      name: messages.dashboard.assistant.send,
    })
    expect(button.className).toContain("rounded-full")
    expect(button.textContent?.trim()).toBe("")
  })

  it("shows stop instead of send while busy, and stop calls onStop", () => {
    const { onStop } = renderComposer({ busy: true })
    expect(
      screen.queryByRole("button", { name: messages.dashboard.assistant.send })
    ).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.assistant.stop })
    )
    expect(onStop).toHaveBeenCalled()
  })

  it("renders an inline error when given one", () => {
    renderComposer({ error: messages.errors.assistantRateLimited })
    expect(screen.getByText(messages.errors.assistantRateLimited)).toBeDefined()
    expect(
      screen.queryByText(messages.dashboard.assistant.disclaimer)
    ).toBeNull()
  })

  it("shows the disclaimer in the same slot when there is no error", () => {
    renderComposer()
    expect(
      screen.getByText(messages.dashboard.assistant.disclaimer)
    ).toBeDefined()
  })

  it("reserves a minimum height for the disclaimer slot instead of a fixed one, so wrapped text can grow it", () => {
    renderComposer()
    const disclaimer = screen.getByText(messages.dashboard.assistant.disclaimer)
    expect(disclaimer.className).toContain("min-h-4")
    expect(disclaimer.className).not.toMatch(/(?<!min-)h-4\b/)
  })
})
