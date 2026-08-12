import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
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
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AssistantHistory } from "@/components/assistant/assistant-history"
import { mockMutation, onQuery } from "@/test/convex-mocks"
import { toast } from "@/lib/toast"
import { openMenu } from "@/test/menu"

const t = messages.dashboard.assistant
const switchConversationMock = mockMutation("assistant.chat.switchConversation")

function renderHistory(busy = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantHistory busy={busy} />
    </NextIntlClientProvider>
  )
}

function openHistoryMenu() {
  return openMenu(screen.getByRole("button", { name: t.history }))
}

describe("AssistantHistory", () => {
  beforeEach(() => {
    switchConversationMock.mockReset()
    onQuery((ref) => (ref === "assistant.chat.listThreads" ? [] : undefined))
  })
  afterEach(() => cleanup())

  it("disables the trigger while busy so switching can never orphan an in-flight reply", () => {
    renderHistory(true)
    const trigger = screen.getByRole("button", {
      name: t.history,
    }) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
  })

  it("lists each thread's AI-generated title with its date", async () => {
    onQuery((ref) =>
      ref === "assistant.chat.listThreads"
        ? [
            {
              _id: "thread-1",
              title: "Pay gap trend",
              status: "archived",
              lastMessageAt: Date.parse("2026-08-01T12:00:00Z"),
            },
          ]
        : undefined
    )
    renderHistory()
    await openHistoryMenu()
    const item = screen.getByRole("menuitem", { name: /Pay gap trend/ })
    expect(item.textContent).toContain("Aug 1, 2026")
  })

  it("falls back to the localized untitled label for a thread with no title yet", async () => {
    onQuery((ref) =>
      ref === "assistant.chat.listThreads"
        ? [
            {
              _id: "thread-1",
              status: "archived",
              lastMessageAt: Date.parse("2026-08-01T00:00:00Z"),
            },
          ]
        : undefined
    )
    renderHistory()
    await openHistoryMenu()
    expect(
      screen.getByRole("menuitem", { name: new RegExp(t.untitled) })
    ).toBeDefined()
  })

  it("marks the active thread and switches to a different one on click", async () => {
    onQuery((ref) =>
      ref === "assistant.chat.listThreads"
        ? [
            {
              _id: "thread-active",
              title: "Current chat",
              status: "active",
              lastMessageAt: 200,
            },
            {
              _id: "thread-old",
              title: "Older chat",
              status: "archived",
              lastMessageAt: 100,
            },
          ]
        : undefined
    )
    switchConversationMock.mockResolvedValue(null)
    renderHistory()
    await openHistoryMenu()

    const activeItem = screen.getByRole("menuitem", { name: /Current chat/ })
    expect(activeItem.getAttribute("aria-current")).toBe("true")

    fireEvent.click(screen.getByRole("menuitem", { name: /Older chat/ }))
    await waitFor(() => {
      expect(switchConversationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        threadId: "thread-old",
      })
    })
  })

  it("never calls switchConversation for the already-active thread", async () => {
    onQuery((ref) =>
      ref === "assistant.chat.listThreads"
        ? [
            {
              _id: "thread-active",
              title: "Current chat",
              status: "active",
              lastMessageAt: 200,
            },
          ]
        : undefined
    )
    renderHistory()
    await openHistoryMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: /Current chat/ }))
    expect(switchConversationMock).not.toHaveBeenCalled()
  })

  it("shows an error toast when switching fails", async () => {
    onQuery((ref) =>
      ref === "assistant.chat.listThreads"
        ? [
            {
              _id: "thread-old",
              title: "Older chat",
              status: "archived",
              lastMessageAt: 100,
            },
          ]
        : undefined
    )
    switchConversationMock.mockRejectedValue(new Error("boom"))
    renderHistory()
    await openHistoryMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: /Older chat/ }))
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
  })
})
