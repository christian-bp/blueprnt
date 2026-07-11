# Full-app audit — 2026-07-10

Method: 26 scoped auditors (one lens x one area each), every finding then adversarially
verified by an independent skeptic panel (critical/major: 3 lenses — code-truth,
reachability, intent-guards, >=2 votes decide; minor: 1 code-truth skeptic). Ground truth
was the project's own written rules: CLAUDE.md invariants + all 10 ADRs + glossaries.

**Result: 45 raw findings, 44 confirmed, 1 refuted.** After deduplication (several issues
were found independently by multiple auditors), there are **3 distinct GDPR erasure defects**,
**5 other correctness/invariant bugs**, and **~24 documentation-drift / hygiene items**.

Scope covered: all of `packages/backend/convex` (every bounded context), `packages/core`,
`packages/import`, the audit/i18n label coverage, and all 10 ADRs. Excluded by policy:
`packages/ui/src` (vendor), `_generated`, `apps/web`, message-file linguistic quality.

Encouraging headline: the tenant-isolation lens found **zero cross-tenant / IDOR issues**.
The `orgQuery`/`orgMutation`/`admin*`/`platform*` wrapper layer holds; every client-supplied
document id that was checked is ownership-verified against the caller's org. The one security
finding raised (foreign-blob attach) was **refuted** on verification.

---

## Priority 1 — GDPR erasure is incomplete (3 distinct defects)

All three violate "Deleting a person is a true hard delete ... Residual PII in append-only
logs is anonymized, not retained." Each was found by multiple independent auditors.

### P1.1 — Audit `searchText` retains the erased person's real name (CRITICAL)
Found 4x (gdpr:role-person, gdpr:erasure, audit:accounts-model, adr:0009). Verdict: CONFIRMED by all 3 skeptic lenses.

- **Where**: `accounts/account.ts:245` & `:252` (`eraseSelf`), `platform/admin.ts:690` & `:697` (`deleteUser`).
- **Bug**: erasure patches `actorName` → `"deleted user"` but never rewrites `searchText`,
  which `buildSearchText` (`lib/audit.ts`) built at write time starting with the actor's real
  name. The name stays physically stored **and** full-text-searchable in both `auditLog` and
  `platformAuditLog`.
- **Impact**: after Anna Svensson erases her account, an org admin who types "svensson" into the
  audit-log search (`accounts/audit.ts` `searchAuditLog`, `search_text` index) still gets back
  every row she authored, re-identifying the tombstoned actor. The table's own contract claims
  this cannot happen.
- **Fix**: in all four loops, patch `searchText` alongside `actorName`:
  `ctx.db.patch(row._id, { actorName: ERASED_ACTOR_NAME, searchText: buildSearchText(ERASED_ACTOR_NAME, row.type, row.payload) })`.
  Extract a shared `anonymizeAuthoredAuditRows` helper in `lib/audit.ts` so the two paths can't
  drift. Add a regression test: post-erasure name search returns zero rows.

### P1.2 — Employee number (`externalRef`) retained in audit payloads (CRITICAL / MAJOR)
Found 3x (audit:assessment-people-ai, gdpr:role-person x2). Verdict: CONFIRMED by all lenses.

- **Where**: `lib/audit.ts:385` (`PERSON_AUDIT_FIELDS` includes `externalRef`), written by
  `people/people.ts` (create/upsert) and `people/erase.ts:84-91`.
- **Bug**: `externalRef` (Anställningsnummer — a personal identifier under GDPR Art. 4(1)) is in
  the audited field list, so `person.created/updated/erased` payloads and their `searchText`
  permanently record it. `erasePersonAsOrg` even **writes a fresh `person.erased` row containing
  the employee number at the moment of erasure**.
- **Impact**: after a hard delete, an org admin can search the audit log for "4711" and retrieve
  the erased person's retained profile trail (department, country, start date, manager flag),
  keyed by a number the org's payroll trivially maps back to the individual.
- **Fix**: remove `externalRef` from `PERSON_AUDIT_FIELDS` (and the `people/erase.ts` /
  `people/people.ts` snapshots) — `personId` already provides the internal trace key — or scrub
  `externalRef` from all rows referencing the `personId` during erasure. Extend `erase.test.ts`
  to assert the employee number is absent from the erased payload.

### P1.3 — Better Auth `twoFactor` credential row never deleted on erasure (MAJOR)
Found 3x (iso:betterAuth, iso:platform, gdpr:erasure). Verdict: CONFIRMED; skeptics downgraded critical→major (the secret is random + backup codes + a dangling opaque `userId`, so it is an erasure-**completeness** violation, not a direct PII leak).

- **Where**: `betterAuth/provisioning.ts:209` (`eraseUser`).
- **Bug**: `eraseUser` deletes member/account/session/invitation/user rows but never the
  `twoFactor` row (TOTP secret + backup codes, keyed by `userId`). 2FA is mandatory for every
  user, so **every** erasure (both self-delete and platform `deleteUser`) leaves one behind
  forever; no other code path ever deletes from that table.
- **Fix**: in `eraseUser`, `ctx.db.query("twoFactor").withIndex("userId", q => q.eq("userId", userId)).collect()`
  then delete each, alongside the session deletes. Add a test that seeds a `twoFactor` row and
  asserts erasure removes it. Also update the CLAUDE.md erasure enumeration to name this table.

**Related (P1.3 sibling, minor)**: `betterAuth/seed.ts:79` — `AUTH_WIPE_TABLES` omits
`twoFactor` and `rateLimit`, so the documented "wipes EVERY Better Auth table except jwks"
(seedProduction / resetDatabase) silently retains prior users' TOTP secrets. Add both tables to
`AUTH_WIPE_TABLES`.

**Related (P1, major)**: `betterAuth/provisioning.ts:242` — erasure keys only on the user's
**current** email, so an invitation row addressed to a previous email (after the `changeEmail`
flow) survives forever, and the Sweego message purge misses mail to the old address. Purge by
all addresses the system has seen, or handle old-address cleanup in the `changeEmail` commit.

---

## Priority 2 — Correctness & invariant bugs

### P2.1 — `parseMoney("52,000")` returns `52` (MAJOR, silent data corruption)
`packages/import/src/parse.ts:44`. ADR-0010 lists en-US comma-thousands as unsupported (should
return `null`), but the single-group case reads the comma as a Nordic decimal. A US payroll
export with "52,000" imports a salary **1000x too small**, silently — `validate` raises nothing
because the parse "succeeds". Either return `null` for `,` + exactly 3 digits (surfacing
`unparsableMoney`), or amend the ADR and add a sub-1000-salary sanity notice. `parse.test.ts`
currently pins the wrong behavior.

### P2.2 — Changing a role's track orphans stored individual levels (MAJOR)
`assessment/roles.ts:408` (`updateRole`). Changing `trackKey` doesn't revalidate existing
`personAssignments`, so an IC3 level can end up on a Manager-track role — violating ADR-0005's
definition of level as seniority *within the role's track*. On a `trackKey` change, either reject
while active assignments exist or remap each affected level to the new track (source →
`suggested`) with an audit row.

### P2.3 — Onboarding starter reconcile archives roles without a `band.shift` (MAJOR)
`assessment/starters.ts:551` (`reconcileStarterSet`). Archiving a fully-rated role here writes
`role.archived` but no `band.shift 1→null`, while archiving the same role via
`assessment.archiveRole` does. The audit band-history becomes path-dependent. Mirror
`archiveRole`: derive results before/after the archive loop and call `logBandShifts`.

### P2.4 — Interactive AI drafts carry no provenance into the audit trail (MAJOR → minor, contested)
`ai/draft.ts:20` & `:108`. `draftRoleProfile` / `draftCriterionCompliance` fill the edit form,
and the eventual `updateRole` / `saveCriterionCompliance` writes a plain `role.updated` /
`modelUpdated` row with no `source: 'ai'` marker (unlike the prefill's `applyPrefill`). A
pay-transparency audit can't tell AI-authored text apart. ADR-0003 limits the no-suggestion
pattern strictly to onboarding prefill. One skeptic rated this minor; carry a provenance marker,
or route through the suggestion layer, or write an ADR amendment. **Note**: this bias-review
draft feature is also *absent from ADR-0003's scope list* (see P3).

### P2.5 — Starter-import prompt forwards pasted employee names to the AI (MINOR, but a real PII concern)
`ai/generate.ts:217`. The paste UI help copy invites pasting "straight from a document,
spreadsheet or HR system", and `requestStarterImport` forwards the text verbatim to Mistral.
Pasted `"Anna Andersson, HR Manager"` lines send employee names to the AI provider, brushing the
"never send personal data to the AI" rule. Add a "titles only, never names" caution to the help
copy (all locales) + a prompt rule to drop name tokens; optionally warn client-side on
`Name, Title` patterns.

### P2.6 — Import column detection reads the wall clock (MINOR, determinism)
`packages/import/src/detect.ts:96`. `detectColumns` defaults `currentYear` to
`new Date().getFullYear()` and the production caller (`map-step.tsx:70`) doesn't pass one, so a
headerless date column can be suggested as `employmentStartDate` in 2026 and `birthDate` in 2027
for the identical file — violating ADR-0010's "no parser reads the clock". Make `currentYear`
required for the headerless path and pass it explicitly from the UI.

---

## Priority 3 — Documentation drift (ADRs / glossaries stale vs. shipped code)

These are all "the code is right, the written record is stale" (or a stale comment). They matter
because CLAUDE.md tells agents/developers to read the ADRs before changing architecture, so a
stale ADR actively misleads. All verified CONFIRMED.

| # | File | Drift |
|---|------|-------|
| 16 | CLAUDE.md:44 | The "PII lives only in the users mirror + Better Auth tables" rule is factually false: the `people`/`pay` context stores person + salary PII by design and has its own `erasePersonAsOrg` hard-delete path the erasure bullet never mentions. Carve out the people context; name both erasure paths. |
| 17 | adr:0003 | V1 scope list omits two shipped AI features: the starter import and the criterion-compliance/**bias-review** draft. "biaskoll deferred" misleads. |
| 18 | adr:0003 | Prefill "one call per set" is stale: code chunks at `PREFILL_MAX_PER_CALL = 5` in concurrency waves (a 40-role org = 8 calls / 8 usage rows). |
| 19 | adr:0003 | Pins "AI SDK v6"; backend ships v7 (`ai: ^7.0.2`). Drop the major version from the ADR. |
| 20 | adr:0005 | "level definitions exist only in standardmall.md pending V2" is stale: `TRACK_LEVELS` in `@workspace/constants` is the live enforcement source; levels are stored on `personAssignments`. `standardTemplate.ts:52-55` echoes the stale comment. |
| 21 | adr:0006 | Lists a retired `emails` table and "9 tables"; email moved to the Sweego component and the schema now has ~17 tables. |
| 22 | adr:0007 | "flow to create/join more orgs" is stale: adding orgs is deliberately back-office (ADR-0009). `nav-organization.tsx:41` miscites ADR-0007. |
| 23 | adr:0009 | Says the mirror has no email index + bootstrap uses `.filter`; a `by_email` index now exists and bootstrap uses it. |
| 24 | adr:0009 | Invitation events described as "not yet launched, email in payload"; the flow is live and payloads are email-free by construction. |
| 25 | adr:0009 | "self-erasure is blocked for operators" + "platformAuditLog is the unmixed operator trail" both no longer hold since self-service `deleteMyAccount` shipped (writes `platform.userDeleted` self-attributed). |
| 26 | adr:0005 | `CONTEXT.md:18`, `standardmall.md:65`, `PLAN-V1.md:131`/`:45` still say levels are "seeded in the model" / roles are "nivåroller"; item 14 lacks the revision annotation the convention requires. |
| 27 | adr:0001 | ADR-0001's pre-go-live action (confirm Sweego EU hosting region + sign DPA) is on no actionable list in `docs/go-live-checklist.md`. Add a checkbox under Security and compliance. |
| 33 | adr:0004 | `ratings.ts:51` no-op comment cites `updateCriterionImportance`, a mutation removed by ADR-0004 (now `rebalanceWeights`). |
| 34 | adr:0005 | Dead residue: `seed.ts:11` comment cites nonexistent `RATINGS_BY_LEVEL` (code uses `RATINGS_BY_TITLE`); `devCompany.ts:24` `DevRole.level` field has no reader; `roles.test.ts:109` names a removed "guardrails" concept. |
| 36 | adr:0004 | `model.test.ts:319` test named "...never weights" (pre-ADR-0004 invariant) but body asserts the visible-weightPoints world. Rename. |
| 38 | adr:0004 | `evaluationModel/tables.ts:35` comment states retired "removal requires 3" precondition; code follows the amended one-click redistribution rule. |
| 40 | adr:0010 | `people/tables.ts:99` comment advertises "CSV/XLSX imports"; XLSX is explicitly out of scope for V1 (no parser exists). |
| 41 | adr:0006 | `packages/core/src/types.ts:9` defines a dead duplicate `TRACK_KEYS`/`TrackKey` with zero consumers; authoritative copy is in `standardTemplate.ts` (test-guarded). Delete it (pre-launch no-legacy). |
| 43 | adr:0010 | ADR claims `isMoney` matches `parseMoney` exactly; the detector is deliberately a strict subset (protects postal codes / grouped ids). Amend the ADR to state the one-way guarantee. |
| 44 | adr:0010 | The OLE2 (.xls) branch of the binary guard is inert: UTF-8 decode destroys the signature and the deferred "ArrayBuffer sniff" was never implemented. Either implement the sniff in `upload-step.tsx` or amend the ADR. |
| 29 | adr:0007 | `organization.ts:204` `getLanguageForUser` uses `memberships[0]` under a stale "one org in V1" comment; a multi-org user can get reset/welcome mail in the wrong entity's language. Prefer `users.locale`. |
| 30 | adr:0007 | `updateOrganizationSettings:70` still accepts a client `employeeCount` though it's now derived from imported people; leaves a manual write path that desyncs the derived value. Remove the arg. |
| 37 | DRY | `model.ts:271` inlines `["name","bandThresholds"]` instead of `MODEL_AUDIT_FIELDS`; `mirrors.ts:254` inlines the settings field list instead of `SETTINGS_AUDIT_FIELDS`. Behavior-identical today; drifts silently when a field is added. |
| 28/32/39 | iso | Error-contract drift: `onboarding.ts:114` `setUiLocale` hand-rolls the `authedMutation` auth check; `ai/prefill.ts:103` throws `new Error(...)` instead of `appError(...)` (redacted in prod, breaks i18n mapping); `lib/functions.ts:157` `requireOrgAdminAction` omits the `try/catch` that converts a duplicate-membership throw into `errors.membershipConflict`. |

---

## Refuted (adversarial verification working as intended)

**`files.ts:69` foreign-blob attach (raised MAJOR → REFUTED).** The finder claimed a caller
could attach another org's stored blob (validated only as exists/size/image-mime, no ownership
check) and delete it. The skeptic checked the live deployment: Convex serving URLs do **not**
expose the raw storage id, so the attacker has no way to obtain a foreign `storageId`. The
missing ownership check is real but unreachable. Worth a defensive hardening ticket (record the
uploader on `generateImageUploadUrl`, verify on apply) but not a live vulnerability.

---

## What was verified clean (per-unit coverage highlights)

- **Tenant isolation** (9 shards): wrappers resolve org from the JWT subject + membership, never
  from client args; fail closed; every checked client-supplied id is ownership-verified. Raw
  actions (`ai/draft`, `ai/prefill`, `people/import`) authenticate before touching data.
  `betterAuth/*` raw registrations are component-internal (not client-callable). No IDOR found.
- **Audit labels**: all 39 `AUDIT_EVENTS` + 9 `PLATFORM_AUDIT_EVENTS` have payload entries and
  locale labels; the compile-time payload guards and coverage test are live.
- **Core purity**: no framework coupling, no clock/random/network in `packages/core`; score/band
  is never persisted anywhere in the schema.
- **ADR-0002 / 0008**: no stored score/band, no snapshot/report-run tables (correctly not built).

## Recommended follow-through

1. Fix the 3 P1 erasure defects together (shared root cause: erasure misses derived/secondary
   stores) and land each with a regression test — then encode each as a guard test so it can't
   regress, the way the i18n-parity and audit-label tests already work.
2. Fix P2.1 (money parse) — it's silent salary corruption, the highest-impact non-GDPR bug.
3. Batch the P3 ADR/comment drift into one `docs:` sweep.
4. Not yet run: the UI-convention sweep (forms/tables/skeletons/toasts/layout-shift/animation
   across the 11 dashboard surfaces) and the i18n hardcoded-text/parity sweep. Say the word.
