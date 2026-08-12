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
    // than toHaveAttribute/toHaveTextContent.
    expect(
      screen.getByRole("link", { name: "link" }).getAttribute("href")
    ).toBe("https://example.com")
    expect(screen.getByRole("listitem").textContent).toBe("item")
  })

  it("opens links in a new tab", () => {
    render(<AssistantMarkdown text={"[link](https://example.com)"} />)
    expect(screen.getByRole("link").getAttribute("target")).toBe("_blank")
  })
})
