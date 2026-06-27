"use client"

import { TextEffect } from "@workspace/ui/text-effect"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

// Brand value lines for the centered brand panel. Each line reveals word by word
// with the same blur TextEffect the onboarding titles use; the outer
// AnimatePresence (mode="wait") fades the previous line out before the next
// reveals. Numbered keys (not an array) keep next-intl access type-checked.
// Under reduced motion it shows the first line and does not rotate. The min
// height reserves space so the centered block never reflows as lines change.
const VALUE_KEYS = ["value1", "value2", "value3"] as const
const ROTATE_MS = 6000

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

  const key = VALUE_KEYS[
    index % VALUE_KEYS.length
  ] as (typeof VALUE_KEYS)[number]

  return (
    <div className="flex min-h-[5.5rem] items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <TextEffect
            as="p"
            per="word"
            preset="blur"
            className="text-balance text-center font-semibold text-3xl leading-tight"
          >
            {t(key)}
          </TextEffect>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
