# blueprnt — V1-plan (utkast)

Strukturerad plan för första versionen. Bygger på CTO-briefen, HR-kritiken mot EU:s lönetransparensdirektiv, och Excel-prototypen — samt besluten i `CONTEXT-MAP.md`, `docs/contexts/*` och `docs/adr/*`. Domänspråk: se ordlistorna. Status: levande utkast (öppna frågor längst ned).

## 1. Mål & framgångskriterier

blueprnt gör om en HR-avdelnings ad hoc-rollvärdering till en dokumenterad, repeterbar och spårbar modell — *grundlagret* för efterlevnad av EU:s lönetransparensdirektiv (inte hela compliance-modellen). Sverige-först, HR-only, SMB.

**Designprincip (topprioritet, beslut 2026-06-05): enkelhet för användaren.** Det ska aldrig vara krångligt att komma igång eller att använda applikationen: färre steg, färre obligatoriska fält, vettiga förval, och data som kan härledas (t.ex. antal anställda från importerade medarbetare) frågas aldrig efter. Varje nytt flöde prövas mot den här principen.

V1 lyckas när en HR-användare kan:
1. utgå från **kriteriebiblioteket** och anpassa kriterier och viktpoäng efter sitt företag (nivåtrösklarna är metodlag, ADR-0024),
2. registrera roller och **betygsätta** dem (0–5) mot ankartexter, utan att se vikter,
3. få **poäng** uträknad och **nivå** föreslagen automatiskt,
4. se en tydlig **nivåöversikt** och använda den som beslutsunderlag,
5. lita på att ändringar **loggas** (revisionslogg) — allt inom EU-datahemvist.

## 2. Arkitektur (se ADR-0001)

```
apps/web          Marknadssajt (Next.js)
apps/dashboard    Produktappen (Next.js + Convex-klient + Better Auth)   ← byggs
packages/backend  Convex: schema + queries/mutations/actions (EU-region) ← byggs
packages/core     Ren, deterministisk poäng/nivå-motor + domäntyper      ← byggs
packages/ui       shadcn/ui (finns)
```

- **Backend/data:** managed Convex Cloud, EU-region (eu-west-1). Reaktivt: vyer prenumererar på data live.
- **Auth + tenant:** Better Auth (org-plugin) i Convex-deploymentet. Org = **organisationen**. All data org-scopad i Convex-funktioner.
- **Ren motor:** `packages/core` har inga Convex/Next-beroenden → enhetstestbar, återanvändbar för framtida rapport/AI.
- **Bounded contexts** (multi-context): `accounts`, `evaluation-model`, `assessment` — initialt som modulmappar under `packages/backend/convex/`.

## 3. Datamodell-skiss (konceptuell, per kontext)

> Princip (ADR-0002): **betyg lagras**; **poäng & nivå härleds** av `packages/core` från betyg + aktuell modell. Allt scopas till `orgId`.

**accounts** (mestadels Better Auth):
- `user`, `session`, `account`, `organization`, `member`, `invitation` (från Better Auth-komponenten). `member` bär roll (Admin/Editor).
- `organizations`-tabellen (app-sidans organisationsinställningar) — orgId, land, valuta, språk, antal anställda, bransch (styr mallval). Identitet (namn/slug/medlemmar) ligger i Better Auth-komponenten; den här raden trigger-seedas vid organisationsskapande och nycklas på komponentens org-id. (Briefens företagssetup, 4.1.) Antal anställda efterfrågas inte i onboardingen; det härleds automatiskt i V2 från importerade medarbetare (beslut 2026-06-05).

**evaluation-model** (en levande modell per organisation):
- `model` — orgId, namn, härkomst (vilken mall den startade från).
- `criterion` — orgId, namn, beskrivning, **hjälptext** (vägledning till bedömaren, skild från beskrivning/ankare — briefens 4.2), **weightPoints (1–5**, neutral 3; summan över modellens kriterier är alltid exakt poängbudgeten = antal kriterier × 3, ADR-0004**)**, ordning, samt protokoll/bias-fält (syfte, varförRelevant, **överlapp mot andra kriterier**, biasRisk, **biasKommentar**, biasÅtgärd, godkänd, beslutsfattare, datum).
- `criterionAnchor` — criterionId, step (0–5), text. (Ankartexter; stegen hette level före ADR-0014.)
- `track` / `seniority` — track-schema (IC/Lead/M; senioriteter IC1–5, Lead 1–3, M1–3). Track och senioritetsladdrar är konstanter i kod (`TRACK_KEYS` i `evaluationModel/trackSchema.ts` respektive `TRACK_SENIORITIES` i `@workspace/constants`), inte seedade rader; standardmall.md är prosareferens. Senioriteterna är individens senioritet vid rollplaceringen, roller bär ingen senioritet (ADR-0005, tillägg 2026-07-10). Track-guardrails utgick med ADR-0005; intervallen är referensdata i standardmall.md.
- `levelThreshold` — orgId, nivå (1..N), minScore, etikett.
- *Viktpoängskalan (1–5) och poängbudgeten (antal kriterier × 3) är **fasta** → konstanter i `packages/core`, ingen tabell (ADR-0004).*

**assessment**:
- `role` — orgId; **jobbprofil**: obligatorisk kärna (titel, funktion/avdelning, team, track, syfte, ansvarsområden) + valfria strukturerade fält (beslutsmandat, intressenter, kunskapskrav, finansiellt ansvar, personalansvar, risk/konsekvens, leverabler). Ingen senioritet på rollen (ADR-0005: senioriteten är individdata, V2); kodfältet för titeln heter `title`.
- `rating` — orgId, roleId, criterionId, value (0–5), ev. motivering (frivillig). **(Sanningskällan.)**
- `anchorRole` — orgId, roleId, förväntad nivå. (Kalibrering; ev. senare.)

**tvärgående:**
- `auditLog` — orgId, typ (model.change / level.shift …), aktör, tidsstämpel, payload (vad ändrades; för level.shift: roleId, från nivå, till nivå).
- `suggestion` — orgId, mål (roll-fält / kriterium), föreslaget värde, motivering, källa (`ai`), status (föreslagen/bekräftad/avvisad), modell, tidsstämpel. (Förslagslagret — skilt från bekräftade värden; ADR-0003.)

**packages/core** (rent):
- Viktpoängkonstanter (1–5, neutral 3), `pointBudget(antalKriterier)` och allokeringvalidering (ADR-0004).
- `scoreRole(ratings, criteriaWithWeights) → heltal 0–100` (normaliserad: 20 × Σ(betyg × viktpoäng) / Σ(viktpoäng), avrundad nedåt)
- `assignLevel(score, thresholds) → nivå`
- `computeResults(model, ratingsByRole) → resultat[]`

## 4. Epics

- **E1 — Konton & organisation:** Better Auth-org (= organisation), HR-only, roller Admin/Editor, org-scoping i alla funktioner, samt grundläggande företagssetup (namn, land, valuta, språk, antal anställda, bransch).
- **E2 — Modellkonfiguration:** kriterier + ankare + hjälptexter, viktpoäng med poängbudget (1–5, summa = antal kriterier × 3; ADR-0004), track-schema, **standardmall** (förifylld), egna kriterier, samt **kriterieurvalsprotokoll** & **bias-granskning** per kriterium (lätt compliance-ställning, nivå 2).
- **E3 — Roller & värdering:** rollregister/jobbprofil, **blindat** betygsflöde mot ankare, frivillig motivering.
- **E4 — Poäng & nivå-motor:** `packages/core`, live-omräkning, nivåutfall (alltid uträknat — ingen manuell override).
- **E5 — Resultat & analys:** resultatvy (poäng + nivå), nivåöversikt, **progressionsvy** (roller skapade / bedömda / nivåsatta — briefens §8), grundläggande analys (**överlapp, avvikare, nivåfördelning** — briefens 4.4), jämförelse av roller, export CSV/Excel, samt exporterbar **metodbilaga** (kriterier, betydelser, kriterieurvalsprotokoll, bias-granskning; formulering: "biasreducerande", aldrig "biasfri").
- **E6 — Revisionslogg & spårbarhet:** modelländringar + nivåskiften (tvärgående, vävs in i E2/E4).
- **E7 — Senare:** bulkimport CSV/XLSX, kalibrering/ankarroller, fler roller, Word/PDF-rapporter, djupare bias/governance (se §7).
- **E8 — AI-assistans (tvärgående, ADR-0003):** AI-redo arkitektur (förslagslager + proveniens, AI-anrop via Convex actions, EU-hostad modell). **V1:** generera jobbprofil från titel/beskrivning (+ ev. ankartext-utkast). **Senare:** AI-betygsförslag, kalibrerings-/biaskoll, copilot. Inbäddat i flödet — aldrig chatbot; aldrig i den deterministiska poäng-/nivåvägen.

## 5. Byggordning (faser, från briefen anpassad till stacken)

1. **Fas 1 — Fundament:** monorepo-paket (`backend`, `core`, `dashboard`), Convex EU-deploy, Better Auth, organisation + Admin/Editor. (E1)
2. **Fas 2 — Modellmotor & mall:** kriterier/ankare/betydelser, nivåtrösklar, standardmall, `packages/core` grundläggande. (E2 + E4-kärna)
3. **Fas 3 — Roller & värdering:** rollregister, blindat betygsflöde. (E3)
4. **Fas 4 — Poäng & nivå:** full motor, nivåutfall, revisionslogg. (E4 + E6)
5. **Fas 5 — Resultat & export:** översikts-/jämförelsevyer, CSV/Excel-export. (E5)
6. **Fas 6 — Förbättringar:** bulkimport, kalibrering, rapporter, fler roller. (E7)

## 6. Första vertikala skivan (alpha)

Tunnast möjliga end-to-end som bevisar kärnloopen *modell → roller → poäng → nivå*:

- En organisation (Better Auth), **standardmallen seedad** (9 kriterier + ankare + förvalda betydelser + standard-nivåtrösklar) — skrivskyddad räcker för skivan.
- Registrera några roller manuellt (titel + track/senioritet + minimalt antal fält).
- Mata in 0–5-betyg per kriterium mot ankartexterna (blindat).
- `packages/core` räknar poäng → nivå live.
- Resultatvy: lista roller med poäng + nivå, samt en enkel nivåöversikt.

**Utanför skivan:** full modell-redigering, egna kriterier, revisionslogg, kalibrering, import, override. (De kommer i sina faser.)

Detta motsvarar briefens "definition av en lyckad första version" i minsta körbara form.

**Status (juni 2026):** alfa-loopen levererad i evaluation-loop-skivan: motor i `packages/core` (scoreRole, assignLevel, computeResults, checkGuardrails), rollregister med AI-jobbprofilutkast, blind betygsättning (stegvis, ett kriterium i taget, ankartexterna som val), resultatvy med nivåöversikt och riktig dashboardnavigering (Översikt/Roller/Modell/Resultat). Skivan levererade mer än minsta form: betydelse- och kriterieredigering, arkivering och level.shift-revisionslogg kom med. (Rollstatus-arbetsflödet (utkast → granskning → godkänd) togs bort före lansering som onödigt: HR-only, och bedömningens färdigställande är signalen för att en roll är klar.) Ankarroller levererades i ankarrollsskivan (juni 2026): admin utser en fullbedömd roll till ankarroll på rollsidan (överenskommen nivå + motivering, status aktiv/under översyn/ersatt, revisionslogg), resultatvyn jämför överenskommen mot beräknad nivå per ankare, och betygsavslöjandet flaggar resultat som ligger två nivåer eller mer från närmaste ankare. Kriteriets ankartexter heter "bedömningsskala" i UI (de sex stegen 0 till 5; sedan 2026-06-24, dessförinnan "bedömningsnivå" från 2026-06-13 och ursprungligen "bedömningsankare"); `steg` här är kriteriets 0–5-skala (hette `nivå` före ADR-0014), skild från V2:s senioritet (ADR-0005). Kanonisk kodterm är fortsatt `ankare` (`criteria.anchors`). Övrig kalibrering och import återstår. Onboardingen gjordes konversationell (en fråga per skärm, animerad punktnavigering) med ett avslutande steg där rollfamiljer och roller sätts upp, förifyllda från branschvisa startuppsättningar (juni 2026).

## 7. Icke-funktionellt

- **GDPR & EU-hosting (kärnkrav):** *hela* systemet ska hostas inom EU. Convex eu-west-1 (Irland) håller persondata fysiskt i EU och är förenligt med GDPR + ISO 27001. **Beslut:** fysiskt-i-EU räcker för V1; strikt EU-suveränitet (EU-ägd infra, ingen US-moderexponering → självhostad Convex) skjuts upp tills en kund avtalsmässigt kräver det. (Se ADR-0001.)
- **ISO 27001 (framtida certifiering — medvetet tillägg utöver briefen, motiverat av konkurrens/positionering):** ska kunna certifieras. Bygg in tidigt det som ändå hjälper: revisionslogg (finns), RBAC/least-privilege (Better Auth), kryptering (Convex), dataminimering, retention/backup-policy, subprocessor-/DPA-förteckning (Convex, Better Auth, hosting, e-post m.m.). Konkurrenten Sysarb är redan ISO 27001 + GDPR → tabellinsats i branschen.
- **Formuleringsregel (HR-kritiken):** produkten, UI-texter och metodbilagan beskriver modellen som "biasreducerande / könsneutralt designad" — **aldrig** "biasfri".
- **Tenant-isolering:** hård org-scoping i varje Convex-funktion.
- **Determinism:** all poäng/nivå-logik ren och reproducerbar i `packages/core`.
- **Roll ≠ person:** värderingssteget utesluter person-/prestations-/lönedata.
- **Spårbarhet:** revisionslogg för resultatpåverkande ändringar.
- **i18n:** fem språk från start — **engelska (standard), svenska, norska (nb), danska, finska** — via `packages/i18n` (next-intl, typade nycklar, delat av web + dashboard; `en.json` är basfil och typkälla). Sv/en seedas från ordlistornas i18n-tabeller; nb/da/fi är maskinöversatta utkast som ska granskas av modersmålstalare före lansering. Marknadssajten har locale **synlig** i URL:en (engelska utan prefix, övriga som `/sv/...`) med språkväxlings-dropdown i menyn; dashboarden har **ingen** locale i URL:en, språket är en inställning under account settings.
- **AI inom EU:** AI-anrop använder en EU-hostad modell med no-training-DPA (se ADR-0003); AI är aldrig i den deterministiska poäng-/nivåvägen och auto-beslutar aldrig betyg/nivå.

## 8. Utanför V1 (från briefen)

Avancerad marknads-benchmarking; komplex kompmodellering (bonus/equity/TCC); stora HRIS/payroll-integrationer; BI-tunga dashboards; full flerspråkighet för hela EU (men förberett).

## 9. Öppna frågor (med förslag — att bekräfta)

1. ~~**Nivåschema**~~ → **Avgjort (default):** 7 nivåer, trösklar konfigurerbara, Nivå 1 högst.

    **Uppdaterat 2026-08-28 (ADR-0022):** tolv nivåer i fyra zoner, inte sju. Zontillhörighet är strukturlag (A = nivå 1 till 3, B = 4 till 6, C = 7 till 9, D = 10 till 12); trösklarna är fortsatt konfigurerbara per organisation och Nivå 1 är fortsatt högst. Standardtrösklarna står i docs/contexts/evaluation-model/standardmall.md.
2. ~~**HR-roller**~~ → **Avgjort (default):** Admin + Editor.
3. ~~**Värderingsstatus & motivering**~~ → **Avgjort:** **motivering frivillig** (aldrig obligatorisk). **Rollstatus-arbetsflödet (utkast → under granskning → godkänd) togs bort före lansering** som onödigt: HR-only, och bedömningens färdigställande (completeness) är signalen för att en roll är klar. *(Medveten avvikelse från HR-kritikens fyra obligatoriska triggers — betyg 0/4/5, utanför track-intervall, nära nivågräns — motiverad av HR-only + blindning. Ev. icke-blockerande uppmaning att motivera är en UX-idé för E3.)* **Ingen manuell nivåöverride** — nivån är alltid det uträknade utfallet (avviker från briefen; vill man ändra justerar man betyg eller modell).
4. ~~**Roll-fält / jobbprofil**~~ → **Avgjort: nivå (2).** Obligatorisk kärna (titel, funktion/avdelning, team, track, syfte, ansvarsområden) + strukturerade valfria fält (beslutsmandat, intressenter, kunskapskrav, finansiellt ansvar, personalansvar, risk/konsekvens, leverabler). *(Mappning mot briefen 4.3: "beskrivning" → syfte; "ansvarstext" → ansvarsområden.)* **Uppdaterat 2026-06:** fältet heter **titel** (kod `title`), inte namn. **Uppdaterat 2026-06-07 (ADR-0005):** senioritetsfältet utgår ur jobbprofilen; senioriteten sätts på individen i V2.
5. ~~**Kalibrering/ankarroller**~~ → **Avgjort:** senare (fast-follow), enligt #8-beslutet (compliance-nivå 2); se E7.
6. ~~**Track-schema**~~ → **Avgjort:** fast (IC/Lead/M) i V1, konfigurerbart senare. Senioriteter: **IC1–5, Lead 1–3, M1–3** (definitioner + guardrail-referensdata i standardmall.md). **Uppdaterat 2026-06-07 (ADR-0005):** senioriteterna sätts på individen (V2-rollplaceringen), inte på rollen; guardrails pensionerade ur V1:s betygsflöde.
7. ~~**CSV/XLSX-import**~~ → **Avgjort (default):** manuell inmatning i V1; import senare.
8. ~~**Compliance-omfång V1**~~ → **Avgjort: nivå (2).** Kärna (ankare, blindning, revisionslogg, roll≠person, ingen nivåöverride — nivån härleds alltid) **+ lätt compliance-ställning:** kriterieurvalsprotokoll (per kriterium: syfte, varför relevant, överlapp mot andra kriterier, bias-risk, beslutade viktpoäng, beslutsfattare, datum) + bias-granskning (risk låg/medel/hög + kommentar + åtgärd + godkänd) + exporterbar metodbilaga (formulering: "biasreducerande", aldrig "biasfri"). Uppskjutet: obligatorisk kalibrering, formell modellgovernance, dubbel-bedömare, interbedömarreliabilitet.
9. **Designsystem/tema** (öppen): dashboardens utseende (shadcn finns) — ej grillat än.
10. ~~**EU-hosting: residens vs suveränitet**~~ → **Avgjort:** fysiskt-i-EU (Convex eu-west-1) räcker för V1; strikt suveränitet uppskjuten. (ADR-0001.)
11. ~~**AI-modell (EU)**~~ → **Parkerad:** AI-SDK abstraherar leverantören → byte är billigt, beslutas vid bygget av E8. Enda kravet nu: **EU-hostad** modell (ADR-0003). Kandidater: Mistral EU / Azure OpenAI EU / Bedrock EU. Mindre portabelt vid byte: structured-output/caching/vision + prompttrimning per modell.
12. **AI-betygsförslag** (öppen): planeras *senare* (efter att deterministisk kärna + blindning beprövats), inte V1.
13. **Likvärdigt arbete-gruppering (V2-söm, öppen):** "likvärdigt arbete" blir ett **eget grupperingsbegrepp** i framtida people/pay-kontexter, härlett från poäng (ev. toleransintervall/klustring) — **inte** en rak återanvändning av kompensationsnivåerna. Nivågränser får inte ensamma avgöra rättslig gruppering. (Se §11.)

    **v3-uppdatering (ADR-0012):** primärvyns Steg 2 grupperar likvärdigt arbete per nivå. Det försonas med ovanstående: primärvyn grupperar per nivå som v3 kräver, medan denna punkts poäng-härledda toleransklustring är ett striktare försvarslager ovanpå (nivån är en grovindelning av poäng, kompatibelt, inte en ersättning). Se ADR-0012 punkt 6.
14. ~~**Rollfamilj**~~ → **Avgjort (2026-06):** rollfamilj är ett **eget begrepp**, skilt från track (förklaringsdokumentet track-level-band.md: Software Developer är en rollfamilj, IC är dess track; familjer kan också dras bredare, t.ex. Software Engineering). Hierarki: rollfamilj → roll/nivåroll → (V2) medarbetare. **Modelleras inte som egen entitet i V1:** varje `role` är en nivåroll med titel + track + nivå (dåtidens ord: nivå = dagens senioritet, se ADR-0014); familjegruppering fångas tills vidare via titlarna. Egen rollfamilj-entitet (och progressionsvy per familj) är en senare fråga. Se evaluation-model-ordlistan.

    **Uppdaterat 2026-06-06:** rollfamilj modelleras nu som egen entitet: frivillig tillhörighet per roll, högst en familj, namn unika per organisation. Gruppering i rollistan, familjeväljare vid skapa/redigera, filter i resultatvyn och progressionsvy per familj levererades i role-families-skivan (docs/superpowers/specs/2026-06-06-role-families-design.md). Familjer påverkar aldrig poäng eller nivå. Fritextfältet funktion/avdelning kvarstår som organisatorisk hemvist.

    **Uppdaterat 2026-06-07 (ADR-0005):** roller är inte längre nivåroller. En `role` bär titel + track (ingen senioritet på rollen); senioriteten är individens, satt per `personAssignments` (V2), och nivån beräknas av motorn. Hierarkin ovan ska läsas rollfamilj → roll → (V2) medarbetare-med-senioritet.

15. ~~**Viktning**~~ → **Avgjort (2026-06-06, ADR-0004):** viktning med **poängbudget** ersätter den 7-gradiga betydelseskalan med dolda Excel-vikter. Kriterier viktas med synliga **viktpoäng 1–5** (neutral 3) där summan alltid är exakt **antal kriterier × 3**; andelen per kriterium är härledd visning. Rollens totalpoäng normaliseras till **0–100** (20 × Σ(betyg × viktpoäng) / Σ(viktpoäng), avrundad nedåt) så nivåtrösklarna är stabila oavsett antal kriterier; trösklarna är tolv nivåer, 97/86/77/69/62/56/50/45/40/35/30/0, fasta i `packages/core` och inte konfigurerbara (ADR-0022, ADR-0024). AI-viktgranskningen föreslår **balanserade flyttar** (varje flytt är i sig nollsumma, HR kan bekräfta valfri delmängd). Källdokument: docs/contexts/evaluation-model/viktning-poangbudget.md.

16. ~~**Senioritet på roll eller individ**~~ → **Avgjort (2026-06-07, ADR-0005):** en roll bär bara **track**; **senioriteten hör till individen** inom rollens track och sätts vid V2:s rollplacering ("System Developer" är IC; Bo kan vara IC1 och Axel IC4 i samma roll). Värderingsobjektet blir därmed rollen som helhet, vilket matchar lönekartläggningens "lika arbete"-grupper; skiljer sig seniorens arbete åt blir det en egen roll. Track-guardrails (per senioritet) pensioneras ur V1:s betygsflöde; senioritetsdefinitionerna består som referensdata. Reviderar källdokumentet track-level-band.md (se dess repo-anmärkning).

17. ~~**Juridisk enhet & land som rapporteringsdimension**~~ → **Avgjort (2026-06-17, ADR-0007):** varje företag / juridisk enhet är en egen organisation; en användare kan tillhöra flera organisationer och byta aktiv organisation via en organisationsväljare (som Polyforms teamväxlare). Org = juridisk enhet ger per-enhet land/headcount/trösklar gratis, och jämförelse/lönekartläggning är ändå scopad per arbetsgivare. Ingen delad modell eller koncern-rollup över en kunds organisationer (ej direktivkrav, additivt senare). Bygge i accounts/E1, ej beroende av V2.

## 10. Positionering & referenser

- **Sysarb** (https://sysarb.com/) — mogen konkurrent: heltäckande EU-lönetransparens + pay equity (arbetsvärdering, jobbarkitektur, lönespann, gap-analys, lönerevision, comp management), 70+ HRIS-integrationer, ISO 27001 + GDPR, mid-market→enterprise, SE/EN.
- **blueprnt:s vinkel:** börja i *grundlagret* (rollvärdering → nivåsättning) för **SMB** — enkel onboarding, Sverige-först, utan enterprise-komplexitet. Sysarb täcker hela stacken ovanför; blueprnt kan växa uppåt (pay equity, gap-analys) senare. ISO 27001 + EU-hosting är dock tabellinsats även för oss.

## 11. V2-riktning — medarbetare & lika/likvärdigt arbete

**Riktning (grundaren, 2026-06):** efter V1 ska systemet kunna **lägga till medarbetare** för att göra **analys av lika och likvärdigt arbete** (svensk lönekartläggning + EU-direktivet 2023/970) ovanpå V1:s rollvärderingsgrund. V2 planeras inte i detalj här — men V1:s sömmar mot V2 är beslutade nedan.

**Rättslig grund (verifierad 2026-06):**
- **Svensk diskrimineringslag (primär drivkraft för SMB):** *årlig* lönekartläggning för alla arbetsgivare; skriftlig dokumentationsplikt vid **10+ anställda**. Gäller *redan idag* — detta, inte direktivets trösklar, är SMB-kundens akuta behov.
- **EU-direktivet 2023/970:** transponeringsdeadline **7 juni 2026**. Gap-rapportering: 250+ anställda årligen fr.o.m. 2027; 150–249 vart tredje år fr.o.m. 2027; 100–149 vart tredje år fr.o.m. **2031**; under 100 ej obligatoriskt. "Arbete av lika värde" bedöms på **kunskap/färdighet, ansträngning, ansvar, arbetsförhållanden**. V1:s standardkriterier täcker de tre första väl; arbetsförhållanden (fysisk arbetsmiljö, skiftarbete, exponering) ingår inte i standarduppsättningens nio kriterier utan läggs vid behov till som eget kriterium och dokumenteras i metodbilagan. Art. 9 kräver uppdelning grundlön vs rörliga delar; kvartilfördelning per kön. **Joint pay assessment** krävs först när *tre* villkor möts: rapporteringsskyldig arbetsgivare + ≥5 % oförklarat gap i en kategori + ej åtgärdat inom 6 månader. Art. 7 ger individen rätt till info om egen lön + genomsnittsnivåer per kön för sin lika/likvärdigt-arbete-kategori — kräver samma grupperingslogik.
- **Utanför blueprnts scope (medvetet):** direktivets rekryteringsregler (lönespann i annonser, förbud mot lönehistorikfrågor) — gäller alla arbetsgivare men är inte vår produkt. *Förtydligat 2026-06-17:* utanför bygget, men substratet (track/nivå) är kompatibelt med en framtida lönespann-visning per nivå och track; formuleringen "inte vår produkt" ska inte läsas som att dörren är stängd för en V2-yta.

**V2 omfattar (minimal):** medarbetar-entitet (dataminimerad: pseudonym-id, kön, ev. anställningsgrad — ej namn/personnummer om möjligt), koppling medarbetare↔roll (med giltighetsperiod), lönedata (grundlön + rörliga delar separat, tidsstämplad), grupper för **lika arbete** (samma roll) och **likvärdigt arbete** (eget begrepp härlett från poäng — se §9.13), könsdominansflagga per grupp (≥60 %), ojusterad gap-analys (median/medel per grupp × kön + kvartiler), **frysta ögonblicksbilder**, förklarings-/åtgärdslager, exporterbar lönekartläggningsrapport.

**V1:s sömmar mot V2 (beslutade nu, byggs inte nu):**
1. **Stabila roll-id:n:** omvärdering ändrar betyg/poäng/nivå men aldrig rollens identitet; roll-id återanvänds aldrig. (Policy, gratis.)
2. **Roll ≠ person förblir stenhård:** role-/rating-tabellerna får *aldrig* bära person-, löne- eller prestationsfält — sådan data hör till framtida **people**/**pay**-kontexter (namnen reserverade i CONTEXT-MAP) med egna behörighets-, minimerings- och retention-regler.
3. **Ögonblicksbilder via materialiserade kopior:** en lönekartläggning fryser en *kopia* av (roller, poäng, nivå, grupper — i V2 även löner) vid ett datum. Det kräver **inte** modellversionering — ADR-0002 (live-omräkning) står fast; V1:s revisionslogg + stabila roll-id:n räcker som grund. **Förtydligat 2026-06-17 (ADR-0008):** kopian måste omfatta inte bara utfallen (poäng, nivå, grupper) utan även indata och logik som gällde vid frysningen, dvs. betygen och modellkonfigurationen (kriterier, viktpoäng, ankare, nivåtrösklar). Att frysa enbart utfallen bevarar siffran men inte hur den räknades fram; revisionsloggen är spårbarhetsspine, inte rekonstruktionskälla.
4. **Likvärdigt arbete ≠ nivå rakt av** (se §9.13) — nivågränskänsligheten gör rak nivå-återanvändning rättsligt svårförsvarad. **v3-uppdatering (ADR-0012):** primärvyns Steg 2 grupperar likvärdigt arbete per nivå (grovindelning), med §9.13:s poäng-härledda toleransklustring som ett striktare försvarslager ovanpå, inte som ersättning. Se ADR-0012 punkt 6.
5. **AI-gränsen utvidgas:** AI rör aldrig framtida löneskillnads-/grupperingsvägen heller (utvidgning av ADR-0003); gap-beräkning och gruppering måste vara deterministisk och förklarbar.
6. **Juridisk enhet = organisation, med organisationsväljare (avgjort 2026-06-17, ADR-0007):** varje företag / juridisk enhet är en egen organisation; en användare tillhör flera organisationer och byter aktiv organisation via en växlare (som Polyform). Rapportering och lönekartläggning görs per organisation = per juridisk enhet, så `country` och `employeeCount` per organisation är rapporteringsaxeln. Följd: `employeeCount` måste bli auktoritativt per organisation (härlett i V2) innan det grindar trösklarna; dagens valfria AI-kontextfält duger inte. Ingen delad jobbarkitektur eller koncern-rollup över en kunds organisationer (ej direktivkrav, additivt senare).
7. **Rapportlagret är parameterstyrt och fleraktörs-reviderat:** trösklar, frekvens, mallar, mottagare, exportformat och sign-off är konfiguration (per land och juridisk enhet), aldrig hårdkodat, eftersom svensk transponering inte är fastställd. Revisionen får en aktörsdistinktion (skapad/granskad/ändrad/godkänd, ev. arbetstagarrepresentant) utöver dagens enaktörsmodell (`logAudit`, otypad payload), och rapportkörning, utlämnande och gemensam lönebedömning blir egna förstklassiga entiteter med revisionsloggen som spine.

**Risker att bevaka:** scope-glidning mot Sysarbs fulla stack (håll V2 = minimal DL-lönekartläggning); köns-datamodell (DL:s binära 60 %-jämförelse vs inkluderande modell — V2-design, ej V1); GDPR-eskalering när lön+kön per individ kommer in (ej "särskilda kategorier" enl. art. 9, men integritetskänsligt → dataminimering + striktare RBAC). **Tillägg 2026-06-17 (från direktivunderlaget):** sekretess för små grupper (minsta cellstorlek/maskning när en kategori blir för liten för säker aggregerad visning) och en persondata-behörighetsnivå (vem som ser persondata kontra aggregat) designas in i people/pay-kontexten, inte bolt-on efter att gap-rapporter skeppats.
