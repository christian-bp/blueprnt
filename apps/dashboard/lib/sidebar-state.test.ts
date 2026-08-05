import { describe, expect, it } from "vitest"
import { sidebarOpenFromCookie } from "./sidebar-state"

describe("sidebarOpenFromCookie", () => {
  it("defaults to expanded when no cookie is set", () => {
    expect(sidebarOpenFromCookie("")).toBe(true)
    expect(sidebarOpenFromCookie("theme=dark; locale=sv")).toBe(true)
  })

  it("restores the persisted choice", () => {
    expect(sidebarOpenFromCookie("sidebar_state=true")).toBe(true)
    expect(sidebarOpenFromCookie("sidebar_state=false")).toBe(false)
  })

  it("finds the cookie among others", () => {
    expect(
      sidebarOpenFromCookie("theme=dark; sidebar_state=false; locale=sv")
    ).toBe(false)
    expect(
      sidebarOpenFromCookie("theme=dark; sidebar_state=true; locale=sv")
    ).toBe(true)
  })

  it("ignores cookies whose names merely end with the same suffix", () => {
    expect(sidebarOpenFromCookie("app_sidebar_state=false")).toBe(true)
  })
})
