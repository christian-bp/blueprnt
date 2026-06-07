import type { WeightPoints } from "@workspace/core"
import {
  standardTemplateContentEn,
  type StandardTemplateContent,
} from "./standardTemplate.content.en"
import { standardTemplateContentSv } from "./standardTemplate.content.sv"

// Structure of the standard template (the Excel prototype's evaluation model).
// Prose lives in the per-locale content modules; this module owns every
// numeric/structural decision so they cannot drift between locales.
// Source of record: docs/contexts/evaluation-model/standardmall.md.

export const STANDARD_TEMPLATE_KEY = "standard-template-v1"

// Order is the template's display order (the standardmall.md table, sorted by
// default weight points).
export const CRITERION_KEYS = [
  "scope",
  "complexity",
  "autonomy",
  "risk",
  "knowledge",
  "stakeholders",
  "financial",
  "people",
  "formal",
] as const
export type CriterionKey = (typeof CRITERION_KEYS)[number]

// Default weight points per criterion (standardmall.md table; ADR-0004).
// 9 criteria, point budget 27, exactly balanced. The allocation follows the
// source document's section 6 example verbatim: risk is deliberately demoted
// from the Excel prototype's second place, autonomy promoted.
export const DEFAULT_WEIGHT_POINTS: Record<CriterionKey, WeightPoints> = {
  scope: 5,
  complexity: 4,
  autonomy: 4,
  risk: 3,
  knowledge: 3,
  stakeholders: 3,
  financial: 2,
  people: 2,
  formal: 1,
}

// The fixed V1 track schema (PLAN-V1 §9.6): tracks are constants, not rows
// (ADR-0006). Roles reference tracks by these stable keys (roles.trackKey);
// display names localize from the content modules. The level schema
// (IC1-IC5, Lead 1-3, M1-M3) and the advisory guardrail ranges live as
// reference data in docs/contexts/evaluation-model/standardmall.md awaiting
// V2 role placement (ADR-0005).
export const TRACK_KEYS = ["IC", "Lead", "M"] as const
export type TrackKey = (typeof TRACK_KEYS)[number]

// 7 bands, Band 1 = highest; minScore is the lowest inclusive score as an
// integer on the normalized 0-100 scale (ADR-0004). The values translate the
// Excel prototype's thresholds as shares of max (530/540 -> 98 etc.) and are
// to be calibrated before launch. Used by BOTH template and scratch models
// (thresholds are editable in E2).
export const DEFAULT_BAND_THRESHOLDS = [
  { band: 1, minScore: 98 },
  { band: 2, minScore: 83 },
  { band: 3, minScore: 74 },
  { band: 4, minScore: 63 },
  { band: 5, minScore: 53 },
  { band: 6, minScore: 41 },
  { band: 7, minScore: 0 },
] as const

export type TemplateLocale = "sv" | "en"

export function templateContent(
  locale: TemplateLocale
): StandardTemplateContent {
  return locale === "sv" ? standardTemplateContentSv : standardTemplateContentEn
}
