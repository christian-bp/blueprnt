import type { CriterionKey, TrackKey } from "./standardTemplate"

export interface CriterionContent {
  name: string
  description: string
  helpText: string
  // Anchor texts for scores 0..5, in order.
  anchors: [string, string, string, string, string, string]
  // Per-criterion weighting explanation for weight points 1..5 (File B): what
  // it means to give THIS criterion that weight. Shown in the weight control's
  // hover card. Custom/edited criteria carry no templateKey, so getModel returns
  // null and the UI falls back to the generic level meanings.
  weightLevels: [string, string, string, string, string]
  // Compliance evidence (kriterieurvalsprotokoll + bias-granskning) shown in the
  // Method tab and metodbilaga. Template content: re-localized to the viewer's
  // locale until HR edits it. Must satisfy isDocumented (purpose, whyRelevant,
  // biasComment non-empty; biasRisk set). overlapNotes/biasAction may be "".
  compliance: {
    purpose: string
    whyRelevant: string
    overlapNotes: string
    biasRisk: "low" | "medium" | "high"
    biasComment: string
    biasAction: string
  }
}

export interface StandardTemplateContent {
  modelName: string
  criteria: Record<CriterionKey, CriterionContent>
  trackNames: Record<TrackKey, string>
}

// English content for the standard template. This is a translation draft of the
// Swedish source (standardTemplate.content.sv.ts) and must be reviewed by a native
// speaker before it ships to users. All structural decisions live in
// standardTemplate.ts; this module carries only prose. description is the short
// criterion description shown inline; helpText is the extended description shown
// behind the info help and in the rating flow.
export const standardTemplateContentEn: StandardTemplateContent = {
  modelName: "Standard model",
  criteria: {
    scope: {
      name: "Scope & Impact",
      description:
        "How large an area the role affects, and at what level in the organization the effects are felt.",
      helpText:
        "This criterion describes the role's organizational reach. It covers both the extent of the responsibility and how far the effects of the role's work, decisions or priorities extend. The impact can be limited to its own work area or a team, but it can also span several functions or the whole company.",
      anchors: [
        "Responsible for own tasks within a clearly limited area.",
        "Impact within the own team; responsible for well-defined deliverables.",
        "Ownership of a sub-area or recurring process; impact within a smaller function.",
        "Responsible for a larger area, project or flow; affects several teams/functions.",
        "Affects a business/functional area; defines direction for larger parts of the organization.",
        "Company-wide impact; strategic responsibility and direct effect on the organization's results.",
      ],
      weightLevels: [
        "The company wants the extent of responsibility and organizational impact to have only a limited effect on the role evaluation. Roles with shorter reach should therefore not be rewarded particularly strongly on this dimension.",
        "The company considers scope and impact relevant, but it should normally weigh lighter than the model's more prioritized criteria. Broader responsibility should influence the evaluation, but not be a main driver.",
        "The company wants scope and impact to have a clear and balanced place in the model. Roles with greater organizational reach should make a difference, but without this dimension dominating the evaluation.",
        "The company wants this criterion to have a strong influence in the model. Differences in scope, responsibility and impact, from team level to company level, should clearly affect how roles are valued relative to one another.",
        "The company sees scope and impact as one of the most decisive dimensions in the model. Roles with broad organizational reach and far-reaching impact should therefore be valued clearly higher when this criterion is rated high.",
      ],
      compliance: {
        purpose:
          "Measures the role's organizational reach: how large an area it affects and how far the effects of its work, decisions and priorities extend, independent of person or hierarchy level.",
        whyRelevant:
          "Reach and impact reflect the role's contribution to the organization's results. They are judged by actual organizational effect, not by title or visible mandate, which keeps the criterion gender-neutral.",
        overlapNotes:
          "Overlaps partly with Autonomy (decision authority) and People/Management Responsibility; here the focus is specifically how far the role's effects reach in the organization.",
        biasRisk: "low",
        biasComment:
          "Bias risk (diagnostic question 3): rewarding visible mandate more than actual impact can favour traditionally visible roles. The level descriptions are based on effect and responsibility rather than rank, and are gender-neutral (question 5).",
        biasAction:
          "The level anchors describe actual reach and results rather than formal position, so roles without a visible title can still be rated high.",
      },
    },
    risk: {
      name: "Risk & Consequence",
      description:
        "What consequences the role's decisions, work or shortcomings can have for the business.",
      helpText:
        "This criterion describes the consequences the role can have for the business if something goes wrong, is missed or is handled inadequately. It covers the impact on, for example, quality, delivery, finances, compliance, security, customer relations and brand. The focus is on the scope and significance of the consequences for the business.",
      anchors: [
        "Low impact; errors can be corrected easily.",
        "Affects mainly own work or team.",
        "Errors affect deliverables or quality on a smaller scale.",
        "Errors have noticeable consequences for processes, deadlines or customer relations.",
        "High impact on finances, reputation or compliance.",
        "Critical impact on the organization's results, strategy or regulatory compliance.",
      ],
      weightLevels: [
        "The company wants risk and consequence to have only a limited effect on the role evaluation. Roles where errors carry greater consequences should therefore not be rewarded particularly much on this dimension.",
        "The company judges risk and consequence to be relevant, but this criterion should normally weigh lighter than the most prioritized dimensions in the model.",
        "The company wants risk and consequence to have a balanced place in the model. Differences in impact on quality, compliance, operations or brand should be taken into account at a normal level.",
        "The company wants risk and consequence to have a strong influence on how roles are valued. Roles where errors can carry clear consequences for operations, customers, finances, compliance or trust should therefore be rewarded higher.",
        "The company sees risk and consequence as one of the most decisive factors in the model. High role scores on this dimension should therefore carry very large weight in the overall evaluation, and thereby normally in the relative pay positioning as well.",
      ],
      compliance: {
        purpose:
          "Measures the consequences the role's decisions, work or shortcomings can have for the business: quality, delivery, finances, compliance, security, customer relations and brand.",
        whyRelevant:
          "The scale of the consequences is part of the role's value to the business. It is judged by what is actually at stake, not by how visible or dramatic the work is, which keeps the criterion gender-neutral.",
        overlapNotes:
          "Overlaps partly with Scope & Impact; here the focus is the consequences of errors or shortcomings rather than reach itself.",
        biasRisk: "low",
        biasComment:
          "Bias risk (diagnostic questions 1 and 2): visible operational or technical risk can be over-valued while quiet quality, care or compliance work is under-valued. The level descriptions also cover quality, compliance and relationships, and are gender-neutral (question 5).",
        biasAction:
          "The anchors include consequences for quality, compliance and customer relations, not only financial or technical failures, so different kinds of responsibility are judged on equal terms.",
      },
    },
    complexity: {
      name: "Complexity & Ambiguity",
      description:
        "How complex, multifaceted and ambiguous the questions the role handles are.",
      helpText:
        "This criterion describes the difficulty of the work. It covers technical, business and organizational complexity, as well as the degree of uncertainty in situations where the information, direction or solution is not clear from the outset. The criterion captures how many variables, dependencies and trade-offs the role typically involves.",
      anchors: [
        "Work is routine and well defined with clear instructions.",
        "Handles standardized tasks with low variation.",
        "Solves tasks with some variation and a need for own analysis.",
        "Works with several dependencies and trade-offs; requires interpretation and prioritization.",
        "High complexity; handles conflicting requirements and unclear conditions.",
        "Extremely complex situations; drives progress in unknown/innovative areas with high uncertainty.",
      ],
      weightLevels: [
        "The company wants complexity and ambiguity to have only a small effect on the overall role evaluation. Roles with more complex and uncertain conditions should therefore not be rewarded particularly much on this dimension.",
        "The company judges complexity and uncertainty to be relevant, but this dimension should normally weigh lighter than the most prioritized criteria.",
        "The company wants complexity and ambiguity to have a balanced and clear place in the model. Roles that require problem solving in more uncertain or hard-to-interpret contexts should make a normal difference in the evaluation.",
        "The company wants complexity and ambiguity to have a strong influence on the role evaluation. Roles that handle difficult, ambiguous or uncertain problems should therefore be rewarded clearly higher in the model.",
        "The company sees complexity and ambiguity as one of the most decisive factors in the model. This means that roles which receive high assessment scores on this criterion should also carry large weight in the overall evaluation, and thereby normally be valued relatively higher in pay terms.",
      ],
      compliance: {
        purpose:
          "Measures the difficulty of the work: technical, business and organizational complexity, and the degree of uncertainty when information, direction or solution is not given from the outset.",
        whyRelevant:
          "The ability to handle many variables, dependencies and trade-offs is a central part of a role's value. It is judged by the actual complexity of the work, not by how technical it appears, which keeps the criterion gender-neutral.",
        overlapNotes:
          "Overlaps partly with Knowledge Depth/Breadth; here the focus is the complexity and uncertainty of the problems rather than the knowledge required.",
        biasRisk: "low",
        biasComment:
          "Bias risk (diagnostic question 2): technical complexity can be over-valued while relational, coordinating or ambiguous complexity is under-valued. The level descriptions also cover organizational and business complexity, and are gender-neutral (question 5).",
        biasAction:
          "The anchors describe complexity broadly (technical, business and organizational) so that coordinating and ambiguous contexts also count as complex.",
      },
    },
    autonomy: {
      name: "Autonomy & Decision Authority",
      description:
        "How independent the role is, and what mandate it has to make decisions.",
      helpText:
        "This criterion describes the role's room to act and its decision level. It covers the degree of independence, how much direction the role works under, and what kind of decisions naturally fall within the assignment. The criterion captures both the freedom to act and the mandate the role has to influence direction, priorities or outcomes.",
      anchors: [
        "Works closely directed; follows instructions.",
        "Independent in everyday tasks within defined frameworks.",
        "Takes own initiatives and priorities within its area.",
        "Makes tactical decisions that affect a team or workflow.",
        "Makes strategic decisions within a domain and sets direction for a sub-area.",
        "Makes decisions that affect several domains or the entire organization.",
      ],
      weightLevels: [
        "The company wants the degree of independence and decision authority to have only a small effect on the overall role evaluation.",
        "The company considers autonomy and decision level relevant, but it should normally weigh lighter than the more prioritized criteria in the model.",
        "The company wants autonomy and decision authority to have a clear and balanced place in the model. The role should be affected by how independently it operates, but without giving this criterion extra strong weight.",
        "The company wants this criterion to have a strong influence. Roles with greater independence and higher decision authority should therefore carry clearly more weight in the overall evaluation.",
        "The company sees autonomy and decision authority as one of the most decisive dimensions in the model. Roles rated high on independence and decision level should therefore be valued clearly higher relative to other roles.",
      ],
      compliance: {
        purpose:
          "Measures the role's room to act and its decision level: degree of independence, how much direction it works under, and the mandate it has to influence direction, priorities and outcomes.",
        whyRelevant:
          "Independence and decision authority reflect the responsibility the role carries. They are judged by the decisions actually made, not by formal title, which keeps the criterion gender-neutral.",
        overlapNotes:
          "Overlaps partly with Scope & Impact and People/Management Responsibility; here the focus is independence and decision authority rather than reach or leading others.",
        biasRisk: "medium",
        biasComment:
          "Bias risk (diagnostic question 3): visible decision mandate can be over-valued relative to actual impact, which can favour formally mandated roles over senior specialists with real influence. The level descriptions are gender-neutral (question 5).",
        biasAction:
          "The anchors also cover independent initiative and problem solving, not only formal decision mandate, so real influence without a title can be rated high.",
      },
    },
    stakeholders: {
      name: "Stakeholder Breadth",
      description:
        "How broad and varied the role's collaboration with internal and external parties is.",
      helpText:
        "This criterion describes the breadth of the role's contact surfaces and collaboration needs. It covers internal and external stakeholders, cross-functional collaboration and the need to coordinate work between different people, teams, functions or external parties. The criterion captures how varied and extensive this collaboration is.",
      anchors: [
        "Collaboration mainly within the own team.",
        "Collaboration within adjacent functions.",
        "Regular cross-functional collaboration.",
        "Coordination with external parties/customers or several internal functions.",
        "Manages a complex stakeholder environment with competing interests.",
        "Represents the organization externally and manages strategic stakeholders.",
      ],
      weightLevels: [
        "The company wants the breadth of collaboration and coordination to have only a small effect on how roles are valued relative to one another.",
        "The company judges stakeholder breadth to be relevant, but the criterion should normally weigh lighter than the most prioritized dimensions in the model.",
        "The company wants stakeholder breadth to have a clear and balanced place in the model. Roles with broad internal or external collaboration should make a normal difference in the evaluation.",
        "The company wants this criterion to have a strong influence. Roles that require broad coordination, many contact surfaces and extensive collaboration should therefore be valued clearly higher.",
        "The company sees stakeholder breadth as one of the most decisive factors in the model. High assessment scores on this dimension should therefore carry large weight in how roles are valued and positioned relative to one another.",
      ],
      compliance: {
        purpose:
          "Measures the breadth of the role's contact surfaces and collaboration needs: internal and external stakeholders, cross-functional collaboration and the need to coordinate work between people, teams and parties.",
        whyRelevant:
          "Broad collaboration and coordination is a real contribution to the business. The criterion makes relational and coordinating work visible; it is judged by the actual extent of the collaboration and is gender-neutral.",
        overlapNotes:
          "Overlaps partly with Scope & Impact; here the focus is the breadth and variety of collaboration rather than the reach of the outcome.",
        biasRisk: "low",
        biasComment:
          "This criterion counters a known bias by explicitly valuing relational and coordinating work (diagnostic question 2). Residual risk (question 3): external, visible representation can be over-valued relative to internal coordination. The level descriptions are gender-neutral (question 5).",
        biasAction:
          "The anchors value internal cross-functional coordination on a par with external representation, so visible external networking does not by itself weigh more.",
      },
    },
    knowledge: {
      name: "Knowledge Depth/Breadth",
      description:
        "What level of specialist knowledge, experience and breadth across several areas the role requires.",
      helpText:
        "This criterion describes the type and level of knowledge the role builds on. It covers specialist depth, practical experience, methodological understanding and the ability to work across several disciplines or areas. The criterion captures whether the role mainly requires depth within one area or a combination of several perspectives and competencies.",
      anchors: [
        "The role requires basic knowledge. The role assumes an introductory level within its area and that tasks can be performed through established routines and instructions.",
        "The role requires solid professional knowledge within a defined area. The role needs clearly defined and established competence within its domain, with the ability to apply standardized working methods.",
        "The role requires in-depth competence and understanding of methods. The role needs to handle more complex tasks, use more advanced methods/tools and have a good understanding of how the area works in practice.",
        "The role requires advanced specialist competence. The role requires deeper knowledge within one or more sub-areas and the ability to handle harder problems, perform analyses and produce solutions that become guiding in the operational work.",
        "The role requires expert competence within a complex domain. The role assumes that the holder defines methods, structures and working practices within its domain and acts as an internal expert in qualified matters.",
        "The role requires domain-leading competence and knowledge development. The role requires the holder to develop new working practices, models or techniques and to set direction and principles for the organization's future capabilities within the area.",
      ],
      weightLevels: [
        "The company wants requirements for deep expertise, experience or cross-disciplinary breadth to have only a limited effect on the overall role evaluation.",
        "The company considers knowledge depth and breadth relevant, but it should normally weigh lighter than the most prioritized criteria.",
        "The company wants knowledge depth and breadth to have a clear and balanced place in the model. Expertise and experience requirements should affect the evaluation at a normal level.",
        "The company wants this criterion to have a strong influence. Roles that require deep specialist knowledge, broad domain understanding or extensive experience should therefore be valued clearly higher in the model.",
        "The company sees knowledge depth and breadth as one of the most decisive dimensions in the model. High scores on this factor should therefore carry strong weight in the overall role evaluation and normally contribute to higher relative pay positioning.",
      ],
      compliance: {
        purpose:
          "Measures the type and level of knowledge the role builds on: specialist depth, practical experience, methodological understanding and the ability to work across several disciplines or areas.",
        whyRelevant:
          "Knowledge level and experience are part of the role's value. The criterion judges actual competence and applied ability, not formal credentials in themselves, which keeps it gender-neutral.",
        overlapNotes:
          "Overlaps partly with Complexity & Ambiguity and Formal Qualifications; here the focus is actual knowledge and experience rather than the complexity of the problems or formal requirements.",
        biasRisk: "low",
        biasComment:
          "Bias risk (diagnostic questions 1 and 4): formally recognized or visible expertise can be over-valued relative to quiet, experience-based knowledge. The level descriptions are based on applied competence, not title or education alone, and are gender-neutral (question 5).",
        biasAction:
          "The anchors value practical experience and applied methodological understanding on a par with formally recognized specialization.",
      },
    },
    financial: {
      name: "Financial Responsibility",
      description:
        "How much responsibility the role has for budget, costs, revenue or financial results.",
      helpText:
        "This criterion describes the role's responsibility for financial resources or financial outcomes. It can cover budget, costs, revenue, profitability, investments or responsibility for a business area, a portfolio or other financial frames. The criterion captures how central the financial dimension is in the role.",
      anchors: [
        "No budget or cost responsibility.",
        "Affects costs indirectly through decisions.",
        "Responsible for a smaller cost frame or part of a project/budget.",
        "Budget responsibility within the own area/team.",
        "Responsible for a larger budget/business area.",
        "Responsible for a significant part of the company's finances or P&L.",
      ],
      weightLevels: [
        "The company wants financial responsibility to have only a limited effect on the overall role evaluation. Budget or results responsibility should therefore not be given particularly large weight in the model.",
        "The company considers financial responsibility relevant, but it should normally weigh lighter than the most prioritized criteria.",
        "The company wants financial responsibility to have a clear and balanced place in the model. Budget impact, cost responsibility or results responsibility should count as a normal part of the evaluation.",
        "The company wants this criterion to have a strong influence. Roles with a clear impact on budget, costs, revenue or financial results should therefore be valued higher relative to other roles.",
        "The company sees financial responsibility as one of the most decisive dimensions in the model. High scores on financial responsibility should therefore carry very strong weight in the overall role evaluation and normally contribute to higher relative pay positioning.",
      ],
      compliance: {
        purpose:
          "Measures the role's responsibility for financial resources or outcomes: budget, costs, revenue, profitability, investments or responsibility for a business area's finances.",
        whyRelevant:
          "Financial responsibility is part of the role's contribution, but it is valued by the degree of actual decision responsibility for the finances, not by the size of the budget in itself, which keeps the criterion gender-neutral.",
        overlapNotes:
          "Overlaps partly with Autonomy (decision authority) and Scope & Impact; here the focus is specifically responsibility for financial frames and results.",
        biasRisk: "medium",
        biasComment:
          "Known bias risk (diagnostic questions 3 and 6): a large budget can be given too much weight relative to complexity, responsibility and specialist knowledge, which can favour traditionally male-dominated budget-holding roles. The level descriptions are gender-neutral (question 5).",
        biasAction:
          "The criterion is kept at a moderate weight in the model so that budget size does not by itself dominate the evaluation, and the levels describe decision responsibility rather than amount alone.",
      },
    },
    people: {
      name: "People/Management Responsibility",
      description:
        "How much responsibility the role has for leading others, organizing work and delivering results through people.",
      helpText:
        "This criterion describes the role's responsibility for leading others. It covers formal people responsibility, operational supervision, team leadership and responsibility for larger organizational units or other managers. The criterion captures both the scope of the leadership assignment and the responsibility for capacity, prioritization, development and direction through others.",
      anchors: [
        "No people or management responsibility.",
        "Operational direction of work, but no HR responsibility.",
        "People responsibility for staff (M1).",
        "Manager over several teams or first-line managers (M2).",
        "Function head with several management layers or a larger organization.",
        "Strategic leader at company level (Head/Director/C-level).",
      ],
      weightLevels: [
        "The company wants people and management responsibility to have only a limited effect on the overall role evaluation. Formal leadership should therefore not, in itself, drive the evaluation particularly much.",
        "The company judges people and management responsibility to be relevant, but it should normally weigh lighter than the most prioritized criteria in the model.",
        "The company wants people and management responsibility to have a clear and balanced place in the model. Leading others should affect the evaluation, but without being given particularly reinforced weight.",
        "The company wants this criterion to have a strong influence. Roles with greater managerial responsibility, team responsibility or formal leadership should therefore be valued clearly higher relative to other roles.",
        "The company sees people and management responsibility as one of the most decisive factors in the model. High assessment scores on this dimension should therefore carry large weight in the overall evaluation, and normally in the relative pay logic as well.",
      ],
      compliance: {
        purpose:
          "Measures the role's responsibility for leading others: formal people responsibility, operational supervision, team leadership, and responsibility for capacity, prioritization and development through other people.",
        whyRelevant:
          "Leading others is part of a role's contribution to the organization's value. It is judged by the scope and content of the leadership assignment, not by title or headcount, so that leading a small team well and leading a large one are assessed on actual responsibility rather than on visible rank.",
        overlapNotes:
          "Overlaps partly with Scope & Impact (organizational reach) and Autonomy (decision authority); here the focus is specifically responsibility exercised through other people.",
        biasRisk: "medium",
        biasComment:
          "Known bias risk (diagnostic questions 3 and 6): rewarding visible mandate and number of direct reports more than actual leadership impact can over-value traditionally male-coded manager roles and under-value senior individual contributors and coordination-heavy work. The level descriptions themselves are gender-neutral (question 5).",
        biasAction:
          "The level anchors describe leadership content rather than headcount alone, and the criterion is kept at a moderate weight so a manager title does not by itself dominate the evaluation.",
      },
    },
    formal: {
      name: "Formal Qualifications",
      description:
        "What formal qualification requirements, such as education or certification, are normally tied to the role.",
      helpText:
        "This criterion describes the formal competence requirements typically tied to the role. It can cover level of education, a degree, certification, licensure or other formally recognized competence that is required or commonly requested. The criterion captures the formal entry level of the role, independent of the current individual's background.",
      anchors: [
        "No formal prior qualifications required. The role can be learned from scratch through internal onboarding. Requires no particular theoretical base or vocational training.",
        "Basic professional knowledge required. The role requires some prior knowledge within the area (e.g. shorter courses or practical experience), but no post-secondary education.",
        "Post-secondary vocational training or equivalent prior knowledge required. The role requires a vocational college education, certification or equivalent theoretical base to be able to perform the tasks.",
        "University degree or equivalent qualified prior knowledge required. The role requires a bachelor's degree/engineering degree or equivalent documented competence to handle typical tasks.",
        "Advanced academic level or advanced specialist certification required. The role requires e.g. a master's degree, advanced certification (IFRS, TISAX, security certificate, CPA etc.) or equivalent high theoretical level.",
        "Professional expertise at the highest level required. The role requires research-level competence, advanced expert accreditation or very substantial domain-specific expertise that sets the norm for the area.",
      ],
      weightLevels: [
        "The company wants requirements for formal qualifications to have only a limited effect on the overall role evaluation.",
        "The company judges formal qualifications to be relevant, but the criterion should normally weigh lighter than the more prioritized dimensions in the model.",
        "The company wants formal qualifications to have a clear and balanced place in the model. Education requirements or equivalent experience requirements should affect the evaluation at a normal level.",
        "The company wants this criterion to have a strong influence. Roles where formal qualifications or an equivalent experience level are particularly important should therefore carry clearly more weight in the model.",
        "The company sees formal qualifications as one of the most decisive dimensions in the model. High assessment scores on this factor should therefore strongly affect the overall role evaluation and normally contribute to higher relative pay positioning.",
      ],
      compliance: {
        purpose:
          "Measures the formal competence requirements typically tied to the role: level of education, a degree, certification, licensure or other formally recognized competence, independent of the current individual's background.",
        whyRelevant:
          "Formal qualification requirements can reflect the knowledge level the role assumes. The criterion describes the role's formal entry level, not the individual, and is kept tied to actual work content to stay gender-neutral.",
        overlapNotes:
          "Overlaps partly with Knowledge Depth/Breadth; here the focus is formal requirements rather than actual applied knowledge and experience.",
        biasRisk: "medium",
        biasComment:
          "Known bias risk (diagnostic question 4): resting on formal status instead of actual work content can disadvantage competence acquired outside traditional education. The level descriptions allow equivalent documented experience and are gender-neutral (question 5).",
        biasAction:
          "The levels explicitly recognize equivalent experience alongside formal education, and the criterion is kept at a low weight so formal credentials do not by themselves drive the evaluation.",
      },
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
