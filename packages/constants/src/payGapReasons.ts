// The objective-reason (sakligt skäl) taxonomy for documenting pay-gap
// groups in a kartläggning (M6). Fixed in V1 and aligned with the
// Diskrimineringsombudsmannen framework: market, individual, and work
// factors. i18n labels live at dashboard.payMapping.reasons.<key> and
// group headings at dashboard.payMapping.reasons.groups.<group>.
export const PAY_GAP_REASON_GROUPS = {
  market: ["alternativeLabourMarket", "recruitmentPayLevel"],
  individual: ["experience", "historicalPay", "competence", "performance"],
  work: ["responsibility"],
} as const

// Not exported: only this file's own derivations (PayGapReason,
// PAY_GAP_REASON_GROUP_KEYS below) use the group-key type by name; callers
// iterate PAY_GAP_REASON_GROUP_KEYS and get the type through inference.
type PayGapReasonGroup = keyof typeof PAY_GAP_REASON_GROUPS
export type PayGapReason =
  (typeof PAY_GAP_REASON_GROUPS)[PayGapReasonGroup][number]

export const PAY_GAP_REASON_GROUP_KEYS = Object.keys(
  PAY_GAP_REASON_GROUPS
) as readonly PayGapReasonGroup[]

export const PAY_GAP_REASONS: readonly PayGapReason[] = Object.values(
  PAY_GAP_REASON_GROUPS
).flat()
