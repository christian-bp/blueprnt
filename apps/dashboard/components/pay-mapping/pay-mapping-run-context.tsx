"use client"

import { createContext, type ReactNode, useContext } from "react"
import type {
  GroupAnalysis,
  PayMappingGapResult,
  PayMappingRunDetail,
} from "./pay-mapping-gap-types"

// The resolved run + its gender-gap aggregate and documentation rows,
// provided once by the run shell (mounted from the [slug] route layout) and
// shared by the Overview / Analysis / Report sub-pages. Keeping the queries
// in the persistent layout means switching sub-pages never re-issues them or
// flashes a skeleton; the pages stay thin and render their own loading
// shapes while a value is still undefined.
interface PayMappingRunContextValue {
  run: PayMappingRunDetail | undefined
  gap: PayMappingGapResult | undefined
  analyses: GroupAnalysis[] | undefined
}

const PayMappingRunContext = createContext<PayMappingRunContextValue | null>(
  null
)

export function PayMappingRunProvider({
  value,
  children,
}: {
  value: PayMappingRunContextValue
  children: ReactNode
}) {
  return (
    <PayMappingRunContext.Provider value={value}>
      {children}
    </PayMappingRunContext.Provider>
  )
}

export function usePayMappingRun(): PayMappingRunContextValue {
  const ctx = useContext(PayMappingRunContext)
  if (ctx === null) {
    throw new Error(
      "usePayMappingRun must be used inside PayMappingRunProvider"
    )
  }
  return ctx
}
