import { ConvexError } from "convex/values"

// Machine-readable codes. The backend NEVER returns display text; the
// frontend maps these codes to i18n messages (errors.* keys live in the
// packages/i18n message files).
export const ERROR_CODES = {
  notAuthenticated: "errors.notAuthenticated",
  notAMember: "errors.notAMember",
  adminRequired: "errors.adminRequired",
  platformAdminRequired: "errors.platformAdminRequired",
  membershipConflict: "errors.membershipConflict",
  notFound: "errors.notFound",
  invalidInput: "errors.invalidInput",
  weightsUnbalanced: "errors.weightsUnbalanced",
  tooFewCriteria: "errors.tooFewCriteria",
  tooManyCriteria: "errors.tooManyCriteria",
  dimensionCapExceeded: "errors.dimensionCapExceeded",
  criterionAlreadySelected: "errors.criterionAlreadySelected",
  modelExists: "errors.modelExists",
  profileIncomplete: "errors.profileIncomplete",
  motivationRequired: "errors.motivationRequired",
  aiUnavailable: "errors.aiUnavailable",
  aiGenerationFailed: "errors.aiGenerationFailed",
  roleLocked: "errors.roleLocked",
  criterionLocked: "errors.criterionLocked",
  ratingsIncomplete: "errors.ratingsIncomplete",
  invalidTransition: "errors.invalidTransition",
  roleFamilyExists: "errors.roleFamilyExists",
  roleExists: "errors.roleExists",
  personRefExists: "errors.personRefExists",
  lastAdmin: "errors.lastAdmin",
  invalidSeniority: "errors.invalidSeniority",
  invalidEffectiveDate: "errors.invalidEffectiveDate",
  payMappingRunCompleted: "errors.payMappingRunCompleted",
  payMappingDocumentationRequired: "errors.payMappingDocumentationRequired",
  payMappingGateUnmet: "errors.payMappingGateUnmet",
  payMappingPreconditionsUnmet: "errors.payMappingPreconditionsUnmet",
  assistantBusy: "errors.assistantBusy",
  assistantRateLimited: "errors.assistantRateLimited",
  assistantInvalidMessage: "errors.assistantInvalidMessage",
  assistantPersonalData: "errors.assistantPersonalData",
  methodBlocked: "errors.methodBlocked",
  modelNotApproved: "errors.modelNotApproved",
  assessmentLocked: "errors.assessmentLocked",
  assessmentNotLocked: "errors.assessmentNotLocked",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function appError(code: ErrorCode): ConvexError<{ code: ErrorCode }> {
  return new ConvexError({ code })
}
