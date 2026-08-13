import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  AssistantMarkdown,
  isInternalHref,
} from "@/components/assistant/assistant-markdown"

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

  it("opens external links in a new tab", () => {
    render(<AssistantMarkdown text={"[link](https://example.com)"} />)
    expect(screen.getByRole("link").getAttribute("target")).toBe("_blank")
    expect(screen.getByRole("link").getAttribute("rel")).toBe("noreferrer")
  })

  it("carries the chat typography accents on the wrapper", () => {
    const { container } = render(<AssistantMarkdown text={"1. item"} />)
    const wrapper = container.firstElementChild as HTMLElement
    // marker: is inheritable, so the one wrapper class colours every list
    // marker; the link underline-offset rides the same wrapper.
    expect(wrapper.className).toContain("marker:text-brand")
    expect(wrapper.className).toContain("[&_a]:underline-offset-4")
  })

  it("renders a link to one of the app's own pages as in-app navigation", () => {
    render(<AssistantMarkdown text={"[Roller](/roles)"} />)
    const link = screen.getByRole("link")
    expect(link.getAttribute("href")).toBe("/roles")
    expect(link.getAttribute("target")).toBeNull()
    expect(link.getAttribute("rel")).toBeNull()
  })

  // The internal/external split must hold on the predicate's own strength,
  // never on Streamdown's harden pass happening to rewrite these shapes
  // first: a dependency bump or a rehypePlugins prop on the Streamdown call
  // would silently remove that upstream net.
  it("never treats a protocol-relative or backslash href as internal", () => {
    expect(isInternalHref("/")).toBe(true)
    expect(isInternalHref("/roles")).toBe(true)
    expect(isInternalHref("/pay-mappings")).toBe(true)
    expect(isInternalHref("//evil.example")).toBe(false)
    expect(isInternalHref("/\\evil.example")).toBe(false)
    expect(isInternalHref("https://evil.example")).toBe(false)
    expect(isInternalHref("mailto:x@evil.example")).toBe(false)
    expect(isInternalHref("")).toBe(false)
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

  it("does not render model-authored image elements", () => {
    const { container } = render(
      <AssistantMarkdown
        text={
          "Here is some text.\n\n![Trend](https://example.com/chart.png)\n\nMore text."
        }
      />
    )
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain("Here is some text")
    expect(container.textContent).toContain("More text")
  })
})
