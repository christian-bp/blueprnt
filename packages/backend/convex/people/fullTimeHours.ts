import { defaultFullTimeHoursFor } from "@workspace/constants"
import type { QueryCtx } from "../_generated/server"

// The organization-level pay defaults every org-scaled read needs at once
// (the import's currency fallback, the freeze's hours, the salary queries).
export interface OrgPayDefaults {
  currency: string
  country: string | undefined
  fullTimeHoursPerMonth: number | undefined
}

// The full-time hours per month used to turn an hourly rate into a monthly
// figure: the person's own value, else the organization's default, else the
// country default. Always positive, so normalizedMonthlyBase never throws on
// a resolved value. ONE resolution rule for the salary queries, the freeze,
// the import preview and the assistant; none of them reads the fields
// directly.
export function resolveFullTimeHours(
  person: { fullTimeHoursPerMonth?: number },
  org: { fullTimeHoursPerMonth?: number; country?: string }
): { hoursPerMonth: number } {
  if (
    person.fullTimeHoursPerMonth !== undefined &&
    person.fullTimeHoursPerMonth > 0
  ) {
    return { hoursPerMonth: person.fullTimeHoursPerMonth }
  }
  if (
    org.fullTimeHoursPerMonth !== undefined &&
    org.fullTimeHoursPerMonth > 0
  ) {
    return { hoursPerMonth: org.fullTimeHoursPerMonth }
  }
  return { hoursPerMonth: defaultFullTimeHoursFor(org.country) }
}

// One read of the organization row. Callers that loop over people fetch
// this once outside the loop. "SEK" is the currency fallback the import has
// always used for an org without one set.
export async function readOrgPayDefaults(
  ctx: QueryCtx,
  orgId: string
): Promise<OrgPayDefaults> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  return {
    currency: org?.currency ?? "SEK",
    country: org?.country,
    fullTimeHoursPerMonth: org?.fullTimeHoursPerMonth,
  }
}
