// Dev/seed-only fixture: a realistic ~40-role Nordic product company used to
// seed the blueprnt demo org so the results/band view looks like a real company.
// Inspired by a real company's role list (founder, 2026-06). Titles are kept
// verbatim (the idiomatic Swedish/English mix). Each role carries only a
// trackKey (IC/Lead/M); level is per-individual (ADR-0005) and is NOT stored on
// the role. The seeded ratings come from RATINGS_BY_TITLE (keyed by title), not
// from any per-role level. Purpose/responsibilities are Swedish drafts (machine-
// generated, flag for native review). This is NOT the onboarding industry
// starter; it is a hardcoded demo fixture for seedRatedRoles.

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
        trackKey: "IC",
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
        trackKey: "IC",
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

// Per-role 0-5 ratings across the nine criteria in CRITERION_KEYS order
// [scope, complexity, autonomy, risk, knowledge, stakeholders, financial,
// people, formal]. Unlike a flat number per role, these VARY across criteria by
// function, which is what makes the weighting matter: a role rated the same on
// every criterion has a score independent of the weights (the budget cancels),
// so re-weighting the model would not move it. With differentiated profiles,
// boosting e.g. the technical criteria (complexity/knowledge) lifts the
// engineers and lowers the leadership-heavy roles. Magnitude is roughly
// seniority-scaled for a sensible default-weight spread. Verified in
// devCompany.test.ts (default-weight distribution + reweighting sensitivity).
//
// Archetype profiles (shared shapes), assigned to titles below.
const EXEC_CEO = [5, 3, 5, 5, 3, 5, 5, 5, 5] as const // broad leader, low on the technical criteria
const EXEC_HEAD = [5, 3, 4, 4, 3, 5, 5, 5, 5] as const
const ARCHITECT = [4, 5, 4, 4, 5, 4, 4, 4, 4] as const // deep technical leader (peaks complexity/knowledge)
const MGR_TECH = [4, 4, 4, 4, 5, 4, 3, 5, 4] as const
const MGR_SALES = [4, 3, 4, 4, 3, 5, 5, 5, 4] as const
const MGR_OPS = [4, 4, 4, 4, 3, 4, 4, 5, 4] as const
const LEAD = [3, 3, 4, 3, 4, 4, 3, 3, 3] as const
const SR_TECH = [3, 5, 4, 4, 5, 3, 2, 2, 3] as const // senior engineer (peaks complexity/knowledge)
const SR_PRODUCT = [4, 4, 4, 3, 4, 5, 3, 3, 3] as const
const SR_SALES = [4, 3, 4, 4, 3, 5, 4, 2, 3] as const
const ECOMM = [4, 4, 5, 4, 4, 5, 4, 2, 3] as const
const DEV = [3, 5, 3, 3, 5, 2, 1, 1, 2] as const // engineer IC: complexity/knowledge max, low people/financial
const BIZ_IC = [3, 2, 3, 3, 3, 4, 3, 1, 2] as const
const FIN_IC = [3, 3, 3, 4, 3, 2, 4, 1, 3] as const
const SUPPORT_IC = [2, 3, 3, 3, 4, 3, 1, 1, 2] as const
const PROJ_IC = [3, 3, 4, 3, 3, 4, 3, 2, 3] as const
const JR_IC = [2, 3, 2, 2, 3, 3, 2, 1, 2] as const

export const RATINGS_BY_TITLE: Record<string, readonly number[]> = {
  CEO: EXEC_CEO,
  "Head of HR": EXEC_HEAD,
  "Head of Finance": EXEC_HEAD,
  "Head of Sales & Marketing": EXEC_HEAD,
  "Head of Product": EXEC_HEAD,
  "Software Developer": DEV,
  "Software Tester": DEV,
  "Embedded Developer": DEV,
  "Hardware Developer": DEV,
  Konstruktör: DEV,
  "Cloud Architect": SR_TECH,
  "Infrastructure Engineer": DEV,
  "Technical Solutions Architect": ARCHITECT,
  "Department Manager Software": MGR_TECH,
  "Strategy Engineer": SR_TECH,
  "Data Developer": DEV,
  "Department Manager Data": MGR_TECH,
  "Product Manager": SR_PRODUCT,
  "Product Coordinator": BIZ_IC,
  "Product Promotor": BIZ_IC,
  "UX Lead": SR_PRODUCT,
  "Account Manager": BIZ_IC,
  "Key Account Manager": SR_SALES,
  "Sales Manager": MGR_SALES,
  "Order & Indoor Sales": JR_IC,
  Marknadskoordinator: BIZ_IC,
  "E-Commerce Strategy Lead": ECOMM,
  "Partner & Cooperations Manager": SR_SALES,
  "Content Delivery Manager": LEAD,
  "IT Manager": MGR_TECH,
  "IT-specialist": SUPPORT_IC,
  "IT-support": JR_IC,
  Supporttekniker: SUPPORT_IC,
  Controller: FIN_IC,
  Redovisningsekonom: FIN_IC,
  "Strategic Purchaser": FIN_IC,
  "Admin & Purchasing": JR_IC,
  "Project Manager": PROJ_IC,
  "Project Management Officer": PROJ_IC,
  "Project & Operations Manager": MGR_OPS,
}
