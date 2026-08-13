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
// The panel's own data wiring and states are covered by
// assistant-panel.test.tsx / assistant-thread.test.tsx; here it is a stub so
// this file stays focused on the page's own wrapper and action row.
vi.mock("@/components/assistant/assistant-panel", () => ({
  AssistantPanel: () => <div data-testid="panel" />,
}))

import AssistantPage from "@/app/(app)/assistant/page"
import * as assistantHistoryState from "@/lib/assistant-history-state"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const t = messages.dashboard.assistant
const newConversationMock = mockMutation("assistant.chat.newConversation")
const switchConversationMock = mockMutation("assistant.chat.switchConversation")

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantPage />
    </NextIntlClientProvider>
  )
}

describe("AssistantPage", () => {
  beforeEach(() => {
    newConversationMock.mockReset()
    switchConversationMock.mockReset()
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") return null
      if (ref === "assistant.chat.listThreads") return []
      return undefined
    })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // A wrapper sized by min-h-* is a FLOOR, not a ceiling: once the thread
  // outgrows the viewport the column grows past it, the message scroller
  // never becomes the scroll container, and the composer is pushed below
  // the fold with no scroller that reaches it. AppShell locks the ancestor
  // chrome's height for this route (app-shell.test.tsx), so this wrapper
  // must only ever fill it (min-h-0, flex-1) and never define its own
  // height, with overflow-hidden as a second line of defense.
  it("bounds its own height instead of only flooring it, so nothing can push the composer out of reach", () => {
    const { container } = renderPage()
    const wrapper = container.firstElementChild as HTMLElement
    const classes = wrapper.className.split(/\s+/)
    expect(classes).toContain("min-h-0")
    expect(classes).toContain("flex-1")
    expect(classes).toContain("overflow-hidden")
    expect(classes.some((c) => c.startsWith("min-h-["))).toBe(false)
  })

  it("keeps the conversations panel open by default", () => {
    renderPage()
    // Open: the panel's own header carries New conversation, in normal flow
    // (the absolutely positioned compact stand-in exists only collapsed).
    const newButton = screen.getByRole("button", { name: t.newConversation })
    expect(newButton.closest("div.absolute")).toBeNull()
    // Exactly one control carries this accessible name: the panel's own
    // collapse button (open and closed share the same name, the same idiom
    // as the vendor sidebar's single "Toggle Sidebar" trigger), never two.
    expect(screen.getAllByRole("button", { name: t.history })).toHaveLength(1)
  })

  it("starts collapsed when the persisted choice is closed (mocking the storage read)", () => {
    vi.spyOn(
      assistantHistoryState,
      "initialAssistantHistoryOpen"
    ).mockReturnValue(false)
    renderPage()
    // Collapsed: the compact stand-in carries BOTH of the header's actions
    // as stacked icon buttons (new chat + expand), absolutely positioned at
    // the column's top-left.
    const newButton = screen.getByRole("button", { name: t.newConversation })
    expect(newButton.closest("div.absolute")).not.toBeNull()
    expect(screen.getByRole("button", { name: t.history })).toBeDefined()
  })

  it("collapsing the panel hides it and shows the expand button; expanding restores it", async () => {
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") return null
      if (ref === "assistant.chat.listThreads") {
        return [
          {
            _id: "thread-1",
            title: "Pay gap trend",
            status: "archived",
            lastMessageAt: Date.parse("2026-08-01T12:00:00Z"),
          },
        ]
      }
      return undefined
    })
    renderPage()
    expect(screen.getByText("Pay gap trend")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: t.history }))
    await waitFor(() => {
      expect(screen.queryByText("Pay gap trend")).toBeNull()
    })
    const expandButton = screen.getByRole("button", { name: t.history })
    expect(expandButton).toBeDefined()

    fireEvent.click(expandButton)
    await waitFor(() => {
      expect(screen.getByText("Pay gap trend")).toBeDefined()
    })
  })

  it("the New conversation button lives in the panel and starts a new conversation on click when not busy", () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: t.newConversation }))
    expect(newConversationMock).toHaveBeenCalledExactlyOnceWith({
      orgId: "org-1",
    })
  })

  it("disables the New conversation button while a reply streams", () => {
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0 }
      }
      if (ref === "assistant.chat.listMessages") {
        return [
          { _id: "m1", role: "assistant", status: "streaming", parts: [] },
        ]
      }
      if (ref === "assistant.chat.listThreads") return []
      return undefined
    })
    renderPage()
    const button = screen.getByRole("button", {
      name: t.newConversation,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it("disables the collapsed stand-in's new-chat button while a reply streams", () => {
    vi.spyOn(
      assistantHistoryState,
      "initialAssistantHistoryOpen"
    ).mockReturnValue(false)
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0 }
      }
      if (ref === "assistant.chat.listMessages") {
        return [
          { _id: "m1", role: "assistant", status: "streaming", parts: [] },
        ]
      }
      if (ref === "assistant.chat.listThreads") return []
      return undefined
    })
    renderPage()
    // The compact plus carries the same orphan-hazard gate as the panel's
    // own button; the expand button beside it stays clickable.
    const newButton = screen.getByRole("button", {
      name: t.newConversation,
    }) as HTMLButtonElement
    expect(newButton.closest("div.absolute")).not.toBeNull()
    expect(newButton.disabled).toBe(true)
    const expandButton = screen.getByRole("button", {
      name: t.history,
    }) as HTMLButtonElement
    expect(expandButton.disabled).toBe(false)
  })

  it("lays out the header as three regions, with no buttons and only the centered animated title", () => {
    // A thread with a title, so the centered AssistantTitle actually mounts
    // a region between the two spacer regions (AnimatePresence renders no
    // node at all while there is no title, per assistant-title.test.tsx).
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0, title: "Pay gap trend" }
      }
      if (ref === "assistant.chat.listThreads") return []
      return undefined
    })
    const { container } = renderPage()
    expect(screen.getByText("Pay gap trend")).toBeDefined()
    const row = screen.getByText("Pay gap trend").closest(".justify-between")
    expect(row).not.toBeNull()
    const regions = Array.from((row as HTMLElement).children)
    expect(regions).toHaveLength(3)
    expect(regions[1]?.textContent).toBe("Pay gap trend")
    // Neither spacer region carries a button: the history toggle and New
    // conversation both moved into the panel below.
    expect(regions[0]?.querySelector("button")).toBeNull()
    expect(regions.at(-1)?.querySelector("button")).toBeNull()
    // The header row lives INSIDE the chat-side column (the panel's flex-1
    // sibling), never at the page level: the title must center over the
    // chat, not over the page, so it stays aligned with the conversation as
    // the panel opens and closes. The page wrapper itself carries no width
    // cap; the panel's left edge is what reaches the sidebar border.
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).not.toMatch(/max-w-/)
    const chatColumn = (row as HTMLElement).parentElement as HTMLElement
    expect(chatColumn.className).toContain("flex-1")
    expect(chatColumn.parentElement).toBe(wrapper)
    // The header's own row is above the capped reading column, not inside
    // it: the title spans the chat side's full width.
    expect((row as HTMLElement).className).not.toMatch(/max-w-/)
  })

  it("switching to a thread from the panel keeps the panel open, since the user is browsing", async () => {
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") return null
      if (ref === "assistant.chat.listThreads") {
        return [
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
      }
      return undefined
    })
    switchConversationMock.mockResolvedValue(null)
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /^Older chat/ }))

    await waitFor(() => {
      expect(switchConversationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        threadId: "thread-old",
      })
    })
    expect(screen.getByRole("button", { name: /^Older chat/ })).toBeDefined()
  })

  // The panel must scroll on its own (its list can outgrow the page) without
  // ever turning the main column into a second vertical scroller: only the
  // conversation's own scroll container inside AssistantPanel may own that
  // job.
  it("never gives the main column its own vertical scroller while the panel is open", () => {
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") return null
      if (ref === "assistant.chat.listThreads") {
        return [
          {
            _id: "thread-1",
            title: "Pay gap trend",
            status: "archived",
            lastMessageAt: 0,
          },
        ]
      }
      return undefined
    })
    const { container } = renderPage()

    const mainColumn = screen.getByTestId("panel").parentElement as HTMLElement
    const mainColumnClasses = mainColumn.className.split(/\s+/)
    expect(mainColumnClasses).toContain("overflow-hidden")
    expect(mainColumnClasses.some((c) => c.startsWith("overflow-y-"))).toBe(
      false
    )
    expect(mainColumnClasses.some((c) => c.startsWith("overflow-auto"))).toBe(
      false
    )
    // Exactly one vertical scroller exists anywhere in the rendered tree
    // (the panel's own list), never two.
    const verticalScrollers = container.querySelectorAll(
      '[class*="overflow-y-auto"]'
    )
    expect(verticalScrollers).toHaveLength(1)
  })

  it("widens the chat column to max-w-5xl", () => {
    renderPage()
    const mainColumn = screen.getByTestId("panel").parentElement as HTMLElement
    const mainColumnClasses = mainColumn.className.split(/\s+/)
    expect(mainColumnClasses).toContain("max-w-5xl")
    expect(mainColumnClasses).not.toContain("max-w-4xl")
  })
})
