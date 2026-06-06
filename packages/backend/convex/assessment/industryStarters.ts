import type { TemplateLocale } from "../evaluationModel/standardTemplate"
import { industryStartersEn } from "./industryStarters.content.en"
import { industryStartersSv } from "./industryStarters.content.sv"

// Industry starter sets: per industry, role families with example roles
// (title + suggested track/level on the fixed schema). Pre-fills the
// onboarding families step; nothing is seeded until the user confirms.
// Prose lives in the per-locale content modules.

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

export interface StarterRole {
  title: string
  trackKey: string
  levelKey: string
}

export interface StarterFamily {
  name: string
  roles: StarterRole[]
}

export type StarterContent = Record<IndustryKey, StarterFamily[]>

const INDUSTRY_KEY_SET = new Set<string>(INDUSTRY_KEYS)
export function clampIndustry(industry: string | undefined): IndustryKey {
  return industry !== undefined && INDUSTRY_KEY_SET.has(industry)
    ? (industry as IndustryKey)
    : "other"
}

export function starterContent(locale: TemplateLocale): StarterContent {
  return locale === "sv" ? industryStartersSv : industryStartersEn
}
