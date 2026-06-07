import type { StarterContent } from "./industryStarters"

// English starter sets; same structure as the Swedish module. One role per
// JOB (ADR-0005): seniority lives on the individual, so there are no
// junior/senior title variants; a senior whose work actually differs becomes
// its own role, added by the user.
export const industryStartersEn: StarterContent = {
  itTelecom: [
    {
      name: "Engineering",
      roles: [
        { title: "Software Developer", trackKey: "IC" },
        { title: "Tech Lead", trackKey: "Lead" },
        { title: "Engineering Manager", trackKey: "M" },
      ],
    },
    {
      name: "Product",
      roles: [{ title: "Product Manager", trackKey: "IC" }],
    },
    {
      name: "Design",
      roles: [{ title: "UX Designer", trackKey: "IC" }],
    },
    {
      name: "Sales",
      roles: [
        { title: "Account Executive", trackKey: "IC" },
        { title: "Head of Sales", trackKey: "M" },
      ],
    },
    {
      name: "Customer Success",
      roles: [
        { title: "Support Specialist", trackKey: "IC" },
        { title: "Customer Success Manager", trackKey: "IC" },
      ],
    },
  ],
  consulting: [
    {
      name: "Consulting",
      roles: [
        { title: "Consultant", trackKey: "IC" },
        { title: "Engagement Lead", trackKey: "Lead" },
        { title: "Practice Manager", trackKey: "M" },
      ],
    },
    {
      name: "Sales",
      roles: [
        { title: "Account Manager", trackKey: "IC" },
        { title: "Sales Manager", trackKey: "M" },
      ],
    },
    {
      name: "Operations",
      roles: [
        { title: "Administrator", trackKey: "IC" },
        { title: "Finance Manager", trackKey: "M" },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Production",
      roles: [
        { title: "Operator", trackKey: "IC" },
        { title: "Production Engineer", trackKey: "IC" },
        { title: "Production Lead", trackKey: "Lead" },
        { title: "Production Manager", trackKey: "M" },
      ],
    },
    {
      name: "Quality",
      roles: [
        { title: "Quality Engineer", trackKey: "IC" },
        { title: "Quality Manager", trackKey: "M" },
      ],
    },
    {
      name: "Maintenance",
      roles: [
        { title: "Maintenance Technician", trackKey: "IC" },
        { title: "Maintenance Lead", trackKey: "Lead" },
      ],
    },
    {
      name: "Logistics",
      roles: [
        { title: "Logistics Coordinator", trackKey: "IC" },
        { title: "Logistics Manager", trackKey: "M" },
      ],
    },
  ],
  retail: [
    {
      name: "Stores",
      roles: [
        { title: "Sales Associate", trackKey: "IC" },
        { title: "Shift Lead", trackKey: "Lead" },
        { title: "Store Manager", trackKey: "M" },
        { title: "Regional Manager", trackKey: "M" },
      ],
    },
    {
      name: "E-commerce",
      roles: [
        { title: "E-commerce Specialist", trackKey: "IC" },
        { title: "E-commerce Manager", trackKey: "M" },
      ],
    },
    {
      name: "Purchasing",
      roles: [
        { title: "Buyer", trackKey: "IC" },
        { title: "Purchasing Manager", trackKey: "M" },
      ],
    },
    {
      name: "Warehouse and Logistics",
      roles: [
        { title: "Warehouse Associate", trackKey: "IC" },
        { title: "Warehouse Manager", trackKey: "M" },
      ],
    },
  ],
  publicSector: [
    {
      name: "Case Management",
      roles: [
        { title: "Case Officer", trackKey: "IC" },
        { title: "Team Lead", trackKey: "Lead" },
        { title: "Unit Manager", trackKey: "M" },
      ],
    },
    {
      name: "Development",
      roles: [
        { title: "Development Officer", trackKey: "IC" },
        { title: "Project Lead", trackKey: "Lead" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Administrator", trackKey: "IC" },
        { title: "Registrar", trackKey: "IC" },
      ],
    },
  ],
  healthcare: [
    {
      name: "Care",
      roles: [
        { title: "Assistant Nurse", trackKey: "IC" },
        { title: "Nurse", trackKey: "IC" },
        { title: "Specialist Nurse", trackKey: "IC" },
        { title: "Unit Manager", trackKey: "M" },
      ],
    },
    {
      name: "Social Care",
      roles: [
        { title: "Care Assistant", trackKey: "IC" },
        { title: "Support Educator", trackKey: "IC" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Care Administrator", trackKey: "IC" },
        { title: "Operations Manager", trackKey: "M" },
      ],
    },
  ],
  finance: [
    {
      name: "Advisory",
      roles: [
        { title: "Advisor", trackKey: "IC" },
        { title: "Branch Manager", trackKey: "M" },
      ],
    },
    {
      name: "Analysis",
      roles: [
        { title: "Analyst", trackKey: "IC" },
        { title: "Chief Analyst", trackKey: "Lead" },
      ],
    },
    {
      name: "Risk and Compliance",
      roles: [
        { title: "Compliance Officer", trackKey: "IC" },
        { title: "Head of Risk", trackKey: "M" },
      ],
    },
    {
      name: "Back Office",
      roles: [
        { title: "Officer", trackKey: "IC" },
        { title: "Team Lead", trackKey: "Lead" },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Projects",
      roles: [
        { title: "Project Engineer", trackKey: "IC" },
        { title: "Project Lead", trackKey: "Lead" },
        { title: "Project Manager", trackKey: "M" },
      ],
    },
    {
      name: "Production",
      roles: [
        { title: "Craftsman", trackKey: "IC" },
        { title: "Site Supervisor", trackKey: "Lead" },
        { title: "Site Manager", trackKey: "M" },
      ],
    },
    {
      name: "Property Management",
      roles: [
        { title: "Property Technician", trackKey: "IC" },
        { title: "Property Manager", trackKey: "IC" },
        { title: "Head of Property", trackKey: "M" },
      ],
    },
  ],
  other: [
    {
      name: "Operations",
      roles: [
        { title: "Associate", trackKey: "IC" },
        { title: "Team Lead", trackKey: "Lead" },
        { title: "Manager", trackKey: "M" },
      ],
    },
    {
      name: "Sales",
      roles: [
        { title: "Sales Representative", trackKey: "IC" },
        { title: "Sales Manager", trackKey: "M" },
      ],
    },
    {
      name: "Administration",
      roles: [
        { title: "Administrator", trackKey: "IC" },
        { title: "Finance Manager", trackKey: "M" },
      ],
    },
  ],
}
