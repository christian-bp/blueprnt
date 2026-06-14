import type { StarterContent } from "./industryStarters"

// Norwegian Bokmål starter sets; same structure as the English module. One
// role per JOB (ADR-0005): seniority lives on the individual, so there are no
// junior/senior title variants; a senior whose work actually differs becomes
// its own role, added by the user.
//
// Machine-translated draft. Flag for native review.
export const industryStartersNb: StarterContent = {
  itTelecom: [
    {
      name: "Utvikling",
      roles: [
        {
          title: "Programvareutvikler",
          trackKey: "IC",
          purpose:
            "Bygger og vedlikeholder programvare som oppfyller produkt- og kvalitetskravene.",
          responsibilities:
            "Designe og implementere funksjoner\nSkrive og gjennomgå kode\nRette feil og forbedre ytelse\nSamarbeide om tekniske beslutninger",
        },
        {
          title: "Teknisk leder",
          trackKey: "Lead",
          purpose:
            "Styrer den tekniske retningen til et team og sikrer god ingeniørpraksis.",
          responsibilities:
            "Sette teknisk retning og standarder\nGjennomgå arkitektur og viktige beslutninger\nVeilede og fjerne hindringer for utviklere\nKoordinere leveranser på tvers av teamet",
        },
        {
          title: "Utviklingssjef",
          trackKey: "M",
          purpose:
            "Leder et utviklingsteam til å levere pålitelig samtidig som det utvikler medarbeiderne.",
          responsibilities:
            "Lede og utvikle teamet\nPlanlegge kapasitet og leveranser\nSette mål og følge opp\nStøtte rekruttering og vekst",
        },
      ],
    },
    {
      name: "Produkt",
      roles: [
        {
          title: "Produktsjef",
          trackKey: "IC",
          purpose:
            "Eier produktretningen og sikrer at de riktige tingene blir bygget.",
          responsibilities:
            "Definere produktstrategi og veikart\nPrioritere backloggen\nSamle inn og analysere brukerbehov\nForankre interessenter og team",
        },
      ],
    },
    {
      name: "Design",
      roles: [
        {
          title: "UX-designer",
          trackKey: "IC",
          purpose:
            "Former intuitive brukeropplevelser forankret i research og produktmål.",
          responsibilities:
            "Gjennomføre brukerresearch\nDesigne flyter og grensesnitt\nLage prototyper og skisser\nValidere design gjennom testing",
        },
      ],
    },
    {
      name: "Salg",
      roles: [
        {
          title: "Salgsansvarlig",
          trackKey: "IC",
          purpose:
            "Driver ny forretning ved å lukke avtaler og utvikle kundekontoer.",
          responsibilities:
            "Forvalte salgstrakten\nKvalifisere og forfølge muligheter\nForhandle og lukke avtaler\nVedlikeholde kunderelasjoner",
        },
        {
          title: "Salgssjef",
          trackKey: "M",
          purpose:
            "Leder salgsorganisasjonen til å nå mål for inntekt og vekst.",
          responsibilities:
            "Sette salgsstrategi og mål\nLede og coache salgsteamet\nPrognostisere og rapportere på resultater\nUtvikle nøkkelkunder og partnere",
        },
      ],
    },
    {
      name: "Kundesuksess",
      roles: [
        {
          title: "Supportspesialist",
          trackKey: "IC",
          purpose:
            "Løser kundeproblemer og sikrer en positiv supportopplevelse.",
          responsibilities:
            "Svare på kundehenvendelser\nFeilsøke og løse problemer\nEskalere komplekse saker\nDokumentere løsninger og tilbakemeldinger",
        },
        {
          title: "Kundesuksessansvarlig",
          trackKey: "IC",
          purpose:
            "Sikrer at kundene oppnår verdi og fortsetter å vokse med produktet.",
          responsibilities:
            "Onboarde og veilede kunder\nFølge med på bruk og kundehelse\nDrive fornyelser og oppsalg\nSamle inn og videreformidle kundetilbakemeldinger",
        },
      ],
    },
  ],
  consulting: [
    {
      name: "Rådgivning",
      roles: [
        {
          title: "Konsulent",
          trackKey: "IC",
          purpose:
            "Leverer kundearbeid og rådgivning som løser konkrete forretningsproblemer.",
          responsibilities:
            "Analysere kundebehov\nUtarbeide anbefalinger\nLevere prosjektarbeid\nPresentere funn for kunder",
        },
        {
          title: "Oppdragsleder",
          trackKey: "Lead",
          purpose:
            "Leder kundeoppdrag for å levere gode resultater til rett tid.",
          responsibilities:
            "Planlegge og avgrense oppdrag\nLede leveranseteamet\nForvalte kunderelasjoner\nSikre kvaliteten på leveransene",
        },
        {
          title: "Fagområdesjef",
          trackKey: "M",
          purpose:
            "Bygger og driver et konsulentfagområde og utvikler konsulentene.",
          responsibilities:
            "Sette retning for fagområdet\nLede og utvikle konsulenter\nFølge opp utnyttelsesgrad og leveranser\nStøtte forretningsutvikling",
        },
      ],
    },
    {
      name: "Salg",
      roles: [
        {
          title: "Kundeansvarlig",
          trackKey: "IC",
          purpose:
            "Vedlikeholder og utvikler kundekontoer for å sikre løpende forretning.",
          responsibilities:
            "Forvalte kunderelasjoner\nIdentifisere nye muligheter\nUtarbeide tilbud\nNå kontomål",
        },
        {
          title: "Salgsleder",
          trackKey: "M",
          purpose: "Leder salgsarbeidet for å nå mål for vekst og inntekt.",
          responsibilities:
            "Sette salgsmål\nLede salgsteamet\nPrognostisere og rapportere resultater\nUtvikle viktige kunderelasjoner",
        },
      ],
    },
    {
      name: "Drift",
      roles: [
        {
          title: "Administrator",
          trackKey: "IC",
          purpose:
            "Holder den daglige driften i gang gjennom nøyaktig administrativ støtte.",
          responsibilities:
            "Håndtere administrative oppgaver\nVedlikeholde registre og systemer\nStøtte interne prosesser\nKoordinere tidsplaner og logistikk",
        },
        {
          title: "Økonomisjef",
          trackKey: "M",
          purpose: "Leder økonomistyringen og sikrer god finansiell kontroll.",
          responsibilities:
            "Forvalte budsjettering og rapportering\nFølge opp regnskapsprosesser\nSikre etterlevelse av finansielle krav\nLede økonomiteamet",
        },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Produksjon",
      roles: [
        {
          title: "Operatør",
          trackKey: "IC",
          purpose:
            "Kjører produksjonsutstyr for å produsere varer trygt og etter standard.",
          responsibilities:
            "Betjene produksjonsmaskiner\nFølge sikkerhetsprosedyrer\nFølge med på produksjonskvalitet\nRapportere avvik og driftsstans",
        },
        {
          title: "Produksjonsingeniør",
          trackKey: "IC",
          purpose:
            "Forbedrer produksjonsprosesser for effektivitet, kvalitet og sikkerhet.",
          responsibilities:
            "Optimalisere produksjonsprosesser\nFeilsøke tekniske problemer\nStøtte vedlikehold av utstyr\nInnføre prosessforbedringer",
        },
        {
          title: "Produksjonsleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer et produksjonsteam for å nå mål for produksjon og kvalitet.",
          responsibilities:
            "Planlegge og fordele skiftarbeid\nVeilede produksjonsteamet\nFølge med på produksjon og kvalitet\nLøse daglige problemer",
        },
        {
          title: "Produksjonssjef",
          trackKey: "M",
          purpose:
            "Leder produksjonsdriften for å nå mål for volum, kostnad og kvalitet.",
          responsibilities:
            "Planlegge produksjonskapasitet\nLede produksjonsteam\nStyre kostnad og kvalitet\nDrive kontinuerlig forbedring",
        },
      ],
    },
    {
      name: "Kvalitet",
      roles: [
        {
          title: "Kvalitetsingeniør",
          trackKey: "IC",
          purpose:
            "Sikrer at produkter oppfyller kvalitetsstandarder og spesifikasjoner.",
          responsibilities:
            "Definere kvalitetskontroller\nInspisere og teste produkter\nUndersøke kvalitetsavvik\nDrive korrigerende tiltak",
        },
        {
          title: "Kvalitetssjef",
          trackKey: "M",
          purpose:
            "Leder kvalitetsfunksjonen og ivaretar produkt- og prosesskvalitet.",
          responsibilities:
            "Eie kvalitetsstyringssystemet\nLede kvalitetsteamet\nSikre etterlevelse av regelverk\nDrive kvalitetsforbedring",
        },
      ],
    },
    {
      name: "Vedlikehold",
      roles: [
        {
          title: "Vedlikeholdstekniker",
          trackKey: "IC",
          purpose:
            "Holder utstyr og anlegg i drift gjennom reparasjon og ettersyn.",
          responsibilities:
            "Utføre forebyggende vedlikehold\nDiagnostisere og reparere feil\nDokumentere vedlikeholdsarbeid\nFølge sikkerhetsprosedyrer",
        },
        {
          title: "Vedlikeholdsleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer vedlikeholdsarbeid for å maksimere oppetid på utstyr.",
          responsibilities:
            "Planlegge vedlikeholdsplaner\nVeilede vedlikeholdsteamet\nPrioritere reparasjoner\nFølge med på utstyrets driftssikkerhet",
        },
      ],
    },
    {
      name: "Logistikk",
      roles: [
        {
          title: "Logistikkoordinator",
          trackKey: "IC",
          purpose:
            "Koordinerer vareflyten slik at leveranser kommer frem til rett tid.",
          responsibilities:
            "Planlegge forsendelser og transport\nKoordinere med leverandører\nFølge med på lager og bestillinger\nLøse leveranseproblemer",
        },
        {
          title: "Logistikksjef",
          trackKey: "M",
          purpose:
            "Leder logistikkdriften for effektiv forsyning og distribusjon.",
          responsibilities:
            "Sette logistikkstrategi\nLede logistikkteamet\nOptimalisere flyten i forsyningskjeden\nStyre logistikkostnader",
        },
      ],
    },
  ],
  retail: [
    {
      name: "Butikk",
      roles: [
        {
          title: "Butikkmedarbeider",
          trackKey: "IC",
          purpose: "Betjener kunder og driver salg på butikkgulvet.",
          responsibilities:
            "Hjelpe og veilede kunder\nGjennomføre salgstransaksjoner\nVedlikeholde butikkens presentasjon\nHåndtere varer på gulvet",
        },
        {
          title: "Skiftleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer butikkteamet under et skift slik at det går knirkefritt.",
          responsibilities:
            "Lede personalet under skift\nÅpne og stenge butikken\nHåndtere eskalerte kundesaker\nFølge med på daglige salgsoppgaver",
        },
        {
          title: "Butikksjef",
          trackKey: "M",
          purpose:
            "Driver en butikk for å nå salgsmål og levere en god kundeopplevelse.",
          responsibilities:
            "Lede butikkpersonalet\nDrive salg og mål\nStyre varelager og budsjetter\nSikre servicestandarder",
        },
        {
          title: "Regionsjef",
          trackKey: "M",
          purpose:
            "Leder en gruppe butikker for å levere jevne resultater i regionen.",
          responsibilities:
            "Lede flere butikksjefer\nSette regionale mål\nDrive salg på tvers av butikker\nSikre driftsmessig konsistens",
        },
      ],
    },
    {
      name: "E-handel",
      roles: [
        {
          title: "E-handelsspesialist",
          trackKey: "IC",
          purpose: "Driver og forbedrer nettbutikken for å øke nettsalget.",
          responsibilities:
            "Vedlikeholde produktoppføringer\nFølge med på resultater på nett\nStøtte kampanjer og tilbud\nForbedre kundereisen",
        },
        {
          title: "E-handelssjef",
          trackKey: "M",
          purpose: "Leder e-handelskanalen for å nå mål for vekst på nett.",
          responsibilities:
            "Sette e-handelsstrategi\nLede nettteamet\nDrive trafikk og konvertering\nEie salgsmål på nett",
        },
      ],
    },
    {
      name: "Innkjøp",
      roles: [
        {
          title: "Innkjøper",
          trackKey: "IC",
          purpose:
            "Kilder og kjøper produkter på de rette betingelsene for virksomheten.",
          responsibilities:
            "Velge produkter og leverandører\nForhandle priser og betingelser\nForvalte innkjøpsordrer\nFølge med på lagernivåer",
        },
        {
          title: "Innkjøpssjef",
          trackKey: "M",
          purpose:
            "Leder innkjøp for å sikre de rette produktene til riktig kostnad.",
          responsibilities:
            "Sette innkjøpsstrategi\nLede innkjøpsteamet\nForhandle viktige leverandøravtaler\nStyre innkjøpsbudsjetter",
        },
      ],
    },
    {
      name: "Lager og logistikk",
      roles: [
        {
          title: "Lagermedarbeider",
          trackKey: "IC",
          purpose:
            "Håndterer varer på lageret slik at bestillinger flyter nøyaktig.",
          responsibilities:
            "Motta og lagre varer\nPlukke og pakke bestillinger\nHolde orden på lageret\nFølge sikkerhetsprosedyrer",
        },
        {
          title: "Lagersjef",
          trackKey: "M",
          purpose:
            "Leder lagerdriften for nøyaktig og rettidig varehåndtering.",
          responsibilities:
            "Lede lagerpersonalet\nPlanlegge lagring og flyt\nStyre lagernøyaktighet\nSikre sikkerhet og effektivitet",
        },
      ],
    },
  ],
  publicSector: [
    {
      name: "Saksbehandling",
      roles: [
        {
          title: "Saksbehandler",
          trackKey: "IC",
          purpose:
            "Behandler saker og fatter vedtak i tråd med regler og forskrifter.",
          responsibilities:
            "Vurdere og behandle saker\nAnvende relevant regelverk\nDokumentere vedtak\nKommunisere med søkere",
        },
        {
          title: "Teamleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer et saksbehandlingsteam for å sikre konsistente og rettidige vedtak.",
          responsibilities:
            "Fordele og prioritere saker\nVeilede og støtte teamet\nFølge med på sakskvalitet\nLøse komplekse saker",
        },
        {
          title: "Enhetsleder",
          trackKey: "M",
          purpose:
            "Leder en enhet til å levere sitt mandat og utvikle medarbeiderne.",
          responsibilities:
            "Lede og utvikle medarbeidere\nPlanlegge enhetens drift\nSette mål og følge opp\nSikre etterlevelse av regelverk",
        },
      ],
    },
    {
      name: "Utvikling",
      roles: [
        {
          title: "Utviklingsrådgiver",
          trackKey: "IC",
          purpose: "Driver forbedringstiltak som styrker offentlige tjenester.",
          responsibilities:
            "Analysere utviklingsbehov\nForeslå forbedringer\nStøtte gjennomføring\nFølge opp resultater",
        },
        {
          title: "Prosjektleder",
          trackKey: "Lead",
          purpose:
            "Leder prosjekter til å levere tilsiktede resultater til rett tid og innenfor budsjett.",
          responsibilities:
            "Planlegge og avgrense prosjekter\nKoordinere prosjektdeltakere\nStyre tidsplaner og budsjett\nRapportere på fremdrift",
        },
      ],
    },
    {
      name: "Administrasjon",
      roles: [
        {
          title: "Administrator",
          trackKey: "IC",
          purpose: "Gir administrativ støtte som holder driften i gang.",
          responsibilities:
            "Håndtere administrative oppgaver\nVedlikeholde registre og systemer\nStøtte interne prosesser\nKoordinere tidsplaner og møter",
        },
        {
          title: "Arkivar",
          trackKey: "IC",
          purpose:
            "Forvalter offisielle registre for å sikre korrekt og tilgjengelig dokumentasjon.",
          responsibilities:
            "Journalføre innkommende dokumenter\nVedlikeholde arkivsystemet\nSikre korrekt klassifisering\nStøtte innsynsbegjæringer",
        },
      ],
    },
  ],
  healthcare: [
    {
      name: "Pleie",
      roles: [
        {
          title: "Helsefagarbeider",
          trackKey: "IC",
          purpose:
            "Gir praktisk omsorg som støtter pasientenes daglige velvære.",
          responsibilities:
            "Hjelpe pasienter med daglig stell\nStøtte sykepleiepersonalet\nFølge med på pasientens tilstand\nDokumentere gitt omsorg",
        },
        {
          title: "Sykepleier",
          trackKey: "IC",
          purpose: "Leverer sykepleie og ivaretar pasientsikkerhet og velvære.",
          responsibilities:
            "Vurdere og planlegge pasientbehandling\nAdministrere behandling og medisiner\nFølge med på pasientens tilstand\nDokumentere og rapportere omsorg",
        },
        {
          title: "Spesialsykepleier",
          trackKey: "IC",
          purpose: "Gir avansert sykepleie innenfor en klinisk spesialitet.",
          responsibilities:
            "Levere spesialisert omsorg\nVeilede kolleger innen spesialiteten\nLede kliniske vurderinger\nStøtte utvikling av omsorgen",
        },
        {
          title: "Enhetsleder",
          trackKey: "M",
          purpose:
            "Leder en pleieenhet til å levere trygg omsorg av god kvalitet og utvikle medarbeiderne.",
          responsibilities:
            "Lede og utvikle medarbeidere\nPlanlegge bemanning og drift\nSikre kvalitet og sikkerhet i omsorgen\nForvalte enhetens budsjett",
        },
      ],
    },
    {
      name: "Omsorg",
      roles: [
        {
          title: "Omsorgsassistent",
          trackKey: "IC",
          purpose:
            "Støtter enkeltpersoner med dagligdagse behov for å opprettholde livskvalitet.",
          responsibilities:
            "Hjelpe med daglige aktiviteter\nStøtte personlig stell\nObservere og rapportere endringer\nDokumentere gitt støtte",
        },
        {
          title: "Miljøterapeut",
          trackKey: "IC",
          purpose:
            "Støtter enkeltpersoners utvikling og selvstendighet i hverdagen.",
          responsibilities:
            "Planlegge og gi støtte\nOppmuntre ferdigheter og selvstendighet\nFølge individuelle omsorgsplaner\nDokumentere fremgang",
        },
      ],
    },
    {
      name: "Administrasjon",
      roles: [
        {
          title: "Omsorgsadministrator",
          trackKey: "IC",
          purpose: "Gir administrativ støtte som holder omsorgsdriften i gang.",
          responsibilities:
            "Håndtere administrative oppgaver\nVedlikeholde registre og tidsplaner\nStøtte pleiepersonalet\nKoordinere avtaler",
        },
        {
          title: "Driftssjef",
          trackKey: "M",
          purpose:
            "Leder omsorgsdriften for å levere tjenester av god kvalitet og utvikle medarbeiderne.",
          responsibilities:
            "Lede og utvikle medarbeidere\nPlanlegge og drive virksomheten\nStyre budsjetter og kvalitet\nSikre etterlevelse av regelverk",
        },
      ],
    },
  ],
  finance: [
    {
      name: "Rådgivning",
      roles: [
        {
          title: "Rådgiver",
          trackKey: "IC",
          purpose:
            "Rådgir kunder om finansielle produkter for å dekke deres behov.",
          responsibilities:
            "Kartlegge kundebehov\nAnbefale finansielle produkter\nForvalte kunderelasjoner\nSikre etterlevelse i rådgivningen",
        },
        {
          title: "Banksjef",
          trackKey: "M",
          purpose:
            "Leder en avdeling for å nå forretningsmål og betjene kundene godt.",
          responsibilities:
            "Lede avdelingens personale\nDrive salg og mål\nSikre servicekvalitet\nFølge opp avdelingens etterlevelse",
        },
      ],
    },
    {
      name: "Analyse",
      roles: [
        {
          title: "Analytiker",
          trackKey: "IC",
          purpose:
            "Analyserer finansielle data for å understøtte gode forretningsbeslutninger.",
          responsibilities:
            "Samle inn og analysere data\nBygge finansielle modeller\nUtarbeide rapporter og innsikt\nStøtte beslutningstaking",
        },
        {
          title: "Sjefanalytiker",
          trackKey: "Lead",
          purpose:
            "Leder analysearbeidet og setter standarden for finansiell analyse.",
          responsibilities:
            "Lede komplekse analyser\nVeilede og gjennomgå analytikere\nFastsette analysemetoder\nPresentere innsikt for ledelsen",
        },
      ],
    },
    {
      name: "Risiko og etterlevelse",
      roles: [
        {
          title: "Etterlevelsesansvarlig",
          trackKey: "IC",
          purpose:
            "Sikrer at organisasjonen opererer innenfor lover og regler.",
          responsibilities:
            "Følge med på etterlevelse av regelverk\nVurdere etterlevelsesrisiko\nGi råd om krav\nRapportere om etterlevelsesavvik",
        },
        {
          title: "Risikosjef",
          trackKey: "M",
          purpose:
            "Leder risikofunksjonen for å identifisere og kontrollere sentrale risikoer.",
          responsibilities:
            "Sette rammeverket for risiko\nLede risikoteamet\nFølge opp risikovurdering\nRapportere risiko til ledelsen",
        },
      ],
    },
    {
      name: "Backoffice",
      roles: [
        {
          title: "Saksbehandler",
          trackKey: "IC",
          purpose:
            "Behandler transaksjoner og registreringer nøyaktig for å støtte driften.",
          responsibilities:
            "Behandle transaksjoner\nVedlikeholde nøyaktige registreringer\nAvstemme kontoer\nLøse avvik",
        },
        {
          title: "Teamleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer et backoffice-team for nøyaktig og rettidig behandling.",
          responsibilities:
            "Fordele og prioritere arbeid\nVeilede og støtte teamet\nFølge med på behandlingskvalitet\nLøse komplekse saker",
        },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Prosjekter",
      roles: [
        {
          title: "Prosjekteringsingeniør",
          trackKey: "IC",
          purpose: "Gir teknisk støtte for å levere byggeprosjekter korrekt.",
          responsibilities:
            "Utarbeide teknisk dokumentasjon\nStøtte prosjektplanlegging\nKoordinere med entreprenører\nFølge med på teknisk kvalitet",
        },
        {
          title: "Prosjektleder",
          trackKey: "Lead",
          purpose:
            "Leder prosjektleveransen for å nå mål for omfang, tid og budsjett.",
          responsibilities:
            "Planlegge og avgrense prosjekter\nKoordinere prosjektteamet\nStyre tidsplaner og budsjett\nRapportere på fremdrift",
        },
        {
          title: "Prosjektdirektør",
          trackKey: "M",
          purpose:
            "Eier prosjektresultatene og forvalter interessenter, kostnad og risiko.",
          responsibilities:
            "Lede prosjektleveransen\nForvalte budsjett og kontrakter\nHåndtere interessenter og risiko\nSikre prosjektkvalitet",
        },
      ],
    },
    {
      name: "Produksjon",
      roles: [
        {
          title: "Håndverker",
          trackKey: "IC",
          purpose:
            "Utfører faglært håndverksarbeid etter påkrevde standarder på byggeplass.",
          responsibilities:
            "Utføre håndverksarbeid på plass\nFølge tegninger og spesifikasjoner\nIvareta kvalitet og sikkerhet\nRapportere fremdrift og avvik",
        },
        {
          title: "Bas",
          trackKey: "Lead",
          purpose:
            "Koordinerer arbeidet på byggeplassen slik at det er trygt, i rute og etter standard.",
          responsibilities:
            "Lede arbeidet på plassen\nKoordinere fag og arbeidslag\nFølge med på sikkerhet og kvalitet\nRapportere fremdrift på plassen",
        },
        {
          title: "Anleggsleder",
          trackKey: "M",
          purpose:
            "Leder driften på byggeplassen for å levere bygging trygt og etter plan.",
          responsibilities:
            "Lede personale og arbeidslag på plassen\nPlanlegge og drive arbeidet på plassen\nStyre kostnad og fremdrift\nSikre sikkerhet og kvalitet på plassen",
        },
      ],
    },
    {
      name: "Eiendomsforvaltning",
      roles: [
        {
          title: "Eiendomstekniker",
          trackKey: "IC",
          purpose:
            "Vedlikeholder eiendommer for å holde bygninger trygge og funksjonelle.",
          responsibilities:
            "Utføre eiendomsvedlikehold\nHåndtere reparasjoner og feil\nInspisere byggets tekniske anlegg\nSvare på henvendelser fra leietakere",
        },
        {
          title: "Eiendomsforvalter",
          trackKey: "IC",
          purpose:
            "Forvalter eiendommer for å holde dem godt driftet og leietakerne fornøyde.",
          responsibilities:
            "Forvalte eiendomsdriften\nHåndtere leietakerrelasjoner\nKoordinere vedlikehold\nFølge med på eiendomsbudsjetter",
        },
        {
          title: "Eiendomssjef",
          trackKey: "M",
          purpose:
            "Leder eiendomsforvaltningen for å optimalisere eiendomsporteføljen.",
          responsibilities:
            "Sette eiendomsstrategi\nLede eiendomsteamet\nOptimalisere porteføljens resultater\nStyre eiendomsbudsjetter",
        },
      ],
    },
  ],
  other: [
    {
      name: "Drift",
      roles: [
        {
          title: "Medarbeider",
          trackKey: "IC",
          purpose: "Utfører det daglige arbeidet som holder driften i gang.",
          responsibilities:
            "Utføre daglige oppgaver\nFølge etablerte prosesser\nStøtte teamets mål\nRapportere avvik og resultater",
        },
        {
          title: "Teamleder",
          trackKey: "Lead",
          purpose: "Koordinerer et team for å levere sine daglige mål.",
          responsibilities:
            "Fordele og prioritere arbeid\nVeilede og støtte teamet\nFølge med på kvalitet og fremdrift\nLøse daglige problemer",
        },
        {
          title: "Leder",
          trackKey: "M",
          purpose: "Leder et team til å nå sine mål og utvikle medarbeiderne.",
          responsibilities:
            "Lede og utvikle teamet\nPlanlegge og drive virksomheten\nSette mål og følge opp\nStyre budsjett og kvalitet",
        },
      ],
    },
    {
      name: "Salg",
      roles: [
        {
          title: "Selger",
          trackKey: "IC",
          purpose: "Driver salg ved å vinne og betjene kunder.",
          responsibilities:
            "Forfølge salgsmuligheter\nForvalte kunderelasjoner\nForhandle og lukke avtaler\nNå salgsmål",
        },
        {
          title: "Salgsleder",
          trackKey: "M",
          purpose: "Leder salgsarbeidet for å nå mål for vekst og inntekt.",
          responsibilities:
            "Sette salgsmål\nLede salgsteamet\nPrognostisere og rapportere resultater\nUtvikle viktige kunderelasjoner",
        },
      ],
    },
    {
      name: "Administrasjon",
      roles: [
        {
          title: "Administrator",
          trackKey: "IC",
          purpose: "Gir administrativ støtte som holder virksomheten i gang.",
          responsibilities:
            "Håndtere administrative oppgaver\nVedlikeholde registre og systemer\nStøtte interne prosesser\nKoordinere tidsplaner og møter",
        },
        {
          title: "Økonomisjef",
          trackKey: "M",
          purpose: "Leder økonomistyringen og sikrer god finansiell kontroll.",
          responsibilities:
            "Forvalte budsjettering og rapportering\nFølge opp regnskapsprosesser\nSikre etterlevelse av finansielle krav\nLede økonomiteamet",
        },
      ],
    },
  ],
}
