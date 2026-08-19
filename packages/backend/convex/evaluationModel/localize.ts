import { TRACK_KEYS, type TrackKey } from "./trackSchema"

// Read-time localization helpers shared by getModel and the assessment
// queries. Product content exists in all five product locales; anything else
// falls back to en.
export type ProductContentLocale = "sv" | "en" | "nb" | "da" | "fi"

const PRODUCT_CONTENT_LOCALES = new Set<ProductContentLocale>([
  "sv",
  "en",
  "nb",
  "da",
  "fi",
])
export function clampLocale(locale: string | undefined): ProductContentLocale {
  return locale !== undefined &&
    PRODUCT_CONTENT_LOCALES.has(locale as ProductContentLocale)
    ? (locale as ProductContentLocale)
    : "en"
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
