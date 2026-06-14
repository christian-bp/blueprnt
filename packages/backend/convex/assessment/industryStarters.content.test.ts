import { describe, expect, it } from "vitest"
import type { StarterContent } from "./industryStarters"
import { starterContent } from "./industryStarters"
import { industryStartersDa } from "./industryStarters.content.da"
import { industryStartersEn } from "./industryStarters.content.en"
import { industryStartersFi } from "./industryStarters.content.fi"
import { industryStartersNb } from "./industryStarters.content.nb"
import { industryStartersSv } from "./industryStarters.content.sv"

// The five locale modules are parallel translations of one structure: the same
// industries, the same families per industry, the same roles per family (one
// per JOB, ADR-0005), and the same trackKey on each role. Only the prose
// (name/title/purpose/responsibilities) differs by language. These tests pin
// that contract so a future edit to one module that drifts the shape is caught.

const MODULES: Record<string, StarterContent> = {
  en: industryStartersEn,
  sv: industryStartersSv,
  nb: industryStartersNb,
  da: industryStartersDa,
  fi: industryStartersFi,
}

// A structural fingerprint of one module: per industry, the family count and,
// per family, the role count and the ordered list of trackKeys. Names/titles
// (the translated prose) are deliberately excluded so only SHAPE is compared.
function fingerprint(content: StarterContent): string {
  const industries = Object.keys(content).sort()
  return JSON.stringify(
    industries.map((industry) => [
      industry,
      content[industry as keyof StarterContent].map((family) =>
        family.roles.map((role) => role.trackKey)
      ),
    ])
  )
}

describe("industry starter content (all five locales)", () => {
  it("exposes the same industry keys in every locale", () => {
    const enKeys = Object.keys(industryStartersEn).sort()
    for (const [locale, content] of Object.entries(MODULES)) {
      expect(
        Object.keys(content).sort(),
        `industry keys for ${locale}`
      ).toEqual(enKeys)
    }
  })

  it("is structurally identical across locales (family/role counts + trackKeys)", () => {
    const enPrint = fingerprint(industryStartersEn)
    for (const [locale, content] of Object.entries(MODULES)) {
      expect(fingerprint(content), `structure for ${locale}`).toBe(enPrint)
    }
  })

  it("gives every role a non-empty purpose and responsibilities in every locale", () => {
    for (const [locale, content] of Object.entries(MODULES)) {
      for (const families of Object.values(content)) {
        for (const family of families) {
          for (const role of family.roles) {
            expect(
              role.purpose.trim().length,
              `purpose for ${locale} / ${role.title}`
            ).toBeGreaterThan(0)
            expect(
              role.responsibilities.trim().length,
              `responsibilities for ${locale} / ${role.title}`
            ).toBeGreaterThan(0)
          }
        }
      }
    }
  })
})

describe("starterContent locale routing", () => {
  it("returns each locale's own module (no fall back to en for nb/da/fi)", () => {
    expect(starterContent("sv")).toBe(industryStartersSv)
    expect(starterContent("nb")).toBe(industryStartersNb)
    expect(starterContent("da")).toBe(industryStartersDa)
    expect(starterContent("fi")).toBe(industryStartersFi)
    expect(starterContent("en")).toBe(industryStartersEn)
    // An unknown locale (and undefined) falls back to en.
    expect(starterContent("xx")).toBe(industryStartersEn)
    expect(starterContent(undefined)).toBe(industryStartersEn)
  })

  it("nb content actually differs from en (proves it is not the en fallback)", () => {
    // A known role title that is genuinely translated in Norwegian. Same
    // structural position (first industry, first family, first role), different
    // prose, so this fails the moment nb silently falls back to en again.
    const enFirst = industryStartersEn.itTelecom[0]?.roles[0]?.title
    const nbFirst = industryStartersNb.itTelecom[0]?.roles[0]?.title
    expect(enFirst).toBeDefined()
    expect(nbFirst).toBeDefined()
    expect(nbFirst).not.toBe(enFirst)
  })
})
