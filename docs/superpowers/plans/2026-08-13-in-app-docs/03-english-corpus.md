# Phase 3: English Corpus (56 pages, guards 5-7)

> Part of `docs/superpowers/plans/2026-08-13-in-app-docs/` (read `00-overview.md` first). Global constraints apply to every task.

**Goal:** Every English page written from the Phase 1 dossier, `DOCS_NAV` complete, guards 5-7 in place, and a consolidation review pass done.

**IMPORTANT, expected red window:** guard 1 (locale parity) goes red at Task 3.1 and stays red until Phase 4 completes, because English pages land before their translations. This is the ONLY tolerated red test during execution; guards 2-4 must pass (for the locales that have each file) at the end of every task, and nothing is committed anyway until final approval. Run the scoped guards during this phase with `cd apps/dashboard && bun run test -- lib/docs/docs-guards.test.ts -t "guard 2|guard 3|guard 4"`.

## Writing conventions (every page task follows these)

- Frontmatter per Task 2.1's schema; `order` is the page's 1-based position within its section as listed below; `section` is the section slug.
- The body starts at `##`. Headings are plain text (no formatting, no inline code), because anchors and chunks derive from them.
- Explain preconditions in words, name the page where the user acts, and link it: `[Roles](/roles)`. App links only to static routes (guard 4 enforces).
- Quoted UI labels use the EXACT en.json wording (e.g. the buttons "Add role", "Start pay mapping", the tabs "Criteria", "Weighting", "Method").
- Canonical terms with their boundaries: Level 1 is the highest level; level is the role's computed weight; seniority belongs to the individual (set on the person, e.g. during classification) and never affects a role's evaluation, weighting, or level; steps are the 0-5 anchor positions; weight points are 1-5 under the fixed point budget (criteria count x 3); percent shares are derived, never entered; roles describe jobs, never people.
- Never describe what does not exist (the dossier's "Deliberately absent" heading per section is the blocklist; the pay-mapping report tab and `/admin/*` are the known ones).
- Each page ends with a short "Related" list of 2-4 links to docs pages or app pages.
- No images. No em dashes. English source; translations are Phase 4.
- After each task: add the section's pages to `DOCS_NAV` in `apps/dashboard/lib/docs/docs-nav.ts` (spec order), run the scoped guards and `bun run typecheck`.

Execution note: each task below is one dispatchable unit (subagent or workflow stage) whose inputs are the section's dossier file, this brief, and the code paths named. A writer reads the dossier FIRST, then verifies details against the code.

### Task 3.1: getting-started (4 pages)

**Files:** Create `apps/dashboard/content/docs/en/{onboarding-guide,key-concepts,navigating-the-app}.mdx`; refine the seeded `introduction.mdx` (restore its onboarding-guide link, see Task 2.6 Step 1). Modify `lib/docs/docs-nav.ts`.

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| introduction | 1 | What blueprnt is, the four-step arc (model, roles, people, pay mapping), where to go next | dossier `getting-started.md`; `docs/PLAN-V1.md` |
| onboarding-guide | 2 | The four wizard steps (name, country, industry, families), the paste-vs-template choice, AI grouping + prefill, that reload resumes the first incomplete step, "Start over" | dossier; `components/onboarding/onboarding-wizard.tsx` |
| key-concepts | 3 | The mental model in plain language: role vs person, model vs evaluation, level vs seniority, step vs weight point, pay mapping as a frozen snapshot; each concept links its glossary entry | dossier; `docs/contexts/*/CONTEXT.md` |
| navigating-the-app | 4 | Every sidebar destination and what lives there, one short paragraph each, matching `dashboard.nav.*` labels | dossier; `components/app-sidebar.tsx` |

### Task 3.2: model (6 pages)

**Files:** Create `apps/dashboard/content/docs/en/{model-overview,criteria-and-scale,weighting-and-point-budget,ai-weighting-review,method-documentation,method-appendix-pdf}.mdx`. Modify `docs-nav.ts`.

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| model-overview | 1 | What the evaluation model is, the three tabs (Criteria, Weighting, Method), one live model per org, template seeding at onboarding | dossier `model.md`; ADR-0002 |
| criteria-and-scale | 2 | Criteria (name, description, help text), the 6 anchor texts for steps 0-5, adding/editing, the `MIN_CRITERIA` floor, why the 0-5 scale is not the 1-5 weight | `components/model/criterion-form.tsx`; ADR-0014 |
| weighting-and-point-budget | 3 | Weight points 1-5 (3 = neutral), the exact budget (criteria count x 3), zero-sum rebalancing, derived shares, atomic Save, balanced/over/under states | `docs/contexts/evaluation-model/viktning-poangbudget.md`; ADR-0004 |
| ai-weighting-review | 4 | When the review button is available (balanced, not mid-edit), what the AI proposes (balanced transfers with motivations), that HR picks which to accept, provenance | `components/model/weight-review-panel.tsx`; ADR-0003 |
| method-documentation | 5 | Per-criterion statuses (not started to approved), the compliance fields (purpose, relevance, overlap, bias risk), the AI-fill draft, the approval acknowledgement | `components/model/criterion-compliance-dialog.tsx` |
| method-appendix-pdf | 6 | What the appendix contains, when to export it, that it is the model's compliance evidence | `components/pdf/method-appendix*.tsx` |

### Task 3.3: roles (7 pages)

**Files:** Create `en/{roles-register,role-families,job-profiles,ai-drafting,importing-roles,anchor-roles,archiving-roles}.mdx`. Modify `docs-nav.ts`.

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| roles-register | 1 | The table (grouped by family, track filter, level column), "Add role", where role detail lives | `components/roles/roles-table.tsx` |
| role-families | 2 | What a family is (not a track), rename/delete (delete unfiles, never deletes roles), the family page | `components/roles/family-actions-menu.tsx` (or equivalent per dossier) |
| job-profiles | 3 | Identity + purpose + responsibilities, edit mode, why a complete profile gates evaluation | `components/roles/role-profile-card.tsx` |
| ai-drafting | 4 | The AI draft panel (optional guidance text, review before save, never auto-applied), where it exists | `components/roles/role-ai-panel.tsx`; ADR-0003 |
| importing-roles | 5 | The paste flow, AI grouping into families/tracks, the review table, caps and duplicates, the prefill progress screen | `components/roles/import/role-import-wizard.tsx` |
| anchor-roles | 6 | What an anchor role is (calibration reference, admin-only), agreed level + motivation, statuses, the deviation badge; boundary: anchor role vs the anchor texts of a criterion | dossier `roles.md`; `components/roles/role-anchor-control.tsx` |
| archiving-roles | 7 | What archiving locks (edit, AI draft, rating), that history stays visible | dossier `roles.md` |

### Task 3.4: evaluation (4 pages)

**Files:** Refine seeded `en/evaluating-a-role.mdx`; create `en/{score-and-levels,adjusting-a-rating,levels-views}.mdx`. Modify `docs-nav.ts`.

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| evaluating-a-role | 1 | The blind stepper (one criterion at a time, no running total), picking a step 0-5, optional motivation, the profile-complete precondition | `components/rating/rating-stepper.tsx` |
| score-and-levels | 2 | The 0-100 weighting (derived, never stored), the exact formula in words, levels with Level 1 highest, thresholds | dossier `evaluation.md`; ADR-0002 |
| adjusting-a-rating | 3 | Re-entering the stepper pre-filled, when adjusting is blocked (archived role), that changes are audit-logged | dossier `evaluation.md` |
| levels-views | 4 | The Levels page's three tabs (Ladder, Matrix, Families), the family filter, read-only nature | `app/(app)/work/page.tsx` |

### Task 3.5: people (7 pages)

**Files:** Refine seeded `en/importing-people.mdx`; create `en/{people-register,adding-people,supported-payroll-exports,classifying-people,person-details-and-salary,erasing-a-person}.mdx`. Modify `docs-nav.ts`.

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| people-register | 1 | The table (search, filters, pagination), bulk delete, header actions | `components/people/people-section.tsx` (per dossier) |
| adding-people | 2 | Manual add, which fields identity vs pay | dossier `people.md` |
| importing-people | 3 | The four steps (Upload, Map columns, Check, Review), CSV-only, monthly vs annual basis, gender overrides, fix-and-reupload, the done counts | `components/people/import/import-wizard.tsx`; ADR-0010 |
| supported-payroll-exports | 4 | The verified systems (Visma, Hogia, Fortnox, Agda, Personec, SD Worx, SAP SuccessFactors, Workday), locale-aware number/date parsing, what to do when a file will not parse | `packages/import` docs/tests; ADR-0010 |
| classifying-people | 5 | Suggested role + confidence per title, confirm vs override (never auto-applied), bulk confirm, creating a role for an unmatched title | `components/people/classify/classify-title-table.tsx` |
| person-details-and-salary | 6 | The person page, editing identity/classification, salary history entries, that role pages never show personal pay (Role is not Person) | dossier `people.md` |
| erasing-a-person | 7 | The hard delete (GDPR), what is removed vs anonymized (audit trail tombstones), type-to-confirm | ADR-0013; `erasePersonAsOrg` per dossier |

### Task 3.6: pay-mapping (9 pages)

**Files:** Create `en/{what-is-pay-mapping,starting-a-pay-mapping,pay-mapping-overview,collaboration,rules-and-practice,equal-work,equivalent-work,actions-and-notes,run-lifecycle}.mdx`. Modify `docs-nav.ts`.

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| what-is-pay-mapping | 1 | The statutory duty (Swedish yearly lönekartläggning, EU directive context), what blueprnt automates, the four chapters at a glance | `docs/lonekartlaggning-process-och-kravbild.md` |
| starting-a-pay-mapping | 2 | The start dialog (label; the reference date is set by the system), the preconditions (classified people, evaluated roles) and how the panel explains them, the frozen snapshot | ADR-0011; `StartPayMappingDialog` |
| pay-mapping-overview | 3 | The KPI strip (population, pay gap, equality clock), the finding sentence, the quartile chart, that everything reads from frozen data | dossier `pay-mapping.md`; ADR-0012 |
| collaboration | 4 | Chapter 1: the samverkan account (participants + description), why the law requires it | ADR-0015 |
| rules-and-practice | 5 | Chapter 2: per-area verdicts, the required note when deficiencies are found | dossier `pay-mapping.md` |
| equal-work | 6 | Chapter 3: groups of equal work (formed without seniority, ADR-0017), the gap flags, objective-reason documentation, creating actions/notes from a finding | ADR-0012; ADR-0017 |
| equivalent-work | 7 | Chapter 4: women-dominated groups (at least 60 percent), the comparator logic (equally-or-lower-valued but higher-paid), the scatter view | dossier `pay-mapping.md` |
| actions-and-notes | 8 | Action fields (problem, action, owner, date, cost, priority, status) vs note kinds, the one overview table, deep links back into chapters | ADR-0015 |
| run-lifecycle | 9 | Statuses (active, paused, under review, completed), read-only after freezing, how many runs an org keeps | ADR-0011 |

### Task 3.7: assistant (3 pages)

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| using-the-assistant | 1 | The prompt on Overview vs the full page, conversations (new/rename/history), stopping a reply | dossier `assistant.md`; ADR-0018 |
| assistant-capabilities | 2 | What it answers (concepts, org aggregates, the docs), the charts it can draw, that every number comes from its tools | `assistant/tools.ts` |
| assistant-privacy | 3 | The employee-name screen (message rejected before any AI call), group suppression (never a number for a too-small group), EU hosting, usage logging | dossier `assistant.md`; ADR-0018 |

**Files:** Create `en/{using-the-assistant,assistant-capabilities,assistant-privacy}.mdx`. Modify `docs-nav.ts`. NOTE: `assistant-capabilities` mentions docs search, which lands in Phase 5; write the sentence so it is true only after Phase 5 ships, and Phase 5's Task 5.6 verifies it (this plan ships as one review unit, so the page and the feature arrive together).

### Task 3.8: organization (3 pages)

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| organization-settings | 1 | Logo, country/currency/language/industry, what each drives (locale default, model template) | dossier `organization.md` |
| members-and-roles | 2 | Admin vs editor capabilities (exact boundary: editors register roles and rate, admins change model/weights/members), the last-admin guard | `docs/contexts/accounts/CONTEXT.md` |
| invitations | 3 | Inviting by email + role, pending state, revoking, the acceptance flow | dossier `organization.md` |

**Files:** Create `en/{organization-settings,members-and-roles,invitations}.mdx`. Modify `docs-nav.ts`.

### Task 3.9: account (4 pages)

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| profile-and-language | 1 | Avatar, display name, UI language (personal, not the org default) | dossier `account.md` |
| two-factor-authentication | 2 | TOTP vs email method, backup codes (regeneration is password-gated), that 2FA is mandatory | `docs/superpowers/specs/2026-06-26-mandatory-2fa-design.md` |
| changing-your-email | 3 | The double opt-in (confirm in current inbox, then the link sent to the new address) | dossier `account.md` |
| deleting-your-account | 4 | What erasure removes (GDPR), type-to-confirm + password, that it is immediate and irreversible | dossier `account.md` |

**Files:** Create `en/{profile-and-language,two-factor-authentication,changing-your-email,deleting-your-account}.mdx`. Modify `docs-nav.ts`.

### Task 3.10: security-privacy (4 pages)

| Slug | Order | Must cover | Primary sources |
|---|---|---|---|
| data-residency | 1 | All data in the EU (Convex eu-west-1), what that covers | ADR-0001 |
| audit-log | 2 | What is recorded (every change to domain data), categories, filters, the detail sheet's before/after view | dossier `security-privacy.md` |
| how-ai-is-used | 3 | AI is suggestion-only with human confirmation, never in the score path, EU-hosted models, never personal data in prompts, where AI appears (the six surfaces) | ADR-0003; ADR-0018 |
| gdpr-and-erasure | 4 | The two erasure paths (app user, employee), what anonymization of the trail means (tombstones, structural residue), data minimization | ADR-0013; CLAUDE.md erasure section |

**Files:** Create `en/{data-residency,audit-log,how-ai-is-used,gdpr-and-erasure}.mdx`. Modify `docs-nav.ts`.

### Task 3.11: glossary (1 page) and guard 6

**Files:** Create `en/glossary.mdx`; Test: extend `apps/dashboard/lib/docs/docs-guards.test.ts` (guard 6). Modify `docs-nav.ts`.

- [ ] **Step 1: Write the failing guard**

Append to `docs-guards.test.ts`:

```ts
import { headingAnchor } from "@/lib/docs/anchors"
// en is already imported at the top of the file.

describe("guard 6: term coverage", () => {
  const labelOf = (value: unknown): string | null => {
    if (typeof value === "string") return value
    if (
      value !== null &&
      typeof value === "object" &&
      "label" in value &&
      typeof (value as { label: unknown }).label === "string"
    ) {
      return (value as { label: string }).label
    }
    return null
  }
  // Terms whose home is a domain namespace; pay-mapping and people terms
  // have no glossary namespace, so they are listed explicitly.
  const EXTRA_TERMS = [
    "Pay mapping",
    "Equal work",
    "Equivalent work",
    "Collaboration",
    "Rules and practice",
    "Action",
    "Note",
    "Reference date",
    "Frozen data",
    "Classification",
    "Pay gap",
    "Quartile",
  ]
  it("every canonical term has a glossary heading", () => {
    const anchors = anchorsOf("en", "glossary")
    const terms = [
      ...Object.values(en.model).map(labelOf),
      ...Object.values(en.assessment).map(labelOf),
      ...EXTRA_TERMS,
    ].filter((t): t is string => t !== null)
    for (const term of terms) {
      expect(anchors.has(headingAnchor(term)), `glossary is missing: ${term}`).toBe(true)
    }
  })
})
```

If a `model`/`assessment` namespace value turns out to be a sentence rather than a term label, add a reviewed `EXCLUDED_TERM_KEYS` set beside `EXTRA_TERMS` and filter by key, with a comment naming why each exclusion is not a term.

- [ ] **Step 2: Run to verify failure** (`glossary.mdx` does not exist yet)

- [ ] **Step 3: Write `en/glossary.mdx`**

Frontmatter: title "Glossary", section `glossary`, order 1. One `##` heading per term, heading text EXACTLY the en term label (so `headingAnchor` matches). Entry format, two short paragraphs at most: the definition, then the boundary against the neighbouring term where one exists. Every term the guard lists, plus the Swedish statutory term in parentheses where it differs (e.g. "Pay mapping (lönekartläggning)" belongs in the body text, NOT the heading, which must stay exactly the term label).

- [ ] **Step 4: Run guards 2-4 and 6**

Expected: PASS.

### Task 3.12: troubleshooting (4 pages) and guard 7

**Files:** Create `en/{troubleshooting-sign-in-and-account,troubleshooting-model-and-evaluation,troubleshooting-people-and-import,troubleshooting-pay-mapping}.mdx`; extend `docs-guards.test.ts` (guard 7). Modify `docs-nav.ts`.

- [ ] **Step 1: Write the failing guard**

```ts
describe("guard 7: error coverage", () => {
  it("every errors namespace key is explained on a troubleshooting page", () => {
    const pages = [
      "troubleshooting-sign-in-and-account",
      "troubleshooting-model-and-evaluation",
      "troubleshooting-people-and-import",
      "troubleshooting-pay-mapping",
    ]
    const text = pages.map((slug) => bodyOf("en", slug).content).join("\n")
    for (const key of Object.keys(en.errors)) {
      expect(text.includes(`\`${key}\``), `no troubleshooting entry for: ${key}`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write the four pages**

Each entry is a `###` under a task-oriented `##` (e.g. "I cannot save my weighting"): the user-visible message (the en.json `errors` value, quoted), the error key as inline code (`weightsUnbalanced`), why it appears, what to do, and a link to the page where the fix happens. Distribute all 31 keys by area (the dossier's heading 4 per section says which surface raises which key); generic plumbing codes (`notAuthenticated`, `notFound`, `invalidInput`) live on the sign-in-and-account page under a "General" heading.

- [ ] **Step 4: Run guards 2-4, 6, 7** Expected: PASS.

### Task 3.13: guard 5 (assistant prompt routes)

**Files:** Test: extend `apps/dashboard/lib/docs/docs-guards.test.ts`.

The prompt file is read as TEXT (no backend import chain into dashboard vitest; precedent: `gender-mark.test.tsx` reads `globals.css`).

- [ ] **Step 1: Write the guard**

```ts
describe("guard 5: assistant prompt routes", () => {
  it("every path in the prompt's Pages list is a real static route", () => {
    const source = readFileSync(
      new URL(
        "../../../../packages/backend/convex/assistant/knowledge.ts",
        import.meta.url
      ).pathname,
      "utf8"
    )
    const paths = [...source.matchAll(/^\s*"- .+? \((\/[a-z0-9/-]*)\):/gm)].map(
      (m) => m[1] ?? ""
    )
    expect(paths.length).toBeGreaterThanOrEqual(9)
    const appRoutes = collectStaticAppRoutes()
    for (const p of paths) {
      expect(appRoutes.has(p), `prompt lists a route that does not exist: ${p}`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it**

Expected: PASS against the current prompt (9 pages today; Phase 5 adds `/docs`, raising the count to 10, and this guard keeps passing).

### Task 3.14: Consolidation review pass

**Files:** Modify any `en/*.mdx` per findings; finalize `POPULAR_DOCS` in `docs-nav.ts` (pick 4-6: introduction, importing-people, weighting-and-point-budget, equal-work are the expected candidates).

- [ ] **Step 1: Review fan-out** (workflow): four parallel reviewers over the whole en corpus, each with one lens: (a) terminology (glossary conformance + ADR-0014 renames; flag any use of Band or old Nivå senses), (b) boundary clarity (does every page that touches level/seniority/step/weight state the boundary?), (c) UI-label fidelity (every quoted label exists verbatim in en.json), (d) redundancy and depth (detail explained on a neighbouring page is linked, not repeated). Adversarially verify findings before editing (a finding must cite the page and the exact sentence).

- [ ] **Step 2: Apply confirmed findings, re-run all guards** (`bun run test -- lib/docs/docs-guards.test.ts -t "guard 2|guard 3|guard 4|guard 5|guard 6|guard 7"`)

- [ ] **Step 3: Full check** `cd apps/dashboard && bun run lint && bun run typecheck`. Leave staged-ready.
