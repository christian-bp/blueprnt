import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ScreenShell } from "@/components/onboarding/screen-shell"

describe("ScreenShell", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the heading text accessibly and the content from the start", () => {
    render(
      <ScreenShell heading="Where are you based?">
        <button type="button">pick</button>
      </ScreenShell>
    )
    // The full heading is in the accessibility tree (sr-only span inside the
    // TextEffect h1); the content is mounted immediately (hidden by opacity,
    // so the reveal never shifts layout).
    expect(screen.getByText("Where are you based?")).toBeDefined()
    expect(screen.getByRole("button", { name: "pick" })).toBeDefined()
  })

  it("blocks pointer events until the heading reveal completes", async () => {
    render(
      <ScreenShell heading="Hi">
        <button type="button">pick</button>
      </ScreenShell>
    )
    const wrapper = screen.getByRole("button", { name: "pick" }).parentElement
    expect(wrapper?.style.pointerEvents).toBe("none")
    // Once the TextEffect reveal finishes the content becomes interactive.
    await waitFor(
      () => {
        expect(wrapper?.style.pointerEvents).not.toBe("none")
      },
      { timeout: 3000 }
    )
  })
})
