"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { buildTodo, type BuildTodoInput, type Todo } from "@/lib/todo"

// Reads the four reactive queries both buildTodo and buildOverviewStats
// derive from, returning undefined until all have loaded (getMethodModel
// returns null when there is no model, which both derivations treat as no
// criteria groups; listPeopleByTitle is the same query the classify surface
// reads, so nothing here can ever disagree with the tab badge;
// listPayMappingRuns is the same query the pay-mappings list reads, so the
// "no open run" check never disagrees with that page either). Shared by
// useTodo and useOverviewStats so the query wiring exists once.
export function useTodoQueries(
  orgId: string,
  locale: string
): BuildTodoInput | undefined {
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const method = useQuery(api.evaluationModel.method.getMethodModel, {
    orgId,
    locale,
  })
  const peopleByTitle = useQuery(
    api.people.classificationQueries.listPeopleByTitle,
    { orgId }
  )
  const payMappingRuns = useQuery(api.payMapping.runs.listPayMappingRuns, {
    orgId,
  })
  if (
    roles === undefined ||
    method === undefined ||
    peopleByTitle === undefined ||
    payMappingRuns === undefined
  )
    return undefined
  return { roles, method, peopleByTitle, payMappingRuns }
}

// Wires the front-page to-do (the grouped accordion's V2 data source).
export function useTodo(orgId: string, locale: string): Todo | undefined {
  const input = useTodoQueries(orgId, locale)
  return input === undefined ? undefined : buildTodo(input)
}
