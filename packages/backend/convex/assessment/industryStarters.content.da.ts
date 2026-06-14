import type { StarterContent } from "./industryStarters"

// Danish starter sets. Titles are stored as written once the user confirms
// (user data, no read-time localization). Track keys reference the fixed
// schema (IC/Lead/M). One role per JOB (ADR-0005): seniority lives on the
// individual, so there are no junior/senior title variants; a senior whose
// work actually differs becomes its own role, added by the user.
// NOTE: purpose/responsibilities are machine-drafted (mirror of the en
// profiles) and need native Danish review before launch.
export const industryStartersDa: StarterContent = {
  itTelecom: [
    {
      name: "Engineering",
      roles: [
        {
          title: "Softwareudvikler",
          trackKey: "IC",
          purpose:
            "Bygger og vedligeholder software, der opfylder produkt- og kvalitetskrav.",
          responsibilities:
            "Designe og implementere funktioner\nSkrive og gennemgå kode\nRette fejl og forbedre ydeevne\nSamarbejde om tekniske beslutninger",
        },
        {
          title: "Tech Lead",
          trackKey: "Lead",
          purpose:
            "Styrer et teams tekniske retning og sikrer solide ingeniørmæssige arbejdsgange.",
          responsibilities:
            "Fastlægge teknisk retning og standarder\nGennemgå arkitektur og centrale beslutninger\nVejlede og fjerne forhindringer for udviklere\nKoordinere levering på tværs af teamet",
        },
        {
          title: "Engineering Manager",
          trackKey: "M",
          purpose:
            "Leder et udviklingsteam, der leverer pålideligt, og udvikler dets medarbejdere.",
          responsibilities:
            "Lede og udvikle teamet\nPlanlægge kapacitet og levering\nSætte mål og følge op\nUnderstøtte rekruttering og udvikling",
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
            "Ejer produktets retning og sikrer, at de rigtige ting bliver bygget.",
          responsibilities:
            "Definere produktstrategi og roadmap\nPrioritere backloggen\nIndsamle og analysere brugerbehov\nSkabe enighed blandt interessenter og teams",
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
            "Former intuitive brugeroplevelser baseret på research og produktmål.",
          responsibilities:
            "Gennemføre brugerresearch\nDesigne flows og brugerflader\nUdarbejde prototyper og wireframes\nValidere design gennem test",
        },
      ],
    },
    {
      name: "Salg",
      roles: [
        {
          title: "Account Executive",
          trackKey: "IC",
          purpose:
            "Driver nyt salg ved at lukke aftaler og udbygge kundekonti.",
          responsibilities:
            "Styre salgspipelinen\nKvalificere og forfølge muligheder\nForhandle og lukke aftaler\nVedligeholde kunderelationer",
        },
        {
          title: "Salgschef",
          trackKey: "M",
          purpose: "Leder salgsorganisationen mod omsætnings- og vækstmål.",
          responsibilities:
            "Fastlægge salgsstrategi og mål\nLede og coache salgsteamet\nPrognosticere og rapportere på resultater\nUdvikle nøglekunder og partnere",
        },
      ],
    },
    {
      name: "Customer Success",
      roles: [
        {
          title: "Supportspecialist",
          trackKey: "IC",
          purpose:
            "Løser kundernes problemer og sikrer en positiv supportoplevelse.",
          responsibilities:
            "Besvare kundehenvendelser\nFejlsøge og løse problemer\nEskalere komplekse sager\nDokumentere løsninger og feedback",
        },
        {
          title: "Customer Success Manager",
          trackKey: "IC",
          purpose:
            "Sikrer, at kunderne får værdi og fortsat vokser med produktet.",
          responsibilities:
            "Onboarde og vejlede kunder\nFølge adoption og kundesundhed\nDrive fornyelser og mersalg\nIndsamle og videreformidle kundefeedback",
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
            "Leverer kundearbejde og rådgivning, der løser konkrete forretningsproblemer.",
          responsibilities:
            "Analysere kundens behov\nUdarbejde anbefalinger\nLevere projektarbejde\nPræsentere resultater for kunderne",
        },
        {
          title: "Engagement Lead",
          trackKey: "Lead",
          purpose:
            "Leder kundeopgaver, så der leveres resultater af høj kvalitet til tiden.",
          responsibilities:
            "Planlægge og afgrænse opgaver\nLede leveranceteamet\nStyre kunderelationer\nSikre kvaliteten af leverancerne",
        },
        {
          title: "Practice Manager",
          trackKey: "M",
          purpose:
            "Opbygger og driver et konsulentområde og udvikler dets konsulenter.",
          responsibilities:
            "Fastlægge områdets retning\nLede og udvikle konsulenter\nFølge udnyttelse og levering\nUnderstøtte forretningsudvikling",
        },
      ],
    },
    {
      name: "Salg",
      roles: [
        {
          title: "Account Manager",
          trackKey: "IC",
          purpose:
            "Vedligeholder og udbygger kundekonti for at sikre fortsat forretning.",
          responsibilities:
            "Styre kunderelationer\nIdentificere nye muligheder\nUdarbejde tilbud\nNå kontomål",
        },
        {
          title: "Salgschef",
          trackKey: "M",
          purpose: "Leder salgsindsatsen mod vækst- og omsætningsmål.",
          responsibilities:
            "Fastlægge salgsmål\nLede salgsteamet\nPrognosticere og rapportere resultater\nUdvikle vigtige kunderelationer",
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
            "Holder den daglige drift kørende gennem præcis administrativ støtte.",
          responsibilities:
            "Håndtere administrative opgaver\nVedligeholde registre og systemer\nUnderstøtte interne processer\nKoordinere kalendere og logistik",
        },
        {
          title: "Økonomichef",
          trackKey: "M",
          purpose:
            "Leder den økonomiske styring og sikrer solid finansiel kontrol.",
          responsibilities:
            "Styre budgettering og rapportering\nFøre tilsyn med regnskabsprocesser\nSikre finansiel compliance\nLede økonomiteamet",
        },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Produktion",
      roles: [
        {
          title: "Operatør",
          trackKey: "IC",
          purpose:
            "Betjener produktionsudstyr og fremstiller varer sikkert og efter standard.",
          responsibilities:
            "Betjene produktionsmaskiner\nFølge sikkerhedsprocedurer\nOvervåge produktkvaliteten\nRapportere fejl og driftsstop",
        },
        {
          title: "Produktionsingeniør",
          trackKey: "IC",
          purpose:
            "Forbedrer produktionsprocesser med fokus på effektivitet, kvalitet og sikkerhed.",
          responsibilities:
            "Optimere produktionsprocesser\nFejlsøge tekniske problemer\nUnderstøtte vedligehold af udstyr\nImplementere procesforbedringer",
        },
        {
          title: "Produktionsleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer et produktionsteam, så output- og kvalitetsmål nås.",
          responsibilities:
            "Planlægge og fordele skiftarbejde\nVejlede produktionsteamet\nOvervåge output og kvalitet\nLøse daglige problemer",
        },
        {
          title: "Produktionschef",
          trackKey: "M",
          purpose:
            "Leder produktionsdriften mod mål for volumen, omkostninger og kvalitet.",
          responsibilities:
            "Planlægge produktionskapacitet\nLede produktionsteams\nStyre omkostninger og kvalitet\nDrive løbende forbedringer",
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
            "Sikrer, at produkterne opfylder kvalitetsstandarder og specifikationer.",
          responsibilities:
            "Definere kvalitetskontroller\nInspicere og teste produkter\nUndersøge kvalitetsproblemer\nDrive korrigerende handlinger",
        },
        {
          title: "Kvalitetschef",
          trackKey: "M",
          purpose:
            "Leder kvalitetsfunktionen og sikrer produkt- og proceskvalitet.",
          responsibilities:
            "Eje kvalitetsstyringssystemet\nLede kvalitetsteamet\nSikre regulatorisk compliance\nDrive kvalitetsforbedringer",
        },
      ],
    },
    {
      name: "Vedligehold",
      roles: [
        {
          title: "Vedligeholdstekniker",
          trackKey: "IC",
          purpose:
            "Holder udstyr og faciliteter kørende gennem reparation og vedligehold.",
          responsibilities:
            "Udføre forebyggende vedligehold\nDiagnosticere og udbedre fejl\nDokumentere vedligeholdsarbejde\nFølge sikkerhedsprocedurer",
        },
        {
          title: "Vedligeholdsleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer vedligeholdsarbejdet for at maksimere udstyrets oppetid.",
          responsibilities:
            "Planlægge vedligeholdsplaner\nVejlede vedligeholdsteamet\nPrioritere reparationer\nFølge udstyrets driftssikkerhed",
        },
      ],
    },
    {
      name: "Logistik",
      roles: [
        {
          title: "Logistikkoordinator",
          trackKey: "IC",
          purpose:
            "Koordinerer varestrømmen, så leverancer ankommer til tiden.",
          responsibilities:
            "Planlægge forsendelser og transport\nKoordinere med leverandører\nFølge lager og ordrer\nLøse leveringsproblemer",
        },
        {
          title: "Logistikchef",
          trackKey: "M",
          purpose:
            "Leder logistikdriften for effektiv forsyning og distribution.",
          responsibilities:
            "Fastlægge logistikstrategi\nLede logistikteamet\nOptimere forsyningskædens flow\nStyre logistikomkostninger",
        },
      ],
    },
  ],
  retail: [
    {
      name: "Butikker",
      roles: [
        {
          title: "Salgsassistent",
          trackKey: "IC",
          purpose: "Betjener kunder og driver salget på butiksgulvet.",
          responsibilities:
            "Hjælpe og rådgive kunder\nGennemføre salgstransaktioner\nVedligeholde butikkens fremtoning\nHåndtere varer på gulvet",
        },
        {
          title: "Vagtansvarlig",
          trackKey: "Lead",
          purpose:
            "Koordinerer butiksteamet i løbet af en vagt, så driften kører gnidningsfrit.",
          responsibilities:
            "Lede personalet under vagter\nÅbne og lukke butikken\nHåndtere kundeeskaleringer\nFølge daglige salgsopgaver",
        },
        {
          title: "Butikschef",
          trackKey: "M",
          purpose:
            "Driver en butik mod salgsmål og leverer en stærk kundeoplevelse.",
          responsibilities:
            "Lede butikspersonalet\nDrive salg og mål\nStyre varelager og budgetter\nSikre servicestandarder",
        },
        {
          title: "Regionschef",
          trackKey: "M",
          purpose:
            "Leder en gruppe butikker for at levere ensartede resultater i regionen.",
          responsibilities:
            "Lede flere butikschefer\nFastlægge regionale mål\nDrive salg på tværs af butikker\nSikre operationel ensartethed",
        },
      ],
    },
    {
      name: "E-handel",
      roles: [
        {
          title: "E-handelsspecialist",
          trackKey: "IC",
          purpose:
            "Driver og forbedrer onlinebutikken for at øge onlinesalget.",
          responsibilities:
            "Vedligeholde produktvisninger\nOvervåge onlineresultater\nUnderstøtte kampagner og tilbud\nForbedre kunderejsen",
        },
        {
          title: "E-handelschef",
          trackKey: "M",
          purpose: "Leder e-handelskanalen mod mål for onlinevækst.",
          responsibilities:
            "Fastlægge e-handelsstrategi\nLede onlineteamet\nDrive trafik og konvertering\nEje onlinesalgsmålene",
        },
      ],
    },
    {
      name: "Indkøb",
      roles: [
        {
          title: "Indkøber",
          trackKey: "IC",
          purpose:
            "Finder og køber produkter på de rette vilkår for virksomheden.",
          responsibilities:
            "Vælge produkter og leverandører\nForhandle priser og vilkår\nStyre indkøbsordrer\nOvervåge lagerniveauer",
        },
        {
          title: "Indkøbschef",
          trackKey: "M",
          purpose:
            "Leder indkøb for at sikre de rette produkter til de rette omkostninger.",
          responsibilities:
            "Fastlægge indkøbsstrategi\nLede indkøbsteamet\nForhandle vigtige leverandøraftaler\nStyre indkøbsbudgetter",
        },
      ],
    },
    {
      name: "Lager og logistik",
      roles: [
        {
          title: "Lagermedarbejder",
          trackKey: "IC",
          purpose:
            "Håndterer varer på lageret, så ordrer flyder præcist videre.",
          responsibilities:
            "Modtage og opbevare varer\nPlukke og pakke ordrer\nHolde orden på lageret\nFølge sikkerhedsprocedurer",
        },
        {
          title: "Lagerchef",
          trackKey: "M",
          purpose:
            "Leder lagerdriften for præcis og rettidig håndtering af varer.",
          responsibilities:
            "Lede lagerpersonalet\nPlanlægge opbevaring og flow\nStyre lagernøjagtighed\nSikre sikkerhed og effektivitet",
        },
      ],
    },
  ],
  publicSector: [
    {
      name: "Sagsbehandling",
      roles: [
        {
          title: "Sagsbehandler",
          trackKey: "IC",
          purpose:
            "Behandler sager og afgørelser i overensstemmelse med regler og forskrifter.",
          responsibilities:
            "Vurdere og behandle sager\nAnvende relevante regler\nDokumentere afgørelser\nKommunikere med ansøgere",
        },
        {
          title: "Teamleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer et sagsbehandlingsteam for at sikre ensartede og rettidige afgørelser.",
          responsibilities:
            "Fordele og prioritere sager\nVejlede og støtte teamet\nOvervåge sagskvalitet\nLøse komplekse sager",
        },
        {
          title: "Enhedsleder",
          trackKey: "M",
          purpose:
            "Leder en enhed, så den løser sit mandat og udvikler sine medarbejdere.",
          responsibilities:
            "Lede og udvikle medarbejdere\nPlanlægge enhedens drift\nSætte mål og følge op\nSikre regulatorisk compliance",
        },
      ],
    },
    {
      name: "Udvikling",
      roles: [
        {
          title: "Udviklingskonsulent",
          trackKey: "IC",
          purpose:
            "Driver forbedringsinitiativer, der styrker de offentlige ydelser.",
          responsibilities:
            "Analysere udviklingsbehov\nForeslå forbedringer\nUnderstøtte implementering\nFølge op på resultater",
        },
        {
          title: "Projektleder",
          trackKey: "Lead",
          purpose:
            "Leder projekter for at levere de tilsigtede resultater til tiden og inden for budget.",
          responsibilities:
            "Planlægge og afgrænse projekter\nKoordinere projektdeltagere\nStyre tidsplaner og budget\nRapportere på fremdrift",
        },
      ],
    },
    {
      name: "Administration",
      roles: [
        {
          title: "Administrator",
          trackKey: "IC",
          purpose: "Yder administrativ støtte, der holder driften kørende.",
          responsibilities:
            "Håndtere administrative opgaver\nVedligeholde registre og systemer\nUnderstøtte interne processer\nKoordinere kalendere og møder",
        },
        {
          title: "Journalansvarlig",
          trackKey: "IC",
          purpose:
            "Forvalter officielle dokumenter for at sikre korrekt og tilgængelig dokumentation.",
          responsibilities:
            "Registrere indgående dokumenter\nVedligeholde journalsystemet\nSikre korrekt klassificering\nUnderstøtte aktindsigt",
        },
      ],
    },
  ],
  healthcare: [
    {
      name: "Pleje",
      roles: [
        {
          title: "Social- og sundhedsassistent",
          trackKey: "IC",
          purpose:
            "Yder praktisk pleje, der understøtter patienternes daglige velbefindende.",
          responsibilities:
            "Hjælpe patienter med daglig pleje\nUnderstøtte plejepersonalet\nOvervåge patienternes tilstand\nDokumentere den ydede pleje",
        },
        {
          title: "Sygeplejerske",
          trackKey: "IC",
          purpose:
            "Leverer sygepleje og værner om patientsikkerhed og velbefindende.",
          responsibilities:
            "Vurdere og planlægge patientpleje\nGive behandlinger og medicin\nOvervåge patienternes tilstand\nDokumentere og rapportere pleje",
        },
        {
          title: "Specialsygeplejerske",
          trackKey: "IC",
          purpose: "Yder avanceret sygepleje inden for et klinisk speciale.",
          responsibilities:
            "Levere specialiseret pleje\nVejlede kolleger i specialet\nLede kliniske vurderinger\nUnderstøtte udvikling af plejen",
        },
        {
          title: "Enhedsleder",
          trackKey: "M",
          purpose:
            "Leder en plejeenhed, så der leveres sikker pleje af høj kvalitet, og udvikler personalet.",
          responsibilities:
            "Lede og udvikle medarbejdere\nPlanlægge bemanding og drift\nSikre plejekvalitet og sikkerhed\nStyre enhedens budget",
        },
      ],
    },
    {
      name: "Socialt arbejde",
      roles: [
        {
          title: "Omsorgsmedhjælper",
          trackKey: "IC",
          purpose:
            "Støtter borgere med hverdagens behov for at bevare livskvaliteten.",
          responsibilities:
            "Hjælpe med daglige aktiviteter\nUnderstøtte personlig pleje\nObservere og rapportere ændringer\nDokumentere den ydede støtte",
        },
        {
          title: "Pædagogisk assistent",
          trackKey: "IC",
          purpose:
            "Understøtter borgeres udvikling og selvstændighed i dagligdagen.",
          responsibilities:
            "Planlægge og yde støtte\nFremme færdigheder og selvstændighed\nFølge individuelle handleplaner\nDokumentere fremskridt",
        },
      ],
    },
    {
      name: "Administration",
      roles: [
        {
          title: "Plejeadministrator",
          trackKey: "IC",
          purpose:
            "Yder administrativ støtte, der holder plejedriften kørende.",
          responsibilities:
            "Håndtere administrative opgaver\nVedligeholde registre og kalendere\nUnderstøtte plejepersonalet\nKoordinere aftaler",
        },
        {
          title: "Driftschef",
          trackKey: "M",
          purpose:
            "Leder plejedriften for at levere ydelser af høj kvalitet og udvikle personalet.",
          responsibilities:
            "Lede og udvikle medarbejdere\nPlanlægge og drive driften\nStyre budgetter og kvalitet\nSikre regulatorisk compliance",
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
            "Rådgiver kunder om finansielle produkter, der opfylder deres behov.",
          responsibilities:
            "Vurdere kundens behov\nAnbefale finansielle produkter\nStyre kunderelationer\nSikre compliance i rådgivningen",
        },
        {
          title: "Filialchef",
          trackKey: "M",
          purpose: "Leder en filial mod forretningsmål og god kundebetjening.",
          responsibilities:
            "Lede filialens personale\nDrive salg og mål\nSikre servicekvalitet\nFøre tilsyn med filialens compliance",
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
            "Analyserer finansielle data for at understøtte solide forretningsbeslutninger.",
          responsibilities:
            "Indsamle og analysere data\nBygge finansielle modeller\nUdarbejde rapporter og indsigter\nUnderstøtte beslutningstagning",
        },
        {
          title: "Chefanalytiker",
          trackKey: "Lead",
          purpose:
            "Leder analysearbejdet og sætter standarden for finansiel analyse.",
          responsibilities:
            "Lede komplekse analyser\nVejlede og gennemgå analytikere\nFastlægge analysemetoder\nPræsentere indsigter for ledelsen",
        },
      ],
    },
    {
      name: "Risiko og compliance",
      roles: [
        {
          title: "Compliance Officer",
          trackKey: "IC",
          purpose:
            "Sikrer, at organisationen arbejder inden for love og regler.",
          responsibilities:
            "Overvåge regulatorisk compliance\nVurdere compliancerisici\nRådgive om krav\nRapportere om complianceforhold",
        },
        {
          title: "Risikochef",
          trackKey: "M",
          purpose:
            "Leder risikofunktionen for at identificere og styre væsentlige risici.",
          responsibilities:
            "Fastlægge risikorammeværket\nLede risikoteamet\nFøre tilsyn med risikovurdering\nRapportere risiko til ledelsen",
        },
      ],
    },
    {
      name: "Back office",
      roles: [
        {
          title: "Sagsbehandler",
          trackKey: "IC",
          purpose:
            "Behandler transaktioner og registreringer præcist for at understøtte driften.",
          responsibilities:
            "Behandle transaktioner\nVedligeholde præcise registreringer\nAfstemme konti\nLøse uoverensstemmelser",
        },
        {
          title: "Teamleder",
          trackKey: "Lead",
          purpose:
            "Koordinerer et back office-team for præcis og rettidig behandling.",
          responsibilities:
            "Fordele og prioritere arbejde\nVejlede og støtte teamet\nOvervåge behandlingskvalitet\nLøse komplekse sager",
        },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Projekter",
      roles: [
        {
          title: "Projektingeniør",
          trackKey: "IC",
          purpose: "Yder teknisk støtte, så byggeprojekter leveres korrekt.",
          responsibilities:
            "Udarbejde teknisk dokumentation\nUnderstøtte projektplanlægning\nKoordinere med entreprenører\nOvervåge teknisk kvalitet",
        },
        {
          title: "Projektleder",
          trackKey: "Lead",
          purpose: "Leder projektleverancen mod mål for omfang, tid og budget.",
          responsibilities:
            "Planlægge og afgrænse projekter\nKoordinere projektteamet\nStyre tidsplaner og budget\nRapportere på fremdrift",
        },
        {
          title: "Projektchef",
          trackKey: "M",
          purpose:
            "Ejer projektresultaterne og styrer interessenter, omkostninger og risiko.",
          responsibilities:
            "Lede projektleverancen\nStyre budget og kontrakter\nHåndtere interessenter og risiko\nSikre projektkvalitet",
        },
      ],
    },
    {
      name: "Udførelse",
      roles: [
        {
          title: "Håndværker",
          trackKey: "IC",
          purpose:
            "Udfører faglært håndværk efter de krævede standarder på byggepladsen.",
          responsibilities:
            "Udføre håndværk på byggepladsen\nFølge tegninger og specifikationer\nHolde kvalitet og sikkerhed\nRapportere fremdrift og fejl",
        },
        {
          title: "Sjakbajs",
          trackKey: "Lead",
          purpose:
            "Koordinerer arbejdet på byggepladsen, så det er sikkert, til tiden og efter standard.",
          responsibilities:
            "Lede arbejdet på byggepladsen\nKoordinere fag og sjak\nOvervåge sikkerhed og kvalitet\nRapportere på pladsens fremdrift",
        },
        {
          title: "Byggepladschef",
          trackKey: "M",
          purpose:
            "Leder byggepladsdriften for at gennemføre byggeriet sikkert og efter plan.",
          responsibilities:
            "Lede pladspersonale og sjak\nPlanlægge og drive pladsdriften\nStyre omkostninger og tidsplan\nSikre sikkerhed og kvalitet på pladsen",
        },
      ],
    },
    {
      name: "Ejendomsdrift",
      roles: [
        {
          title: "Ejendomstekniker",
          trackKey: "IC",
          purpose:
            "Vedligeholder ejendomme, så bygninger holdes sikre og funktionelle.",
          responsibilities:
            "Udføre ejendomsvedligehold\nHåndtere reparationer og fejl\nInspicere bygningsinstallationer\nReagere på henvendelser fra lejere",
        },
        {
          title: "Ejendomsadministrator",
          trackKey: "IC",
          purpose:
            "Administrerer ejendomme, så de drives godt, og lejerne er tilfredse.",
          responsibilities:
            "Styre ejendomsdriften\nHåndtere lejerrelationer\nKoordinere vedligehold\nOvervåge ejendomsbudgetter",
        },
        {
          title: "Ejendomschef",
          trackKey: "M",
          purpose:
            "Leder ejendomsadministrationen for at optimere ejendomsporteføljen.",
          responsibilities:
            "Fastlægge ejendomsstrategi\nLede ejendomsteamet\nOptimere porteføljens resultater\nStyre ejendomsbudgetter",
        },
      ],
    },
  ],
  other: [
    {
      name: "Drift",
      roles: [
        {
          title: "Medarbejder",
          trackKey: "IC",
          purpose: "Udfører det daglige arbejde, der holder driften kørende.",
          responsibilities:
            "Udføre daglige opgaver\nFølge fastlagte processer\nUnderstøtte teamets mål\nRapportere fejl og resultater",
        },
        {
          title: "Teamleder",
          trackKey: "Lead",
          purpose: "Koordinerer et team, så det leverer sine daglige mål.",
          responsibilities:
            "Fordele og prioritere arbejde\nVejlede og støtte teamet\nOvervåge kvalitet og fremdrift\nLøse daglige problemer",
        },
        {
          title: "Leder",
          trackKey: "M",
          purpose: "Leder et team mod dets mål og udvikler dets medarbejdere.",
          responsibilities:
            "Lede og udvikle teamet\nPlanlægge og drive driften\nSætte mål og følge op\nStyre budget og kvalitet",
        },
      ],
    },
    {
      name: "Salg",
      roles: [
        {
          title: "Sælger",
          trackKey: "IC",
          purpose: "Driver salget ved at vinde og betjene kunder.",
          responsibilities:
            "Forfølge salgsmuligheder\nStyre kunderelationer\nForhandle og lukke aftaler\nNå salgsmål",
        },
        {
          title: "Salgschef",
          trackKey: "M",
          purpose: "Leder salgsindsatsen mod vækst- og omsætningsmål.",
          responsibilities:
            "Fastlægge salgsmål\nLede salgsteamet\nPrognosticere og rapportere resultater\nUdvikle vigtige kunderelationer",
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
            "Yder administrativ støtte, der holder virksomheden kørende.",
          responsibilities:
            "Håndtere administrative opgaver\nVedligeholde registre og systemer\nUnderstøtte interne processer\nKoordinere kalendere og møder",
        },
        {
          title: "Økonomichef",
          trackKey: "M",
          purpose:
            "Leder den økonomiske styring og sikrer solid finansiel kontrol.",
          responsibilities:
            "Styre budgettering og rapportering\nFøre tilsyn med regnskabsprocesser\nSikre finansiel compliance\nLede økonomiteamet",
        },
      ],
    },
  ],
}
