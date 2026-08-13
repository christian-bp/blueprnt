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

  it("never wraps content in animation spans, even while streaming", () => {
    // Arrived text is shown exactly as it is: the word-by-word appearance
    // comes from the backend's word-cadence flushes. Any client animation
    // re-ordered visibly across markdown blocks (Streamdown memoizes per
    // block while the animate plugin's seen-before threshold is shared),
    // so an animation span here is a regression, not a nicety.
    const { container } = render(
      <AssistantMarkdown text="Several words in a row." isAnimating={true} />
    )
    expect(container.querySelectorAll("[data-sd-animate]")).toHaveLength(0)
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
