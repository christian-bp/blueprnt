import {
  type CriterionKey,
  CRITERION_KEYS,
  type LevelKey,
  TRACK_DEFS,
  type TemplateLocale,
} from "./standardTemplate"

// Read-time localization helpers shared by getModel and the assessment
// queries. Content exists for sv/en only; any other locale falls back to en.
export function clampLocale(locale: string | undefined): TemplateLocale {
  return locale === "sv" || locale === "en" ? locale : "en"
}

const CRITERION_KEY_SET = new Set<string>(CRITERION_KEYS)
export function isCriterionKey(key: string): key is CriterionKey {
  return CRITERION_KEY_SET.has(key)
}

const TRACK_KEY_SET = new Set<string>(TRACK_DEFS.map((track) => track.key))
export function isTrackKey(key: string): key is "IC" | "Lead" | "M" {
  return TRACK_KEY_SET.has(key)
}

const LEVEL_KEY_SET = new Set<string>(
  TRACK_DEFS.flatMap((track) => track.levels)
)
export function isLevelKey(key: string): key is LevelKey {
  return LEVEL_KEY_SET.has(key)
}
