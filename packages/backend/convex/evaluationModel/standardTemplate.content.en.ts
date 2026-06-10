import type { CriterionKey, TrackKey } from "./standardTemplate"

export interface CriterionContent {
  name: string
  description: string
  helpText: string
  // Anchor texts for scores 0..5, in order.
  anchors: [string, string, string, string, string, string]
}

export interface StandardTemplateContent {
  modelName: string
  criteria: Record<CriterionKey, CriterionContent>
  trackNames: Record<TrackKey, string>
}

// English content for the standard template. This is a translation draft of the
// Swedish source (standardTemplate.content.sv.ts) and must be reviewed by a native
// speaker before it ships to users. All structural decisions live in
// standard template.ts; this module carries only prose.
export const standardTemplateContentEn: StandardTemplateContent = {
  modelName: "Standard model",
  criteria: {
    scope: {
      name: "Scope & Impact",
      description: "Extent of outcomes/responsibility (team to company).",
      helpText:
        "Weigh the role's reach: how far its outcomes and responsibility extend, from its own tasks to company-wide effect.",
      anchors: [
        "Responsible for own tasks within a clearly limited area.",
        "Impact within the own team; responsible for well-defined deliverables.",
        "Ownership of a sub-area or recurring process; impact within a smaller function.",
        "Responsible for a larger area, project or flow; affects several teams/functions.",
        "Affects a business/functional area; defines direction for larger parts of the organization.",
        "Company-wide impact; strategic responsibility and direct effect on the organization's results.",
      ],
    },
    risk: {
      name: "Risk & Consequence",
      description: "Cost of errors, compliance, brand.",
      helpText:
        "Weigh the consequence if the role makes a mistake: from easily corrected errors to critical impact on results, reputation or compliance.",
      anchors: [
        "Low impact; errors can be corrected easily.",
        "Affects mainly own work or team.",
        "Errors affect deliverables or quality on a smaller scale.",
        "Errors have noticeable consequences for processes, deadlines or customer relations.",
        "High impact on finances, reputation or compliance.",
        "Critical impact on the organization's results, strategy or regulatory compliance.",
      ],
    },
    complexity: {
      name: "Complexity & Ambiguity",
      description: "Technical/business complexity & uncertainty.",
      helpText:
        "Weigh the difficulty and uncertainty of the work: from routine, well-defined tasks to new areas with high uncertainty.",
      anchors: [
        "Work is routine and well defined with clear instructions.",
        "Handles standardized tasks with low variation.",
        "Solves tasks with some variation and a need for own analysis.",
        "Works with several dependencies and trade-offs; requires interpretation and prioritization.",
        "High complexity; handles conflicting requirements and unclear conditions.",
        "Extremely complex situations; drives progress in unknown/innovative areas with high uncertainty.",
      ],
    },
    autonomy: {
      name: "Autonomy & Decision Authority",
      description: "Independence and the level of decisions.",
      helpText:
        "Weigh how independently the role acts and how weighty the decisions it makes: from following instructions to decisions that affect the whole organization.",
      anchors: [
        "Works closely directed; follows instructions.",
        "Independent in everyday tasks within defined frameworks.",
        "Takes own initiatives and priorities within its area.",
        "Makes tactical decisions that affect a team or workflow.",
        "Makes strategic decisions within a domain and sets direction for a sub-area.",
        "Makes decisions that affect several domains or the entire organization.",
      ],
    },
    stakeholders: {
      name: "Stakeholder Breadth",
      description:
        "Internal/external collaboration, cross-functional coordination.",
      helpText:
        "Weigh the breadth and complexity of the role's collaboration: from working within the own team to managing strategic external stakeholders.",
      anchors: [
        "Collaboration mainly within the own team.",
        "Collaboration within adjacent functions.",
        "Regular cross-functional collaboration.",
        "Coordination with external parties/customers or several internal functions.",
        "Manages a complex stakeholder environment with competing interests.",
        "Represents the organization externally and manages strategic stakeholders.",
      ],
    },
    knowledge: {
      name: "Knowledge Depth/Breadth",
      description:
        "Level of expertise, cross-disciplinary breadth, experience.",
      helpText:
        "Weigh the knowledge the role requires: from an introductory level with established routines to domain-leading expertise that sets direction for the organization's future capabilities.",
      anchors: [
        "The role requires basic knowledge. The role assumes an introductory level within its area and that tasks can be performed through established routines and instructions.",
        "The role requires solid professional knowledge within a defined area. The role needs clearly defined and established competence within its domain, with the ability to apply standardized working methods.",
        "The role requires in-depth competence and understanding of methods. The role needs to handle more complex tasks, use more advanced methods/tools and have a good understanding of how the area works in practice.",
        "The role requires advanced specialist competence. The role requires deeper knowledge within one or more sub-areas and the ability to handle harder problems, perform analyses and produce solutions that become guiding in the operational work.",
        "The role requires expert competence within a complex domain. The role assumes that the holder defines methods, structures and working practices within its domain and acts as an internal expert in qualified matters.",
        "The role requires domain-leading competence and knowledge development. The role requires the holder to develop new working practices, models or techniques and to set direction and principles for the organization's future capabilities within the area.",
      ],
    },
    financial: {
      name: "Financial Responsibility",
      description: "Budget/income statement/portfolio.",
      helpText:
        "Weigh the role's financial responsibility: from no budget responsibility to responsibility for a significant part of the company's finances or P&L.",
      anchors: [
        "No budget or cost responsibility.",
        "Affects costs indirectly through decisions.",
        "Responsible for a smaller cost frame or part of a project/budget.",
        "Budget responsibility within the own area/team.",
        "Responsible for a larger budget/business area.",
        "Responsible for a significant part of the company's finances or P&L.",
      ],
    },
    people: {
      name: "People/Management Responsibility",
      description: "Lead/M1-M3/Head and team size.",
      helpText:
        "Weigh the role's formal people and management responsibility: from no responsibility to strategic leadership at company level.",
      anchors: [
        "No people or management responsibility.",
        "Operational direction of work, but no HR responsibility.",
        "People responsibility for staff (M1).",
        "Manager over several teams or first-line managers (M2).",
        "Function head with several management layers or a larger organization.",
        "Strategic leader at company level (Head/Director/C-level).",
      ],
    },
    formal: {
      name: "Formal Qualifications",
      description:
        "Required education level or equivalent experience at recruitment.",
      helpText:
        "Weigh the formal education or equivalent experience the role requires at recruitment: from no prior qualifications to professional expertise at the highest level.",
      anchors: [
        "No formal prior qualifications required. The role can be learned from scratch through internal onboarding. Requires no particular theoretical base or vocational training.",
        "Basic professional knowledge required. The role requires some prior knowledge within the area (e.g. shorter courses or practical experience), but no post-secondary education.",
        "Post-secondary vocational training or equivalent prior knowledge required. The role requires a vocational college education, certification or equivalent theoretical base to be able to perform the tasks.",
        "University degree or equivalent qualified prior knowledge required. The role requires a bachelor's degree/engineering degree or equivalent documented competence to handle typical tasks.",
        "Advanced academic level or advanced specialist certification required. The role requires e.g. a master's degree, advanced certification (IFRS, TISAX, security certificate, CPA etc.) or equivalent high theoretical level.",
        "Professional expertise at the highest level required. The role requires research-level competence, advanced expert accreditation or very substantial domain-specific expertise that sets the norm for the area.",
      ],
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
