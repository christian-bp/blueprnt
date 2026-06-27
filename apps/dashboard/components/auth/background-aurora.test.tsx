import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { BackgroundAurora } from "./background-aurora"

afterEach(() => cleanup())

describe("BackgroundAurora", () => {
  it("renders a decorative (aria-hidden) layer of blobs", () => {
    const { container } = render(<BackgroundAurora />)
    const layer = container.querySelector('[aria-hidden="true"]')
    expect(layer).not.toBeNull()
    // The three drifting blobs.
    expect(layer?.children.length).toBe(3)
  })
})
