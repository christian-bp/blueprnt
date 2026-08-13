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
import { mockMutation, onQuery } from "@/test/convex-mocks"

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
    onQuery((ref) =>
      ref === "assistant.chat.getActiveThread" ? null : undefined
    )
  })
  afterEach(() => cleanup())

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

  it("starts a new conversation and disables both edge controls while a reply streams", async () => {
    onQuery((ref) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0 }
      }
      if (ref === "assistant.chat.listMessages") {
        return [
          { _id: "m1", role: "assistant", status: "streaming", parts: [] },
        ]
      }
      return undefined
    })
    renderPage()
    const button = screen.getByRole("button", {
      name: messages.dashboard.assistant.newConversation,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    // History shares the same orphan-guard rationale: switching threads
    // mid-stream would silently orphan the in-flight reply, same as
    // archiving the active thread via New conversation would.
    const historyButton = screen.getByRole("button", {
      name: messages.dashboard.assistant.history,
    }) as HTMLButtonElement
    expect(historyButton.disabled).toBe(true)
  })

  it("starts a new conversation on click when not busy", () => {
    renderPage()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.assistant.newConversation,
      })
    )
    expect(newConversationMock).toHaveBeenCalledExactlyOnceWith({
      orgId: "org-1",
    })
  })

  it("lays out the header as three regions, history left and new conversation right, so the centered title cannot shift either edge control", () => {
    // A thread with a title, so the centered AssistantTitle actually mounts
    // a region between the two edge controls (AnimatePresence renders no
    // node at all while there is no title, per assistant-title.test.tsx).
    onQuery((ref) =>
      ref === "assistant.chat.getActiveThread"
        ? { _id: "thread-1", lastMessageAt: 0, title: "Pay gap trend" }
        : undefined
    )
    const { container } = renderPage()
    const historyButton = screen.getByRole("button", {
      name: messages.dashboard.assistant.history,
    })
    const newConversationButton = screen.getByRole("button", {
      name: messages.dashboard.assistant.newConversation,
    })
    const row = historyButton.closest(".justify-between") as HTMLElement
    expect(row).not.toBeNull()
    expect(row.contains(newConversationButton)).toBe(true)
    expect(screen.getByText("Pay gap trend")).toBeDefined()
    const regions = Array.from(row.children)
    expect(regions).toHaveLength(3)
    expect(regions[0]?.contains(historyButton)).toBe(true)
    expect(regions.at(-1)?.contains(newConversationButton)).toBe(true)
    // The title's own region sits between the two edge wrappers, never
    // inside either one: growing from width 0 to auto can only ever eat
    // into the leftover space between them.
    expect(regions[1]?.contains(historyButton)).toBe(false)
    expect(regions[1]?.contains(newConversationButton)).toBe(false)
    // The header row is a direct child of the full-width page wrapper, a
    // sibling of the rail+column row below it, never nested inside the
    // capped reading column: that is what pins both edge controls to the
    // page content's own corners instead of letting them drift with the
    // column as the rail opens and closes.
    const wrapper = container.firstElementChild as HTMLElement
    expect(row.parentElement).toBe(wrapper)
    expect(wrapper.className).not.toMatch(/max-w-/)
  })

  it("keeps the history rail closed by default, so its thread list is absent from the page", () => {
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
    const historyButton = screen.getByRole("button", {
      name: messages.dashboard.assistant.history,
    })
    expect(historyButton.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("Pay gap trend")).toBeNull()
  })

  it("opens the rail on toggle (revealing the thread list) and closes it again on a second click", async () => {
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
    const historyButton = screen.getByRole("button", {
      name: messages.dashboard.assistant.history,
    })

    fireEvent.click(historyButton)
    expect(historyButton.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("button", { name: /Pay gap trend/ })).toBeDefined()

    fireEvent.click(historyButton)
    expect(historyButton.getAttribute("aria-expanded")).toBe("false")
    // The rail's content exits via AnimatePresence (a fast fade before the
    // outer width collapses, docs/ui-animation.md rule 4), so the unmount
    // lands a tick after the click, not synchronously with it.
    await waitFor(() => {
      expect(screen.queryByText("Pay gap trend")).toBeNull()
    })
  })

  it("switching to a thread from the rail keeps the rail open, since the user is browsing", async () => {
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
    const historyButton = screen.getByRole("button", {
      name: messages.dashboard.assistant.history,
    })
    fireEvent.click(historyButton)
    fireEvent.click(screen.getByRole("button", { name: /Older chat/ }))

    await waitFor(() => {
      expect(switchConversationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        threadId: "thread-old",
      })
    })
    expect(historyButton.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("button", { name: /Older chat/ })).toBeDefined()
  })

  // The rail must scroll on its own (its list can outgrow the page) without
  // ever turning the main column into a second vertical scroller: only
  // MessageScrollerViewport inside AssistantPanel may own that job.
  it("never gives the main column its own vertical scroller when the rail opens", () => {
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
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.assistant.history })
    )

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
    // (the rail's own list), never two.
    const verticalScrollers = container.querySelectorAll(
      '[class*="overflow-y-auto"]'
    )
    expect(verticalScrollers).toHaveLength(1)
  })
})
