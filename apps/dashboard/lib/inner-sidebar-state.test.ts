import { describe, expect, it } from "vitest"
import {
  ASSISTANT_HISTORY_COOKIE,
  DOCS_NAV_COOKIE,
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

  // The whole point of the generalization: two sidebars, two independent
  // choices, read out of one cookie jar without either seeing the other's.
  it("keeps the two sidebars' choices independent", () => {
    const jar = "assistant_history_state=false; docs_nav_state=true"
    expect(innerSidebarOpenFromCookie(jar, ASSISTANT_HISTORY_COOKIE)).toBe(
      false
    )
    expect(innerSidebarOpenFromCookie(jar, DOCS_NAV_COOKIE)).toBe(true)
  })

  it("is not confused by the app sidebar's own cookie", () => {
    expect(
      innerSidebarOpenFromCookie(
        "sidebar_state=false; docs_nav_state=false",
        DOCS_NAV_COOKIE
      )
    ).toBe(false)
  })
})
