# Help Text Tightening Design

## Scope

Every `dashboard.help.*Body` behind a `HelpMorphButton`: 37 texts in five locales. The panel is 26rem wide at `text-sm`, roughly 55 characters a line, and sixteen bodies rendered at five lines or more. The longest was eight.

The 30 `*Label` keys are untouched; they run 11 to 18 characters. All 67 keys are used, so nothing was deleted for being orphaned.

## The rule

**Sentence 1 says what the thing is**, in the user's words. **Sentence 2 exists only when there is one dominant mistake to prevent**, and in this domain that is almost always the boundary against the neighbouring term: level against seniority, weighting against the 0 to 5 scale, role against person. Nothing else. No rationale for its own sake, no restating what the surface already shows, no hedging.

This is compression, not amputation. `CLAUDE.md` makes in-app guidance the product's primary goal, so the target is the same help in fewer words.

**Caps: 200 characters for `en`, 240 for the others.** English is the locale we author and is held to the target. The others get room because the corpus measured `sv`, `nb` and `da` within 2% of English and `fi` about 7% longer.

## Result

| | before | after |
| --- | --- | --- |
| Total body characters (en) | 7698 | 5417 |
| Longest body | 422 | 195 |
| Bodies at 5+ rendered lines | 16 | 0 |

Rendered-line distribution went from `{2:7, 3:5, 4:9, 5:7, 6:5, 7:2, 8:2}` to `{2:7, 3:16, 4:14}`. Eight bodies were already within the rule and were left alone.

## What was dropped

The risk in this work is cutting something load-bearing, so the notable cuts are recorded rather than left to a diff.

| Text | Dropped | Why it was safe |
| --- | --- | --- |
| `anchorsBody` | "role-focused", the 0 and 5 endpoint gloss, "clearly increasing" | The scale's own step editor shows the endpoints; the disambiguation against weighting was kept |
| `payGapScatterBody` | The worked list of non-discriminatory reasons | "an objective pattern" carries it, and `payGapReasonsBody` enumerates the factors on the surface that needs them |
| `weightingBody` | "New criteria start at the neutral 3" | Visible the moment a criterion is added |
| `payGapMemberDiffBody` | The part-time gross-up explanation | `fteAdjustedBody` is its own help text on the same surface |
| `anchorRoleBody` | "Anchor roles are whole roles; the evaluation scale describes the ratings" | ADR-0014 renamed the anchor scale to steps, so the term collision it guarded against is gone |
| `familiesReviewBody` | "says nothing about seniority", "families organize the register" | Both survive in `trackBody` and `familyBody`, which are the surfaces that introduce each term |
| `blindRatingBody` | "the result appears as soon as every criterion is rated" | The result appearing is self-evident when it appears |
| `scoreBody` | "via the model's level thresholds" | Mechanism detail; the point is that neither value is hand-set |
| `twoFactorBody`, `changeEmailBody` | Reassurance clauses ("to keep your account secure", "to confirm you own it") | The two-step description is the reassurance |

`payMappingBody` keeps its `(Swedish: lönekartläggning)` gloss in that exact form, which is the one shape the language-purity guard in `messages.test.ts` sanctions.

## The guard

Five tests in `packages/i18n/src/messages.test.ts`, beside the parity and language-purity guards, fail any help body over its locale's cap and name the key with both numbers (`dashboard.help.trackBody is 253, cap is 200`). It belongs there because it is a property of the message files, like parity. Verified by pushing one body over the cap and watching it fail.

## Translations

The four Nordic locales were rewritten from the new English, not trimmed from the old translations, and reuse each locale's existing domain terms (`viktning`/`vekting`/`vægtning`/`painotus`, `senioritet`/`senioriteetti`, `track` kept in English throughout). They are machine-produced drafts and are flagged for native review.

## Verification

Biome clean, typecheck forced, the whole suite forced: 2574 tests. One dashboard test hardcoded a help string as a literal and was changed to read it from `en.json`, since the assertion is about which help text lands on which field, not its wording. A sweep confirmed no other source or test file hardcodes a help body.
