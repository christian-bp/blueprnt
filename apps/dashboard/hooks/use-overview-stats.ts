"use client"

import { buildOverviewStats, type OverviewStats } from "@/lib/todo"
import { useTodoQueries } from "@/hooks/use-todo"

// Wires the overview page's widget cards to the same four queries useTodo
// reads, so the two derivations can never disagree.
export function useOverviewStats(
  orgId: string,
  locale: string
): OverviewStats | undefined {
  const input = useTodoQueries(orgId, locale)
  return input === undefined ? undefined : buildOverviewStats(input)
}
