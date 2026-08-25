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
  // The default model's display name (createDefaultModel/seedDefaultModel),
  // localized like every other library string.
  modelName: string
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
  modelName: "Role evaluation model",
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
        "The requirement is clearly defined, local or limited in scope. Established frames and ways of working are normally enough.",
    },
    "2": {
      name: "Basic to moderate requirement",
      meaning:
        "The requirement recurs within a clearly bounded area. Variations and simpler deviations have to be handled.",
    },
    "3": {
      name: "Independent and established requirement",
      meaning:
        "The requirement is a clear and recurring part of the area. Professional judgments are made within established frames.",
    },
    "4": {
      name: "Advanced or broad requirement",
      meaning:
        "The requirement is advanced, reaches wider or calls for independent trade-offs where established ways of working are not always enough.",
    },
    "5": {
      name: "Very advanced, extensive or business-critical requirement",
      meaning:
        "The requirement carries very great scope, difficulty, consequence or strategic significance. It can shape direction, standards, solutions or results beyond the immediate area.",
    },
  },
  midpoints: {
    step2: "A considered midpoint between steps 1 and 3.",
    step4: "A considered midpoint between steps 3 and 5.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Knowledge depth and specialist level",
      shortUiText: "Deep specialist knowledge within a bounded field.",
      fullDefinition:
        "Covers deep professional knowledge, specialist methods and relevant experience within one main field. The criterion concerns how advanced the knowledge has to be in order to handle difficult questions in the field. It does not concern breadth of knowledge, formal authorisations, business context or advisory work as a field of its own.",
      measures:
        "Deep professional knowledge, specialist methods, relevant and lasting experience within one field.",
      notMeasures:
        "The number of knowledge areas, a formal degree or certification in itself, knowledge of a specific industry or organisation in itself, decision mandate or individual performance.",
      whenSuitable:
        "Choose this when deep specialist knowledge within a professional field should carry particular weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for education requirements, broad collaboration across several fields, or advisory work. Consider instead whether one of the neighbouring criteria captures what you want to prioritise more precisely.",
      controlQuestion:
        "Is deep specialist knowledge an area you want to give particular weight in your view of equivalence?",
      assessmentQuestion:
        "What level of specialist knowledge depth does this role normally and lastingly require?",
      anchor1:
        "Established and well-documented professional knowledge within a clearly bounded area. Known methods are enough for familiar questions.",
      anchor3:
        "Deepened specialist knowledge and established professional methodology are used independently for recurring and more demanding questions in the field.",
      anchor5:
        "Very deep specialist knowledge is used for the hardest questions in the field. The knowledge contributes to developing methods, quality levels or professional practice.",
    },
    "knowledge-breadth": {
      name: "Knowledge breadth and cross-disciplinary understanding",
      shortUiText:
        "The ability to connect several knowledge areas and understand how they relate.",
      fullDefinition:
        "Covers the need to combine knowledge from several different areas, for example business, technology, data, product and operations. The criterion concerns understanding of the connections and trade-offs between those areas. It does not concern the depth of a single professional field or the number of contacts and collaboration partners.",
      measures:
        "Breadth of knowledge areas, understanding of the connections between areas, the ability to make trade-offs between different perspectives.",
      notMeasures:
        "Deep specialist knowledge within one area, the number of meetings, stakeholders or points of contact, organisational reach.",
      whenSuitable:
        "Choose this when an overall view and the ability to unite several knowledge areas should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for many points of contact. If it is mainly about deep professional knowledge within one area, 7.1 is more precise.",
      controlQuestion:
        "Is the ability to unite several knowledge areas central to how the business creates value?",
      assessmentQuestion:
        "What level of cross-disciplinary breadth does this role normally and lastingly require?",
      anchor1:
        "One main knowledge area is used. Connections to other areas are rarely needed.",
      anchor3:
        "A few established knowledge areas are combined independently, with an understanding of how they affect each other.",
      anchor5:
        "Many distinct knowledge areas are connected in a way that shapes how larger solutions, offerings or ways of working are designed.",
    },
    "formal-qualifications": {
      name: "Formal qualification, authorisation and certification requirements",
      shortUiText: "Mandatory licence, authorisation or certification.",
      fullDefinition:
        "Covers formal requirements that must be met in order to perform, approve, sign for or be responsible for a certain type of activity. Examples are a professional licence, statutory authorisation and mandatory certification. The criterion concerns mandatory requirements, not education, courses or degrees that are a merit but not a necessity.",
      measures:
        "Mandatory professional licence, statutory or business-mandated authorisation, mandatory certification.",
      notMeasures:
        "General level of education, voluntary courses, a prestigious degree with no authorisation requirement attached.",
      whenSuitable:
        "Choose this when mandatory licences, authorisations or certifications should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it when education is mainly a route to knowledge that 7.1 Knowledge depth and specialist level already captures.",
      controlQuestion:
        "Should mandatory licences, authorisations or certifications carry through into your view of equivalence?",
      assessmentQuestion:
        "What level of formal qualification, licensing or certification does this role normally and lastingly require?",
      anchor1:
        "No mandatory requirement, or a basic and clearly bounded requirement with limited renewal or scope.",
      anchor3:
        "An established professional licence or certification that is a recurring and independent condition for practising in a field.",
      anchor5:
        "Advanced or business-critical authorisation required in order to approve, sign for or be responsible for activity with very large consequences.",
    },
    "domain-knowledge": {
      name: "Domain and business knowledge",
      shortUiText:
        "Deep knowledge of the industry, product, customer environment or business context.",
      fullDefinition:
        "Covers knowledge of the context the business operates in, for example industry, product, customer environment, business model or regulatory framework. The criterion concerns context-specific knowledge that is not quickly replaced by general professional knowledge. It does not concern the ordinary familiarity with an organisation that is built up through onboarding and experience over time.",
      measures:
        "Industry knowledge, product and customer knowledge, knowledge of the business model or regulatory context.",
      notMeasures:
        "General professional skill, ordinary familiarity with the organisation, formal authorisation.",
      whenSuitable:
        "Choose this when specific knowledge of the business context should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it when general professional knowledge and ordinary onboarding are enough to understand the business context.",
      controlQuestion:
        "Do you want to weigh in how much business and industry knowledge different areas need?",
      assessmentQuestion:
        "What level of domain and business knowledge does this role normally and lastingly require?",
      anchor1:
        "Knowledge of a clearly bounded product, process or customer context.",
      anchor3:
        "Established and independent knowledge of the business context that is not quickly replaced by general professional knowledge.",
      anchor5:
        "Very deep and hard-to-replace knowledge of the industry, market, customers or regulatory framework that shapes important choices and ways of working.",
    },
    "advisory-judgment": {
      name: "Advisory and judgment competence",
      shortUiText:
        "Qualified advice and professional judgment as a basis for other people's decisions.",
      fullDefinition:
        "Covers qualified advice as a recurring part of what the business offers, or as decisive decision support for customers, partners or internal decision-makers. It includes weighing facts, assessing uncertain or conflicting information and formulating advice or recommendations that others use in their own choices. The criterion concerns the quality of the advice and judgment. It does not concern the formal right to take the final decision.",
      measures:
        "Qualified assessment of information, advice and recommendations, professional judgment in questions involving trade-offs.",
      notMeasures:
        "Formal decision mandate, sharing general information, specialist knowledge in itself.",
      whenSuitable:
        "Choose this when qualified advice and professional judgment should carry particular weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for knowledge sharing or routine answers. The advice has to matter clearly for choices or decisions.",
      controlQuestion:
        "Is qualified advice and professional judgment something you want to give weight in your view of equivalence?",
      assessmentQuestion:
        "What level of advisory and judgment competence does this role normally and lastingly require?",
      anchor1:
        "Background material or uncomplicated advice within a clearly bounded area, supported by established guidance.",
      anchor3:
        "Independent and established professional advice within an area, based on weighing the relevant information.",
      anchor5:
        "Advice and assessments in highly advanced or sensitive questions that matter greatly for the business's choices or its handling of risk.",
    },
    "complexity-ambiguity": {
      name: "Complexity and ambiguity",
      shortUiText:
        "Difficulty, uncertainty and ambiguity in the questions that have to be handled.",
      fullDefinition:
        "Covers the degree of uncertainty, conflicting requirements, unclear goals and absence of ready-made solutions. The criterion concerns the nature of the problems themselves. It does not concern the amount of analysis spent on handling them, work pace or organisational reach.",
      measures:
        "Unclear frames and goals, conflicting requirements and trade-offs, uncertainty and complex dependencies.",
      notMeasures:
        "The extent of analytical work, high workload or pace, specialist knowledge in itself.",
      whenSuitable:
        "Choose this when handling difficult, unclear or many-sided questions should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for extensive analysis or many simultaneous tasks. Those are captured by 8.2 and 8.4 respectively, if selected.",
      controlQuestion:
        "Do you want to take account of the degree of ambiguity and difficulty in the questions the business has to handle?",
      assessmentQuestion:
        "What level of complexity and ambiguity does this role normally and lastingly handle?",
      anchor1:
        "Clearly defined questions, established methods and predictable situations.",
      anchor2:
        "Recurring variations and simpler deviations are handled by choosing between known alternatives.",
      anchor3:
        "Complex questions within established frames, where analysis, prioritisation and adaptation are needed.",
      anchor4:
        "Advanced, cross-functional or partly ambiguous problems are handled where established solutions are not always enough.",
      anchor5:
        "Highly complex or strategically significant questions with high uncertainty, where new approaches or long-term solutions have to be designed.",
    },
    "analytical-effort": {
      name: "Analytical and problem-solving effort",
      shortUiText:
        "The extent of systematic analysis, troubleshooting and problem solving.",
      fullDefinition:
        "Covers the systematic analysis, troubleshooting, modelling, diagnostics, testing and calculation needed to arrive at solutions. The criterion concerns the analytical effort. It does not concern merely that the problem is unclear, or the specialist knowledge behind the analysis.",
      measures:
        "Systematic analysis, troubleshooting and diagnostics, modelling, testing and calculation.",
      notMeasures:
        "Ambiguity in the problem itself, specialist knowledge in itself, temporary high workload.",
      whenSuitable:
        "Choose this when systematic analysis and problem-solving work should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for unclear questions. There has to be a recurring and distinct element of analysis, troubleshooting or diagnostics.",
      controlQuestion:
        "Should the extent of systematic analysis and problem-solving work carry weight in your view of equivalence?",
      assessmentQuestion:
        "What level of analytical and problem-solving effort does this role normally and lastingly carry?",
      anchor1:
        "Uncomplicated analysis or troubleshooting in a clearly bounded question, following established steps.",
      anchor3:
        "Independent and established analysis, diagnostics or systematic problem solving within an area.",
      anchor5:
        "Highly advanced or extensive analysis, modelling or diagnostics of great significance for the business's ability to solve critical or recurring problems.",
    },
    "communication-effort": {
      name: "Communication and relationship-demanding work",
      shortUiText:
        "Requirements for qualified communication, negotiation and handling conflicting interests.",
      fullDefinition:
        "Covers the difficulty of communication, negotiation, influence, conflict handling and translation between different needs and interests. The criterion concerns the communicative and relational effort. It does not concern the number of contacts, organisational reach or business responsibility.",
      measures:
        "Negotiation and influence, handling difficult conversations and conflicts, translation between different needs and interests.",
      notMeasures:
        "Number of contacts or meetings, customer or revenue responsibility, organisational reach.",
      whenSuitable:
        "Choose this when qualified communication, negotiation and handling conflicting interests should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for many meetings or customer contacts. The difficulty of the communication has to be what is prioritised.",
      controlQuestion:
        "Should qualified communication, negotiation and handling conflicting interests carry weight in your view of equivalence?",
      assessmentQuestion:
        "What level of communication and relationship effort does this role normally and lastingly carry?",
      anchor1:
        "Clearly bounded and largely routine communication with established counterparts.",
      anchor3:
        "Independent and recurring communication, negotiation or conflict handling within established frames.",
      anchor5:
        "Highly advanced or sensitive communication, negotiation or conflict handling where the outcome matters greatly for the business's relationships or choices.",
    },
    "operational-intensity": {
      name: "Operational intensity and simultaneous demands",
      shortUiText:
        "Requirements to handle several simultaneous flows and prioritise continuously.",
      fullDefinition:
        "Covers requirements for attention, the ability to handle several things at once, and continuous prioritisation between flows in normal operation. Examples might be customer cases, alarms, deliveries or operational flows. The criterion concerns a stable and structural requirement, not temporary peaks, shortage of resources or poor planning.",
      measures:
        "Several simultaneous flows, continuous prioritisation, attention under time pressure in normal operation.",
      notMeasures:
        "Temporary high workload, understaffing, complexity in the subject matter.",
      whenSuitable:
        "Choose this when handling and prioritising several simultaneous flows should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it to compensate for temporary work peaks or shortage of resources. The requirement has to be a lasting part of how the business works.",
      controlQuestion:
        "Do you want to weigh in requirements to handle several simultaneous flows and prioritise continuously?",
      assessmentQuestion:
        "What level of operational intensity and simultaneous demands does this role normally and lastingly carry?",
      anchor1:
        "One flow or one task at a time within a clearly bounded rhythm.",
      anchor3:
        "Several established and simultaneous flows are handled independently with continuous prioritisation.",
      anchor5:
        "Very high operational intensity across many simultaneous flows, where the wrong prioritisation can quickly have large consequences for the business.",
    },
    "physical-sensory": {
      name: "Physical or sensory effort",
      shortUiText:
        "Recurring physical load, precision or sustained sensory concentration.",
      fullDefinition:
        "Covers physical load, ergonomically demanding elements, precision and concentration using sight, hearing or other senses. The criterion concerns demands on the body and on attention. It does not concern risk environments, exposure to hazardous substances, or the consequences for the business if something goes wrong.",
      measures:
        "Physical and ergonomic load, precision requirements, sustained concentration using the senses.",
      notMeasures:
        "Risk environment or exposure, general stress, consequences of errors.",
      whenSuitable:
        "Choose this when physical load, precision or sensory concentration should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for risk in the work environment. If exposure and protective measures are the central point, 10.1 fits better.",
      controlQuestion:
        "Should recurring physical load, precision or sustained concentration carry weight in your view of equivalence?",
      assessmentQuestion:
        "What level of physical or sensory effort does this role normally and lastingly carry?",
      anchor1:
        "Light and occasional physical or sensory demands within a clearly bounded task.",
      anchor3:
        "Recurring physical load, precision elements or sensory concentration as an established part of the area.",
      anchor5:
        "Very demanding and sustained physical or sensory effort where precision and consistent execution are decisive.",
    },
    "scope-impact": {
      name: "Scope and impact",
      shortUiText: "The reach of results and impact in the business.",
      fullDefinition:
        "Covers how far results, choices and deliveries carry through in the business: from a clearly bounded area to teams, functions, several parts of the company or the whole company. The criterion concerns where the effect is felt. It does not concern formal decision rights, people responsibility or budget size in themselves.",
      measures:
        "Reach of results and impact, the extent of the parts of the business affected, lasting consequences for the business's delivery or direction.",
      notMeasures:
        "Formal people responsibility, decision mandate, resource or budget responsibility in itself.",
      whenSuitable:
        "Choose this when the reach of results and impact should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for title, management level, budget size or decision rights. Consider whether one of the separate responsibility criteria captures what should be prioritised more precisely.",
      controlQuestion:
        "Is it relevant for you to weigh in how far results and impact reach in the business?",
      assessmentQuestion:
        "How far does this role's normal and lasting impact reach?",
      anchor1:
        "Results and impact are mainly limited to a clearly bounded area or a single delivery.",
      anchor2:
        "Impact reaches a bounded work area or a recurring delivery within a team.",
      anchor3:
        "Results and impact reach a clear area and affect deliveries or priorities in neighbouring parts of the business.",
      anchor4:
        "Impact reaches several teams, a function or a significant part of the business through choices, priorities or solutions with lasting consequences.",
      anchor5:
        "Results and impact reach several parts of the company or company level and matter for overall direction, results or the ability to succeed.",
    },
    "autonomy-mandate": {
      name: "Autonomy and decision mandate",
      shortUiText:
        "Independence and the mandate to make trade-offs and take decisions.",
      fullDefinition:
        "Covers the mandate to independently make trade-offs and take decisions within a defined area. The criterion concerns the room there is to choose direction, prioritise between alternatives and decide on suitable solutions within the area. It does not concern how far the effect of the decision reaches, how large the consequences of an error can be, or what kind of responsibility the decision covers.",
      measures:
        "Mandate to take independent decisions, room to choose between relevant alternatives, mandate to prioritise and make trade-offs, degree of independence within a defined area.",
      notMeasures:
        "The reach of results or impact, the consequence of incorrect decisions, people, resource or customer responsibility in itself, the company's internal approval processes or forms of consultation.",
      whenSuitable:
        "Choose this when an independent decision mandate should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it to describe how far the effect of the decision reaches, what the consequences of an error can be, or what kind of responsibility the decision covers. Those are captured by other responsibility criteria if selected.",
      controlQuestion:
        "Should the degree of independent decision mandate carry weight in your view of equivalence?",
      assessmentQuestion:
        "What level of autonomy and decision mandate does this role normally and lastingly hold?",
      anchor1:
        "Limited mandate to choose between clearly stated alternatives within established instructions.",
      anchor3:
        "Independent mandate to make established trade-offs, prioritise between alternatives and take decisions within a defined area.",
      anchor5:
        "Very broad mandate to make trade-offs and take decisions that set direction, principles or priorities for several parts of the business.",
    },
    "risk-consequence": {
      name: "Risk and consequence",
      shortUiText:
        "The seriousness of the possible consequences of errors, shortcomings or incorrect decisions.",
      fullDefinition:
        "Covers what consequences errors, shortcomings or incorrect decisions can have for, for example, customers, quality, finances, safety, information, compliance and trust. The criterion concerns the consequence if something goes wrong. It does not concern who holds the formal responsibility for checking that rules or protections work.",
      measures:
        "Consequences for customer, quality and delivery, consequences for safety, information and compliance, financial and brand consequences.",
      notMeasures:
        "The individual's experience of stress, budget size in itself, formal control responsibility.",
      whenSuitable:
        "Choose this when differences in the possible consequences of errors and shortcomings should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it to describe how pressured or demanding something feels. Assess the factual and possible consequence if something goes wrong.",
      controlQuestion:
        "Are differences in the consequences errors or shortcomings can have relevant to weigh into your view of equivalence?",
      assessmentQuestion:
        "What level of risk and consequence does this role's decisions and work normally and lastingly carry?",
      anchor1:
        "Errors or shortcomings normally have limited and easily corrected consequences within a bounded area.",
      anchor2:
        "Errors or shortcomings can affect the team's quality, efficiency or delivery and normally require correction within established processes.",
      anchor3:
        "Errors, shortcomings or incorrect decisions can have clear consequences for customer, delivery, quality, finances or compliance within an area.",
      anchor4:
        "Errors, decisions or shortcomings can have significant consequences for several parts of the business, key customers, critical processes or regulatory compliance.",
      anchor5:
        "Errors or shortcomings can have very large, long-lasting or business-critical consequences for safety, compliance, trust, finances or the business's continued ability to function.",
    },
    "people-leadership": {
      name: "Leadership and people responsibility",
      shortUiText:
        "Responsibility for leading people, coordinating activity and creating results through others.",
      fullDefinition:
        "Covers responsibility for leading and coordinating people or parts of the business in order to create results through others. It can include responsibility for priorities, allocation of work, direction, developing ways of working or coordinating delivery. Formal people responsibility is included when the responsibility also covers employees' goals, development, performance and working environment. The criterion concerns leadership responsibility through others, not specialist influence, project coordination or a large decision mandate of one's own.",
      measures:
        "Responsibility for leading and coordinating work through others, responsibility for direction, priorities and delivery in a part of the business, responsibility for developing ways of working or capacity through others, formal responsibility for employees' goals, development and performance.",
      notMeasures:
        "Specialist influence without responsibility for others' work or for a part of the business, temporary coordination of individual tasks, project management without lasting responsibility for people or a part of the business, a decision mandate of one's own without responsibility for creating results through others.",
      whenSuitable:
        "Choose this when responsibility for leading people or parts of the business through others should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely because coordination, specialist support or project management occurs. There has to be a lasting responsibility for direction, priorities, delivery or development through others.",
      controlQuestion:
        "Should responsibility for leading people or parts of the business through others carry weight in your view of equivalence?",
      assessmentQuestion:
        "What level of people and management responsibility does this role normally and lastingly carry?",
      anchor1:
        "Limited responsibility for coordinating others' work within a clearly bounded area. No lasting responsibility for direction, delivery or employees' development.",
      anchor3:
        "Lasting responsibility for leading and coordinating a team, a workflow or a part of the business through others. The responsibility covers priorities, allocation of work and delivery. Formal people responsibility may occur but is not required at this level.",
      anchor5:
        "Extensive responsibility for leading a larger part of the business or several teams through others. The responsibility covers direction, capacity, results and development over time. Formal people responsibility for other managers or a larger organisation is normally included at this level.",
    },
    "resource-capacity": {
      name: "Resource and capacity responsibility",
      shortUiText:
        "Responsibility for prioritising limited resources between the needs of the business.",
      fullDefinition:
        "Covers responsibility for making trade-offs between competing needs when resources are limited. Resources can be, for example, time, budget, equipment, stock, staffing or delivery capacity. The criterion concerns the prioritisation needed for resources and capacity to be used where they do the business most good. The criterion does not concern leading, developing or coordinating people as such. Nor does it concern routine budget follow-up, purchasing or allocation within small and predetermined frames.",
      measures:
        "Prioritisation between competing needs, allocation of limited resources and capacity, trade-offs between available resources, needs and delivery capability.",
      notMeasures:
        "Leading or developing people, routine budget follow-up, purchasing within small fixed frames, business results in themselves.",
      whenSuitable:
        "Choose this when responsibility for prioritising limited resources between the needs of the business should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for budget follow-up, purchasing or coordinating people. There has to be a lasting responsibility for trade-offs between competing needs and limited resources.",
      controlQuestion:
        "Do you want to give weight to responsibility for prioritising limited resources between different needs in the business?",
      assessmentQuestion:
        "What level of resource and capacity responsibility does this role normally and lastingly carry?",
      anchor1:
        "Prioritisation within a small and clearly bounded set of resources, where the effect of the choices is limited and easy to correct.",
      anchor3:
        "Independent prioritisation between established needs and limited resources or capacity within an area.",
      anchor5:
        "Prioritisation between very significant or business-critical needs and resources, where the trade-offs affect several parts of the business's ability to deliver.",
    },
    "business-customer": {
      name: "Business and customer responsibility",
      shortUiText:
        "Responsibility for important customers, revenue or business results.",
      fullDefinition:
        "Covers a lasting responsibility for creating, securing or developing business value through, for example, customer relationships, revenue streams, contracts, business portfolios or market position. The criterion concerns responsibility that is part of the business. It does not concern individual sales results, commission or skill in an isolated negotiation.",
      measures:
        "Responsibility for customer relationships, responsibility for revenue or a business portfolio, responsibility for business results or market position.",
      notMeasures:
        "Customer contact in itself, individual sales performance, negotiating skill in itself.",
      whenSuitable:
        "Choose this when responsibility for customers, revenue or business results should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for customer contact or sales. There has to be a lasting responsibility for customer value, revenue or business results.",
      controlQuestion:
        "Is responsibility for customers, revenue or business results something you want to give particular weight in your view of equivalence?",
      assessmentQuestion:
        "What level of business and customer responsibility does this role normally and lastingly carry?",
      anchor1:
        "Support to an established customer relationship or business activity within a bounded account or area.",
      anchor3:
        "Independent and established responsibility for a customer relationship, revenue stream or business portfolio.",
      anchor5:
        "Responsibility for customers, revenue or business areas of great significance to the company, affecting market position or future business.",
    },
    "compliance-control": {
      name: "Information, security or compliance responsibility",
      shortUiText:
        "Formal responsibility for control, protection, quality assurance or regulatory compliance.",
      fullDefinition:
        "Covers formal responsibility for checking, quality-assuring or ensuring that important requirements are followed, for example within information security, quality, safety or regulation. The criterion concerns responsibility for the requirements being applied correctly. It does not concern the general obligation to follow rules or to be risk-aware.",
      measures:
        "Control and quality assurance responsibility, responsibility for protecting information or safety, responsibility for the correct application of requirements and regulation.",
      notMeasures:
        "General risk awareness, following routines that someone else is responsible for, the consequence if an error occurs.",
      whenSuitable:
        "Choose this when formal responsibility for control, protection and compliance should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it when the area only involves following established control routines. There has to be a clear responsibility for the controls and requirements working.",
      controlQuestion:
        "Should formal responsibility for control, protection and compliance be weighed into your view of equivalence?",
      assessmentQuestion:
        "What level of information, security or regulatory compliance responsibility does this role normally and lastingly carry?",
      anchor1:
        "Established control routines are followed within a clearly bounded area, without independent control responsibility.",
      anchor3:
        "Independent and formal responsibility for protection, quality assurance or compliance checking within an area.",
      anchor5:
        "Highly advanced or business-critical control responsibility where interpretations and ways of working govern how important requirements are followed in several parts of the business.",
    },
    "safety-exposure": {
      name: "Safety and exposure conditions",
      shortUiText:
        "Lasting exposure to physical, chemical, biological or environmental risks.",
      fullDefinition:
        "Covers recurring work in environments with actual physical, chemical, biological or environmental exposure and a requirement for protective measures. Examples are noise, hazardous substances, infection, height, heat, cold and dangerous machinery. The criterion concerns the working condition, not physical effort or the consequence for the business if something goes wrong.",
      measures:
        "Risk environment and actual exposure, recurring need for protective measures, special safety conditions in the environment.",
      notMeasures:
        "Physical or sensory effort in itself, formal safety responsibility, commercial or organisational risk.",
      whenSuitable:
        "Choose this when special safety and exposure conditions should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for safety responsibility or decision risk. It has to be about actual and lasting exposure in the business's environments.",
      controlQuestion:
        "Is work under special safety or exposure conditions something you want to take into account in your view of equivalence?",
      assessmentQuestion:
        "What level of safety and exposure does this role normally and lastingly work under?",
      anchor1:
        "Occasional and low exposure under clearly bounded conditions with standardised protective measures.",
      anchor3:
        "Recurring exposure in an established risk environment that requires consistent use of protective measures.",
      anchor5:
        "Very demanding or business-critical exposure conditions where protection, safety routines and correct conduct are decisive for safe operation.",
    },
    "on-call": {
      name: "On-call, standby and availability requirements",
      shortUiText:
        "Recurring on-call duty, standby or requirements for rapid availability.",
      fullDefinition:
        "Covers recurring requirements to be reachable or able to act outside ordinary working hours, or to be able to respond immediately during a shift. The criterion concerns planned or expected standby that is a stable part of the business's conditions. It does not concern occasional overtime, voluntary flexibility or temporarily high workload.",
      measures:
        "On-call duty and standby, requirements for rapid availability, recurring call-outs outside ordinary working hours.",
      notMeasures:
        "Occasional overtime, informal expectations to respond, generally high workload.",
      whenSuitable:
        "Choose this when on-call duty, standby or requirements for rapid availability should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it when availability only arises in occasional crises or has no clear and recurring basis in the business.",
      controlQuestion:
        "Is recurring on-call duty, standby or rapid availability a working condition you want to take into account in your view of equivalence?",
      assessmentQuestion:
        "What level of on-call, standby and availability does this role normally and lastingly carry?",
      anchor1: "Occasional and clearly bounded standby at low frequency.",
      anchor3:
        "Established and recurring standby or availability outside ordinary working hours.",
      anchor5:
        "Very demanding standby with frequent or immediate obligation to act, where the business depends heavily on rapid availability.",
    },
    "irregularity-mobility": {
      name: "Irregularity, mobility and place-bound work",
      shortUiText:
        "Lasting requirements for irregular hours, travel or work at particular places.",
      fullDefinition:
        "Covers lasting requirements for irregular working hours, extensive travel or place-bound work, for example field operations, shift work or international presence. The criterion concerns a stable and structural condition in the business. It does not concern occasional travel, personal preferences or temporary projects.",
      measures:
        "Irregular working hours, extensive and recurring travel, field, shift or place-bound work.",
      notMeasures:
        "Occasional business trips, temporary projects, on-call duty or standby outside working hours.",
      whenSuitable:
        "Choose this when irregular hours, mobility or place-bound work should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it when the requirement is temporary or occurs rarely without being a stable part of the business's conditions.",
      controlQuestion:
        "Do you want to weigh in lasting requirements for irregular hours, travel or place-bound work?",
      assessmentQuestion:
        "What level of irregularity, mobility or location-boundedness does this role normally and lastingly carry?",
      anchor1:
        "Recurring but limited requirements for irregular hours, travel or place-bound work.",
      anchor3:
        "An established and recurring pattern of irregular hours, travel or place-bound work.",
      anchor5:
        "Very extensive requirements for shift work, travel, field work or international presence that clearly affect planning and staffing.",
    },
    "restricted-environments": {
      name: "Special security, confidentiality or controlled environments",
      shortUiText:
        "Work under special rules for access, confidentiality, security or control.",
      fullDefinition:
        "Covers working conditions with special restrictions on access, confidentiality, security or control, for example security-classified environments or information requiring special protection. The criterion concerns the rules and restrictions that apply in the environment. It does not concern responsibility for designing, following up or checking information security.",
      measures:
        "Special access restrictions, confidentiality and security restrictions, control requirements that affect how the work can be carried out.",
      notMeasures:
        "Formal responsibility for information security, general duty of confidentiality, general risk awareness.",
      whenSuitable:
        "Choose this when special access, confidentiality or security restrictions should carry weight in your view of equivalence.",
      whenNotSuitable:
        "Do not choose it merely for confidential information. The restrictions have to be special, recurring and to affect how the work can be carried out.",
      controlQuestion:
        "Should work under special access, confidentiality or security restrictions carry weight in your view of equivalence?",
      assessmentQuestion:
        "What level of security, confidentiality or control restriction does this role normally and lastingly work under?",
      anchor1:
        "Occasional and clearly bounded access or confidentiality restrictions at a low level.",
      anchor3:
        "Established and recurring access, control or security restrictions.",
      anchor5:
        "Very strict or business-critical security, confidentiality or control restrictions that largely govern planning, execution and documentation.",
    },
  },
}
