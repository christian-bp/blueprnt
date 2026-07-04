import { describe, expect, it } from "vitest"
import { displayNameFor } from "@/lib/person-display"

const tmpl = (ref: string) => `Anställd #${ref}`

describe("displayNameFor", () => {
  it("returns the real name when pseudonymize is off", () => {
    expect(
      displayNameFor(
        { displayName: "Ada Lovelace", externalRef: "42" },
        false,
        tmpl
      )
    ).toBe("Ada Lovelace")
  })
  it("returns the pseudonym when pseudonymize is on and a ref exists", () => {
    expect(
      displayNameFor(
        { displayName: "Ada Lovelace", externalRef: "42" },
        true,
        tmpl
      )
    ).toBe("Anställd #42")
  })
  it("falls back to the real name when pseudonymize is on but no ref", () => {
    expect(
      displayNameFor(
        { displayName: "Ada Lovelace", externalRef: null },
        true,
        tmpl
      )
    ).toBe("Ada Lovelace")
  })
})
