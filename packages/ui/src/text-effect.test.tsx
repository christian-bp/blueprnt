import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TextEffect } from "@workspace/ui/text-effect"

describe("TextEffect", () => {
  afterEach(() => {
    cleanup()
  })

  it("keeps the full text available to assistive tech", () => {
    render(
      <TextEffect as="h1" preset="blur" per="word">
        Where are you based?
      </TextEffect>
    )
    // The sr-only span carries the whole string; the animated segments are
    // aria-hidden duplicates.
    expect(screen.getByText("Where are you based?")).toBeDefined()
    expect(
      document.querySelectorAll('[aria-hidden="true"]').length
    ).toBeGreaterThan(0)
  })

  it("renders the requested tag with the given className", () => {
    render(
      <TextEffect as="h1" className="font-semibold" preset="blur" per="word">
        Hello world
      </TextEffect>
    )
    const heading = document.querySelector("h1")
    expect(heading).not.toBeNull()
    expect(heading?.className).toContain("font-semibold")
  })

  it("fires onAnimationComplete once the reveal finishes", async () => {
    const onComplete = vi.fn()
    render(
      <TextEffect
        as="h2"
        preset="fade"
        per="word"
        speedReveal={10}
        speedSegment={10}
        onAnimationComplete={onComplete}
      >
        Quick text
      </TextEffect>
    )
    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )
  })
})
