"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { buildTodo, type Todo } from "@/lib/todo"

// Wires the front-page to-do: reads the four reactive queries the widget
// derives from and returns undefined until all have loaded (getMethodModel
// returns null when there is no model, which buildTodo treats as no criteria
// groups; listPeopleByTitle is the same query the classify surface reads, so
// the to-do and the tab badge can never disagree; listPayMappingRuns is the
// same query the pay-mappings list reads, so the startPayMapping group's
// "no open run" check never disagrees with that page either).
export function useTodo(orgId: string, locale: string): Todo | undefined {
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
  return buildTodo({ roles, method, peopleByTitle, payMappingRuns })
}
