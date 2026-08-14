# Source inventory

Work-assignment sheet for the in-app documentation project. One row per internal
document: its path, a one-line topic (from its own title, or a few words from
its opening when the title is opaque), and which docs section(s) it feeds.
Section keys: `getting-started`, `model`, `roles`, `evaluation`, `people`,
`pay-mapping`, `assistant`, `organization`, `account`, `security-privacy`,
`glossary`, `troubleshooting`, `background` (tone/scope only, no direct
section content). A document may feed several sections.

Excluded from this inventory: this file itself. The plan directory this task
belongs to, `docs/superpowers/plans/2026-08-13-in-app-docs/`, is not excluded:
it is listed below as a single directory row per the brief's counting rule
for plan subdirectories, with a note that it is this documentation project's
own plan rather than dossier source material.

## Root-level docs

| Path | Topic | Section(s) |
| --- | --- | --- |
| `CONTEXT-MAP.md` | Kontextkarta: the bounded-context map for the repo | glossary, background |
| `docs/PLAN-V1.md` | blueprnt: V1-plan (utkast) | background |
| `docs/README.md` | Dokumentationsguide: how decisions get written down | background |
| `docs/go-live-checklist.md` | Go-live checklist: things to remove/disable/harden before real customers | security-privacy, background |
| `docs/lonekartlaggning-process-och-kravbild.md` | Sa genomfors en lonekartlaggning: process och kravbild (research underlying the pay-mapping flow) | pay-mapping |
| `docs/pay-mapping-analysis-teardown-and-plan.md` | Pay-mapping analysis and reporting: competitor teardown and build plan | pay-mapping, background |
| `docs/ui-animation.md` | UI animation lessons (Motion): hard-won animation rules | background |

## ADRs (`docs/adr/`)

| Path | Topic | Section(s) |
| --- | --- | --- |
| `docs/adr/0001-convex-eu-better-auth.md` | Backend pa managed Convex (EU-region) med Better Auth for EU-baserad auth | security-privacy, account, organization, background |
| `docs/adr/0002-live-recompute-no-versioning.md` | V1: live-omrakning av poang/band utan modellversionering | model, evaluation |
| `docs/adr/0003-ai-embedded-assistant.md` | AI som inbaddad assistans, utanfor den deterministiska karnan | assistant, model |
| `docs/adr/0004-point-budget-weighting.md` | Viktning med poangbudget: synliga viktpoang 1 till 5 i ett nollsummespel | model |
| `docs/adr/0005-level-per-individual.md` | Niva per individ: roller bar track, inte niva | roles, people, model |
| `docs/adr/0006-aggregate-document-model.md` | Aggregat i dokument, entiteter i tabeller | background |
| `docs/adr/0007-legal-entity-reporting-dimension.md` | Juridisk enhet och land: en organisation per foretag, med organisationsvaljare | organization, pay-mapping |
| `docs/adr/0008-frozen-report-run-snapshot.md` | Frysta rapportkorningar kopierar betyg och modellkonfiguration, inte bara utfall | pay-mapping |
| `docs/adr/0009-platform-admin.md` | Plattformsadministrator: ett medvetet undantag fran org-scopningen | organization, security-privacy, background |
| `docs/adr/0010-import-format-expansion-csv-only.md` | Bredda importens tolkning av tal, datum och FTE, och begransa filinmatningen till CSV | people, pay-mapping |
| `docs/adr/0011-kartlaggning-livscykel-fryst-datalager.md` | Lonekartlaggningen ar en forstklassig livscykelentitet med ett fryst datalager | pay-mapping |
| `docs/adr/0012-primar-konslonegap-vy-och-prioritetsordning.md` | Konslonegapet ar kartlaggningens obligatoriska primarvy och P1 | pay-mapping |
| `docs/adr/0013-personidentitet-i-revisionsloggen.md` | Personidentitet diffas i revisionsloggen och pseudonymiseras vid radering | security-privacy, people |
| `docs/adr/0014-terminologi-niva-senioritet-steg.md` | Terminologi: Niva, Senioritet och Steg | model, roles, glossary |
| `docs/adr/0015-instegsvillkor-och-atgardslager.md` | Instegsvillkor for analysvyerna och atgardslagret | pay-mapping |
| `docs/adr/0016-helskarmsflode-eller-vanlig-layout.md` | Helskarmsflode eller vanlig layout (rule for which multi-step flows go full-screen) | background, pay-mapping, evaluation |
| `docs/adr/0017-jamforelsegrupp-utan-senioritet.md` | Jamforelsegruppen for lika arbete bildas utan senioritet | pay-mapping |
| `docs/adr/0018-assistent-som-chatt.md` | Assistenten far en chattyta (andrar ADR-0003:s "aldrig chatbot") | assistant |

## Specs (`docs/superpowers/specs/`)

| Path | Topic | Section(s) |
| --- | --- | --- |
| `docs/superpowers/specs/2026-06-04-convex-backend-better-auth-design.md` | Design: Convex backend + Better Auth (Fas 1 foundation) | account, organization, security-privacy, background |
| `docs/superpowers/specs/2026-06-04-onboarding-design.md` | Onboarding Design: First Login to Working Evaluation Model | getting-started |
| `docs/superpowers/specs/2026-06-05-evaluation-loop-design.md` | Evaluation Loop Design: Roles, Blind Rating, and Live Results | evaluation, roles |
| `docs/superpowers/specs/2026-06-06-conversational-onboarding-design.md` | Conversational Onboarding Design: One Question per Screen + Family Starters | getting-started |
| `docs/superpowers/specs/2026-06-06-point-budget-weighting-design.md` | Point-budget weighting: design | model |
| `docs/superpowers/specs/2026-06-06-role-families-design.md` | Role Families Design: Grouping Roles + Documentation Guide | roles |
| `docs/superpowers/specs/2026-06-10-ai-usage-tracking-design.md` | AI usage tracking: design | assistant, security-privacy |
| `docs/superpowers/specs/2026-06-12-roles-page-redesign-design.md` | Roles page redesign: grouped data table with search and filters | roles |
| `docs/superpowers/specs/2026-06-13-onboarding-role-scoring-design.md` | Onboarding role scoring, a slimmer role profile, and the bedomningsniva rename | getting-started, roles, evaluation |
| `docs/superpowers/specs/2026-06-15-band-role-overview-design.md` | Design: Band and role Overview (Work / Overview) | roles, model |
| `docs/superpowers/specs/2026-06-17-org-switcher-design.md` | Organisation switcher: switch-only company picker in the sidebar | organization |
| `docs/superpowers/specs/2026-06-17-work-section-header-nav-design.md` | Work section navigation: header tabs + demoted breadcrumb | background |
| `docs/superpowers/specs/2026-06-18-platform-admin-page-design.md` | Platform Admin page: design | organization, security-privacy |
| `docs/superpowers/specs/2026-06-18-role-result-contribution-breakdown-design.md` | Role result breakdown: contribution-forward design | roles, evaluation |
| `docs/superpowers/specs/2026-06-18-role-sheet-design.md` | RoleSheet: a reusable role quick-look panel | roles |
| `docs/superpowers/specs/2026-06-19-audit-before-after.md` | Audit log: full before/after capture + clear Sheet rendering | security-privacy, organization |
| `docs/superpowers/specs/2026-06-20-admin-audit-log-parity.md` | Platform admin audit log: parity with the org log | security-privacy, organization |
| `docs/superpowers/specs/2026-06-20-audit-api-ergonomics.md` | Audit-log API ergonomics: ctx-aware writer + typed payloads | background, security-privacy |
| `docs/superpowers/specs/2026-06-21-email-template-branding-design.md` | Design: blueprnt transactional email templates | account, organization |
| `docs/superpowers/specs/2026-06-22-forgot-password-design.md` | Design: user-facing forgot-password flow | account |
| `docs/superpowers/specs/2026-06-23-admin-membership-and-slug-design.md` | Design: member-side org management + auto-slug on org create | organization |
| `docs/superpowers/specs/2026-06-23-create-user-invite-and-org-design.md` | Design: platform create-user sends a welcome email and requires an organization | organization, account |
| `docs/superpowers/specs/2026-06-23-form-validation-design.md` | Design: standardize form validation on react-hook-form + zod + shadcn Form | background |
| `docs/superpowers/specs/2026-06-26-auth-onboarding-split-layout-design.md` | Shared split-screen layout for auth + onboarding | getting-started, account |
| `docs/superpowers/specs/2026-06-26-cra-hardening-design.md` | Security hardening batch (CRA gap analysis follow-up): design | security-privacy |
| `docs/superpowers/specs/2026-06-26-mandatory-2fa-design.md` | Mandatory two-factor authentication (2FA) | account, security-privacy |
| `docs/superpowers/specs/2026-06-27-account-settings-design.md` | Account Settings Implementation Design | account |
| `docs/superpowers/specs/2026-06-27-organization-settings-design.md` | Organization settings: design | organization |
| `docs/superpowers/specs/2026-06-29-anchor-role-control-design.md` | Anchor role as an action on the Evaluation card | roles, evaluation |
| `docs/superpowers/specs/2026-06-29-role-detail-page-redesign-design.md` | Role detail page redesign | roles |
| `docs/superpowers/specs/2026-06-29-role-page-evaluation-layout-design.md` | Role page: evaluation-first layout and a card actions menu | roles, evaluation |
| `docs/superpowers/specs/2026-06-29-role-pages-restructure-design.md` | Role and family page header restructure | roles |
| `docs/superpowers/specs/2026-06-30-job-profile-ai-fill-design.md` | Job profile: AI draft fills the edit form | roles, assistant |
| `docs/superpowers/specs/2026-07-01-model-compliance-evidence-design.md` | Model compliance evidence: criterion rationale, bias review, and the exportable metodbilaga | model, security-privacy |
| `docs/superpowers/specs/2026-07-02-criterion-compliance-ai-fill-design.md` | Criterion compliance AI fill | model, assistant |
| `docs/superpowers/specs/2026-07-02-crud-toasts-design.md` | CRUD success toasts across the dashboard | background |
| `docs/superpowers/specs/2026-07-02-dashboard-layout-enrichment-design.md` | Dashboard layout enrichment: two-column grid, side cards, and a chart | getting-started, background |
| `docs/superpowers/specs/2026-07-02-dashboard-todo-and-welcome-design.md` | Dashboard front page: welcome greeting + To do widget | getting-started |
| `docs/superpowers/specs/2026-07-02-standard-model-compliance-seed-design.md` | Standard model compliance seed: design | model |
| `docs/superpowers/specs/2026-07-03-import-robustness-catalog.md` | Import robustness catalog: @workspace/import CSV salary-import engine | people |
| `docs/superpowers/specs/2026-07-03-import-robustness-design.md` | Import robustness design: @workspace/import CSV salary-import engine | people |
| `docs/superpowers/specs/2026-07-03-v2-salary-import-design.md` | V2 Salary Import and Lonekartlaggning: Design Spec | people, pay-mapping |
| `docs/superpowers/specs/2026-07-04-v2-classification-design.md` | V2 Classification Flow: Design Spec | people, roles |
| `docs/superpowers/specs/2026-07-04-v2-plan-coverage-audit.md` | V2 Salary Import + Lonekartlaggning: Coverage Audit | background, people, pay-mapping |
| `docs/superpowers/specs/2026-07-11-import-fidelity-design.md` | Import fidelity: annual/monthly basis, full pay components, employment type | people |
| `docs/superpowers/specs/2026-07-11-person-pay-comparison-chart-design.md` | Person page: Pay compared with the role chart | people |
| `docs/superpowers/specs/2026-07-12-pay-mapping-snapshot-design.md` | Kartlaggning entity + frozen data-layer snapshot (M3, first slice) | pay-mapping |
| `docs/superpowers/specs/2026-07-12-role-track-change-design.md` | Change a role's track (IC / Lead / Manager), resetting affected people's levels | roles, people |
| `docs/superpowers/specs/2026-07-13-p1-gender-gap-view-design.md` | P1 gender-gap primary view (ADR-0012) | pay-mapping |
| `docs/superpowers/specs/2026-07-13-staged-survey-detail-design.md` | Staged survey detail: Overblick / Analysera / Rapport (P1 adjustment) | pay-mapping |
| `docs/superpowers/specs/2026-07-16-analysis-documentation-and-scatter-design.md` | Analysis documentation, completion gate, women-dominated comparison, and scatter | pay-mapping |
| `docs/superpowers/specs/2026-07-22-guided-pay-mapping-review-journey-design.md` | The guided kartlaggning journey (redesign of the run experience) | pay-mapping |
| `docs/superpowers/specs/2026-07-22-pay-mapping-summary-steady-state-design.md` | Takeover wizard + the summary as the Analysis tab | pay-mapping |
| `docs/superpowers/specs/2026-07-23-pay-mapping-preconditions-gate-design.md` | Pay-mapping preconditions gate + dashboard to-do integration | pay-mapping, getting-started |
| `docs/superpowers/specs/2026-07-24-overview-todo-and-widgets-design.md` | Overview redesign: todo section + data widgets | getting-started |
| `docs/superpowers/specs/2026-07-30-bulk-classify-design.md` | Bulk classify: select title groups and confirm them at once | people |
| `docs/superpowers/specs/2026-07-31-import-attachment-design.md` | Import upload step on the Attachment component | people |
| `docs/superpowers/specs/2026-08-01-in-app-ai-role-import-design.md` | In-app AI role import | roles, assistant |
| `docs/superpowers/specs/2026-08-01-role-import-review-register-design.md` | Role import review: organize against the whole register | roles |
| `docs/superpowers/specs/2026-08-10-help-text-tightening-design.md` | Help Text Tightening Design | background |
| `docs/superpowers/specs/2026-08-10-shadcn-vendor-update-design.md` | shadcn Vendor Update Design | background |
| `docs/superpowers/specs/2026-08-11-people-register-bulk-delete-design.md` | People register: row selection and bulk delete | people |
| `docs/superpowers/specs/2026-08-12-assistant-chatbot-design.md` | In-App Assistant (Chatbot) Design and Architecture Decision | assistant |
| `docs/superpowers/specs/2026-08-13-in-app-docs-design.md` | In-App Documentation and Assistant Grounding Design | background |

## Plans (`docs/superpowers/plans/`)

| Path | Topic | Section(s) |
| --- | --- | --- |
| `docs/superpowers/plans/2026-06-04-convex-backend-better-auth.md` | Convex Backend + Better Auth Foundation Implementation Plan | account, organization, background |
| `docs/superpowers/plans/2026-06-04-onboarding.md` | Onboarding Implementation Plan: First Login to Working Evaluation Model | getting-started |
| `docs/superpowers/plans/2026-06-05-evaluation-loop.md` | Evaluation Loop Implementation Plan: Roles, Blind Rating, and Live Results | evaluation, roles |
| `docs/superpowers/plans/2026-06-05-instant-language-preview.md` | Instant Language Preview Implementation Plan | background, account |
| `docs/superpowers/plans/2026-06-06-conversational-onboarding.md` | Conversational Onboarding Implementation Plan | getting-started |
| `docs/superpowers/plans/2026-06-06-point-budget-weighting.md` | Point-budget weighting: implementation plan | model |
| `docs/superpowers/plans/2026-06-06-role-families.md` | Role Families Implementation Plan: Grouping Roles + Documentation Guide | roles |
| `docs/superpowers/plans/2026-06-10-ai-usage-tracking.md` | AI Usage Tracking Implementation Plan | assistant, security-privacy |
| `docs/superpowers/plans/2026-06-12-roles-page-data-table.md` | Roles Page Grouped Data Table Implementation Plan | roles |
| `docs/superpowers/plans/2026-06-13-model-surface-clarity.md` | Model-surface clarity (bedomningsniva rename + criterion-editor levels + importance label) | model |
| `docs/superpowers/plans/2026-06-13-onboarding-role-scoring.md` | Opt-in Score your roles onboarding step + dashboard continue-scoring affordance | getting-started, roles |
| `docs/superpowers/plans/2026-06-13-slim-role-profile.md` | Slim the role profile (delete the seven structured fields) | roles |
| `docs/superpowers/plans/2026-06-15-band-role-overview.md` | Band and role Overview Implementation Plan | roles, model |
| `docs/superpowers/plans/2026-06-17-org-switcher.md` | Organisation switcher Implementation Plan | organization |
| `docs/superpowers/plans/2026-06-18-platform-admin-page.md` | Platform Admin Page Implementation Plan | organization, security-privacy |
| `docs/superpowers/plans/2026-06-18-role-result-contribution-breakdown.md` | Role result contribution breakdown Implementation Plan | roles, evaluation |
| `docs/superpowers/plans/2026-06-18-role-sheet.md` | RoleSheet Implementation Plan | roles |
| `docs/superpowers/plans/2026-06-21-email-template-branding.md` | blueprnt Email Template Branding Implementation Plan | account, organization |
| `docs/superpowers/plans/2026-06-22-forgot-password.md` | Forgot-Password Flow Implementation Plan | account |
| `docs/superpowers/plans/2026-06-23-create-user-invite-and-org.md` | Create-User: Welcome Email, Required Org, Named Sender, Implementation Plan | organization, account |
| `docs/superpowers/plans/2026-06-23-form-validation.md` | Form Validation Standardization Implementation Plan | background |
| `docs/superpowers/plans/2026-06-26-auth-onboarding-split-layout.md` | Shared Auth + Onboarding Split Layout Implementation Plan | getting-started, account |
| `docs/superpowers/plans/2026-06-26-cra-hardening.md` | Security Hardening Batch Implementation Plan | security-privacy |
| `docs/superpowers/plans/2026-06-26-mandatory-2fa.md` | Mandatory Two-Factor Authentication Implementation Plan | account, security-privacy |
| `docs/superpowers/plans/2026-06-27-account-settings-polish.md` | Account Settings Polish + Avatar Upload Plan | account |
| `docs/superpowers/plans/2026-06-27-account-settings.md` | Account Settings Implementation Plan | account |
| `docs/superpowers/plans/2026-06-27-organization-settings.md` | Organization Settings Implementation Plan | organization |
| `docs/superpowers/plans/2026-06-28-route-slugs.md` | Route slugs implementation plan | background |
| `docs/superpowers/plans/2026-06-29-anchor-role-control.md` | Anchor role as an action on the Evaluation card Implementation Plan | roles, evaluation |
| `docs/superpowers/plans/2026-06-29-role-detail-page-redesign.md` | Role detail page redesign Implementation Plan | roles |
| `docs/superpowers/plans/2026-06-29-role-page-evaluation-layout.md` | Role page evaluation-first layout and card actions menu, Implementation Plan | roles, evaluation |
| `docs/superpowers/plans/2026-06-29-role-pages-restructure.md` | Role and family page header restructure Implementation Plan | roles |
| `docs/superpowers/plans/2026-06-30-job-profile-ai-fill.md` | Job profile AI-fill Implementation Plan | roles, assistant |
| `docs/superpowers/plans/2026-07-01-model-compliance-evidence.md` | Model Compliance Evidence Implementation Plan | model, security-privacy |
| `docs/superpowers/plans/2026-07-02-criterion-compliance-ai-fill.md` | Criterion Compliance AI Fill Implementation Plan | model, assistant |
| `docs/superpowers/plans/2026-07-02-crud-toasts.md` | CRUD success toasts, Implementation Plan | background |
| `docs/superpowers/plans/2026-07-02-dashboard-layout-enrichment.md` | Dashboard layout enrichment, Implementation Plan | getting-started |
| `docs/superpowers/plans/2026-07-02-dashboard-todo-and-welcome.md` | Dashboard welcome greeting + To do widget, Implementation Plan | getting-started |
| `docs/superpowers/plans/2026-07-02-standard-model-compliance-seed.md` | Standard Model Compliance Seed Implementation Plan | model |
| `docs/superpowers/plans/2026-07-03-import-robustness-a-fixes.md` | Import Robustness Plan A: Pure Bug/Parity Fixes, Tokenizer Overhaul, Binary Guard | people |
| `docs/superpowers/plans/2026-07-03-import-robustness-b-formats.md` | Import Format Expansion (Plan B: number / date / FTE) Implementation Plan | people |
| `docs/superpowers/plans/2026-07-03-import-robustness-c-validate.md` | Import Robustness Plan C: Validate Codes, Gender-Flag Emission, i18n Labels, End-to-End Fixtures | people |
| `docs/superpowers/plans/2026-07-03-v2-import-action.md` | V2 Salary Import, Plan 3: the import action | people |
| `docs/superpowers/plans/2026-07-03-v2-import-engine.md` | V2 Salary Import, Plan 1: the import engine (@workspace/import) | people |
| `docs/superpowers/plans/2026-07-03-v2-import-wizard.md` | V2 Salary Import, Plan 4: the People page + import wizard UI | people |
| `docs/superpowers/plans/2026-07-03-v2-persistence.md` | V2 Salary Import, Plan 2: the people / pay persistence domain | people |
| `docs/superpowers/plans/2026-07-04-import-consumer-d-backend-correctness.md` | Import Consumer D: Backend Correctness Implementation Plan | people |
| `docs/superpowers/plans/2026-07-04-import-consumer-e-wizard.md` | Import wizard UX improvements (Plan E), Implementation Plan | people |
| `docs/superpowers/plans/2026-07-04-v2-classify-1-foundation-engines.md` | V2 Classification: Data Foundation + Pure Engines Implementation Plan | people, roles |
| `docs/superpowers/plans/2026-07-04-v2-classify-2-backend.md` | V2 Classification Backend (Suggestion Mutation + Queries) Implementation Plan | people, roles |
| `docs/superpowers/plans/2026-07-04-v2-classify-3-ui.md` | V2 Classification, Plan 3: the Classify surface + People-list enrichment | people, roles |
| `docs/superpowers/plans/2026-07-04-v2-classify-4-companions.md` | V2 Classification: Companion Completion Items Implementation Plan | people, roles |
| `docs/superpowers/plans/2026-07-11-import-fidelity.md` | Import Fidelity Implementation Plan | people |
| `docs/superpowers/plans/2026-07-11-person-pay-comparison-chart.md` | Person Pay-Comparison Chart Implementation Plan | people |
| `docs/superpowers/plans/2026-07-12-pay-mapping-snapshot.md` | Kartlaggning snapshot (M3 first slice) Implementation Plan | pay-mapping |
| `docs/superpowers/plans/2026-07-12-role-track-change.md` | Change a Role's Track Implementation Plan | roles, people |
| `docs/superpowers/plans/2026-07-13-p1-gender-gap-view.md` | P1 gender-gap primary view Implementation Plan | pay-mapping |
| `docs/superpowers/plans/2026-07-13-staged-survey-detail.md` | Staged survey detail (Overblick / Analysera / Rapport) Implementation Plan | pay-mapping |
| `docs/superpowers/plans/2026-07-16-analysis-documentation-and-scatter.md` | Analysis Documentation, Completion Gate, Women-Dominated Comparison, and Scatter Implementation Plan | pay-mapping |
| `docs/superpowers/plans/2026-07-22-guided-pay-mapping-review-journey.md` | Guided Kartlaggning Review Journey Implementation Plan | pay-mapping |
| `docs/superpowers/plans/2026-07-22-takeover-wizard-and-summary.md` | Takeover Wizard + Summary-as-Analysis Implementation Plan | pay-mapping |
| `docs/superpowers/plans/2026-07-24-overview-todo-and-widgets.md` | Overview redesign: todo section + data widgets, Implementation Plan | getting-started |
| `docs/superpowers/plans/2026-07-30-bulk-classify.md` | Bulk Classify Implementation Plan | people |
| `docs/superpowers/plans/2026-07-31-import-attachment.md` | Import Upload Step on Attachment Implementation Plan | people |
| `docs/superpowers/plans/2026-08-01-in-app-ai-role-import.md` | In-app AI Role Import Implementation Plan | roles, assistant |
| `docs/superpowers/plans/2026-08-06-iteration-2-analysis-views-rebuild.md` | Iteration 2: Pay-mapping analysis views rebuild, Implementation plan | pay-mapping |
| `docs/superpowers/plans/2026-08-06-iteration-2-c2-level-analysis.md` | Iteration 2, slice C2: per-level likvardigt analysis + closing gaps | pay-mapping |
| `docs/superpowers/plans/2026-08-06-iteration-3-analysis-ladder.md` | Iteration 3: the analysis ladder | pay-mapping |
| `docs/superpowers/plans/2026-08-07-iteration-4-analysis-chapters-as-pages.md` | Iteration 4: chapters as pages | pay-mapping |
| `docs/superpowers/plans/2026-08-11-people-register-bulk-delete.md` | People Register Bulk Delete Implementation Plan | people |
| `docs/superpowers/plans/2026-08-12-assistant-chatbot.md` | In-App Assistant (Chatbot) Implementation Plan | assistant |
| `docs/superpowers/plans/2026-08-12-assistant-iteration-2.md` | Blueprnt AI Iteration 2: Flow, Titles, History, Hero | assistant |
| `docs/superpowers/plans/2026-08-13-admin-ai-usage.md` | Admin: AI usage overview | assistant, security-privacy, organization |
| `docs/superpowers/plans/2026-08-13-in-app-docs/` | In-app documentation and assistant grounding implementation plan (directory, phase files 00-06; this documentation project's own plan, not dossier source material) | background |

## Domain glossaries and companion explainers (`docs/contexts/`)

| Path | Topic | Section(s) |
| --- | --- | --- |
| `docs/contexts/accounts/CONTEXT.md` | Konton (accounts): organizations, members, and permission roles glossary | glossary, account, organization |
| `docs/contexts/assessment/CONTEXT.md` | Vardering (assessment): roles and their evaluation against the model, glossary | glossary, evaluation, roles |
| `docs/contexts/evaluation-model/CONTEXT.md` | Varderingsmodellen (evaluation-model): the configurable job architecture and point model, glossary | glossary, model |
| `docs/contexts/evaluation-model/standardmall.md` | Standardmall, viktpoang och nivatrosklar (reference data for the standard model template) | model, glossary |
| `docs/contexts/evaluation-model/track-level-band.md` | Enkel forklaring av Track, Level och Band (companion explainer, terms renamed by ADR-0014) | model, glossary |
| `docs/contexts/evaluation-model/viktning-poangbudget.md` | Logik for viktning med poangbudget (companion explainer, canonical for ADR-0004) | model, glossary |

## Reports and review docs (`docs/reviews/`, `docs/superpowers/analysis/`)

| Path | Topic | Section(s) |
| --- | --- | --- |
| `docs/reviews/2026-07-10-full-app-audit.md` | Full-app audit, 2026-07-10 (26 scoped auditors against CLAUDE.md invariants + ADRs + glossaries) | background |
| `docs/superpowers/analysis/2026-07-01-v1-conformance-report.md` | blueprnt V1 Conformance Report (does the implementation follow PLAN-V1, ADRs, glossaries) | background |
| `docs/superpowers/analysis/2026-07-01-v2-readiness-report.md` | V2 Readiness Report: Salary Import + Connect-to-Roles + Pay-Gap Reporting | background, people, pay-mapping |

## Agent/tooling docs (`docs/agents/`)

These inform how agents work in this repo, not the product itself; they feed
tone/scope only.

| Path | Topic | Section(s) |
| --- | --- | --- |
| `docs/agents/domain.md` | Domain Docs: how skills should consume this repo's domain documentation | background |
| `docs/agents/issue-tracker.md` | Issue tracker: GitHub (conventions for issues and PRDs) | background |
| `docs/agents/triage-labels.md` | Triage Labels: mapping canonical triage roles to this repo's tracker labels | background |

## Verification (Step 3)

Row counts by category in this file: 18 ADRs, 64 specs, 74 plans (73 files
plus one directory row for `2026-08-13-in-app-docs/`, counted once per the
brief's rule for plan subdirectories; that directory is this documentation
project's own plan, not dossier source material), 6 glossaries/explainers,
6 root-level docs, 3 review/analysis reports, 3 agent/tooling docs, and 1 for
`CONTEXT-MAP.md`. Total: 175 rows.

`ls docs/adr/*.md docs/superpowers/specs/*.md docs/superpowers/plans/*.md | wc -l`
returns 155 (18 + 64 + 73; the glob only matches files, so it does not count
the plan subdirectory row). This file has 175 rows, which is at least that
many.
