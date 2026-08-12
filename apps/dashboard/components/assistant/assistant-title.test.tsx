import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AssistantTitle } from "@/components/assistant/assistant-title"

describe("AssistantTitle", () => {
  afterEach(() => cleanup())

  it("renders nothing while there is no title yet", () => {
    const { container } = render(<AssistantTitle title={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it("animates in the title text once it lands", () => {
    render(<AssistantTitle title="Pay gap trend" />)
    expect(screen.getByText("Pay gap trend")).toBeDefined()
  })

  it("crossfades to a new title, the old one gone once the new one lands", async () => {
    const { rerender } = render(<AssistantTitle title="Pay gap trend" />)
    expect(screen.getByText("Pay gap trend")).toBeDefined()

    rerender(<AssistantTitle title="Headcount overview" />)

    // Synchronous, before any waiting: mode="wait" keeps the OUTGOING title
    // mounted through its own exit animation rather than swapping instantly,
    // so it is still in the DOM in this same tick. This is what an `exit`
    // prop on the motion.span buys: without one, there is nothing to
    // sequence and the old node would already be gone here.
    expect(screen.getByText("Pay gap trend")).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText("Headcount overview")).toBeDefined()
      expect(screen.queryByText("Pay gap trend")).toBeNull()
    })
  })

  it("clears the title text once a thread with no title takes its place", async () => {
    const { rerender, container } = render(
      <AssistantTitle title="Pay gap trend" />
    )
    rerender(<AssistantTitle title={undefined} />)

    await waitFor(() => {
      expect(screen.queryByText("Pay gap trend")).toBeNull()
      expect(container.firstChild).toBeNull()
    })
  })
})
