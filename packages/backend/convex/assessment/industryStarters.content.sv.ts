import type { StarterContent } from "./industryStarters"

// Swedish starter sets. Titles are stored as written once the user confirms
// (user data, no read-time localization). Track keys reference the fixed
// schema (IC/Lead/M). One role per JOB (ADR-0005): seniority lives on the
// individual, so there are no junior/senior title variants; a senior whose
// work actually differs becomes its own role, added by the user.
export const industryStartersSv: StarterContent = {
  itTelecom: [
    {
      name: "Engineering",
      roles: [
        { title: "Systemutvecklare", trackKey: "IC" },
        { title: "Tech Lead", trackKey: "Lead" },
        { title: "Engineering Manager", trackKey: "M" },
      ],
    },
    {
      name: "Produkt",
      roles: [{ title: "Product Manager", trackKey: "IC" }],
    },
    {
      name: "Design",
      roles: [{ title: "UX-designer", trackKey: "IC" }],
    },
    {
      name: "Försäljning",
      roles: [
        { title: "Account Executive", trackKey: "IC" },
        { title: "Försäljningschef", trackKey: "M" },
      ],
    },
    {
      name: "Kundsupport",
      roles: [
        { title: "Supportspecialist", trackKey: "IC" },
        { title: "Customer Success Manager", trackKey: "IC" },
      ],
    },
  ],
  consulting: [
    {
      name: "Konsultverksamhet",
      roles: [
        { title: "Konsult", trackKey: "IC" },
        { title: "Uppdragsledare", trackKey: "Lead" },
        { title: "Affärsområdeschef", trackKey: "M" },
      ],
    },
    {
      name: "Försäljning",
      roles: [
        { title: "Account Manager", trackKey: "IC" },
        { title: "Säljchef", trackKey: "M" },
      ],
    },
    {
      name: "Verksamhetsstöd",
      roles: [
        { title: "Administratör", trackKey: "IC" },
        { title: "Ekonomiansvarig", trackKey: "M" },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Produktion",
      roles: [
        { title: "Operatör", trackKey: "IC" },
        { title: "Produktionstekniker", trackKey: "IC" },
        { title: "Produktionsledare", trackKey: "Lead" },
        { title: "Produktionschef", trackKey: "M" },
      ],
    },
    {
      name: "Kvalitet",
      roles: [
        { title: "Kvalitetsingenjör", trackKey: "IC" },
        { title: "Kvalitetschef", trackKey: "M" },
      ],
    },
    {
      name: "Underhåll",
      roles: [
        { title: "Underhållstekniker", trackKey: "IC" },
        { title: "Underhållsledare", trackKey: "Lead" },
      ],
    },
    {
      name: "Logistik",
      roles: [
        { title: "Logistikkoordinator", trackKey: "IC" },
        { title: "Logistikchef", trackKey: "M" },
      ],
    },
  ],
  retail: [
    {
      name: "Butik",
      roles: [
        { title: "Butikssäljare", trackKey: "IC" },
        { title: "Butiksansvarig", trackKey: "Lead" },
        { title: "Butikschef", trackKey: "M" },
        { title: "Regionchef", trackKey: "M" },
      ],
    },
    {
      name: "E-handel",
      roles: [
        { title: "E-handelsspecialist", trackKey: "IC" },
        { title: "E-handelsansvarig", trackKey: "M" },
      ],
    },
    {
      name: "Inköp",
      roles: [
        { title: "Inköpare", trackKey: "IC" },
        { title: "Inköpschef", trackKey: "M" },
      ],
    },
    {
      name: "Lager och logistik",
      roles: [
        { title: "Lagermedarbetare", trackKey: "IC" },
        { title: "Lagerchef", trackKey: "M" },
      ],
    },
  ],
  publicSector: [
    {
      name: "Handläggning",
      roles: [
        { title: "Handläggare", trackKey: "IC" },
        { title: "Gruppledare", trackKey: "Lead" },
        { title: "Enhetschef", trackKey: "M" },
      ],
    },
    {
      name: "Verksamhetsutveckling",
      roles: [
        { title: "Verksamhetsutvecklare", trackKey: "IC" },
        { title: "Projektledare", trackKey: "Lead" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Administratör", trackKey: "IC" },
        { title: "Registrator", trackKey: "IC" },
      ],
    },
  ],
  healthcare: [
    {
      name: "Vård",
      roles: [
        { title: "Undersköterska", trackKey: "IC" },
        { title: "Sjuksköterska", trackKey: "IC" },
        { title: "Specialistsjuksköterska", trackKey: "IC" },
        { title: "Enhetschef", trackKey: "M" },
      ],
    },
    {
      name: "Omsorg",
      roles: [
        { title: "Omsorgsassistent", trackKey: "IC" },
        { title: "Stödpedagog", trackKey: "IC" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Vårdadministratör", trackKey: "IC" },
        { title: "Verksamhetschef", trackKey: "M" },
      ],
    },
  ],
  finance: [
    {
      name: "Rådgivning",
      roles: [
        { title: "Rådgivare", trackKey: "IC" },
        { title: "Kontorschef", trackKey: "M" },
      ],
    },
    {
      name: "Analys",
      roles: [
        { title: "Analytiker", trackKey: "IC" },
        { title: "Chefsanalytiker", trackKey: "Lead" },
      ],
    },
    {
      name: "Risk och compliance",
      roles: [
        { title: "Compliance Officer", trackKey: "IC" },
        { title: "Riskchef", trackKey: "M" },
      ],
    },
    {
      name: "Backoffice",
      roles: [
        { title: "Handläggare", trackKey: "IC" },
        { title: "Teamledare", trackKey: "Lead" },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Projekt",
      roles: [
        { title: "Projektingenjör", trackKey: "IC" },
        { title: "Projektledare", trackKey: "Lead" },
        { title: "Projektchef", trackKey: "M" },
      ],
    },
    {
      name: "Produktion",
      roles: [
        { title: "Hantverkare", trackKey: "IC" },
        { title: "Arbetsledare", trackKey: "Lead" },
        { title: "Platschef", trackKey: "M" },
      ],
    },
    {
      name: "Förvaltning",
      roles: [
        { title: "Fastighetstekniker", trackKey: "IC" },
        { title: "Fastighetsförvaltare", trackKey: "IC" },
        { title: "Förvaltningschef", trackKey: "M" },
      ],
    },
  ],
  other: [
    {
      name: "Verksamhet",
      roles: [
        { title: "Medarbetare", trackKey: "IC" },
        { title: "Teamledare", trackKey: "Lead" },
        { title: "Chef", trackKey: "M" },
      ],
    },
    {
      name: "Försäljning",
      roles: [
        { title: "Säljare", trackKey: "IC" },
        { title: "Säljchef", trackKey: "M" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Administratör", trackKey: "IC" },
        { title: "Ekonomiansvarig", trackKey: "M" },
      ],
    },
  ],
}
