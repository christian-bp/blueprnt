import { describe, expect, it } from "vitest"
import {
  ASSISTANT_HISTORY_COOKIE,
  innerSidebarOpenFromCookie,
} from "./inner-sidebar-state"

describe("innerSidebarOpenFromCookie", () => {
  it("defaults to open when no cookie is set", () => {
    expect(innerSidebarOpenFromCookie("", ASSISTANT_HISTORY_COOKIE)).toBe(true)
    expect(
      innerSidebarOpenFromCookie(
        "theme=dark; locale=sv",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(true)
  })

  it("restores the persisted choice", () => {
    expect(
      innerSidebarOpenFromCookie(
        "assistant_history_state=true",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(true)
    expect(
      innerSidebarOpenFromCookie(
        "assistant_history_state=false",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(false)
  })

  it("finds the cookie among others", () => {
    expect(
      innerSidebarOpenFromCookie(
        "theme=dark; assistant_history_state=false; locale=sv",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(false)
  })

  it("ignores cookies whose names merely end with the same suffix", () => {
    expect(
      innerSidebarOpenFromCookie(
        "app_assistant_history_state=false",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(true)
  })

  // Why the module is keyed by name at all: one cookie jar, one reader's
  // choice per panel, neither seeing the other's. Only the assistant persists
  // a choice today (the docs nav does not collapse), so the second name here
  // stands in for the next panel that needs one.
  it("keeps two panels' choices independent", () => {
    const jar = "assistant_history_state=false; other_panel_state=true"
    expect(innerSidebarOpenFromCookie(jar, ASSISTANT_HISTORY_COOKIE)).toBe(
      false
    )
    expect(innerSidebarOpenFromCookie(jar, "other_panel_state")).toBe(true)
  })

  it("is not confused by the app sidebar's own cookie", () => {
    expect(
      innerSidebarOpenFromCookie(
        "sidebar_state=false; assistant_history_state=false",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(false)
  })
})
