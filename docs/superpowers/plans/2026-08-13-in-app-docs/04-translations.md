# Phase 4: Translations (sv, nb, da, fi)

> Part of `docs/superpowers/plans/2026-08-13-in-app-docs/` (read `00-overview.md` first). Global constraints apply to every task.

**Goal:** All 56 pages in all four remaining locales, guard 1 (parity) green again, native review tracked in the go-live checklist.

## Translation rules (every locale task)

1. Translate the en page 1:1 in structure: same slug, same frontmatter keys (translated `title`/`description` values, IDENTICAL `section` and `order`), same heading sequence, same link targets (slugs and app paths never change; only link TEXT translates).
2. Canonical terms come from the locale's own message file: the term a heading or sentence uses is EXACTLY the wording of the corresponding `model.*`/`assessment.*`/`dashboard.*` message in that locale (e.g. sv: Viktning, Nivå, Senioritet, Steg, Viktpoäng, Ankarroll). Never invent a second rendering of a term the UI already names.
3. Quoted UI labels (buttons, tabs, columns) use the locale's exact message value, because the reader will look for that string on screen.
4. Statutory Swedish terms: sv uses them natively (lönekartläggning, samverkan, likvärdigt arbete); en/nb/da/fi keep the Swedish term in parentheses on first use per page where the locale lacks an established equivalent (the en corpus already models this).
5. International job titles stay in English in every locale (established convention).
6. Glossary headings: the term heading is the LOCALE's canonical term (anchors therefore differ per locale; guard 4 checks anchors per locale so cross-page `#anchor` links must use that locale's anchor). The en term in parentheses in the body where it aids recognition.
7. No em dashes. Never edit non-ASCII content via shell perl/sed (mojibake); write files directly.
8. Machine-drafted locale content is a DRAFT: it ships flagged for native review via the go-live checklist entry (Task 4.5), not via frontmatter.
9. YAML safety (learned during execution): a frontmatter value containing a colon followed by a space MUST be wrapped in double quotes. An unquoted one fails to parse and trips guards 2 and 4 for EVERY locale, so the failure looks unrelated to the locale that caused it. Self-check before finishing a locale: `grep -n '^title: .*: \|^description: .*: ' apps/dashboard/content/docs/<locale>/*.mdx`.

### Task 4.1: Swedish corpus

**Files:** Create all 53 missing `apps/dashboard/content/docs/sv/*.mdx` (3 seeds exist; refine them to corpus quality).

- [ ] **Step 1: Fan-out** (workflow): one agent per docs section (12), inputs: the section's en pages, the sv message file, the rules above, and the section's dossier file (for statutory terminology). Swedish is the DOMAIN language: prefer the glossaries' Swedish column over literal translation.
- [ ] **Step 2: Locale review agent:** one agent reads the whole sv corpus for term consistency across pages (same term, same rendering everywhere) and fixes inline.
- [ ] **Step 3: Run guards** `cd apps/dashboard && bun run test -- lib/docs/docs-guards.test.ts` : guards 2 and 4 must pass for sv (guard 1 still red until all locales land).

### Task 4.2: Norwegian corpus (nb)

Same steps as 4.1 with `nb`. Norwegian pay-mapping context: nb has its own statutory concept (likelønnsredegjørelse); the docs describe THIS product's Swedish-law flow, so keep lönekartläggning as the named concept with a one-line nb gloss on `what-is-pay-mapping` only.

### Task 4.3: Danish corpus (da)

Same steps as 4.1 with `da`, same statutory-term note (ligelønsredegørelse gloss on `what-is-pay-mapping` only).

### Task 4.4: Finnish corpus (fi)

Same steps as 4.1 with `fi` (gloss: samapalkkaisuuskartoitus). Finnish runs ~7 percent longer; that affects no docs cap, only phrasing discipline.

### Task 4.5: Parity green and review tracking

**Files:** Modify `docs/go-live-checklist.md`.

- [ ] **Step 1: Full guard run**

Run: `cd apps/dashboard && bun run test -- lib/docs/docs-guards.test.ts`
Expected: ALL guards PASS, including guard 1 (parity) for the first time since Task 3.1.

- [ ] **Step 2: Go-live checklist entry**

Add under the existing pre-launch items: "Native review of the docs corpora (sv, nb, da, fi): all four locale sets under `apps/dashboard/content/docs/` are machine-drafted from the en source (2026-08-13) and must be reviewed by a native speaker before launch; en is the source of truth on conflict."

- [ ] **Step 3: Full gate**

Run: `bun run test` (root) and `cd apps/dashboard && bun run lint && bun run typecheck`. Expected: green, Biome zero. Leave staged-ready.

- [ ] **Step 4: Browser spot-check**

Dev server: open `/docs/glossary` in each of the five languages (account language switcher), confirm headings, anchors, and internal links work per locale.
