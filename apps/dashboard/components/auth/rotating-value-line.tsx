"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

// Brand value lines for the left auth panel. Numbered keys (not an array) keep
// next-intl access simple and type-checked.
const VALUE_KEYS = ["value1", "value2", "value3"] as const
const ROTATE_MS = 6000

// Opacity cross-fade only (no layout/scale animation, per docs/ui-animation.md).
// Under reduced motion it shows the first line and does not rotate. The min
// height reserves space so the panel never reflows as lines change.
export function RotatingValueLine() {
  const t = useTranslations("dashboard.auth.brand")
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % VALUE_KEYS.length)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [reduce])

  // index is always in [0, VALUE_KEYS.length); the modulo guarantees it.
  const key = VALUE_KEYS[
    index % VALUE_KEYS.length
  ] as (typeof VALUE_KEYS)[number]

  return (
    <div className="min-h-[3.5rem]">
      <AnimatePresence mode="wait">
        <motion.p
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="font-semibold text-2xl leading-snug"
        >
          {t(key)}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
