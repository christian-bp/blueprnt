import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import { openMenu } from "@/test/menu"

const t = messages.dashboard.assistant
const switchConversationMock = mockMutation("assistant.chat.switchConversation")
const deleteConversationMock = mockMutation("assistant.chat.deleteConversation")

function renderRail(open: boolean, busy = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantHistoryRail open={open} busy={busy} />
    </NextIntlClientProvider>
  )
}

// Scopes a lookup to one thread row, the same idiom as
// family-review-table.test.tsx's rowOf: the trigger's accessible name is now
// per-thread, so two rows can share a query without colliding.
function rowOf(element: Element): HTMLElement {
  const row = element.closest("div.flex.items-center.gap-1")
  if (row === null) throw new Error("no row found for element")
  return row as HTMLElement
}

function rowActionsLabelFor(title: string): string {
  return t.rowActionsLabel.replace("{title}", title)
}

describe("AssistantHistoryRail", () => {
  beforeEach(() => {
    switchConversationMock.mockReset()
    deleteConversationMock.mockReset()
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

  it("shows a content-shaped skeleton while the thread list is loading", () => {
    onQuery(() => undefined)
    const { container } = renderRail(true)
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryByRole("button")).toBeNull()
    // The heading stays the real component while rows load.
    expect(screen.getByText(t.history)).toBeDefined()
  })

  it("does not subscribe to the thread list while closed, only while open", () => {
    const listThreadsQuery = vi.fn(() => [])
    onQuery((ref) =>
      ref === "assistant.chat.listThreads" ? listThreadsQuery() : undefined
    )
    renderRail(false)
    expect(listThreadsQuery).not.toHaveBeenCalled()
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
    // Anchored: the row's actions trigger also carries this title in its
    // own accessible name ("Actions for Pay gap trend"), so an unanchored
    // match would hit both buttons.
    const row = screen.getByRole("button", { name: /^Pay gap trend/ })
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
    // Anchored for the same reason as the titled-thread case above: the
    // row's actions trigger falls back to this same untitled label too.
    expect(
      screen.getByRole("button", { name: new RegExp(`^${t.untitled}`) })
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

    const activeRow = screen.getByRole("button", { name: /^Current chat/ })
    expect(activeRow.getAttribute("aria-current")).toBe("true")
    expect((activeRow as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /^Older chat/ }))
    await waitFor(() => {
      expect(switchConversationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        threadId: "thread-old",
      })
    })
    // Selecting a thread never closes the rail itself; that decision belongs
    // to the page's toggle button, not this component.
    expect(screen.getByRole("button", { name: /^Older chat/ })).toBeDefined()
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
    fireEvent.click(screen.getByRole("button", { name: /^Current chat/ }))
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
    fireEvent.click(screen.getByRole("button", { name: /^Older chat/ }))
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

  it("opens the row menu and shows the delete action, without deleting yet", async () => {
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
    renderRail(true)
    const row = rowOf(screen.getByText("Older chat"))
    await openMenu(
      within(row).getByRole("button", {
        name: rowActionsLabelFor("Older chat"),
      })
    )
    expect(
      screen.getByRole("menuitem", { name: t.deleteConversation })
    ).toBeDefined()
    expect(deleteConversationMock).not.toHaveBeenCalled()
  })

  it("confirming the delete dialog calls deleteConversation and shows a success toast", async () => {
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
    deleteConversationMock.mockResolvedValue(null)
    renderRail(true)
    const row = rowOf(screen.getByText("Older chat"))
    await openMenu(
      within(row).getByRole("button", {
        name: rowActionsLabelFor("Older chat"),
      })
    )
    fireEvent.click(
      screen.getByRole("menuitem", { name: t.deleteConversation })
    )
    fireEvent.click(
      screen.getByRole("button", { name: t.deleteConversationConfirm })
    )

    await waitFor(() => {
      expect(deleteConversationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        threadId: "thread-old",
      })
    })
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      messages.dashboard.toast.conversationDeleted
    )
  })

  it("shows an error toast and keeps the dialog open when deleting fails", async () => {
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
    deleteConversationMock.mockRejectedValue(new Error("boom"))
    renderRail(true)
    const row = rowOf(screen.getByText("Older chat"))
    await openMenu(
      within(row).getByRole("button", {
        name: rowActionsLabelFor("Older chat"),
      })
    )
    fireEvent.click(
      screen.getByRole("menuitem", { name: t.deleteConversation })
    )
    fireEvent.click(
      screen.getByRole("button", { name: t.deleteConversationConfirm })
    )

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
    // The failed delete must not close the dialog: the user can retry
    // without re-opening it from the row menu.
    expect(screen.getByRole("alertdialog")).toBeDefined()
  })

  it("disables the row menu trigger while busy, so it can never be opened mid-stream", () => {
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
    renderRail(true, true)
    const row = rowOf(screen.getByText("Older chat"))
    expect(
      (
        within(row).getByRole("button", {
          name: rowActionsLabelFor("Older chat"),
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it("gives each row's actions trigger a distinct, thread-specific accessible name", () => {
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
    renderRail(true)
    const oldRow = rowOf(screen.getByText("Older chat"))
    const olderRow = rowOf(screen.getByText("Even older chat"))
    const oldTrigger = within(oldRow).getByRole("button", {
      name: rowActionsLabelFor("Older chat"),
    })
    const olderTrigger = within(olderRow).getByRole("button", {
      name: rowActionsLabelFor("Even older chat"),
    })
    expect(oldTrigger.getAttribute("aria-label")).not.toBe(
      olderTrigger.getAttribute("aria-label")
    )
  })
})
