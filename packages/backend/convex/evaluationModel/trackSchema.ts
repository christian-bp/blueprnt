import type { ProductContentLocale } from "./localize"

// The fixed V1 track schema (PLAN-V1 §9.6): tracks are constants, not rows
// (ADR-0006). Roles reference tracks by these stable keys (roles.trackKey).
// The per-track seniority ladders (IC1-IC5, Lead-1..3, M1-M3) live as the
// TRACK_SENIORITIES constant in @workspace/constants and drive live
// per-individual assignment validation and seniority suggestion (ADR-0005);
// standardmall.md is their prose reference.
export const TRACK_KEYS = ["IC", "Lead", "M"] as const
export type TrackKey = (typeof TRACK_KEYS)[number]

// Localized track display names (standardmall.md's "Track" tab), one record
// per product locale so a future locale-specific divergence has somewhere to
// go; every locale carries the same three names today.
const TRACK_NAMES: Record<ProductContentLocale, Record<TrackKey, string>> = {
  sv: { IC: "Individual Contributor", Lead: "Lead", M: "Manager" },
  en: { IC: "Individual Contributor", Lead: "Lead", M: "Manager" },
  nb: { IC: "Individual Contributor", Lead: "Lead", M: "Manager" },
  da: { IC: "Individual Contributor", Lead: "Lead", M: "Manager" },
  fi: { IC: "Individual Contributor", Lead: "Lead", M: "Manager" },
}

export function trackName(locale: ProductContentLocale, key: TrackKey): string {
  return TRACK_NAMES[locale][key]
}
