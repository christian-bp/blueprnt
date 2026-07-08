import { describe, expect, it, vi } from "vitest"
import { onSelectValue } from "./select"

describe("onSelectValue", () => {
  it("forwards non-null values to the handler", () => {
    const handler = vi.fn()
    onSelectValue(handler)("sek")
    expect(handler).toHaveBeenCalledWith("sek")
  })

  it("swallows null (a cleared selection)", () => {
    const handler = vi.fn()
    onSelectValue(handler)(null)
    expect(handler).not.toHaveBeenCalled()
  })
})
