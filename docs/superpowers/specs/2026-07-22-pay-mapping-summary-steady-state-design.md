# Takeover wizard + the summary as the Analysis tab

Decision with Christian 2026-07-22 (supersedes the earlier mini-slice version of this spec): the kartläggning review adopts the app's established wizard language, the same full-screen takeover the people import and onboarding use, and the Analysis tab becomes the run's summary (sammanställningen), the surface the user lives in after the first pass and where changes happen. All engine logic (queue, step cards, autosave, resume, the gate) is reused; this slice moves presentation. No backend changes.

## 1. The review wizard becomes a full-screen takeover

- New route `app/(app)/pay-mappings/[slug]/review/page.tsx`, mirroring `app/(app)/people/import/page.tsx` exactly: a `fixed inset-0 z-50 overflow-hidden bg-background` wrapper inside the app tree (keeps the run layout's context provider alive), same explanatory comment pattern.
- `pay-mapping-review.tsx` is reworked to render inside `WizardShell` (components/wizard-shell.tsx): `headerLeft` = the exit control (a ghost button, new key `review.exit` en "Exit the review", navigating to `/pay-mappings/{slug}/analysis`; NO discard dialog, everything autosaves, and a muted one-liner `review.autosaveHint` en "Everything you enter is saved automatically." lives on the start step); `headerRight` = the jump-menu trigger (moves out of the in-page progress row); `footer` = the progress (step counter + thin bar, our existing `review-progress` content reworked for the footer slot; dots do not scale to group counts); `contentKey` = the current step key (scroll reset per step). The direction-aware slide, focus management, and the aria-live announcement move along unchanged.
- The wizard's finish step slims into a finale: the all-reviewed affirmation, the gate section (Complete when met / remaining hint when not, exactly today's logic), and a primary link "Open the summary" (`review.openSummary`) to `/analysis`. The full documentation listing leaves the finale (the summary owns it, section 2).
- Resume behavior unchanged: entering `/review` lands on the first undone step, or the finale when done.

## 2. The Analysis tab becomes the summary (two-column master-detail, decided with Christian 2026-07-23)

- `app/(app)/pay-mappings/[slug]/analysis/page.tsx` renders `pay-mapping-summary.tsx` (title stays under the Analys tab; the summary IS the analysis surface at rest).
- **Desktop (lg+) is a two-column master-detail**: the left column is a compact checklist of every step; the right pane shows the selected step's card. Clicking a list row swaps the right pane directly, no back round-trip. The first summary iteration's in-place overlay + "Back to the summary" survives only as the SMALL-SCREEN fallback (below lg the list renders alone and selecting a row swaps to the card with `review.backToSummary`).
- **Left checklist**: a search field on top (label filter, same `searchSteps` copy as the jump menu; while filtering, chapters render flat so a collapsed chapter cannot hide its own hits), then chapter sections as collapsible accordion sections (default open) with headings + done counts ("2 av 4" style, same counting as the journey card), rows = a leading status icon (filled check when done, muted circle when remaining) + the step label, nothing else visible (Christian 2026-07-23 dropped the status Badge: the icon carries the state, gap/status details live in the opened card, and the done/remaining state stays as sr-only text since the icon is aria-hidden), hover background + `aria-current` on the selected row. Rows are plain buttons (the old dl-in-button content-model bend disappears). Covers ALL steps: collaboration, praxis, queue groups AND non-queue groups (`requiresDocumentation: false`). The list is sticky beside the pane with its own scroll region INSIDE the Card (the Card's ring elevation must not be clipped by a wrapper overflow).
- **Right pane landing default = the first remaining step** (Christian 2026-07-23, revising the earlier gate-panel pick): the pane opens on the first undone step in checklist order, or the gate panel (the completion card carrying the M7 actions note and the gate section: remaining hint + Complete when unmet/met, completedNote + reopen pointer on a completed run) once nothing remains. The landing default is implicit: it never hides the small-screen checklist and never steals focus; only an explicit row click does.
- **After "mark done and continue" in the right pane, the selection advances to the next remaining step** (Christian's pick, wizard-like); when nothing remains it lands back on the gate panel. On a completed run cards open read-only (existing locked semantics).
- While actionable steps remain, the CTA banner sits above the columns: `review.remainingBanner` ICU + primary Link-button `review.continueWizard` to `/review`. When nothing remains the banner is absent.
- The jump menu is a wizard affordance and does not render on the summary (the checklist IS the random access).

## 3. Entry points and chrome

- The overview journey card's CTA: gate unmet -> "Continue the review" links to `/review` (was `/analysis`); gate met + active -> the Complete flow unchanged; completed -> unchanged. The chapter progress rows keep linking to `/analysis` (now the summary, which is correct).
- `payMappingSubPageKey` needs no new tab (Review is a takeover, not a tab); the run shell's PageHeader under the overlay is invisible and harmless, mirroring how the import takeover covers the People chrome. Site header untouched.

## 4. i18n

New keys ×5 (en values above; sv "Avsluta granskningen", "Allt du fyller i sparas automatiskt.", "Öppna sammanställningen", "Tillbaka till sammanställningen", "Fortsätt granskningen", banner ICU; idiomatic nb/da/fi drafts): `review.exit`, `review.autosaveHint`, `review.openSummary`, `review.backToSummary`, `review.continueWizard`, `review.remainingBanner`, plus `review.summaryTitle` en "Summary" / sv "Sammanställning" / nb "Sammendrag" / da "Opsummering" / fi "Yhteenveto" as the summary's heading. `review.finish.title` is reused by the finale ("Everything reviewed" fits there). Deleted keys: whatever the in-page progress placement orphans (audit each candidate). The language-purity guard applies.

## 5. Testing

- Takeover route: renders the wizard inside WizardShell; exit navigates to `/analysis`; footer carries counter + bar; header carries the jump trigger; resume/navigation/focus tests adapted from the existing shell tests.
- Finale: affirmation + gate section + summary link; no listing.
- Summary: listing sections render; a queue group row, a non-queue group row, a praxis row, and the collaboration section each open the right card in place and return via backToSummary; locked cards read-only; the CTA banner shows the remaining count and links to `/review`, absent when done; the gate section completes/uncompletes per state.
- Journey card CTA retarget test. i18n parity + purity guard. Full suite + typecheck.

## Out of scope

Search/filter on the summary, M7 actions, M8 report, backend changes, any change to the step components' internals.
