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

import { AssistantHistoryRail } from "@/components/assistant/assistant-history"
import { toast } from "@/lib/toast"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const t = messages.dashboard.assistant
const switchConversationMock = mockMutation("assistant.chat.switchConversation")

function renderRail(open: boolean, busy = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantHistoryRail open={open} busy={busy} />
    </NextIntlClientProvider>
  )
}

describe("AssistantHistoryRail", () => {
  beforeEach(() => {
    switchConversationMock.mockReset()
    onQuery((ref) => (ref === "assistant.chat.listThreads" ? [] : undefined))
  })
  afterEach(() => cleanup())

  it("keeps its thread list out of the tree while closed", () => {
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
    renderRail(false)
    expect(screen.queryByText("Pay gap trend")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("lists each thread's AI-generated title with its date while open", () => {
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
    renderRail(true)
    const row = screen.getByRole("button", { name: /Pay gap trend/ })
    expect(row.textContent).toContain("Aug 1, 2026")
  })

  it("falls back to the localized untitled label for a thread with no title yet", () => {
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
    renderRail(true)
    expect(
      screen.getByRole("button", { name: new RegExp(t.untitled) })
    ).toBeDefined()
  })

  it("marks the active thread as disabled and switches to a different one on click", async () => {
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
    renderRail(true)

    const activeRow = screen.getByRole("button", { name: /Current chat/ })
    expect(activeRow.getAttribute("aria-current")).toBe("true")
    expect((activeRow as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /Older chat/ }))
    await waitFor(() => {
      expect(switchConversationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        threadId: "thread-old",
      })
    })
    // Selecting a thread never closes the rail itself; that decision belongs
    // to the page's toggle button, not this component.
    expect(screen.getByRole("button", { name: /Older chat/ })).toBeDefined()
  })

  it("never calls switchConversation for the already-active thread", () => {
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
    renderRail(true)
    fireEvent.click(screen.getByRole("button", { name: /Current chat/ }))
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
    renderRail(true)
    fireEvent.click(screen.getByRole("button", { name: /Older chat/ }))
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
  })

  it("disables every non-active row while busy, so switching can never orphan an in-flight reply", () => {
    onQuery((ref) =>
      ref === "assistant.chat.listThreads"
        ? [
            {
              _id: "thread-old",
              title: "Older chat",
              status: "archived",
              lastMessageAt: 100,
            },
            {
              _id: "thread-older",
              title: "Even older chat",
              status: "archived",
              lastMessageAt: 50,
            },
          ]
        : undefined
    )
    renderRail(true, true)
    for (const row of screen.getAllByRole("button")) {
      expect((row as HTMLButtonElement).disabled).toBe(true)
    }
  })
})
