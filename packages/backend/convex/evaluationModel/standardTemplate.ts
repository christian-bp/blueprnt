import type { ImportanceLevel } from "@workspace/core"
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

export const CRITERION_KEYS = [
  "scope",
  "risk",
  "complexity",
  "autonomy",
  "stakeholders",
  "knowledge",
  "financial",
  "people",
  "formal",
] as const
export type CriterionKey = (typeof CRITERION_KEYS)[number]

// Default importance per criterion (standardmall.md table; weights are NEVER
// stored or shown, they resolve via @workspace/core at compute time).
export const DEFAULT_IMPORTANCE: Record<CriterionKey, ImportanceLevel> = {
  scope: 7,
  risk: 6,
  complexity: 5,
  autonomy: 4,
  stakeholders: 3,
  knowledge: 3,
  financial: 3,
  people: 2,
  formal: 1,
}

export const TRACK_DEFS = [
  { key: "IC", levels: ["IC1", "IC2", "IC3", "IC4", "IC5"] },
  { key: "Lead", levels: ["Lead1", "Lead2", "Lead3"] },
  { key: "M", levels: ["M1", "M2", "M3"] },
] as const
export type LevelKey = (typeof TRACK_DEFS)[number]["levels"][number]

// Advisory guardrails per (level, criterion): [min, max] on the 0-5 scale.
// IC1..IC5, Lead1, Lead2, M1..M3 are curated from the Excel "Track" tab; the
// tab carries 8 criteria (no "formal" row) so each level has 8 entries.
// Lead3 is from standardmall.md (the level does not exist in Excel).
// COMPLETENESS GATE: Task 8 must NOT be closed while only Lead3 is present;
// the template is incomplete until every level has its rows here.
export const GUARDRAILS: Record<
  LevelKey,
  Partial<Record<CriterionKey, [number, number]>>
> = {
  IC1: {
    scope: [0, 1],
    complexity: [0, 1],
    autonomy: [0, 1],
    stakeholders: [0, 1],
    knowledge: [0, 1],
    risk: [0, 1],
    financial: [0, 0],
    people: [0, 0],
  },
  IC2: {
    scope: [1, 2],
    complexity: [1, 2],
    autonomy: [1, 2],
    stakeholders: [1, 1],
    knowledge: [1, 2],
    risk: [1, 1],
    financial: [0, 0],
    people: [0, 0],
  },
  IC3: {
    scope: [2, 3],
    complexity: [2, 3],
    autonomy: [2, 3],
    stakeholders: [2, 2],
    knowledge: [3, 3],
    risk: [2, 3],
    financial: [0, 1],
    people: [0, 0],
  },
  IC4: {
    scope: [3, 4],
    complexity: [3, 4],
    autonomy: [3, 4],
    stakeholders: [3, 3],
    knowledge: [4, 4],
    risk: [3, 4],
    financial: [1, 1],
    people: [0, 0],
  },
  IC5: {
    scope: [4, 5],
    complexity: [4, 5],
    autonomy: [4, 5],
    stakeholders: [3, 4],
    knowledge: [5, 5],
    risk: [4, 5],
    financial: [1, 2],
    people: [0, 1],
  },
  Lead1: {
    scope: [2, 3],
    complexity: [2, 3],
    autonomy: [2, 3],
    stakeholders: [3, 3],
    knowledge: [2, 3],
    risk: [2, 3],
    financial: [1, 1],
    people: [1, 1],
  },
  Lead2: {
    scope: [3, 4],
    complexity: [3, 4],
    autonomy: [3, 4],
    stakeholders: [3, 4],
    knowledge: [3, 4],
    risk: [3, 4],
    financial: [1, 2],
    people: [1, 1],
  },
  Lead3: {
    scope: [4, 5],
    complexity: [4, 5],
    autonomy: [4, 5],
    stakeholders: [4, 5],
    knowledge: [3, 4],
    risk: [4, 5],
    financial: [1, 2],
    people: [1, 1],
  },
  M1: {
    scope: [3, 3],
    complexity: [2, 3],
    autonomy: [2, 3],
    stakeholders: [3, 3],
    knowledge: [2, 3],
    risk: [3, 3],
    financial: [2, 2],
    people: [3, 3],
  },
  M2: {
    scope: [4, 4],
    complexity: [3, 4],
    autonomy: [3, 4],
    stakeholders: [4, 4],
    knowledge: [3, 4],
    risk: [4, 4],
    financial: [3, 4],
    people: [4, 4],
  },
  M3: {
    scope: [5, 5],
    complexity: [4, 5],
    autonomy: [5, 5],
    stakeholders: [4, 5],
    knowledge: [4, 5],
    risk: [5, 5],
    financial: [4, 5],
    people: [5, 5],
  },
}

// 7 bands, Band 1 = highest; minScore is the lowest inclusive score.
// Used by BOTH template and scratch models (thresholds are editable in E2).
export const DEFAULT_BAND_THRESHOLDS = [
  { band: 1, minScore: 530 },
  { band: 2, minScore: 450 },
  { band: 3, minScore: 400 },
  { band: 4, minScore: 340 },
  { band: 5, minScore: 285 },
  { band: 6, minScore: 220 },
  { band: 7, minScore: 0 },
] as const

export type TemplateLocale = "sv" | "en"

export function templateContent(
  locale: TemplateLocale
): StandardTemplateContent {
  return locale === "sv" ? standardTemplateContentSv : standardTemplateContentEn
}
