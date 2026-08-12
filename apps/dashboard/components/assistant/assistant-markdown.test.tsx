import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AssistantMarkdown } from "@/components/assistant/assistant-markdown"

afterEach(cleanup)

describe("AssistantMarkdown", () => {
  it("renders markdown structure", () => {
    render(
      <AssistantMarkdown
        text={"**Bold** and a [link](https://example.com)\n\n- item"}
      />
    )
    expect(screen.getByText("Bold").tagName).toBe("STRONG")
    // jest-dom is not set up here, so read attributes/text directly rather
    // than toHaveAttribute/toHaveTextContent. Streamdown's default URL
    // transform normalizes a bare-origin URL to its canonical form (adds
    // the trailing slash), same as the WHATWG URL constructor would.
    expect(
      screen.getByRole("link", { name: "link" }).getAttribute("href")
    ).toBe("https://example.com/")
    expect(screen.getByRole("listitem").textContent).toBe("item")
  })

  it("opens links in a new tab", () => {
    render(<AssistantMarkdown text={"[link](https://example.com)"} />)
    expect(screen.getByRole("link").getAttribute("target")).toBe("_blank")
    expect(screen.getByRole("link").getAttribute("rel")).toBe("noreferrer")
  })

  it("does not mark any content as animating by default", () => {
    const { container } = render(
      <AssistantMarkdown text="Several words in a row." />
    )
    expect(container.querySelectorAll("[data-sd-animate]")).toHaveLength(0)
    expect(container.textContent).toBe("Several words in a row.")
  })

  it("marks content with data-sd-animate spans when isAnimating is true", () => {
    // Streamdown's animate plugin wraps every "new" word in its own span
    // (offset-based newness detection: nothing was rendered before this
    // call, so the whole sentence is new). This runs in happy-dom, so we
    // assert the real markup rather than just the prop threading.
    const { container } = render(
      <AssistantMarkdown text="Several words in a row." isAnimating={true} />
    )
    const spans = container.querySelectorAll("[data-sd-animate]")
    expect(spans.length).toBeGreaterThan(0)
    // Wrapping is markup noise: the visible text must still read as the
    // original sentence once the spans are flattened back together.
    expect(container.textContent).toBe("Several words in a row.")
  })
})
