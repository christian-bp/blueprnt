# Standard model compliance seed — design

**Goal:** Ship the standard model pre-documented. Every standard-model org's 9
criteria start with complete compliance evidence (the metodbilaga fields), so the
Method tab shows "9/9 documented" and the metodbilaga is exportable immediately.
Status is **documented**, never pre-**approved** — HR still signs off.

## Context (current behaviour)

- The standard model is 9 criteria (`scope, complexity, autonomy, risk,
  knowledge, stakeholders, financial, people, formal`) defined in
  `packages/backend/convex/evaluationModel/standardTemplate.ts`.
- Localized `name/description/helpText/anchors/weightLevels` per criterion live in
  `standardTemplate.content.{en,sv,nb,da,fi}.ts` (`CriterionContent`).
- `createModelFromTemplate` (`evaluationModel/model.ts`) seeds criteria in the
  org's language (`contentLocale`); `getMethodModel`/`getModel` re-localize
  `name/description/helpText` at read time for rows that still carry
  `templateKey` (an E2 name/desc/anchor edit clears `templateKey`).
- A criterion is **documented** when `purpose`, `whyRelevant`, `biasRisk`,
  `biasComment` are all filled (`overlapNotes`/`biasAction` optional) —
  `complianceStatus` in `evaluationModel/method.ts`. `approved` is a separate
  explicit stamp.
- Today the 6 compliance fields are seeded as `undefined`; no curated compliance
  content exists anywhere. This is net-new.

## Decisions

1. **Localization = re-localize (Option B).** Seeded compliance re-localizes to
   the viewer's locale like criterion names, **until HR edits it**. Edit state is
   tracked by a new `complianceEdited` flag (compliance edits do not clear
   `templateKey`, so a separate signal is needed).
2. **Content authoring.** `sv` is the source (Sweden-first) + `en`, both curated
   to be accurate; `nb/da/fi` are machine-drafts flagged for native review (i18n
   rule). Bias reviews are grounded in the fixed 6-question diagnostic checklist
   (`BIAS_CHECKLIST` in `ai/generate.ts`).
3. **Status.** Seed → documented. Never seed `approved`.

## Design

### Content — template modules

Add a `compliance` object to each criterion in every
`standardTemplate.content.*.ts` module:

```ts
compliance: {
  purpose: string          // what the criterion measures (required for documented)
  whyRelevant: string      // relevance to work value + why gender-neutral (required)
  overlapNotes: string     // overlap with other criteria; "" if none (optional)
  biasRisk: "low" | "medium" | "high"   // (required)
  biasComment: string      // reasoning, referencing the diagnostic questions (required)
  biasAction: string       // mitigation; "" if none (optional)
}
```

The `CriterionContent` interface gains this field in all 5 modules. Every
criterion's `compliance` must satisfy `isDocumented` (purpose, whyRelevant,
biasRisk, biasComment all non-empty). `overlapNotes`/`biasAction` may be `""`.

### Schema

Add to the `criteria` table (`evaluationModel/tables.ts`):

```ts
complianceEdited: v.optional(v.boolean())
```

`undefined`/`false` = compliance is template content (re-localizes at read);
`true` = HR has authored it (stored, no re-localize). Pre-launch, no migration.

### Seed — `createModelFromTemplate`

When inserting each criterion, include the 6 compliance fields from the
org-language `content.criteria[key].compliance`. Do **not** set `approved` or
`complianceEdited` (stays `undefined` = template). Seeding the stored fields is
what makes `complianceStatus` (which reads stored fields) return "documented".

### Read — `getMethodModel`

For each row, when `templateKey` is a criterion key **and**
`complianceEdited !== true`, re-localize the 6 compliance fields from
`content.criteria[key].compliance` (the requested locale), exactly like `name`
/`description` today. Otherwise use the stored row fields. `status` continues to
be computed from the stored fields (seed stored them → documented), so display
locale and status stay decoupled and correct.

### Edit — `saveCriterionCompliance`

Add `complianceEdited: true` to the patch. Once HR saves, the criterion's
compliance is theirs — reads stop re-localizing and show the stored text.

### Approval — `setCriterionApproval`

Unchanged. `isDocumented` reads stored fields (seeded), so a freshly-seeded
criterion can be approved without editing.

## Testing

- **Backend (convex-test):** after `createModelFromTemplate`, `getMethodModel`
  reports `documented: 9, approved: 0` and every criterion `status: "documented"`;
  requesting a different locale re-localizes the compliance text for template
  criteria; `saveCriterionCompliance` sets `complianceEdited` and a subsequent
  read returns the stored (non-re-localized) text; `setCriterionApproval` accepts
  a seeded criterion.
- **i18n / content parity:** a test asserts every criterion in every locale
  module has a complete `compliance` object satisfying `isDocumented`.
- **Real render:** the existing metodbilaga real-render test still passes with
  seeded compliance.

## Out of scope / follow-up

- `nb/da/fi` compliance text is machine-drafted; flag for native review before
  go-live (add to `docs/go-live-checklist.md`).
- Existing orgs already seeded before this change keep `undefined` compliance
  (pre-launch: dev/prod data is reset, so no backfill needed).
