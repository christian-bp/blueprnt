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
        {
          title: "Software Developer",
          trackKey: "IC",
          purpose:
            "Builds and maintains software that meets product and quality requirements.",
          responsibilities:
            "Design and implement features\nWrite and review code\nFix defects and improve performance\nCollaborate on technical decisions",
        },
        {
          title: "Tech Lead",
          trackKey: "Lead",
          purpose:
            "Guides the technical direction of a team and ensures sound engineering practices.",
          responsibilities:
            "Set technical direction and standards\nReview architecture and key decisions\nMentor and unblock engineers\nCoordinate delivery across the team",
        },
        {
          title: "Engineering Manager",
          trackKey: "M",
          purpose:
            "Leads an engineering team to deliver reliably while developing its people.",
          responsibilities:
            "Manage and develop the team\nPlan capacity and delivery\nSet goals and follow up\nSupport recruitment and growth",
        },
      ],
    },
    {
      name: "Product",
      roles: [
        {
          title: "Product Manager",
          trackKey: "IC",
          purpose:
            "Owns the product direction and ensures the right things get built.",
          responsibilities:
            "Define product strategy and roadmap\nPrioritise the backlog\nGather and analyse user needs\nAlign stakeholders and teams",
        },
      ],
    },
    {
      name: "Design",
      roles: [
        {
          title: "UX Designer",
          trackKey: "IC",
          purpose:
            "Shapes intuitive user experiences grounded in research and product goals.",
          responsibilities:
            "Conduct user research\nDesign flows and interfaces\nCreate prototypes and wireframes\nValidate designs through testing",
        },
      ],
    },
    {
      name: "Sales",
      roles: [
        {
          title: "Account Executive",
          trackKey: "IC",
          purpose:
            "Drives new business by closing deals and growing customer accounts.",
          responsibilities:
            "Manage the sales pipeline\nQualify and pursue opportunities\nNegotiate and close deals\nMaintain customer relationships",
        },
        {
          title: "Head of Sales",
          trackKey: "M",
          purpose:
            "Leads the sales organisation to meet revenue and growth targets.",
          responsibilities:
            "Set sales strategy and targets\nManage and coach the sales team\nForecast and report on performance\nDevelop key accounts and partners",
        },
      ],
    },
    {
      name: "Customer Success",
      roles: [
        {
          title: "Support Specialist",
          trackKey: "IC",
          purpose:
            "Resolves customer issues and ensures a positive support experience.",
          responsibilities:
            "Respond to customer inquiries\nTroubleshoot and resolve issues\nEscalate complex cases\nDocument solutions and feedback",
        },
        {
          title: "Customer Success Manager",
          trackKey: "IC",
          purpose:
            "Ensures customers achieve value and continue to grow with the product.",
          responsibilities:
            "Onboard and guide customers\nMonitor adoption and health\nDrive renewals and expansion\nGather and relay customer feedback",
        },
      ],
    },
  ],
  consulting: [
    {
      name: "Consulting",
      roles: [
        {
          title: "Consultant",
          trackKey: "IC",
          purpose:
            "Delivers client work and advice that solve concrete business problems.",
          responsibilities:
            "Analyse client needs\nDevelop recommendations\nDeliver project work\nPresent findings to clients",
        },
        {
          title: "Engagement Lead",
          trackKey: "Lead",
          purpose:
            "Leads client engagements to deliver quality outcomes on time.",
          responsibilities:
            "Plan and scope engagements\nLead the delivery team\nManage client relationships\nEnsure quality of deliverables",
        },
        {
          title: "Practice Manager",
          trackKey: "M",
          purpose:
            "Builds and runs a consulting practice and develops its consultants.",
          responsibilities:
            "Set practice direction\nManage and develop consultants\nOversee utilisation and delivery\nSupport business development",
        },
      ],
    },
    {
      name: "Sales",
      roles: [
        {
          title: "Account Manager",
          trackKey: "IC",
          purpose:
            "Maintains and grows client accounts to secure ongoing business.",
          responsibilities:
            "Manage client relationships\nIdentify new opportunities\nPrepare proposals\nMeet account targets",
        },
        {
          title: "Sales Manager",
          trackKey: "M",
          purpose: "Leads the sales effort to meet growth and revenue goals.",
          responsibilities:
            "Set sales targets\nManage the sales team\nForecast and report results\nDevelop key client relationships",
        },
      ],
    },
    {
      name: "Operations",
      roles: [
        {
          title: "Administrator",
          trackKey: "IC",
          purpose:
            "Keeps day-to-day operations running through accurate administrative support.",
          responsibilities:
            "Handle administrative tasks\nMaintain records and systems\nSupport internal processes\nCoordinate schedules and logistics",
        },
        {
          title: "Finance Manager",
          trackKey: "M",
          purpose:
            "Leads financial management and ensures sound financial control.",
          responsibilities:
            "Manage budgeting and reporting\nOversee accounting processes\nEnsure financial compliance\nLead the finance team",
        },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Production",
      roles: [
        {
          title: "Operator",
          trackKey: "IC",
          purpose:
            "Runs production equipment to produce goods safely and to standard.",
          responsibilities:
            "Operate production machinery\nFollow safety procedures\nMonitor output quality\nReport issues and downtime",
        },
        {
          title: "Production Engineer",
          trackKey: "IC",
          purpose:
            "Improves production processes for efficiency, quality, and safety.",
          responsibilities:
            "Optimise production processes\nTroubleshoot technical issues\nSupport equipment maintenance\nImplement process improvements",
        },
        {
          title: "Production Lead",
          trackKey: "Lead",
          purpose:
            "Coordinates a production team to meet output and quality targets.",
          responsibilities:
            "Plan and assign shift work\nGuide the production team\nMonitor output and quality\nResolve day-to-day issues",
        },
        {
          title: "Production Manager",
          trackKey: "M",
          purpose:
            "Leads production operations to meet volume, cost, and quality goals.",
          responsibilities:
            "Plan production capacity\nManage production teams\nControl cost and quality\nDrive continuous improvement",
        },
      ],
    },
    {
      name: "Quality",
      roles: [
        {
          title: "Quality Engineer",
          trackKey: "IC",
          purpose:
            "Ensures products meet quality standards and specifications.",
          responsibilities:
            "Define quality controls\nInspect and test products\nInvestigate quality issues\nDrive corrective actions",
        },
        {
          title: "Quality Manager",
          trackKey: "M",
          purpose:
            "Leads the quality function and safeguards product and process quality.",
          responsibilities:
            "Own the quality management system\nManage the quality team\nEnsure regulatory compliance\nDrive quality improvement",
        },
      ],
    },
    {
      name: "Maintenance",
      roles: [
        {
          title: "Maintenance Technician",
          trackKey: "IC",
          purpose:
            "Keeps equipment and facilities running through repair and upkeep.",
          responsibilities:
            "Perform preventive maintenance\nDiagnose and repair faults\nDocument maintenance work\nFollow safety procedures",
        },
        {
          title: "Maintenance Lead",
          trackKey: "Lead",
          purpose: "Coordinates maintenance work to maximise equipment uptime.",
          responsibilities:
            "Plan maintenance schedules\nGuide the maintenance team\nPrioritise repairs\nTrack equipment reliability",
        },
      ],
    },
    {
      name: "Logistics",
      roles: [
        {
          title: "Logistics Coordinator",
          trackKey: "IC",
          purpose:
            "Coordinates the flow of goods so deliveries arrive on time.",
          responsibilities:
            "Plan shipments and transport\nCoordinate with suppliers\nTrack inventory and orders\nResolve delivery issues",
        },
        {
          title: "Logistics Manager",
          trackKey: "M",
          purpose:
            "Leads logistics operations for efficient supply and distribution.",
          responsibilities:
            "Set logistics strategy\nManage the logistics team\nOptimise supply chain flows\nControl logistics costs",
        },
      ],
    },
  ],
  retail: [
    {
      name: "Stores",
      roles: [
        {
          title: "Sales Associate",
          trackKey: "IC",
          purpose: "Serves customers and drives sales on the shop floor.",
          responsibilities:
            "Assist and advise customers\nProcess sales transactions\nMaintain store presentation\nManage stock on the floor",
        },
        {
          title: "Shift Lead",
          trackKey: "Lead",
          purpose:
            "Coordinates the store team during a shift to keep it running smoothly.",
          responsibilities:
            "Direct staff during shifts\nOpen and close the store\nHandle customer escalations\nMonitor daily sales tasks",
        },
        {
          title: "Store Manager",
          trackKey: "M",
          purpose:
            "Runs a store to meet sales targets and deliver a strong customer experience.",
          responsibilities:
            "Manage store staff\nDrive sales and targets\nControl stock and budgets\nEnsure service standards",
        },
        {
          title: "Regional Manager",
          trackKey: "M",
          purpose:
            "Leads a group of stores to deliver consistent regional performance.",
          responsibilities:
            "Manage multiple store managers\nSet regional targets\nDrive sales across stores\nEnsure operational consistency",
        },
      ],
    },
    {
      name: "E-commerce",
      roles: [
        {
          title: "E-commerce Specialist",
          trackKey: "IC",
          purpose: "Runs and improves the online store to grow online sales.",
          responsibilities:
            "Maintain product listings\nMonitor online performance\nSupport campaigns and promotions\nImprove the customer journey",
        },
        {
          title: "E-commerce Manager",
          trackKey: "M",
          purpose:
            "Leads the e-commerce channel to meet online growth targets.",
          responsibilities:
            "Set e-commerce strategy\nManage the online team\nDrive traffic and conversion\nOwn online sales targets",
        },
      ],
    },
    {
      name: "Purchasing",
      roles: [
        {
          title: "Buyer",
          trackKey: "IC",
          purpose:
            "Sources and buys products on the right terms for the business.",
          responsibilities:
            "Select products and suppliers\nNegotiate prices and terms\nManage purchase orders\nMonitor stock levels",
        },
        {
          title: "Purchasing Manager",
          trackKey: "M",
          purpose:
            "Leads purchasing to secure the right products at the right cost.",
          responsibilities:
            "Set purchasing strategy\nManage the buying team\nNegotiate key supplier deals\nControl purchasing budgets",
        },
      ],
    },
    {
      name: "Warehouse and Logistics",
      roles: [
        {
          title: "Warehouse Associate",
          trackKey: "IC",
          purpose:
            "Handles goods in the warehouse to keep orders moving accurately.",
          responsibilities:
            "Receive and store goods\nPick and pack orders\nMaintain warehouse order\nFollow safety procedures",
        },
        {
          title: "Warehouse Manager",
          trackKey: "M",
          purpose:
            "Leads warehouse operations for accurate, timely handling of goods.",
          responsibilities:
            "Manage warehouse staff\nPlan storage and flows\nControl inventory accuracy\nEnsure safety and efficiency",
        },
      ],
    },
  ],
  publicSector: [
    {
      name: "Case Management",
      roles: [
        {
          title: "Case Officer",
          trackKey: "IC",
          purpose:
            "Handles cases and decisions in line with rules and regulations.",
          responsibilities:
            "Assess and process cases\nApply relevant regulations\nDocument decisions\nCommunicate with applicants",
        },
        {
          title: "Team Lead",
          trackKey: "Lead",
          purpose:
            "Coordinates a case-handling team to ensure consistent, timely decisions.",
          responsibilities:
            "Distribute and prioritise cases\nGuide and support the team\nMonitor case quality\nResolve complex matters",
        },
        {
          title: "Unit Manager",
          trackKey: "M",
          purpose: "Leads a unit to deliver its mandate and develop its staff.",
          responsibilities:
            "Manage and develop staff\nPlan unit operations\nSet goals and follow up\nEnsure regulatory compliance",
        },
      ],
    },
    {
      name: "Development",
      roles: [
        {
          title: "Development Officer",
          trackKey: "IC",
          purpose:
            "Drives improvement initiatives that strengthen public services.",
          responsibilities:
            "Analyse development needs\nPropose improvements\nSupport implementation\nFollow up on results",
        },
        {
          title: "Project Lead",
          trackKey: "Lead",
          purpose:
            "Leads projects to deliver intended outcomes on time and on budget.",
          responsibilities:
            "Plan and scope projects\nCoordinate project members\nManage timelines and budget\nReport on progress",
        },
      ],
    },
    {
      name: "Administration",
      roles: [
        {
          title: "Administrator",
          trackKey: "IC",
          purpose:
            "Provides administrative support that keeps operations running.",
          responsibilities:
            "Handle administrative tasks\nMaintain records and systems\nSupport internal processes\nCoordinate schedules and meetings",
        },
        {
          title: "Registrar",
          trackKey: "IC",
          purpose:
            "Manages official records to ensure correct and accessible documentation.",
          responsibilities:
            "Register incoming documents\nMaintain the records system\nEnsure correct classification\nSupport records requests",
        },
      ],
    },
  ],
  healthcare: [
    {
      name: "Care",
      roles: [
        {
          title: "Assistant Nurse",
          trackKey: "IC",
          purpose:
            "Provides hands-on care that supports patients' daily wellbeing.",
          responsibilities:
            "Assist patients with daily care\nSupport nursing staff\nMonitor patient condition\nDocument care provided",
        },
        {
          title: "Nurse",
          trackKey: "IC",
          purpose:
            "Delivers nursing care and safeguards patient safety and wellbeing.",
          responsibilities:
            "Assess and plan patient care\nAdminister treatments and medication\nMonitor patient condition\nDocument and report care",
        },
        {
          title: "Specialist Nurse",
          trackKey: "IC",
          purpose:
            "Provides advanced nursing care within a clinical specialty.",
          responsibilities:
            "Deliver specialist care\nGuide colleagues in the specialty\nLead clinical assessments\nSupport care development",
        },
        {
          title: "Unit Manager",
          trackKey: "M",
          purpose:
            "Leads a care unit to deliver safe, quality care and develop its staff.",
          responsibilities:
            "Manage and develop staff\nPlan staffing and operations\nEnsure care quality and safety\nManage the unit budget",
        },
      ],
    },
    {
      name: "Social Care",
      roles: [
        {
          title: "Care Assistant",
          trackKey: "IC",
          purpose:
            "Supports individuals with everyday needs to maintain quality of life.",
          responsibilities:
            "Assist with daily activities\nSupport personal care\nObserve and report changes\nDocument support provided",
        },
        {
          title: "Support Educator",
          trackKey: "IC",
          purpose:
            "Supports individuals' development and independence in daily life.",
          responsibilities:
            "Plan and provide support\nEncourage skills and independence\nFollow individual care plans\nDocument progress",
        },
      ],
    },
    {
      name: "Administration",
      roles: [
        {
          title: "Care Administrator",
          trackKey: "IC",
          purpose:
            "Provides administrative support that keeps care operations running.",
          responsibilities:
            "Handle administrative tasks\nMaintain records and schedules\nSupport care staff\nCoordinate appointments",
        },
        {
          title: "Operations Manager",
          trackKey: "M",
          purpose:
            "Leads care operations to deliver quality services and develop staff.",
          responsibilities:
            "Manage and develop staff\nPlan and run operations\nControl budgets and quality\nEnsure regulatory compliance",
        },
      ],
    },
  ],
  finance: [
    {
      name: "Advisory",
      roles: [
        {
          title: "Advisor",
          trackKey: "IC",
          purpose: "Advises clients on financial products to meet their needs.",
          responsibilities:
            "Assess client needs\nRecommend financial products\nManage client relationships\nEnsure advisory compliance",
        },
        {
          title: "Branch Manager",
          trackKey: "M",
          purpose:
            "Leads a branch to meet business targets and serve clients well.",
          responsibilities:
            "Manage branch staff\nDrive sales and targets\nEnsure service quality\nOversee branch compliance",
        },
      ],
    },
    {
      name: "Analysis",
      roles: [
        {
          title: "Analyst",
          trackKey: "IC",
          purpose:
            "Analyses financial data to inform sound business decisions.",
          responsibilities:
            "Gather and analyse data\nBuild financial models\nPrepare reports and insights\nSupport decision-making",
        },
        {
          title: "Chief Analyst",
          trackKey: "Lead",
          purpose:
            "Leads analytical work and sets the standard for financial analysis.",
          responsibilities:
            "Lead complex analyses\nGuide and review analysts\nSet analytical methods\nPresent insights to leadership",
        },
      ],
    },
    {
      name: "Risk and Compliance",
      roles: [
        {
          title: "Compliance Officer",
          trackKey: "IC",
          purpose:
            "Ensures the organisation operates within laws and regulations.",
          responsibilities:
            "Monitor regulatory compliance\nAssess compliance risks\nAdvise on requirements\nReport on compliance issues",
        },
        {
          title: "Head of Risk",
          trackKey: "M",
          purpose: "Leads the risk function to identify and control key risks.",
          responsibilities:
            "Set the risk framework\nManage the risk team\nOversee risk assessment\nReport risk to leadership",
        },
      ],
    },
    {
      name: "Back Office",
      roles: [
        {
          title: "Officer",
          trackKey: "IC",
          purpose:
            "Processes transactions and records accurately to support operations.",
          responsibilities:
            "Process transactions\nMaintain accurate records\nReconcile accounts\nResolve discrepancies",
        },
        {
          title: "Team Lead",
          trackKey: "Lead",
          purpose:
            "Coordinates a back-office team for accurate, timely processing.",
          responsibilities:
            "Distribute and prioritise work\nGuide and support the team\nMonitor processing quality\nResolve complex cases",
        },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Projects",
      roles: [
        {
          title: "Project Engineer",
          trackKey: "IC",
          purpose:
            "Provides technical support to deliver construction projects correctly.",
          responsibilities:
            "Prepare technical documentation\nSupport project planning\nCoordinate with contractors\nMonitor technical quality",
        },
        {
          title: "Project Lead",
          trackKey: "Lead",
          purpose:
            "Leads project delivery to meet scope, time, and budget goals.",
          responsibilities:
            "Plan and scope projects\nCoordinate the project team\nManage timelines and budget\nReport on progress",
        },
        {
          title: "Project Manager",
          trackKey: "M",
          purpose:
            "Owns project outcomes and manages stakeholders, cost, and risk.",
          responsibilities:
            "Lead project delivery\nManage budget and contracts\nHandle stakeholders and risk\nEnsure project quality",
        },
      ],
    },
    {
      name: "Production",
      roles: [
        {
          title: "Craftsman",
          trackKey: "IC",
          purpose:
            "Carries out skilled trade work to required standards on site.",
          responsibilities:
            "Perform trade work on site\nFollow drawings and specs\nMaintain quality and safety\nReport progress and issues",
        },
        {
          title: "Site Supervisor",
          trackKey: "Lead",
          purpose:
            "Coordinates site work to keep it safe, on schedule, and to standard.",
          responsibilities:
            "Direct work on site\nCoordinate trades and crews\nMonitor safety and quality\nReport on site progress",
        },
        {
          title: "Site Manager",
          trackKey: "M",
          purpose:
            "Leads site operations to deliver construction safely and on plan.",
          responsibilities:
            "Manage site staff and crews\nPlan and run site operations\nControl cost and schedule\nEnsure site safety and quality",
        },
      ],
    },
    {
      name: "Property Management",
      roles: [
        {
          title: "Property Technician",
          trackKey: "IC",
          purpose:
            "Maintains properties to keep buildings safe and functional.",
          responsibilities:
            "Perform property maintenance\nHandle repairs and faults\nInspect building systems\nRespond to tenant requests",
        },
        {
          title: "Property Manager",
          trackKey: "IC",
          purpose:
            "Manages properties to keep them well run and tenants satisfied.",
          responsibilities:
            "Manage property operations\nHandle tenant relationships\nCoordinate maintenance\nMonitor property budgets",
        },
        {
          title: "Head of Property",
          trackKey: "M",
          purpose:
            "Leads property management to optimise the property portfolio.",
          responsibilities:
            "Set property strategy\nManage the property team\nOptimise portfolio performance\nControl property budgets",
        },
      ],
    },
  ],
  other: [
    {
      name: "Operations",
      roles: [
        {
          title: "Associate",
          trackKey: "IC",
          purpose: "Carries out day-to-day work that keeps operations running.",
          responsibilities:
            "Perform daily tasks\nFollow established processes\nSupport team objectives\nReport issues and results",
        },
        {
          title: "Team Lead",
          trackKey: "Lead",
          purpose: "Coordinates a team to deliver its day-to-day objectives.",
          responsibilities:
            "Distribute and prioritise work\nGuide and support the team\nMonitor quality and progress\nResolve day-to-day issues",
        },
        {
          title: "Manager",
          trackKey: "M",
          purpose: "Leads a team to meet its goals and develop its people.",
          responsibilities:
            "Manage and develop the team\nPlan and run operations\nSet goals and follow up\nControl budget and quality",
        },
      ],
    },
    {
      name: "Sales",
      roles: [
        {
          title: "Sales Representative",
          trackKey: "IC",
          purpose: "Drives sales by winning and serving customers.",
          responsibilities:
            "Pursue sales opportunities\nManage customer relationships\nNegotiate and close deals\nMeet sales targets",
        },
        {
          title: "Sales Manager",
          trackKey: "M",
          purpose: "Leads the sales effort to meet growth and revenue goals.",
          responsibilities:
            "Set sales targets\nManage the sales team\nForecast and report results\nDevelop key customer relationships",
        },
      ],
    },
    {
      name: "Administration",
      roles: [
        {
          title: "Administrator",
          trackKey: "IC",
          purpose:
            "Provides administrative support that keeps the business running.",
          responsibilities:
            "Handle administrative tasks\nMaintain records and systems\nSupport internal processes\nCoordinate schedules and meetings",
        },
        {
          title: "Finance Manager",
          trackKey: "M",
          purpose:
            "Leads financial management and ensures sound financial control.",
          responsibilities:
            "Manage budgeting and reporting\nOversee accounting processes\nEnsure financial compliance\nLead the finance team",
        },
      ],
    },
  ],
}
