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

import { AssistantHistoryPanel } from "@/components/assistant/assistant-history"
import { toast } from "@/lib/toast"
import { mockMutation, onQuery } from "@/test/convex-mocks"
import { openMenu } from "@/test/menu"

const t = messages.dashboard.assistant
const switchConversationMock = mockMutation("assistant.chat.switchConversation")
const deleteConversationMock = mockMutation("assistant.chat.deleteConversation")
const renameConversationMock = mockMutation("assistant.chat.renameConversation")

function renderPanel(
  open: boolean,
  busy = false,
  overrides: { onNewConversation?: () => void } = {}
) {
  return render(
    // Explicit timeZone: the row's time label formats a clock time, and
    // next-intl treats a missing zone as an environment fallback error; a
    // fixed zone also keeps the asserted times deterministic.
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Europe/Stockholm"
    >
      <AssistantHistoryPanel
        open={open}
        busy={busy}
        onNewConversation={overrides.onNewConversation ?? vi.fn()}
      />
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

describe("AssistantHistoryPanel", () => {
  beforeEach(() => {
    switchConversationMock.mockReset()
    deleteConversationMock.mockReset()
    renameConversationMock.mockReset()
    onQuery((ref) => (ref === "assistant.chat.listThreads" ? [] : undefined))
  })
  afterEach(() => cleanup())

  it("keeps the list mounted but inert while closed, so the collapse slide covers real rows", () => {
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
    renderPanel(false)
    // The width slide clips the content instead of unmounting it; inert is
    // what keeps the closed panel's controls out of the tab order and the
    // accessibility tree.
    expect(screen.getByText("Pay gap trend").closest("[inert]")).not.toBeNull()
    expect(
      screen.getByRole("button", { name: t.newConversation }).closest("[inert]")
    ).not.toBeNull()
  })

  it("shows the New conversation control as a real component while the thread list loads", () => {
    onQuery(() => undefined)
    const { container } = renderPanel(true)
    expect(
      screen.getByRole("button", { name: t.newConversation })
    ).toBeDefined()
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it("calls onNewConversation when its button is clicked", () => {
    const onNewConversation = vi.fn()
    renderPanel(true, false, { onNewConversation })
    fireEvent.click(screen.getByRole("button", { name: t.newConversation }))
    expect(onNewConversation).toHaveBeenCalledOnce()
  })

  it("disables the New conversation button while busy", () => {
    renderPanel(true, true)
    const button = screen.getByRole("button", {
      name: t.newConversation,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
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
    renderPanel(true)
    // Anchored: the row's actions trigger also carries this title in its
    // own accessible name ("Actions for Pay gap trend"), so an unanchored
    // match would hit both buttons.
    const row = screen.getByRole("button", { name: /^Pay gap trend/ })
    expect(row.textContent).toContain("Aug 1, 2026")
  })

  it("shows the localized Today label for a thread last updated earlier today", () => {
    vi.useFakeTimers({ now: new Date(2026, 7, 13, 10, 0).getTime() })
    try {
      onQuery((ref) =>
        ref === "assistant.chat.listThreads"
          ? [
              {
                _id: "thread-1",
                title: "Pay gap trend",
                status: "archived",
                lastMessageAt: new Date(2026, 7, 13, 8, 0).getTime(),
              },
            ]
          : undefined
      )
      renderPanel(true)
      const row = screen.getByRole("button", { name: /^Pay gap trend/ })
      expect(row.textContent).toContain(t.dateToday)
      // The day word alone cannot separate two same-day conversations, so
      // the clock time always rides beside it (8:00 AM in the en locale).
      expect(row.textContent).toMatch(/\d{1,2}[:.]\d{2}/)
    } finally {
      vi.useRealTimers()
    }
  })

  // The rolling-24h-window bug this guards against: the thread is only 20
  // minutes old at the moment it is checked, but it was created on the
  // PREVIOUS calendar day, so it must read "Yesterday", not "Today".
  it("shows the localized Yesterday label for a thread from just before midnight, checked just after", () => {
    vi.useFakeTimers({ now: new Date(2026, 7, 13, 0, 10).getTime() })
    try {
      onQuery((ref) =>
        ref === "assistant.chat.listThreads"
          ? [
              {
                _id: "thread-1",
                title: "Pay gap trend",
                status: "archived",
                lastMessageAt: new Date(2026, 7, 12, 23, 50).getTime(),
              },
            ]
          : undefined
      )
      renderPanel(true)
      const row = screen.getByRole("button", { name: /^Pay gap trend/ })
      expect(row.textContent).toContain(t.dateYesterday)
    } finally {
      vi.useRealTimers()
    }
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
    renderPanel(true)
    // Scoped to the row itself (via its date, which is unique in the tree):
    // the untitled label "New conversation" also happens to be the header's
    // own New-conversation button text, so an unscoped name match would hit
    // both.
    const row = rowOf(screen.getByText(/Aug 1, 2026/))
    expect(
      within(row).getByRole("button", {
        name: new RegExp(`^${t.untitled}`),
      })
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
    renderPanel(true)

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
    // Selecting a thread never closes the panel itself; that decision
    // belongs to the collapse button, not this component.
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
    renderPanel(true)
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
    renderPanel(true)
    fireEvent.click(screen.getByRole("button", { name: /^Older chat/ }))
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
  })

  it("disables every row while busy, so switching can never orphan an in-flight reply", () => {
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
    renderPanel(true, true)
    for (const row of [
      screen.getByRole("button", { name: /^Older chat/ }),
      screen.getByRole("button", { name: /^Even older chat/ }),
    ]) {
      expect((row as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it("shows rename above delete in the row menu, and opens the rename dialog on click", async () => {
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
    renderPanel(true)
    const row = rowOf(screen.getByText("Older chat"))
    await openMenu(
      within(row).getByRole("button", {
        name: rowActionsLabelFor("Older chat"),
      })
    )
    const menuItems = screen.getAllByRole("menuitem")
    expect(menuItems.map((item) => item.textContent)).toEqual([
      t.renameConversation,
      t.deleteConversation,
    ])
    expect(renameConversationMock).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole("menuitem", { name: t.renameConversation })
    )
    expect(
      screen.getByRole("dialog", { name: t.renameConversation })
    ).toBeDefined()
    // Prefilled with the row's own current title.
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "Older chat"
    )
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
    renderPanel(true)
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
    renderPanel(true)
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
    renderPanel(true)
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
    renderPanel(true, true)
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
    renderPanel(true)
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
