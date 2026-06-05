import type { Transition } from "motion/react"

// Shared spring transition used across animated components.
// Mirror this config in any new motion component that needs a consistent feel.
export const SPRING: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.25,
}
