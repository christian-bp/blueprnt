import type { IndustryKey } from "@workspace/constants"
import type { TemplateLocale } from "../evaluationModel/standardTemplate"
import { industryStartersEn } from "./industryStarters.content.en"
import { industryStartersSv } from "./industryStarters.content.sv"

// Industry starter sets: per industry, role families with example roles
// (title + suggested track on the fixed schema; one role per JOB, ADR-0005).
// Pre-fills the onboarding families step; nothing is seeded until the user
// confirms. Prose lives in the per-locale content modules.

export {
  INDUSTRY_KEYS,
  type IndustryKey,
  clampIndustry,
} from "@workspace/constants"

export interface StarterRole {
  title: string
  trackKey: string
}

export interface StarterFamily {
  name: string
  roles: StarterRole[]
}

export type StarterContent = Record<IndustryKey, StarterFamily[]>

export function starterContent(locale: TemplateLocale): StarterContent {
  return locale === "sv" ? industryStartersSv : industryStartersEn
}
