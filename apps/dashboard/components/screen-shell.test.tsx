import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ScreenShell } from "@/components/screen-shell"

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

  it("renders a plain heading with content immediately visible and interactive when animated is false", () => {
    render(
      <ScreenShell heading="Hi" animated={false}>
        <button type="button">pick</button>
      </ScreenShell>
    )
    // A plain <h1>, not the TextEffect per-word split (no sr-only mirror span).
    const heading = screen.getByRole("heading", { name: "Hi", level: 1 })
    expect(heading.querySelector(".sr-only")).toBeNull()

    const wrapper = screen.getByRole("button", { name: "pick" }).parentElement
    expect(wrapper?.style.pointerEvents).not.toBe("none")
  })

  it("defaults to h1 when headingLevel is not passed", () => {
    render(
      <ScreenShell heading="Hi" animated={false}>
        <button type="button">pick</button>
      </ScreenShell>
    )
    expect(screen.getByRole("heading", { name: "Hi", level: 1 })).toBeDefined()
  })

  it("renders the plain (non-animated) heading at the requested level", () => {
    render(
      <ScreenShell heading="Hi" animated={false} headingLevel="h4">
        <button type="button">pick</button>
      </ScreenShell>
    )
    expect(screen.getByRole("heading", { name: "Hi", level: 4 })).toBeDefined()
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })

  it("renders the animated (TextEffect) heading at the requested level", () => {
    render(
      <ScreenShell heading="Hi" headingLevel="h3">
        <button type="button">pick</button>
      </ScreenShell>
    )
    expect(screen.getByRole("heading", { name: "Hi", level: 3 })).toBeDefined()
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })
})
