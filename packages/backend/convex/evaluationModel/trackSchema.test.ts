import { describe, expect, it } from "vitest"
import { trackKeyValidator } from "./tables"
import { TRACK_KEYS, trackName } from "./trackSchema"

const PRODUCT_CONTENT_LOCALES = ["sv", "en", "nb", "da", "fi"] as const

describe("track schema", () => {
  it("keeps the roles.trackKey validator in sync with TRACK_KEYS (ADR-0006)", () => {
    // The validator lives in tables.ts without importing this module; this
    // bijection assertion is what keeps the two literal lists honest.
    expect(trackKeyValidator.members.map((member) => member.value)).toEqual([
      ...TRACK_KEYS,
    ])
  })

  it("ships a non-empty display name for every track in every product locale", () => {
    for (const locale of PRODUCT_CONTENT_LOCALES) {
      for (const key of TRACK_KEYS) {
        expect(trackName(locale, key).length).toBeGreaterThan(0)
      }
    }
  })
})
