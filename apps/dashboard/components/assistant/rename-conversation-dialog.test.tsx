import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import messages from "@workspace/i18n/messages/en.json"
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
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { RenameConversationDialog } from "@/components/assistant/rename-conversation-dialog"
import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"

const t = messages.dashboard.assistant
const renameConversationMock = mockMutation("assistant.chat.renameConversation")

function renderDialog(currentTitle = "Pay gap trend") {
  const onOpenChange = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RenameConversationDialog
        orgId="org-1"
        threadId={"thread-1" as Id<"assistantThreads">}
        currentTitle={currentTitle}
        open
        onOpenChange={onOpenChange}
      />
    </NextIntlClientProvider>
  )
  return { onOpenChange }
}

describe("RenameConversationDialog", () => {
  beforeEach(() => {
    renameConversationMock.mockReset()
  })
  afterEach(() => cleanup())

  it("is prefilled with the current title and disables save while unchanged", () => {
    renderDialog("Pay gap trend")
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.value).toBe("Pay gap trend")
    const save = screen.getByRole("button", {
      name: t.renameConversationSave,
    })
    expect(save.hasAttribute("disabled")).toBe(true)
  })

  it("blocks submit on an empty title", async () => {
    renderDialog("Pay gap trend")
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)
    const save = screen.getByRole("button", {
      name: t.renameConversationSave,
    })
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(true))
    expect(renameConversationMock).not.toHaveBeenCalled()
  })

  it("saves the trimmed title, toasts success, and closes on success", async () => {
    renameConversationMock.mockResolvedValue(null)
    const { onOpenChange } = renderDialog("Pay gap trend")

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "  Renamed chat  " } })
    fireEvent.blur(input)
    const save = screen.getByRole("button", {
      name: t.renameConversationSave,
    })
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false))
    fireEvent.click(save)

    await waitFor(() => {
      expect(renameConversationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        threadId: "thread-1",
        title: "Renamed chat",
      })
    })
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      messages.dashboard.toast.conversationRenamed
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("toasts an error and keeps the dialog open on failure", async () => {
    renameConversationMock.mockRejectedValue(new Error("boom"))
    const { onOpenChange } = renderDialog("Pay gap trend")

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "Renamed chat" } })
    fireEvent.blur(input)
    const save = screen.getByRole("button", {
      name: t.renameConversationSave,
    })
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false))
    fireEvent.click(save)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("prefills empty for an untitled conversation", () => {
    renderDialog("")
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.value).toBe("")
    const save = screen.getByRole("button", {
      name: t.renameConversationSave,
    })
    // Empty and unchanged: both invalid and not dirty, still disabled.
    expect(save.hasAttribute("disabled")).toBe(true)
  })
})
