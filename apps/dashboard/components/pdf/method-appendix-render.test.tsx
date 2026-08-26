import { pdf } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"
import { MethodAppendix } from "@/components/pdf/method-appendix"
import type { MethodAppendixDoc } from "@/lib/pdf/method-appendix-data"

// Real render test: unlike the download test (which mocks @react-pdf/renderer),
// this renders through the real engine, so a render that THROWS in the
// node/jsdom path (schema violations, coordinates invalid here) fails the test,
// and pagination is asserted via the page-ref capture below. It does NOT catch
// browser-build-only faults (e.g. the fixed-footer / SVG-transform bugs that
// only surfaced in `pdf().toBlob()` in a real browser) or silent layout issues
// (blank, oversized, overlapping) that still produce a valid blob. Asserting
// those needs e2e rasterization, tracked in the go-live checklist.

const DOC: MethodAppendixDoc = {
  status: "draft",
  modelName: "Standardmodell",
  pointBudget: 27,
  biasStatement: "This model is bias-reducing, never bias-free.",
  criteria: [
    {
      criterionId: "c1",
      name: "Scope",
      description: "Scope of impact",
      weightPoints: 3,
      share: 33,
      order: 1,
      purpose: "Measures scope",
      whyRelevant: "Reflects value",
      overlapNotes: null,
      biasRisk: "low",
      biasComment: "Checked",
      biasAction: null,
      status: "approved",
      decidedByName: "Alex",
      decidedAt: 1_700_000_000_000,
      anchors: [
        { step: 1, text: "Anchor one" },
        { step: 2, text: "Midpoint" },
        { step: 3, text: "Anchor three" },
        { step: 4, text: "Midpoint" },
        { step: 5, text: "Anchor five" },
      ],
      libraryKey: "scope-impact",
    },
    {
      criterionId: "c2",
      name: "Complexity",
      description: "Cognitive load",
      weightPoints: 3,
      share: 33,
      order: 2,
      purpose: "Measures complexity",
      whyRelevant: "Distinguishes work",
      overlapNotes: "Overlaps with Scope",
      biasRisk: "medium",
      biasComment: "Reviewed",
      biasAction: "Reworded anchors",
      status: "documented",
      decidedByName: null,
      decidedAt: null,
      anchors: [
        { step: 1, text: "Anchor one" },
        { step: 2, text: "Midpoint" },
        { step: 3, text: "Anchor three" },
        { step: 4, text: "Midpoint" },
        { step: 5, text: "Anchor five" },
      ],
      libraryKey: "complexity-ambiguity",
    },
  ],
  scaleSteps: [1, 2, 3, 4, 5].map((step) => ({
    step,
    name: `Step ${step}`,
    meaning: `Meaning ${step}`,
  })),
  zones: [
    {
      key: "A",
      name: "Company-wide and strategic roles",
      levels: [
        { level: 1, minScore: 97 },
        { level: 2, minScore: 92 },
        { level: 3, minScore: 87 },
      ],
      minStep: 4,
    },
    {
      key: "B",
      name: "Leading specialist roles",
      levels: [
        { level: 4, minScore: 81 },
        { level: 5, minScore: 75 },
        { level: 6, minScore: 69 },
      ],
      minStep: null,
    },
  ],
  workingConditions: {
    status: "testedNotMaterial",
    motivation: "No recurring exposure in any role.",
    decidedAt: 1_700_000_000_000,
  },
}

const LABELS = {
  docTitle: "Method appendix",
  contentsTitle: "Contents",
  generatedOn: "Generated on 2 July 2026",
  model: "Model: Standardmodell",
  statusTag: "DRAFT",
  methodologyTitle: "Methodology",
  methodologyBody: "Roles are evaluated criterion by criterion.",
  scaleTitle: "The shared assessment scale",
  midpointNote: "Steps 2 and 4 are considered midpoints.",
  criteriaTitle: "Criteria and weights",
  rationaleTitle: "Criterion rationale and bias review",
  zonesTitle: "Levels and zones",
  materialityTitle: "The working-conditions materiality test",
  colCriterion: "Criterion",
  colWeight: "Weight",
  colShare: "Share",
  colLevel: "Level",
  colMinScore: "Min score",
  definition: "Definition",
  anchorsLabel: "Assessment anchors",
  purpose: "Purpose",
  whyRelevant: "Why relevant",
  overlap: "Overlap",
  biasRisk: "Bias risk",
  biasComment: "Bias comment",
  biasAction: "Bias mitigation",
  footer: "Method appendix",
  pointBudget: "Point budget: 27",
  motivationLabel: "Motivation",
  riskLabel: (r: "low" | "medium" | "high") => r,
  approval: (c: MethodAppendixDoc["criteria"][number]) =>
    c.status === "approved" ? "Approved" : "Not approved",
  zoneHeading: (zone: MethodAppendixDoc["zones"][number]) =>
    `Zone ${zone.key} · ${zone.name}`,
  zoneProfileLine: (minStep: number | null) =>
    minStep === null
      ? "No profile requirement."
      : `At least step ${minStep} on every profile criterion.`,
  materialityLine: (wc: MethodAppendixDoc["workingConditions"]) =>
    wc === null ? "Not decided yet." : `Decided: ${wc.status}.`,
}

describe("MethodAppendix (real render)", () => {
  it("renders to a non-trivial PDF without layout errors", async () => {
    const blob = await pdf(
      <MethodAppendix doc={DOC} labels={LABELS} />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("captures each section and criterion page number in a first pass", async () => {
    const pageRefs: Record<string, number> = {}
    await pdf(
      <MethodAppendix
        doc={DOC}
        labels={LABELS}
        onResolvePage={(id, page) => {
          pageRefs[id] = page
        }}
      />
    ).toBlob()
    // Overview sections land on the first content page (page 2, after the cover).
    expect(pageRefs.methodology).toBeGreaterThan(1)
    expect(pageRefs.scale).toBeGreaterThan(1)
    expect(pageRefs.levels).toBeGreaterThan(1)
    expect(pageRefs.materiality).toBeGreaterThan(1)
    // Each criterion gets its own page, recorded for the contents list.
    const c1 = pageRefs.c1 ?? 0
    const c2 = pageRefs.c2 ?? 0
    expect(c1).toBeGreaterThan(0)
    expect(c2).toBeGreaterThan(c1)
  })
})
