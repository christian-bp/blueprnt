# shadcn Vendor Update Design

## Scope

Make `packages/ui` able to take every upstream shadcn change, including brand new components, without losing the deliberate local deviations we own. Today `npx shadcn@latest add -a -y -o` overwrites all 63 vendored components with pristine upstream, silently reverting every local fix; the last run left typecheck red and 2558 tests green, so the gates caught 2 of roughly 15 regressions.

Out of scope: changing what the deviations are, restyling anything, and the `card.tsx` upstream addition (taken as-is).

## Resolved decisions

1. **Deviations live as patch files**, one per deviated component, applied after the CLI run. Not a vendor branch (the repo bans long-lived branches) and not a committed pristine baseline (it would duplicate 63 files).
2. **The patch set holds only what renders or behaves differently.** `packages/ui/src/styles/globals.css` sets `--primary: var(--brand)` and `--primary-foreground: var(--brand-foreground)` in both themes, and both are registered in `@theme inline`, so `text-brand` and `text-primary` compute to the same colour. The five `text-brand` renames (button link, badge link, empty description, field description, item description) and the button's `hover:bg-brand/90` versus upstream's `hover:bg-primary/80` are therefore abandoned; those four files become pure upstream.
3. **A deviation test guards the behaviour**, because a failing patch cannot catch a deviation someone later edits away by hand.

## The eight deviations

| Component | Deviation | Why |
| --- | --- | --- |
| `avatar.tsx` | `rounded-md` in place of `rounded-full` (root, ring, image, fallback, group count) plus a `variant="brand"` prop | Avatars use the theme radius, not circles; the brand variant tints identity avatars. Used by `org-switch-menu.tsx` and `nav-organization.tsx` |
| `badge.tsx` | A `success` variant | `admin/email-status-badge.tsx` maps `sent` and `delivered` to it |
| `checkbox.tsx` | `indeterminate` threaded through, `data-indeterminate:` fill styles, a minus glyph | Base UI never stamps `data-checked` while indeterminate, so upstream draws an unfilled box with a bare tick, indistinguishable from "none selected". Used by `people/classify/classify-title-table.tsx` |
| `dropdown-menu.tsx` | `w-max min-w-32 max-w-(--available-width)` in place of `w-(--anchor-width)` | Upstream pins the popup to the trigger width, clipping labels behind icon-button triggers because the popup is `overflow-x-hidden` |
| `empty.tsx` | Icon media `bg-brand/10 text-brand dark:bg-brand/20` | Brand-tinted rather than upstream's neutral `bg-muted` |
| `select.tsx` | Trigger `min-w-0`; popup `w-max min-w-(--anchor-width) max-w-(--available-width)` | Triggers must shrink inside form grids; the popup has the same clipping bug as the dropdown |
| `spinner.tsx` | `Omit<React.ComponentProps<"svg">, "strokeWidth">` | `HugeiconsIcon` types `strokeWidth` as `number`; the plain svg props type admits a string and fails `tsc` |
| `tooltip.tsx` | An `arrow` prop defaulting to `false` | Upstream always draws an arrow. Used with the arrow by `suggested-role-badge.tsx` and `deviation-badge.tsx`, without it everywhere else |

Each keeps its explanatory comment in the component file, so the reason travels inside the patch and sits where it applies.

## Layout

```
packages/ui/
├── patches/                  committed, one .patch per deviated component
├── scripts/update-shadcn.ts  both commands
├── .vendor/                  gitignored pristine snapshot
└── src/
    ├── components/           upstream with the patches applied
    └── deviations.test.tsx   ours, guards the eight deviations
```

`.vendor/components` is rewritten on every update, right after the CLI and before patching, so it is by construction the exact upstream the current patches are defined against. It exists only so the patches can be regenerated.

## `bun run ui:update`

1. Refuse to run when `src/components` has uncommitted changes, so the CLI cannot eat unsaved edits. This is the failure that motivated the whole design.
2. `npx shadcn@latest add -a -y -o`.
3. Snapshot `src/components` into `.vendor/components`.
4. `git apply` each patch, strict, no fuzz. On failure, re-run that patch with `--reject`, report which ones fell, exit non-zero.
5. List components the run added, so a new arrival is never a surprise.
6. `tsc --noEmit`, then `vitest run`.

Step 4 is strict on purpose. Fuzzy matching can land a patch in the wrong place, which is worse than stopping. An upstream edit to a patched line therefore halts the update and asks for a human, which with four patches touching a single `className` string will happen from time to time.

Two things about step 4 are not obvious and were found by testing the round trip rather than by reading:

- **Patch paths are repository-root relative and `git apply` runs from the root.** Run from a subdirectory, `git apply` silently ignores patch entries whose paths resolve outside that directory and still exits 0. Package-relative paths produced a run that reported all eight patches applied and changed nothing.
- **A zero exit is therefore not proof a patch did anything.** After each patch lands, the script asserts the source now differs from its `.vendor/` counterpart, and treats a clean-but-inert patch as a failure.

## `bun run ui:refresh-patches`

For each patch, diff `.vendor/components/<name>.tsx` against `src/components/<name>.tsx` and rewrite `patches/<name>.patch`. The script normalizes the diff headers so both sides read `src/components/<name>.tsx`, which lets `git apply -p1` land in the right file and keeps the patch readable in review. Run it after resolving a `.rej` by hand. It requires `.vendor/`, so a fresh clone must run `ui:update` once first; the script says so when the directory is missing.

## Dependencies

The registry rewrites `package.json` as well as the sources, and we take its word on both. `update` prints the dependency lines that changed and runs `bun install`, so the change is visible and the verification step runs against a tree that matches the manifest.

**`recharts` follows the registry's pin, currently `3.8.0`.** We had drifted up to `3.10.1`, but tracing it shows every step was a routine `chore(deps)` bump, never a feature we needed: our charts use only `ScatterChart`, `Scatter`, `XAxis`, `YAxis`, `CartesianGrid` and `ReferenceLine` on top of shadcn's own wrapper. The pin exists so the vendored `chart.tsx` cannot drift from the API it was generated against, so matching it is closer to the intent than running ahead, and it removes an owned deviation from the maintenance surface for the same reason the `text-brand` renames were dropped. Verified at `3.8.0`: no advisories, typecheck clean, and the whole suite green. Revisit only if a chart needs an API added after it.

`@shadcn/react` moves from `^0.2.1` to `^0.3.0`, the version carrying the `questionnaire` subpath the newly arrived component imports. `@types/bun` is added so the update script itself is typechecked rather than excluded.

## Verification

Typecheck green, the full suite green including the eight new deviation tests, and finally a real `ui:update` that reproduces an identical tree. That idempotent run is the actual proof the workflow holds.
