export interface OrgSummary {
  id: string
  name: string
}

// The active company is Better Auth's session.activeOrganizationId. Resolve the
// orgId the app should scope to: the active one when it is still a membership,
// else the first membership, else null (loading, or provisioned into none yet).
export function resolveActiveOrgId(
  activeId: string | null | undefined,
  orgs: OrgSummary[] | null | undefined
): string | null {
  if (activeId != null && orgs?.some((o) => o.id === activeId)) {
    return activeId
  }
  return orgs != null && orgs.length > 0 ? (orgs[0]?.id ?? null) : null
}
