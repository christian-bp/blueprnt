import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// use-stick-to-bottom drives its scroll physics off real layout (scrollHeight,
// ResizeObserver), which happy-dom never produces, so exercising isAtBottom's
// real value here would be untestable. The mock isolates this file to OUR
// wiring: the props we pass into the library, and how we react to its
// context.
const { conversationState, scrollToBottomMock } = vi.hoisted(() => ({
  conversationState: { isAtBottom: true },
  scrollToBottomMock: vi.fn(),
}))

type MockStickToBottomProps = {
  children?: ReactNode
  className?: string
  initial?: string
  resize?: string
  role?: string
  "data-slot"?: string
}

type MockContentProps = {
  children?: ReactNode
  className?: string
  scrollClassName?: string
  "data-slot"?: string
}

vi.mock("use-stick-to-bottom", () => {
  function MockStickToBottom(props: MockStickToBottomProps) {
    return (
      <div
        data-slot={props["data-slot"]}
        data-initial={props.initial}
        data-resize={props.resize}
        role={props.role}
        className={props.className}
      >
        {props.children}
      </div>
    )
  }
  function MockContent(props: MockContentProps) {
    return (
      <div data-scroll-classname={props.scrollClassName}>
        <div data-slot={props["data-slot"]} className={props.className}>
          {props.children}
        </div>
      </div>
    )
  }
  return {
    StickToBottom: Object.assign(MockStickToBottom, { Content: MockContent }),
    useStickToBottomContext: () => ({
      isAtBottom: conversationState.isAtBottom,
      scrollToBottom: scrollToBottomMock,
    }),
  }
})

const reducedMotionMock = vi.fn(() => false)
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>()
  return { ...actual, useReducedMotion: () => reducedMotionMock() }
})

import {
  AssistantConversation,
  AssistantConversationContent,
  AssistantConversationScrollButton,
} from "@/components/assistant/assistant-conversation"

function renderWithIntl(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

describe("AssistantConversation", () => {
  beforeEach(() => {
    conversationState.isAtBottom = true
    scrollToBottomMock.mockReset()
    reducedMotionMock.mockReturnValue(false)
  })
  afterEach(cleanup)

  it("passes a smooth animation behavior by default and carries min-h-0 as its own default", () => {
    const { container } = renderWithIntl(
      <AssistantConversation className="flex-1">
        <div />
      </AssistantConversation>
    )
    const root = container.querySelector(
      '[data-slot="assistant-conversation"]'
    ) as HTMLElement
    expect(root.dataset.initial).toBe("smooth")
    expect(root.dataset.resize).toBe("smooth")
    const classes = root.className.split(/\s+/)
    expect(classes).toContain("min-h-0")
    expect(classes).toContain("flex-1")
  })

  // The library has no notion of the app's MotionConfig, so reduced motion
  // is read explicitly and forces instant positioning instead of the spring
  // follow.
  it("switches to instant under reduced motion", () => {
    reducedMotionMock.mockReturnValue(true)
    const { container } = renderWithIntl(
      <AssistantConversation>
        <div />
      </AssistantConversation>
    )
    const root = container.querySelector(
      '[data-slot="assistant-conversation"]'
    ) as HTMLElement
    expect(root.dataset.initial).toBe("instant")
    expect(root.dataset.resize).toBe("instant")
  })
})

describe("AssistantConversationContent", () => {
  afterEach(cleanup)

  // Aligns with the composer's own inset (assistant-panel.tsx) on the same
  // max-w-3xl, and keeps the gap the message column has always had.
  it("carries the message column's inset, width cap, and gap", () => {
    const { container } = renderWithIntl(
      <AssistantConversationContent>
        <div />
      </AssistantConversationContent>
    )
    const content = container.querySelector(
      '[data-slot="assistant-conversation-content"]'
    ) as HTMLElement
    const classes = content.className.split(/\s+/)
    expect(classes).toContain("px-8")
    expect(classes).toContain("py-6")
    expect(classes).toContain("max-w-3xl")
    expect(classes).toContain("gap-6")
  })

  // The scrollbar treatment must land on the library's own scroll element
  // (the wrapper it renders around this content), not on this div, since
  // this div never scrolls itself.
  it("puts the scrollbar treatment on the library's own scroll element", () => {
    const { container } = renderWithIntl(
      <AssistantConversationContent>
        <div />
      </AssistantConversationContent>
    )
    const scrollElement = container.querySelector(
      "[data-scroll-classname]"
    ) as HTMLElement
    const scrollClassName = scrollElement.dataset.scrollClassname ?? ""
    expect(scrollClassName).toContain("overflow-y-auto")
    expect(scrollClassName).toContain("scroll-fade-b")
  })
})

describe("AssistantConversationScrollButton", () => {
  beforeEach(() => {
    conversationState.isAtBottom = true
    scrollToBottomMock.mockReset()
  })
  afterEach(cleanup)

  it("renders nothing while already at the bottom", () => {
    renderWithIntl(<AssistantConversationScrollButton />)
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.assistant.scrollToBottom,
      })
    ).toBeNull()
  })

  it("appears once scrolled away from the bottom, labeled from i18n, and resumes following on click", () => {
    conversationState.isAtBottom = false
    renderWithIntl(<AssistantConversationScrollButton />)
    const button = screen.getByRole("button", {
      name: messages.dashboard.assistant.scrollToBottom,
    })
    fireEvent.click(button)
    expect(scrollToBottomMock).toHaveBeenCalledOnce()
  })
})
