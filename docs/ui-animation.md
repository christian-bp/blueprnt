# UI animation lessons (Motion)

Hard-won rules from real bugs in this repo (onboarding, 2026-06-05). Read this
before writing or reviewing any Motion (`motion/react`) animation. Each rule
states the symptom we shipped, the cause, and the fix.

## 1. Children of a `layout` container need scale correction

**Symptom:** closing the morph confirm made the button text look warped for a
split second while the pill shrank.

**Cause:** a parent `motion.div` with `layout` FLIP-animates its size with a
scale transform. Plain children inherit that scale raw, so text and icons
stretch and squash during the animation. `AnimatePresence mode="popLayout"`
does not protect exiting children from this; they are still DOM children of
the scaling parent.

**Rule:** every direct child of a layout-animated container that holds text or
icons gets `layout="position"` (or `layout`) so Motion counter-transforms it.
(`morph-confirm-button.tsx`.)

## 2. Height animations cannot beat the CSS box model

**Symptom:** removing a criterion collapsed slowly, then the page jumped at
the end.

**Cause:** the animated element carried `min-h-*`, `p-*`, and `border` with
border-box sizing. Animating `height: 0` clamps at min-height, and even at
`height: 0` a border-box element still renders padding + border tall. The
animation therefore never reached zero, and the unmount removed the remainder
instantly.

**Rule:** split the element. The outer motion element carries ONLY animated
geometry (height, margin, opacity) and no visual box styles; an inner div
carries border, padding, min-height, rounding, and the positioning context
for any absolutely anchored children. Then `height: 0` truly means zero and
the unmount is a no-op. (`criterion-item.tsx`.)

## 3. Container gaps do not collapse with exiting items

**Symptom:** after an item's height collapsed, a 12px gap remained until the
unmount.

**Cause:** `space-y-*`/`gap-*` live on the container and are not part of the
exiting item's animation.

**Rule:** when list items animate out, the inter-item spacing must be carried
by the item itself as animated `marginBottom` (at-rest value in `animate`,
`0` in `exit`), and the container drops `space-y`/`gap`.

## 4. Stage exits instead of fighting overflow

**Symptom candidates:** content visibly overflowing the shrinking box, or a
permanent `overflow-hidden` clipping the corner button that overlaps the row
edge.

**Cause:** a height collapse needs clipping, but permanent `overflow-hidden`
clips intentional overlaps (floating corner buttons, badges).

**Rule:** stage the exit: fade the whole item out fast (~120ms), then collapse
the now-invisible box with a slightly delayed spring. Nothing visible can
overflow, so no overflow trickery is needed and corner overlaps stay unclipped
at rest. Use per-property transitions via variants. (`criterion-item.tsx`.)

## 5. Reveal-on-hover elements have three visibility states

**Rule:** anything revealed by hover (`opacity-0 group-hover:opacity-100`)
must also be visible on keyboard focus (`focus-visible:`/`focus-within:`) and
must force visibility while armed or busy (the component appends
`opacity-100` itself). A control must never fade out mid-interaction.

## 6. Removed items that hold layout stall a sibling FLIP

**Symptom:** toggling "group by family" OFF in the Overview, the role chips
moved part of the way, paused, then continued; toggling it ON was fluid.
(`band-ladder.tsx` / `band-matrix.tsx`, 2026-06-15.)

**Cause:** the family labels are full-width rows in the same `AnimatePresence`
as the chips. With an `exit` fade, `AnimatePresence` keeps a removed label
mounted (still occupying its row) for the length of the fade. The chips'
`layout` FLIP therefore runs in two phases: first against the layout that
still includes the fading label, then again when the label finally unmounts
and its row collapses. Entering is single-phase because a freshly mounted
element reserves its space at once, so the siblings FLIP only once. That
enter/exit asymmetry is why grouping looked smooth but ungrouping stuttered.

**Rule:** when a layout change is driven by items being REMOVED and the
surviving items should reflow in one smooth pass, do not give the removed item
an `exit` that lets it linger in the flow. Either unmount it immediately (no
`exit`), or set `AnimatePresence mode="popLayout"` so the exiting item is
popped out of flow (position absolute) and the siblings reflow at once. The
trade-off of dropping `exit` is that the removed item disappears instantly
instead of fading; use `popLayout` when you need both the fade and the smooth
reflow, but check it does not disturb any shared-element (`layoutId`)
transitions in the same tree.

## Standing conventions

- The shared spring lives in `apps/dashboard/lib/motion.ts`; reuse it so
  everything moves with the same character.
- Onboarding screens use the staged-reveal pattern (ported from polyform):
  the heading animates word by word via `@workspace/ui/text-effect`
  (preset blur), the content below fades in once the heading completes
  (`ScreenShell` in `apps/dashboard/components/onboarding/`), and steps
  crossfade through `AnimatePresence mode="wait"` in the wizard. Content
  is mounted at opacity 0 from the start (no layout shift) with pointer
  events off until revealed.
- `MotionConfig reducedMotion="user"` wraps the app; never bypass it.
- The CLAUDE.md rules still govern: no layout shift from state reveals, and
  legitimate enter/leave transitions are animated, never instant.
