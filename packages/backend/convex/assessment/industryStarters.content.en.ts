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
