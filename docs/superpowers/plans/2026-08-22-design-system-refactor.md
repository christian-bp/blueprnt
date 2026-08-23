# Design System Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard's shell and surface language on the Verve pattern: icon rail + white inset sheet + top bar, a collapsible per-area inner sidebar, breadcrumb-as-title, centered max-w-7xl content, Frame card-in-card anatomy for settings and tables, and Verve-compact control density.

**Architecture:** The shadcn sidebar switches to `variant="inset"` with a fixed 56px icon rail; a new registry-driven inner sidebar replaces all header tab strips; content scrolls in its own pane inside a viewport-locked sheet. Frames come from ReUI's registry component; density comes from editing our vendored shadcn components, captured as patches replayed by `bun run ui:update`.

**Tech Stack:** Next 16 (app router, `proxy.ts`), Base UI shadcn (style `base-vega`) in `packages/ui`, Tailwind v4 tokens in `packages/ui/src/styles/globals.css`, Motion (`motion/react`) with `SPRING` from `@/lib/motion`, next-intl (`packages/i18n/messages/*.json`, en/sv/nb/da/fi), Vitest 4 via `bun run test`, Biome.

**Spec:** `docs/superpowers/specs/2026-08-22-design-system-refactor-design.md` (read it first; this plan implements it stage by stage).

> **Deviation note (2026-08-22):** the density strategy changed mid-implementation, by user direction. The Stage 1 tasks below that hand-edit vendored components to Verve's measurements and capture them as patches describe what was FIRST built and then superseded: the tree now switches `packages/ui/components.json` to shadcn's `base-nova` style (Verve is nova; its compact controls are nova's `sm`), re-vendors every registry component from nova, and deletes the density patches. Only functional patches remain. Read the spec's section 7 deviation note for the record; the checked boxes below are kept as history of the executed order.

## Global Constraints

- Branch: all work on `feat/design-system-refactor`. **Never commit without explicit approval**; each stage ends in a checkpoint that presents the diff and STOPS. Never push.
- Never `bun test`; always `bun run test`. Biome gate: `bunx biome check --error-on-warnings .` must end at zero (errors, warnings, info).
- All user-facing text through i18n: `packages/i18n/messages/en.json` first, then mirrored to sv/nb/da/fi in the same change at production quality (reuse neighbouring keys' vocabulary; international job titles stay English in Nordic locales). Never write display text in components.
- No em dashes in any text we write (UI copy, comments, docs, commit messages).
- Reading text floors at `text-sm`. `text-[0.8rem]`/`text-xs` only on scanned controls (buttons, nav rows, badges, labels).
- Internal navigation always uses `Link` (`next/link`), never `<a>`.
- `packages/ui/src/*` is vendor code: editable here by explicit decision, every deviation gets a `DEVIATIONS` entry in `packages/ui/scripts/update-shadcn.ts` and a regenerated patch via `bun run ui:refresh-patches`, and the eventual commit message documents it. Vendor files stay out of Biome and have no unit tests by policy.
- No legacy: when a component/key is replaced, delete it completely in the same stage.
- Every stage ends: full `bun run test` green, Biome at zero, `bun run typecheck` (or `turbo run typecheck`) green, visual pass in the running dev app, then the checkpoint.
- Conventional commit messages, no AI attribution of any kind.
- Reduced motion respected everywhere (`MotionConfig reducedMotion="user"` already global; never bypass). Read `docs/ui-animation.md` before touching any animation.
- Help placement rule holds: every `HelpMorphButton` ends anchored after a title (Frame titles after this refactor), never floating.

---

# STAGE 1: Density + Frame

Visual density changes only; no layout changes. App looks tighter everywhere.

### Task 1: Vendor the Frame component from ReUI

**Files:**
- Create: `packages/ui/src/components/frame.tsx` (via CLI)
- Modify: `packages/ui/package.json` only if the CLI adds a dependency (it needs `class-variance-authority`, already present)

**Interfaces:**
- Produces: `Frame` (props: `variant?: "default" | "inverse" | "ghost"`, `spacing?: "xs" | "sm" | "default" | "lg"`, `stacked?: boolean`, `dense?: boolean`), `FramePanel` (`fit?: boolean`), `FrameHeader`, `FrameTitle`, `FrameDescription`, `FrameFooter`, all exported from `@workspace/ui/components/frame`. Slots: `data-slot="frame"`, `"frame-panel"`, `"frame-panel-header"`, `"frame-panel-title"`, `"frame-panel-description"`, `"frame-panel-footer"`.

- [x] **Step 1: Install from the registry**

Run from `apps/dashboard`:

```bash
bunx shadcn@latest add https://reui.io/r/frame.json
```

The `ui` alias in `apps/dashboard/components.json` points at `@workspace/ui/components`, so the file must land at `packages/ui/src/components/frame.tsx`. Verify the path, and that the `cn` import was rewritten to `@workspace/ui/lib/utils`.

- [x] **Step 2: Inspect the file**

Expected: ~193 lines, cva-based, no Radix/Base UI imports, exports the six names above. The source contains a few inert junk class fragments like `(--radius-xl)]` (present upstream, also in Verve's production markup); leave them, vendor code stays as-is.

- [x] **Step 3: Note for the update script**

`update-shadcn.ts` snapshots shadcn-upstream components into `.vendor/`; `frame` is not a shadcn-upstream component, so `ui:update` will not touch it. Confirm by reading how the script enumerates components (it walks the CLI output); if it would delete unknown files (it does not; it copies over), no action. Add a one-line comment in `packages/ui/scripts/update-shadcn.ts` next to `DEVIATIONS` stating that `frame.tsx` is vendored from ReUI (`https://reui.io/r/frame.json`) and is outside the shadcn update cycle.

- [x] **Step 4: Typecheck**

Run: `bun run typecheck` from the repo root (or `turbo run typecheck`). Expected: green.

### Task 2: Compact density for button, input, select

**Files:**
- Modify: `packages/ui/src/components/button.tsx`
- Modify: `packages/ui/src/components/input.tsx`
- Modify: `packages/ui/src/components/select.tsx` (trigger sizes; this file already has a patch, the refresh regenerates it)
- Modify: `packages/ui/scripts/update-shadcn.ts` (DEVIATIONS entries)
- Regenerate: `packages/ui/patches/*.patch` via `bun run ui:refresh-patches`

**Interfaces:**
- Produces: same exported components, new default metrics. Button default `h-7 text-[0.8rem]`, icon `size-7`; Input `h-8 rounded-lg`; SelectTrigger default `h-8`, sm `h-7`. Every app call site inherits automatically.

- [x] **Step 1: Read `button.tsx` fully** to see the exact current variant map (sizes seen so far: `default` h-9, `xs` h-6, `sm` h-8, icon sizes size-6/size-8; there may be more).

- [x] **Step 2: Retune the size map to the Verve scale.** Base class keeps everything except: remove the static `rounded-md` from the base (radius moves per-size, Verve-style). New size values (copy verbatim; these are Verve's production strings adapted to our variant names):

```ts
size: {
  default:
    "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  sm: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-[0.8rem] in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
  // icon sizes: the plain icon button becomes size-7; keep the smaller step at size-6.
  icon: "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
  "icon-sm": "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
}
```

Map whatever the file's actual icon-size variant names are onto size-7 (default icon) and size-6 (small icon); keep any `lg` variant if present (retune to `h-8 px-3 text-sm`). Do not rename variants: call sites must not need edits.

- [x] **Step 3: Input.** Replace the sizing/rounding part of the single class string: `h-9` → `h-8`, `rounded-md` → `rounded-lg`, drop `shadow-xs`, `file:h-7` → `file:h-6`. Keep everything else (focus ring, aria-invalid, dark) untouched.

- [x] **Step 4: Select trigger.** In the trigger class: `rounded-md` → `rounded-lg`, drop `shadow-xs`, `data-[size=default]:h-9` → `h-8`, `data-[size=sm]:h-8` → `h-7`, and add `data-[size=sm]:rounded-[min(var(--radius-md),10px)]`.

- [x] **Step 5: DEVIATIONS entries.** In `update-shadcn.ts` add (button, input) and extend (select) with one-line reasons, e.g. `button: "Verve-compact control scale: h-7 default with 0.8rem label, per-size radius."`, `input: "Verve-compact: h-8, rounded-lg, no shadow."`, and append the density note to select's existing line.

- [x] **Step 6: Regenerate patches**

Run: `bun run ui:refresh-patches`. Expected: new `button.patch`, `input.patch`, updated `select.patch`; the script fails if a changed file lacks a DEVIATIONS entry (that failing is the guard working).

- [x] **Step 7: Run the suite**

Run: `bun run test`. Expected: possible failures in tests that pinned old sizes (e.g. class assertions with `h-9`, `size-8`). Fix those assertions to the new metrics; do not weaken tests into not asserting sizes where the size IS the contract (e.g. skeleton parity tests).

### Task 3: Compact density for badge and table

**Files:**
- Modify: `packages/ui/src/components/badge.tsx` (has an existing patch)
- Modify: `packages/ui/src/components/table.tsx`
- Modify: `packages/ui/scripts/update-shadcn.ts`
- Regenerate patches via `bun run ui:refresh-patches`

- [x] **Step 1: Badge base.** Current base: `h-5 ... rounded-4xl border px-2 py-0.5 text-xs`. Change to the Verve shape: `px-2` → `px-1.25`, `rounded-4xl` → `rounded-sm`, add `min-w-5`. Keep all variants including our local `success`. (Count chips that want a pill pass `rounded-full` at the call site; stage 4 does that.)

- [x] **Step 2: Table metrics.** `TableHead`: `h-10` → `h-8`. `TableCell`: `p-2` → `px-2 py-1.5`.

- [x] **Step 3: DEVIATIONS + refresh.** Extend badge's entry with the shape change, add a table entry (`table: "Verve-compact rows: h-8 header, py-1.5 cells."`). Run `bun run ui:refresh-patches`.

- [x] **Step 4: Run the suite**

Run: `bun run test`. Fix pinned-metric assertions as in Task 2 (TableSkeleton parity tests are the likely place; the skeleton must still measure identical to data rows at the new heights, so adjust its bar/box sizes if a test proves drift, per the skeleton rule).

### Task 4: Stage 1 verification + checkpoint

- [x] **Step 1:** `bun run test` all green. `bunx biome check --error-on-warnings .` zero. `bun run typecheck` green (vendor files are Biome-excluded already).
- [x] **Step 2:** Start the dev app, click through: overview, roles, people, a form dialog, a table. Everything is tighter; nothing overlaps or clips; buttons/inputs align on rows (mixed h-7 button next to h-8 input is Verve's own pairing, correct). Check dark mode once.
- [x] **Step 3: CHECKPOINT 1.** Present a file-by-file diff summary. STOP for review. On explicit approval only, commit as: `feat(ui): verve-compact control density` (body documents each vendor deviation) and `feat(ui): vendor frame component from reui`.

---

# STAGE 2: Shell

The rail, the sheet, the top bar, the inner sidebar, breadcrumbs, centered width.

### Task 5: Navigation registry rework

**Files:**
- Modify: `apps/dashboard/lib/navigation.ts` (full rework)
- Delete: `apps/dashboard/lib/section-pages.ts` (absorbed; move `deepestMatch` into navigation.ts)
- Modify: `apps/dashboard/components/command-palette.tsx` (consumer of `navEntriesFor`/`SECTION_PAGES`; update imports to the new flat helper)
- Test: `apps/dashboard/lib/navigation.test.ts` (create)

**Interfaces:**
- Produces (exact exports from `@/lib/navigation`):

```ts
export type AreaId =
  | "home" | "assistant" | "work" | "model" | "people"
  | "payMappings" | "docs" | "settings" | "admin"

export type InnerNavEntry = {
  readonly labelKey: /* literal union of dashboard.* keys used */
  readonly href: string
  readonly adminOnly: boolean
}
export type InnerNavGroup = {
  readonly labelKey?: /* literal key */  // group heading; omitted = ungrouped
  readonly entries: readonly InnerNavEntry[]
}
export type NavArea = {
  readonly id: AreaId
  readonly labelKey: /* literal key */
  readonly href: string                  // rail click target
  readonly icon: IconSvgElement
  readonly match: readonly string[]      // path prefixes owning the area
  readonly adminOnly: boolean
  readonly placement: "main" | "footer"  // rail position
  readonly innerNav?: readonly InnerNavGroup[]  // static per-area nav; absent = none or page-owned
}

export const NAV_AREAS: readonly NavArea[]
export function areaForPathname(pathname: string): NavArea | undefined
export function areasFor(role: string): NavArea[]          // rail rows for this role
export function innerNavFor(area: NavArea, role: string): InnerNavGroup[]  // gated rows, empty groups dropped
export function isNavActive(pathname, href, match?): boolean  // kept as today
export function deepestMatch(hrefs, pathname): string | undefined  // moved from section-pages
```

- [ ] **Step 1: Write the failing tests** (`navigation.test.ts`), the load-bearing cases:

```ts
import { describe, expect, it } from "vitest"
import { areaForPathname, areasFor, innerNavFor, NAV_AREAS } from "@/lib/navigation"

describe("areaForPathname", () => {
  it("maps the root to home and only the root", () => {
    expect(areaForPathname("/")?.id).toBe("home")
    expect(areaForPathname("/roles")?.id).toBe("work")
  })
  it("maps /roles and /work to the work area", () => {
    expect(areaForPathname("/work")?.id).toBe("work")
    expect(areaForPathname("/roles/senior-engineer")?.id).toBe("work")
  })
  it("maps the settings constellation to settings", () => {
    for (const p of ["/organization/general", "/organization/members", "/account/profile", "/account/security", "/audit-log"]) {
      expect(areaForPathname(p)?.id).toBe("settings")
    }
  })
  it("maps a run path to payMappings", () => {
    expect(areaForPathname("/pay-mappings/run-2026/analysis/equal-work")?.id).toBe("payMappings")
  })
})

describe("gating", () => {
  it("hides the admin-gated settings rows from editors but keeps the area", () => {
    const settings = NAV_AREAS.find((a) => a.id === "settings")!
    const groups = innerNavFor(settings, "editor")
    const hrefs = groups.flatMap((g) => g.entries.map((e) => e.href))
    expect(hrefs).toEqual(["/account/profile", "/account/security"])
  })
  it("gives admins the full settings nav including the audit log", () => {
    const settings = NAV_AREAS.find((a) => a.id === "settings")!
    const hrefs = innerNavFor(settings, "admin").flatMap((g) => g.entries.map((e) => e.href))
    expect(hrefs).toContain("/organization/general")
    expect(hrefs).toContain("/audit-log")
  })
  it("keeps the platform admin area out of areasFor entirely", () => {
    expect(areasFor("admin").some((a) => a.id === "admin")).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure** (`bun run test --filter dashboard` or from `apps/dashboard`: `bun run test navigation`). Expected: module has no such exports.

- [ ] **Step 3: Implement.** Areas (icons: reuse the existing imports; settings uses `Settings01Icon` or the closest existing HugeIcons free icon; check `@hugeicons/core-free-icons` exports before picking):

| id | href | match | placement | innerNav |
| --- | --- | --- | --- | --- |
| home | `/` | `[]` | main | none |
| assistant | `/assistant` | | main | none (page-owned panel) |
| work | `/work` | `["/roles"]` | main | one group: Overview `/work`, Roles `/roles` (labelKeys `nav.overview`, `nav.roles`) |
| model | `/model` | | main | none (in-page journey) |
| people | `/people` | | main | one group: `people.tabs.people` `/people`, `people.tabs.classify` `/people/classify` |
| payMappings | `/pay-mappings` | | main | none (run sidebar is page-owned, Task 14) |
| docs | `/docs` | | footer | none (page-owned nav) |
| settings | `/organization/general` | `["/organization", "/account", "/audit-log"]` | footer | groups: Organization (`organization.tabs.general` `/organization/general` adminOnly, `organization.tabs.members` `/organization/members` adminOnly), Account (`account.tabs.profile`? use the real existing AccountTabs keys, read `components/account/account-tabs.tsx`), ungrouped: `nav.auditLog` `/audit-log` adminOnly |
| admin | `/admin` | | main (platform only; see below) | one group: read `components/admin/admin-tabs.tsx` for the four pages/keys (organizations, ai-usage, audit-log, email-log) |

The settings area is `adminOnly: false` (editors reach Account); its ORG rows are entry-gated. The admin area: `areasFor` never returns it (platform gating is not an org role); the rail shows it only when the platform-admin signal is available (Task 9 reads `app/(app)/admin/layout.tsx` and `org-context.tsx` to find the existing signal; if it is server/query-gated only, the rail shows the admin icon when `pathname` is inside `/admin`, and the admin layout keeps its own gate as today). `areaForPathname` picks the longest matching prefix across `href` + `match` (root exact-only). Editor landing for settings: export `settingsHrefFor(role)` returning `/organization/general` for admin, `/account/profile` otherwise, and use it as the rail link target.

Also update `command-palette.tsx`: it consumed `navEntriesFor` + `SECTION_PAGES`; give navigation.ts a `paletteEntriesFor(role)` that flattens areas + inner entries (same visible set as before) and switch the palette to it. Delete `section-pages.ts`, moving `deepestMatch` here with its test coverage (write 2 cases inline in navigation.test.ts).

- [ ] **Step 4: Run tests** until green. Full `bun run test` for the palette fallout.

### Task 6: Shell i18n keys

**Files:**
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`

- [ ] **Step 1: Add the keys** (en first; exact set):

```jsonc
// under "dashboard"
"shell": {
  "create": "Create",
  "createRole": "New role",
  "importPeople": "Import people",
  "inviteMember": "Invite member",
  "collapseNav": "Collapse navigation",
  "expandNav": "Expand navigation",
  "areaNav": "Section navigation"
},
"nav": { /* add */ "settings": "Settings" }
```

sv: `"Skapa"`, `"Ny roll"`, `"Importera personer"`, `"Bjud in medlem"`, `"Fäll ihop navigationen"`, `"Fäll ut navigationen"`, `"Sektionsnavigation"`, `"Inställningar"`. Write nb/da/fi directly at production quality (mirror the wording style of the existing `nav.*` and `commandPalette.*` keys in each file; e.g. nb "Ny rolle", da "Ny rolle", fi "Uusi rooli"; check neighbouring keys for the established verbs for import/invite and reuse them).

- [ ] **Step 2: Run the parity test** (`packages/i18n`: `bun run test`). Green.

### Task 7: BrandMark

**Files:**
- Create: `apps/dashboard/components/brand-mark.tsx`
- Test: `apps/dashboard/components/brand-mark.test.tsx`

**Interfaces:**
- Produces: `BrandMark({ className?: string; label?: string })`: a `size-7 rounded-lg bg-primary` square with the white "b" glyph.

- [ ] **Step 1: Failing test** (mirror an existing simple render test's setup):

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BrandMark } from "@/components/brand-mark"

describe("BrandMark", () => {
  it("is announced by its label when given one", () => {
    render(<BrandMark label="blueprnt" />)
    expect(screen.getByRole("img", { name: "blueprnt" })).toBeInTheDocument()
  })
  it("is decorative without a label", () => {
    const { container } = render(<BrandMark />)
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })
})
```

- [ ] **Step 2: Implement.** The "b" is the second `<path>` in `components/logo.tsx` (the one starting `M147.29,384.55`). Copy that `d` verbatim into a new svg with a tight viewBox around the glyph (the letterform spans roughly x 92..184, y 187..386; start with `viewBox="88 183 100 206"` and nudge by eye in the dev app):

```tsx
export function BrandMark({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary",
        className
      )}
    >
      <svg
        viewBox="88 183 100 206"
        className="h-4 w-auto"
        fill="currentColor"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M147.29,384.55c-38.06-4.16, ... (verbatim from logo.tsx)" />
      </svg>
    </span>
  )
}
```

Text color: add `text-primary-foreground` to the span so `currentColor` is white on the rose square.

- [ ] **Step 3: Tests green.**

### Task 8: Inner sidebar rework (shell version)

**Files:**
- Modify: `apps/dashboard/components/inner-sidebar.tsx` (rework in place; keep the animation-doc invariants documented in it)
- Create: `apps/dashboard/components/inner-sidebar-nav.tsx` (registry-driven rows)
- Create: `apps/dashboard/hooks/use-inner-sidebar-open.ts`
- Test: extend `apps/dashboard/components/inner-sidebar.test.tsx`, create `apps/dashboard/hooks/use-inner-sidebar-open.test.ts`

**Interfaces:**
- Produces:

```ts
// inner-sidebar.tsx (reworked)
export function InnerSidebar(props: {
  open: boolean
  label: string
  width?: number            // px; default 240 (assistant passes 280)
  height?: "fill" | "sticky" // kept; shell uses "fill"
  className?: string
  children: ReactNode
}): JSX.Element              // collapse header row REMOVED; the handle replaces it

export function InnerSidebarHandle(props: {
  open: boolean
  onToggle: () => void
  collapseLabel: string      // t("shell.collapseNav")
  expandLabel: string        // t("shell.expandNav")
}): JSX.Element              // absolute at its parent's LEFT edge; parent must be relative + non-scrolling

// inner-sidebar-nav.tsx
export function InnerSidebarNav(props: { groups: InnerNavGroup[] }): JSX.Element

// use-inner-sidebar-open.ts
export function useInnerSidebarOpen(areaId: string): [boolean, (open: boolean) => void]
// cookie "inner_sidebar:<areaId>", default true, same client-only pattern as lib/sidebar-state.ts
```

- [ ] **Step 1: Failing hook test:**

```ts
import { describe, expect, it } from "vitest"
import { innerSidebarOpenFromCookie } from "@/hooks/use-inner-sidebar-open"

describe("innerSidebarOpenFromCookie", () => {
  it("defaults to open with no cookie", () => {
    expect(innerSidebarOpenFromCookie("", "work")).toBe(true)
  })
  it("reads a stored false for its own area only", () => {
    const cookie = "inner_sidebar:work=false; inner_sidebar:people=true"
    expect(innerSidebarOpenFromCookie(cookie, "work")).toBe(false)
    expect(innerSidebarOpenFromCookie(cookie, "people")).toBe(true)
  })
})
```

- [ ] **Step 2: Implement the hook** mirroring `lib/sidebar-state.ts` (pure parser + a `useState` hook whose setter writes `document.cookie` with `path=/; max-age=31536000`). Export the pure parser for the test.

- [ ] **Step 3: Rework InnerSidebar.** Keep the two-layer Motion structure exactly (outer animates width + marginRight, inner carries border/fixed width; `AnimatePresence` content fade; `initial={false}`); changes: width from the `width` prop (default 240), drop the header action row from the rendered output, keep `fill`/`sticky`. Compile order: the assistant page and docs layout still import `onCollapse`/`InnerSidebarExpandButton`/`InnerSidebarPinnedActions`; in THIS task update those two call sites minimally so they compile against the new API (remove the retired props/imports; their collapse affordance is temporarily gone), and delete the retired exports here. Task 13 restores collapse on both via the shared handle and finishes their restyle. Gap: keep `marginRight` 0 in the shell usage (the seam is a border, not a gap): make the gap a prop `gap?: number` defaulting to 0, assistant may keep 16 if its layout needs it (decide when migrating in Task 13, prefer 0 + border for consistency).

- [ ] **Step 4: The handle.** Verve's two-bar control, ours with the vendored Tooltip and our motion idiom:

```tsx
export function InnerSidebarHandle({ open, onToggle, collapseLabel, expandLabel }: Props) {
  const label = open ? collapseLabel : expandLabel
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            onClick={onToggle}
            className="group/handle absolute top-1/2 left-0 z-30 hidden h-12 w-7 -translate-y-1/2 -translate-x-1/2 cursor-pointer items-center justify-center outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring md:flex"
          />
        }
      >
        <span className="flex flex-col items-center">
          <span className={cn(
            "block h-2 w-0.5 origin-bottom rounded-t-full bg-foreground/40 transition-all duration-100 ease-linear group-hover/handle:bg-foreground/60",
            open ? "group-hover/handle:rotate-40" : "group-hover/handle:-rotate-40"
          )} />
          <span className={cn(
            "block h-2 w-0.5 origin-top rounded-b-full bg-foreground/40 transition-all duration-100 ease-linear group-hover/handle:bg-foreground/60",
            open ? "group-hover/handle:-rotate-40" : "group-hover/handle:rotate-40"
          )} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
```

Adapt to the vendored Tooltip's real API (Base UI: check `tooltip.tsx` exports; the bars go INSIDE the button, so restructure to `TooltipTrigger render={<button .../>}` with the spans as the button's children per the Base UI render pattern used elsewhere, e.g. search `render={<` in the codebase for the established idiom). Placement invariant: the handle is `absolute left-0 -translate-x-1/2` in a RELATIVE, NON-SCROLLING wrapper whose left edge is the nav/content seam at every animation frame (Task 11 builds that wrapper), so it needs no position sync with the animated width and never detaches from the seam.

- [ ] **Step 5: InnerSidebarNav.** Verve row anatomy on our Button + Link:

```tsx
export function InnerSidebarNav({ groups }: { groups: InnerNavGroup[] }) {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const hrefs = groups.flatMap((g) => g.entries.map((e) => e.href))
  const current = deepestMatch(hrefs, pathname)
  return (
    <nav className="flex flex-col py-1">
      {groups.map((group, i) => (
        <div key={group.labelKey ?? i}>
          {i > 0 && <Separator className="my-2" />}
          {group.labelKey !== undefined && (
            <p className="px-3 pt-2 pb-1 font-medium text-[11px] text-foreground/70 uppercase">
              {t(group.labelKey)}
            </p>
          )}
          <div className="flex flex-col gap-0.5 px-2">
            {group.entries.map((entry) => {
              const active = entry.href === current
              return (
                <Button
                  key={entry.href}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2.5",
                    active ? "bg-accent font-medium text-accent-foreground" : "font-normal"
                  )}
                  aria-current={active ? "page" : undefined}
                  render={<Link href={entry.href} />}
                >
                  <span className="truncate">{t(entry.labelKey)}</span>
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
```

(Default button size is now h-7 text-[0.8rem] from Stage 1, matching Verve's rows exactly. `t` with dynamic keys: keep the labelKey unions literal so the `t()` calls stay typed; if the union forces it, use `t(entry.labelKey as never)` style seen elsewhere in the codebase only if an established pattern exists, otherwise type `labelKey` as the exact union of used keys.)

- [ ] **Step 6: Tests.** Update `inner-sidebar.test.tsx` for the removed header row and new props (keep the class invariants it pins: outer div carries no box styles). Add a render test for InnerSidebarNav: active row carries `aria-current="page"`, group label renders. Run until green.

### Task 9: AppRail

**Files:**
- Create: `apps/dashboard/components/app-rail.tsx`
- Delete: `apps/dashboard/components/app-sidebar.tsx`, `nav-main.tsx`, `nav-footer.tsx`, `nav-search.tsx` (+ their test files), `nav-organization.tsx` (its org identity moves to the header, Task 10)
- Modify: `apps/dashboard/components/nav-user.tsx` (becomes the rail's avatar row: icon-only trigger; keep the menu content including `OrgSwitchMenuSub`, language, sign out)
- Test: `apps/dashboard/components/app-rail.test.tsx`

**Interfaces:**
- Consumes: `areasFor(role)`, `areaForPathname`, `settingsHrefFor(role)` from Task 5; `BrandMark` from Task 7; `useOrganization()` for role.
- Produces: `AppRail()` rendered inside `SidebarProvider`, as `<Sidebar variant="inset" collapsible="offcanvas">`.

- [ ] **Step 1: Read** `packages/ui/src/components/sidebar.tsx` (SidebarHeader/Content/Footer/Menu APIs, mobile Sheet behavior) and the current `nav-user.tsx`.

- [ ] **Step 2: Implement.** Desktop = icon column; mobile sheet = icon column + label column (Verve's two-column pattern):

```tsx
export function AppRail() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const { role } = useOrganization()
  const { setOpenMobile } = useSidebar()
  const areas = areasFor(role)
  const active = areaForPathname(pathname)
  const railButton = (area: NavArea) => (
    <SidebarMenuItem key={area.id}>
      <SidebarMenuButton
        isActive={active?.id === area.id}
        tooltip={t(area.labelKey)}
        className="size-8 justify-center p-2"
        render={<Link href={area.id === "settings" ? settingsHrefFor(role) : area.href} />}
        onClick={() => setOpenMobile(false)}
      >
        <HugeiconsIcon icon={area.icon} strokeWidth={2} />
        <span className="sr-only">{t(area.labelKey)}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <div className="flex h-full grow">
        {/* icon column, always */}
        <div className="flex h-full flex-col">
          <SidebarHeader className="items-center py-3">
            <Link href="/" aria-label={t("nav.home")}> <BrandMark /> </Link>
          </SidebarHeader>
          <SidebarContent className="items-center">
            <SidebarMenu className="gap-0.5 p-2">
              {areas.filter((a) => a.placement === "main").map(railButton)}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="items-center gap-0.5 p-2">
            <SidebarMenu className="gap-0.5">
              {areas.filter((a) => a.placement === "footer").map(railButton)}
            </SidebarMenu>
            <NavUser /> {/* avatar-only trigger, size-7 */}
          </SidebarFooter>
        </div>
        {/* label column, mobile sheet only */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto border-border/60 border-l md:hidden">
          <MobileAreaNav areas={areas} active={active} onNavigate={() => setOpenMobile(false)} />
        </div>
      </div>
    </Sidebar>
  )
}
```

`MobileAreaNav` (private in the same file): a plain list of area rows (icon + label, active state) and, under the active area, its `innerNavFor` rows indented; every link closes the sheet. Admin area: after reading `admin/layout.tsx` + `org-context.tsx` in this task, wire the platform signal if one is client-reachable; otherwise render the admin icon only when `pathname.startsWith("/admin")`.

- [ ] **Step 3: NavUser trim.** Trigger becomes an icon button (`size-7`) with just the Avatar (size-6, brand variant); menu content unchanged. Verify the language menu and sign-out still live in it; whatever `nav-footer`/`nav-search` carried that is NOT search/docs (both replaced) moves here.

- [ ] **Step 4: Test** (`app-rail.test.tsx`, mirror the old app-sidebar/nav-main test setup for providers): renders one link per visible area for an editor (no organization-only rows lost: settings rail link points at `/account/profile` for editor), active area's button has `data-active`/`aria-current` per SidebarMenuButton's contract, brand mark links home.

- [ ] **Step 5:** Run dashboard tests; the deleted components' tests go with them. Full suite green except anything importing `SiteHeader`-adjacent pieces still present (next tasks).

### Task 10: AppHeader (top bar)

**Files:**
- Create: `apps/dashboard/components/app-header.tsx`, `apps/dashboard/components/org-switcher.tsx`, `apps/dashboard/components/create-menu.tsx`, `apps/dashboard/components/search-button.tsx`
- Delete: `apps/dashboard/components/site-header.tsx` (+ test), `section-tabs.tsx`, `header-tab-link.tsx`, `components/people/people-tabs.tsx`, `components/organization/organization-tabs.tsx`, `components/account/account-tabs.tsx`, `components/admin/admin-tabs.tsx` (+ their tests). `components/pay-mapping/pay-mapping-tabs.tsx` + `pay-mapping-run-indicator.tsx` are deleted in Task 11 when the run sidebar exists; until then they are simply unrendered.
- Test: `apps/dashboard/components/app-header.test.tsx`

**Interfaces:**
- Consumes: `useCommandPaletteControls()` (`{ open, setOpen, isMac }`), `useOrganization()`, org list logic read from `org-switch-menu.tsx`.
- Produces: `AppHeader()`.

- [ ] **Step 1: Read** `org-switch-menu.tsx` fully (org list source + switch mutation) and `input-group.tsx` + `kbd.tsx` exports.

- [ ] **Step 2: Implement AppHeader:**

```tsx
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) w-full shrink-0 items-center gap-1.5 border-b bg-background pe-2 ps-2.5">
      <SidebarTrigger className="md:hidden" />
      <OrgSwitcher />
      <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
        <SearchButton />
      </div>
      <div className="ms-auto flex items-center gap-1">
        <CreateMenu />
      </div>
    </header>
  )
}
```

`OrgSwitcher`: ghost Button (default size), brand Avatar size-5 + truncated org name + the existing `UpDownChevrons`; DropdownMenu listing the user's organizations with the same select/switch logic as `OrgSwitchMenuSub` (extract that logic into a shared hook `useOrgSwitch()` in `org-switch-menu.tsx` and consume it from both, rather than duplicating the mutation).

`SearchButton` (opens the palette):

```tsx
export function SearchButton() {
  const t = useTranslations("dashboard")
  const { open, setOpen, isMac } = useCommandPaletteControls()
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={t("commandPalette.trigger")}
      className="w-80 cursor-pointer rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <InputGroup className="pointer-events-none h-7">
        <InputGroupAddon>
          <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
        </InputGroupAddon>
        <span className="flex-1 ps-1.5 text-start text-muted-foreground text-sm">
          {t("commandPalette.trigger")}
        </span>
        <InputGroupAddon align="inline-end">
          <KbdGroup>
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </InputGroupAddon>
      </InputGroup>
    </button>
  )
}
```

(Adapt addon/align prop names to the vendored `input-group.tsx` API found in Step 1.)

`CreateMenu`: outline Button (default size) with a plus icon + `t("shell.create")`; DropdownMenu items: `shell.createRole` → `/roles` , `shell.importPeople` → `/people/import`, `shell.inviteMember` → `/organization/members` (admin-gated via `useOrganization().role`). Items navigate with `useRouter().push`; check whether `/roles` supports an open-create affordance (query param or store) while implementing; if none exists, plain navigation is the whole scope (no new create surfaces in this task).

- [ ] **Step 3: Test:** renders org name; search button opens palette (assert `setOpen` effect via the provider test utilities used by `command-palette-provider.test.tsx`); create menu hides the invite item for editors.

- [ ] **Step 4:** Suite run; `site-header.test` deleted with its component.

### Task 11: Shell assembly (inset, scroll model, per-area sidebars, run sidebar)

**Files:**
- Modify: `apps/dashboard/components/app-shell.tsx` (full rework)
- Create: `apps/dashboard/components/area-inner-sidebar.tsx`
- Create: `apps/dashboard/components/pay-mapping/run-sidebar.tsx`
- Delete: `components/pay-mapping/pay-mapping-tabs.tsx`, `pay-mapping-run-indicator.tsx` (their function moves into run-sidebar)
- Modify: `apps/dashboard/app/(app)/pay-mappings/[slug]/layout.tsx` (drop tab rendering if any; read it first)
- Test: rewrite `apps/dashboard/components/app-shell.test.tsx` (the `shellLayoutClasses` replacement), create `components/pay-mapping/run-sidebar.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `pageContentClasses(pathname: string): string` (pure, exported for tests) and the assembled shell.

- [ ] **Step 1: Rework app-shell.tsx:**

```tsx
export function AppShell({ organization, children }: Props) {
  const pathname = usePathname()
  return (
    <OrganizationProvider value={organization}>
      <TooltipProvider>
        <SidebarProvider
          className="h-screen"
          style={{
            "--sidebar-width": "3.5rem",
            "--header-height": "50px",
            "--sidebar-width-inner": "240px",
          } as CSSProperties}
        >
          <CommandPaletteProvider>
            <AppRail />
            <SidebarInset className="overflow-hidden border border-border shadow-none">
              <AppHeader />
              <div className="flex min-h-0 flex-1">
                <AreaInnerSidebar />
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <AreaInnerSidebarHandle />
                  <main className="min-h-0 flex-1 overflow-y-auto">
                    <div className={pageContentClasses(pathname)}>
                      <RoleSheetProvider>{children}</RoleSheetProvider>
                    </div>
                  </main>
                </div>
              </div>
            </SidebarInset>
          </CommandPaletteProvider>
        </SidebarProvider>
      </TooltipProvider>
    </OrganizationProvider>
  )
}
```

Notes: the wrapper `h-screen` locks the sheet to the viewport; the vendored inset variant supplies `m-2 ml-0 rounded-xl shadow-sm` and the wrapper's `bg-sidebar`; our className adds the border. The old `defaultOpen`/`initialSidebarOpen` state is for the retired expandable sidebar: remove it and `lib/sidebar-state.ts` IF nothing else consumes it (the new inner-sidebar hook has its own module). The relative div around `main` is the non-scrolling seam layer the handle needs (Task 8 Step 4).

`pageContentClasses` (replaces `shellLayoutClasses`), pure:

```ts
export function pageContentClasses(pathname: string): string {
  // Pages that own their whole pane (panel + content composition):
  const selfManaged =
    pathname === "/assistant" ||
    pathname === "/docs" || pathname.startsWith("/docs/") ||
    pathname === "/work"
  if (selfManaged) return "flex h-full min-h-0 w-full flex-col"
  const uncapped = pathname === "/model" || pathname.startsWith("/model/")
  const wide = /^\/pay-mappings\/[^/]+(\/|$)/.test(pathname)
  return cn(
    "mx-auto flex w-full flex-col gap-5 p-4",
    !uncapped && (wide ? "max-w-[85rem]" : "max-w-7xl")
  )
}
```

(`/work` keeps its own height-locked matrix inside the pane; `/assistant` likewise. Verify both render correctly and adjust their page-level containers in Task 13 if they relied on the old shell classes; the old `PAGE_*` constants are deleted with `shellLayoutClasses`, and `/work`'s `PAGE_CONTENT_MAX_W` alignment trick is re-expressed against the new p-4 geometry: read `work/page.tsx` while doing this and keep its aligned column math working.)

- [ ] **Step 2: AreaInnerSidebar** (+ handle wrapper) in `area-inner-sidebar.tsx`:

```tsx
export function AreaInnerSidebar() {
  const pathname = usePathname()
  const { role } = useOrganization()
  const t = useTranslations("dashboard")
  const area = areaForPathname(pathname)
  const inRun = /^\/pay-mappings\/[^/]+(\/|$)/.test(pathname)
  const groups = area ? innerNavFor(area, role) : []
  const show = inRun || groups.length > 0
  const [open] = useInnerSidebarOpen(area?.id ?? "none")
  if (!show) return null
  return (
    <InnerSidebar open={open} label={t("shell.areaNav")} height="fill">
      {inRun ? <RunSidebar /> : <InnerSidebarNav groups={groups} />}
    </InnerSidebar>
  )
}
```

`AreaInnerSidebarHandle` renders `InnerSidebarHandle` under the same `show` condition, sharing the hook state (both components call `useInnerSidebarOpen(area.id)`; the hook must read the cookie on each toggle OR simpler: lift the state, render both from ONE component pair: export `useAreaInnerSidebar()` returning `{ show, open, toggle, content }` consumed by both slots in app-shell. Prefer the lifted hook; two cookie-reading instances would desync).

- [ ] **Step 3: RunSidebar.** Read the current `pay-mapping-tabs.tsx` + `pay-mapping-run-indicator.tsx` for the runs query and labels, then build: back-link row ("← " + existing `payMapping` list label key), the run switcher (Select or DropdownMenu listing runs, current run name, navigates to the same sub-page in the chosen run), a group of four rows (Overview `/pay-mappings/<slug>`, Analysis `/analysis`, Actions `/actions`, Report `/report`) using the existing tab label keys, active via `deepestMatch`. Delete the two old components + tests; move any still-needed i18n keys, delete orphaned ones (Task 24 sweeps again).

- [ ] **Step 4: Tests.** Rewrite `app-shell.test.tsx` around `pageContentClasses` (cases: default page capped + centered, run page wide, model uncapped, work/assistant/docs self-managed). RunSidebar test: renders four rows + back link, active row for `/analysis` paths.

- [ ] **Step 5: Boot the dev app.** Fix what the assembly broke before moving on: every area renders, the sheet frame looks right, inner sidebars appear for work/people/settings/admin/run, handle collapses and persists across reload, mobile sheet opens with areas + labels. `/assistant`, `/docs`, `/work` render (their own panels get restyled next task; functional is enough here).

### Task 12: Breadcrumb row on every page; PageHeader retired

**Files:**
- Create: `apps/dashboard/components/page-breadcrumb-row.tsx`
- Modify: `apps/dashboard/components/page-breadcrumb.tsx` (last-crumb styling: `font-medium` → `font-normal text-foreground`; support a skeleton crumb)
- Modify: every page that renders `PageHeader` (find them: `rg -l "PageHeader" apps/dashboard`)
- Delete: `apps/dashboard/components/page-header.tsx`, `page-heading.tsx`, `page-header-slot.tsx` (+ tests) once no consumers remain
- Test: `apps/dashboard/components/page-breadcrumb-row.test.tsx`

**Interfaces:**
- Produces:

```tsx
export type Crumb = { label: string; href?: string } | { skeleton: true }
export function PageBreadcrumbRow(props: {
  segments: Crumb[]        // WITHOUT the Home crumb; the row prepends Hem → "/"
  actions?: ReactNode      // right-aligned page-level actions
}): JSX.Element
// Renders: <header min-h-9 flex items-center justify-between> breadcrumb + actions,
// plus an sr-only h1 with the last labelled segment.
```

- [ ] **Step 1: Failing test:** Home is prepended and links to "/"; last segment is the current page (aria-current); actions render right; a `{skeleton: true}` segment renders a Skeleton bar instead of text; sr-only h1 equals the last label.

- [ ] **Step 2: Implement** on the existing `PageBreadcrumb` (extend it to accept the skeleton segment: render `<Skeleton className="h-4 w-24" />` inside `BreadcrumbItem`).

- [ ] **Step 3: Convert pages.** For each page with `PageHeader`: replace with `PageBreadcrumbRow`, move the old `action` into `actions`, DELETE the description (framing prose rule) unless it carries real instruction, in which case it moves into the surface it instructs (usually the Frame header, arriving in Stages 3-4; if that target does not exist yet, the description moves into the page's existing Card title block, never left floating). Crumb table (labels are existing i18n keys):

| Page | segments |
| --- | --- |
| `/` | `[{ nav.home }]` (single crumb, no Home prefix duplication: the row skips the prefix when segments[0].href is "/" or label equals Home) |
| `/work` | Work › Overview |
| `/roles` | Work › Roles |
| `/roles/[roleSlug]` | Work › Roles › {role title or skeleton} |
| `/roles/[roleSlug]/rate` | Work › Roles › {title} › {rate label key used on that page today} |
| `/roles/families/[familySlug]` | Work › Roles › {family name or skeleton} |
| `/roles/import`, `/people/import` | parent area › the import page's existing title key |
| `/model` + chapters | Model (the chapter journey chrome below stays; chapter pages add › {chapter label}) |
| `/people`, `/people/classify`, `/people/[publicId]` | People › ... (person page: {person display name or skeleton}) |
| `/pay-mappings` | Pay mappings |
| `/pay-mappings/[slug]/...` | Pay mappings › {run name or skeleton} › {sub-page label} |
| `/organization/general`, `/organization/members` | Settings › {tab label} |
| `/account/profile`, `/account/security` | Settings › {tab label} |
| `/audit-log` | Settings › Audit log |
| `/admin/*` | Admin › {page label} |
| `/assistant`, `/docs` | skip: these panel-first surfaces render no breadcrumb row in this pass |

Entity pages already fetch their entity for the old title; reuse that value; while `undefined`, pass `{skeleton: true}` (no layout shift). Where a page's `PageHeader` had a `titleAdornment` HelpMorphButton, the help moves to the nearest Frame/Card/section title that names the concept, in this task, never dropped.

- [ ] **Step 4: Delete** the PageHeader family + `rg` confirms zero references. Run the full suite; update page tests that asserted the old heading (assert the sr-only h1 or the breadcrumb instead).

### Task 13: Assistant + docs panels on the new anatomy; scroll model fixes

**Files:**
- Modify: `apps/dashboard/app/(app)/assistant/page.tsx` + its panel components (find via the page's imports)
- Modify: `apps/dashboard/app/(app)/docs/layout.tsx` + docs nav components (`components/docs/*`)
- Modify: whatever `rg -n "window.scroll|scrollY|documentElement.scrollTop" apps/dashboard` finds (the docs hash scroll is the known one)
- Test: update the affected component tests

- [ ] **Step 1:** Migrate both surfaces' panels to the reworked `InnerSidebar` (width 280 for assistant, 240 for docs) with the `InnerSidebarHandle` replacing their old collapse/expand buttons (docs previously had no collapse: it gains the handle now, consistent shell behavior; its "the only nav" concern is answered by the handle remaining visible). Their rows restyle to `InnerSidebarNav` anatomy where they are nav (docs) and keep their own content where they are not (assistant conversation list items keep their component, inheriting density).
- [ ] **Step 2:** Docs hash/scroll logic: the scroller is now the shell's `main` pane. Give the pane a stable way to be found (`data-slot="app-scroll"` on the `main` in app-shell) and rewrite the scroll reads/writes against it. Verify: opening `/docs/some-page#heading` scrolls to the heading; the docs nav pins correctly (its `sticky` mode now sticks within the pane; if `h-svh` self-start math no longer applies, switch docs to `height="fill"` inside the new locked pane, which is simpler and correct now that the pane owns scrolling).
- [ ] **Step 3:** `rg` for other window-scroll dependents (scroll-to-top on route change, morph placement code) and fix against the pane. Run suite + browse both surfaces.

### Task 14: Stage 2 verification + checkpoint

- [ ] **Step 1:** Full `bun run test`, Biome zero, typecheck green.
- [ ] **Step 2:** Dev-app pass: all areas, run pages, mobile sheet, dark mode, collapse persistence, `⌘K` from keyboard AND the search button, org switch, create menu gating (editor vs admin), locale spot-check (sv + fi) for the new keys, reduced-motion (OS setting) sanity on the inner sidebar.
- [ ] **Step 3: CHECKPOINT 2.** File-by-file diff summary. STOP. On approval, commit in slices: `feat(nav): area registry with per-area inner nav`, `feat(shell): icon rail, inset sheet and top bar`, `feat(shell): collapsible inner sidebar`, `feat(shell): breadcrumb page rows replace page headers`, `refactor(pay-mapping): run navigation moves to the inner sidebar`.

---

# STAGE 3: Settings surfaces on Frame + Field

### Task 15: Organization general settings

**Files:**
- Modify: `apps/dashboard/app/(app)/organization/general/page.tsx`
- Modify: `apps/dashboard/components/organization/organization-logo-section.tsx`, `organization-profile-form.tsx` (+ whatever else the page composes; read it fully first)
- Test: update the components' tests

**Interfaces:**
- Consumes: `Frame`, `FramePanel`, `FrameHeader`, `FrameTitle`, `FrameDescription`, `FrameFooter` (Task 1); `Field` family from `@workspace/ui/components/field` (read its exports first: `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, `FieldContent`, `FieldSeparator` per the vendored file).

- [ ] **Step 1:** Read the page + section components. Inventory every input the form renders (name, industry, country, size, language, logo, and whatever else is there).
- [ ] **Step 2:** Restructure into Verve's settings anatomy, keeping the existing `useForm` + zod schema + mutation wiring byte-for-byte:

```tsx
<Frame spacing="sm">
  <FrameHeader>
    <FrameTitle>{t("organization.tabs.general")}</FrameTitle>
    <FrameDescription>{/* the one real instructional line, if any */}</FrameDescription>
  </FrameHeader>
  <FramePanel className="p-0">
    <FieldGroup className="gap-0">
      <Field orientation="responsive" className="gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md/field-group:max-w-sm">
          <FieldLabel htmlFor="org-name">{t(...)}</FieldLabel>
          <FieldDescription>{t(...)}</FieldDescription>
        </div>
        <FieldContent>
          <FormField ... (existing RHF field, its FormControl input now h-8) />
        </FieldContent>
      </Field>
      <FieldSeparator />
      ...one Field per setting...
    </FieldGroup>
  </FramePanel>
  <FrameFooter>
    <SubmitButton ... existing submit, disabled={!isValid || !isDirty} ... />
  </FrameFooter>
</Frame>
```

Adapt to the REAL vendored `field.tsx` API (orientations and class hooks may differ from Verve's; the container-query classes above are Verve's, ours may already bake them in). The logo section becomes the first Field row (avatar + Change/Remove buttons right, like Verve's Workspace Logo row). One Frame per logical section if the page has several; sections stack with `space-y-5` (the page container's `gap-5` covers it).
- [ ] **Step 3:** HelpMorphButtons: re-anchor next to `FrameTitle` (allowed slot). `FormMessage` inline errors must still render under the control inside `FieldContent` (verify one invalid submit visually).
- [ ] **Step 4:** Tests updated (form behavior tests keep passing; only structure assertions change). Suite + visual pass.

### Task 16: Account profile + security

**Files:**
- Modify: `apps/dashboard/app/(app)/account/profile/page.tsx`, `account/security/page.tsx` + their composed components under `components/account/`
- Test: update the affected tests

- [ ] **Step 1:** Same transformation as Task 15, one Frame per section (profile details; password; two-factor; danger zone last). The danger zone (self-erasure) becomes its own Frame whose footer holds the destructive action; the type-to-confirm gate stays exactly as-is inside its dialog.
- [ ] **Step 2:** Every switch/select row follows the Verve row shape (control right-aligned). Suite + visual pass.

### Task 17: Platform admin surfaces + Stage 3 checkpoint

**Files:**
- Modify: `apps/dashboard/app/(app)/admin/page.tsx` and any admin sub-page that is form/summary-shaped (read them; the table-shaped ones wait for Stage 4)
- Test: update affected tests

- [ ] **Step 1:** Apply the Frame anatomy to the admin landing's summary cards/sections (Frame with `FramePanel` content; keep their data wiring).
- [ ] **Step 2:** Full suite, Biome, typecheck, visual pass of all three settings areas in sv + en.
- [ ] **Step 3: CHECKPOINT 3.** Diff summary, STOP, on approval commit: `feat(settings): organization settings on frame anatomy`, `feat(account): account surfaces on frame anatomy`, `feat(admin): admin summaries on frame anatomy`.

---

# STAGE 4: Register tables on Frame

### Task 18: Frame-table primitives

**Files:**
- Create: `apps/dashboard/components/frame-table.tsx`
- Modify: `apps/dashboard/components/table-pagination.tsx` (rebuild to Verve shape)
- Modify: `apps/dashboard/components/table-sort-button.tsx` (ghost h-6 anatomy)
- Modify: `apps/dashboard/components/table-search-field.tsx` (InputGroup h-7 w-72 anatomy)
- Modify: `apps/dashboard/components/table-skeleton.tsx` (only if the new metrics desync it; measure first)
- Test: `frame-table.test.tsx`, update `table-pagination.test.tsx`, `table-sort-button` tests, `table-search-field.test.tsx`

**Interfaces:**
- Produces:

```tsx
export function FrameTable(props: {
  title: string
  count?: number            // count badge; hidden while undefined (loading)
  toolbar?: ReactNode       // search + filters + primary action, right side
  footer?: ReactNode        // pagination row
  children: ReactNode       // the <Table> (or grouped tables)
}): JSX.Element
```

Structure (Verve's, verbatim geometry):

```tsx
<Frame>
  <FramePanel className="p-0">
    <div className="flex flex-col gap-4 px-(--frame-panel-header-px) py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2.5">
        <h2 className="truncate font-semibold text-2xl tracking-tight">{title}</h2>
        {count !== undefined && (
          <Badge variant="outline" className="rounded-full">
            <NumberFlow value={count} />  {/* live count per the NumberFlow rule */}
          </Badge>
        )}
      </div>
      {toolbar && <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:justify-end">{toolbar}</div>}
    </div>
    <Separator />
    {children}
    {footer && <div className="px-(--frame-panel-px) py-3">{footer}</div>}
  </FramePanel>
</Frame>
```

(Check the badge variant names in our badge.tsx for the outline-shaped one; NumberFlow only if the count changes live on screen while filtering, which it does: the result-count rule.)

- [ ] **Step 1:** Failing tests: FrameTable renders title, count badge appears when count given, toolbar/footer slots render. TablePagination new anatomy: rows-per-page select (values from a `pageSizes` prop, default `[25, 50, 100]` with existing PAGE_SIZE first), range text `1-25 of 132` via an ICU key (new i18n key `dashboard.table.range` = `"{from}-{to} of {total}"` + per-surface unit handling: reuse the existing pagination i18n keys if present; read the current component first and keep its key structure where it fits), numbered page buttons (current = `bg-accent`), prev/next icon buttons, page-1 reset behavior preserved.
- [ ] **Step 2:** Implement; TableSortButton: ghost button `h-6 rounded-lg px-2 font-normal text-secondary-foreground/80 hover:bg-secondary hover:text-foreground`, chevron in the pre-reserved slot as today (keep the no-layout-shift slot and `aria-sort` contract). TableSearchField: `InputGroup` with leading search icon, `h-7 w-full sm:w-72`.
- [ ] **Step 3:** i18n keys for pagination (all five locales). Suite green.

### Task 19: People register + classify

**Files:**
- Modify: `apps/dashboard/app/(app)/people/page.tsx` + `components/people/*` (the table, toolbar, skeleton composition; read first)
- Modify: `apps/dashboard/app/(app)/people/classify/page.tsx` + its table components
- Test: update the people/classify tests

- [ ] **Step 1:** Wrap the people table in `FrameTable` (title = the people tab label, count = filtered result count, toolbar = existing search + filters + import/add actions moved in, footer = rebuilt TablePagination). First/last column cells get the panel edge padding: add `ps-(--frame-panel-px)` to the first column's head+cells and `pe-(--frame-panel-px)` to the last (also to `TableSkeleton` via its column definitions so skeleton and data rows stay identical).
- [ ] **Step 2:** Row `...` menus stay. Row hover `hover:bg-muted/40` via the vendored row default (check `table.tsx` TableRow; if its hover differs, align it there as part of the stage's vendor pass, one place).
- [ ] **Step 3:** Same for classify. Suite + visual (including the loading skeleton and empty/no-matches states inside the panel).

### Task 20: Roles + families

**Files:**
- Modify: `apps/dashboard/app/(app)/roles/page.tsx` + `components/roles/*` (grouped-by-family register)
- Modify: `apps/dashboard/app/(app)/roles/families/[familySlug]/page.tsx` composition if it renders a register
- Test: update affected tests

- [ ] **Step 1:** The roles register (grouped, unsorted per rule) into FrameTable: family group headers stay as they are rendered today inside the table body; toolbar = existing search/filter + create-role action.
- [ ] **Step 2:** Suite + visual.

### Task 21: Members + audit logs

**Files:**
- Modify: `apps/dashboard/app/(app)/organization/members/page.tsx` + `components/organization/*` member table pieces
- Modify: `apps/dashboard/app/(app)/audit-log/page.tsx` + `components/audit/*`
- Modify: `apps/dashboard/app/(app)/admin/audit-log/page.tsx` (platform log shares components)
- Test: update affected tests (audit-labels tests are content tests and must not change)

- [ ] **Step 1:** Members table → FrameTable (invite action in the toolbar). Audit log (chronological, no sorting) → FrameTable with its filters (category selects) in the toolbar; the detail sheet unchanged; the exact-total pager keeps its aggregate-backed jump behavior inside the rebuilt pagination UI (read `table-pagination` usage there: the audit pager may be a distinct component; if so, restyle it to the same Verve anatomy in place).
- [ ] **Step 2:** Suite + visual on both logs (org + platform).

### Task 22: Remaining tables + Stage 4 checkpoint

**Files:**
- Modify: `apps/dashboard/app/(app)/pay-mappings/page.tsx` (runs list), `admin/organizations/page.tsx`, `admin/ai-usage/page.tsx`, `admin/email-log/page.tsx`, `people/[publicId]/page.tsx` (salary history), plus any register found by `rg -l "TablePagination|TableSortButton" apps/dashboard` not yet converted
- Test: update affected tests

- [ ] **Step 1:** Convert each to FrameTable with its existing toolbar/actions; chronological ones without sorting.
- [ ] **Step 2:** Full suite, Biome, typecheck. Visual pass over every table incl. skeletons, empty states, pagination edges (page 2+, filter reset).
- [ ] **Step 3: CHECKPOINT 4.** Diff summary, STOP, on approval commit per surface group: `feat(tables): frame-table anatomy for registers` (+ follow-ups per area as the diff naturally splits).

---

# STAGE 5: Cleanup, docs, final pass

### Task 23: Dead code + dead keys sweep

**Files:**
- Delete/modify: whatever the sweeps find
- Modify: `packages/i18n/messages/*.json` (remove orphaned keys everywhere at once)

- [ ] **Step 1:** `rg` for zero-reference components in `apps/dashboard/components` touched by this refactor (`PageHeader` family, tab strips, `nav-*` retirees, `section-pages`, `sidebar-state` if orphaned, `InnerSidebarExpandButton` remnants). Delete stragglers.
- [ ] **Step 2:** For every deleted surface, find its now-unused message keys (search each suspicious namespace: `rg "organization.tabs" apps/dashboard` etc.; a key still used by the registry stays). Remove from all five files; parity test green.
- [ ] **Step 3:** Full suite.

### Task 24: User-guide docs update

**Files:**
- Modify: `apps/dashboard/content/docs/<locale>/*.mdx` pages that describe navigation, headers, tabs, or settings layout (find: `rg -il "tab|sidebar|header|navigering|navigasjon|navigointi" apps/dashboard/content/docs`)
- Run: `bun run docs:sync` from `apps/dashboard` (MANDATORY same-change)

- [ ] **Step 1:** Rewrite affected passages to the new shell language (icon rail, inner sidebar, breadcrumbs, search in the top bar) in ALL five locales, keeping slugs untouched.
- [ ] **Step 2:** `bun run docs:sync` (must run; silent staleness otherwise). Docs guard tests (`docs-guards.test.ts`) green.

### Task 25: Final pass + memory + checkpoint

- [ ] **Step 1:** Full `turbo run test`, Biome zero, typecheck. Dev-app end-to-end walk: every area, both roles (admin/editor), mobile width, dark mode, sv + fi spot-check, reduced motion.
- [ ] **Step 2:** Update auto-memory: `layout-direction-full-width.md` (superseded: centered max-w-7xl inside the Verve shell, per-page exceptions), and a new note for the shell/Frame conventions (rail + inner sidebar + Frame anatomy + density scale) so future sessions build new surfaces onto it.
- [ ] **Step 3: CHECKPOINT 5 (final).** Complete file-by-file summary across the branch, grouped by area. STOP. On approval: final commits, then the branch is ready for the founder's own merge decision (never push without explicit approval).

---

## Self-review notes (kept for the executor)

- Spec coverage: shell §1→T9-T11, inner sidebar §2→T8, IA §3→T5/T9/T11, breadcrumbs/width §4→T11-T12, Frame §5→T1/T15-T17, tables §6→T18-T22, density §7→T2-T3, untouched §8 respected throughout (no task touches charts, morphs, onboarding, widgets), stages §9→checkpoints, testing/i18n §10→T6/T14/T23-T24, open items §11→resolved in T5 (settings landing per role, admin gating), T10 (create menu = navigation only), T12 (skeleton crumb), T9 (mobile sheet), T11 (pay-mappings list has no sidebar), T11 (`/model` stays uncapped).
- The one deliberate spec deviation: the pay-mapping run sidebar lands in Stage 2 (T11), not Stage 5, because deleting SiteHeader orphans the run tabs; the spec's Stage 5 keeps the cleanup role.
- Vendor API adaptation points are marked in-task (Tooltip render idiom, InputGroup addon API, Field orientations, badge variant names): the executor adapts to the real vendored files, never to Verve's exact prop names.
