"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { buildTodo, type Todo } from "@/lib/todo"

// Wires the front-page to-do: reads the two reactive queries the widget derives
// from and returns undefined until both have loaded (getMethodModel returns null
// when there is no model, which buildTodo treats as no criteria groups).
export function useTodo(orgId: string, locale: string): Todo | undefined {
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const method = useQuery(api.evaluationModel.method.getMethodModel, {
    orgId,
    locale,
  })
  if (roles === undefined || method === undefined) return undefined
  return buildTodo({ roles, method })
}
