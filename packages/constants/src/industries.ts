// Shared industry domain constants. The list drives the onboarding industry
// screen and keys the industry starter sets in the backend (assessment
// context), so both sides stay on the same vocabulary.

export const INDUSTRY_KEYS = [
  "publicSector",
  "manufacturing",
  "consulting",
  "retail",
  "itTelecom",
  "healthcare",
  "finance",
  "realEstateConstruction",
  "other",
] as const
export type IndustryKey = (typeof INDUSTRY_KEYS)[number]

const INDUSTRY_KEY_SET = new Set<string>(INDUSTRY_KEYS)

export function clampIndustry(industry: string | undefined): IndustryKey {
  return industry !== undefined && INDUSTRY_KEY_SET.has(industry)
    ? (industry as IndustryKey)
    : "other"
}
