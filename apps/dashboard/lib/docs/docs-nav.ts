export interface DocsSection {
  section: keyof typeof SECTION_LABEL_KEYS
  pages: string[]
}

// Structure ONLY. Page titles live in each locale's frontmatter, section
// labels in dashboard.docs.sections.* (midday duplicates titles between
// frontmatter and nav; we deliberately do not).
export const DOCS_NAV: DocsSection[] = [
  {
    section: "getting-started",
    pages: [
      "introduction",
      "onboarding-guide",
      "key-concepts",
      "navigating-the-app",
    ],
  },
  {
    section: "model",
    pages: [
      "model-overview",
      "criteria-and-scale",
      "criteria-library",
      "weighting-and-point-budget",
      "ai-weighting-review",
      "method-documentation",
      "model-approval",
      "method-appendix-pdf",
    ],
  },
  {
    section: "roles",
    pages: [
      "roles-register",
      "role-families",
      "job-profiles",
      "ai-drafting",
      "importing-roles",
      "anchor-roles",
      "archiving-roles",
    ],
  },
  {
    section: "evaluation",
    pages: [
      "evaluating-a-role",
      "score-and-levels",
      "levels-and-zones",
      "adjusting-a-rating",
      "levels-views",
    ],
  },
  {
    section: "people",
    pages: [
      "people-register",
      "adding-people",
      "importing-people",
      "supported-payroll-exports",
      "classifying-people",
      "person-details-and-salary",
      "erasing-a-person",
    ],
  },
  {
    section: "pay-mapping",
    pages: [
      "what-is-pay-mapping",
      "starting-a-pay-mapping",
      "pay-mapping-overview",
      "collaboration",
      "rules-and-practice",
      "equal-work",
      "equivalent-work",
      "actions-and-notes",
      "run-lifecycle",
    ],
  },
  {
    section: "assistant",
    pages: [
      "using-the-assistant",
      "assistant-capabilities",
      "assistant-privacy",
    ],
  },
  {
    section: "organization",
    pages: ["organization-settings", "members-and-roles", "invitations"],
  },
  {
    section: "account",
    pages: [
      "profile-and-language",
      "two-factor-authentication",
      "changing-your-email",
      "deleting-your-account",
    ],
  },
  {
    section: "security-privacy",
    pages: [
      "data-residency",
      "audit-log",
      "how-ai-is-used",
      "gdpr-and-erasure",
    ],
  },
  {
    section: "glossary",
    pages: ["glossary"],
  },
  {
    section: "troubleshooting",
    pages: [
      "troubleshooting-sign-in-and-account",
      "troubleshooting-model-and-evaluation",
      "troubleshooting-people-and-import",
      "troubleshooting-pay-mapping",
    ],
  },
]

// Typed message key per section slug; keys are camelCase because message
// keys never contain hyphens. All 12 keys exist from Phase 2 so the corpus
// phase only touches pages.
export const SECTION_LABEL_KEYS = {
  "getting-started": "sections.gettingStarted",
  model: "sections.model",
  roles: "sections.roles",
  evaluation: "sections.evaluation",
  people: "sections.people",
  "pay-mapping": "sections.payMapping",
  assistant: "sections.assistant",
  organization: "sections.organization",
  account: "sections.account",
  "security-privacy": "sections.securityPrivacy",
  glossary: "sections.glossary",
  troubleshooting: "sections.troubleshooting",
} as const

export const POPULAR_DOCS: string[] = [
  "introduction",
  "onboarding-guide",
  "evaluating-a-role",
  "importing-people",
  "what-is-pay-mapping",
]

export function allDocSlugs(): string[] {
  return DOCS_NAV.flatMap((s) => s.pages)
}
