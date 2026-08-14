# Troubleshooting dossier

No document in SOURCES.md is tagged for the troubleshooting section. This
dossier is synthesized directly from the errors namespace in
`packages/i18n/messages/en.json`, the backend code that throws each code, and
the frontend surfaces that translate it, cross-checked against ADRs and specs
for rationale.

## Behavior today

### The error-code pipeline (all flows)

- The backend never returns display text. Every thrown error is
  `appError(ERROR_CODES.<key>)`, a `ConvexError<{ code: "errors.<key>" }>`.
  Source: `packages/backend/convex/lib/errors.ts` (`ERROR_CODES` map,
  `appError` helper). 31 codes exist today (enumerated below).
- The frontend's generic decoder is `apps/dashboard/lib/convex-error.ts`
  (`translateErrorCode`): it strips the `errors.` prefix, checks it against a
  known-key allowlist, and falls back to the generic `aiGenerationFailed`
  message for anything unrecognized or for a non-`ConvexError` failure (e.g.
  a network error). This specific helper's allowlist covers only the
  assistant's 4 codes (`assistantBusy`, `assistantRateLimited`,
  `assistantInvalidMessage`, `assistantPersonalData`).
- Other surfaces each keep a small local allowlist of codes they give bespoke
  copy to, matching the ConvexError message by substring (`error.message.includes("errors.<key>")`)
  rather than by the structured `.data.code`, because the failure is often
  caught as a generic `Error` by the time it reaches the component:
  - `apps/dashboard/lib/error-label.ts` (`draftErrorKey`, `aiErrorSubKey`):
    AI draft-panel failures, allowlist `aiUnavailable`, `aiGenerationFailed`,
    `profileIncomplete` (`notFound` deliberately excluded, see Deliberately
    absent).
  - `apps/dashboard/lib/role-error.ts` / `family-error.ts`: substring match on
    `errors.roleExists` / `errors.roleFamilyExists`.
  - `apps/dashboard/lib/pay-mapping-errors.ts`: `instanceof ConvexError` +
    `.data.code` idiom for pay-mapping's own codes.
  - `apps/dashboard/components/model/model-builder.tsx` (`KNOWN_ERROR_KEYS`):
    `weightsUnbalanced`, `tooFewCriteria`.
  - `apps/dashboard/components/account/delete-account-section.tsx`:
    `lastAdmin` vs `wrongPassword` vs generic.
  - `apps/dashboard/components/people/add-person-dialog.tsx` /
    `edit-person-dialog.tsx`: `personRefExists` mapped onto the employee
    number field as an inline `FormMessage`, not a toast.
  - Any code with no bespoke handling on a given surface falls back to that
    surface's generic copy (usually `toast.error(t("dashboard.toast.error"))`
    or a form/dialog's own "Something went wrong" text), per the CRUD-toast
    convention (CLAUDE.md "User-initiated CRUD shows a toast").

### Sign-in and account (feeds troubleshooting-sign-in-and-account)

- Session/membership guards live in `packages/backend/convex/lib/functions.ts`:
  `notAuthenticated` (no identity), `notAMember` (identity has no membership
  row for the caller's org), `membershipConflict` (more than one membership
  row resolves, or the row conflicts with the caller's org context; the
  message tells the user to contact support because the app cannot resolve
  it itself), `adminRequired` (mutation restricted to the `admin` member
  role), `platformAdminRequired` (restricted to the separate platform-admin
  flag, ADR-0009's deliberate org-scoping exception).
- Password reset: `apps/dashboard` auth strings `dashboard.auth.resetPassword.missingToken`
  ("This link is invalid or has expired"), `.expired` ("This link has expired
  or was already used"), `.error` generic. `dashboard.auth.invalidCredentials`
  covers a failed sign-in attempt; `dashboard.auth.twoFactor.error` covers a
  wrong 2FA code.
- Two-factor authentication is mandatory with no exemption:
  `packages/backend/convex/accounts/twoFactor.ts` (`getMyMfaStatus`,
  `confirmMfaSetup`). `confirmMfaSetup` throws `invalidInput` if Better
  Auth's own 2FA record is not actually enabled yet (a backstop against
  stamping `mfaConfirmedAt` early), and `notFound` if the caller's `users`
  mirror row is missing.
- Deleting your own account: `apps/dashboard/components/account/delete-account-section.tsx`.
  Blocked with `lastAdmin` when the account is the sole admin of one or more
  organizations (`account.ts` line 208, `lastAdminOrgs`); the dialog lists the
  affected org names and tells the user to contact support. The same
  `lastAdmin` code blocks demoting (`updateMemberRole`) or removing
  (`removeMember`) the sole admin from an organization
  (`accounts/organization.ts` lines 376, 405, via `isSoleAdmin`).

### Model and evaluation (feeds troubleshooting-model-and-evaluation)

- Model creation is a one-time act: `modelExists` blocks `createModel` if the
  org already has one (`evaluationModel/model.ts:34`).
- The point-budget weighting gate: `weightsUnbalanced` fires from
  `evaluationModel/criteria.ts:211` (via `rebalanceWeights`) and
  `ai/persist.ts:58` (an AI-suggested weighting must also land exactly on
  budget) whenever the criteria's weight-point sum does not equal
  `pointBudget(criterionCount)` = `criterionCount x 3`
  (`packages/core/src/weighting.ts`, `NEUTRAL_WEIGHT_POINTS = 3`). Weight
  points are integers 1-5 (`WEIGHT_POINT_VALUES`); `isBalanced`/`budgetDelta`
  are the pure functions the gate calls. The frontend shows this inline in
  the weighting toolbar as an amber "remaining/over" count, not only as an
  error toast (`model-builder.tsx`).
- The composition floor: `tooFewCriteria` fires from
  `evaluationModel/criteria.ts:295` (removing a criterion once onboarding is
  finished would drop the count below the floor) and
  `accounts/organization.ts:123` (`completeOnboarding`'s server-side
  backstop; the onboarding wizard's own Next-button gate enforces the same
  floor client-side first). The floor is `MIN_CRITERIA = 5`
  (`packages/core/src/weighting.ts:19`). While a model is still mid-build
  (before `completeOnboarding`), the count may dip below 5 freely; the floor
  only blocks finishing onboarding or removing a criterion afterward.
- Role/criterion locking after approval: `roleLocked` fires when a mutation
  targets an archived role (`role.archivedAt !== undefined`), e.g. rating
  (`assessment/ratings.ts:30`), editing (`assessment/roles.ts:418`), anchor
  management (`assessment/anchorRoles.ts:76,155`), AI role-profile suggestion
  application (`ai/suggest.ts:903`). `criterionLocked` fires when editing
  compliance text on an already-approved criterion
  (`evaluationModel/method.ts:90`); un-approving first (`setCriterionApproval`
  with `approved: false`) reopens it. Both are true immutable-after-decision
  locks, not a UI-only disable: `role-profile-card.tsx` comments that "locked
  roles never enter edit mode (the backend rejects them with roleLocked
  anyway)", i.e. the client-side disable is a UX nicety, the backend check is
  the actual gate.
- `ratingsIncomplete` fires when setting a role as an anchor role or resolving
  its expected level before all criteria are rated
  (`assessment/anchorRoles.ts:86,157`).
- `profileIncomplete` fires when rating a role whose job profile lacks the
  mandatory core (`assessment/ratings.ts:35`, via `isProfileComplete`) and
  when an AI generation call needs organization/company context that is not
  yet filled in (`ai/suggest.ts:56,852,1043`, `ai/prefillData.ts:109`). The
  role detail page shows this as an inline `Alert` ("Complete the company
  profile first") in place of the Rate button rather than only as an error
  toast (`role-evaluation-card.tsx` lines 236-245, and
  `app/(app)/roles/[roleSlug]/rate/page.tsx:109`), following the "preconditions
  in words" guidance convention.
- `invalidTransition` covers illegal status changes generically: e.g.
  applying an AI suggestion to a role not in the right state
  (`ai/suggest.ts:755`), acting on a pay-mapping run that is not `active`
  (`payMapping/runs.ts:518,726`).
- `roleExists` / `roleFamilyExists`: duplicate name within scope (a role name
  clash within its family, a family name clash within the org). Frontend:
  `lib/role-error.ts`, `lib/family-error.ts`. Also raised from bulk starter
  application (`assessment/starters.ts`).
- AI generation failures: `aiUnavailable` (no model configured for this
  environment, e.g. missing API key) vs `aiGenerationFailed` (the call ran
  but failed or returned unusable output). `lib/error-label.ts`
  (`aiErrorSubKey`) maps a persisted draft's stored error code to one of
  these two; unknown codes fall back to `aiGenerationFailed`.

### People and import (feeds troubleshooting-people-and-import)

- `personRefExists`: duplicate employee number (`externalRef`) within the
  org, thrown from `people/people.ts:81` (create) and `:422` (update).
  Surfaced as an inline field error on the employee-number input in both
  `add-person-dialog.tsx` and `edit-person-dialog.tsx`, not a toast.
- `invalidSeniority`: the chosen seniority value is not valid for the role's
  track (`people/assignments.ts:170`, `isValidSeniorityForTrack`). Seniority
  values are the ladder positions (IC1-IC5, Lead-1-Lead-3, M1-M3, ADR-0005);
  changing a role's track resets affected people's seniority
  (`docs/superpowers/specs/2026-07-12-role-track-change-design.md`).
- `invalidEffectiveDate`: a new assignment's effective date must be strictly
  after the currently open assignment's start date
  (`people/assignments.ts:187`); V1 assumes each new assignment is the
  latest and does not support out-of-order timeline insertion (deferred to
  V2-core per the code comment at that line).
- CSV upload rejection, before any row-level validation runs
  (`apps/dashboard/components/people/import/upload-step.tsx`,
  `handleCsvText`/`processFile`):
  - `errorNotCsv`: wrong extension/MIME, or content sniffed as markup (HTML/
    XML/an HTML comment opener, `MARKUP_PREFIXES`), or legacy binary `.xls`
    (OLE2 magic bytes `0xd0 0xcf 0x11 0xe0 0xa1 0xb1 0x1a 0xe1`, sniffed
    before UTF-8 decoding because decoding would destroy the signature), or
    a tokenizer-level `ImportFormatError` (e.g. ZIP/XLSX/ODS, whose
    `PK\x03\x04` magic survives UTF-8 decoding and is caught in the
    tokenizer itself). Deliberately one coarse message for every "not CSV
    data" case, because the user's next action (re-export as CSV) is the
    same regardless of which non-CSV format it actually was.
  - `errorEmpty`: the file is empty after trimming, or has no headers, or
    has zero data rows, or the browser's `FileReader` itself errored.
  - Only CSV is accepted (ADR-0010 narrowed file input to CSV-only while
    broadening its parsing of numbers/dates/FTE).
- Row-level data-quality issues, surfaced on the Check-readiness step
  (`packages/import/src/validate.ts`, `RowIssueCode`,
  `ROW_ISSUE_SEVERITY`; labels in `dashboard.people.import.check.issue.*`):
  - Severity **error** (blocks the import until fixed in the source file, or
    for `unresolvedGender`, assigned in-app): `duplicateId` (duplicate
    employee ID), `unparsableMoney` (unreadable salary value),
    `nonNumericCode` (non-numeric statistical/occupation code),
    `unresolvedGender` (gender could not be read; the app offers an
    in-app per-row assignment screen, `check.assignGender.*`, which sends no
    personal data beyond the employee ID), `negativeValue` (negative salary
    value), `raggedRow` (row has the wrong number of columns).
  - Severity **notice** (does not block; shown under "Good to know"):
    `genderNameMismatch` (a name-based gender heuristic disagrees with the
    supplied value; can be a false positive), `fractionScaled` (an FTE value
    read as a fraction, e.g. 0.5, and scaled to a percentage),
    `ambiguousDate` (a date with no unambiguous order, read as day/month).
  - File-level warnings (`FileWarningCode`, non-blocking):
    `noDelimiter` (no column separator detected), `mojibake` (header text
    looks garbled, i.e. wrong source encoding), `headerless` (no header row;
    columns were identified from content, so the mapping step needs
    checking).
  - Required-field mapping gaps block ("The following required fields are
    not mapped..."); missing recommended fields warn but do not block
    (`check.blocking` vs `check.warnings`).
- Bulk starter import caps (role-family seeding, `assessment/starters.ts`):
  `MAX_FAMILIES = 20`, `MAX_ROLES = 100` (`packages/constants/src/starterSet.ts`).
  Exceeding either throws `invalidInput`.

### Pay mapping (feeds troubleshooting-pay-mapping)

- `payMappingPreconditionsUnmet`: starting a run is blocked until every active
  person has a confirmed classification (an open assignment to a live,
  non-archived role) and every staffed active role resolves a complete
  evaluation level (`payMapping/runs.ts:157`, `computePayMappingPreconditions`).
  Rather than only erroring, the create surface swaps to
  `PayMappingPreconditionsPanel` (`components/pay-mapping/pay-mapping-preconditions-panel.tsx`),
  which lists the exact unmet items (import people / classify N people /
  evaluate N roles) each as a direct link to where the work happens, capped
  at `MAX_ITEMS` (the same cap the dashboard to-do uses) for the unevaluated-
  role sublist.
  - Definitions used by the gate: "classified" = a confirmed open assignment
    to a role that still exists and is not archived; "staffed" = the role
    holds at least one open assignment. Archived roles are excluded from
    both checks (an evaluation gap on an archived role never blocks, and a
    stale assignment to an archived role counts as unclassified, same as no
    assignment).
- `payMappingRunCompleted`: the run is completed and locked; editing (notes,
  group analysis documentation, group-done status) is blocked until the run
  is explicitly reopened (`payMapping/runs.ts:593`, `analyses.ts:105`,
  `notes.ts:74,121,160`). Status updates on actions remain allowed on a
  completed run (three-year-plan follow-up per ADR-0015 point 7); content
  edits and notes stay locked like the rest of the immutable snapshot.
- `payMappingDocumentationRequired`: marking an equal-work group "done"
  without an objective reason or a deepened analysis text
  (`payMapping/analyses.ts:138,140,162`). Only groups that passed the entry
  condition (ADR-0015: at least 1 woman AND 1 man AND women's mean below
  men's, or the TCC-driven variant) carry this documentation duty; singleton
  and single-gender groups never require it.
- `payMappingGateUnmet`: completing the run while review steps remain
  (`payMapping/runs.ts:559`), surfaced by
  `pay-mapping-completion-panel.tsx`.

### Assistant (Blueprnt AI chat)

- `assistantInvalidMessage`: empty message after trim (`assistant/chat.ts:207`).
- `assistantRateLimited`: more than `ASSISTANT_HOURLY_MESSAGE_CAP = 30` user
  messages from the same user in the same org within a rolling hour
  (`assistant/chat.ts:209-223`; cap and message-length constant defined in
  `packages/backend/convex/ai/config.ts`). Messages are also truncated to
  `MAX_ASSISTANT_MESSAGE_LENGTH = 4000` characters before sending.
- `assistantBusy`: a reply is already streaming on the active thread (sending
  again, or starting a fresh conversation while one is mid-reply,
  `assistant/chat.ts:236,245,256,371,440`); the UI's own send-button/new-
  conversation disable is the everyday guard, this is the backend backstop
  for a race.
- `assistantPersonalData`: an input-side PII screen (ADR-0018) checks the
  user's own message for what looks like an employee's full name
  (`assistant/generate.ts:80-92`, `containsEmployeeName`) before any AI call
  is made; on a hit, no AI call happens and no usage row is written. The
  assistant message UI (`components/assistant/assistant-message.tsx`) shows
  a specific "remove the personal details and ask again" panel keyed on
  `ASSISTANT_PERSONAL_DATA_ERROR_CODE`, distinct from the generic failure
  bubble other assistant errors get.

## Terms and history

- **appError / ERROR_CODES**: the backend's only vocabulary for failure. A
  code, never text (CLAUDE.md "i18n: never hardcode text", "the backend
  returns error codes/keys, never display text; the frontend translates").
- **errors namespace**: the i18n namespace (`errors.*` in
  `packages/i18n/messages/en.json` and its sibling locale files) that holds
  every user-facing translation of a backend code.
- ADR-0014 (2026-08-05) renamed three terms across the whole codebase,
  including in error copy and code paths this section touches:
  - **Band** (the role's computed weight, the outcome of the point score
    through the thresholds) became **Level** (code `level`). Level 1 is
    still the highest.
  - The individual's **seniority within the role's track** (previously
    itself called "Nivå"/"Level" in Swedish-language documents, ADR-0005)
    became **Seniority** (code `seniority`). The ladder values (IC1-IC5,
    Lead-1-Lead-3, M1-M3) are unchanged. This is the term behind the
    `invalidSeniority` error.
  - The criterion's six 0-5 scale positions, previously called "levels" in
    both code and UI text, became **Steps** (code `step`).
  - Field/code renames from this change relevant here: `models.bandThresholds`
    to `levelThresholds`, `anchorRoles.expectedBand` to `expectedLevel`,
    `personAssignments.level` to `seniority`, criteria's `anchors[].level` to
    `anchors[].step`. The audit event `band.shift` became `level.shift`.
  - Pre-ADR-0014 documents (older ADRs 0002, 0004, 0005, 0011, 0012, and the
    companion explainer `track-level-band.md`) deliberately keep their
    original words as historical record; any claim sourced from them must be
    translated into current terms before it goes in a dossier or a docs page.
    Concretely: a pre-0014 document's "Band" is today's Level; its "Nivå" (in
    the individual sense) is today's Seniority; its criterion "levels" are
    today's Steps.
- **Locked** (roleLocked, criterionLocked): an entity that has left the
  editable state (archived role, approved criterion) and requires an
  explicit reopen action before it accepts writes again. Not the same
  concept as a pay-mapping run's **completed and locked** state
  (`payMappingRunCompleted`), which is the run-lifecycle entity's own
  locking (ADR-0011's frozen data layer), reopened via a distinct
  run-reopen action.
- **Precondition** (profileIncomplete, payMappingPreconditionsUnmet): a
  requirement stated in the UI as guidance text with a link to the fix,
  before the user ever hits the erroring action, following CLAUDE.md's
  "Guide the user through every concept... Flows state their preconditions
  in words... instead of silently hiding or disabling controls" convention.
  Contrast with a **gate** (payMappingGateUnmet, weightsUnbalanced): a
  check on a finishing/completing action once work is otherwise underway.

## Rationale

- Errors are codes, never text, so the backend stays translation-agnostic and
  every locale gets the same failure vocabulary (CLAUDE.md "i18n: never
  hardcode text"; `packages/backend/convex/lib/errors.ts` header comment).
- Score and level are always derived live from stored ratings and never
  stored themselves (ADR-0002, "V1: live-omrakning av poang/band utan
  modellversionering"). This is why the point-budget gate
  (`weightsUnbalanced`) and the criteria floor (`tooFewCriteria`) exist as
  hard backend checks: an unbalanced or too-thin model would recompute every
  role's level incorrectly on the next read, with no versioning to fall back
  on.
- The 1-5 weight-point scale under a fixed budget (criteria count x 3) is
  ADR-0004 ("Viktning med poangbudget"), detailed further in
  `docs/contexts/evaluation-model/viktning-poangbudget.md`. The zero-sum
  budget is what forces the `weightsUnbalanced` check to exist at all: a free
  percentage allocation could not go out of balance.
- Seniority is per individual, never on the role (ADR-0005, "Niva per
  individ: roller bar track, inte niva"), which is why `invalidSeniority`
  validates against the role's *track*, not a role-level field, and why
  changing a role's track resets affected people's seniority rather than
  leaving stale values.
- Mandatory 2FA with no exemption (`docs/superpowers/specs/2026-06-26-mandatory-2fa-design.md`,
  confirmed in code: `accounts/twoFactor.ts` header comment "Everyone is
  enrolled through real 2FA: there is no exemption").
- Platform-admin access is a deliberate, narrow exception to per-org scoping
  (ADR-0009, "Plattformsadministrator"), which is why `platformAdminRequired`
  is a distinct code from `adminRequired` rather than a reuse of it.
- The pay-mapping preconditions gate and its exact classified/staffed
  definitions come from `docs/superpowers/specs/2026-07-23-pay-mapping-preconditions-gate-design.md`
  and are implemented once in `computePayMappingPreconditions`
  (`packages/backend/convex/payMapping/runs.ts`) so the create-time gate and
  the read-only preconditions panel can never disagree.
- The equal-work documentation duty (`payMappingDocumentationRequired`) is
  scoped by entry conditions from ADR-0015 ("Instegsvillkor for analysvyerna
  och atgardslager"): only groups with at least one woman, one man, and a
  gap unfavorable to women (on base pay or, if only there, on TCC) carry the
  duty; singleton and single-gender groups are deliberately excluded from
  the statutory flow (moved to an opt-in deepened analysis).
  Documentation-locked-after-completion behavior traces to ADR-0011
  ("Kartlaggning livscykel: fryst datalager"), the frozen data-layer
  lifecycle entity.
- The assistant's input-side personal-data screen and its dedicated error
  code are ADR-0018 ("Assistenten far en chattyta"), read together with the
  hard invariant that AI never receives individual PII (CLAUDE.md, "Never
  send personal data to the AI"): the check runs before any model call, so a
  flagged message costs zero AI tokens.
- The 30-messages-per-hour assistant cap and the personal-data screen are
  both from the AI-usage-tracking design lineage
  (`docs/superpowers/specs/2026-06-10-ai-usage-tracking-design.md`,
  `docs/superpowers/plans/2026-08-12-assistant-chatbot.md`); the cap is
  explicitly called a naive V1 guard, not a final answer (see Deliberately
  absent).
- The CSV-only, broadened-parsing import format is ADR-0010 ("Bredda
  importens tolkning av tal, datum och FTE, och begransa filinmatningen till
  CSV"): file-format rejection (`errorNotCsv`) is deliberately coarse because
  ADR-0010 chose to widen interpretation of ambiguous *data* (dates, FTE
  fractions) while narrowing accepted *file types* to one.
- Import row-issue severities (error vs notice) come from the import
  robustness design/plan trio (`docs/superpowers/specs/2026-07-03-import-robustness-design.md`,
  `docs/superpowers/plans/2026-07-03-import-robustness-c-validate.md`): a
  notice-level issue was read successfully with an interpretation worth a
  second look, so it never blocks, because the source file may already be
  correct.

## Edge cases and error states

- Every `errors.*` key present in `packages/i18n/messages/en.json`, with its
  throwing surface(s) and user-facing fix:

| Key | English copy | Thrown from | Fix |
| --- | --- | --- | --- |
| notAuthenticated | "You need to sign in." | any auth-gated query/mutation with no identity | sign in |
| notAMember | "You are not a member of this organization." | `lib/functions.ts` org guards | switch org, or ask an admin to invite you |
| adminRequired | "Only organization admins can do this." | `lib/functions.ts` admin guards, `ai/suggest.ts` | ask an org admin |
| platformAdminRequired | "You do not have platform admin access." | `lib/functions.ts` platform guard | this is not self-serviceable |
| membershipConflict | "Your membership could not be verified. Contact support." | `lib/functions.ts`, `ai/prefillData.ts`, `ai/suggest.ts` | contact support (app cannot self-resolve) |
| notFound | "Not found." | pervasive (missing/foreign-org entity) | reload; the entity may have been deleted or archived |
| invalidInput | "Invalid input." | pervasive validation catch-all | fix the offending field; generic by design |
| modelExists | "This organization already has an evaluation model." | `evaluationModel/model.ts` createModel | edit the existing model instead of creating a new one |
| profileIncomplete | "Complete the company profile first." | `assessment/ratings.ts`, `ai/suggest.ts`, `ai/prefillData.ts` | finish org/company settings |
| aiUnavailable | "AI is not configured for this environment." | `ai/draft.ts`, `assistant/generate.ts` | environment/config issue, not user-fixable |
| aiGenerationFailed | "The AI suggestion could not be generated." | AI generation catch-all, and the assistant's generic fallback | retry |
| roleLocked | "This role is approved and locked. Reopen it first." | `assessment/ratings.ts`, `roles.ts`, `anchorRoles.ts`, `ai/suggest.ts` | reopen (unarchive) the role |
| criterionLocked | "This criterion is approved and locked. Reopen it first." | `evaluationModel/method.ts` saveCriterionCompliance | un-approve the criterion first |
| ratingsIncomplete | "All criteria must be rated first." | `assessment/anchorRoles.ts` | finish rating every criterion |
| invalidTransition | "That status change is not allowed." | `ai/suggest.ts`, `payMapping/runs.ts`, `assessment/anchorRoles.ts` | the action does not apply to the entity's current status |
| roleFamilyExists | "A family with that name already exists." | `assessment/families.ts`, `starters.ts` | pick a different family name |
| roleExists | "A role with that name already exists in this family." | `assessment/roles.ts`, `starters.ts` | pick a different role name |
| weightsUnbalanced | "The weighting must match the point budget." | `evaluationModel/criteria.ts`, `ai/persist.ts` | adjust weight points until the remaining/over count reads zero |
| tooFewCriteria | "A model needs at least 5 criteria." | `evaluationModel/criteria.ts`, `accounts/organization.ts` | add criteria back to at least 5 |
| lastAdmin | "You're the last administrator of an organization. Contact support to delete your account." | `accounts/account.ts`, `accounts/organization.ts` | promote another member to admin first |
| invalidSeniority | "That seniority is not valid for this role's track." | `people/assignments.ts` | choose a seniority value valid for the role's track |
| invalidEffectiveDate | "The effective date must be after the current assignment's start date." | `people/assignments.ts` | pick a later effective date |
| personRefExists | "An employee with that employee number already exists." | `people/people.ts` | use a different/unique employee number |
| payMappingRunCompleted | "The pay mapping is completed and locked. Reopen it to edit." | `payMapping/runs.ts`, `analyses.ts`, `notes.ts`, `actions.ts` | reopen the run |
| payMappingDocumentationRequired | "Add an objective reason or a deepened analysis before marking the group done." | `payMapping/analyses.ts` | add the required documentation text |
| payMappingGateUnmet | "Steps remain in the review before the pay mapping can be completed." | `payMapping/runs.ts` completeRun | finish the outstanding review steps |
| payMappingPreconditionsUnmet | "People or roles are missing classification or evaluation, so the pay mapping cannot start yet." | `payMapping/runs.ts` startPayMappingRun | import/classify people, evaluate roles (the preconditions panel names exactly which) |
| assistantBusy | "Blueprnt AI is still answering. Wait for it to finish or stop it." | `assistant/chat.ts` sendMessage | wait, or use the stop control |
| assistantRateLimited | "You have sent many messages in a short time. Try again in a little while." | `assistant/chat.ts` sendMessage, 30/hour cap | wait for the rolling hour window to clear |
| assistantInvalidMessage | "Write a message before sending." | `assistant/chat.ts` sendMessage | type a non-empty message |
| assistantPersonalData | "The message seems to include an employee's personal details. Remove them and ask again in general terms." | `assistant/generate.ts` (input-side PII screen) | rephrase without the employee's name |

- Non-`errors.*` failure surfaces mapped to their own i18n keys (not in the
  table above because they are not backend `appError` codes, but are the
  equivalent user-facing failure states for their flows):
  - Sign-in/reset: `dashboard.auth.invalidCredentials`,
    `dashboard.auth.twoFactor.error`, `dashboard.auth.resetPassword.missingToken`,
    `.expired`, `.error`.
  - CSV upload rejection: `dashboard.people.import.upload.errorNotCsv`,
    `.errorEmpty`.
  - Import row issues: `dashboard.people.import.check.issue.*` (9 codes,
    listed in Behavior today) and `.fileWarning.*` (3 codes).
  - Import required-field gate: `dashboard.people.import.check.blocking` /
    `.cannotProceed` (no error code; a derived readiness state from the
    mapping step, not a thrown error).
- States that are gated/hidden rather than erroring, so no `errors.*` code
  is ever reached in the happy path:
  - The Rate CTA is replaced by a `profileIncompleteTitle`/`profileIncomplete`
    Alert until the job profile's mandatory core exists
    (`role-evaluation-card.tsx`).
  - The pay-mapping create form is replaced entirely by
    `PayMappingPreconditionsPanel` until preconditions are met; the backend
    `payMappingPreconditionsUnmet` throw is the backstop for a race (e.g. two
    admins opening the create dialog before either's precondition data has
    refreshed), not the everyday path.
  - The onboarding wizard's own Next-button gate enforces `MIN_CRITERIA` and
    weight balance client-side before the user could ever trigger
    `tooFewCriteria` / `weightsUnbalanced` from the wizard; those codes are
    reached mainly through the standalone model builder later, or via a
    stale-client race.
  - Locked (archived role / approved criterion) surfaces disable their edit
    UI outright; `roleLocked`/`criterionLocked` are the backend backstop for
    a stale client (e.g. two tabs).
- `notFound` is deliberately excluded from every surface's bespoke-message
  allowlist observed (`lib/error-label.ts` comment: "Not found. tells the
  user nothing the generic copy does not") - it always falls through to a
  surface's generic error copy, never a targeted message.

## Deliberately absent

- No global test/support backdoor: pre-launch shortcuts are env-gated and
  tracked for removal, never a fixed OTP or bypass
  (`docs/go-live-checklist.md`, "Auth and access": dev OTP log inertness,
  seed/reset surface lockdown are go-live checklist items, not shipped
  troubleshooting features). A support agent has no code path to bypass
  `notAuthenticated`/`notAMember`/2FA for a user.
- The assistant's `assistantRateLimited` cap (30 messages/user/hour) is
  explicitly called a "naive per-user hourly message cap" in the go-live
  checklist, flagged for later upgrade to `@convex-dev/rate-limiter` if abuse
  patterns emerge; there is no per-org AI spend cap or circuit breaker today
  ("nothing enforces a ceiling today" beyond the single-message output-token
  cap), so docs must not claim usage limits beyond the per-user hourly cap.
- No versioned evaluation model and no historical band/level snapshot per
  role: ADR-0002 is a deliberate V1 tradeoff ("a model change can silently
  move roles between levels without preserving prior outcomes"), mitigated
  only by the audit log, not by any user-facing "restore previous level"
  affordance. Docs must not describe an undo/version-history feature for
  model or level changes.
- Level-threshold editing is schema-supported but not built (go-live
  checklist "Level-threshold editing (E2 configurability)"): there is no UI
  today for an org to adjust its own level thresholds.
- No Azure OpenAI EU Data Zone fallback: `ai/provider.ts` wires only Mistral
  today (go-live checklist item); an "AI is not configured" (`aiUnavailable`)
  state has no automatic failover to a second provider.
- Two backend-complete AI flows exist with no UI attached (go-live checklist,
  unnamed in that entry beyond "the two backend-complete AI flows with no
  UI") - do not document AI capabilities purely from backend code without
  confirming a reachable UI surface exists.
- Person-data permission tiering was dropped: the app's only audience is HR/
  comp professionals, so there is no manager/employee self-service view and
  no separate permission tier gating salary visibility by role
  (memory: "V2 lonekartlaggning conformance", "person-data permission tier
  was dropped"). Do not describe a restricted-visibility mode for pay data.
- Erasure hooks for person- or pair-targeted pay-mapping actions/notes and
  for samverkan (collaboration) participant names are not yet built
  (ADR-0015 point 7's "Raderingsforbehall", go-live checklist items): those
  rows currently survive a person's hard delete as a dead pseudonym key with
  free-text that could in the worst case still name the person. Docs must
  not claim these action/note rows are erasure-safe today.
- Out-of-order assignment timeline insertion (backdating an assignment
  before an already-open one) is explicitly deferred to "V2-core"
  (`people/assignments.ts` code comment); `invalidEffectiveDate` is the
  guard against attempting it, not a feature gap users can work around today.

## Sources read

- `packages/i18n/messages/en.json`: the errors namespace and its user-facing copy
- `packages/backend/convex/lib/errors.ts`: ERROR_CODES map and appError helper
- `packages/backend/convex/lib/functions.ts`: auth guards and session/membership validation
- `packages/backend/convex/accounts/`: twoFactor.ts, organization.ts, account.ts
- `packages/backend/convex/evaluationModel/`: model.ts, criteria.ts, method.ts
- `packages/backend/convex/assessment/`: ratings.ts, roles.ts, anchorRoles.ts, starters.ts
- `packages/backend/convex/ai/`: suggest.ts, draft.ts, persist.ts, prefillData.ts, provider.ts, generate.ts
- `packages/backend/convex/payMapping/`: runs.ts, analyses.ts, notes.ts
- `packages/backend/convex/assistant/`: chat.ts, generate.ts
- `packages/backend/convex/people/`: people.ts, assignments.ts
- `packages/core/src/weighting.ts`: NEUTRAL_WEIGHT_POINTS, MIN_CRITERIA, WEIGHT_POINT_VALUES
- `packages/constants/src/starterSet.ts`: MAX_FAMILIES, MAX_ROLES
- `packages/import/src/validate.ts`: RowIssueCode, ROW_ISSUE_SEVERITY
- `apps/dashboard/lib/`: convex-error.ts, error-label.ts, role-error.ts, family-error.ts, pay-mapping-errors.ts, toast.ts
- `apps/dashboard/components/`: model-builder.tsx, delete-account-section.tsx, add-person-dialog.tsx, edit-person-dialog.tsx, import/upload-step.tsx, pay-mapping/pay-mapping-preconditions-panel.tsx, role-evaluation-card.tsx, assistant/assistant-message.tsx
- `apps/dashboard/app/(app)/roles/[roleSlug]/rate/page.tsx`
- `docs/superpowers/specs/`: 2026-07-12-role-track-change-design.md, 2026-06-26-mandatory-2fa-design.md, 2026-07-23-pay-mapping-preconditions-gate-design.md, 2026-06-10-ai-usage-tracking-design.md, 2026-07-03-import-robustness-design.md
- `docs/superpowers/plans/`: 2026-08-12-assistant-chatbot.md, 2026-07-03-import-robustness-c-validate.md
- `docs/go-live-checklist.md`
- `docs/contexts/evaluation-model/viktning-poangbudget.md`
- `docs/adr/`: ADR-0001, ADR-0002, ADR-0004, ADR-0005, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0014, ADR-0015, ADR-0018
