"use client"

import { type ReactNode, use } from "react"
import { PayMappingRunShell } from "@/components/pay-mapping/pay-mapping-run-shell"

// Thin route wrapper: the shell owns the run's shared chrome + data (the run
// and gap queries, the page header, not-found) and this layout persists
// across the Overview / Analysis / Report sub-pages, so switching the header
// tabs never re-fetches or flashes a skeleton.
export default function PayMappingRunLayout(props: {
  params: Promise<{ slug: string }>
  children: ReactNode
}) {
  const { slug } = use(props.params)
  return <PayMappingRunShell slug={slug}>{props.children}</PayMappingRunShell>
}
