# Pay-mapping preconditions gate + dashboard to-do integration

Decision with Christian 2026-07-23: a pay mapping must not be creatable until every employee is classified and every staffed role is fully evaluated. DL 3 kap. requires the kartläggning to cover ALL employees; today `startPayMappingRun` silently EXCLUDES unclassified people from the frozen snapshot (the started-audit's `unclassifiedExcludedCount`) and unevaluated roles produce band-less rows (`unbandedCount`), both statutory defects the user cannot repair after the freeze. The gate removes both failure modes at the source. No override: a partial mapping is not a document we put our name on.

## 1. Backend gate

- `startPayMappingRun` re-derives the preconditions server-side and throws `appError("errors.payMappingPreconditionsUnmet")` when violated (the client's UI gate is convenience; the mutation is the authority):
  - (a) **Everyone classified:** zero people without a CONFIRMED open assignment ("classified" = confirmed, the same definition `countClassified`, the people tab badge, and the to-do's classify group use).
  - (b) **Every staffed role evaluated:** every role holding at least one open assignment resolves a band (complete evaluation), the same resolution the snapshot uses. This makes an unbanded snapshot row impossible by construction.
- New `getPayMappingPreconditions` orgQuery for the create surface: `{ unclassifiedCount: number, unevaluatedRoles: { roleId, title, slug }[], ready: boolean }`. Read-only, org-scoped.
- Error label `errors.payMappingPreconditionsUnmet` in every locale (en "People or roles are missing classification or evaluation, so the pay mapping cannot start yet.", idiomatic sv/nb/da/fi).

## 2. Retirements the gate enables (no-legacy)

- `unclassifiedExcludedCount`: the snapshot loop no longer skips anyone (the gate guarantees it), so the counter, its slot in the `payMapping.started` audit payload contract, its `*_AUDIT_FIELDS` entry, and its field label (x5 locales) are all deleted. Historical dev audit rows carrying the field are dev noise, sanctioned by the pre-launch reset convention.
- `unbandedCount` + the never-rendered `dashboard.payMapping.gap.unbanded` copy (x5): deleted end-to-end (gap.ts computation, wire type, `pay-mapping-gap-types.ts`, fixtures). This closes the dead-code audit's gray area by removing the cause instead of wiring the note.

## 3. Create-flow guidance

- The pay-mappings page's create affordance stays visible. When `getPayMappingPreconditions.ready` is false, the create dialog/form is replaced by a plain-language precondition panel (the guidance rule: preconditions in words, never silently disabled): one line per unmet condition with live counts and links, e.g. "6 personer är inte klassificerade än" -> `/people/classify`, "3 roller med anställda saknar färdig utvärdering" -> `/roles` (list the roles, `MAX_ITEMS`-capped like the to-do). When ready, the existing create flow renders unchanged.
- New i18n keys under `dashboard.payMapping.preconditions.*` (title, classify line ICU, evaluate line ICU, per-role rows reuse role titles) x5.

## 4. Dashboard to-do

- The BLOCKERS already surface on the front page: `classifyPeople`, `describeRoles`, and `evaluateRoles` groups list exactly the work the gate waits for. No duplicate group is added for them.
- NEW final group `startPayMapping`: exactly one item ("Starta lönekartläggningen" -> `/pay-mappings`), shown when the gate's preconditions are met AND no non-completed pay-mapping run exists. It is the journey's next step once the blockers are gone; rendered LAST (after approveCriteria). `buildTodo` stays pure: `BuildTodoInput` gains the person->role linkage it needs (`currentAssignment.roleId`) and a `payMappingRuns: { status }[]` input from the existing `listPayMappingRuns` query; readiness derives from the same definitions as the backend gate.
- Keys `dashboard.overview.todo.groups.startPayMapping` + the item label x5.

## 5. Testing

- Backend: gate throws on an unclassified person / an unevaluated staffed role; passes when clean; an unstaffed, unevaluated role does NOT block; snapshot no longer carries the retired fields; audit contract compiles; audit-labels coverage green after the field-label removal.
- Frontend: create surface shows the precondition panel with counts/links when unready, the create flow when ready; todo renders startPayMapping only when ready and no open run; existing groups untouched.
- i18n parity + purity; full turbo gate.

## Out of scope

Retroactive repair of existing runs; any change to the review/summary surfaces; person-page changes.
