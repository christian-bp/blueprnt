import type { Locale } from "@workspace/i18n/routing"

// Language names are autonyms (each language in itself), identical across
// the message files, so the picker is readable whatever the active locale.
export const LANGUAGE_LABEL_KEYS = {
  sv: "languages.sv",
  en: "languages.en",
  nb: "languages.nb",
  da: "languages.da",
  fi: "languages.fi",
} as const satisfies Record<Locale, string>

// Representative flag per language (decorative; the autonym is the label).
export const FLAG_BY_LOCALE = {
  sv: "SE",
  en: "GB",
  nb: "NO",
  da: "DK",
  fi: "FI",
} as const satisfies Record<Locale, string>
