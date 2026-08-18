import type { IndustryKey } from "@workspace/constants"
import type { DimensionKey } from "@workspace/core"
import {
  criteriaLibraryContentEn,
  type CriteriaLibraryContent,
} from "./criteriaLibrary.content.en"

// The controlled criteria library (the masterdokument's sections 7-10): a
// menu of 21 defined criteria the method builder selects from. Structure
// lives here so it cannot drift between locales; prose lives in the
// per-locale content modules. Source: docs/rollvardering-masterdokument.md.

// Order follows the masterdokument's section order (7.1-7.5, 8.1-8.5,
// 9.1-9.7, 10.1-10.4): 5 competence, 5 effort, 7 responsibility, 4 working
// conditions, 21 total.
export const CRITERIA_LIBRARY_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "formal-qualifications",
  "domain-knowledge",
  "advisory-judgment",
  "complexity-ambiguity",
  "analytical-effort",
  "communication-effort",
  "operational-intensity",
  "physical-sensory",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
  "people-leadership",
  "resource-capacity",
  "business-customer",
  "compliance-control",
  "safety-exposure",
  "on-call",
  "irregularity-mobility",
  "restricted-environments",
] as const
export type CriteriaLibraryKey = (typeof CRITERIA_LIBRARY_KEYS)[number]

// Each key's single primary dimension (masterdokument sections 7-10).
export const LIBRARY_DIMENSION: Record<CriteriaLibraryKey, DimensionKey> = {
  "knowledge-depth": "competence",
  "knowledge-breadth": "competence",
  "formal-qualifications": "competence",
  "domain-knowledge": "competence",
  "advisory-judgment": "competence",
  "complexity-ambiguity": "effort",
  "analytical-effort": "effort",
  "communication-effort": "effort",
  "operational-intensity": "effort",
  "physical-sensory": "effort",
  "scope-impact": "responsibility",
  "autonomy-mandate": "responsibility",
  "risk-consequence": "responsibility",
  "people-leadership": "responsibility",
  "resource-capacity": "responsibility",
  "business-customer": "responsibility",
  "compliance-control": "responsibility",
  "safety-exposure": "workingConditions",
  "on-call": "workingConditions",
  "irregularity-mobility": "workingConditions",
  "restricted-environments": "workingConditions",
}

// Cross-checkable overlap warnings from the section 7-10 overlap columns.
// workingConditions has no internal pairs: the dimension caps at one active
// criterion (section 6.1), so two of its criteria can never be selected
// together in the same model.
export const LIBRARY_OVERLAP_PAIRS: readonly (readonly [
  CriteriaLibraryKey,
  CriteriaLibraryKey,
])[] = [
  ["knowledge-depth", "knowledge-breadth"],
  ["knowledge-depth", "formal-qualifications"],
  ["knowledge-depth", "domain-knowledge"],
  ["knowledge-depth", "advisory-judgment"],
  ["complexity-ambiguity", "analytical-effort"],
  ["physical-sensory", "safety-exposure"],
  ["scope-impact", "people-leadership"],
  ["risk-consequence", "compliance-control"],
  ["compliance-control", "restricted-environments"],
]

// Picker chips per onboarding industry (masterdokument sections 7-10
// combination tables + section 15). Hints only: the company still chooses
// and documents its own criteria; this never drives an automatic selection.
export const LIBRARY_INDUSTRY_HINTS: Record<
  IndustryKey,
  readonly CriteriaLibraryKey[]
> = {
  itTelecom: [
    "knowledge-depth",
    "complexity-ambiguity",
    "scope-impact",
    "autonomy-mandate",
    "risk-consequence",
  ],
  consulting: [
    "knowledge-depth",
    "complexity-ambiguity",
    "communication-effort",
    "scope-impact",
    "autonomy-mandate",
    "business-customer",
  ],
  finance: [
    "knowledge-depth",
    "formal-qualifications",
    "complexity-ambiguity",
    "scope-impact",
    "risk-consequence",
    "compliance-control",
  ],
  healthcare: [
    "knowledge-depth",
    "formal-qualifications",
    "complexity-ambiguity",
    "scope-impact",
    "risk-consequence",
    "on-call",
  ],
  manufacturing: [
    "knowledge-depth",
    "domain-knowledge",
    "complexity-ambiguity",
    "physical-sensory",
    "scope-impact",
    "risk-consequence",
    "safety-exposure",
  ],
  publicSector: [
    "knowledge-depth",
    "formal-qualifications",
    "complexity-ambiguity",
    "scope-impact",
    "risk-consequence",
    "compliance-control",
  ],
  retail: [
    "knowledge-depth",
    "complexity-ambiguity",
    "operational-intensity",
    "scope-impact",
    "autonomy-mandate",
    "risk-consequence",
  ],
  realEstateConstruction: [
    "knowledge-depth",
    "domain-knowledge",
    "complexity-ambiguity",
    "scope-impact",
    "risk-consequence",
    "resource-capacity",
    "safety-exposure",
  ],
  other: [
    "knowledge-depth",
    "complexity-ambiguity",
    "scope-impact",
    "autonomy-mandate",
    "risk-consequence",
  ],
}

export type CriteriaLibraryLocale = "sv" | "en" | "nb" | "da" | "fi"

const CONTENT_BY_LOCALE: Partial<
  Record<CriteriaLibraryLocale, CriteriaLibraryContent>
> = {
  en: criteriaLibraryContentEn,
}

// The parity guard asserts against this: the en fallback below would
// otherwise make a missing locale look complete.
export const REGISTERED_LIBRARY_LOCALES = Object.keys(CONTENT_BY_LOCALE)

export function criteriaLibraryContent(locale: string): CriteriaLibraryContent {
  return (
    CONTENT_BY_LOCALE[locale as CriteriaLibraryLocale] ??
    criteriaLibraryContentEn
  )
}
