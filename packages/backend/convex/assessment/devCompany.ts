// Dev/seed-only fixture: a realistic ~40-role Nordic product company used to
// seed the blueprnt demo org so the results/band view looks like a real company.
// Inspired by a real company's role list (founder, 2026-06). Titles are kept
// verbatim (the idiomatic Swedish/English mix). Each role carries only a
// trackKey (IC/Lead/M); the `level` (M3/IC4/Lead-1, encoding seniority) is NOT
// stored on the role (level is per-individual, ADR-0005) but drives the seeded
// ratings -> band. Purpose/responsibilities are Swedish drafts (machine-
// generated, flag for native review). This is NOT the onboarding industry
// starter; it is a hardcoded demo fixture for seedRatedRoles.

export type DevLevel =
  | "M3"
  | "M2"
  | "M1"
  | "Lead-1"
  | "IC5"
  | "IC4"
  | "IC3"
  | "IC2"

export interface DevRole {
  title: string
  trackKey: "IC" | "Lead" | "M"
  level: DevLevel
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
        level: "M3",
        purpose: "Leder hela företaget mot dess vision och affärsmål.",
        responsibilities:
          "Sätta strategi och övergripande inriktning\nLeda ledningsgruppen\nAnsvara för resultat och tillväxt\nFöreträda företaget mot styrelse och intressenter\nForma kultur och värderingar",
      },
      {
        title: "Head of HR",
        trackKey: "M",
        level: "M3",
        purpose:
          "Leder HR-funktionen och bygger en stark organisation och kultur.",
        responsibilities:
          "Sätta HR-strategi och personalprocesser\nDriva rekrytering och kompetensutveckling\nAnsvara för ledarskap och medarbetarengagemang\nSäkerställa efterlevnad av arbetsrätt\nUtveckla lön och förmåner",
      },
      {
        title: "Head of Finance",
        trackKey: "M",
        level: "M3",
        purpose:
          "Leder ekonomifunktionen och säkerställer god ekonomisk styrning.",
        responsibilities:
          "Ansvara för budget, prognos och uppföljning\nLeda redovisning och rapportering\nSäkerställa likviditet och finansiering\nHantera risk och efterlevnad\nStödja affärsbeslut med analys",
      },
      {
        title: "Head of Sales & Marketing",
        trackKey: "M",
        level: "M3",
        purpose: "Leder sälj och marknad mot intäkts- och tillväxtmål.",
        responsibilities:
          "Sätta sälj- och marknadsstrategi\nLeda och coacha sälj- och marknadsteamet\nDriva pipeline och kundtillväxt\nUtveckla varumärke och positionering\nFölja upp resultat och nyckeltal",
      },
      {
        title: "Head of Product",
        trackKey: "M",
        level: "M3",
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
        level: "IC3",
        purpose:
          "Bygger och underhåller programvara som möter produkt- och kvalitetskrav.",
        responsibilities:
          "Designa och implementera funktioner\nSkriva och granska kod\nÅtgärda fel och förbättra prestanda\nMedverka i tekniska beslut",
      },
      {
        title: "Software Tester",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Säkerställer programvarans kvalitet genom systematisk testning och felsökning.",
        responsibilities:
          "Ta fram testfall och testplaner\nUtföra manuella och automatiserade tester\nRapportera och följa upp fel\nVerifiera krav och kvalitet",
      },
      {
        title: "Embedded Developer",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Utvecklar inbyggd programvara som styr hårdvara tillförlitligt och effektivt.",
        responsibilities:
          "Designa och implementera firmware\nProgrammera mot hårdvara och gränssnitt\nFelsöka och optimera inbyggda system\nTesta mot hårdvarukrav",
      },
      {
        title: "Hardware Developer",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Designar hårdvara som uppfyller funktions-, prestanda- och kvalitetskrav.",
        responsibilities:
          "Ta fram hårdvarudesign och scheman\nVälja komponenter och lösningar\nVerifiera och testa prototyper\nSamarbeta kring integration med mjukvara",
      },
      {
        title: "Konstruktör",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Konstruerar elektronik- och mekaniklösningar som uppfyller krav och specifikationer.",
        responsibilities:
          "Ta fram konstruktionsunderlag och ritningar\nDimensionera och välja komponenter\nVerifiera konstruktioner mot krav\nSamarbeta med produktion och utveckling",
      },
      {
        title: "Cloud Architect",
        trackKey: "IC",
        level: "IC4",
        purpose:
          "Utformar molnarkitektur som är skalbar, säker och kostnadseffektiv.",
        responsibilities:
          "Designa molnlösningar och arkitektur\nSätta standarder för moln och säkerhet\nVägleda team i molnval\nOptimera prestanda och kostnad",
      },
      {
        title: "Infrastructure Engineer",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Driver och underhåller infrastruktur så att system är stabila och tillgängliga.",
        responsibilities:
          "Drifta och övervaka infrastruktur\nAutomatisera drift och deploy\nFelsöka och åtgärda incidenter\nSäkerställa säkerhet och tillgänglighet",
      },
      {
        title: "Technical Solutions Architect",
        trackKey: "M",
        level: "M2",
        purpose:
          "Leder den övergripande tekniska lösningsarkitekturen för att möta affärs- och produktmål.",
        responsibilities:
          "Sätta övergripande teknisk arkitektur\nLeda arkitektur- och designbeslut\nVägleda team i lösningsval\nSäkerställa teknisk helhet och kvalitet",
      },
      {
        title: "Department Manager Software",
        trackKey: "M",
        level: "M1",
        purpose:
          "Leder mjukvaruavdelningen för pålitlig leverans och utvecklar medarbetarna.",
        responsibilities:
          "Leda och utveckla avdelningen\nPlanera kapacitet och leverans\nSätta mål och följa upp\nStyra budget och rekrytering",
      },
      {
        title: "Strategy Engineer",
        trackKey: "IC",
        level: "IC4",
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
        level: "IC3",
        purpose:
          "Bygger och underhåller datapipelines och datalösningar som möter verksamhetens behov.",
        responsibilities:
          "Designa och bygga datapipelines\nIntegrera och modellera data från olika källor\nSäkerställa datakvalitet och tillförlitlighet\nOptimera prestanda och bevaka flöden\nMedverka i tekniska beslut",
      },
      {
        title: "Department Manager Data",
        trackKey: "M",
        level: "M1",
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
        level: "IC4",
        purpose:
          "Äger ett produktområde och dess roadmap för att rätt saker byggs.",
        responsibilities:
          "Definiera produktstrategi och roadmap\nPrioritera backloggen\nSamla in och analysera användarbehov\nSamordna intressenter och team",
      },
      {
        title: "Product Coordinator",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Samordnar produktarbetet och håller ihop planering och releaser.",
        responsibilities:
          "Koordinera produktaktiviteter och tidslinjer\nPlanera och följa upp releaser\nHålla ihop kommunikation mellan team\nDokumentera beslut och status",
      },
      {
        title: "Product Promotor",
        trackKey: "IC",
        level: "IC3",
        purpose: "Marknadsför produkten och driver dess position på marknaden.",
        responsibilities:
          "Ta fram budskap och positionering\nPlanera lanseringar och kampanjer\nTa fram säljstödjande material\nFölja upp marknad och konkurrenter",
      },
      {
        title: "UX Lead",
        trackKey: "IC",
        level: "IC4",
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
        level: "IC3",
        purpose:
          "Vårdar och utvecklar befintliga kundrelationer för att skapa långsiktig affär.",
        responsibilities:
          "Sköta och utveckla kundkonton\nDriva merförsäljning och förnyelser\nFörstå kundens behov och mål\nFölja upp nöjdhet och pipeline",
      },
      {
        title: "Key Account Manager",
        trackKey: "IC",
        level: "IC4",
        purpose: "Ansvarar för företagets största och mest strategiska kunder.",
        responsibilities:
          "Leda strategiska nyckelkunder\nUtveckla affärsplaner per konto\nDriva komplexa förhandlingar\nBygga relationer på ledningsnivå\nSäkra tillväxt och lönsamhet",
      },
      {
        title: "Sales Manager",
        trackKey: "M",
        level: "M1",
        purpose:
          "Leder säljteamet mot uppsatta mål och bygger en stark säljkultur.",
        responsibilities:
          "Leda och coacha säljteamet\nSätta och följa upp säljmål\nUtveckla säljprocess och metodik\nRapportera prognoser och resultat\nRekrytera och utveckla säljare",
      },
      {
        title: "Order & Indoor Sales",
        trackKey: "IC",
        level: "IC2",
        purpose:
          "Hanterar order och innesälj för att ge kunden snabb och korrekt service.",
        responsibilities:
          "Ta emot och registrera order\nSvara på kundförfrågningar\nLämna offerter och prisuppgifter\nFölja upp leveranser och ärenden",
      },
      {
        title: "Marknadskoordinator",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Samordnar marknadsaktiviteter och stödjer teamet i det dagliga arbetet.",
        responsibilities:
          "Planera och koordinera kampanjer\nProducera och uppdatera material\nSamordna event och mässor\nFölja upp marknadsaktiviteter",
      },
      {
        title: "E-Commerce Strategy Lead",
        trackKey: "IC",
        level: "IC5",
        purpose:
          "Driver bolagets e-handelsstrategi för ökad tillväxt och kundvärde.",
        responsibilities:
          "Forma och driva e-handelsstrategin\nOptimera konvertering och kundresa\nAnalysera data och marknadstrender\nDriva initiativ tvärfunktionellt",
      },
      {
        title: "Partner & Cooperations Manager",
        trackKey: "IC",
        level: "IC4",
        purpose:
          "Bygger och förvaltar partnerskap och samarbeten som stärker affären.",
        responsibilities:
          "Identifiera och rekrytera partner\nFörhandla och vårda avtal\nUtveckla gemensamma initiativ\nFölja upp partnerresultat",
      },
      {
        title: "Content Delivery Manager",
        trackKey: "Lead",
        level: "Lead-1",
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
        level: "M1",
        purpose:
          "Leder den interna IT-verksamheten för stabil drift och säkra system.",
        responsibilities:
          "Sätta IT-strategi och prioriteringar\nLeda och utveckla IT-teamet\nAnsvara för budget och leverantörer\nSäkerställa drift, säkerhet och efterlevnad",
      },
      {
        title: "IT-specialist",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Bygger och förvaltar interna system och infrastruktur för pålitlig drift.",
        responsibilities:
          "Installera och konfigurera system\nFörvalta nätverk och infrastruktur\nÅtgärda driftstörningar och incidenter\nFörbättra säkerhet och prestanda",
      },
      {
        title: "IT-support",
        trackKey: "IC",
        level: "IC2",
        purpose:
          "Hjälper medarbetare med IT-frågor och håller arbetsplatsen igång.",
        responsibilities:
          "Ta emot och lösa supportärenden\nFelsöka hård- och mjukvara\nHantera konton och behörigheter\nEskalera komplexa fall vidare",
      },
      {
        title: "Supporttekniker",
        trackKey: "IC",
        level: "IC3",
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
        level: "IC3",
        purpose:
          "Säkerställer tillförlitlig finansiell rapportering och analys som stöd för affärsbeslut.",
        responsibilities:
          "Ta fram månads- och årsbokslut\nAnalysera utfall mot budget och prognos\nBygga rapporter och nyckeltal\nStödja verksamheten med beslutsunderlag\nFörbättra ekonomiprocesser och kontroller",
      },
      {
        title: "Redovisningsekonom",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Sköter löpande bokföring och redovisning så att räkenskaperna är korrekta och i tid.",
        responsibilities:
          "Hantera löpande bokföring\nSköta kund- och leverantörsreskontra\nStämma av konton och bokslut\nHantera moms- och skatterapportering\nSäkerställa korrekt underlag",
      },
      {
        title: "Strategic Purchaser",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Driver strategiskt inköp för att säkra rätt leverantörer, kostnad och kvalitet på lång sikt.",
        responsibilities:
          "Utveckla inköps- och kategoristrategier\nUtvärdera och välja leverantörer\nFörhandla avtal och villkor\nFölja upp leverantörsprestanda\nSänka kostnad och risk i leverantörskedjan",
      },
      {
        title: "Admin & Purchasing",
        trackKey: "IC",
        level: "IC2",
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
        level: "IC3",
        purpose:
          "Driver leveransprojekt i mål med rätt omfattning, tid och budget.",
        responsibilities:
          "Planera omfattning, tidplan och budget\nLeda projektteamet i det dagliga arbetet\nFölja upp framdrift och hantera risker\nRapportera status till intressenter",
      },
      {
        title: "Project Management Officer",
        trackKey: "IC",
        level: "IC3",
        purpose:
          "Säkerställer styrning och stöd så att projekt drivs enhetligt och med god kvalitet.",
        responsibilities:
          "Förvalta projektmetodik och mallar\nFölja upp portfölj och nyckeltal\nStödja projektledare i styrning\nSäkra rapportering och efterlevnad",
      },
      {
        title: "Project & Operations Manager",
        trackKey: "M",
        level: "M1",
        purpose:
          "Leder både projekt och löpande verksamhet för stabil och effektiv leverans.",
        responsibilities:
          "Driva projekt från start till mål\nLeda och utveckla den löpande verksamheten\nPlanera resurser och kapacitet\nFölja upp resultat och förbättra processer",
      },
    ],
  },
]

// 0-5 ratings per level across the nine criteria in CRITERION_KEYS order
// [scope, complexity, autonomy, risk, knowledge, stakeholders, financial,
// people, formal]. Tuned against the engine (score = floor(20 * sum(value *
// weightPoints) / 27), weights summing 27, default thresholds 98/83/74/63/53/
// 41/0) so seniority maps to band:
//   M3 -> band 1 (100), M2 -> band 2 (92), IC5 -> band 2 (88),
//   M1 / Lead-1 -> band 3 (80), IC4 -> band 4 (71), IC3 -> band 5 (60),
//   IC2 -> band 6 (48).
export const RATINGS_BY_LEVEL: Record<DevLevel, readonly number[]> = {
  M3: [5, 5, 5, 5, 5, 5, 5, 5, 5],
  M2: [5, 5, 4, 5, 5, 4, 5, 4, 4],
  IC5: [5, 4, 5, 4, 5, 4, 4, 4, 4],
  M1: [4, 4, 4, 4, 4, 4, 4, 4, 4],
  "Lead-1": [4, 4, 4, 4, 4, 4, 4, 4, 4],
  IC4: [4, 4, 3, 4, 4, 3, 3, 3, 3],
  IC3: [3, 3, 3, 3, 3, 3, 3, 3, 3],
  IC2: [3, 3, 2, 2, 3, 2, 2, 2, 2],
}
