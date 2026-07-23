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
// two-digit value in a bordered box with its unit label beneath.
function ClockUnit({
  value,
  label,
}: {
  value: MotionValue<string>
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="rounded-md border bg-muted/50 px-2.5 py-1.5 font-semibold text-2xl tabular-nums">
        <motion.span>{value}</motion.span>
      </div>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  )
}

// Content-shaped loading state, exported next to the component it mirrors so
// the two cannot drift: the digit-box frames, the colons between them, and
// the unit labels are static chrome and render real; only the digits and the
// sentence are bars (the inner h-6 + my-1 bar fills the text-2xl digit line
// exactly, so both states measure identical).
export function EqualityClockSkeleton() {
  const t = useTranslations("dashboard.payMapping.clock")
  const unit = (label: string) => (
    <div className="flex flex-col items-center gap-1">
      <div className="rounded-md border bg-muted/50 px-2.5 py-1.5 font-semibold text-2xl tabular-nums">
        {/* A transparent "00" sizes the bar from the same font metrics as
            the real digits, so the box is pixel-identical in both states. */}
        <Skeleton className="text-transparent">00</Skeleton>
      </div>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  )
  return (
    <div className="space-y-3">
      <div aria-hidden className="flex items-start gap-1.5">
        {unit(t("hours"))}
        <span className="py-1.5 font-semibold text-2xl text-muted-foreground">
          :
        </span>
        {unit(t("minutes"))}
        <span className="py-1.5 font-semibold text-2xl text-muted-foreground">
          :
        </span>
        {unit(t("seconds"))}
      </div>
      <div className="flex min-h-5 items-center">
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
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

  // The sentence names the direction only (the digit boxes carry the value,
  // per the graphs-speak-for-themselves feedback); the sr-only time keeps the
  // value available to assistive tech since the boxes are aria-hidden.
  const sentence =
    direction === "womenBehind"
      ? t("womenBehind")
      : direction === "menBehind"
        ? t("menBehind")
        : t("noGap")

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-1.5" aria-hidden>
        <ClockUnit value={hours} label={t("hours")} />
        <span className="py-1.5 font-semibold text-2xl text-muted-foreground">
          :
        </span>
        <ClockUnit value={minutes} label={t("minutes")} />
        <span className="py-1.5 font-semibold text-2xl text-muted-foreground">
          :
        </span>
        <ClockUnit value={secs} label={t("seconds")} />
      </div>
      <p className="text-muted-foreground text-sm">
        <span className="sr-only">{display} </span>
        {sentence}
      </p>
    </div>
  )
}
