import type { IndustryKey } from "@workspace/constants"
import type { DimensionKey } from "@workspace/core"
import {
  criteriaLibraryContentEn,
  type CriteriaLibraryContent,
} from "./criteriaLibrary.content.en"
import { criteriaLibraryContentSv } from "./criteriaLibrary.content.sv"
import { criteriaLibraryContentNb } from "./criteriaLibrary.content.nb"
import { criteriaLibraryContentDa } from "./criteriaLibrary.content.da"
import { criteriaLibraryContentFi } from "./criteriaLibrary.content.fi"
import { clampLocale, type ProductContentLocale } from "./localize"

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
    "knowledge-breadth",
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
    "communication-effort",
    "scope-impact",
    "autonomy-mandate",
    "risk-consequence",
  ],
}

export type CriteriaLibraryLocale = ProductContentLocale

const CONTENT_BY_LOCALE: Record<CriteriaLibraryLocale, CriteriaLibraryContent> =
  {
    en: criteriaLibraryContentEn,
    sv: criteriaLibraryContentSv,
    nb: criteriaLibraryContentNb,
    da: criteriaLibraryContentDa,
    fi: criteriaLibraryContentFi,
  }

// The parity guard asserts against this: the en fallback below would
// otherwise make a missing locale look complete.
export const REGISTERED_LIBRARY_LOCALES = Object.keys(CONTENT_BY_LOCALE)

export function criteriaLibraryContent(locale: string): CriteriaLibraryContent {
  return CONTENT_BY_LOCALE[clampLocale(locale)]
}

// Narrows a stored string back to a library key. Needed where a value comes
// from a shape that carries it as a plain string (the shared model-evidence
// copy, whose criterion identity stays a loose string so pre-cutover frozen
// pay-mapping runs keep validating) but is about to be written to a criteria
// row, whose libraryKey is the strict union.
const CRITERIA_LIBRARY_KEY_SET: ReadonlySet<string> = new Set(
  CRITERIA_LIBRARY_KEYS
)

export function isCriteriaLibraryKey(key: string): key is CriteriaLibraryKey {
  return CRITERIA_LIBRARY_KEY_SET.has(key)
}

// The steps the library leaves without an anchor of their own. ADR-0021 has
// each criterion author full anchor texts at 1, 3 and 5; 2 and 4 are the
// considered space between them, filled from the model's shared midpoint copy
// (`midpoints: { step2, step4 }` in every content module). Derived from that
// shape's own keys, so a library that ever anchored 2 or 4 per criterion could
// not leave a consumer explaining a midpoint that no longer exists.
export const MIDPOINT_STEPS: readonly number[] = [2, 4]

// The library's measures/notMeasures split, joined into the one help-text
// sentence every consumer actually needs (what the criterion DOES and does
// NOT cover, in one line): the method-builder wire (method.ts), the rating
// stepper (apps/dashboard rate/page.tsx), and the AI weighting-review prompt
// (ai/suggest.ts). Pure and side-effect-free like the rest of this module, so
// it lives here rather than duplicated per call site.
export function buildCriterionHelpText(entry: {
  measures: string
  notMeasures: string
}): string {
  return `${entry.measures} ${entry.notMeasures}`.trim()
}
