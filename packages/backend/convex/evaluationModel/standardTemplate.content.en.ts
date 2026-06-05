import type { CriterionKey, LevelKey } from "./standardTemplate"

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
  trackNames: Record<"IC" | "Lead" | "M", string>
  levelNames: Record<LevelKey, string>
  levelDefinitions: Partial<Record<LevelKey, string>>
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
        "0 – Responsible for own tasks within a clearly limited area.",
        "1 – Impact within the own team; responsible for well-defined deliverables.",
        "2 – Ownership of a sub-area or recurring process; impact within a smaller function.",
        "3 – Responsible for a larger area, project or flow; affects several teams/functions.",
        "4 – Affects a business/functional area; defines direction for larger parts of the organization.",
        "5 – Company-wide impact; strategic responsibility and direct effect on the organization's results.",
      ],
    },
    risk: {
      name: "Risk & Consequence",
      description: "Cost of errors, compliance, brand.",
      helpText:
        "Weigh the consequence if the role makes a mistake: from easily corrected errors to critical impact on results, reputation or compliance.",
      anchors: [
        "0 – Low impact; errors can be corrected easily.",
        "1 – Affects mainly own work or team.",
        "2 – Errors affect deliverables or quality on a smaller scale.",
        "3 – Errors have noticeable consequences for processes, deadlines or customer relations.",
        "4 – High impact on finances, reputation or compliance.",
        "5 – Critical impact on the organization's results, strategy or regulatory compliance.",
      ],
    },
    complexity: {
      name: "Complexity & Ambiguity",
      description: "Technical/business complexity & uncertainty.",
      helpText:
        "Weigh the difficulty and uncertainty of the work: from routine, well-defined tasks to new areas with high uncertainty.",
      anchors: [
        "0 – Work is routine and well defined with clear instructions.",
        "1 – Handles standardized tasks with low variation.",
        "2 – Solves tasks with some variation and a need for own analysis.",
        "3 – Works with several dependencies and trade-offs; requires interpretation and prioritization.",
        "4 – High complexity; handles conflicting requirements and unclear conditions.",
        "5 – Extremely complex situations; drives progress in unknown/innovative areas with high uncertainty.",
      ],
    },
    autonomy: {
      name: "Autonomy & Decision Authority",
      description: "Independence and the level of decisions.",
      helpText:
        "Weigh how independently the role acts and how weighty the decisions it makes: from following instructions to decisions that affect the whole organization.",
      anchors: [
        "0 – Works closely directed; follows instructions.",
        "1 – Independent in everyday tasks within defined frameworks.",
        "2 – Takes own initiatives and priorities within its area.",
        "3 – Makes tactical decisions that affect a team or workflow.",
        "4 – Makes strategic decisions within a domain and sets direction for a sub-area.",
        "5 – Makes decisions that affect several domains or the entire organization.",
      ],
    },
    stakeholders: {
      name: "Stakeholder Breadth",
      description:
        "Internal/external collaboration, cross-functional coordination.",
      helpText:
        "Weigh the breadth and complexity of the role's collaboration: from working within the own team to managing strategic external stakeholders.",
      anchors: [
        "0 – Collaboration mainly within the own team.",
        "1 – Collaboration within adjacent functions.",
        "2 – Regular cross-functional collaboration.",
        "3 – Coordination with external parties/customers or several internal functions.",
        "4 – Manages a complex stakeholder environment with competing interests.",
        "5 – Represents the organization externally and manages strategic stakeholders.",
      ],
    },
    knowledge: {
      name: "Knowledge Depth/Breadth",
      description:
        "Level of expertise, cross-disciplinary breadth, experience.",
      helpText:
        "Weigh the knowledge the role requires: from an introductory level with established routines to domain-leading expertise that sets direction for the organization's future capabilities.",
      anchors: [
        "0 – The role requires basic knowledge. The role assumes an introductory level within its area and that tasks can be performed through established routines and instructions.",
        "1 – The role requires solid professional knowledge within a defined area. The role needs clearly defined and established competence within its domain, with the ability to apply standardized working methods.",
        "2 – The role requires in-depth competence and understanding of methods. The role needs to handle more complex tasks, use more advanced methods/tools and have a good understanding of how the area works in practice.",
        "3 – The role requires advanced specialist competence. The role requires deeper knowledge within one or more sub-areas and the ability to handle harder problems, perform analyses and produce solutions that become guiding in the operational work.",
        "4 – The role requires expert competence within a complex domain. The role assumes that the holder defines methods, structures and working practices within its domain and acts as an internal expert in qualified matters.",
        "5 – The role requires domain-leading competence and knowledge development. The role requires the holder to develop new working practices, models or techniques and to set direction and principles for the organization's future capabilities within the area.",
      ],
    },
    financial: {
      name: "Financial Responsibility",
      description: "Budget/income statement/portfolio.",
      helpText:
        "Weigh the role's financial responsibility: from no budget responsibility to responsibility for a significant part of the company's finances or P&L.",
      anchors: [
        "0 – No budget or cost responsibility.",
        "1 – Affects costs indirectly through decisions.",
        "2 – Responsible for a smaller cost frame or part of a project/budget.",
        "3 – Budget responsibility within the own area/team.",
        "4 – Responsible for a larger budget/business area.",
        "5 – Responsible for a significant part of the company's finances or P&L.",
      ],
    },
    people: {
      name: "People/Management Responsibility",
      description: "Lead/M1-M3/Head and team size.",
      helpText:
        "Weigh the role's formal people and management responsibility: from no responsibility to strategic leadership at company level.",
      anchors: [
        "0 – No people or management responsibility.",
        "1 – Operational direction of work, but no HR responsibility.",
        "2 – People responsibility for staff (M1).",
        "3 – Manager over several teams or first-line managers (M2).",
        "4 – Function head with several management layers or a larger organization.",
        "5 – Strategic leader at company level (Head/Director/C-level).",
      ],
    },
    formal: {
      name: "Formal Qualifications",
      description:
        "Required education level or equivalent experience at recruitment.",
      helpText:
        "Weigh the formal education or equivalent experience the role requires at recruitment: from no prior qualifications to professional expertise at the highest level.",
      anchors: [
        "0 – No formal prior qualifications required. The role can be learned from scratch through internal onboarding. Requires no particular theoretical base or vocational training.",
        "1 – Basic professional knowledge required. The role requires some prior knowledge within the area (e.g. shorter courses or practical experience), but no post-secondary education.",
        "2 – Post-secondary vocational training or equivalent prior knowledge required. The role requires a vocational college education, certification or equivalent theoretical base to be able to perform the tasks.",
        "3 – University degree or equivalent qualified prior knowledge required. The role requires a bachelor's degree/engineering degree or equivalent documented competence to handle typical tasks.",
        "4 – Advanced academic level or advanced specialist certification required. The role requires e.g. a master's degree, advanced certification (IFRS, TISAX, security certificate, CPA etc.) or equivalent high theoretical level.",
        "5 – Professional expertise at the highest level required. The role requires research-level competence, advanced expert accreditation or very substantial domain-specific expertise that sets the norm for the area.",
      ],
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
  levelNames: {
    IC1: "IC1",
    IC2: "IC2",
    IC3: "IC3",
    IC4: "IC4",
    IC5: "IC5",
    Lead1: "Lead1",
    Lead2: "Lead2",
    Lead3: "Lead3",
    M1: "M1",
    M2: "M2",
    M3: "M3",
  },
  levelDefinitions: {
    IC1: "IC1 – Foundational professional role. Performs clearly defined tasks. Follows established working practices and needs support for more complex steps.",
    IC2: "IC2 – Independent professional role. Works independently within a defined area. Contributes steadily to the team's deliverables and handles routine complex tasks.",
    IC3: "IC3 – Advanced professional role / area responsibility. Takes responsibility for an own work area. Prioritizes and solves more complex matters and provides guidance to others in the team.",
    IC4: "IC4 – Domain owner or expert-oriented role. Drives progress within a larger work or technology area. Handles significant complexity and affects working practices across several teams.",
    IC5: "IC5 – Strategic domain role / principal level. Shapes direction, methods and principles within its domain. Has clear cross-functional impact and contributes to long-term progress.",
    Lead1:
      "Lead-1 – Operational coordinating role (without people responsibility). Coordinates planning, prioritization and workflows in the team. Drives operational structure and execution without people responsibility.",
    Lead2:
      "Lead-2 – Cross-functional coordinating role. Drives larger initiatives or several teams. Ensures the whole and manages dependencies between functions.",
    Lead3:
      "Lead-3 – Strategic coordinating role (without full people responsibility). Provides direction to and coordinates several areas, teams or initiatives and ensures strategic coherence, prioritization and the management of dependencies across the board. Has impact through influence, coordination and guidance rather than formal people responsibility.",
    M1: "M1 – First-line manager. Formal people responsibility. Leads the team's goals, development, work environment and delivery.",
    M2: "M2 – Function manager / manager of managers. Steers a whole function through M1 roles. Responsible for tactics, resource allocation, budget and the function as a whole.",
    M3: "Head of X – Strategic leadership role. Overall leadership responsibility for a function or business area. Affects strategy, priorities and the organization's long-term direction.",
  },
}
