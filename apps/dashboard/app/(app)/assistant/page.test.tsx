import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

  it("starts a new conversation and disables the button while a reply streams", async () => {
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
})
