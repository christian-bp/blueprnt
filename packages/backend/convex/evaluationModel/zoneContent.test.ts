import {
  LEVEL_COUNT,
  ZONE_KEYS,
  ZONE_LEVEL_RANGES,
  type ZoneKey,
  zoneForLevel,
} from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  levelFunction,
  REGISTERED_ZONE_LOCALES,
  ZONE_POSITIONS,
  zoneContent,
  type ZonePosition,
  zonePositionForLevel,
} from "./zoneContent"

const PRESENT_LOCALES = ["en", "sv", "nb", "da", "fi"] as const

describe("zone positions", () => {
  it("gives every level exactly one position, all three inside every zone", () => {
    for (const zone of ZONE_KEYS) {
      const { from, to } = ZONE_LEVEL_RANGES[zone]
      const positions: ZonePosition[] = []
      for (let level = from; level <= to; level++) {
        expect(zoneForLevel(level)).toBe(zone)
        positions.push(zonePositionForLevel(level))
      }
      expect(positions).toEqual(["upper", "established", "entry"])
      expect([...positions].sort()).toEqual([...ZONE_POSITIONS].sort())
    }
  })

  it("puts the upper text on a zone's top level and the entry text where a role enters it", () => {
    // Level 1 is the highest level, so a zone's numerically lowest level is
    // its top and its numerically highest is its entry.
    expect(zonePositionForLevel(1)).toBe("upper")
    expect(zonePositionForLevel(2)).toBe("established")
    expect(zonePositionForLevel(3)).toBe("entry")
    expect(zonePositionForLevel(LEVEL_COUNT)).toBe("entry")
  })

  it("throws outside the twelve levels", () => {
    expect(() => zonePositionForLevel(0)).toThrow()
    expect(() => zonePositionForLevel(LEVEL_COUNT + 1)).toThrow()
    expect(() => zonePositionForLevel(4.5)).toThrow()
  })
})

describe("zone content", () => {
  it.each(PRESENT_LOCALES)("locale %s is complete", (locale) => {
    // The en fallback would mask a missing locale, so registration is
    // asserted explicitly: completeness of a fallback is not parity.
    expect(REGISTERED_ZONE_LOCALES).toContain(locale)
    const content = zoneContent(locale)
    for (const zone of ZONE_KEYS) {
      const entry = content.zones[zone]
      for (const field of [
        "shortName",
        "name",
        "character",
        "typicalProfile",
        "summary",
      ] as const) {
        expect(
          entry[field].length,
          `${locale}.${zone}.${field}`
        ).toBeGreaterThan(0)
      }
      for (const position of ZONE_POSITIONS) {
        const fn = content.levelFunctions[zone][position]
        expect(
          fn.label.length,
          `${locale}.${zone}.${position}.label`
        ).toBeGreaterThan(0)
        expect(
          fn.meaning.length,
          `${locale}.${zone}.${position}.meaning`
        ).toBeGreaterThan(0)
      }
    }
  })

  it("falls back to en for unknown locales", () => {
    expect(zoneContent("xx")).toEqual(zoneContent("en"))
  })

  it("wires a distinct module per locale", () => {
    const names = PRESENT_LOCALES.map(
      (locale) => zoneContent(locale).zones.A.name
    )
    expect(new Set(names).size).toBe(PRESENT_LOCALES.length)
  })

  // The band header is a stat row: letter chip, name, span chip, count. A
  // short name that ran to a clause would break that line, which is the whole
  // reason the field exists beside the masterdokument's own full name.
  it.each(PRESENT_LOCALES)(
    "locale %s keeps every short name to a band-width phrase",
    (locale) => {
      const content = zoneContent(locale)
      for (const zone of ZONE_KEYS) {
        const shortName = content.zones[zone].shortName
        expect(shortName.length, `${locale}.${zone}`).toBeLessThanOrEqual(34)
        expect(
          shortName.split(/\s+/).length,
          `${locale}.${zone}`
        ).toBeLessThanOrEqual(4)
        // A name, not a sentence.
        expect(shortName, `${locale}.${zone}`).not.toMatch(/[.!?]$/)
      }
    }
  )

  it.each(PRESENT_LOCALES)(
    "locale %s leaves the zone letter to the key",
    (locale) => {
      const content = zoneContent(locale)
      for (const zone of ZONE_KEYS) {
        // ZONE_KEYS carries the letter; a name repeating it would print it
        // twice wherever a surface shows both.
        expect(content.zones[zone].name, `${locale}.${zone}`).not.toMatch(
          /^[A-D][.:–-]/
        )
      }
    }
  )

  it.each(PRESENT_LOCALES)(
    "locale %s keeps the level functions zone-invariant apart from zone A's top",
    (locale) => {
      const { levelFunctions } = zoneContent(locale)
      for (const position of ZONE_POSITIONS) {
        for (const zone of ["C", "D"] as const) {
          expect(
            levelFunctions[zone][position],
            `${locale}.${zone}.${position}`
          ).toEqual(levelFunctions.B[position])
        }
        // Zone A shares the function's name everywhere and its meaning
        // everywhere but its own top level, which is the top of the
        // architecture and has no next zone to be close to.
        expect(levelFunctions.A[position].label).toBe(
          levelFunctions.B[position].label
        )
        if (position === "upper") {
          expect(levelFunctions.A[position].meaning).not.toBe(
            levelFunctions.B[position].meaning
          )
        } else {
          expect(levelFunctions.A[position].meaning).toBe(
            levelFunctions.B[position].meaning
          )
        }
      }
    }
  )

  it.each(PRESENT_LOCALES)(
    "locale %s resolves a function text for all twelve levels",
    (locale) => {
      const content = zoneContent(locale)
      for (let level = 1; level <= LEVEL_COUNT; level++) {
        const zone: ZoneKey = zoneForLevel(level)
        expect(levelFunction(content, level)).toBe(
          content.levelFunctions[zone][zonePositionForLevel(level)]
        )
      }
    }
  )
})
