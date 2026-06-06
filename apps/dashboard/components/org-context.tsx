"use client"

import { createContext, type ReactNode, useContext } from "react"

// Provided by AppShell from the onboarding status query. role is the
// organization role ("admin" | "editor") used ONLY to hide admin-only
// affordances; the backend enforces permissions regardless.
export interface OrganizationInfo {
  orgId: string
  name: string
  role: string
}

const OrganizationContext = createContext<OrganizationInfo | null>(null)

export function OrganizationProvider(props: {
  value: OrganizationInfo
  children: ReactNode
}) {
  return (
    <OrganizationContext value={props.value}>
      {props.children}
    </OrganizationContext>
  )
}

export function useOrganization(): OrganizationInfo {
  const value = useContext(OrganizationContext)
  if (value === null) {
    throw new Error("useOrganization must be used inside OrganizationProvider")
  }
  return value
}
