import type { WeightPoints } from "@workspace/core"
import type { ProductContentLocale } from "./localize"
import {
  standardTemplateContentEn,
  type StandardTemplateContent,
} from "./standardTemplate.content.en"
import { standardTemplateContentDa } from "./standardTemplate.content.da"
import { standardTemplateContentFi } from "./standardTemplate.content.fi"
import { standardTemplateContentNb } from "./standardTemplate.content.nb"
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

// The fixed V1 track schema now lives in trackSchema.ts; re-exported here
// temporarily so this module's remaining importers keep compiling.
export { TRACK_KEYS, type TrackKey } from "./trackSchema"

// 7 levels, Level 1 = highest; minScore is the lowest inclusive score as an
// integer on the normalized 0-100 scale (ADR-0004). The values translate the
// Excel prototype's thresholds as shares of max (530/540 -> 98 etc.) and are
// to be calibrated before launch. Used by BOTH template and scratch models
// (thresholds are editable in E2).
export const DEFAULT_LEVEL_THRESHOLDS = [
  { level: 1, minScore: 98 },
  { level: 2, minScore: 83 },
  { level: 3, minScore: 74 },
  { level: 4, minScore: 63 },
  { level: 5, minScore: 53 },
  { level: 6, minScore: 41 },
  { level: 7, minScore: 0 },
] as const

const CONTENT_BY_LOCALE: Record<ProductContentLocale, StandardTemplateContent> =
  {
    sv: standardTemplateContentSv,
    en: standardTemplateContentEn,
    nb: standardTemplateContentNb,
    da: standardTemplateContentDa,
    fi: standardTemplateContentFi,
  }

export function templateContent(
  locale: ProductContentLocale
): StandardTemplateContent {
  return CONTENT_BY_LOCALE[locale]
}
