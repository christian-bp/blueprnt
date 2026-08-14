import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DocsHashScroll } from "./hash-scroll"

// Reproduces the live defect: opening /docs/<slug>#<anchor> cold left the
// reader at the top of the page because the article streams in after the
// browser has already tried its hash jump.
function renderWithHash(hash: string, scrollY = 0) {
  const target = document.createElement("h2")
  target.id = "lika-arbete"
  const scrollIntoView = vi.fn()
  target.scrollIntoView = scrollIntoView
  document.body.append(target)
  window.location.hash = hash
  Object.defineProperty(window, "scrollY", { value: scrollY, writable: true })
  render(<DocsHashScroll />)
  return scrollIntoView
}

afterEach(() => {
  document.body.innerHTML = ""
  window.location.hash = ""
})

describe("DocsHashScroll", () => {
  it("scrolls to the heading named by the hash", () => {
    expect(renderWithHash("#lika-arbete")).toHaveBeenCalled()
  })

  it("does nothing without a hash", () => {
    expect(renderWithHash("")).not.toHaveBeenCalled()
  })

  it("does nothing when the reader has already scrolled", () => {
    expect(renderWithHash("#lika-arbete", 400)).not.toHaveBeenCalled()
  })

  it("does nothing when the hash names no element on the page", () => {
    expect(renderWithHash("#not-a-heading")).not.toHaveBeenCalled()
  })
})
