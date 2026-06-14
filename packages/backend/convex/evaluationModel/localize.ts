import {
  type CriterionKey,
  CRITERION_KEYS,
  TRACK_KEYS,
  type TemplateLocale,
  type TrackKey,
} from "./standardTemplate"

// Read-time localization helpers shared by getModel and the assessment
// queries. Template content exists in all five product locales; anything
// else falls back to en.
const TEMPLATE_LOCALES = new Set<TemplateLocale>(["sv", "en", "nb", "da", "fi"])
export function clampLocale(locale: string | undefined): TemplateLocale {
  return locale !== undefined && TEMPLATE_LOCALES.has(locale as TemplateLocale)
    ? (locale as TemplateLocale)
    : "en"
}

const CRITERION_KEY_SET = new Set<string>(CRITERION_KEYS)
export function isCriterionKey(key: string): key is CriterionKey {
  return CRITERION_KEY_SET.has(key)
}

// The AI responds in the requester's CURRENT UI language when the client
// passes one (clamped to the supported five); the organization default
// language is only the fallback. Shared by every AI generation flow (suggest,
// prefill) so they all resolve the generation locale the same way.
const SUPPORTED_PROMPT_LOCALES = new Set(["en", "sv", "nb", "da", "fi"])
export function promptLocale(
  requested: string | undefined,
  fallback: string
): string {
  return requested !== undefined && SUPPORTED_PROMPT_LOCALES.has(requested)
    ? requested
    : fallback
}

const TRACK_KEY_SET = new Set<string>(TRACK_KEYS)
export function isTrackKey(key: string): key is TrackKey {
  return TRACK_KEY_SET.has(key)
}
