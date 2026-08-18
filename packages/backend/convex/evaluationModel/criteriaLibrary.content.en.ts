import type { DimensionKey } from "@workspace/core"
import type { CriteriaLibraryKey } from "./criteriaLibrary"

export interface CriteriaLibraryEntryContent {
  name: string
  shortUiText: string
  fullDefinition: string
  measures: string
  notMeasures: string
  whenSuitable: string
  whenNotSuitable: string
  controlQuestion: string
  assessmentQuestion: string
  anchor1: string
  anchor3: string
  anchor5: string
  anchor2?: string
  anchor4?: string
}

export interface CriteriaLibraryDimensionContent {
  name: string
  question: string
  why: string
}

export interface CriteriaLibraryContent {
  dimensions: Record<DimensionKey, CriteriaLibraryDimensionContent>
  workingConditionsTest: { question: string; notMaterialLabel: string }
  sharedScale: Record<
    "1" | "2" | "3" | "4" | "5",
    { name: string; meaning: string }
  >
  midpoints: { step2: string; step4: string }
  criteria: Record<CriteriaLibraryKey, CriteriaLibraryEntryContent>
}

// English content for the criteria library (the masterdokument's sections
// 5-13.5). This module is type-defining, like the standard template it
// replaces: every other locale content module implements
// CriteriaLibraryContent. All structural decisions (keys, dimension
// membership, overlap pairs, industry hints) live in criteriaLibrary.ts;
// this module carries only prose. Source: docs/rollvardering-masterdokument.md.
export const criteriaLibraryContentEn: CriteriaLibraryContent = {
  dimensions: {
    competence: {
      name: "Competence",
      question:
        "What knowledge, skills, experience and qualifications does the role require?",
      why: "Protects specialist, professional and qualification-heavy roles from being undervalued.",
    },
    effort: {
      name: "Effort and complexity",
      question:
        "How difficult, ambiguous, analytically, communicatively or physically demanding is the role?",
      why: "Makes demanding work visible even when the role has no formal managerial power.",
    },
    responsibility: {
      name: "Responsibility and impact",
      question:
        "What reach, what mandate and what consequences does the role have?",
      why: "Captures responsibility for decisions, results, risk, people, quality and the business.",
    },
    workingConditions: {
      name: "Working conditions",
      question:
        "Are there special, objective and lasting working conditions that affect the requirements?",
      why: "Makes conditions such as on-call duty, exposure, safety requirements and irregular schedules visible.",
    },
  },
  workingConditionsTest: {
    question:
      "Is there at least one role family where special working conditions are a recurring, objective and material part of the role's requirements, not already captured correctly by another criterion?",
    notMaterialLabel: "Tested, not materially relevant",
  },
  sharedScale: {
    "1": {
      name: "Bounded requirement",
      meaning:
        "The requirement is clearly defined, local or limited in scope. The role works mainly within established frames.",
    },
    "2": {
      name: "Basic to moderate requirement",
      meaning:
        "The requirement recurs but within a clearly bounded area. The role handles variations and simpler deviations.",
    },
    "3": {
      name: "Independent and established requirement",
      meaning:
        "The requirement is a clear and recurring part of the role. The role makes professional judgments within its own area.",
    },
    "4": {
      name: "Advanced or broad requirement",
      meaning:
        "The requirement is advanced, has a broader reach, or requires independent judgment calls where established ways of working are not always enough.",
    },
    "5": {
      name: "Very advanced, extensive or business-critical requirement",
      meaning:
        "The requirement has very great scope, difficulty, consequence or strategic significance. The role often shapes direction, standards, solutions or results beyond its own immediate area.",
    },
  },
  midpoints: {
    step2: "A considered midpoint between steps 1 and 3.",
    step4: "A considered midpoint between steps 3 and 5.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Knowledge depth and specialist level",
      shortUiText:
        "The role's requirement for in-depth specialist knowledge and advanced problem-solving.",
      fullDefinition:
        "Captures the role's requirement for in-depth professional knowledge, specialist methodology, advanced problem-solving and relevant experience. It measures the depth of expertise the role normally draws on, not a formal degree in itself or how a single problem happened to turn out.",
      measures:
        "The requirement for in-depth professional knowledge, specialist methodology, advanced problem-solving and relevant experience.",
      notMeasures:
        "A formal degree in itself, the difficulty of a single problem, or the individual's performance.",
      whenSuitable: "Almost always relevant in knowledge-intensive businesses.",
      whenNotSuitable:
        "Choose normally either this criterion or the broader, combined competence criterion, not both.",
      controlQuestion:
        "Does the depth of specialist knowledge this role requires matter on its own, separately from its breadth, formal qualifications, domain context and advisory judgment?",
      assessmentQuestion:
        "What level of specialist knowledge depth does this role normally and lastingly require?",
      anchor1:
        "The role draws on established, well-documented professional knowledge within a clearly bounded area, applying known methods to familiar problems.",
      anchor3:
        "The role independently applies in-depth specialist knowledge and established professional methodology to solve problems within its own area.",
      anchor5:
        "The role commands specialist knowledge at a very advanced level and is often turned to for the hardest problems in the field, shaping professional standards or practice beyond its own team.",
    },
    "knowledge-breadth": {
      name: "Knowledge breadth and cross-disciplinary understanding",
      shortUiText:
        "The role's requirement to integrate several competence areas and understand their connections.",
      fullDefinition:
        "Captures the role's requirement to combine and integrate several competence areas, such as product, data, business and technology, and to understand how they connect. It measures breadth of integration, not the number of people the role works with.",
      measures:
        "The requirement to integrate several competence areas and understand how they connect.",
      notMeasures:
        "The number of collaboration partners or organizational impact.",
      whenSuitable:
        "When roles need to combine several subject areas, for example product, data, business and technology.",
      whenNotSuitable:
        "Choose only when breadth is an independent difference from specialist depth.",
      controlQuestion:
        "Does the breadth of competence this role integrates matter on its own, separately from how deep its specialist knowledge runs?",
      assessmentQuestion:
        "What level of cross-disciplinary breadth does this role normally and lastingly require?",
      anchor1:
        "The role draws mainly on one competence area and rarely needs to connect it to other disciplines.",
      anchor3:
        "The role independently combines a small number of established competence areas and understands how they affect each other.",
      anchor5:
        "The role integrates many different competence areas at a very advanced level and is relied on to connect them in ways that shape solutions or direction beyond its own area.",
    },
    "formal-qualifications": {
      name: "Formal qualification, licensing and certification requirements",
      shortUiText:
        "The role's requirement for a mandatory license, authorization or certification.",
      fullDefinition:
        "Captures formal requirements the role must hold to legally practice, sign off on, or take responsibility for the work, such as a mandatory license, authorization or certification. It measures the formal requirement itself, not general education status or a prestigious degree that is not required to do the job.",
      measures:
        "Formal requirements needed to practice, sign off on, or take responsibility for the work.",
      notMeasures:
        "General education status, a prestigious degree, or voluntary courses.",
      whenSuitable:
        "Regulated or safety-critical roles with a mandatory license, authorization or certification.",
      whenNotSuitable:
        "Should not be used when education is only a path to competence already captured by Knowledge depth.",
      controlQuestion:
        "Does the role's mandatory license, authorization or certification matter on its own, separately from the specialist knowledge it also requires?",
      assessmentQuestion:
        "What level of formal qualification, licensing or certification does this role normally and lastingly require?",
      anchor1:
        "The role requires a basic, clearly defined authorization or certification with a limited renewal or scope requirement.",
      anchor3:
        "The role requires an established professional license or certification that is a recurring, independent condition for practicing the role.",
      anchor5:
        "The role requires an advanced or business-critical license, authorization or certification, without which the role cannot legally be practiced, signed off on, or held accountable, and which often sets the standard others must meet.",
    },
    "domain-knowledge": {
      name: "Domain and business knowledge",
      shortUiText:
        "The role's requirement for deep, hard-to-replace knowledge of its specific industry or business context.",
      fullDefinition:
        "Captures the role's requirement for deep contextual knowledge, such as industry, product, customer environment or regulatory context, that cannot quickly be replaced by general professional skill. It measures depth of context, not the general experience or organizational familiarity everyone is expected to build over time.",
      measures:
        "Deep contextual knowledge that cannot quickly be replaced by general professional skill.",
      notMeasures:
        "General experience or organizational familiarity that everyone is expected to build up.",
      whenSuitable:
        "When specific industry, product, customer-environment or regulatory knowledge is a distinct condition for the role.",
      whenNotSuitable:
        "Domain is the context; specialist level is the professional method and skill.",
      controlQuestion:
        "Does the role's context-specific domain knowledge matter on its own, separately from its general specialist method and skill?",
      assessmentQuestion:
        "What level of domain and business knowledge does this role normally and lastingly require?",
      anchor1:
        "The role requires domain knowledge limited to one clearly bounded product, process or customer context.",
      anchor3:
        "The role requires established, independent knowledge of its business domain that is not quickly replaced by general professional skill.",
      anchor5:
        "The role requires very deep, business-critical domain knowledge that is hard to replace and often shapes how the domain's standards or practice are set beyond the role's own area.",
    },
    "advisory-judgment": {
      name: "Advisory and judgment competence",
      shortUiText:
        "The role's requirement to weigh information and turn expertise into qualified recommendations.",
      fullDefinition:
        "Captures the role's requirement to weigh information, exercise professional judgment and turn expertise into qualified advice or recommendations for others to act on. It measures the advisory judgment itself, not the formal authority to decide what happens next.",
      measures:
        "The requirement to weigh information, give qualified advice and turn expertise into recommendations.",
      notMeasures: "Formal decision-making mandate.",
      whenSuitable:
        "Consulting, partner, specialist and leading expert roles where qualified advice is the core deliverable.",
      whenNotSuitable:
        "Should not be combined with Knowledge depth if it only describes the same expertise in different words.",
      controlQuestion:
        "Does the role's requirement to exercise advisory judgment matter on its own, separately from the specialist knowledge it draws that judgment from?",
      assessmentQuestion:
        "What level of advisory and judgment competence does this role normally and lastingly require?",
      anchor1:
        "The role gives input or straightforward advice within a clearly bounded area, following established guidance.",
      anchor3:
        "The role independently weighs information and gives established, professional advice that others rely on within its own area.",
      anchor5:
        "The role's advice and judgment are sought on very advanced or business-critical questions, and often shape the recommendations, standards or direction that other parts of the business follow.",
    },
    "complexity-ambiguity": {
      name: "Complexity and ambiguity",
      shortUiText:
        "The role's requirement to handle uncertainty, multi-faceted questions and unclear frames with qualified judgment.",
      fullDefinition:
        "Captures the uncertainty, multi-faceted questions, unclear frames and need for qualified judgment the role normally works with. It measures the nature of the problems the role handles, not the knowledge requirement in itself, work pace, or organizational reach.",
      measures:
        "Uncertainty, multi-faceted questions, unclear frames and the need for qualified judgment.",
      notMeasures:
        "The knowledge requirement in itself, a high work pace, or organizational reach.",
      whenSuitable: "Almost always relevant.",
      whenNotSuitable:
        "Should normally be the main criterion within the dimension.",
      controlQuestion:
        "Does the complexity and ambiguity this role handles matter on its own, separately from the analytical effort spent working through it?",
      assessmentQuestion:
        "What level of complexity and ambiguity does this role normally and lastingly handle?",
      anchor1:
        "The role works mainly with clearly defined questions, established methods and predictable situations.",
      anchor2:
        "The role handles recurring variations and simpler deviations, choosing between known alternatives.",
      anchor3:
        "The role independently handles complex questions within its area and needs to analyze, prioritize and adapt solutions.",
      anchor4:
        "The role handles advanced, cross-functional or partly ambiguous problems where established solutions are not always enough.",
      anchor5:
        "The role defines and handles very complex or strategically important problems under high uncertainty, and often shapes the approach, principles or long-term solutions.",
    },
    "analytical-effort": {
      name: "Analytical and problem-solving effort",
      shortUiText:
        "The extent of analysis, troubleshooting or systematic problem-solving the role normally carries out.",
      fullDefinition:
        "Captures the extent of analysis, troubleshooting, modeling, diagnostics or systematic problem-solving the role normally carries out. It measures the analytical work itself, not the specialist knowledge behind it or the mere presence of unclear problems.",
      measures:
        "The extent of analysis, troubleshooting, modeling, diagnostics or systematic problem-solving.",
      notMeasures:
        "Specialist knowledge, or merely the presence of unclear problems.",
      whenSuitable:
        "When the mental analytical load differs clearly between roles despite comparable complexity.",
      whenNotSuitable:
        "Combine with Complexity only when the difference can be explained: complexity is the nature of the problem, analysis is the work required to handle it.",
      controlQuestion:
        "Does the analytical effort this role spends solving problems matter on its own, separately from how complex or ambiguous those problems are?",
      assessmentQuestion:
        "What level of analytical and problem-solving effort does this role normally and lastingly carry?",
      anchor1:
        "The role carries out straightforward analysis or troubleshooting within a clearly bounded task, following established steps.",
      anchor3:
        "The role independently carries out established analysis, diagnostics or systematic problem-solving as a recurring part of its own area.",
      anchor5:
        "The role carries out very advanced or extensive analysis, modeling or diagnostics that is often business-critical and shapes how similar problems are approached beyond its own area.",
    },
    "communication-effort": {
      name: "Communication and relationship effort",
      shortUiText:
        "The role's requirement for advanced communication, negotiation or conflict handling.",
      fullDefinition:
        "Captures the role's requirement for advanced communication, negotiation, influencing, conflict handling or translating between different interests. It measures the communicative effort involved, not the number of stakeholders the role happens to deal with or its organizational impact.",
      measures:
        "The requirement for advanced communication, negotiation, influencing, conflict handling or translating between interests.",
      notMeasures: "The number of stakeholders or organizational impact.",
      whenSuitable:
        "Customer-facing, negotiating, advisory or conflict-handling businesses where this is a central part of the work.",
      whenNotSuitable:
        "Measured as communicative effort, not as the size of the role's network.",
      controlQuestion:
        "Does the communicative effort this role carries matter on its own, separately from how many stakeholders or how much organizational reach it has?",
      assessmentQuestion:
        "What level of communication and relationship effort does this role normally and lastingly carry?",
      anchor1:
        "The role communicates within a clearly bounded, mostly routine exchange with established counterparts.",
      anchor3:
        "The role independently carries out established, recurring communication, negotiation or conflict handling as part of its own area.",
      anchor5:
        "The role carries very advanced or business-critical communication, negotiation or conflict handling, often shaping how sensitive relationships or disputes are handled beyond its own area.",
    },
    "operational-intensity": {
      name: "Operational intensity and simultaneous demands",
      shortUiText:
        "The role's normal requirement to hold attention across several simultaneous flows and prioritize continuously.",
      fullDefinition:
        "Captures the attention, simultaneous-handling ability and continuous prioritization the role normally requires in its ordinary operating mode. It measures a lasting, structural requirement, not temporary peaks, understaffing or poor planning that happen to increase workload.",
      measures:
        "Attention, the ability to work on several things at once, and continuous prioritization in the role's normal operating mode.",
      notMeasures: "Temporary peaks, understaffing or poor planning.",
      whenSuitable:
        "Operations, customer service, logistics or monitoring roles with a lasting requirement to handle several simultaneous flows and fast prioritization.",
      whenNotSuitable:
        "Must not be used to reward workload that results from a lack of resources.",
      controlQuestion:
        "Does this role's normal operational intensity matter on its own, separately from temporary peaks caused by understaffing or poor planning?",
      assessmentQuestion:
        "What level of operational intensity and simultaneous demands does this role normally and lastingly carry?",
      anchor1:
        "The role normally handles one flow or task at a time within a clearly bounded operating rhythm.",
      anchor3:
        "The role independently handles several established, simultaneous flows and prioritizes between them as a normal part of its own area.",
      anchor5:
        "The role sustains very high, business-critical operational intensity across many simultaneous flows, and how it prioritizes often sets the pattern others follow.",
    },
    "physical-sensory": {
      name: "Physical or sensory effort",
      shortUiText:
        "The role's recurring physical load, precision demands or sensory concentration.",
      fullDefinition:
        "Captures the recurring physical load, precision, ergonomically demanding tasks or sensory concentration the role normally requires. It measures physical or sensory effort itself, not the safety risk or exposure the work may also involve.",
      measures:
        "Recurring physical load, precision, ergonomically demanding tasks or sensory concentration.",
      notMeasures: "Safety risk or physical exposure.",
      whenSuitable:
        "Industry, healthcare, warehousing, production, field service or laboratory work.",
      whenNotSuitable:
        "Risk environment and exposure normally belong to Working conditions.",
      controlQuestion:
        "Does the physical or sensory effort this role carries matter on its own, separately from the safety risk or exposure it may also involve?",
      assessmentQuestion:
        "What level of physical or sensory effort does this role normally and lastingly carry?",
      anchor1:
        "The role involves light, occasional physical or sensory demands within a clearly bounded task.",
      anchor3:
        "The role independently carries established, recurring physical load, precision work or sensory concentration as a normal part of its own area.",
      anchor5:
        "The role carries very demanding, sustained physical or sensory effort that is often business-critical to get right, such as precision work whose standard others are held to.",
    },
    "scope-impact": {
      name: "Scope and impact",
      shortUiText:
        "The role's reach: from a bounded task to team, function, several functions or the whole company.",
      fullDefinition:
        "Captures how far the role's results and decisions reach in the organization, from clearly bounded own tasks to company-wide impact. It measures reach, not formal authority.",
      measures:
        "The role's reach: from a bounded task to team, function, several functions or company.",
      notMeasures:
        "Formal people responsibility, budget size or the mandate itself.",
      whenSuitable: "Almost always relevant.",
      whenNotSuitable:
        "Should not be combined with a separate criterion that only measures organizational reach.",
      controlQuestion:
        "Does the difference in reach between your roles matter on its own, beyond mandate and consequence?",
      assessmentQuestion:
        "How far does this role's normal and lasting impact reach?",
      anchor1:
        "The role mainly affects the quality, efficiency or results of its own clearly bounded tasks.",
      anchor2:
        "The role affects a bounded work area or recurring delivery within a team.",
      anchor3:
        "The role has independent responsibility for results within a clear area and affects the delivery and priorities of the team or adjacent functions.",
      anchor4:
        "The role affects several teams, a function or a significant part of the business through choices, priorities or solutions with lasting consequences.",
      anchor5:
        "The role affects the company's overall direction, results or ability to succeed through decisions and responsibility with company-wide or strategic effect.",
    },
    "autonomy-mandate": {
      name: "Autonomy and decision mandate",
      shortUiText:
        "How independently the role decides, and at what level, before escalation is needed.",
      fullDefinition:
        "Captures how independently the role makes decisions, at what level those decisions sit, and how much needs to be escalated to someone else. It measures decision-making mandate itself, not the consequence of the decision or how far its effect reaches.",
      measures:
        "Independence, the level at which decisions are made, and the need for escalation.",
      notMeasures:
        "The consequence of the decision or its organizational reach.",
      whenSuitable: "Almost always relevant.",
      whenNotSuitable:
        "Mandate is the right to decide; scope is where the effect is felt; risk is the consequence if it goes wrong.",
      controlQuestion:
        "Does the level of decision mandate this role holds matter on its own, separately from where its effects are felt and what the consequences would be if it went wrong?",
      assessmentQuestion:
        "What level of autonomy and decision mandate does this role normally and lastingly hold?",
      anchor1:
        "The role makes decisions within a clearly bounded task and escalates anything outside established routine.",
      anchor3:
        "The role independently makes established decisions within its own area, escalating only genuinely new or cross-cutting questions.",
      anchor5:
        "The role holds very broad or business-critical decision mandate, deciding on matters whose direction or standards extend beyond its own immediate area with little need for escalation.",
    },
    "risk-consequence": {
      name: "Risk and consequence",
      shortUiText:
        "The consequences for the business if this role's decisions, errors or shortcomings go wrong.",
      fullDefinition:
        "Captures the consequences the role's decisions, errors or shortcomings can have for safety, customers, quality, compliance, information or brand. It measures consequence broadly, not financial risk alone or how stressful the individual finds the role.",
      measures:
        "The consequences of decisions, errors or shortcomings for safety, customers, quality, compliance, information or brand.",
      notMeasures: "Financial risk alone, or the individual's stress level.",
      whenSuitable: "Almost always relevant.",
      whenNotSuitable:
        "Avoid a separate compliance-risk criterion if it is only an example of the same risk and consequence.",
      controlQuestion:
        "Does the consequence of this role's decisions or errors matter on its own, separately from the formal compliance responsibility it may also carry?",
      assessmentQuestion:
        "What level of risk and consequence does this role's decisions and work normally and lastingly carry?",
      anchor1:
        "Errors or shortcomings normally have limited, easily corrected consequences within the role's own work area.",
      anchor2:
        "Errors or shortcomings can affect the team's quality, efficiency or delivery and normally require correction within established processes.",
      anchor3:
        "Errors, decisions or shortcomings can have clear consequences for customers, delivery, quality, finances or compliance within one area.",
      anchor4:
        "Errors, decisions or shortcomings can have significant consequences for several parts of the business, key customers, critical processes or regulatory compliance.",
      anchor5:
        "Errors, decisions or shortcomings can have very large, long-lasting or business-critical consequences for strategy, safety, compliance, trust or the organization's ability to survive.",
    },
    "people-leadership": {
      name: "People and management responsibility",
      shortUiText:
        "The role's formal responsibility for leading people and delivering results through them.",
      fullDefinition:
        "Captures the role's formal responsibility for leading people: allocating work, developing their capacity and delivering results through others. It measures formal people responsibility, not project leadership without it, specialist leadership, or team size used as a stand-alone measure.",
      measures:
        "Responsibility for leading people, allocating work, developing capacity and delivering results through others.",
      notMeasures:
        "Project leadership without formal people responsibility, specialist leadership, or team size used as the only measure.",
      whenSuitable:
        "When formal people responsibility is a material difference between roles.",
      whenNotSuitable:
        "Should normally carry low to moderate weight since managerial responsibility is often already visible in scope and mandate.",
      controlQuestion:
        "Does this role's formal people responsibility matter on its own, beyond what its scope and decision mandate already capture?",
      assessmentQuestion:
        "What level of people and management responsibility does this role normally and lastingly carry?",
      anchor1:
        "The role has no or very limited formal people responsibility, such as occasionally coordinating one or two others' tasks.",
      anchor3:
        "The role has established, independent responsibility for leading a team: allocating work, developing capacity and delivering results through others.",
      anchor5:
        "The role carries very advanced or business-critical people and management responsibility, leading leaders or a large organization, and often sets the standard for how people are led beyond its own team.",
    },
    "resource-capacity": {
      name: "Resource and capacity responsibility",
      shortUiText:
        "The role's responsibility for prioritizing and using significant resources or capacity.",
      fullDefinition:
        "Captures the role's responsibility for prioritizing and using significant resources, capacity, assets or critical delivery capability so the business keeps functioning. It measures independent resource stewardship, not routine budget follow-up or purchasing within small, pre-set limits.",
      measures:
        "Responsibility for prioritizing and using resources so the business keeps functioning.",
      notMeasures:
        "Routine budget follow-up or purchasing within small limits.",
      whenSuitable:
        "When the role independently allocates significant resources, capacity, assets or critical delivery capability.",
      whenNotSuitable:
        "Should not be selected alongside a narrow financial-responsibility criterion if both measure the same resource stewardship.",
      controlQuestion:
        "Does this role's independent responsibility for resources or capacity matter on its own, separately from routine budget follow-up within pre-set limits?",
      assessmentQuestion:
        "What level of resource and capacity responsibility does this role normally and lastingly carry?",
      anchor1:
        "The role independently prioritizes the use of a small, clearly bounded set of resources or capacity within its own area, where its choices have limited and easily corrected effect.",
      anchor3:
        "The role independently prioritizes and allocates established resources or capacity so its own area keeps functioning.",
      anchor5:
        "The role independently stewards very significant or business-critical resources, capacity or delivery capability, with decisions that shape resource priorities beyond its own area.",
    },
    "business-customer": {
      name: "Business and customer responsibility",
      shortUiText:
        "The role's responsibility for creating, securing or developing material business value.",
      fullDefinition:
        "Captures the role's responsibility for creating, securing or developing material business value through a significant customer relationship, revenue stream, business portfolio or commercial position. It measures the stability of that business responsibility, not individual sales performance, commission or negotiation skill by itself.",
      measures:
        "Responsibility for creating, securing or developing material business value.",
      notMeasures:
        "Individual sales performance, commission, or negotiation skill in itself.",
      whenSuitable:
        "When the role is directly responsible for a significant customer relationship, revenue stream, business portfolio or commercial position.",
      whenNotSuitable:
        "Must not automatically favor sales roles; the responsibility has to be a stable part of the role.",
      controlQuestion:
        "Does this role's stable responsibility for business or customer value matter on its own, separately from individual sales performance or negotiation skill?",
      assessmentQuestion:
        "What level of business and customer responsibility does this role normally and lastingly carry?",
      anchor1:
        "The role supports a customer relationship or business activity within a clearly bounded, established account or task.",
      anchor3:
        "The role independently holds established responsibility for a customer relationship, revenue stream or business portfolio that is a stable part of the role.",
      anchor5:
        "The role carries very significant or business-critical responsibility for major customer relationships, revenue or commercial position, with decisions that shape the business's direction beyond its own portfolio.",
    },
    "compliance-control": {
      name: "Information, security or regulatory compliance responsibility",
      shortUiText:
        "The role's formal responsibility for protection, quality assurance or compliance control.",
      fullDefinition:
        "Captures the role's formal responsibility for protection, quality assurance, control or the correct application of critical requirements, such as information security or regulatory compliance. It measures a separate, formal control responsibility, not general risk awareness that every role is expected to have.",
      measures:
        "Responsibility for protection, quality assurance, control or the correct application of critical requirements.",
      notMeasures: "General risk awareness.",
      whenSuitable:
        "Regulated, safety-critical or data-heavy businesses with a separate, formal control responsibility.",
      whenNotSuitable:
        "Choose only if the responsibility is separate from Risk and consequence.",
      controlQuestion:
        "Does this role's formal control responsibility matter on its own, separately from the general risk and consequence it also carries?",
      assessmentQuestion:
        "What level of information, security or regulatory compliance responsibility does this role normally and lastingly carry?",
      anchor1:
        "The role follows established control routines within a clearly bounded area, without independent control responsibility.",
      anchor3:
        "The role independently holds established, formal responsibility for protection, quality assurance or compliance control within its own area.",
      anchor5:
        "The role carries very advanced or business-critical control responsibility, and how it applies critical requirements often sets the standard for compliance beyond its own area.",
    },
    "safety-exposure": {
      name: "Safety and exposure conditions",
      shortUiText:
        "The role's lasting requirement to work in a risk environment under protective measures.",
      fullDefinition:
        "Captures the lasting risk environment the role works in and the requirement to work under protective measures, covering actual physical, chemical, biological or environmental exposure. It measures the working condition itself, not the consequence for the business if something goes wrong.",
      measures:
        "A lasting risk environment and the requirement to work under protective measures.",
      notMeasures: "The consequence for the business if something goes wrong.",
      whenSuitable:
        "Roles with actual physical, chemical, biological, environmental or other exposure.",
      whenNotSuitable:
        "Do not select alongside a broader working-conditions criterion that covers the same exposure.",
      controlQuestion:
        "Does this role's exposure to a lasting risk environment matter on its own, beyond what the physical or sensory effort criterion already captures?",
      assessmentQuestion:
        "What level of safety and exposure does this role normally and lastingly work under?",
      anchor1:
        "The role is occasionally exposed to a clearly bounded, low-level safety or exposure condition with standard protective measures.",
      anchor3:
        "The role works under an established, recurring risk environment that requires consistent use of protective measures as a normal part of the work.",
      anchor5:
        "The role works under very demanding or business-critical exposure conditions, where the protective standard it follows or sets often extends beyond its own immediate team.",
    },
    "on-call": {
      name: "On-call, standby and availability requirements",
      shortUiText:
        "The role's recurring requirement to be available outside ordinary hours or to respond immediately.",
      fullDefinition:
        "Captures the role's recurring requirement to be available outside ordinary working hours, or to respond immediately, as an integrated condition of the role. It measures a material, recurring standby requirement, not occasional overtime, voluntary flexibility or a generally high workload.",
      measures:
        "A recurring requirement to be available outside ordinary working hours or to respond immediately.",
      notMeasures:
        "Occasional overtime, voluntary flexibility, or a high workload.",
      whenSuitable:
        "Operations, IT, healthcare, security and other roles where standby duty is an integrated condition of the role.",
      whenNotSuitable:
        "Should be its own criterion only when standby duty is material and recurring.",
      controlQuestion:
        "Does this role's recurring standby requirement matter on its own, beyond occasional overtime or a generally high workload?",
      assessmentQuestion:
        "What level of on-call, standby and availability does this role normally and lastingly carry?",
      anchor1:
        "The role occasionally covers a clearly bounded, low-frequency standby requirement.",
      anchor3:
        "The role carries an established, recurring standby or availability requirement outside ordinary working hours as a normal part of the role.",
      anchor5:
        "The role carries a very demanding or business-critical standby requirement, with frequent or immediate-response duty that other roles' availability is often built around.",
    },
    "irregularity-mobility": {
      name: "Irregularity, mobility and location-boundedness",
      shortUiText:
        "The role's lasting requirement for irregular hours, extensive travel or work at particular locations.",
      fullDefinition:
        "Captures the role's lasting requirement for irregular working hours, extensive travel, or work tied to particular locations, such as field, shift or international work. It measures a stable, structural condition of the role, not occasional trips, personal preference, or a temporary project.",
      measures:
        "A lasting requirement for irregular hours, extensive travel, or working at particular locations.",
      notMeasures:
        "Occasional trips, personal preferences, or temporary projects.",
      whenSuitable:
        "Field roles, international operations, shift work or a high frequency of travel.",
      whenNotSuitable:
        "Can be merged with On-call/standby only when both are part of the same stable working condition.",
      controlQuestion:
        "Does this role's lasting irregularity or mobility requirement matter on its own, beyond occasional trips or a temporary project?",
      assessmentQuestion:
        "What level of irregularity, mobility or location-boundedness does this role normally and lastingly carry?",
      anchor1:
        "The role carries a recurring but limited requirement for irregular hours, travel or location-bound work, such as a regular though infrequent scheduled pattern that is a lasting part of the role.",
      anchor3:
        "The role carries an established, recurring pattern of irregular hours, travel or location-bound work as a normal and stable part of the role.",
      anchor5:
        "The role carries very extensive or business-critical irregularity, mobility or location-boundedness, such as sustained international, shift or field commitments that shape how the role can be staffed.",
    },
    "restricted-environments": {
      name: "Special security, confidentiality or control environments",
      shortUiText:
        "The role's requirement to work under special access, control or security restrictions.",
      fullDefinition:
        "Captures the working condition of operating under special access, control or security restrictions, such as a security-classified or confidentiality-sensitive environment. It measures the restriction the role works under, not the responsibility for information security itself.",
      measures:
        "The working condition of operating under special access, control or security restrictions.",
      notMeasures: "Responsibility for information security.",
      whenSuitable:
        "Security-classified, confidentiality-sensitive or strictly controlled environments with actual restrictions.",
      whenNotSuitable:
        "Use only when it is the working environment or condition, not the control responsibility, that is being measured.",
      controlQuestion:
        "Does this role's requirement to work under special access or security restrictions matter on its own, separately from the formal control responsibility it may also carry?",
      assessmentQuestion:
        "What level of security, confidentiality or control restriction does this role normally and lastingly work under?",
      anchor1:
        "The role occasionally works under a clearly bounded, low-level access or confidentiality restriction.",
      anchor3:
        "The role works under an established, recurring set of access, control or security restrictions as a normal part of the role.",
      anchor5:
        "The role works under very strict or business-critical security, confidentiality or control restrictions that shape how the role and its surroundings must be run.",
    },
  },
}
