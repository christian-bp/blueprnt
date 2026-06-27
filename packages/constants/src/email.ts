// The transactional email templates blueprnt sends. Single source of truth for
// the template-key set: the email renderer's union, the Convex send/log
// validators, and the admin email-log UI filters all derive from this tuple, so
// adding a template is one edit here. Each send is tagged with its key via the
// Sweego campaignTags, which is what the admin log groups and filters on.
export const EMAIL_TEMPLATE_KEYS = [
  "invitation",
  "resetPassword",
  "welcome",
  "twoFactorCode",
  "changeEmailConfirm",
  "verifyEmail",
] as const

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number]
