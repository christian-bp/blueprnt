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
