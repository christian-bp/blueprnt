"use client"

import {
  animate,
  motion,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { clockUnits, equalityClock } from "@/lib/equality-clock"

// One digit box of the clock (hours / minutes / seconds): the animated
// two-digit value in a bordered box. No unit label beneath: the boxes sit on
// a KPI tile beside single-figure stats, the colons already read the group
// as a time, and the sr-only line below carries the value in words anyway.
function ClockUnit({ value }: { value: MotionValue<string> }) {
  return (
    <div className="rounded-md border bg-muted/50 px-2 py-1 font-semibold text-2xl tabular-nums">
      <motion.span>{value}</motion.span>
    </div>
  )
}

const COLON_CLASS = "py-1 font-semibold text-2xl text-muted-foreground"

// Content-shaped loading state, exported next to the component it mirrors so
// the two cannot drift: the digit-box frames and the colons between them are
// static chrome and render real; only the digits are bars (the transparent
// "00" fills the text-2xl digit line exactly, so both states measure
// identical).
export function EqualityClockSkeleton() {
  const unit = (
    <div className="rounded-md border bg-muted/50 px-2 py-1 font-semibold text-2xl tabular-nums">
      {/* A transparent "00" sizes the bar from the same font metrics as the
          real digits, so the box is pixel-identical in both states. */}
      <Skeleton className="text-transparent">00</Skeleton>
    </div>
  )
  return (
    <div aria-hidden className="flex items-center gap-1.5">
      {unit}
      <span className={COLON_CLASS}>:</span>
      {unit}
      <span className={COLON_CLASS}>:</span>
      {unit}
    </div>
  )
}

// The "jämställdhetsklocka" digits + explaining sentence. The title/help
// chrome is the hosting widget's job, so this stays composable. The digit
// boxes are aria-hidden: the sentence carries the value in words for
// assistive tech, and it uses the pure helper's display string, so it is
// deterministic and testable without waiting on the animation.
export function EqualityClock({ gapPct }: { gapPct: number | null }) {
  const t = useTranslations("dashboard.payMapping.clock")
  const { seconds, direction, display } = equalityClock(gapPct)
  const reduce = useReducedMotion()

  // Count-up from 0 to the final seconds when motion is allowed; the digit
  // boxes derive from one animated value through the shared unit math.
  const count = useMotionValue(reduce ? seconds : 0)
  const hours = useTransform(count, (v) => clockUnits(v).hours)
  const minutes = useTransform(count, (v) => clockUnits(v).minutes)
  const secs = useTransform(count, (v) => clockUnits(v).seconds)
  useEffect(() => {
    if (reduce) {
      count.set(seconds)
      return
    }
    const controls = animate(count, seconds, { duration: 0.9, ease: "easeOut" })
    return () => controls.stop()
  }, [seconds, reduce, count])

  // The sr-only line carries the value in words, since the digit boxes are
  // aria-hidden. The DIRECTION is exported separately (equalityClockDirection
  // below) and rendered as the card's footer: without it the tile reads
  // identically for two organizations with mirrored gaps, which is the one
  // thing a KPI must never do.
  const sentence =
    direction === "womenBehind"
      ? t("womenBehind")
      : direction === "menBehind"
        ? t("menBehind")
        : t("noGap")

  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">
        {display} {sentence}
      </span>
      <div className="flex items-center gap-1.5" aria-hidden>
        <ClockUnit value={hours} />
        <span className={COLON_CLASS}>:</span>
        <ClockUnit value={minutes} />
        <span className={COLON_CLASS}>:</span>
        <ClockUnit value={secs} />
      </div>
    </div>
  )
}

// Which way the clock's reading goes, as a translation key under
// dashboard.payMapping.clock. The hosting card renders it as its footer, so
// the direction is visible and not only announced. The engine's own "none"
// maps to the noGap message key.
export function equalityClockDirection(
  gapPct: number | null
): "womenBehind" | "menBehind" | "noGap" {
  const { direction } = equalityClock(gapPct)
  return direction === "none" ? "noGap" : direction
}
