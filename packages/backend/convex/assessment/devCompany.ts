// Dev/seed-only fixture: a realistic ~40-role Nordic product company used to
// seed the blueprnt demo org so the results/level view looks like a real
// company. Inspired by a real company's role list (founder, 2026-06). Titles
// are kept verbatim (the idiomatic Swedish/English mix). Each role carries
// only a trackKey (IC/Lead/M); seniority is per-individual (ADR-0005) and is
// NOT stored on the role. The seeded ratings come from RATINGS_BY_TITLE
// (keyed by title), not from any per-role seniority. Purpose/responsibilities
// are Swedish drafts (machine-generated, flag for native review). This is NOT
// the onboarding industry starter; it is a hardcoded demo fixture for
// seedRatedRoles.
import type { WeightPoints } from "@workspace/core"
import type { CriteriaLibraryKey } from "../evaluationModel/criteriaLibrary"

import type { RatingValue } from "@workspace/core"

export interface DevRole {
  title: string
  trackKey: "IC" | "Lead" | "M"
  purpose: string
  responsibilities: string
}

export interface DevFamily {
  name: string
  roles: DevRole[]
}

export const DEV_COMPANY: DevFamily[] = [
  {
    name: "Ledning",
    roles: [
      {
        title: "CEO",
        trackKey: "M",
        purpose: "Leder hela företaget mot dess vision och affärsmål.",
        responsibilities:
          "Sätta strategi och övergripande inriktning\nLeda ledningsgruppen\nAnsvara för resultat och tillväxt\nFöreträda företaget mot styrelse och intressenter\nForma kultur och värderingar",
      },
      {
        title: "Head of HR",
        trackKey: "M",
        purpose:
          "Leder HR-funktionen och bygger en stark organisation och kultur.",
        responsibilities:
          "Sätta HR-strategi och personalprocesser\nDriva rekrytering och kompetensutveckling\nAnsvara för ledarskap och medarbetarengagemang\nSäkerställa efterlevnad av arbetsrätt\nUtveckla lön och förmåner",
      },
      {
        title: "Head of Finance",
        trackKey: "M",
        purpose:
          "Leder ekonomifunktionen och säkerställer god ekonomisk styrning.",
        responsibilities:
          "Ansvara för budget, prognos och uppföljning\nLeda redovisning och rapportering\nSäkerställa likviditet och finansiering\nHantera risk och efterlevnad\nStödja affärsbeslut med analys",
      },
      {
        title: "Head of Sales & Marketing",
        trackKey: "M",
        purpose: "Leder sälj och marknad mot intäkts- och tillväxtmål.",
        responsibilities:
          "Sätta sälj- och marknadsstrategi\nLeda och coacha sälj- och marknadsteamet\nDriva pipeline och kundtillväxt\nUtveckla varumärke och positionering\nFölja upp resultat och nyckeltal",
      },
      {
        title: "Head of Product",
        trackKey: "M",
        purpose:
          "Leder produktfunktionen och äger den övergripande produktinriktningen.",
        responsibilities:
          "Sätta produktstrategi och vision\nPrioritera roadmap och investeringar\nLeda och utveckla produktteamet\nFörankra produktbeslut hos intressenter\nFölja upp produktens utfall och värde",
      },
    ],
  },
  {
    name: "Utveckling",
    roles: [
      {
        title: "Software Developer",
        trackKey: "IC",
        purpose:
          "Bygger och underhåller programvara som möter produkt- och kvalitetskrav.",
        responsibilities:
          "Designa och implementera funktioner\nSkriva och granska kod\nÅtgärda fel och förbättra prestanda\nMedverka i tekniska beslut",
      },
      {
        title: "Software Tester",
        trackKey: "IC",
        purpose:
          "Säkerställer programvarans kvalitet genom systematisk testning och felsökning.",
        responsibilities:
          "Ta fram testfall och testplaner\nUtföra manuella och automatiserade tester\nRapportera och följa upp fel\nVerifiera krav och kvalitet",
      },
      {
        title: "Embedded Developer",
        trackKey: "IC",
        purpose:
          "Utvecklar inbyggd programvara som styr hårdvara tillförlitligt och effektivt.",
        responsibilities:
          "Designa och implementera firmware\nProgrammera mot hårdvara och gränssnitt\nFelsöka och optimera inbyggda system\nTesta mot hårdvarukrav",
      },
      {
        title: "Hardware Developer",
        trackKey: "IC",
        purpose:
          "Designar hårdvara som uppfyller funktions-, prestanda- och kvalitetskrav.",
        responsibilities:
          "Ta fram hårdvarudesign och scheman\nVälja komponenter och lösningar\nVerifiera och testa prototyper\nSamarbeta kring integration med mjukvara",
      },
      {
        title: "Konstruktör",
        trackKey: "IC",
        purpose:
          "Konstruerar elektronik- och mekaniklösningar som uppfyller krav och specifikationer.",
        responsibilities:
          "Ta fram konstruktionsunderlag och ritningar\nDimensionera och välja komponenter\nVerifiera konstruktioner mot krav\nSamarbeta med produktion och utveckling",
      },
      {
        title: "Cloud Architect",
        trackKey: "IC",
        purpose:
          "Utformar molnarkitektur som är skalbar, säker och kostnadseffektiv.",
        responsibilities:
          "Designa molnlösningar och arkitektur\nSätta standarder för moln och säkerhet\nVägleda team i molnval\nOptimera prestanda och kostnad",
      },
      {
        title: "Infrastructure Engineer",
        trackKey: "IC",
        purpose:
          "Driver och underhåller infrastruktur så att system är stabila och tillgängliga.",
        responsibilities:
          "Drifta och övervaka infrastruktur\nAutomatisera drift och deploy\nFelsöka och åtgärda incidenter\nSäkerställa säkerhet och tillgänglighet",
      },
      {
        title: "Technical Solutions Architect",
        trackKey: "M",
        purpose:
          "Leder den övergripande tekniska lösningsarkitekturen för att möta affärs- och produktmål.",
        responsibilities:
          "Sätta övergripande teknisk arkitektur\nLeda arkitektur- och designbeslut\nVägleda team i lösningsval\nSäkerställa teknisk helhet och kvalitet",
      },
      {
        title: "Department Manager Software",
        trackKey: "M",
        purpose:
          "Leder mjukvaruavdelningen för pålitlig leverans och utvecklar medarbetarna.",
        responsibilities:
          "Leda och utveckla avdelningen\nPlanera kapacitet och leverans\nSätta mål och följa upp\nStyra budget och rekrytering",
      },
      {
        title: "Strategy Engineer",
        trackKey: "IC",
        purpose:
          "Driver teknisk strategi och framåtblickande ingenjörsarbete för långsiktig konkurrenskraft.",
        responsibilities:
          "Ta fram teknisk strategi och vägval\nUtvärdera ny teknik och trender\nTa fram tekniska underlag för beslut\nVägleda team i strategiska val",
      },
    ],
  },
  {
    name: "Data",
    roles: [
      {
        title: "Data Developer",
        trackKey: "IC",
        purpose:
          "Bygger och underhåller datapipelines och datalösningar som möter verksamhetens behov.",
        responsibilities:
          "Designa och bygga datapipelines\nIntegrera och modellera data från olika källor\nSäkerställa datakvalitet och tillförlitlighet\nOptimera prestanda och bevaka flöden\nMedverka i tekniska beslut",
      },
      {
        title: "Department Manager Data",
        trackKey: "M",
        purpose:
          "Leder dataavdelningen mot tillförlitlig leverans och utvecklar medarbetarna.",
        responsibilities:
          "Sätta inriktning och mål för avdelningen\nLeda och utveckla teamet\nPlanera kapacitet och leverans\nFölja upp resultat och kvalitet\nStödja rekrytering och kompetensutveckling",
      },
    ],
  },
  {
    name: "Produkt",
    roles: [
      {
        title: "Product Manager",
        trackKey: "IC",
        purpose:
          "Äger ett produktområde och dess roadmap för att rätt saker byggs.",
        responsibilities:
          "Definiera produktstrategi och roadmap\nPrioritera backloggen\nSamla in och analysera användarbehov\nSamordna intressenter och team",
      },
      {
        title: "Product Coordinator",
        trackKey: "IC",
        purpose:
          "Samordnar produktarbetet och håller ihop planering och releaser.",
        responsibilities:
          "Koordinera produktaktiviteter och tidslinjer\nPlanera och följa upp releaser\nHålla ihop kommunikation mellan team\nDokumentera beslut och status",
      },
      {
        title: "Product Promotor",
        trackKey: "IC",
        purpose: "Marknadsför produkten och driver dess position på marknaden.",
        responsibilities:
          "Ta fram budskap och positionering\nPlanera lanseringar och kampanjer\nTa fram säljstödjande material\nFölja upp marknad och konkurrenter",
      },
      {
        title: "UX Lead",
        trackKey: "Lead",
        purpose:
          "Leder UX- och designarbetet mot en sammanhållen användarupplevelse.",
        responsibilities:
          "Sätta riktning för UX och design\nLeda och vägleda designteamet\nSäkra designkvalitet och konsekvens\nFöra in research i produktbesluten",
      },
    ],
  },
  {
    name: "Försäljning & Marknad",
    roles: [
      {
        title: "Account Manager",
        trackKey: "IC",
        purpose:
          "Vårdar och utvecklar befintliga kundrelationer för att skapa långsiktig affär.",
        responsibilities:
          "Sköta och utveckla kundkonton\nDriva merförsäljning och förnyelser\nFörstå kundens behov och mål\nFölja upp nöjdhet och pipeline",
      },
      {
        title: "Key Account Manager",
        trackKey: "IC",
        purpose: "Ansvarar för företagets största och mest strategiska kunder.",
        responsibilities:
          "Leda strategiska nyckelkunder\nUtveckla affärsplaner per konto\nDriva komplexa förhandlingar\nBygga relationer på ledningsnivå\nSäkra tillväxt och lönsamhet",
      },
      {
        title: "Sales Manager",
        trackKey: "M",
        purpose:
          "Leder säljteamet mot uppsatta mål och bygger en stark säljkultur.",
        responsibilities:
          "Leda och coacha säljteamet\nSätta och följa upp säljmål\nUtveckla säljprocess och metodik\nRapportera prognoser och resultat\nRekrytera och utveckla säljare",
      },
      {
        title: "Order & Indoor Sales",
        trackKey: "IC",
        purpose:
          "Hanterar order och innesälj för att ge kunden snabb och korrekt service.",
        responsibilities:
          "Ta emot och registrera order\nSvara på kundförfrågningar\nLämna offerter och prisuppgifter\nFölja upp leveranser och ärenden",
      },
      {
        title: "Marknadskoordinator",
        trackKey: "IC",
        purpose:
          "Samordnar marknadsaktiviteter och stödjer teamet i det dagliga arbetet.",
        responsibilities:
          "Planera och koordinera kampanjer\nProducera och uppdatera material\nSamordna event och mässor\nFölja upp marknadsaktiviteter",
      },
      {
        title: "E-Commerce Strategy Lead",
        trackKey: "Lead",
        purpose:
          "Driver bolagets e-handelsstrategi för ökad tillväxt och kundvärde.",
        responsibilities:
          "Forma och driva e-handelsstrategin\nOptimera konvertering och kundresa\nAnalysera data och marknadstrender\nDriva initiativ tvärfunktionellt",
      },
      {
        title: "Partner & Cooperations Manager",
        trackKey: "IC",
        purpose:
          "Bygger och förvaltar partnerskap och samarbeten som stärker affären.",
        responsibilities:
          "Identifiera och rekrytera partner\nFörhandla och vårda avtal\nUtveckla gemensamma initiativ\nFölja upp partnerresultat",
      },
      {
        title: "Content Delivery Manager",
        trackKey: "Lead",
        purpose:
          "Leder produktion och leverans av innehåll med rätt kvalitet och tempo.",
        responsibilities:
          "Leda innehållsproduktion och team\nPlanera och prioritera leveranser\nSäkra kvalitet och varumärke\nSamordna med beställare och kanaler\nUtveckla arbetssätt och flöden",
      },
    ],
  },
  {
    name: "IT",
    roles: [
      {
        title: "IT Manager",
        trackKey: "M",
        purpose:
          "Leder den interna IT-verksamheten för stabil drift och säkra system.",
        responsibilities:
          "Sätta IT-strategi och prioriteringar\nLeda och utveckla IT-teamet\nAnsvara för budget och leverantörer\nSäkerställa drift, säkerhet och efterlevnad",
      },
      {
        title: "IT-specialist",
        trackKey: "IC",
        purpose:
          "Bygger och förvaltar interna system och infrastruktur för pålitlig drift.",
        responsibilities:
          "Installera och konfigurera system\nFörvalta nätverk och infrastruktur\nÅtgärda driftstörningar och incidenter\nFörbättra säkerhet och prestanda",
      },
      {
        title: "IT-support",
        trackKey: "IC",
        purpose:
          "Hjälper medarbetare med IT-frågor och håller arbetsplatsen igång.",
        responsibilities:
          "Ta emot och lösa supportärenden\nFelsöka hård- och mjukvara\nHantera konton och behörigheter\nEskalera komplexa fall vidare",
      },
      {
        title: "Supporttekniker",
        trackKey: "IC",
        purpose:
          "Löser kundernas tekniska problem och säkerställer en god supportupplevelse.",
        responsibilities:
          "Besvara kundärenden och frågor\nFelsöka och åtgärda tekniska fel\nEskalera komplexa fall\nDokumentera lösningar och återkoppling",
      },
    ],
  },
  {
    name: "Ekonomi & Inköp",
    roles: [
      {
        title: "Controller",
        trackKey: "IC",
        purpose:
          "Säkerställer tillförlitlig finansiell rapportering och analys som stöd för affärsbeslut.",
        responsibilities:
          "Ta fram månads- och årsbokslut\nAnalysera utfall mot budget och prognos\nBygga rapporter och nyckeltal\nStödja verksamheten med beslutsunderlag\nFörbättra ekonomiprocesser och kontroller",
      },
      {
        title: "Redovisningsekonom",
        trackKey: "IC",
        purpose:
          "Sköter löpande bokföring och redovisning så att räkenskaperna är korrekta och i tid.",
        responsibilities:
          "Hantera löpande bokföring\nSköta kund- och leverantörsreskontra\nStämma av konton och bokslut\nHantera moms- och skatterapportering\nSäkerställa korrekt underlag",
      },
      {
        title: "Strategic Purchaser",
        trackKey: "IC",
        purpose:
          "Driver strategiskt inköp för att säkra rätt leverantörer, kostnad och kvalitet på lång sikt.",
        responsibilities:
          "Utveckla inköps- och kategoristrategier\nUtvärdera och välja leverantörer\nFörhandla avtal och villkor\nFölja upp leverantörsprestanda\nSänka kostnad och risk i leverantörskedjan",
      },
      {
        title: "Admin & Purchasing",
        trackKey: "IC",
        purpose:
          "Ger administrativt stöd och sköter operativt inköp så att verksamheten fungerar smidigt.",
        responsibilities:
          "Lägga och följa upp inköpsorder\nHantera leverantörskontakter\nSköta administrativt stöd och dokumentation\nKontrollera leveranser och fakturor\nUnderhålla artikel- och leverantörsregister",
      },
    ],
  },
  {
    name: "Projekt",
    roles: [
      {
        title: "Project Manager",
        trackKey: "IC",
        purpose:
          "Driver leveransprojekt i mål med rätt omfattning, tid och budget.",
        responsibilities:
          "Planera omfattning, tidplan och budget\nLeda projektteamet i det dagliga arbetet\nFölja upp framdrift och hantera risker\nRapportera status till intressenter",
      },
      {
        title: "Project Management Officer",
        trackKey: "IC",
        purpose:
          "Säkerställer styrning och stöd så att projekt drivs enhetligt och med god kvalitet.",
        responsibilities:
          "Förvalta projektmetodik och mallar\nFölja upp portfölj och nyckeltal\nStödja projektledare i styrning\nSäkra rapportering och efterlevnad",
      },
      {
        title: "Project & Operations Manager",
        trackKey: "M",
        purpose:
          "Leder både projekt och löpande verksamhet för stabil och effektiv leverans.",
        responsibilities:
          "Driva projekt från start till mål\nLeda och utveckla den löpande verksamheten\nPlanera resurser och kapacitet\nFölja upp resultat och förbättra processer",
      },
    ],
  },
]

// Per-role 1-5 ratings across the demo's 8 selected library criteria, in
// DEMO_SELECTED_KEYS order: [knowledge-depth, knowledge-breadth,
// complexity-ambiguity, communication-effort, scope-impact, autonomy-mandate,
// risk-consequence, on-call]. The vectors are re-keyed from the production
// demo org's nine-criterion standard-template ratings (see git history for
// the source vectors): each new position takes its value straight from the
// template criterion the masterdokument content maps it to (knowledge-breadth
// <- formal, communication-effort <- stakeholders, the rest 1:1 by concept),
// and the old financial vector is dropped entirely (no library key selected
// for it in this demo). Every value is 1-5 except the on-call column, which
// is workingConditions and legitimately 0 for a title with no standby
// exposure; seed.ts attaches DEMO_RATING_MOTIVATION to every 1/4/5 value so
// the demo satisfies its own motivation-required rule.
//
// people-leadership was the original 8th key, but it is a responsibility
// criterion: alongside scope-impact/autonomy-mandate/risk-consequence that
// put 4 criteria in a dimension capped at DIMENSION_MAX_ACTIVE.responsibility
// = 3, and left workingConditions at zero despite every model needing a
// decision there (ADR-0022 section 6.1). Both are fixed the same way: swap
// the 8th key for on-call (workingConditions, cap 1), moving its weight point
// and its whole rating column with it. The old people-leadership column is
// gone, not merely renamed: on-call measures a different thing (irregular
// hours / standby duty, 0 meaning "not covered" for the many titles with no
// on-call exposure), so every title's 8th value was reconsidered on its own
// terms rather than carried over. Verified in devCompany.test.ts, including a
// guard that the selection itself never exceeds any dimension's cap.
//
// Profiles VARY across criteria by function, which is what makes the weighting
// matter: boosting the technical criteria (complexity/knowledge) lifts the
// engineering profiles and drops the ones with no on-call exposure. Verified
// in devCompany.test.ts (default-weight distribution + reweighting
// sensitivity).
//
// Only three shapes are shared between titles; every other role carries its
// own vector.
//
// One rating per selected criterion in DEMO_SELECTED_KEYS order; the tuple
// type makes a wrong-length, non-integer, or out-of-range vector a compile
// error instead of a seed-time surprise.
export const DEMO_SELECTED_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "complexity-ambiguity",
  "communication-effort",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
  "on-call",
] as const satisfies readonly CriteriaLibraryKey[]
type DemoLibraryKey = (typeof DEMO_SELECTED_KEYS)[number]
type RatingVector = readonly [
  RatingValue,
  RatingValue,
  RatingValue,
  RatingValue,
  RatingValue,
  RatingValue,
  RatingValue,
  RatingValue,
]
const EXEC_HEAD: RatingVector = [3, 5, 3, 5, 5, 4, 4, 0] // functional head (HR/Sales/Product)
const SPECIALIST_IC: RatingVector = [3, 3, 2, 2, 2, 2, 3, 0] // hands-on specialist, no people responsibility
const COORDINATOR_IC: RatingVector = [2, 3, 2, 3, 2, 2, 2, 0] // coordinating IC, stakeholder-tilted

// The 8th column is on-call (workingConditions): 0 for every title with no
// standby/irregular-hours exposure, 1-3 for the operations/support titles
// that actually carry it (IT-support, Supporttekniker, IT-specialist, Cloud
// Architect, IT Manager, Infrastructure Engineer), graded by how central
// reactive incident response is to the role's own responsibilities.
export const RATINGS_BY_TITLE: Record<string, RatingVector> = {
  CEO: [5, 3, 5, 5, 5, 5, 5, 0],
  "Head of HR": EXEC_HEAD,
  "Head of Finance": [4, 3, 4, 5, 5, 5, 4, 0],
  "Head of Sales & Marketing": EXEC_HEAD,
  "Head of Product": EXEC_HEAD,
  "Software Developer": SPECIALIST_IC,
  "Software Tester": [3, 3, 3, 3, 2, 4, 2, 0],
  "Embedded Developer": SPECIALIST_IC,
  "Hardware Developer": SPECIALIST_IC,
  Konstruktör: [2, 3, 2, 2, 2, 2, 2, 0],
  "Cloud Architect": [4, 3, 4, 2, 3, 3, 3, 1],
  "Infrastructure Engineer": [3, 3, 3, 2, 2, 2, 2, 3],
  "Technical Solutions Architect": [3, 3, 4, 4, 4, 4, 3, 0],
  "Department Manager Software": [2, 3, 3, 3, 3, 4, 3, 0],
  "Strategy Engineer": [1, 3, 5, 5, 4, 2, 4, 0],
  "Data Developer": [2, 1, 2, 2, 2, 2, 2, 0],
  "Department Manager Data": [3, 2, 3, 4, 4, 4, 3, 0],
  "Product Manager": [2, 3, 3, 4, 3, 4, 3, 0],
  "Product Coordinator": [2, 3, 3, 3, 2, 3, 3, 0],
  "Product Promotor": [3, 3, 2, 3, 2, 2, 3, 0],
  "UX Lead": [3, 3, 3, 3, 4, 4, 3, 0],
  "Account Manager": [3, 2, 2, 4, 3, 3, 3, 0],
  "Key Account Manager": [2, 3, 3, 4, 3, 2, 4, 0],
  "Sales Manager": [2, 2, 4, 3, 4, 4, 4, 0],
  "Order & Indoor Sales": [3, 2, 3, 3, 2, 2, 2, 0],
  Marknadskoordinator: COORDINATOR_IC,
  "E-Commerce Strategy Lead": [3, 3, 4, 3, 4, 4, 4, 0],
  "Partner & Cooperations Manager": COORDINATOR_IC,
  "Content Delivery Manager": [3, 3, 3, 3, 4, 4, 3, 0],
  "IT Manager": [2, 3, 2, 2, 3, 4, 3, 1],
  "IT-specialist": [3, 3, 2, 2, 2, 2, 2, 2],
  "IT-support": [1, 2, 1, 2, 1, 2, 2, 2],
  Supporttekniker: [2, 2, 3, 3, 2, 2, 3, 2],
  Controller: SPECIALIST_IC,
  Redovisningsekonom: [1, 3, 1, 2, 2, 2, 1, 0],
  "Strategic Purchaser": [3, 3, 3, 4, 3, 3, 3, 0],
  "Admin & Purchasing": [1, 2, 2, 2, 2, 2, 2, 0],
  "Project Manager": [1, 3, 3, 3, 3, 3, 3, 0],
  "Project Management Officer": [2, 3, 2, 2, 1, 3, 3, 0],
  "Project & Operations Manager": [2, 3, 3, 4, 4, 4, 3, 0],
}

// A rating value of 1, 4, or 5 requires a motivation (spec 2.5/17.3); the
// demo data is not exempt from its own law. seed.ts attaches this to every
// such rating (including a 1 on the on-call/workingConditions column) so the
// seeded org satisfies the rule it demonstrates.
export const DEMO_RATING_MOTIVATION =
  "Motiverad utifrån rollens normala och varaktiga krav vid metodkalibreringen."

// The demo org's calibrated weight points (ADR-0021 library keys), summing to
// the exact 24-point budget (8 criteria x 3; guarded in devCompany.test.ts).
// seedRatedRoles inserts the demo's 8 criteria directly at these weights, so
// the demo org is a company that has DONE its weighting, not one sitting on
// a neutral default.
export const DEMO_WEIGHT_POINTS: Record<DemoLibraryKey, WeightPoints> = {
  "knowledge-depth": 3,
  "knowledge-breadth": 2,
  "complexity-ambiguity": 4,
  "communication-effort": 3,
  "scope-impact": 5,
  "autonomy-mandate": 3,
  "risk-consequence": 3,
  "on-call": 1,
}

// Anchor-role designations, mirroring the production demo org. Keyed by role
// title; seedRatedRoles stamps status "active" and reviewedAt at seed time.
// expectedLevel is on the new 1-12 scale (ADR-0022).
export const DEMO_ANCHOR_ROLES: Record<
  string,
  { expectedLevel: number; motivation: string }
> = {
  "Technical Solutions Architect": {
    expectedLevel: 6,
    motivation:
      "Det är en tung roll både kunskapsmässigt och personal som kräver både en ledarskapsförmåga samt specialistkompetens inom domän.",
  },
}
