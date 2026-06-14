import type { IndustryKey } from "@workspace/constants"
import { industryStartersDa } from "./industryStarters.content.da"
import { industryStartersEn } from "./industryStarters.content.en"
import { industryStartersFi } from "./industryStarters.content.fi"
import { industryStartersNb } from "./industryStarters.content.nb"
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
  purpose: string
  responsibilities: string
}

export interface StarterFamily {
  name: string
  roles: StarterRole[]
}

export type StarterContent = Record<IndustryKey, StarterFamily[]>

// Starter content exists in all five locales (en/sv/nb/da/fi), each with a
// predefined purpose + responsibilities on every role. The locale picks the
// module; en is the fallback for any unrecognised locale.
export function starterContent(locale: string | undefined): StarterContent {
  switch (locale) {
    case "sv":
      return industryStartersSv
    case "nb":
      return industryStartersNb
    case "da":
      return industryStartersDa
    case "fi":
      return industryStartersFi
    default:
      return industryStartersEn
  }
}
