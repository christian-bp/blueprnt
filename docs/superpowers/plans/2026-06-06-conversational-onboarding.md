# Conversational Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One question per screen with large option cards and an animated, jumpable dots indicator; a new final onboarding step that sets up rollfamiljer and roller pre-filled from an industry starter set.

**Architecture:** The wizard becomes a six-screen machine (name, language, country, industry, model, families) whose resume index derives from server state (org -> settings fields -> model) plus a session-local advance past the model review. Screens 2-4 save via the existing partial `updateOrganizationSettings`. A new backend module `assessment/starters.ts` serves localized industry starter content (display only) and creates the user-adjusted set in one transaction. Two reusable components land: `OnboardingDots` (Motion layout pill) and `OptionCard`.

**Tech Stack:** unchanged.

**Spec:** `docs/superpowers/specs/2026-06-06-conversational-onboarding-design.md`. Read it before starting.

**Branch:** all work on `feat/conversational-onboarding` (created from main). Lands later as ONE squash commit after founder approval; the branch is deleted right after the merge.

**Conventions for every task:**
- Biome style: no semicolons, double quotes, 2-space indent. English code/comments/filenames. Never an em dash anywhere.
- `bun run test`, never `bun test`. Conventional commits. Pre-commit hook must pass; never `--no-verify`.
- Backend returns error CODES only. i18n: en first, sv mirrored, nb/da/fi machine drafts (flagged in the commit message). All display text via i18n.
- Read `packages/backend/convex/_generated/ai/guidelines.md` before Convex work. `bun x convex codegen` from packages/backend is REQUIRED when a brand-new backend module is added (api.d.ts map); never run deploying convex commands except the final-sweep `convex dev --once`.
- Read `docs/ui-animation.md` before ANY Motion code (Task 3). `MotionConfig reducedMotion="user"` is global.
- Radix Select cannot be opened via fireEvent under happy-dom: tests drive the hidden native select inside a `<form>` wrapper, or assert through props/state seams (see family-picker.test.tsx for the established idiom).
- New code ships with tests in the same commit.

---

## Task 1: Industry starter sets (backend)

**Files:**
- Create: `packages/backend/convex/assessment/industryStarters.ts`
- Create: `packages/backend/convex/assessment/industryStarters.content.sv.ts`
- Create: `packages/backend/convex/assessment/industryStarters.content.en.ts`
- Create: `packages/backend/convex/assessment/starters.ts`
- Create: `packages/backend/convex/assessment/starters.test.ts`

- [x] **Step 1: Structure module** (create `industryStarters.ts`)

```ts
import type { TemplateLocale } from "../evaluationModel/standardTemplate"
import { industryStartersEn } from "./industryStarters.content.en"
import { industryStartersSv } from "./industryStarters.content.sv"

// Industry starter sets: per industry, role families with example roles
// (title + suggested track/level on the fixed schema). Pre-fills the
// onboarding families step; nothing is seeded until the user confirms.
// Prose lives in the per-locale content modules.

export const INDUSTRY_KEYS = [
  "publicSector",
  "manufacturing",
  "consulting",
  "retail",
  "itTelecom",
  "healthcare",
  "finance",
  "realEstateConstruction",
  "other",
] as const
export type IndustryKey = (typeof INDUSTRY_KEYS)[number]

export interface StarterRole {
  title: string
  trackKey: string
  levelKey: string
}

export interface StarterFamily {
  name: string
  roles: StarterRole[]
}

export type StarterContent = Record<IndustryKey, StarterFamily[]>

const INDUSTRY_KEY_SET = new Set<string>(INDUSTRY_KEYS)
export function clampIndustry(industry: string | undefined): IndustryKey {
  return industry !== undefined && INDUSTRY_KEY_SET.has(industry)
    ? (industry as IndustryKey)
    : "other"
}

export function starterContent(locale: TemplateLocale): StarterContent {
  return locale === "sv" ? industryStartersSv : industryStartersEn
}
```

- [x] **Step 2: Swedish content** (create `industryStarters.content.sv.ts`; full content, no placeholders)

```ts
import type { StarterContent } from "./industryStarters"

// Swedish starter sets. Titles are stored as written once the user confirms
// (user data, no read-time localization). Track/level keys reference the
// fixed schema (IC1..IC5, Lead1..Lead3, M1..M3).
export const industryStartersSv: StarterContent = {
  itTelecom: [
    {
      name: "Engineering",
      roles: [
        { title: "Junior systemutvecklare", trackKey: "IC", levelKey: "IC1" },
        { title: "Systemutvecklare", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior systemutvecklare", trackKey: "IC", levelKey: "IC3" },
        { title: "Tech Lead", trackKey: "Lead", levelKey: "Lead2" },
        { title: "Engineering Manager", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Produkt",
      roles: [
        { title: "Product Manager", trackKey: "IC", levelKey: "IC3" },
        { title: "Senior Product Manager", trackKey: "IC", levelKey: "IC4" },
      ],
    },
    {
      name: "Design",
      roles: [
        { title: "UX-designer", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior UX-designer", trackKey: "IC", levelKey: "IC3" },
      ],
    },
    {
      name: "Försäljning",
      roles: [
        { title: "Account Executive", trackKey: "IC", levelKey: "IC2" },
        { title: "Försäljningschef", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Kundsupport",
      roles: [
        { title: "Supportspecialist", trackKey: "IC", levelKey: "IC1" },
        { title: "Customer Success Manager", trackKey: "IC", levelKey: "IC2" },
      ],
    },
  ],
  consulting: [
    {
      name: "Konsultverksamhet",
      roles: [
        { title: "Junior konsult", trackKey: "IC", levelKey: "IC1" },
        { title: "Konsult", trackKey: "IC", levelKey: "IC2" },
        { title: "Seniorkonsult", trackKey: "IC", levelKey: "IC3" },
        { title: "Uppdragsledare", trackKey: "Lead", levelKey: "Lead2" },
        { title: "Affärsområdeschef", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Försäljning",
      roles: [
        { title: "Account Manager", trackKey: "IC", levelKey: "IC2" },
        { title: "Säljchef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Verksamhetsstöd",
      roles: [
        { title: "Administratör", trackKey: "IC", levelKey: "IC1" },
        { title: "Ekonomiansvarig", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Produktion",
      roles: [
        { title: "Operatör", trackKey: "IC", levelKey: "IC1" },
        { title: "Produktionstekniker", trackKey: "IC", levelKey: "IC2" },
        { title: "Produktionsledare", trackKey: "Lead", levelKey: "Lead2" },
        { title: "Produktionschef", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Kvalitet",
      roles: [
        { title: "Kvalitetsingenjör", trackKey: "IC", levelKey: "IC2" },
        { title: "Kvalitetschef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Underhåll",
      roles: [
        { title: "Underhållstekniker", trackKey: "IC", levelKey: "IC2" },
        { title: "Underhållsledare", trackKey: "Lead", levelKey: "Lead1" },
      ],
    },
    {
      name: "Logistik",
      roles: [
        { title: "Logistikkoordinator", trackKey: "IC", levelKey: "IC2" },
        { title: "Logistikchef", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
  retail: [
    {
      name: "Butik",
      roles: [
        { title: "Butikssäljare", trackKey: "IC", levelKey: "IC1" },
        { title: "Butiksansvarig", trackKey: "Lead", levelKey: "Lead1" },
        { title: "Butikschef", trackKey: "M", levelKey: "M1" },
        { title: "Regionchef", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "E-handel",
      roles: [
        { title: "E-handelsspecialist", trackKey: "IC", levelKey: "IC2" },
        { title: "E-handelsansvarig", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Inköp",
      roles: [
        { title: "Inköpare", trackKey: "IC", levelKey: "IC2" },
        { title: "Inköpschef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Lager och logistik",
      roles: [
        { title: "Lagermedarbetare", trackKey: "IC", levelKey: "IC1" },
        { title: "Lagerchef", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
  publicSector: [
    {
      name: "Handläggning",
      roles: [
        { title: "Handläggare", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior handläggare", trackKey: "IC", levelKey: "IC3" },
        { title: "Gruppledare", trackKey: "Lead", levelKey: "Lead1" },
        { title: "Enhetschef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Verksamhetsutveckling",
      roles: [
        { title: "Verksamhetsutvecklare", trackKey: "IC", levelKey: "IC3" },
        { title: "Projektledare", trackKey: "Lead", levelKey: "Lead2" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Administratör", trackKey: "IC", levelKey: "IC1" },
        { title: "Registrator", trackKey: "IC", levelKey: "IC2" },
      ],
    },
  ],
  healthcare: [
    {
      name: "Vård",
      roles: [
        { title: "Undersköterska", trackKey: "IC", levelKey: "IC1" },
        { title: "Sjuksköterska", trackKey: "IC", levelKey: "IC2" },
        { title: "Specialistsjuksköterska", trackKey: "IC", levelKey: "IC3" },
        { title: "Enhetschef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Omsorg",
      roles: [
        { title: "Omsorgsassistent", trackKey: "IC", levelKey: "IC1" },
        { title: "Stödpedagog", trackKey: "IC", levelKey: "IC2" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Vårdadministratör", trackKey: "IC", levelKey: "IC1" },
        { title: "Verksamhetschef", trackKey: "M", levelKey: "M2" },
      ],
    },
  ],
  finance: [
    {
      name: "Rådgivning",
      roles: [
        { title: "Rådgivare", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior rådgivare", trackKey: "IC", levelKey: "IC3" },
        { title: "Kontorschef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Analys",
      roles: [
        { title: "Analytiker", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior analytiker", trackKey: "IC", levelKey: "IC3" },
        { title: "Chefsanalytiker", trackKey: "Lead", levelKey: "Lead2" },
      ],
    },
    {
      name: "Risk och compliance",
      roles: [
        { title: "Compliance Officer", trackKey: "IC", levelKey: "IC3" },
        { title: "Riskchef", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Backoffice",
      roles: [
        { title: "Handläggare", trackKey: "IC", levelKey: "IC1" },
        { title: "Teamledare", trackKey: "Lead", levelKey: "Lead1" },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Projekt",
      roles: [
        { title: "Projektingenjör", trackKey: "IC", levelKey: "IC2" },
        { title: "Projektledare", trackKey: "Lead", levelKey: "Lead2" },
        { title: "Projektchef", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Produktion",
      roles: [
        { title: "Hantverkare", trackKey: "IC", levelKey: "IC2" },
        { title: "Arbetsledare", trackKey: "Lead", levelKey: "Lead1" },
        { title: "Platschef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Förvaltning",
      roles: [
        { title: "Fastighetstekniker", trackKey: "IC", levelKey: "IC1" },
        { title: "Fastighetsförvaltare", trackKey: "IC", levelKey: "IC2" },
        { title: "Förvaltningschef", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
  other: [
    {
      name: "Verksamhet",
      roles: [
        { title: "Medarbetare", trackKey: "IC", levelKey: "IC1" },
        { title: "Senior medarbetare", trackKey: "IC", levelKey: "IC3" },
        { title: "Teamledare", trackKey: "Lead", levelKey: "Lead1" },
        { title: "Chef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Försäljning",
      roles: [
        { title: "Säljare", trackKey: "IC", levelKey: "IC2" },
        { title: "Säljchef", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Administratör", trackKey: "IC", levelKey: "IC1" },
        { title: "Ekonomiansvarig", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
}
```

- [x] **Step 3: English content** (create `industryStarters.content.en.ts` with the same shape; same families/roles, English names/titles)

```ts
import type { StarterContent } from "./industryStarters"

// English starter sets; same structure as the Swedish module.
export const industryStartersEn: StarterContent = {
  itTelecom: [
    {
      name: "Engineering",
      roles: [
        { title: "Junior Software Developer", trackKey: "IC", levelKey: "IC1" },
        { title: "Software Developer", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior Software Developer", trackKey: "IC", levelKey: "IC3" },
        { title: "Tech Lead", trackKey: "Lead", levelKey: "Lead2" },
        { title: "Engineering Manager", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Product",
      roles: [
        { title: "Product Manager", trackKey: "IC", levelKey: "IC3" },
        { title: "Senior Product Manager", trackKey: "IC", levelKey: "IC4" },
      ],
    },
    {
      name: "Design",
      roles: [
        { title: "UX Designer", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior UX Designer", trackKey: "IC", levelKey: "IC3" },
      ],
    },
    {
      name: "Sales",
      roles: [
        { title: "Account Executive", trackKey: "IC", levelKey: "IC2" },
        { title: "Head of Sales", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Customer Success",
      roles: [
        { title: "Support Specialist", trackKey: "IC", levelKey: "IC1" },
        { title: "Customer Success Manager", trackKey: "IC", levelKey: "IC2" },
      ],
    },
  ],
  consulting: [
    {
      name: "Consulting",
      roles: [
        { title: "Junior Consultant", trackKey: "IC", levelKey: "IC1" },
        { title: "Consultant", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior Consultant", trackKey: "IC", levelKey: "IC3" },
        { title: "Engagement Lead", trackKey: "Lead", levelKey: "Lead2" },
        { title: "Practice Manager", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Sales",
      roles: [
        { title: "Account Manager", trackKey: "IC", levelKey: "IC2" },
        { title: "Sales Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Operations",
      roles: [
        { title: "Administrator", trackKey: "IC", levelKey: "IC1" },
        { title: "Finance Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Production",
      roles: [
        { title: "Operator", trackKey: "IC", levelKey: "IC1" },
        { title: "Production Engineer", trackKey: "IC", levelKey: "IC2" },
        { title: "Production Lead", trackKey: "Lead", levelKey: "Lead2" },
        { title: "Production Manager", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Quality",
      roles: [
        { title: "Quality Engineer", trackKey: "IC", levelKey: "IC2" },
        { title: "Quality Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Maintenance",
      roles: [
        { title: "Maintenance Technician", trackKey: "IC", levelKey: "IC2" },
        { title: "Maintenance Lead", trackKey: "Lead", levelKey: "Lead1" },
      ],
    },
    {
      name: "Logistics",
      roles: [
        { title: "Logistics Coordinator", trackKey: "IC", levelKey: "IC2" },
        { title: "Logistics Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
  retail: [
    {
      name: "Stores",
      roles: [
        { title: "Sales Associate", trackKey: "IC", levelKey: "IC1" },
        { title: "Shift Lead", trackKey: "Lead", levelKey: "Lead1" },
        { title: "Store Manager", trackKey: "M", levelKey: "M1" },
        { title: "Regional Manager", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "E-commerce",
      roles: [
        { title: "E-commerce Specialist", trackKey: "IC", levelKey: "IC2" },
        { title: "E-commerce Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Purchasing",
      roles: [
        { title: "Buyer", trackKey: "IC", levelKey: "IC2" },
        { title: "Purchasing Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Warehouse and Logistics",
      roles: [
        { title: "Warehouse Associate", trackKey: "IC", levelKey: "IC1" },
        { title: "Warehouse Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
  publicSector: [
    {
      name: "Case Management",
      roles: [
        { title: "Case Officer", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior Case Officer", trackKey: "IC", levelKey: "IC3" },
        { title: "Team Lead", trackKey: "Lead", levelKey: "Lead1" },
        { title: "Unit Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Development",
      roles: [
        { title: "Development Officer", trackKey: "IC", levelKey: "IC3" },
        { title: "Project Lead", trackKey: "Lead", levelKey: "Lead2" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Administrator", trackKey: "IC", levelKey: "IC1" },
        { title: "Registrar", trackKey: "IC", levelKey: "IC2" },
      ],
    },
  ],
  healthcare: [
    {
      name: "Care",
      roles: [
        { title: "Assistant Nurse", trackKey: "IC", levelKey: "IC1" },
        { title: "Nurse", trackKey: "IC", levelKey: "IC2" },
        { title: "Specialist Nurse", trackKey: "IC", levelKey: "IC3" },
        { title: "Unit Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Social Care",
      roles: [
        { title: "Care Assistant", trackKey: "IC", levelKey: "IC1" },
        { title: "Support Educator", trackKey: "IC", levelKey: "IC2" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Care Administrator", trackKey: "IC", levelKey: "IC1" },
        { title: "Operations Manager", trackKey: "M", levelKey: "M2" },
      ],
    },
  ],
  finance: [
    {
      name: "Advisory",
      roles: [
        { title: "Advisor", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior Advisor", trackKey: "IC", levelKey: "IC3" },
        { title: "Branch Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Analysis",
      roles: [
        { title: "Analyst", trackKey: "IC", levelKey: "IC2" },
        { title: "Senior Analyst", trackKey: "IC", levelKey: "IC3" },
        { title: "Chief Analyst", trackKey: "Lead", levelKey: "Lead2" },
      ],
    },
    {
      name: "Risk and Compliance",
      roles: [
        { title: "Compliance Officer", trackKey: "IC", levelKey: "IC3" },
        { title: "Head of Risk", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Back Office",
      roles: [
        { title: "Officer", trackKey: "IC", levelKey: "IC1" },
        { title: "Team Lead", trackKey: "Lead", levelKey: "Lead1" },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Projects",
      roles: [
        { title: "Project Engineer", trackKey: "IC", levelKey: "IC2" },
        { title: "Project Lead", trackKey: "Lead", levelKey: "Lead2" },
        { title: "Project Manager", trackKey: "M", levelKey: "M2" },
      ],
    },
    {
      name: "Production",
      roles: [
        { title: "Craftsman", trackKey: "IC", levelKey: "IC2" },
        { title: "Site Supervisor", trackKey: "Lead", levelKey: "Lead1" },
        { title: "Site Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Property Management",
      roles: [
        { title: "Property Technician", trackKey: "IC", levelKey: "IC1" },
        { title: "Property Manager", trackKey: "IC", levelKey: "IC2" },
        { title: "Head of Property", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
  other: [
    {
      name: "Operations",
      roles: [
        { title: "Associate", trackKey: "IC", levelKey: "IC1" },
        { title: "Senior Associate", trackKey: "IC", levelKey: "IC3" },
        { title: "Team Lead", trackKey: "Lead", levelKey: "Lead1" },
        { title: "Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Sales",
      roles: [
        { title: "Sales Representative", trackKey: "IC", levelKey: "IC2" },
        { title: "Sales Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Administrator", trackKey: "IC", levelKey: "IC1" },
        { title: "Finance Manager", trackKey: "M", levelKey: "M1" },
      ],
    },
  ],
}
```

- [x] **Step 4: Write the failing tests** (create `starters.test.ts`; the seed idiom from families.test.ts)

```ts
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedTemplateOrganization(
  t: ReturnType<typeof initConvexTest>,
  industry = "itTelecom"
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("organizations", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      industry,
    })
  })
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  return { orgId, asAdmin }
}

describe("getIndustryStarter", () => {
  it("returns the org industry's starter in the requested locale", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const starter = await asAdmin.query(
      api.assessment.starters.getIndustryStarter,
      { orgId, locale: "sv" }
    )
    expect(starter.families.length).toBeGreaterThan(0)
    expect(starter.families[0]?.name).toBe("Engineering")
    expect(starter.families[0]?.roles[0]).toEqual({
      title: "Junior systemutvecklare",
      trackKey: "IC",
      levelKey: "IC1",
    })
  })

  it("falls back to the generic set for an unknown industry", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(
      t,
      "somethingElse"
    )
    const starter = await asAdmin.query(
      api.assessment.starters.getIndustryStarter,
      { orgId, locale: "en" }
    )
    expect(starter.families[0]?.name).toBe("Operations")
  })
})

describe("createStarterSet", () => {
  it("creates families and draft roles in one call, audited as starter", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Software Developer", trackKey: "IC", levelKey: "IC2" },
            { title: "Tech Lead", trackKey: "Lead", levelKey: "Lead2" },
          ],
        },
        { name: "Design", roles: [] },
      ],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families.map((family) => family.name)).toEqual([
      "Design",
      "Engineering",
    ])
    const roles = await asAdmin.query(api.assessment.roles.listRoles, {
      orgId,
    })
    expect(roles).toHaveLength(2)
    expect(roles[0]).toMatchObject({
      title: "Software Developer",
      familyName: "Engineering",
      levelKey: "IC2",
      status: "draft",
      profileComplete: false,
    })
    await t.run(async (ctx) => {
      const created = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.created")
        )
        .collect()
      expect(created).toHaveLength(2)
      expect(created[0]?.payload).toMatchObject({ source: "starter" })
      const roleRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.created")
        )
        .collect()
      expect(roleRows).toHaveLength(2)
      expect(roleRows[0]?.payload).toMatchObject({ source: "starter" })
      // Starter roles are honest drafts: no invented profile data.
      const role = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      expect(role?.function).toBe("")
      expect(role?.team).toBe("")
      expect(role?.purpose).toBe("")
    })
  })

  it("rejects duplicates against existing families and unknown level keys", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Engineering",
    })
    await expect(
      asAdmin.mutation(api.assessment.starters.createStarterSet, {
        orgId,
        families: [{ name: "engineering", roles: [] }],
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    await expect(
      asAdmin.mutation(api.assessment.starters.createStarterSet, {
        orgId,
        families: [
          {
            name: "Quality",
            roles: [{ title: "QA", trackKey: "IC", levelKey: "IC9" }],
          },
        ],
      })
    ).rejects.toThrow(/errors.invalidInput/)
    // The guard is compound: a KNOWN level key on the WRONG track must also
    // be rejected (IC2 resolves, but its track is IC, not Lead).
    await expect(
      asAdmin.mutation(api.assessment.starters.createStarterSet, {
        orgId,
        families: [
          {
            name: "Quality",
            roles: [{ title: "QA", trackKey: "Lead", levelKey: "IC2" }],
          },
        ],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("is a no-op for an empty list", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    await asAdmin.mutation(api.assessment.starters.createStarterSet, {
      orgId,
      families: [],
    })
    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families).toEqual([])
  })
})
```

- [x] **Step 5: Run to verify failure** (`cd packages/backend && bun run test -- starters`)

- [x] **Step 6: Implement** (create `starters.ts`)

```ts
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { clampLocale } from "../evaluationModel/localize"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { clampIndustry, starterContent } from "./industryStarters"

const MAX_FAMILIES = 20
const MAX_ROLES = 100
const MAX_FAMILY_NAME = 100
const MAX_ROLE_TITLE = 200

const starterFamilyShape = v.object({
  name: v.string(),
  roles: v.array(
    v.object({
      title: v.string(),
      trackKey: v.string(),
      levelKey: v.string(),
    })
  ),
})

// The industry starter for the onboarding families step. Display only: the
// org's saved industry picks the set, the locale picks the language, and
// nothing is written until createStarterSet runs with the user's adjusted
// list (founder decision 2026-06-06: pre-filled and adjustable).
export const getIndustryStarter = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.object({ families: v.array(starterFamilyShape) }),
  handler: async (ctx, { locale }) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const industry = clampIndustry(settings?.industry ?? undefined)
    const content = starterContent(clampLocale(locale))
    return { families: content[industry] }
  },
})

// Creates the adjusted starter set in ONE transaction: families plus their
// draft roles. Roles insert with EMPTY function/team/purpose/responsibilities
// (honest drafts, no invented data; rollfamilj stays separate from
// funktion/avdelning). Families never affect scoring, so there is no
// band-shift wrap. Member scope, like the role register.
export const createStarterSet = orgMutation({
  args: { families: v.array(starterFamilyShape) },
  returns: v.null(),
  handler: async (ctx, { families }) => {
    if (families.length === 0) return null
    if (families.length > MAX_FAMILIES) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const totalRoles = families.reduce(
      (sum, family) => sum + family.roles.length,
      0
    )
    if (totalRoles > MAX_ROLES) throw appError(ERROR_CODES.invalidInput)

    // Level lookup by stable key against the org's model; both seed paths
    // write the fixed schema, so keys resolve for every org with a model.
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const levelByKey = new Map<
      string,
      { trackId: Id<"tracks">; levelId: Id<"levels">; trackKey: string }
    >()
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    for (const track of tracks) {
      const levels = await ctx.db
        .query("levels")
        .withIndex("by_track", (q) => q.eq("trackId", track._id))
        .collect()
      for (const level of levels) {
        levelByKey.set(level.key, {
          trackId: track._id,
          levelId: level._id,
          trackKey: track.key,
        })
      }
    }

    // Uniqueness: against the org's existing families AND within the payload.
    const existing = await ctx.db
      .query("roleFamilies")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const taken = new Set(existing.map((family) => family.name.toLowerCase()))

    for (const family of families) {
      const name = family.name.trim()
      if (name.length === 0 || name.length > MAX_FAMILY_NAME) {
        throw appError(ERROR_CODES.invalidInput)
      }
      const lowered = name.toLowerCase()
      if (taken.has(lowered)) throw appError(ERROR_CODES.roleFamilyExists)
      taken.add(lowered)

      const familyId = await ctx.db.insert("roleFamilies", {
        orgId: ctx.orgId,
        name,
      })
      await logAudit(ctx, {
        orgId: ctx.orgId,
        type: AUDIT_EVENTS.roleFamilyCreated,
        actorId: ctx.authUserId,
        payload: { familyId, name, source: "starter" },
      })

      for (const role of family.roles) {
        const title = role.title.trim()
        if (title.length === 0 || title.length > MAX_ROLE_TITLE) {
          throw appError(ERROR_CODES.invalidInput)
        }
        const level = levelByKey.get(role.levelKey)
        if (level === undefined || level.trackKey !== role.trackKey) {
          throw appError(ERROR_CODES.invalidInput)
        }
        const roleId = await ctx.db.insert("roles", {
          orgId: ctx.orgId,
          title,
          function: "",
          team: "",
          trackId: level.trackId,
          levelId: level.levelId,
          familyId,
          purpose: "",
          responsibilities: "",
          status: "draft",
        })
        await logAudit(ctx, {
          orgId: ctx.orgId,
          type: AUDIT_EVENTS.roleCreated,
          actorId: ctx.authUserId,
          payload: { roleId, source: "starter" },
        })
      }
    }
    return null
  },
})
```

- [x] **Step 7: Codegen (brand-new module), run tests, commit**

Run: `cd packages/backend && bun x convex codegen` then `bun run test` (expect 121 + 5 new = 126 green).

```bash
git add packages/backend/convex/assessment/industryStarters.ts packages/backend/convex/assessment/industryStarters.content.sv.ts packages/backend/convex/assessment/industryStarters.content.en.ts packages/backend/convex/assessment/starters.ts packages/backend/convex/assessment/starters.test.ts packages/backend/convex/_generated/api.d.ts
git commit -m "feat(assessment): industry starter sets for onboarding"
```

## Task 2: i18n additions

Additions only; the old `dashboard.onboarding.step` / `steps.*` keys are removed in Task 6 together with the header text that uses them.

**Files:** `packages/i18n/messages/{en,sv,nb,da,fi}.json`

- [x] **Step 1: Add to en.json** under `dashboard.onboarding` (siblings of `organization`)

```json
      "screens": {
        "continueCta": "Continue",
        "name": { "heading": "What is your organization called?" },
        "language": { "heading": "Which language should the organization use?" },
        "country": { "heading": "Where are you based?" },
        "industry": { "heading": "Which industry are you in?" }
      },
      "dots": {
        "navLabel": "Onboarding steps",
        "name": "Organization name",
        "language": "Language",
        "country": "Country",
        "industry": "Industry",
        "model": "Evaluation model",
        "families": "Role families"
      },
      "families": {
        "heading": "Your role families and roles",
        "description": "A starting point based on your industry. Adjust it freely; everything can be changed later.",
        "skipCta": "Skip for now",
        "createCta": "Create and open the dashboard",
        "addFamilyCta": "Add family",
        "addRoleCta": "Add role",
        "removeFamilyLabel": "Remove family {name}",
        "removeRoleLabel": "Remove role {title}",
        "error": "Something went wrong. Try again."
      },
```

- [x] **Step 2: Mirror to sv.json**

```json
      "screens": {
        "continueCta": "Fortsätt",
        "name": { "heading": "Vad heter er organisation?" },
        "language": { "heading": "Vilket språk ska organisationen använda?" },
        "country": { "heading": "Var finns ni?" },
        "industry": { "heading": "Vilken bransch är ni i?" }
      },
      "dots": {
        "navLabel": "Steg i onboardingen",
        "name": "Organisationens namn",
        "language": "Språk",
        "country": "Land",
        "industry": "Bransch",
        "model": "Värderingsmodell",
        "families": "Rollfamiljer"
      },
      "families": {
        "heading": "Era rollfamiljer och roller",
        "description": "En startpunkt utifrån er bransch. Justera fritt; allt kan ändras senare.",
        "skipCta": "Hoppa över så länge",
        "createCta": "Skapa och öppna dashboarden",
        "addFamilyCta": "Lägg till familj",
        "addRoleCta": "Lägg till roll",
        "removeFamilyLabel": "Ta bort familjen {name}",
        "removeRoleLabel": "Ta bort rollen {title}",
        "error": "Något gick fel. Försök igen."
      },
```

- [x] **Step 3: Mirror to nb/da/fi as machine drafts from the Swedish** (keys identical; placeholders verbatim).

- [x] **Step 4: Verify + commit**

Run: `cd packages/i18n && bun run test` then `bun run typecheck` from the root.

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): conversational onboarding strings (en + sv, machine drafts for nb/da/fi)

nb/da/fi values are machine-translated drafts for native review."
```

---

## Task 3: OnboardingDots + OptionCard components

Read `docs/ui-animation.md` first.

**Files:**
- Create: `apps/dashboard/components/onboarding-dots.tsx` (reusable, NOT under onboarding/)
- Create: `apps/dashboard/components/onboarding-dots.test.tsx`
- Create: `apps/dashboard/components/option-card.tsx`
- Create: `apps/dashboard/components/option-card.test.tsx`

- [x] **Step 1: Write the failing dots tests**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OnboardingDots } from "@/components/onboarding-dots"

const STEPS = [
  { key: "a", label: "Step A" },
  { key: "b", label: "Step B" },
  { key: "c", label: "Step C" },
]

describe("OnboardingDots", () => {
  afterEach(() => {
    cleanup()
  })

  it("marks the active step and disables unreached steps", () => {
    render(
      <OnboardingDots
        steps={STEPS}
        activeIndex={1}
        maxReachedIndex={1}
        onSelect={vi.fn()}
      />
    )
    const active = screen.getByRole("button", { name: "Step B" })
    expect(active.getAttribute("aria-current")).toBe("step")
    const future = screen.getByRole("button", { name: "Step C" })
    expect(future.hasAttribute("disabled")).toBe(true)
  })

  it("selects reached steps and ignores future ones", () => {
    const onSelect = vi.fn()
    render(
      <OnboardingDots
        steps={STEPS}
        activeIndex={2}
        maxReachedIndex={2}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Step A" }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })
})
```

- [x] **Step 2: Implement the dots** (create `onboarding-dots.tsx`)

```tsx
"use client"

import { cn } from "@workspace/ui/lib/utils"
import { motion } from "motion/react"
import { SPRING } from "@/lib/motion"

export interface DotStep {
  key: string
  label: string
}

// Reusable step indicator: one dot per step, the active dot stretched into a
// pill. The width change animates via the layout prop (no text inside the
// dot, so no FLIP distortion per docs/ui-animation.md); siblings reposition
// with the same spring. Steps up to maxReachedIndex are clickable; future
// steps render disabled. Reduced motion is honoured globally.
export function OnboardingDots({
  steps,
  activeIndex,
  maxReachedIndex,
  onSelect,
  navLabel,
}: {
  steps: DotStep[]
  activeIndex: number
  maxReachedIndex: number
  onSelect: (index: number) => void
  navLabel?: string
}) {
  return (
    <nav
      aria-label={navLabel}
      className="flex items-center justify-center gap-1"
    >
      {steps.map((step, index) => {
        const reachable = index <= maxReachedIndex
        const isActive = index === activeIndex
        return (
          <button
            key={step.key}
            type="button"
            disabled={!reachable}
            aria-label={step.label}
            aria-current={isActive ? "step" : undefined}
            className="group flex h-6 items-center px-1 disabled:cursor-default"
            onClick={() => {
              if (reachable) onSelect(index)
            }}
          >
            <motion.span
              layout
              transition={SPRING}
              className={cn(
                "block h-2 rounded-full",
                isActive ? "w-6 bg-primary" : "w-2",
                !isActive && reachable &&
                  "bg-primary/40 group-hover:bg-primary/60",
                !reachable && "bg-muted"
              )}
            />
          </button>
        )
      })}
    </nav>
  )
}
```

- [x] **Step 3: Write the failing OptionCard tests**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OptionCard } from "@/components/option-card"

describe("OptionCard", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders title, description, and badge, and reports selection", () => {
    const onSelect = vi.fn()
    render(
      <OptionCard
        title="Standard template"
        description="9 criteria with anchors"
        badge="Recommended"
        selected={false}
        onSelect={onSelect}
      />
    )
    expect(screen.getByText("Recommended")).toBeDefined()
    const card = screen.getByRole("button", { name: /Standard template/ })
    expect(card.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalled()
  })

  it("marks the selected state", () => {
    render(<OptionCard title="Swedish" selected onSelect={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: "Swedish" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("true")
  })
})
```

- [x] **Step 4: Implement OptionCard** (create `option-card.tsx`)

```tsx
"use client"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

// Large selectable card for one-question-per-screen choices (language,
// country, industry, model choice). The optional badge overlaps the top
// edge (the established "Recommended" ribbon position); the card reserves
// no extra space for it, so toggling selection never shifts layout.
export function OptionCard({
  title,
  description,
  badge,
  selected,
  onSelect,
  className,
  children,
}: {
  title: string
  description?: string
  badge?: string
  selected: boolean
  onSelect: () => void
  className?: string
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50",
        selected && "border-primary bg-primary/5",
        className
      )}
    >
      {badge !== undefined && (
        <Badge className="-top-2.5 absolute">{badge}</Badge>
      )}
      <span className="font-medium">{title}</span>
      {description !== undefined && (
        <span className="text-muted-foreground text-sm">{description}</span>
      )}
      {children}
    </button>
  )
}
```

- [x] **Step 5: Run, commit**

Run: `cd apps/dashboard && bun run test -- "onboarding-dots|option-card"` then typecheck.

```bash
git add apps/dashboard/components/onboarding-dots.tsx apps/dashboard/components/onboarding-dots.test.tsx apps/dashboard/components/option-card.tsx apps/dashboard/components/option-card.test.tsx
git commit -m "feat(dashboard): reusable onboarding dots and option card"
```

---

## Task 4: Name and language screens

The logic is lifted from `organization-setup-step.tsx` (which Task 6 deletes). Read it first; the create/rename and preview-locale behaviors must survive byte-equivalent.

**Files:**
- Create: `apps/dashboard/components/onboarding/name-screen.tsx`
- Create: `apps/dashboard/components/onboarding/name-screen.test.tsx`
- Create: `apps/dashboard/components/onboarding/language-screen.tsx`
- Create: `apps/dashboard/components/onboarding/language-screen.test.tsx`

- [x] **Step 1: Name screen** (create `name-screen.tsx`)

```tsx
"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { organizationSlug } from "@/lib/slug"

// Screen 1: the organization name. Create mode (existing null) creates the
// Better Auth organization on continue (creator becomes admin; the
// onOrganizationCreate trigger seeds the settings row). Revisit mode
// prefills and renames only when the name actually changed.
export function NameScreen({
  existing,
  onDone,
}: {
  existing: { orgId: string; name: string } | null
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const [name, setName] = useState(existing?.name ?? "")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleContinue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || pending) return
    setPending(true)
    setFailed(false)
    try {
      if (existing) {
        if (trimmed !== existing.name) {
          const { error } = await authClient.organization.update({
            organizationId: existing.orgId,
            data: { name: trimmed },
          })
          if (error) {
            setFailed(true)
            setPending(false)
            return
          }
        }
        onDone()
        return
      }
      const { data, error } = await authClient.organization.create({
        name: trimmed,
        slug: organizationSlug(trimmed),
      })
      if (error || !data) {
        setFailed(true)
        setPending(false)
        return
      }
      onDone()
    } catch {
      setFailed(true)
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col items-center gap-6" onSubmit={handleContinue}>
      <h1 className="text-center font-semibold text-2xl">
        {tScreens("name.heading")}
      </h1>
      <Input
        aria-label={t("nameLabel")}
        value={name}
        placeholder={t("namePlaceholder")}
        className="max-w-sm text-center"
        onChange={(event) => setName(event.target.value)}
      />
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {tScreens("continueCta")}
      </Button>
    </form>
  )
}
```

- [x] **Step 2: Name screen tests** (mock `@/lib/auth-client` with organization.create/update mocks; assert: create called with slug on continue; revisit with unchanged name calls onDone WITHOUT update; revisit with changed name calls update; failure shows role="alert").

- [x] **Step 3: Language screen** (create `language-screen.tsx`; lifts the preview-locale + browser-detect behavior verbatim)

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useSetPreviewLocale } from "@/components/locale-provider"
import { OptionCard } from "@/components/option-card"
import { type SupportedLocale, detectBrowserLocale } from "@/lib/locale"

const LANGUAGES = ["sv", "en", "nb", "da", "fi"] as const

const LANGUAGE_KEYS = {
  sv: "languages.sv",
  en: "languages.en",
  nb: "languages.nb",
  da: "languages.da",
  fi: "languages.fi",
} as const satisfies Record<(typeof LANGUAGES)[number], string>

// Screen 2: the organization's default language as option cards. Selecting
// previews the UI language instantly (the established behavior); continue
// persists it. In the fresh flow the initial value derives from the browser
// locale so the cards and the rendered page agree on first paint.
export function LanguageScreen({
  orgId,
  saved,
  onDone,
}: {
  orgId: string
  saved: string | null
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const setPreviewLocale = useSetPreviewLocale()
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )
  const activeLocale = useLocale()
  const [language, setLanguage] = useState<string>(
    () => saved ?? detectBrowserLocale(activeLocale as SupportedLocale)
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  // Fresh flow only: if the detected browser locale differs from the active
  // UI locale, preview it immediately so the selected card and the page
  // language never disagree on first paint. Mount-only by design.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    if (saved === null && language !== activeLocale) {
      setPreviewLocale(language)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-center font-semibold text-2xl">
        {tScreens("language.heading")}
      </h1>
      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {LANGUAGES.map((code) => (
          <OptionCard
            key={code}
            title={t(LANGUAGE_KEYS[code])}
            selected={language === code}
            onSelect={() => {
              setLanguage(code)
              setPreviewLocale(code)
            }}
          />
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)
          try {
            await updateSettings({ orgId, language })
            onDone()
          } catch {
            setFailed(true)
          } finally {
            setPending(false)
          }
        }}
      >
        {tScreens("continueCta")}
      </Button>
    </div>
  )
}
```

- [x] **Step 4: Language screen tests** (mock convex/react + locale-provider's useSetPreviewLocale + lib/locale detectBrowserLocale; assert: selecting a card calls setPreviewLocale; continue saves { orgId, language } and calls onDone; saved value preselects its card).

- [x] **Step 5: Run, commit**

```bash
git add apps/dashboard/components/onboarding
git commit -m "feat(dashboard): conversational name and language screens"
```

---

## Task 5: Country and industry screens

**Files:**
- Create: `apps/dashboard/components/onboarding/country-screen.tsx`
- Create: `apps/dashboard/components/onboarding/country-screen.test.tsx`
- Create: `apps/dashboard/components/onboarding/industry-screen.tsx`
- Create: `apps/dashboard/components/onboarding/industry-screen.test.tsx`

- [x] **Step 1: Country screen with derived currency** (create `country-screen.tsx`)

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { OptionCard } from "@/components/option-card"

const COUNTRIES = ["se", "no", "dk", "fi", "other"] as const
const CURRENCIES = ["SEK", "NOK", "DKK", "EUR"] as const

const COUNTRY_KEYS = {
  se: "countries.se",
  no: "countries.no",
  dk: "countries.dk",
  fi: "countries.fi",
  other: "countries.other",
} as const satisfies Record<(typeof COUNTRIES)[number], string>

// Currency derives from the country (simplicity-first: derive instead of
// asking); the inline Select below the cards is the override.
const CURRENCY_BY_COUNTRY = {
  se: "SEK",
  no: "NOK",
  dk: "DKK",
  fi: "EUR",
  other: "EUR",
} as const satisfies Record<(typeof COUNTRIES)[number], string>

// Screen 3: country as option cards, currency derived with an override.
export function CountryScreen({
  orgId,
  savedCountry,
  savedCurrency,
  onDone,
}: {
  orgId: string
  savedCountry: string | null
  savedCurrency: string | null
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tProfile = useTranslations("dashboard.onboarding.profile")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )
  const [country, setCountry] = useState<string>(savedCountry ?? "se")
  const [currency, setCurrency] = useState<string>(
    savedCurrency ??
      CURRENCY_BY_COUNTRY[(savedCountry ?? "se") as keyof typeof CURRENCY_BY_COUNTRY]
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-center font-semibold text-2xl">
        {tScreens("country.heading")}
      </h1>
      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {COUNTRIES.map((code) => (
          <OptionCard
            key={code}
            title={tProfile(COUNTRY_KEYS[code])}
            selected={country === code}
            onSelect={() => {
              setCountry(code)
              setCurrency(CURRENCY_BY_COUNTRY[code])
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Label id="currency-label" className="text-muted-foreground">
          {tProfile("currency")}
        </Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger
            size="sm"
            aria-labelledby="currency-label"
            className="w-28"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)
          try {
            await updateSettings({ orgId, country, currency })
            onDone()
          } catch {
            setFailed(true)
          } finally {
            setPending(false)
          }
        }}
      >
        {tScreens("continueCta")}
      </Button>
    </div>
  )
}
```

- [x] **Step 2: Country screen tests** (assert: picking Norway flips the currency to NOK; the override Select is driven via the hidden-native-select-in-form idiom OR by asserting the derived value through the card click + save payload; continue saves { orgId, country, currency }).

- [x] **Step 3: Industry screen** (create `industry-screen.tsx`; same shape as the country screen without currency: 9 OptionCards in a 3-column grid from the existing `industries.*` keys, save `{ orgId, industry }`, continue/onDone, alert on failure; lift INDUSTRIES + INDUSTRY_KEYS from the old organization-setup-step verbatim).

- [x] **Step 4: Industry screen tests** (selection + save payload + preselect from saved).

- [x] **Step 5: Run, commit**

```bash
git add apps/dashboard/components/onboarding
git commit -m "feat(dashboard): conversational country and industry screens"
```

## Task 6: Wizard machine restructure

The wizard becomes the six-screen machine with dots navigation. The merged organization step is deleted with its tests; the old step-header keys go away in the same commit (typed keys force it).

**Files:**
- Modify: `apps/dashboard/components/onboarding/onboarding-wizard.tsx`
- Modify: `apps/dashboard/components/onboarding/onboarding-wizard.test.tsx`
- Delete: `apps/dashboard/components/onboarding/organization-setup-step.tsx` + `.test.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (remove `dashboard.onboarding.step` and `dashboard.onboarding.steps`)

- [x] **Step 1: Rewrite the wizard** (replace `onboarding-wizard.tsx`)

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { OnboardingDots } from "@/components/onboarding-dots"
import { CountryScreen } from "@/components/onboarding/country-screen"
import { IndustryScreen } from "@/components/onboarding/industry-screen"
import { LanguageScreen } from "@/components/onboarding/language-screen"
import { ModelSetupStep } from "@/components/onboarding/model-setup-step"
import { NameScreen } from "@/components/onboarding/name-screen"
import { OnboardingHeader } from "@/components/onboarding/onboarding-header"

export interface OnboardingStatus {
  organization: { orgId: string; name: string; role: string } | null
  settingsComplete: boolean
  hasModel: boolean
  completed: boolean
}

// Screen order; one dot each. The model screen owns its internal choice ->
// review sub-flow; families is reached only via the model step's continue
// (session state), so a reload mid-flow resumes at the model review.
const SCREENS = [
  "name",
  "language",
  "country",
  "industry",
  "model",
  "families",
] as const
type ScreenKey = (typeof SCREENS)[number]

const DOT_LABEL_KEYS = {
  name: "dots.name",
  language: "dots.language",
  country: "dots.country",
  industry: "dots.industry",
  model: "dots.model",
  families: "dots.families",
} as const satisfies Record<ScreenKey, string>

export function OnboardingWizard({
  status,
  onFinished,
}: {
  status: OnboardingStatus
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding")
  const orgId = status.organization?.orgId ?? null
  // Settings drive the per-field resume; skipped while no org exists.
  const settings = useQuery(
    api.accounts.organization.getOrganizationSettings,
    orgId !== null ? { orgId } : "skip"
  )

  // Session-local forward progress past the model review (no persisted flag:
  // a reload resumes at the review, whose continue is an idempotent no-op).
  const [sessionStep, setSessionStep] = useState<number | null>(null)
  // Back-navigation from the dots; cleared when a revisited screen saves.
  const [backTo, setBackTo] = useState<number | null>(null)

  // Server-derived resume index: the first screen whose data is missing.
  function resumeIndex(): number {
    if (status.organization === null) return 0
    if (settings === undefined) return -1 // settings still loading
    if (!settings?.language) return 1
    if (!settings?.country || !settings?.currency) return 2
    if (!settings?.industry) return 3
    return 4
  }
  const derived = resumeIndex()
  const frontier = Math.max(derived, sessionStep ?? 0)
  const current =
    backTo !== null && backTo < frontier ? backTo : frontier

  // Members who are not admins cannot run setup mutations; tell them to wait.
  if (status.organization !== null && status.organization.role !== "admin") {
    return (
      <>
        <OnboardingHeader />
        <main className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6">
          <p className="text-muted-foreground">{t("waitingForAdmin")}</p>
        </main>
      </>
    )
  }

  if (derived === -1) {
    return (
      <>
        <OnboardingHeader />
        <main className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6">
          <Spinner aria-label={t("loading")} />
        </main>
      </>
    )
  }

  const screen = SCREENS[current] ?? "name"
  const advance = () => setBackTo(null)

  return (
    <>
      <OnboardingHeader />
      <main className="flex min-h-[calc(100svh-3.5rem)] flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-2xl p-6 md:p-10">
            {screen === "name" && (
              <NameScreen
                existing={
                  status.organization === null
                    ? null
                    : {
                        orgId: status.organization.orgId,
                        name: status.organization.name,
                      }
                }
                onDone={advance}
              />
            )}
            {screen === "language" && orgId !== null && (
              <LanguageScreen
                orgId={orgId}
                saved={settings?.language ?? null}
                onDone={advance}
              />
            )}
            {screen === "country" && orgId !== null && (
              <CountryScreen
                orgId={orgId}
                savedCountry={settings?.country ?? null}
                savedCurrency={settings?.currency ?? null}
                onDone={advance}
              />
            )}
            {screen === "industry" && orgId !== null && (
              <IndustryScreen
                orgId={orgId}
                saved={settings?.industry ?? null}
                onDone={advance}
              />
            )}
            {screen === "model" && orgId !== null && (
              <ModelSetupStep orgId={orgId} onFinished={onFinished} />
            )}
          </div>
        </div>
        <div className="pb-8">
          <OnboardingDots
            steps={SCREENS.map((key) => ({
              key,
              label: t(DOT_LABEL_KEYS[key]),
            }))}
            activeIndex={current}
            maxReachedIndex={Math.min(frontier, 4)}
            navLabel={t("dots.navLabel")}
            onSelect={(index) => {
              setBackTo(index < frontier ? index : null)
            }}
          />
        </div>
      </main>
    </>
  )
}
```

NOTE (sequencing): in THIS task the model screen keeps the CURRENT ModelSetupStep prop (`onFinished`, the pre-slice completion path; `onBack` is optional and omitted, the dots replace it) and the families dot stays gated (`maxReachedIndex={Math.min(frontier, 4)}`; the "families" entry in SCREENS/DOT_LABEL_KEYS is label-only and unreachable). The `sessionStep` state IS declared now (frontier reads it) but nothing sets it yet. Task 7 renames ModelSetupStep's prop to `onContinue`; Task 8 mounts FamiliesStep, flips the model continue to `setSessionStep(5)`, and raises the dot gate to `maxReachedIndex={frontier}`. Every commit stays green.

- [x] **Step 2: Delete the merged step** (`git rm apps/dashboard/components/onboarding/organization-setup-step.tsx apps/dashboard/components/onboarding/organization-setup-step.test.tsx`)

- [x] **Step 3: Remove the dead keys** (`dashboard.onboarding.step` and `dashboard.onboarding.steps` from all five locale files; the typed Messages type then flags any straggler)

- [x] **Step 4: Update the wizard tests** (rewrite `onboarding-wizard.test.tsx`: mock the four screen components + ModelSetupStep + OnboardingDots probe; mock convex/react useQuery for settings; cases: org null -> name screen; org + no language -> language screen; language set but no country -> country screen; all settings -> model screen; waitingForAdmin for editors; dots receive maxReachedIndex = derived frontier and clicking a previous dot shows that screen).

- [x] **Step 5: Run the full dashboard suite + typecheck, commit**

```bash
git add apps/dashboard packages/i18n/messages
git commit -m "feat(dashboard): six-screen conversational onboarding wizard"
```

---

## Task 7: Model step restyle (BOTH terminal screens)

completeOnboarding moves out of the model step entirely. The step has TWO terminal screens: ModelReview (template path) AND CriterionEditor (scratch path); both currently call completeOnboarding + onFinished, and BOTH must change or the scratch path bypasses the families step.

**Files:**
- Modify: `apps/dashboard/components/onboarding/model-setup-step.tsx` (+ its test)
- Modify: `apps/dashboard/components/onboarding/model-review.tsx`
- Modify: `apps/dashboard/components/onboarding/criterion-editor.tsx` (+ its test)
- Modify: `apps/dashboard/components/onboarding/onboarding-wizard.tsx` (rename the model prop)

- [x] **Step 1: Read all four components first.** ModelSetupStep keeps ALL its logic (template/scratch choice, resume via templateKey, change-choice/discard); restyle the two choice cards as OptionCards (template card keeps the Recommended badge via the badge prop; the scratch card keeps its name input below the cards when selected, matching the current behavior as closely as the new layout allows), centered with the heading `dashboard.model.heading` as the screen question. Drop the `onBack` prop AND the choice-screen back button (dots own back navigation); rename `onFinished` to `onContinue` and forward it to BOTH ModelReview and CriterionEditor.

- [x] **Step 2: ModelReview's footer**: the completeOnboarding mutation and the "Open the dashboard" CTA move OUT (Task 8 puts completion in the families step). The footer button becomes `dashboard.onboarding.screens.continueCta` calling the new `onContinue` prop; the onBack prop/button is removed; ChangeChoiceButton stays. Remove the now-unused completeOnboarding import and the completing state tied to it (keep the editor-level error display intact via ModelEditor).

- [x] **Step 3: CriterionEditor gets the SAME footer change**: remove its completeOnboarding useMutation and the `completing` state (finishDisabled then guards only on model loading + zero criteria); rename `onFinished` to `onContinue`; the finish button drops the mutation and just calls `onContinue()`, labelled `dashboard.onboarding.screens.continueCta` instead of editor.doneCta; delete the onBack prop and its button. Keep the removeCriterion failure state untouched.

- [x] **Step 4: Wizard**: rename the model branch's prop to `onContinue` but keep the pre-families behavior for ONE task: `onContinue={onFinished}` and the dot gate at `Math.min(frontier, 4)`. Task 8 flips it to `setSessionStep(5)` and raises the gate. (This keeps the Task 7 commit green without FamiliesStep.)

- [x] **Step 5: Update the tests explicitly** (the file has 24 it() blocks):
  - model-setup-step.test.tsx: the choice-card accessible names CHANGE with OptionCards (the whole card is one button named by title + description + badge). Switch the choice selectors from the CTA names (template.cta / scratch.cta) to TITLE regexes, e.g. `getByRole("button", { name: /Start from the standard template/ })` and `{ name: /Build from scratch/ }`; the scratch name Input + its confirm Button are separate controls below the cards.
  - DELETE the three onBack tests outright ("shows a back control on the choice screen and calls onBack", "does not render a back control when onBack is missing", "shows the back button on the resumed review screen and calls onBack"); the prop is gone.
  - REPLACE "Finish on the review screen calls completeOnboarding before onFinished" with: click the Continue CTA (`dashboard.onboarding.screens.continueCta`) and assert onContinue is called once AND completeOnboardingMock is NOT called. Drop the completeOnboarding mock wiring and the onBack parameter from the renderStep helper.
  - criterion-editor.test.tsx: same treatment (drop completeOnboarding-on-finish and onBack assertions; assert onContinue fires; the finish label is now continueCta).
  - Do not weaken resume/discard/change-choice coverage.

- [x] **Step 6: Run, typecheck, commit**

```bash
git add apps/dashboard/components/onboarding
git commit -m "feat(dashboard): conversational model step with option cards"
```

---

## Task 8: Families step

**Files:**
- Create: `apps/dashboard/components/onboarding/families-step.tsx`
- Create: `apps/dashboard/components/onboarding/families-step.test.tsx`
- Modify: `apps/dashboard/components/onboarding/onboarding-wizard.tsx` (mount FamiliesStep; remove the temporary gate)

- [x] **Step 1: Implement** (create `families-step.tsx`)

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { isDuplicateFamilyError } from "@/lib/family-error"

interface DraftRole {
  id: number
  title: string
  trackKey: string
  levelKey: string
}

interface DraftFamily {
  id: number
  name: string
  roles: DraftRole[]
}

// Screen 6: rollfamiljer and roller, pre-filled from the industry starter
// (founder decision 2026-06-06). Everything is local state until "create and
// continue"; skip creates nothing. Both paths complete onboarding.
export function FamiliesStep({
  orgId,
  onFinished,
}: {
  orgId: string
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding.families")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const tFamily = useTranslations("dashboard.roles.family")
  const tCreate = useTranslations("dashboard.roles.create")
  const tEditor = useTranslations("dashboard.model.editor")
  const tReview = useTranslations("dashboard.model.review")
  const tErrors = useTranslations("errors")
  const locale = useLocale()
  const starter = useQuery(api.assessment.starters.getIndustryStarter, {
    orgId,
    locale,
  })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const createStarterSet = useMutation(api.assessment.starters.createStarterSet)
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )

  const [families, setFamilies] = useState<DraftFamily[] | null>(null)
  const [nextId, setNextId] = useState(0)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)

  // Seed the editable list from the starter exactly once (adjust-state-
  // during-render, the established pattern).
  if (families === null && starter !== undefined) {
    let id = 0
    setFamilies(
      starter.families.map((family) => ({
        id: id++,
        name: family.name,
        roles: family.roles.map((role) => ({ id: id++, ...role })),
      }))
    )
    setNextId(id)
  }

  if (families === null || model === undefined || model === null) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }

  const levelOptions = model.tracks.flatMap((track) =>
    track.levels.map((level) => ({
      trackKey: track.key,
      levelKey: level.key,
      label: `${track.key} ${level.name}`,
    }))
  )

  function claimId(): number {
    const id = nextId
    setNextId(id + 1)
    return id
  }

  function updateFamily(familyId: number, patch: Partial<DraftFamily>) {
    setFamilies((current) =>
      (current ?? []).map((family) =>
        family.id === familyId ? { ...family, ...patch } : family
      )
    )
  }

  async function finish(create: boolean) {
    setPending(true)
    setFailure(null)
    try {
      const cleaned = (families ?? [])
        .map((family) => ({
          name: family.name.trim(),
          roles: family.roles
            .map((role) => ({
              title: role.title.trim(),
              trackKey: role.trackKey,
              levelKey: role.levelKey,
            }))
            .filter((role) => role.title !== ""),
        }))
        .filter((family) => family.name !== "")
      if (create && cleaned.length > 0) {
        await createStarterSet({ orgId, families: cleaned })
      }
      await completeOnboarding({ orgId })
      onFinished()
    } catch (error) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h1 className="font-semibold text-2xl">{t("heading")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <div className="space-y-4">
        {families.map((family) => (
          <Card key={family.id}>
            <CardHeader className="flex flex-row items-center gap-2">
              <Input
                aria-label={tFamily("nameLabel")}
                value={family.name}
                className="max-w-xs font-medium"
                onChange={(event) =>
                  updateFamily(family.id, { name: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                aria-label={t("removeFamilyLabel", { name: family.name })}
                onClick={() =>
                  setFamilies((current) =>
                    (current ?? []).filter((item) => item.id !== family.id)
                  )
                }
              >
                {tEditor("removeCta")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {family.roles.map((role) => (
                <div key={role.id} className="flex items-center gap-2">
                  <Input
                    aria-label={tCreate("titleLabel")}
                    value={role.title}
                    onChange={(event) =>
                      updateFamily(family.id, {
                        roles: family.roles.map((item) =>
                          item.id === role.id
                            ? { ...item, title: event.target.value }
                            : item
                        ),
                      })
                    }
                  />
                  <Select
                    value={role.levelKey}
                    onValueChange={(levelKey) => {
                      const option = levelOptions.find(
                        (item) => item.levelKey === levelKey
                      )
                      if (option === undefined) return
                      updateFamily(family.id, {
                        roles: family.roles.map((item) =>
                          item.id === role.id
                            ? {
                                ...item,
                                levelKey: option.levelKey,
                                trackKey: option.trackKey,
                              }
                            : item
                        ),
                      })
                    }}
                  >
                    <SelectTrigger size="sm" className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levelOptions.map((option) => (
                        <SelectItem
                          key={option.levelKey}
                          value={option.levelKey}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t("removeRoleLabel", { title: role.title })}
                    onClick={() =>
                      updateFamily(family.id, {
                        roles: family.roles.filter(
                          (item) => item.id !== role.id
                        ),
                      })
                    }
                  >
                    {tEditor("removeCta")}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateFamily(family.id, {
                    roles: [
                      ...family.roles,
                      {
                        id: claimId(),
                        title: "",
                        trackKey: "IC",
                        levelKey: "IC1",
                      },
                    ],
                  })
                }
              >
                {t("addRoleCta")}
              </Button>
            </CardContent>
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setFamilies((current) => [
              ...(current ?? []),
              { id: claimId(), name: "", roles: [] },
            ])
          }
        >
          {t("addFamilyCta")}
        </Button>
      </div>
      {failure !== null && (
        <p role="alert" className="text-destructive text-sm">
          {failure === "duplicate"
            ? tErrors("roleFamilyExists")
            : t("error")}
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => finish(false)}
        >
          {t("skipCta")}
        </Button>
        <Button type="button" disabled={pending} onClick={() => finish(true)}>
          {families.length === 0 ? tReview("cta") : t("createCta")}
        </Button>
      </div>
    </div>
  )
}
```

NOTE on `tScreens`: remove the import if unused after assembly (Biome). The level Select value uses levelKey alone (unique across the fixed schema); changing it also updates trackKey from the option.

- [x] **Step 2: Tests** (`families-step.test.tsx`; mock convex/react useQuery by ref: starter returns a small fixture, getModel returns tracks/levels fixture; useMutation by ref for createStarterSet/completeOnboarding): cases: seeds the list from the starter (family name input present with value); removing a family excludes it from the createStarterSet payload; skip calls completeOnboarding WITHOUT createStarterSet; create sends the cleaned payload then completes then onFinished; duplicate rejection shows the translated alert and stays.

- [x] **Step 3: Wizard mounts FamiliesStep** (the deferred wiring from Tasks 6-7): add the `import { FamiliesStep } from "@/components/onboarding/families-step"`, add the render branch

```tsx
            {screen === "families" && orgId !== null && (
              <FamiliesStep orgId={orgId} onFinished={onFinished} />
            )}
```

flip the model branch to `onContinue={() => { setSessionStep(5); setBackTo(null) }}`, and raise the dot gate to `maxReachedIndex={frontier}`.

- [x] **Step 4: Run the full dashboard suite + typecheck, commit**

```bash
git add apps/dashboard/components/onboarding
git commit -m "feat(dashboard): onboarding families step with industry starter"
```

---

## Task 9: Final sweep

- [x] **Step 1:** `bun run typecheck && bun run test && bun x biome check apps packages` green from the root.
- [x] **Step 2:** Dev push: `cd packages/backend && bun x convex dev --once`.
- [x] **Step 3:** Manual smoke: fresh org end to end (name -> language preview flips -> country derives currency -> industry -> model template -> families pre-filled in Swedish for an sv org -> adjust -> create -> dashboard shows the families on /roles); reload at each screen resumes correctly; dots jump back and forth.
- [x] **Step 4:** Update docs: PLAN-V1 section 6 status note gains one sentence in Swedish noting the conversational onboarding and industry starters (append to the existing Status paragraph); tick this plan's checkboxes.
- [x] **Step 5:** Commit docs; the branch then awaits founder review (squash + branch delete after approval).

```bash
git add docs
git commit -m "docs: conversational onboarding status"
```


