"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CelebrationBurst } from "@/components/celebration-burst"
import { SOFT_BURST_DURATION_S } from "@/components/confetti-burst"
import { InnerNavHeading } from "@/components/inner-sidebar-nav"
import { NavCountBadge } from "@/components/nav-count-badge"
import { useOrganization } from "@/components/org-context"
import { SidebarFooterBlock } from "@/components/sidebar-footer-block"
import { useTodo } from "@/hooks/use-todo"
import { SPRING } from "@/lib/motion"
import {
  GROUP_COUNT_IS_QUANTITY,
  GROUP_ICONS,
  groupHref,
  type TodoGroup,
} from "@/lib/todo"

// The sidebar shows a glance, not the whole band: the front page's To do
// row remains the full list.
const MAX_ROWS = 2

// How long a finished row stays on screen wearing its celebration before it
// slides away: the soft burst's own play time plus a beat, derived from the
// burst so a tuning pass there can never cut the celebration short.
const CELEBRATION_HOLD_MS = SOFT_BURST_DURATION_S * 1000 + 200

// The staged exit every element here shares (docs/ui-animation.md #4): fade
// fast, then collapse the now-invisible box. Nothing visible can overflow a
// shrinking box that is already transparent, so no wrapper needs
// overflow-hidden, which matters because a clip on any ancestor would eat
// the confetti a celebrating row throws past its own edges.
const STAGED_EXIT_TRANSITION = {
  opacity: { duration: 0.1 },
  height: { ...SPRING, delay: 0.1 },
  marginBottom: { ...SPRING, delay: 0.1 },
  y: { duration: 0.1 },
}

// Every area sidebar's bottom block: the top outstanding to-do groups as
// compact rows, each linking to where that work is done. It reads the same
// buildTodo derivation as the front page's To do band (icons and hrefs
// included via lib/todo.ts), so the two can never disagree.
//
// The block slides up from the bottom edge when there is something to do and
// slides back down when the last item clears. A group that FINISHES is not
// dropped on the spot: its row stays for one beat wearing the same
// CelebrationBurst the front page's cards throw, and only then slides away.
// Finishing is "the group left buildTodo's output", never "the group left
// the two-row glance": a group pushed out by a higher-priority arrival has
// not been completed and gets no party.
export function TodoFooter() {
  const t = useTranslations("dashboard.overview")
  const locale = useLocale()
  const { orgId } = useOrganization()
  const todo = useTodo(orgId, locale)

  // Finished groups still on screen for their celebration, snapshotted at
  // their last live render (buildTodo no longer carries them).
  const [leaving, setLeaving] = useState<TodoGroup[]>([])
  // The previous settled to-do, to tell a finish apart from the first load
  // and from a glance reshuffle. Keyed by org so switching company never
  // celebrates the diff between two companies' lists.
  const prevRef = useRef<{
    orgId: string
    visible: TodoGroup[]
    keys: Set<TodoGroup["key"]>
  } | null>(null)

  useEffect(() => {
    if (todo === undefined) return
    const prev = prevRef.current
    const keys = new Set(todo.groups.map((group) => group.key))
    prevRef.current = {
      orgId,
      visible: todo.groups.slice(0, MAX_ROWS),
      keys,
    }
    if (prev === null || prev.orgId !== orgId) return
    const finished = prev.visible.filter((group) => !keys.has(group.key))
    if (finished.length === 0) return
    setLeaving((current) => [
      ...current,
      ...finished.filter(
        (group) => !current.some((held) => held.key === group.key)
      ),
    ])
  }, [todo, orgId])

  // Each celebrating row leaves after its hold. Re-armed per change; a
  // second finish landing mid-hold extends the first by a beat, which reads
  // fine and keeps this a single timer.
  useEffect(() => {
    if (leaving.length === 0) return
    const timer = setTimeout(() => {
      setLeaving((current) => current.slice(1))
    }, CELEBRATION_HOLD_MS)
    return () => clearTimeout(timer)
  }, [leaving])

  // Celebrating rows first (they were the top of the glance when they
  // finished), then the still-open groups.
  const rows = [
    ...leaving.map((group) => ({ group, finished: true })),
    ...(todo?.groups.slice(0, MAX_ROWS) ?? [])
      .filter((group) => !leaving.some((held) => held.key === group.key))
      .map((group) => ({ group, finished: false })),
  ]

  return (
    <AnimatePresence>
      {rows.length > 0 && (
        <motion.div
          key="todo-footer"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1, transition: SPRING }}
          exit={{ height: 0, opacity: 0, transition: STAGED_EXIT_TRANSITION }}
        >
          <motion.div
            initial={{ y: 16 }}
            animate={{ y: 0, transition: SPRING }}
            exit={{ y: 16, transition: STAGED_EXIT_TRANSITION }}
          >
            <SidebarFooterBlock>
              <InnerNavHeading>{t("sectionTodo")}</InnerNavHeading>
              {/* No gap on this column: an exiting row's share of the
                  spacing is its own animated marginBottom, so the gap
                  collapses with it (docs/ui-animation.md #3). */}
              <div className="flex flex-col px-2">
                <AnimatePresence initial={false}>
                  {rows.map(({ group, finished }) => (
                    <motion.div
                      key={group.key}
                      initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                      animate={{
                        height: "auto",
                        opacity: 1,
                        marginBottom: 2,
                        transition: SPRING,
                      }}
                      exit={{
                        height: 0,
                        opacity: 0,
                        marginBottom: 0,
                        transition: STAGED_EXIT_TRANSITION,
                      }}
                    >
                      <CelebrationBurst active={finished}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2.5 font-normal text-foreground"
                          nativeButton={false}
                          render={<Link href={groupHref(group)} />}
                        >
                          <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5">
                            <HugeiconsIcon
                              icon={GROUP_ICONS[group.key]}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="truncate">
                            {t(`todo.groups.${group.key}`)}
                          </span>
                          {/* Only quantity groups carry a count; a single
                              act's structural "1" is noise. A finished
                              row's badge counts down to nothing and springs
                              out while the burst plays. */}
                          {GROUP_COUNT_IS_QUANTITY[group.key] && (
                            <NavCountBadge
                              count={finished ? 0 : group.count}
                              label={t("todo.groupCount", {
                                count: finished ? 0 : group.count,
                              })}
                            />
                          )}
                        </Button>
                      </CelebrationBurst>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SidebarFooterBlock>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
