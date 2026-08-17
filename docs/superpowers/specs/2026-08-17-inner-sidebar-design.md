# Unified Inner Sidebar Design

**Date:** 2026-08-17
**Status:** Proposed
**Plan:** `docs/superpowers/plans/2026-08-17-inner-sidebar/` (written after spec approval)

## What was asked

1. Create one unified layout for surfaces that carry an "inner sidebar", a secondary
   navigation column between the app sidebar and the page content. Two surfaces have
   one today: the documentation pages and the assistant.
2. Decide its chrome: a bordered card that collapses (animated) into a button, the way
   the assistant's conversations panel collapses today, or a full-height column with a
   single border on its right.
3. Fix how the documentation navigation looks. The triangle glyph in front of each
   section is wrong. Model it on the shadcn "sidebar with collapsible submenus" example,
   but with a chevron rather than the plus/minus that example uses.

## Where the two surfaces stand today

| | `/docs/[slug]` | `/assistant` |
|---|---|---|
| Component | `components/docs/docs-sidebar.tsx` | `components/assistant/assistant-history.tsx` |
| Rendering | async server component, awaits doc titles off the filesystem | client component, Convex subscription |
| Width | `w-56` (224px) | `PANEL_WIDTH = 280` |
| Chrome | none | none |
| Collapse | none | animated width to 0, staged fade |
| Below `lg` | `hidden`, unreachable | unchanged, still collapsible |
| Shell treatment | inside the capped, padded page column | full-bleed and height-locked (`assistantBounded`) |
| Disclosure | native `<details>`/`<summary>` | n/a |

They share an intent and agree on nothing: width, chrome, collapse behaviour, and where
the shell puts them all differ.

### The triangles

The glyph in the screenshot is the browser's native `<summary>` disclosure marker.
`docs-sidebar.tsx` carries a comment justifying the choice: the sidebar is an async
server component awaiting content from the filesystem, so adopting a client Collapsible
would force a client boundary and push the nav's data through it "for a purely static
open/closed toggle".

The reasoning was sound; the cost it assumed is not real. The nav tree is roughly 50
slugs and titles. Building it on the server and passing the serialized tree to a small
client component costs a trivial payload and buys real disclosure behaviour.

## Decisions (settled with Christian, 2026-08-17)

| Decision | Choice | Rejected alternative |
|---|---|---|
| Chrome | Flush column, `border-r`, no radius, no fill | Bordered card. The app sidebar is `variant="inset"`, so the page already lives inside a rounded card; a second card nests card-in-card and stacks three edges within ~16px |
| Docs scrolling | Sticky nav, page keeps scrolling | Height-locking `/docs` the way `/assistant` is locked. Identical for both surfaces, but reworks `DocsHashScroll` (reads `window.scrollY`), `scroll-mt-24`, and cold-load `#anchor` jumps against a container scroller |
| Disclosure animation | Motion (`AnimatePresence` + height) | Vendor `Accordion` (ships `not-last:border-b`, `py-4`, `hover:underline`, all wrong for a nav row); vendored `Collapsible` (unused in this repo, no animation CSS wired, would need the same Motion work anyway) |
| Nav placement | `app/(app)/docs/layout.tsx` | Per-page. A layout does not remount between guides, so section open state survives navigation |
| Chevron colour | Muted | Brand. Twelve rose chevrons in a nav column is loud, and brand is reserved for links, CTAs, judgement values, and data viz |

## Architecture

### 1. `components/inner-sidebar.tsx` (new)

Lives at the components root, not in a surface folder: it is a reusable app primitive
in the sense the conventions define, like the morph family.

**Anatomy.** A flush column carrying `border-r`, no radius and no background of its own,
so the nav and the content beside it read as two regions of a single surface rather than
an object floating inside the inset card. A fixed header row (`h-10`) holding the
surface's own actions plus the collapse trigger, then a content region that scrolls on
its own (`min-h-0 flex-1 overflow-y-auto`).

**Height modes.** Two, because docs keeps page-level scrolling:

- `height="fill"`: the parent is height-locked and the column fills it. The assistant.
- `height="sticky"`: the page scrolls and the column pins itself to the viewport, so its
  border spans top to bottom at every scroll position. Docs.

**Collapse.** The animated geometry is lifted verbatim from `assistant-history.tsx`
rather than reinvented. That file is already the correct answer to three rules in
`docs/ui-animation.md`, and its own comments record why:

- The outer `motion.div` carries only `width` and `marginRight` and no box styles, so
  `width: 0` truly means zero (rule 2).
- The gap to the content column is the panel's own animated `marginRight`, never a flex
  `gap` on the row, because a container gap does not collapse with a shrinking item and
  would strand dead space at width 0 (rule 3).
- The exit is staged: the content fades over ~100ms, then the box collapses on a delayed
  spring, so the panel never visibly retracts text mid-fade (rule 4).
- The inner div carries the fixed width so text never rewraps mid-slide.

One change on top of that: `border-r` goes on the **inner** box. On the outer element it
would survive the collapse as a stranded hairline at width 0.

**Expand affordance.** The primitive also exports the pinned ghost icon button that the
content column renders while the sidebar is collapsed, so both surfaces place it
identically instead of each page hand-rolling its own floating stack. The default glyph
is a chevron; the assistant passes `HistoryIcon`, which names what comes back, and keeps
its second pinned action (New conversation) as today.

**State.** `open` plus `onOpenChange`, owned by the page. This is deliberate and carried
over: it is what keeps the panel, its own collapse button, and the expand button in the
content column from ever disagreeing.

**Persistence.** `lib/inner-sidebar-state.ts` (new) generalizes
`lib/assistant-history-state.ts` to take a cookie key, keeping the same idiom: read once
at mount, rewrite on every toggle, no cookie means open. `assistant_history_state` and a
new `docs_nav_state` are its two keys. `lib/assistant-history-state.ts` is deleted in
the same change, per "no legacy before launch".

### 2. `components/docs/docs-nav.tsx` (new, client)

The shadcn "collapsible submenus" anatomy: each section is a full-width trigger row with
a chevron at the start that rotates 90 degrees on open, and its pages sit in a
left-bordered list below with the active page marked.

The chevron is `ArrowRight01Icon` with `rotate-90` on the open state, the same glyph and
rotation `AccordionSection` already uses, so the app has one disclosure idiom rather than
two. Muted rather than brand, per the decision table.

Open and close animate with `AnimatePresence` plus height, following the
`criterion-item.tsx` idiom: the animated element carries only height and opacity with
`overflow-hidden`, never padding or borders (rule 2 again). `MotionConfig
reducedMotion="user"` at the app level covers reduced motion; nothing here bypasses it.

The component reads `usePathname()` for the current slug, so the layout above it needs no
params. The section containing the current page is open on first render.

### 3. `app/(app)/docs/layout.tsx` (new, server)

Builds the nav tree once from `DOCS_NAV` plus each page's frontmatter title, and renders
`InnerSidebar` wrapping `DocsNav` beside `{children}`. The tree it passes is plain
serializable data: `{ section, label, pages: [{ slug, title }] }[]`.

Because this is a layout rather than a per-page render, section state survives navigation
between guides. Today's `<details open={isCurrent}>` recomputes on every page load, so a
section the reader opened themselves snaps shut on their next click.

One consequence that is an improvement rather than scope creep: the nav now appears on
the `/docs` index too, which it does not today.

**Responsive behaviour is deliberately unchanged.** The nav keeps today's `hidden
lg:block` treatment, so below `lg` it is absent and its expand affordance is absent with
it. An always-present 280px column on a 375px viewport is worse than no column, and the
obvious alternative (default the sidebar collapsed below `lg`) needs a mount-time
viewport read inside a subtree that `layout.tsx` causes to be server-rendered, which is a
hydration mismatch rather than a one-line default. Readers on small screens keep reaching
guides through the `/docs` index's own "All guides" grid. Revisit with a proper mobile
treatment (a sheet, as the app sidebar itself uses) rather than by widening this change.

`components/docs/docs-sidebar.tsx` is deleted. `app/(app)/docs/[slug]/page.tsx` drops
its `<DocsSidebar>` and its `flex gap-10` wrapper and keeps only the article.

### 4. `components/app-shell.tsx`

`shellLayoutClasses` currently carries a bespoke `assistantBounded` branch. It gains one
concept covering both surfaces:

```
const hasInnerSidebar =
  pathname === "/assistant" ||
  pathname === "/docs" ||
  pathname.startsWith("/docs/")
```

The `/docs` prefix is matched as an exact segment, not a bare `startsWith("/docs")`,
which would also swallow any future sibling route beginning with those characters.

Routes with an inner sidebar drop `PAGE_MAX_W`, so the nav column is not held away from
the boundary by a centred cap narrower than the viewport. Each page then centres its own
reading column in what remains, which is what `/assistant` already does for its chat.

**They keep the shell's horizontal padding.** `pageContent` applies `px-4 lg:px-6`
unconditionally, on `/work` and `/assistant` too; only the max-width is conditional. So
"full-bleed" in this codebase means uncapped, not unpadded, and the assistant's panel
already sits one gutter in from the inset card's edge rather than truly flush. Docs
matches it exactly. Nothing needs to take over padding the shell stopped supplying,
because the shell never stops supplying it.

Height-locking stays assistant-only. `heightLocked` and `hasInnerSidebar` become two
independent flags rather than one.

The docs article centres its own reading column (`mx-auto max-w-3xl`) in the space beside
the nav, the same move the assistant makes for its chat. The gutter between the nav's
border and the article is the sidebar's own animated `marginRight`, so it collapses with
the panel instead of stranding dead space (rule 3).

## Scope boundaries

**No content changes.** Nothing under `content/docs/` is touched, so this change runs no
`bun run docs:sync`, no `bun run docs:eval`, and bumps no `CHUNKER_VERSION`. The eleven
guards in `lib/docs/docs-guards.test.ts` read `lib/docs/docs-nav.ts` and the MDX files;
neither changes shape, so all eleven keep passing unmodified.

**No assistant behaviour changes.** The thread list, its Convex subscriptions, the
busy-gating and the orphan guards around switching mid-stream move across untouched.
Only the panel's outer geometry is replaced. In particular `AssistantHistoryThreadList`
stays split out so its subscription still lives on its own mount lifetime.

**The index page does not change.** `/docs` joins the uncapped branch, but its content
already caps itself at `mx-auto max-w-4xl`, so it renders as it does today with the nav
now beside it.

**Out of scope.** The `/docs` index page's "All guides" grid becomes partly redundant
with an always-present nav. Leave it; revisit separately.

## Internationalization

New keys under `dashboard.docs.nav`: `label` (the `<nav aria-label>`, currently borrowing
`index.title`), `collapse`, `expand`. Added to `packages/i18n/messages/en.json` first,
then mirrored to sv, nb, da and fi. The non-English strings are machine-drafted and get
flagged for native review.

The assistant keeps `dashboard.assistant.history` and
`dashboard.assistant.newConversation` for its own header and pinned buttons.

The parity test in `packages/i18n` catches any locale missing a key.

## Testing

| File | Covers |
|---|---|
| `components/inner-sidebar.test.tsx` (new) | Header and content render; collapsing removes the content region from the tree rather than merely clipping it; the expand button appears with its accessible label; `border-r` is on the inner box and the outer animated element carries no box classes, the rule-2 invariant a future edit is most likely to break |
| `components/docs/docs-nav.test.tsx` (new) | The current page's section is open on first render; a section the reader opened stays open across a pathname change; the active page is marked; every section label resolves |
| `components/app-shell.test.tsx` (extend) | `shellLayoutClasses("/docs/...")` is uncapped and unpadded but not height-locked; `/assistant` keeps its lock. The function is already pure, so this stays a plain unit test |
| `app/(app)/assistant/page.test.tsx` (update) | The existing assertions, retargeted at the new frame |
| `packages/i18n` parity test | Automatic, no new test needed |

## Risks and verification

**The sticky measurement.** `SidebarProvider`'s wrapper is `min-h-svh` with no scroll
container, so the document body scrolls and `SiteHeader` (`h-(--header-height)`, not
sticky) scrolls away with it. The sticky column therefore pins at `top-0` and spans
`100svh` once stuck, while at scroll 0 it begins below the header. Whether that overhang
reads correctly, and how it interacts with the inset card's `md:m-2` margin and
`rounded-xl` corners, is a measurement rather than something to reason about. Verify in
the browser at both the mobile and `md+` breakpoints before calling the work done.

**Sticky and ancestor overflow.** `position: sticky` fails silently under an ancestor with
`overflow: hidden`. The docs branch of `shellLayoutClasses` must not pick up the
`overflow-hidden` that the height-locked branch applies.

## Files

**New:** `apps/dashboard/components/inner-sidebar.tsx`,
`apps/dashboard/components/inner-sidebar.test.tsx`,
`apps/dashboard/components/docs/docs-nav.tsx`,
`apps/dashboard/components/docs/docs-nav.test.tsx`,
`apps/dashboard/app/(app)/docs/layout.tsx`,
`apps/dashboard/lib/inner-sidebar-state.ts`

**Modified:** `apps/dashboard/components/assistant/assistant-history.tsx`,
`apps/dashboard/app/(app)/assistant/page.tsx`,
`apps/dashboard/app/(app)/assistant/page.test.tsx`,
`apps/dashboard/app/(app)/docs/[slug]/page.tsx`,
`apps/dashboard/components/app-shell.tsx`,
`apps/dashboard/components/app-shell.test.tsx`,
`packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Deleted:** `apps/dashboard/components/docs/docs-sidebar.tsx`,
`apps/dashboard/lib/assistant-history-state.ts`
