"use client"

import type {
  TargetAndTransition,
  Transition,
  Variant,
  Variants,
} from "motion/react"
import { AnimatePresence, motion } from "motion/react"
import React from "react"
import { cn } from "@workspace/ui/lib/utils"

// Staggered text reveal (ported from the polyform monorepo): the text splits
// into words (or chars/lines) that animate in one after another. The full
// text stays available to assistive tech via an sr-only span while the
// animated segments are aria-hidden. First-party code, NOT shadcn vendor
// (hence it lives outside src/components and is linted and tested).
//
// The onboarding screens use preset="blur" per="word" on headings and gate
// their content on onAnimationComplete (see the dashboard's ScreenShell).

export type PresetType = "blur" | "fade-in-blur" | "scale" | "fade" | "slide"

export type PerType = "word" | "char" | "line"

export type TextEffectProps = {
  children: string
  per?: PerType
  as?: keyof React.JSX.IntrinsicElements
  variants?: {
    container?: Variants
    item?: Variants
  }
  className?: string
  preset?: PresetType
  // When set, the first case-insensitive occurrence of `highlight` in
  // `children` is rendered in the brand color. Case-insensitive because the
  // heading is usually run through capitalizeFirst before it reaches here
  // (e.g. "{name}'s model" -> "Acme's model"). The color is a static class on
  // the matching word span(s), orthogonal to the per-word reveal animation.
  highlight?: string
  delay?: number
  speedReveal?: number
  speedSegment?: number
  trigger?: boolean
  onAnimationComplete?: () => void
  onAnimationStart?: () => void
  segmentWrapperClassName?: string
  containerTransition?: Transition
  segmentTransition?: Transition
  style?: React.CSSProperties
}

const defaultStaggerTimes: Record<PerType, number> = {
  char: 0.03,
  word: 0.05,
  line: 0.1,
}

const defaultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
  exit: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
}

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
  },
  exit: { opacity: 0 },
}

const presetVariants: Record<
  PresetType,
  { container: Variants; item: Variants }
> = {
  blur: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: "blur(12px)" },
      visible: { opacity: 1, filter: "blur(0px)" },
      exit: { opacity: 0, filter: "blur(12px)" },
    },
  },
  "fade-in-blur": {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20, filter: "blur(12px)" },
      visible: { opacity: 1, y: 0, filter: "blur(0px)" },
      exit: { opacity: 0, y: 20, filter: "blur(12px)" },
    },
  },
  scale: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0 },
    },
  },
  fade: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
      },
      exit: { opacity: 0 },
    },
  },
  slide: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 },
    },
  },
}

const AnimationComponent: React.FC<{
  segment: string
  variants: Variants
  per: "line" | "word" | "char"
  segmentWrapperClassName?: string
  // A word segment that overlaps the highlight range gets the brand color.
  highlighted?: boolean
}> = React.memo(
  ({ segment, variants, per, segmentWrapperClassName, highlighted }) => {
    const content =
      per === "line" ? (
        <motion.span variants={variants} className="block">
          {segment}
        </motion.span>
      ) : per === "word" ? (
        <motion.span
          aria-hidden="true"
          variants={variants}
          className={cn(
            "inline-block whitespace-pre",
            highlighted && "text-brand"
          )}
        >
          {segment}
        </motion.span>
      ) : (
        <motion.span className="inline-block whitespace-pre">
          {segment.split("").map((char, charIndex) => (
            <motion.span
              key={`char-${charIndex.toString()}`}
              aria-hidden="true"
              variants={variants}
              className="inline-block whitespace-pre"
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      )

    if (!segmentWrapperClassName) {
      return content
    }

    const defaultWrapperClassName = per === "line" ? "block" : "inline-block"

    return (
      <span className={cn(defaultWrapperClassName, segmentWrapperClassName)}>
        {content}
      </span>
    )
  }
)

AnimationComponent.displayName = "AnimationComponent"

const splitText = (text: string, per: PerType) => {
  if (per === "line") return text.split("\n")
  return text.split(/(\s+)/)
}

const hasTransition = (
  variant?: Variant
): variant is TargetAndTransition & { transition?: Transition } => {
  if (!variant) return false
  return typeof variant === "object" && "transition" in variant
}

const createVariantsWithTransition = (
  baseVariants: Variants,
  transition?: Transition & { exit?: Transition }
): Variants => {
  if (!transition) return baseVariants

  const { exit: _, ...mainTransition } = transition

  return {
    ...baseVariants,
    visible: {
      ...baseVariants.visible,
      transition: {
        ...(hasTransition(baseVariants.visible)
          ? baseVariants.visible.transition
          : {}),
        ...mainTransition,
      },
    },
    exit: {
      ...baseVariants.exit,
      transition: {
        ...(hasTransition(baseVariants.exit)
          ? baseVariants.exit.transition
          : {}),
        ...mainTransition,
        staggerDirection: -1,
      },
    },
  }
}

export function TextEffect({
  children,
  per = "word",
  as = "p",
  variants,
  className,
  preset = "fade",
  highlight,
  delay = 0,
  speedReveal = 1,
  speedSegment = 1,
  trigger = true,
  onAnimationComplete,
  onAnimationStart,
  segmentWrapperClassName,
  containerTransition,
  segmentTransition,
  style,
}: TextEffectProps) {
  const segments = splitText(children, per)
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div

  // The [start, end) char range of the first case-insensitive occurrence of
  // `highlight` in `children`, or null when there is no highlight or no match.
  // A word segment whose own char range overlaps this gets the brand color.
  const highlightRange = (() => {
    if (!highlight) return null
    const matchStart = children.toLowerCase().indexOf(highlight.toLowerCase())
    if (matchStart === -1) return null
    return { start: matchStart, end: matchStart + highlight.length }
  })()

  // The cumulative char offset of each segment's start. For word/char modes
  // the segments (split on /(\s+)/) concatenate back to `children`, so the
  // offset is the running sum of prior segment lengths. A word segment whose
  // own [offset, offset + length) range overlaps highlightRange is brand-
  // colored. Line mode does not support highlight, so no offsets are needed.
  const segmentOffsets: number[] = []
  if (highlightRange && per !== "line") {
    let cursor = 0
    for (const segment of segments) {
      segmentOffsets.push(cursor)
      cursor += segment.length
    }
  }

  const baseVariants = preset
    ? presetVariants[preset]
    : { container: defaultContainerVariants, item: defaultItemVariants }

  const stagger = defaultStaggerTimes[per] / speedReveal

  const baseDuration = 0.3 / speedSegment

  const customStagger = hasTransition(variants?.container?.visible ?? {})
    ? (variants?.container?.visible as TargetAndTransition).transition
        ?.staggerChildren
    : undefined

  const customDelay = hasTransition(variants?.container?.visible ?? {})
    ? (variants?.container?.visible as TargetAndTransition).transition
        ?.delayChildren
    : undefined

  const computedVariants = {
    container: createVariantsWithTransition(
      variants?.container || baseVariants.container,
      {
        staggerChildren: customStagger ?? stagger,
        delayChildren: customDelay ?? delay,
        ...containerTransition,
        exit: {
          staggerChildren: customStagger ?? stagger,
          staggerDirection: -1,
        },
      }
    ),
    item: createVariantsWithTransition(variants?.item || baseVariants.item, {
      duration: baseDuration,
      ...segmentTransition,
    }),
  }

  return (
    <AnimatePresence mode="popLayout">
      {trigger && (
        <MotionTag
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={computedVariants.container}
          className={className}
          onAnimationComplete={onAnimationComplete}
          onAnimationStart={onAnimationStart}
          style={style}
        >
          {per !== "line" ? <span className="sr-only">{children}</span> : null}
          {segments.map((segment, index) => {
            // A word segment is highlighted when its own [start, end) char
            // range overlaps the highlight range (word-level overlap, so a
            // trailing possessive like "Inc's" rides along acceptably).
            const segStart = segmentOffsets[index] ?? 0
            const segEnd = segStart + segment.length
            const highlighted =
              highlightRange !== null &&
              segStart < highlightRange.end &&
              segEnd > highlightRange.start
            return (
              <AnimationComponent
                // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional fragments of a static string; duplicates (whitespace, repeated words) make the index the only stable discriminator
                key={`${per}-${index}-${segment}`}
                segment={segment}
                variants={computedVariants.item}
                per={per}
                segmentWrapperClassName={segmentWrapperClassName}
                highlighted={highlighted}
              />
            )
          })}
        </MotionTag>
      )}
    </AnimatePresence>
  )
}
