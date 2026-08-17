# Unified Inner Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the documentation pages and the assistant one shared, collapsible inner-sidebar layout, and replace the documentation nav's native `<details>` triangles with a chevron disclosure.

**Architecture:** A new `InnerSidebar` app primitive owns the flush bordered column, its two height modes and its collapse animation (lifted verbatim from the assistant panel's proven geometry). The assistant adopts it in place of its bespoke panel; the docs pages adopt it through a new `docs/layout.tsx` so section open state survives navigation. `shellLayoutClasses` learns one route concept covering both.

**Tech Stack:** Next.js 16 (App Router), React 19, Motion (`motion/react`), next-intl, Tailwind v4, `@workspace/ui` (shadcn/Base UI), Hugeicons, Vitest 4 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-inner-sidebar-design.md`

## Global Constraints

- **Never `bun test`.** Bun hijacks it with its own runner; convex-test requires Vitest. Always `bun run test`.
- **No em dashes** in any text we write: UI copy, comments, commit messages, documents.
- **No AI/Claude attribution** anywhere: commits, PRs, code, comments.
- **Conventional Commits:** `type(scope): summary`, lowercase, imperative, no trailing period, <= ~72 chars.
- **All user-facing text goes through i18n.** New strings land in `packages/i18n/messages/en.json` first, then are mirrored to `sv`, `nb`, `da`, `fi`. Never hardcode display text, not even temporarily.
- **Edit message JSON with the Write/Edit tools, never shell `perl`/`sed`.** Shell rewriting double-encodes non-ASCII characters into mojibake.
- **Internal navigation uses the `Link` component**, never a plain `<a>`.
- **Biome ends at zero:** no errors, no warnings, no info. Never silence with an ignore comment.
- **`packages/ui/src/{components,hooks,lib,styles}` is vendor code.** Do not edit or reformat it. This plan touches none of it.
- **Leave completed work uncommitted for final review.** Commit per task on `main` as the steps instruct; do not push. No worktrees, no feature branches.
- **Read `docs/ui-animation.md` before writing any animation.** Rules 2, 3 and 4 are load-bearing here and are quoted where they apply.
- **Reduced motion** is handled globally by `MotionConfig reducedMotion="user"`. Never bypass it.
- **No content under `content/docs/` is touched**, so this plan runs no `bun run docs:sync`, no `bun run docs:eval`, and bumps no `CHUNKER_VERSION`.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/dashboard/lib/inner-sidebar-state.ts` (new) | Cookie read/write for any inner sidebar's open state, keyed by cookie name |
| `apps/dashboard/lib/inner-sidebar-state.test.ts` (new) | Parser unit tests |
| `apps/dashboard/components/inner-sidebar.tsx` (new) | The shared primitive: bordered column, two height modes, collapse animation, pinned expand affordances |
| `apps/dashboard/components/inner-sidebar.test.tsx` (new) | Primitive behaviour and the rule-2 class invariant |
| `apps/dashboard/components/docs/docs-nav.tsx` (new) | `DocsNav` (the section tree) and `DocsNavPanel` (open state + frame). Client |
| `apps/dashboard/components/docs/docs-nav.test.tsx` (new) | Tree behaviour: default open section, reader override persistence, active page |
| `apps/dashboard/app/(app)/docs/layout.tsx` (new) | Server: builds the serializable nav tree, wraps children in `DocsNavPanel` |
| `apps/dashboard/components/assistant/assistant-history.tsx` (modify) | Keeps the thread list and its rows; the panel frame delegates to `InnerSidebar` |
| `apps/dashboard/app/(app)/assistant/page.tsx` (modify) | Uses the primitive's frame and pinned actions |
| `apps/dashboard/components/app-shell.tsx` (modify) | `shellLayoutClasses` learns `hasInnerSidebar` |
| `apps/dashboard/app/(app)/docs/[slug]/page.tsx` (modify) | Drops its own sidebar and row wrapper; centres its article |
| `apps/dashboard/components/docs/docs-sidebar.tsx` (delete) | Replaced by the layout plus `DocsNav` |
| `apps/dashboard/lib/assistant-history-state.ts` + `.test.ts` (delete) | Replaced by `inner-sidebar-state` |

---

### Task 1: Generalize the panel-state cookie helper

Replaces the assistant-specific cookie module with one that takes a cookie name, so both sidebars share a single idiom. Behaviour is identical; only the key becomes a parameter.

**Files:**
- Create: `apps/dashboard/lib/inner-sidebar-state.ts`
- Create: `apps/dashboard/lib/inner-sidebar-state.test.ts`
- Modify: `apps/dashboard/app/(app)/assistant/page.tsx` (imports only)
- Modify: `apps/dashboard/app/(app)/assistant/page.test.tsx` (import only, line 31)
- Delete: `apps/dashboard/lib/assistant-history-state.ts`
- Delete: `apps/dashboard/lib/assistant-history-state.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ASSISTANT_HISTORY_COOKIE = "assistant_history_state"`, `DOCS_NAV_COOKIE = "docs_nav_state"`
  - `innerSidebarOpenFromCookie(cookie: string, name: string): boolean`
  - `initialInnerSidebarOpen(name: string): boolean`
  - `persistInnerSidebarOpen(name: string, open: boolean): void`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/lib/inner-sidebar-state.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  ASSISTANT_HISTORY_COOKIE,
  DOCS_NAV_COOKIE,
  innerSidebarOpenFromCookie,
} from "./inner-sidebar-state"

describe("innerSidebarOpenFromCookie", () => {
  it("defaults to open when no cookie is set", () => {
    expect(innerSidebarOpenFromCookie("", ASSISTANT_HISTORY_COOKIE)).toBe(true)
    expect(
      innerSidebarOpenFromCookie("theme=dark; locale=sv", ASSISTANT_HISTORY_COOKIE)
    ).toBe(true)
  })

  it("restores the persisted choice", () => {
    expect(
      innerSidebarOpenFromCookie("assistant_history_state=true", ASSISTANT_HISTORY_COOKIE)
    ).toBe(true)
    expect(
      innerSidebarOpenFromCookie("assistant_history_state=false", ASSISTANT_HISTORY_COOKIE)
    ).toBe(false)
  })

  it("finds the cookie among others", () => {
    expect(
      innerSidebarOpenFromCookie(
        "theme=dark; assistant_history_state=false; locale=sv",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(false)
  })

  it("ignores cookies whose names merely end with the same suffix", () => {
    expect(
      innerSidebarOpenFromCookie(
        "app_assistant_history_state=false",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(true)
  })

  // The whole point of the generalization: two sidebars, two independent
  // choices, read out of one cookie jar without either seeing the other's.
  it("keeps the two sidebars' choices independent", () => {
    const jar = "assistant_history_state=false; docs_nav_state=true"
    expect(innerSidebarOpenFromCookie(jar, ASSISTANT_HISTORY_COOKIE)).toBe(false)
    expect(innerSidebarOpenFromCookie(jar, DOCS_NAV_COOKIE)).toBe(true)
  })

  it("is not confused by the app sidebar's own cookie", () => {
    expect(
      innerSidebarOpenFromCookie(
        "sidebar_state=false; docs_nav_state=false",
        DOCS_NAV_COOKIE
      )
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- inner-sidebar-state`
Expected: FAIL, cannot resolve `./inner-sidebar-state`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/lib/inner-sidebar-state.ts`:

```ts
// Every inner sidebar (the assistant's conversations panel, the docs nav)
// persists its open/collapsed choice the same way the app sidebar does: a
// cookie, read once at mount and rewritten on every toggle. The vendor
// Sidebar owns its own state; nothing owns these, so they carry their own.
// One module rather than one per surface, keyed by cookie name, so a third
// inner sidebar costs a constant instead of a copied file.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export const ASSISTANT_HISTORY_COOKIE = "assistant_history_state"
export const DOCS_NAV_COOKIE = "docs_nav_state"

// Parses one sidebar's persisted open state out of a document.cookie string.
// No cookie (first visit) defaults to OPEN: the nav is the surface's default
// view, not a returning user's opt-in.
export function innerSidebarOpenFromCookie(
  cookie: string,
  name: string
): boolean {
  const entry = cookie.split("; ").find((part) => part.startsWith(`${name}=`))
  if (entry === undefined) return true
  return entry.slice(name.length + 1) === "true"
}

// The mount-time read. Client-only by construction: every caller sits behind
// the client-side auth gates and is never server-rendered, so reading the
// cookie here cannot cause a hydration mismatch.
export function initialInnerSidebarOpen(name: string): boolean {
  if (typeof document === "undefined") return true
  return innerSidebarOpenFromCookie(document.cookie, name)
}

// Every toggle rewrites the cookie so the choice survives a reload, the same
// write-on-toggle idiom the vendor sidebar uses internally.
export function persistInnerSidebarOpen(name: string, open: boolean): void {
  // Direct document.cookie write is intentional: the Cookie Store API the
  // linter suggests is not yet broadly supported and adds async complexity
  // for this fire-and-forget, last-known-choice write (locale-provider.tsx
  // takes the same call).
  // biome-ignore lint/suspicious/noDocumentCookie: see comment above
  document.cookie = `${name}=${open}; path=/; max-age=${COOKIE_MAX_AGE}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test -- inner-sidebar-state`
Expected: PASS, 6 tests.

- [ ] **Step 5: Switch the assistant page over and delete the old module**

In `apps/dashboard/app/(app)/assistant/page.tsx`, replace the import block:

```tsx
import {
  ASSISTANT_HISTORY_COOKIE,
  initialInnerSidebarOpen,
  persistInnerSidebarOpen,
} from "@/lib/inner-sidebar-state"
```

Replace the state initializer:

```tsx
  // Persisted across visits the same way the app sidebar's own open state is
  // (lib/inner-sidebar-state.ts, one shared cookie idiom); no stored choice
  // defaults to open, since the panel is the default view.
  const [panelOpen, setPanelOpen] = useState(() =>
    initialInnerSidebarOpen(ASSISTANT_HISTORY_COOKIE)
  )
```

Replace `togglePanel`'s body:

```tsx
  function togglePanel(next: boolean) {
    setPanelOpen(next)
    persistInnerSidebarOpen(ASSISTANT_HISTORY_COOKIE, next)
  }
```

In `apps/dashboard/app/(app)/assistant/page.test.tsx` line 31, change the import to:

```tsx
import * as innerSidebarState from "@/lib/inner-sidebar-state"
```

There are exactly two other references, both the same spy, at lines 92-95 and 165-168. Change each from:

```tsx
    vi.spyOn(
      assistantHistoryState,
      "initialAssistantHistoryOpen"
    ).mockReturnValue(false)
```

to:

```tsx
    vi.spyOn(innerSidebarState, "initialInnerSidebarOpen").mockReturnValue(false)
```

Neither asserts on the spy's arguments, so the added cookie-name parameter needs no further change. Leave line 88's `getAllByRole("button", { name: t.history })` assertion alone: the panel's collapse control keeps `t("history")` as its label in Task 3.

Delete both old files:

```bash
git rm apps/dashboard/lib/assistant-history-state.ts apps/dashboard/lib/assistant-history-state.test.ts
```

- [ ] **Step 6: Verify nothing still references the deleted module**

Run: `grep -rn "assistant-history-state" apps/dashboard --include="*.ts" --include="*.tsx"`
Expected: no output.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `bun run test && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(dashboard): key the panel-state cookie by name"
```

---

### Task 2: The `InnerSidebar` primitive

The shared frame, with no consumers yet. Its collapse geometry is the assistant panel's, moved rather than reinvented, because that geometry already encodes three rules from `docs/ui-animation.md`.

**Files:**
- Create: `apps/dashboard/components/inner-sidebar.tsx`
- Create: `apps/dashboard/components/inner-sidebar.test.tsx`

**Interfaces:**
- Consumes: `SPRING` from `@/lib/motion`.
- Produces:
  - `INNER_SIDEBAR_WIDTH = 280` (number, px)
  - `InnerSidebar(props: { open, label, collapseLabel, height?: "fill" | "sticky", actions?, className?, onCollapse, children })`
  - `InnerSidebarPinnedActions(props: { className?, children })`
  - `InnerSidebarExpandButton(props: { label, icon?: IconSvgElement, onExpand })`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/inner-sidebar.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  InnerSidebar,
  InnerSidebarExpandButton,
} from "@/components/inner-sidebar"

afterEach(cleanup)

function renderSidebar(open: boolean) {
  return render(
    <InnerSidebar
      open={open}
      label="Guide navigation"
      collapseLabel="Hide guide navigation"
      onCollapse={() => {}}
    >
      <p>tree</p>
    </InnerSidebar>
  )
}

describe("InnerSidebar", () => {
  it("renders its content and collapse control while open", () => {
    renderSidebar(true)
    expect(screen.getByRole("navigation", { name: "Guide navigation" })).toBeTruthy()
    expect(screen.getByText("tree")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Hide guide navigation" })).toBeTruthy()
  })

  // Collapsed must mean UNMOUNTED, not merely clipped: a closed panel that
  // still holds its tree keeps every link in the tab order and every
  // subscription alive behind a zero-width box.
  it("mounts nothing while collapsed", () => {
    renderSidebar(false)
    expect(screen.queryByText("tree")).toBeNull()
    expect(screen.queryByRole("button", { name: "Hide guide navigation" })).toBeNull()
  })

  it("calls onCollapse when the collapse control is pressed", async () => {
    const onCollapse = vi.fn()
    const { getByRole } = render(
      <InnerSidebar
        open
        label="Guide navigation"
        collapseLabel="Hide guide navigation"
        onCollapse={onCollapse}
      >
        <p>tree</p>
      </InnerSidebar>
    )
    getByRole("button", { name: "Hide guide navigation" }).click()
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  // docs/ui-animation.md rule 2: the animated element carries ONLY geometry.
  // A border or padding on it would survive the collapse as a stranded
  // hairline at width 0, because a border-box element at width 0 still paints
  // its border. This is the invariant a future edit is most likely to break,
  // and it is invisible in a unit test unless asserted directly.
  it("keeps the border on the inner box, never on the animated outer box", () => {
    const { container } = renderSidebar(true)
    const outer = container.firstElementChild as HTMLElement
    const inner = screen.getByRole("navigation", { name: "Guide navigation" })

    expect(outer.className).not.toContain("border")
    expect(outer.className).not.toContain("p-")
    expect(inner.className).toContain("border-r")
  })

  it("takes its height from the parent by default and pins itself when sticky", () => {
    const { container: filled } = renderSidebar(true)
    expect((filled.firstElementChild as HTMLElement).className).toContain("min-h-0")

    const { container: stuck } = render(
      <InnerSidebar
        open
        height="sticky"
        label="Guide navigation"
        collapseLabel="Hide guide navigation"
        onCollapse={() => {}}
      >
        <p>tree</p>
      </InnerSidebar>
    )
    const outer = (stuck.firstElementChild as HTMLElement).className
    expect(outer).toContain("sticky")
    expect(outer).toContain("top-0")
    expect(outer).toContain("self-start")
  })

  // The docs surface hides the whole column below lg through this prop, so it
  // has to reach the animated outer element (the one that occupies the row),
  // not the inner nav.
  it("passes a caller class through to the outer element", () => {
    const { container } = render(
      <InnerSidebar
        open
        className="hidden lg:flex"
        label="Guide navigation"
        collapseLabel="Hide guide navigation"
        onCollapse={() => {}}
      >
        <p>tree</p>
      </InnerSidebar>
    )
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "hidden lg:flex"
    )
  })
})

describe("InnerSidebarExpandButton", () => {
  it("exposes its label and calls onExpand", () => {
    const onExpand = vi.fn()
    render(<InnerSidebarExpandButton label="Show guide navigation" onExpand={onExpand} />)
    const button = screen.getByRole("button", { name: "Show guide navigation" })
    button.click()
    expect(onExpand).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- inner-sidebar.test`
Expected: FAIL, cannot resolve `@/components/inner-sidebar`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/components/inner-sidebar.tsx`:

```tsx
"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion, type Variants } from "motion/react"
import type { ReactNode } from "react"
import { SPRING } from "@/lib/motion"

// The open width and the gap the sidebar carries to the content column, both
// carried by the sidebar's OWN animated geometry rather than a flex `gap` on
// the row: a container gap does not collapse with a shrinking flex item
// (docs/ui-animation.md #3), so a `gap-*` on the row would still reserve dead
// space once the width reached 0. Animating both together means collapsed
// truly means zero footprint, no gap artifact left behind.
export const INNER_SIDEBAR_WIDTH = 280
const INNER_SIDEBAR_GAP = 16

// The content's own exit-fade duration. The CLOSE-direction width collapse
// delays by roughly this long (rule 4's staged-exit pattern: fade first, then
// collapse the now-invisible box) so the sidebar does not visibly retract text
// mid-fade. Opening carries no such delay on the box itself: it widens
// immediately and the content fades in after.
const CONTENT_FADE_OUT = 0.1

// Variants (not a single inline `animate` object) so the CLOSE direction can
// carry its own delayed transition without affecting the OPEN direction.
const panelVariants: Variants = {
  open: {
    width: INNER_SIDEBAR_WIDTH,
    marginRight: INNER_SIDEBAR_GAP,
    transition: SPRING,
  },
  closed: {
    width: 0,
    marginRight: 0,
    transition: { ...SPRING, delay: CONTENT_FADE_OUT },
  },
}

// The app's inner sidebar: the secondary navigation column that sits between
// the app sidebar and a page's content (the docs nav, the assistant's
// conversations panel). A flush column with a single border on its right, no
// radius and no fill of its own, so the nav and the content beside it read as
// two regions of ONE surface rather than an object floating inside the inset
// card the page already is.
//
// `open` is owned by the CALLER, never by this component: the page renders
// both this sidebar's own collapse button and the expand button that stands in
// for it while collapsed, and shared ownership is what stops the two from ever
// disagreeing.
//
// Split per docs/ui-animation.md #2 (width/height vs the CSS box model): the
// OUTER motion.div carries ONLY animated geometry (width, marginRight) and no
// visual box styles, so `width: 0` truly means zero and no hairline survives
// the collapse; the INNER nav carries the border, the fixed width (so text
// never rewraps mid-slide) and the flex-col + min-h-0 + overflow-y-auto chain
// that lets the content scroll on its own.
//
// The content mounts only while open (AnimatePresence, a fast fade per rule
// 4's staged-exit guidance) so a collapsed sidebar carries no links in the tab
// order at all, not merely a clipped one.
//
// Two height modes, because the two surfaces scroll differently:
//   fill   - the parent is height-locked and this fills it (the assistant).
//   sticky - the page scrolls and this pins to the viewport, so its border
//            spans top to bottom at every scroll position (the docs).
export function InnerSidebar({
  open,
  label,
  collapseLabel,
  height = "fill",
  actions,
  className,
  onCollapse,
  children,
}: {
  open: boolean
  // Names the landmark for assistive technology.
  label: string
  collapseLabel: string
  height?: "fill" | "sticky"
  // The surface's own header actions, left of the collapse control.
  actions?: ReactNode
  // Responsive visibility only (e.g. `hidden lg:flex`). Never box styles: the
  // outer element is the animated one, and a border or padding here would
  // survive the collapse (see the class invariant below).
  className?: string
  onCollapse: () => void
  children: ReactNode
}) {
  return (
    <motion.div
      initial={false}
      variants={panelVariants}
      animate={open ? "open" : "closed"}
      className={cn(
        "shrink-0 overflow-hidden",
        height === "fill" && "min-h-0",
        // self-start gives the flex item a definite height to stick within;
        // without it the item stretches to the row and never sticks.
        height === "sticky" && "sticky top-0 h-svh self-start",
        className
      )}
    >
      <AnimatePresence>
        {open && (
          <motion.nav
            key="inner-sidebar-content"
            aria-label={label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.08 } }}
            exit={{ opacity: 0, transition: { duration: CONTENT_FADE_OUT } }}
            className="flex h-full min-h-0 flex-col border-border border-r"
            style={{ width: INNER_SIDEBAR_WIDTH }}
          >
            <div className="flex h-10 shrink-0 items-center justify-between gap-1 px-2">
              {/* An empty span keeps the collapse control right-aligned on a
                  surface with no actions of its own, without the row's
                  justify-between changing per surface. */}
              {actions ?? <span />}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={collapseLabel}
                onClick={onCollapse}
              >
                {/* The app's standard chevron, pointing the way the sidebar
                    folds. */}
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {children}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// The collapsed sidebar's stand-in slot, pinned to the top-left of the content
// column (which must therefore be `relative`). Lives here rather than in each
// page so both surfaces place their stand-in identically.
export function InnerSidebarPinnedActions({
  className,
  children,
}: {
  // Responsive visibility only, matched to the sidebar's own: a stand-in for
  // a sidebar that is not rendered at this breakpoint is a dead control.
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "absolute top-2 left-2 z-10 flex flex-col gap-1",
        className
      )}
    >
      {children}
    </div>
  )
}

// The control that brings a collapsed sidebar back. The default glyph is the
// chevron mirroring the collapse control; a surface passes its own icon when
// the icon can NAME what comes back better than a direction can (the assistant
// passes HistoryIcon for its conversations).
export function InnerSidebarExpandButton({
  label,
  icon = ArrowRight01Icon,
  onExpand,
}: {
  label: string
  icon?: IconSvgElement
  onExpand: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onExpand}
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />
    </Button>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test -- inner-sidebar.test`
Expected: PASS, 7 tests.

If the collapsed-state test fails because Motion keeps the exiting child mounted, assert on `open={false}` from the initial render (as written) rather than toggling: `AnimatePresence` mounts nothing for a child that was never present.

- [ ] **Step 5: Lint and typecheck**

Run: `bunx biome check --error-on-warnings apps/dashboard/components/inner-sidebar.tsx apps/dashboard/components/inner-sidebar.test.tsx && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/inner-sidebar.tsx apps/dashboard/components/inner-sidebar.test.tsx
git commit -m "feat(dashboard): add the shared inner sidebar frame"
```

---

### Task 3: The assistant adopts the primitive

The thread list, its Convex subscription, the busy-gating and the orphan guards move across untouched. Only the panel's outer frame is replaced.

**Files:**
- Modify: `apps/dashboard/components/assistant/assistant-history.tsx`
- Modify: `apps/dashboard/app/(app)/assistant/page.tsx`
- Modify: `apps/dashboard/app/(app)/assistant/page.test.tsx`

**Interfaces:**
- Consumes: `InnerSidebar`, `InnerSidebarPinnedActions`, `InnerSidebarExpandButton` from Task 2; `ASSISTANT_HISTORY_COOKIE`, `initialInnerSidebarOpen`, `persistInnerSidebarOpen` from Task 1.
- Produces: `AssistantHistoryPanel(props: { open, busy, onCollapse, onNewConversation })`, unchanged signature.

- [ ] **Step 1: Replace the panel frame**

In `apps/dashboard/components/assistant/assistant-history.tsx`:

Delete the `PANEL_WIDTH`, `PANEL_GAP`, `CONTENT_FADE_OUT` and `panelVariants` constants and their comment blocks (lines 33-70) along with the now-unused `AnimatePresence`, `motion`, `Variants` and `SPRING` imports. That geometry now lives in the primitive; leaving a copy here is exactly the duplication the DRY rule forbids.

Replace the `AssistantHistoryPanel` body with:

```tsx
// The assistant's persistent conversations panel: open by default, listing
// every conversation with a "New conversation" button. `open`/`busy` are owned
// by the page (app/(app)/assistant/page.tsx) so this panel, its collapse
// control, and the expand button the page renders while collapsed can never
// disagree on state.
//
// The frame, its collapse animation and its border come from InnerSidebar; the
// only thing this file adds is the surface's own header action and its thread
// list.
export function AssistantHistoryPanel({
  open,
  busy,
  onCollapse,
  onNewConversation,
}: {
  open: boolean
  busy: boolean
  onCollapse: () => void
  onNewConversation: () => void
}) {
  const t = useTranslations("dashboard.assistant")

  return (
    <InnerSidebar
      open={open}
      label={t("history")}
      collapseLabel={t("history")}
      // The route is height-locked by AppShell, so the sidebar fills it.
      height="fill"
      onCollapse={onCollapse}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onNewConversation}
        >
          <HugeiconsIcon
            icon={PlusSignIcon}
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
          {t("newConversation")}
        </Button>
      }
    >
      <AssistantHistoryThreadList busy={busy} />
    </InnerSidebar>
  )
}
```

Add the import `import { InnerSidebar } from "@/components/inner-sidebar"` and drop `ArrowLeft01Icon` from the Hugeicons import (the primitive owns the collapse glyph now).

`AssistantHistoryThreadList` and `AssistantHistoryThreadRow` are unchanged, except that the list's own wrapper `div` drops `px-2 pb-2` (the primitive's content region now supplies that padding); it keeps `min-h-0 flex-1 overflow-y-auto`. Apply that to BOTH the loading branch and the loaded branch so the skeleton and the data keep measuring identically.

- [ ] **Step 2: Use the primitive's pinned slot on the page**

In `apps/dashboard/app/(app)/assistant/page.tsx`, replace the `{!panelOpen && (...)}` block with:

```tsx
        {/* The collapsed panel's compact stand-in: the two actions its header
            carried, as small stacked icon buttons. */}
        {!panelOpen && (
          <InnerSidebarPinnedActions>
            {/* Busy-gated exactly like the panel's own New conversation
                button: archiving the active thread mid-stream would silently
                orphan it. */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("newConversation")}
              disabled={busy}
              onClick={() => void handleNewConversation()}
            >
              <HugeiconsIcon
                icon={PlusSignIcon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </Button>
            {/* HistoryIcon rather than the primitive's default chevron: the
                header's app-sidebar trigger already wears a sidebar glyph, and
                here the icon can name what comes back. */}
            <InnerSidebarExpandButton
              label={t("history")}
              icon={HistoryIcon}
              onExpand={() => togglePanel(true)}
            />
          </InnerSidebarPinnedActions>
        )}
```

Add the import:

```tsx
import {
  InnerSidebarExpandButton,
  InnerSidebarPinnedActions,
} from "@/components/inner-sidebar"
```

- [ ] **Step 3: Run the assistant tests**

Run: `cd apps/dashboard && bun run test -- assistant`
Expected: PASS. If a test queried the collapse button by a label that changed, update the query to `t("history")`; do not weaken an assertion to make it pass.

- [ ] **Step 4: Run the full suite, lint and typecheck**

Run: `bun run test && bunx biome check --error-on-warnings apps/dashboard && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/assistant/assistant-history.tsx "apps/dashboard/app/(app)/assistant/page.tsx" "apps/dashboard/app/(app)/assistant/page.test.tsx"
git commit -m "refactor(assistant): build the conversations panel on the shared frame"
```

---

### Task 4: The documentation nav tree

The chevron disclosure that replaces the native `<details>` marker, plus its i18n keys.

**Files:**
- Create: `apps/dashboard/components/docs/docs-nav.tsx`
- Create: `apps/dashboard/components/docs/docs-nav.test.tsx`
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`

**Interfaces:**
- Consumes: `InnerSidebar`, `InnerSidebarPinnedActions`, `InnerSidebarExpandButton` (Task 2); `DOCS_NAV_COOKIE`, `initialInnerSidebarOpen`, `persistInnerSidebarOpen` (Task 1).
- Produces:
  - `interface DocsNavPage { slug: string; title: string }`
  - `interface DocsNavSection { section: string; label: string; pages: DocsNavPage[] }`
  - `DocsNav(props: { sections: DocsNavSection[] })`
  - `DocsNavPanel(props: { sections: DocsNavSection[]; children: ReactNode })`

- [ ] **Step 1: Add the i18n keys**

In `packages/i18n/messages/en.json`, inside `dashboard.docs`, add a `nav` object beside the existing `index` and `sections` objects:

```json
    "nav": {
      "label": "Guide navigation",
      "collapse": "Hide guide navigation",
      "expand": "Show guide navigation"
    },
```

Mirror it into the other four files at the same path (`dashboard.docs.nav`), using the Write/Edit tools, never a shell rewrite:

| Locale | label | collapse | expand |
|---|---|---|---|
| `sv` | Guidenavigering | Dölj guidenavigering | Visa guidenavigering |
| `nb` | Guidenavigasjon | Skjul guidenavigasjon | Vis guidenavigasjon |
| `da` | Guidenavigation | Skjul guidenavigation | Vis guidenavigation |
| `fi` | Oppaiden navigointi | Piilota oppaiden navigointi | Näytä oppaiden navigointi |

These four are machine-drafted; flag them for native review in the final summary.

- [ ] **Step 2: Verify parity and that no mojibake was introduced**

Run: `cd packages/i18n && bun run test`
Expected: PASS, the parity test finds identical key sets.

Run: `grep -n "Ã\|â€" packages/i18n/messages/sv.json packages/i18n/messages/fi.json packages/i18n/messages/da.json packages/i18n/messages/nb.json`
Expected: no output. Any hit means a shell tool double-encoded the file; revert and redo the edit with the Write tool.

- [ ] **Step 3: Write the failing test**

Create `apps/dashboard/components/docs/docs-nav.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/docs/roles-register" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { DocsNav, type DocsNavSection } from "@/components/docs/docs-nav"

const SECTIONS: DocsNavSection[] = [
  {
    section: "getting-started",
    label: "Getting started",
    pages: [
      { slug: "introduction", title: "Introduction" },
      { slug: "key-concepts", title: "Key concepts" },
    ],
  },
  {
    section: "roles",
    label: "Roles",
    pages: [
      { slug: "roles-register", title: "The roles register" },
      { slug: "role-families", title: "Role families" },
    ],
  },
]

function renderNav() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DocsNav sections={SECTIONS} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  pathState.current = "/docs/roles-register"
  cleanup()
})

describe("DocsNav", () => {
  it("opens the section holding the current page and leaves the others closed", () => {
    renderNav()
    expect(
      screen.getByRole("button", { name: "Roles" }).getAttribute("aria-expanded")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Getting started" })
        .getAttribute("aria-expanded")
    ).toBe("false")
    expect(screen.getByRole("link", { name: "The roles register" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Introduction" })).toBeNull()
  })

  it("marks the current page", () => {
    renderNav()
    expect(
      screen
        .getByRole("link", { name: "The roles register" })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: "Role families" }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("lets the reader open another section", () => {
    renderNav()
    screen.getByRole("button", { name: "Getting started" }).click()
    expect(screen.getByRole("link", { name: "Introduction" })).toBeTruthy()
  })

  // The whole reason the nav lives in a layout: today's <details
  // open={isCurrent}> recomputes on every page load, so a section the reader
  // opened themselves snaps shut on their next click. The component does not
  // remount between guides, so its override must outlive a path change.
  it("keeps a reader-opened section open across a navigation", () => {
    const { rerender } = renderNav()
    screen.getByRole("button", { name: "Getting started" }).click()
    expect(screen.getByRole("link", { name: "Introduction" })).toBeTruthy()

    pathState.current = "/docs/role-families"
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DocsNav sections={SECTIONS} />
      </NextIntlClientProvider>
    )

    expect(screen.getByRole("link", { name: "Introduction" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Role families" }).getAttribute("aria-current")
    ).toBe("page")
  })

  it("renders no section as current on the index route", () => {
    pathState.current = "/docs"
    renderNav()
    for (const label of ["Getting started", "Roles"]) {
      expect(
        screen.getByRole("button", { name: label }).getAttribute("aria-expanded")
      ).toBe("false")
    }
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- docs-nav`
Expected: FAIL, cannot resolve `@/components/docs/docs-nav`.

- [ ] **Step 5: Write the implementation**

Create `apps/dashboard/components/docs/docs-nav.tsx`:

```tsx
"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import {
  InnerSidebar,
  InnerSidebarExpandButton,
  InnerSidebarPinnedActions,
} from "@/components/inner-sidebar"
import {
  DOCS_NAV_COOKIE,
  initialInnerSidebarOpen,
  persistInnerSidebarOpen,
} from "@/lib/inner-sidebar-state"
import { SPRING } from "@/lib/motion"

export interface DocsNavPage {
  slug: string
  title: string
}

export interface DocsNavSection {
  section: string
  label: string
  pages: DocsNavPage[]
}

const DOCS_PREFIX = "/docs/"

// The guide navigation's section tree. Replaces the native
// <details>/<summary> this surface used to use: that shipped the browser's own
// disclosure triangle, which no amount of styling makes match the app, and it
// could not animate. A chevron rotating 90 degrees is the app's one disclosure
// idiom (see accordion-section.tsx), so both surfaces read the same.
//
// Muted rather than brand: brand is for links, CTAs, judgement values and data
// viz, and twelve rose chevrons stacked in a nav column shout over the page.
export function DocsNav({ sections }: { sections: DocsNavSection[] }) {
  const pathname = usePathname()
  const currentSlug = pathname.startsWith(DOCS_PREFIX)
    ? pathname.slice(DOCS_PREFIX.length)
    : ""
  const currentSection = sections.find((section) =>
    section.pages.some((page) => page.slug === currentSlug)
  )?.section
  // Sections the reader opened or closed by hand, overriding the
  // current-section default. This state is why the nav lives in a layout: it
  // has to outlive a navigation between guides, and a per-page render would
  // reset it on every click.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  return (
    <ul className="space-y-0.5">
      {sections.map((section) => {
        const open = overrides[section.section] ?? section.section === currentSection
        return (
          <li key={section.section}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() =>
                setOverrides((previous) => ({
                  ...previous,
                  [section.section]: !open,
                }))
              }
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-medium text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                  open && "rotate-90"
                )}
              />
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key="pages"
                  // Carries ONLY geometry, never padding or a border
                  // (docs/ui-animation.md #2): a border-box element with
                  // padding never reaches a true height of 0, so the collapse
                  // would stall and the unmount would jump.
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={SPRING}
                  className="overflow-hidden"
                >
                  <ul className="mt-1 ml-4 space-y-0.5 border-border border-l pl-3">
                    {section.pages.map((page) => {
                      const isCurrent = page.slug === currentSlug
                      return (
                        <li key={page.slug}>
                          <Link
                            href={`/docs/${page.slug}`}
                            aria-current={isCurrent ? "page" : undefined}
                            className={cn(
                              "block rounded-md px-2 py-1 text-sm",
                              isCurrent
                                ? "font-medium text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {page.title}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ul>
  )
}

// The docs surface's frame: owns the sidebar's open state (the layout above it
// is a server component and cannot) and lays the nav out beside the guide.
// `children` is the server-rendered page, passed straight through as a slot.
export function DocsNavPanel({
  sections,
  children,
}: {
  sections: DocsNavSection[]
  children: ReactNode
}) {
  const t = useTranslations("dashboard.docs.nav")
  const [open, setOpen] = useState(() => initialInnerSidebarOpen(DOCS_NAV_COOKIE))

  function toggle(next: boolean) {
    setOpen(next)
    persistInnerSidebarOpen(DOCS_NAV_COOKIE, next)
  }

  return (
    <div className="flex w-full flex-1">
      <InnerSidebar
        open={open}
        label={t("label")}
        collapseLabel={t("collapse")}
        // The docs route is NOT height-locked: the page scrolls, so the column
        // pins itself instead of filling a locked parent.
        height="sticky"
        // Today's `hidden lg:block` treatment, preserved deliberately: a
        // permanent 280px column on a 375px viewport is worse than no column,
        // and small screens still reach every guide through the /docs index's
        // own "All guides" grid. A real mobile treatment is a sheet (what the
        // app sidebar itself does), not a narrower default here.
        className="hidden lg:flex"
        onCollapse={() => toggle(false)}
      >
        <DocsNav sections={sections} />
      </InnerSidebar>
      {/* relative: anchors the expand button while the nav is collapsed. */}
      <div className="relative min-w-0 flex-1">
        {!open && (
          // Matched to the sidebar's own breakpoint: below lg there is no
          // sidebar to bring back, so the control would be dead.
          <InnerSidebarPinnedActions className="hidden lg:flex">
            <InnerSidebarExpandButton
              label={t("expand")}
              onExpand={() => toggle(true)}
            />
          </InnerSidebarPinnedActions>
        )}
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test -- docs-nav`
Expected: PASS, 5 tests.

- [ ] **Step 7: Lint and typecheck**

Run: `bunx biome check --error-on-warnings apps/dashboard/components/docs && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/components/docs/docs-nav.tsx apps/dashboard/components/docs/docs-nav.test.tsx packages/i18n/messages
git commit -m "feat(docs): give the guide navigation a chevron disclosure"
```

---

### Task 5: The shell learns the inner-sidebar route concept

`/docs` joins `/assistant` in the uncapped branch, so the nav column is not held away from the boundary by a centred cap. Height-locking stays assistant-only.

**Files:**
- Modify: `apps/dashboard/components/app-shell.tsx:48-101`
- Modify: `apps/dashboard/components/app-shell.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `shellLayoutClasses(pathname)` returning the same four-key shape as today (`sidebarInset`, `flexShell`, `containerMain`, `pageContent`).

- [ ] **Step 1: Write the failing test**

Append to the `describe("shellLayoutClasses", ...)` block in `apps/dashboard/components/app-shell.test.tsx`:

```tsx
  // The docs nav is an inner sidebar like the assistant's conversations
  // panel, so /docs drops the centred cap that would otherwise hold it away
  // from the boundary with the app sidebar. Unlike /assistant it is NOT
  // height-locked: the page keeps scrolling, and the nav pins itself. A lock
  // here would silently break DocsHashScroll, which reads window.scrollY.
  it("uncaps the docs routes without locking their height", () => {
    for (const path of ["/docs", "/docs/introduction", "/docs/what-is-pay-mapping"]) {
      const layout = shellLayoutClasses(path)
      const content = classList(layout.pageContent)
      expect(content).not.toContain(PAGE_MAX_W)
      expect(content).not.toContain(PAGE_WIDE_MAX_W)
      // Padding is NOT dropped: pageContent applies px-4 lg:px-6 on every
      // route, /work and /assistant included. Uncapped, not unpadded.
      expect(content).toContain("px-4")
      expect(content).toContain("lg:px-6")
      // No lock, and nothing below it may gain min-h-0: position:sticky
      // fails silently under an ancestor that clips.
      expect(layout.sidebarInset).toBe("")
      expect(content).not.toContain("min-h-0")
      expect(content).not.toContain("flex-1")
      expect(classList(layout.flexShell)).not.toContain("min-h-0")
      expect(classList(layout.containerMain)).not.toContain("min-h-0")
    }
  })

  // A bare startsWith("/docs") would swallow any future sibling route
  // beginning with those characters and silently uncap it.
  it("matches /docs as a segment, not as a prefix", () => {
    expect(classList(shellLayoutClasses("/docsomething").pageContent)).toContain(
      PAGE_MAX_W
    )
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- app-shell`
Expected: FAIL, `/docs` still carries `max-w-6xl`.

- [ ] **Step 3: Write the implementation**

In `apps/dashboard/components/app-shell.tsx`, inside `shellLayoutClasses`, add below the `assistantBounded` declaration:

```ts
  // The routes that carry an INNER SIDEBAR: a secondary nav column between
  // the app sidebar and the page content (the assistant's conversations
  // panel, the docs nav). They drop the centred cap so the column is not held
  // away from the boundary with the app sidebar by a width narrower than the
  // viewport; each page centers its own reading column in what remains.
  // Matched as an exact segment, never a bare startsWith, so a future sibling
  // route beginning with the same characters is not swallowed.
  //
  // Independent of the height lock: /assistant locks (a long thread must not
  // grow the page past the viewport), /docs does not (its nav pins itself and
  // the page keeps scrolling, which is what DocsHashScroll's window.scrollY
  // read depends on).
  const hasInnerSidebar =
    assistantBounded || pathname === "/docs" || pathname.startsWith("/docs/")
```

Then change the last line of the returned `pageContent` from:

```ts
      !heightLocked && (wide ? PAGE_WIDE_MAX_W : PAGE_MAX_W)
```

to:

```ts
      !(heightLocked || hasInnerSidebar) && (wide ? PAGE_WIDE_MAX_W : PAGE_MAX_W)
```

Update the comment directly above that line to name both routes rather than only `/assistant`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test -- app-shell`
Expected: PASS, including the pre-existing `/assistant`, `/work`, `/roles` and `/` cases unchanged.

- [ ] **Step 5: Lint and typecheck**

Run: `bunx biome check --error-on-warnings apps/dashboard/components/app-shell.tsx apps/dashboard/components/app-shell.test.tsx && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/app-shell.tsx apps/dashboard/components/app-shell.test.tsx
git commit -m "feat(dashboard): uncap the routes that carry an inner sidebar"
```

---

### Task 6: Mount the nav from a docs layout

The layout is what makes the nav appear on every docs route (the index included) and what lets section state survive a navigation.

**Files:**
- Create: `apps/dashboard/app/(app)/docs/layout.tsx`
- Modify: `apps/dashboard/app/(app)/docs/[slug]/page.tsx`
- Delete: `apps/dashboard/components/docs/docs-sidebar.tsx`

**Interfaces:**
- Consumes: `DocsNavPanel`, `DocsNavSection` (Task 4); `getDoc` from `@/lib/docs/docs`; `DOCS_NAV`, `SECTION_LABEL_KEYS` from `@/lib/docs/docs-nav`.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Create the layout**

Create `apps/dashboard/app/(app)/docs/layout.tsx`:

```tsx
import { getLocale, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { DocsNavPanel, type DocsNavSection } from "@/components/docs/docs-nav"
import { getDoc } from "@/lib/docs/docs"
import { DOCS_NAV, SECTION_LABEL_KEYS } from "@/lib/docs/docs-nav"

// The guide navigation lives in the LAYOUT, not in each page: a layout does
// not remount between guides, so a section the reader opened stays open on
// their next click. It also puts the nav on the index route, which the old
// per-page sidebar never reached.
//
// The tree is built here, on the server, and handed to the client component
// as plain serializable data (roughly fifty slugs and titles). That is what
// buys a real disclosure control without a client boundary around the
// filesystem reads: getDoc stays here, and only its result crosses.
export default async function DocsLayout({
  children,
}: {
  children: ReactNode
}) {
  const locale = await getLocale()
  const t = await getTranslations("dashboard.docs")
  const sections: DocsNavSection[] = await Promise.all(
    DOCS_NAV.map(async (section) => {
      const docs = await Promise.all(
        section.pages.map((slug) => getDoc(locale, slug))
      )
      return {
        section: section.section,
        label: t(SECTION_LABEL_KEYS[section.section]),
        pages: docs
          .filter((doc) => doc !== null)
          .map((doc) => ({ slug: doc.slug, title: doc.frontmatter.title })),
      }
    })
  )
  return <DocsNavPanel sections={sections}>{children}</DocsNavPanel>
}
```

- [ ] **Step 2: Strip the old sidebar out of the article page**

In `apps/dashboard/app/(app)/docs/[slug]/page.tsx`, remove the `DocsSidebar` import and replace the returned wrapper. The `flex gap-10` row and the `<DocsSidebar />` go away (the layout owns both now), and the article centres itself in the column beside the nav, the same move the assistant makes for its chat:

```tsx
  return (
    <article className="mx-auto min-w-0 max-w-3xl pb-16">
```

and drop the closing `</div>` that matched the removed wrapper.

- [ ] **Step 3: Delete the replaced sidebar**

```bash
git rm apps/dashboard/components/docs/docs-sidebar.tsx
```

- [ ] **Step 4: Verify nothing still references it**

Run: `grep -rn "DocsSidebar\|docs-sidebar" apps/dashboard --include="*.ts" --include="*.tsx"`
Expected: no output.

- [ ] **Step 5: Run the docs guards and the full suite**

Run: `cd apps/dashboard && bun run test -- docs`
Expected: PASS, all eleven guards in `lib/docs/docs-guards.test.ts` included. They read `lib/docs/docs-nav.ts` and the MDX files, neither of which this plan changes, so a failure here means something unintended moved.

Run: `bun run test && bunx biome check --error-on-warnings apps/dashboard && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "apps/dashboard/app/(app)/docs/layout.tsx" "apps/dashboard/app/(app)/docs/[slug]/page.tsx"
git commit -m "feat(docs): mount the guide navigation from a layout"
```

---

### Task 7: The docs nav stops collapsing and gains an index link

Added mid-implementation at Christian's direction, after Tasks 1-6 landed. Two changes to the same surface, so they ship together. The spec's two "Revision" sections are the authority.

**Files:**
- Modify: `apps/dashboard/components/inner-sidebar.tsx`
- Modify: `apps/dashboard/components/inner-sidebar.test.tsx`
- Modify: `apps/dashboard/components/docs/docs-nav.tsx`
- Modify: `apps/dashboard/components/docs/docs-nav.test.tsx`
- Modify: `apps/dashboard/lib/inner-sidebar-state.ts`
- Modify: `apps/dashboard/lib/inner-sidebar-state.test.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Consumes: everything Tasks 1-6 built.
- Produces: `InnerSidebar` with an optional, type-paired collapse contract; `DocsNavPanel` with no open state.

- [ ] **Step 1: Make the collapse control optional, and type-pair it**

In `apps/dashboard/components/inner-sidebar.tsx`, replace the `InnerSidebar` signature. A discriminated union rather than two independent optional props, so "a collapse control with no accessible name" is a compile error instead of a runtime gap:

```tsx
// Collapsing is opt-in, and its two halves travel together: a surface either
// takes both the handler and the label for the control's accessible name, or
// neither and renders no control at all. As two independent optional props a
// handler without a label would compile and ship an unnamed button.
type InnerSidebarCollapse =
  | { onCollapse: () => void; collapseLabel: string }
  | { onCollapse?: never; collapseLabel?: never }

export function InnerSidebar({
  open,
  label,
  height = "fill",
  actions,
  className,
  onCollapse,
  collapseLabel,
  children,
}: {
  open: boolean
  // Names the landmark for assistive technology.
  label: string
  height?: "fill" | "sticky"
  // The surface's own header content, left of the collapse control.
  actions?: ReactNode
  // Responsive visibility only (e.g. `hidden lg:flex`). Never box styles: the
  // outer element is the animated one, and a border or padding here would
  // survive the collapse (see the class invariant in the tests).
  className?: string
  children: ReactNode
} & InnerSidebarCollapse) {
```

Then make the header row conditional. A sidebar with nothing to put in that row renders no row, so its content starts at the top of the column rather than below an empty 40px strip:

```tsx
            {(actions !== undefined || onCollapse !== undefined) && (
              <div className="flex h-10 shrink-0 items-center justify-between gap-1 px-2">
                {/* An empty span keeps a lone collapse control right-aligned
                    without the row's justify-between changing per surface. */}
                {actions ?? <span />}
                {onCollapse !== undefined && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={collapseLabel}
                    onClick={onCollapse}
                  >
                    {/* The app's standard chevron, pointing the way the
                        sidebar folds. */}
                    <HugeiconsIcon
                      icon={ArrowLeft01Icon}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </Button>
                )}
              </div>
            )}
```

Leave `InnerSidebarPinnedActions` and `InnerSidebarExpandButton` exactly as they are: the assistant still uses both.

- [ ] **Step 2: Cover the new modes**

Append to the `describe("InnerSidebar", ...)` block in `apps/dashboard/components/inner-sidebar.test.tsx`:

```tsx
  it("renders no collapse control when the surface does not collapse", () => {
    render(
      <InnerSidebar open label="Guide navigation" actions={<span>top</span>}>
        <p>tree</p>
      </InnerSidebar>
    )
    expect(screen.getByText("top")).toBeTruthy()
    expect(screen.getByText("tree")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  // A surface with neither actions nor a collapse control would otherwise
  // render an empty 40px strip above its content.
  it("renders no header row when there is nothing to put in it", () => {
    render(
      <InnerSidebar open label="Guide navigation">
        <p>tree</p>
      </InnerSidebar>
    )
    const nav = screen.getByRole("navigation", { name: "Guide navigation" })
    expect(nav.querySelector(".h-10")).toBeNull()
    expect(screen.getByText("tree")).toBeTruthy()
  })
```

- [ ] **Step 3: Run the two new tests and confirm they fail first**

Run: `cd apps/dashboard && bun run test -- inner-sidebar.test`
Expected before Step 1: FAIL (a required prop is missing / a collapse button still renders). After Step 1: PASS, 10 tests.

- [ ] **Step 4: Simplify `DocsNavPanel` and give it the index link**

In `apps/dashboard/components/docs/docs-nav.tsx`, replace `DocsNavPanel` entirely:

```tsx
// The docs surface's frame: the nav column beside the guide. Unlike the
// assistant's conversations panel this one does NOT collapse. The guide nav is
// the only navigation a reading surface has, so hiding it buys a reader
// nothing: the article beside it is capped at max-w-3xl and would not use the
// reclaimed width. That also means no open state, no persistence and no
// expand affordance exist here.
//
// `children` is the server-rendered page, passed straight through as a slot.
export function DocsNavPanel({
  sections,
  children,
}: {
  sections: DocsNavSection[]
  children: ReactNode
}) {
  const t = useTranslations("dashboard.docs")
  const pathname = usePathname()
  const atIndex = pathname === "/docs"

  return (
    <div className="flex w-full flex-1">
      <InnerSidebar
        open
        label={t("nav.label")}
        // The docs route is NOT height-locked: the page scrolls, so the column
        // pins itself instead of filling a locked parent.
        height="sticky"
        // Today's `hidden lg:block` treatment, preserved deliberately: a
        // permanent 280px column on a 375px viewport is worse than no column,
        // and small screens still reach every guide through the /docs index's
        // own "All guides" grid. A real mobile treatment is a sheet (what the
        // app sidebar itself does), not a narrower default here.
        className="hidden lg:flex"
        // The way back to the top level from anywhere in the guide. It reuses
        // the index's own title rather than introducing a key, since that
        // string already names this destination in every locale.
        actions={
          <Link
            href="/docs"
            aria-current={atIndex ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 font-medium text-foreground text-sm hover:bg-accent hover:text-accent-foreground",
              atIndex && "bg-accent"
            )}
          >
            <span className="truncate">{t("index.title")}</span>
          </Link>
        }
      >
        <DocsNav sections={sections} />
      </InnerSidebar>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
```

Note what leaves with it: `useState`, the `relative` on the content column (nothing is pinned there any more), and the imports of `InnerSidebarPinnedActions`, `InnerSidebarExpandButton`, `DOCS_NAV_COOKIE`, `initialInnerSidebarOpen` and `persistInnerSidebarOpen`. `DocsNav` itself is untouched. Keep `cn`, `Link`, `usePathname` and `useTranslations`.

- [ ] **Step 5: Cover the index link**

Append to `apps/dashboard/components/docs/docs-nav.test.tsx`, adding `DocsNavPanel` to the existing import:

```tsx
describe("DocsNavPanel", () => {
  function renderPanel() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DocsNavPanel sections={SECTIONS}>
          <p>article</p>
        </DocsNavPanel>
      </NextIntlClientProvider>
    )
  }

  it("links back to the guide index and renders the page beside the nav", () => {
    renderPanel()
    const home = screen.getByRole("link", {
      name: messages.dashboard.docs.index.title,
    })
    expect(home.getAttribute("href")).toBe("/docs")
    expect(home.getAttribute("aria-current")).toBeNull()
    expect(screen.getByText("article")).toBeTruthy()
  })

  it("marks the index link as current on the index route", () => {
    pathState.current = "/docs"
    renderPanel()
    expect(
      screen
        .getByRole("link", { name: messages.dashboard.docs.index.title })
        .getAttribute("aria-current")
    ).toBe("page")
  })

  // The nav is the only navigation this surface has, so there is deliberately
  // no way to hide it.
  it("offers no way to collapse the nav", () => {
    renderPanel()
    expect(screen.queryByRole("button", { name: /hide|collapse/i })).toBeNull()
  })
})
```

- [ ] **Step 6: Delete the now-dead cookie constant**

In `apps/dashboard/lib/inner-sidebar-state.ts`, remove the `DOCS_NAV_COOKIE` export. The docs nav has no state to persist, so it is a dead constant, and this repo deletes dead constants in the change that orphans them. Keep the module keyed by name: the assistant still exercises the parameter.

In `apps/dashboard/lib/inner-sidebar-state.test.ts`, drop the `DOCS_NAV_COOKIE` import and retarget the two tests that used it. The name-keying is still exactly what they prove, so use a second literal rather than deleting them:

```ts
  // The reason the module is keyed by name at all: one cookie jar, one
  // reader's choice per panel, neither seeing the other's.
  it("keeps two panels' choices independent", () => {
    const jar = "assistant_history_state=false; other_panel_state=true"
    expect(innerSidebarOpenFromCookie(jar, ASSISTANT_HISTORY_COOKIE)).toBe(false)
    expect(innerSidebarOpenFromCookie(jar, "other_panel_state")).toBe(true)
  })

  it("is not confused by the app sidebar's own cookie", () => {
    expect(
      innerSidebarOpenFromCookie(
        "sidebar_state=false; assistant_history_state=false",
        ASSISTANT_HISTORY_COOKIE
      )
    ).toBe(false)
  })
```

- [ ] **Step 7: Delete the orphaned i18n keys**

Remove `collapse` and `expand` from `dashboard.docs.nav` in all five files (`en`, `sv`, `nb`, `da`, `fi`), keeping `label`. Use the Write/Edit tools, never a shell rewrite: shell rewriting double-encodes the non-ASCII strings elsewhere in those files into mojibake.

Then verify:

Run: `cd packages/i18n && bun run test`
Expected: PASS, parity holds with the reduced key set.

Run: `grep -rn "docs.nav.collapse\|docs.nav.expand\|nav\.expand\|nav\.collapse" apps packages --include="*.ts" --include="*.tsx" --include="*.json"`
Expected: no output.

Run: `grep -n "Ã\|â€" packages/i18n/messages/sv.json packages/i18n/messages/fi.json packages/i18n/messages/da.json packages/i18n/messages/nb.json`
Expected: no output. Any hit means a shell tool double-encoded a file; revert and redo with the Write tool.

- [ ] **Step 8: Full gate**

Run: `bun run test && bunx biome check --error-on-warnings . && bun run typecheck`
Expected: PASS. The assistant's own tests must still pass untouched: it keeps its collapse control, its cookie and its pinned expand button.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(docs): keep the guide nav always open with a link to the index"
```

---

### Task 8: Browser verification

The sticky column's geometry is a measurement, not something to reason about. The spec flags it as the one thing that must be checked in a real browser.

**Files:** none (verification only; any fix lands in the file it belongs to).

- [ ] **Step 1: Start the dev server**

Run: `cd apps/dashboard && bun run dev`

- [ ] **Step 2: Check the sticky nav on a long guide**

Open `/docs/what-is-pay-mapping` (one of the longest pages) and confirm:
- The nav's right border spans the full viewport height at every scroll position.
- The nav does not scroll away with the article, and its own list scrolls independently once it overflows.
- At scroll 0 the nav begins below the header; its overhang past the viewport bottom is not visible as a stray border or a second scrollbar.
- The inset card's rounded bottom corner is not crossed by the nav's border.

Check at a wide viewport and at an `md`-to-`lg` one (where `SidebarInset` has gained its `md:m-2` margin and `rounded-xl` corners but the nav is still hidden). Below `lg` the nav is deliberately absent, and the article should fill the column with no stray gutter left where the sidebar would be. Below `md` the inset card has no margin at all; confirm the article still has its padding there.

If the column does not stick at all, the cause is almost always an ancestor with `overflow: hidden`: confirm `shellLayoutClasses("/docs/...")` returned no `overflow-hidden` and no `min-h-0` (Task 5's test asserts exactly this).

- [ ] **Step 3: Check the docs nav's header and the assistant's collapse**

On `/docs/what-is-pay-mapping`:
- The nav's header row holds the "Documentation" link and nothing else. There is deliberately no collapse control anywhere on this surface.
- The link returns to `/docs`, and on that page it reads as the current location.
- The header row is not an empty strip: the link fills it and the section tree starts directly below.

On `/assistant` (which keeps its collapsible panel, and must be unaffected by Task 7):
- Collapse the panel. The content column widens smoothly, and no hairline border or gap remains where the panel was.
- The pinned expand button and the new-conversation button appear at the content column's top-left, and the expand button brings the panel back.
- Reload. The collapsed choice survives.

- [ ] **Step 4: Check the disclosure and deep links**

- Section chevrons rotate rather than showing a native triangle; open and close animate.
- Open a section other than the current one, click a guide in it, and confirm it stays open.
- Navigate into a section you have explicitly collapsed (use the index's "All guides" grid, or browser back/forward). It stays collapsed, hiding its own current-page link. Judge in the real UI whether that reads as broken or as the reader's choice being respected; it is the known trade-off of letting a manual toggle outrank the current-page default, and Task 4's review flagged it for exactly this check.
- Cold-load a deep link with an anchor, e.g. `/docs/glossary#level`, and confirm it lands on the heading (this is `DocsHashScroll`, which the sticky choice was made to preserve).
- Toggle reduced motion in the OS and confirm the disclosure and the assistant's collapse settle without animating.

- [ ] **Step 5: Check a non-English locale**

Switch the display language to Swedish and reload `/docs`. Confirm the section labels and the nav's accessible labels are translated and that no raw message key is visible. A raw key here usually means a stale dev-server bundle rather than a missing string: restart the dev server before investigating.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(docs): <what the browser pass found>"
```

Skip this step if the pass found nothing.

---

## Final review

- [ ] Run the full gate once more: `bun run test && bunx biome check --error-on-warnings . && bun run typecheck`
- [ ] Confirm the working tree holds only the intended files: `git status`
- [ ] Produce the file-by-file change summary the conventions require, grouped by area.
- [ ] Flag the four machine-drafted locale strings (`sv`, `nb`, `da`, `fi` under `dashboard.docs.nav`) for native review.
- [ ] Do not push. Present the diff for review first.
