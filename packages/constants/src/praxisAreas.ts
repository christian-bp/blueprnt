// The lönebestämmelser and praxis review areas per DL 3 kap. 8 § p1.
// i18n labels live at dashboard.payMapping.review.praxis.<key>.*

export const PRAXIS_AREA_KEYS = [
  "payPolicy",
  "collectiveAgreements",
  "benefits",
  "payPractices",
  "previousActions",
] as const

export type PraxisAreaKey = (typeof PRAXIS_AREA_KEYS)[number]

// The areas every run reviews; previousActions applies only when the org
// has an earlier completed kartläggning.
export const BASE_PRAXIS_AREA_KEYS: readonly PraxisAreaKey[] =
  PRAXIS_AREA_KEYS.filter((key) => key !== "previousActions")
