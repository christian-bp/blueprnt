import {
  type CriterionKey,
  CRITERION_KEYS,
  TRACK_KEYS,
  type TemplateLocale,
  type TrackKey,
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

const TRACK_KEY_SET = new Set<string>(TRACK_KEYS)
export function isTrackKey(key: string): key is TrackKey {
  return TRACK_KEY_SET.has(key)
}
