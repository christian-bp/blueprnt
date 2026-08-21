import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Only the reduced-motion hook is stubbed; the real motion components still
// render, so the assertions run against the markup the app ships.
const reducedMotionMock = vi.fn(() => false)
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reducedMotionMock(),
}))

import { CelebrationBurst } from "./celebration-burst"

afterEach(() => {
  cleanup()
  reducedMotionMock.mockReturnValue(false)
})

const BURST = '[data-testid="success-confetti"]'

describe("CelebrationBurst", () => {
  it("renders its children", () => {
    const { getByText } = render(
      <CelebrationBurst active={false}>
        <span>a card</span>
      </CelebrationBurst>
    )
    expect(getByText("a card")).toBeDefined()
  })

  it("throws a burst when active", () => {
    const { container } = render(
      <CelebrationBurst active={true}>
        <span>a card</span>
      </CelebrationBurst>
    )
    expect(container.querySelector(BURST)).not.toBeNull()
  })

  it("throws nothing when not active", () => {
    const { container } = render(
      <CelebrationBurst active={false}>
        <span>a card</span>
      </CelebrationBurst>
    )
    expect(container.querySelector(BURST)).toBeNull()
  })

  // The burst has to render BEFORE the children in the DOM: an opaque child
  // then paints over the portion that overlaps it, so no piece is ever
  // visible sandwiched behind the content it celebrates. Reordering these
  // silently breaks that occlusion.
  it("places the burst before its children so opaque content occludes it", () => {
    const { container } = render(
      <CelebrationBurst active={true}>
        <span data-testid="content">a card</span>
      </CelebrationBurst>
    )
    const children = [...(container.firstElementChild?.children ?? [])]
    const burstIndex = children.findIndex((child) => child.matches(BURST))
    const contentIndex = children.findIndex(
      (child) => child.getAttribute("data-testid") === "content"
    )
    expect(burstIndex).toBeGreaterThanOrEqual(0)
    expect(contentIndex).toBeGreaterThan(burstIndex)
  })

  it("renders no burst under reduced motion even while active", () => {
    reducedMotionMock.mockReturnValue(true)
    const { container } = render(
      <CelebrationBurst active={true}>
        <span>a card</span>
      </CelebrationBurst>
    )
    expect(container.querySelector(BURST)).toBeNull()
  })
})
