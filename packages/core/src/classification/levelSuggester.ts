import { isValidLevelForTrack, TRACK_LEVELS } from "@workspace/constants"
import { normalizeTitleString } from "./normalize"

export type SeniorityBand = "low" | "mid" | "high"

export interface LevelInput {
  trackKey: "IC" | "Lead" | "M"
  title?: string
  employmentStartDate?: string
  isManager?: boolean
  // Reserved future signal, accepted and ignored (YAGNI).
  statisticalCode?: string
  // Reference date as epoch ms, injected so the engine stays pure (no clock).
  today: number
}

export interface LevelSuggestion {
  suggestedLevel: string // always a valid level for the given trackKey
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

// Derive the keyword band from the title, or null when the title carries no
// recognized seniority keyword.
function keywordBand(title: string | undefined): SeniorityBand | null {
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

// Derive the tenure band from the ISO start date relative to `today`, or null
// when there is no parseable start date.
function tenureBand(
  employmentStartDate: string | undefined,
  today: number
): SeniorityBand | null {
  if (employmentStartDate === undefined) return null
  const start = Date.parse(employmentStartDate)
  if (Number.isNaN(start)) return null
  const years = (today - start) / MS_PER_YEAR
  if (years < 2) return "low"
  if (years <= 5) return "mid"
  return "high"
}

const BAND_ORDER: Record<SeniorityBand, number> = { low: 0, mid: 1, high: 2 }

// Combine two optional bands conservatively:
//   - both present + agree -> that band
//   - both present + disagree -> the lower
//   - one present -> that one
//   - neither -> mid
function combineBands(
  keyword: SeniorityBand | null,
  tenure: SeniorityBand | null
): SeniorityBand {
  if (keyword !== null && tenure !== null) {
    return BAND_ORDER[keyword] <= BAND_ORDER[tenure] ? keyword : tenure
  }
  return keyword ?? tenure ?? "mid"
}

// Map a band to a level within the track's ladder: low -> first,
// high -> last, mid -> the middle index (floor of length/2).
function levelForBand(
  trackKey: LevelInput["trackKey"],
  band: SeniorityBand
): string {
  const levels = TRACK_LEVELS[trackKey]
  const index =
    band === "low"
      ? 0
      : band === "high"
        ? levels.length - 1
        : Math.floor(levels.length / 2)
  const level = levels[index] ?? levels[0]
  return level as string
}

export function suggestLevelForPerson(input: LevelInput): LevelSuggestion {
  const band = combineBands(
    keywordBand(input.title),
    tenureBand(input.employmentStartDate, input.today)
  )
  const level = levelForBand(input.trackKey, band)
  // levelForBand always returns a member of TRACK_LEVELS[trackKey], so this is
  // a defensive fallback; if it ever fails, fall back to the track's first level.
  if (!isValidLevelForTrack(input.trackKey, level)) {
    return { suggestedLevel: TRACK_LEVELS[input.trackKey][0] as string }
  }
  return { suggestedLevel: level }
}
