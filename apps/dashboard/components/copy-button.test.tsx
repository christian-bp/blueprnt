import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CopyButton } from "./copy-button"

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  })
})
afterEach(() => cleanup())

describe("CopyButton", () => {
  it("copies the value and shows the copied label on click", async () => {
    render(
      <CopyButton value="abc-123" copiedLabel="Copied">
        Copy
      </CopyButton>
    )
    expect(screen.getByText("Copy")).toBeDefined()
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("abc-123")
      expect(screen.getByText("Copied")).toBeDefined()
    })
  })
})
