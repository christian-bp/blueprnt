"use client"

import { motion } from "motion/react"
import Link from "next/link"
import type { ReactNode } from "react"
import { SPRING } from "@/lib/motion"

// One header tab: the link styling, active state, and sliding-underline
// anatomy shared by the section tab bars (Work, People), so a tab with a
// count badge and one without can never drift apart. `underlineId` is the
// tab bar's own layoutId; it must be unique per bar so underlines never
// cross-animate between sections. `badge` is the optional notification slot
// (a NavCountBadge) rendered after the label.
export function HeaderTabLink({
  href,
  label,
  active,
  underlineId,
  badge,
}: {
  href: string
  label: string
  active: boolean
  underlineId: string
  badge?: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center px-2 font-medium text-sm transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {badge}
      {active && (
        <motion.span
          layoutId={underlineId}
          transition={SPRING}
          className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground"
        />
      )}
    </Link>
  )
}
