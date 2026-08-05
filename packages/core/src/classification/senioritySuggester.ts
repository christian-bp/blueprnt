import {
  isValidSeniorityForTrack,
  TRACK_SENIORITIES,
} from "@workspace/constants"
import { normalizeTitleString } from "./normalize"

export type SeniorityTier = "low" | "mid" | "high"

export interface SeniorityInput {
  trackKey: "IC" | "Lead" | "M"
  title?: string
  employmentStartDate?: string
  isManager?: boolean
  // Reserved future signal, accepted and ignored (YAGNI).
  statisticalCode?: string
  // Reference date as epoch ms, injected so the engine stays pure (no clock).
  today: number
}

export interface SenioritySuggestion {
  suggestedSeniority: string // always a valid seniority for the given trackKey
}

// Keyword tokens that pull seniority down or up. Matched against the normalized,
// tokenized title.
const LOW_KEYWORDS = new Set(["junior", "jr", "associate", "intern"])
const HIGH_KEYWORDS = new Set([
  "senior",
  "sr",
  "principal",
  "staff",
  "architect",
  "lead",
  "teamlead",
  "chef",
  "manager",
  "head",
  "chief",
  "director",
  "vp",
])

// Derive the keyword tier from the title, or null when the title carries no
// recognized seniority keyword.
function keywordTier(title: string | undefined): SeniorityTier | null {
  if (title === undefined) return null
  const tokens = normalizeTitleString(title)
    .split(" ")
    .filter((t) => t.length > 0)
  let low = false
  let high = false
  for (const token of tokens) {
    if (LOW_KEYWORDS.has(token)) low = true
    if (HIGH_KEYWORDS.has(token)) high = true
  }
  // A low keyword is conservative and wins over a high keyword if both appear.
  if (low) return "low"
  if (high) return "high"
  return null
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

// Derive the tenure tier from the ISO start date relative to `today`, or null
// when there is no parseable start date.
function tenureTier(
  employmentStartDate: string | undefined,
  today: number
): SeniorityTier | null {
  if (employmentStartDate === undefined) return null
  const start = Date.parse(employmentStartDate)
  if (Number.isNaN(start)) return null
  const years = (today - start) / MS_PER_YEAR
  if (years < 2) return "low"
  if (years <= 5) return "mid"
  return "high"
}

const TIER_ORDER: Record<SeniorityTier, number> = { low: 0, mid: 1, high: 2 }

// Combine two optional tiers conservatively:
//   - both present + agree -> that tier
//   - both present + disagree -> the lower
//   - one present -> that one
//   - neither -> mid
function combineTiers(
  keyword: SeniorityTier | null,
  tenure: SeniorityTier | null
): SeniorityTier {
  if (keyword !== null && tenure !== null) {
    return TIER_ORDER[keyword] <= TIER_ORDER[tenure] ? keyword : tenure
  }
  return keyword ?? tenure ?? "mid"
}

// Map a tier to a seniority within the track's ladder: low -> first,
// high -> last, mid -> the middle index (floor of length/2).
function seniorityForTier(
  trackKey: SeniorityInput["trackKey"],
  tier: SeniorityTier
): string {
  const seniorities = TRACK_SENIORITIES[trackKey]
  const index =
    tier === "low"
      ? 0
      : tier === "high"
        ? seniorities.length - 1
        : Math.floor(seniorities.length / 2)
  const seniority = seniorities[index] ?? seniorities[0]
  return seniority as string
}

export function suggestSeniorityForPerson(
  input: SeniorityInput
): SenioritySuggestion {
  const tier = combineTiers(
    keywordTier(input.title),
    tenureTier(input.employmentStartDate, input.today)
  )
  const seniority = seniorityForTier(input.trackKey, tier)
  // seniorityForTier always returns a member of TRACK_SENIORITIES[trackKey], so
  // this is a defensive fallback; if it ever fails, fall back to the track's
  // first seniority.
  if (!isValidSeniorityForTrack(input.trackKey, seniority)) {
    return {
      suggestedSeniority: TRACK_SENIORITIES[input.trackKey][0] as string,
    }
  }
  return { suggestedSeniority: seniority }
}
