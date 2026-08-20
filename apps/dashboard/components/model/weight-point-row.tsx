"use client"

import { WEIGHT_POINT_VALUES } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { SPRING } from "@/lib/motion"
import {
  type MorphStackPlacement,
  morphStackPlacement,
} from "@/lib/morph-placement"

// The scale's own member type, so a step can index its meaning key without a
// cast: the engine owns which values exist.
type WeightPoint = (typeof WEIGHT_POINT_VALUES)[number]
type WeightMeaningKey = `weightMeaning${WeightPoint}`

// The meaning panel's own width (w-56 on the panel element) and the gap it
// keeps from the row, as numbers: the collision math needs them before the
// panel exists, so the side is settled before its first frame rather than
// corrected after it. The class and this figure must stay equal, or the panel
// is placed against a width it does not have.
const PANEL_WIDTH = 224
const PANEL_GAP = 8
// A conservative first estimate of the panel's height, used only for the
// above/below decision on the very first reveal; the real height is measured
// before paint and the decision recomputed. Over-estimating is the safe
// direction: it can only flip the panel below a step that would have fitted
// above, never leave it off screen.
const PANEL_HEIGHT_ESTIMATE = 96

// The one and only fill: every step the level reaches wears it, the chosen
// step included, and a previewed step wears the same. There is no second
// treatment anywhere in this control. Written as a whole class string rather
// than fragments because the outline variant's own hover repaint has to be
// answered: tailwind-merge keeps the last class in a group, so a fill that
// does not restate itself under `hover:` is repainted muted the moment the
// pointer lands on it, which is exactly when the preview has to be legible.
//
// The number takes --brand-edge, the dark step of the brand ink, not --brand
// itself: on this wash --brand measures 3.42:1 and the edge ink 6.35:1, and a
// step number is small text, which needs 4.5:1. Same reason --flag-critical
// and --flag-ok exist for the destructive and success tints.
const STEP_FILL =
  "border-brand/40 bg-brand/10 text-brand-edge hover:bg-brand/10 hover:text-brand-edge"

// EXPERIMENT B v3. The 1-5 weight allocation for one criterion: the ascending
// horizontal row the surface has always had, upgraded to read as a GAUGE as
// well as a scale. The only control anywhere for weight points (ADR-0004: 1-5
// points under a fixed budget, never a free percentage).
//
// A pure discrete gauge. Every step at or below the chosen one carries one
// soft brand tint and steps above stay neutral, so the row reads left to right
// as a level and the LAST FILLED step is the value. Nothing marks that step
// beyond the fill ending there: a marker on it would say the value is a
// different kind of thing from the level it ends, when it is only the end of
// it.
//
// The two encodings are therefore split, and both are required: the VISUAL one
// is the fill boundary, and the SEMANTIC one is aria-pressed on the chosen
// step alone. A reader arrowing through the group hears which single point is
// set, which a boundary between five identical buttons cannot tell them.
//
// Hovering or focusing a step PREVIEWS its click: the fill runs to that step
// instead of to the committed value, and retracts when the pointer or the
// focus leaves. The preview moves the boundary and nothing else, since there
// is nothing else to move.
//
// The same gesture slides THAT step's meaning out over the row, which is the
// per-step explanation the original row carried on each of its five buttons.
export function WeightPointRow({
  name,
  value,
  disabled,
  onChange,
}: {
  // The criterion this row weights; it names the group for assistive tech,
  // where a page holds one of these rows per criterion.
  name: string
  value: number
  // While the allocation is in flight: the row keeps its box and refuses input
  // rather than disappearing.
  disabled?: boolean
  onChange: (points: number) => void
}) {
  const t = useTranslations("dashboard.model.weighting")
  // Which step the pointer or the focus is on: the step whose meaning is
  // showing, and the step the fill is previewing. Hover AND focus, because an
  // explanation only a pointer can reach is not reachable at all for a
  // keyboard reader, and a preview only a pointer can see is not either.
  const [active, setActive] = useState<WeightPoint | null>(null)
  // How far the fill runs: to the previewed step while one is under the
  // pointer or the focus, to the committed value otherwise.
  const fillTo = active ?? value
  const meaningId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // The step the reveal is anchored to, captured when it opens: the panel is
  // centred on that step, not on the row.
  const stepRef = useRef<DOMRect | null>(null)
  // Where the meaning opens, and how far it has to slide sideways to stay on
  // screen. Resolved through the app's one collision authority
  // (lib/morph-placement.ts), never a second hand-rolled clamp.
  const [placement, setPlacement] = useState<MorphStackPlacement>({
    side: "top",
    shift: 0,
  })

  // Measured in a LAYOUT effect, so a panel that has to flip below is never
  // painted above first. The panel's own height is read once it exists; the
  // estimate above covers only the frame before that.
  useLayoutEffect(() => {
    const row = rowRef.current?.getBoundingClientRect()
    const step = stepRef.current
    if (active === null || row === undefined || step === null) return
    const measured = panelRef.current?.getBoundingClientRect().height
    setPlacement(
      morphStackPlacement({
        triggerLeft: step.left,
        triggerRight: step.right,
        triggerTop: row.top,
        triggerBottom: row.bottom,
        gap: PANEL_GAP,
        panelWidth: PANEL_WIDTH,
        panelHeight:
          measured !== undefined && measured > 0
            ? measured
            : PANEL_HEIGHT_ESTIMATE,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        // Above by preference: the row sits under the criterion's description,
        // so opening upward covers text the reader has already read rather
        // than the figures the row is about to change.
        preferred: "top",
      })
    )
  }, [active])

  // Opens a step's meaning, remembering the step's own box: the panel is
  // centred on it, and reading the rect here is reading it after layout.
  function reveal(option: WeightPoint, element: HTMLElement) {
    stepRef.current = element.getBoundingClientRect()
    setActive(option)
  }

  // Where the panel's left edge sits, in the row's own coordinates, for a
  // panel centred on the open step. Falls back to the row's own centre before
  // a step has been measured.
  function stepCentreOffset(): number {
    const row = rowRef.current?.getBoundingClientRect()
    const step = stepRef.current
    if (row === undefined) return 0
    const centre =
      step === null ? row.left + row.width / 2 : step.left + step.width / 2
    return centre - row.left - PANEL_WIDTH / 2
  }

  return (
    // The row is the hover region, the panel's positioning context AND its
    // dismiss wrapper, and it CONTAINS the panel: entering a step opens that
    // step's meaning and only leaving the row closes it, so the panel survives
    // both a slide from one step to the next and the pointer travelling into
    // the panel itself.
    //
    // max-w-xs (20rem) from the spacing scale, with w-full under it so the row
    // fills a narrow card and stops at 20rem in a wide one: five buttons
    // stretched across a full-width column read as five separate controls
    // rather than as one 1-5 scale. It stays at the card's left edge while the
    // card grows past it.
    <ButtonGroup
      ref={rowRef}
      aria-label={t("setWeightPoints", { name })}
      className="relative w-full max-w-xs"
      onMouseLeave={() => setActive(null)}
    >
      {WEIGHT_POINT_VALUES.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          // One variant across the five, so every step keeps an identical box
          // and the fill is the only difference between them. It also gives
          // every step a real border: the button base clips its background to
          // the padding box, so a step wearing the base's TRANSPARENT border
          // would paint 1px smaller than the bordered steps beside it.
          variant="outline"
          disabled={disabled}
          // The CHOSEN point, not every filled one, and the ONLY place the
          // chosen point is encoded outside the fill's boundary: the tint is
          // the level's picture, and a reader arrowing through five identical
          // buttons cannot hear where the picture ends.
          aria-pressed={value === option}
          // The step whose meaning is on screen is described by it, so a
          // screen reader gets the explanation with the step rather than as a
          // separate stop.
          aria-describedby={active === option ? meaningId : undefined}
          className={cn(
            "flex-1 px-0 tabular-nums",
            // The whole visual encoding, in one line: the committed level when
            // nothing is under the pointer, the previewed one when a step is.
            // No branch on `value` anywhere, because the chosen step is not
            // drawn differently from the steps under it.
            option <= fillTo && STEP_FILL
          )}
          onBlur={() => setActive(null)}
          onClick={() => onChange(option)}
          onFocus={(event) => reveal(option, event.currentTarget)}
          onMouseEnter={(event) => reveal(option, event.currentTarget)}
        >
          {option}
        </Button>
      ))}

      {/* Slides out beside the row and retracts on exit, the morph family's
          motion language. MotionConfig reducedMotion="user" is app-wide, so a
          reader who asked for less motion gets the panel without the slide;
          nothing here bypasses it. */}
      <AnimatePresence>
        {active !== null && (
          <motion.div
            key="meaning"
            ref={panelRef}
            id={meaningId}
            role="tooltip"
            // The slide MIRRORS with the side: it always enters from the row
            // it belongs to, so a panel that had to drop below slides down
            // rather than appearing to come from above it.
            initial={{ opacity: 0, y: placement.side === "top" ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: placement.side === "top" ? 8 : -8 }}
            transition={SPRING}
            // Stacked clear of the row on the chosen side, and centred on the
            // step in PIXELS relative to the row rather than with a centring
            // transform: Motion writes `transform` on this element for the
            // slide, and a transform utility here would make two authors of
            // one property. The horizontal figure carries the collision
            // module's correction with it.
            style={{
              ...(placement.side === "top"
                ? { bottom: "100%", marginBottom: PANEL_GAP }
                : { top: "100%", marginTop: PANEL_GAP }),
              left: stepCentreOffset() + placement.shift,
            }}
            // The panel IS the surface: one block box carrying the popover
            // background, the border, the padding and the width the collision
            // math was given. A span cannot be it, whatever classes it wears,
            // because an inline box ignores width, lets vertical padding
            // overflow instead of growing, and paints its background per line
            // fragment, which leaves the card's own text showing between the
            // strips. Opacity and a transform are all that animate here, so no
            // box style is caught in a height animation (ui-animation.md #2).
            //
            // No data-slot attribute: ButtonGroup joins its children by that
            // attribute, and a panel carrying one would flatten the last
            // step's corner and drop its left border.
            className="absolute z-30 w-56 rounded-lg border bg-popover p-3 text-muted-foreground text-sm shadow-md"
          >
            {t(`weightMeaning${active}` satisfies WeightMeaningKey)}
          </motion.div>
        )}
      </AnimatePresence>
    </ButtonGroup>
  )
}
