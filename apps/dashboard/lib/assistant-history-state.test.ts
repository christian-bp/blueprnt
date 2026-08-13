import { describe, expect, it } from "vitest"
import { assistantHistoryOpenFromCookie } from "./assistant-history-state"

describe("assistantHistoryOpenFromCookie", () => {
  it("defaults to open when no cookie is set", () => {
    expect(assistantHistoryOpenFromCookie("")).toBe(true)
    expect(assistantHistoryOpenFromCookie("theme=dark; locale=sv")).toBe(true)
  })

  it("restores the persisted choice", () => {
    expect(assistantHistoryOpenFromCookie("assistant_history_state=true")).toBe(
      true
    )
    expect(
      assistantHistoryOpenFromCookie("assistant_history_state=false")
    ).toBe(false)
  })

  it("finds the cookie among others", () => {
    expect(
      assistantHistoryOpenFromCookie(
        "theme=dark; assistant_history_state=false; locale=sv"
      )
    ).toBe(false)
    expect(
      assistantHistoryOpenFromCookie(
        "theme=dark; assistant_history_state=true; locale=sv"
      )
    ).toBe(true)
  })

  it("ignores cookies whose names merely end with the same suffix", () => {
    expect(
      assistantHistoryOpenFromCookie("app_assistant_history_state=false")
    ).toBe(true)
  })

  it("is not confused by the unrelated sidebar cookie", () => {
    expect(
      assistantHistoryOpenFromCookie(
        "sidebar_state=false; assistant_history_state=false"
      )
    ).toBe(false)
  })
})
