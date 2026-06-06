# blueprnt — V1-plan (utkast)

Strukturerad plan för första versionen. Bygger på CTO-briefen, HR-kritiken mot EU:s lönetransparensdirektiv, och Excel-prototypen — samt besluten i `CONTEXT-MAP.md`, `docs/contexts/*` och `docs/adr/*`. Domänspråk: se ordlistorna. Status: levande utkast (öppna frågor längst ned).

## 1. Mål & framgångskriterier

blueprnt gör om en HR-avdelnings ad hoc-rollvärdering till en dokumenterad, repeterbar och spårbar modell — *grundlagret* för efterlevnad av EU:s lönetransparensdirektiv (inte hela compliance-modellen). Sverige-först, HR-only, SMB.

**Designprincip (topprioritet, beslut 2026-06-05): enkelhet för användaren.** Det ska aldrig vara krångligt att komma igång eller att använda applikationen: färre steg, färre obligatoriska fält, vettiga förval, och data som kan härledas (t.ex. antal anställda från importerade medarbetare) frågas aldrig efter. Varje nytt flöde prövas mot den här principen.

V1 lyckas när en HR-användare kan:
1. utgå från en **standardmall** och anpassa kriterier, betydelser och bandtrösklar efter sitt företag,
2. registrera roller och **betygsätta** dem (0–5) mot ankartexter, utan att se vikter,
3. få **poäng** uträknad och **band** föreslaget automatiskt,
4. se en tydlig **bandöversikt** och använda den som beslutsunderlag,
5. lita på att ändringar **loggas** (revisionslogg) — allt inom EU-datahemvist.

## 2. Arkitektur (se ADR-0001)

```
apps/web          Marknadssajt (Next.js)
apps/dashboard    Produktappen (Next.js + Convex-klient + Better Auth)   ← byggs
packages/backend  Convex: schema + queries/mutations/actions (EU-region) ← byggs
packages/core     Ren, deterministisk poäng/band-motor + domäntyper      ← byggs
packages/ui       shadcn/ui (finns)
```

- **Backend/data:** managed Convex Cloud, EU-region (eu-west-1). Reaktivt: vyer prenumererar på data live.
- **Auth + tenant:** Better Auth (org-plugin) i Convex-deploymentet. Org = **organisationen**. All data org-scopad i Convex-funktioner.
- **Ren motor:** `packages/core` har inga Convex/Next-beroenden → enhetstestbar, återanvändbar för framtida rapport/AI.
- **Bounded contexts** (multi-context): `accounts`, `evaluation-model`, `assessment` — initialt som modulmappar under `packages/backend/convex/`.

## 3. Datamodell-skiss (konceptuell, per kontext)

> Princip (ADR-0002): **betyg lagras**; **poäng & band härleds** av `packages/core` från betyg + aktuell modell. Allt scopas till `orgId`.

**accounts** (mestadels Better Auth):
- `user`, `session`, `account`, `organization`, `member`, `invitation` (från Better Auth-komponenten). `member` bär roll (Admin/Editor).
- `organizations`-tabellen (app-sidans organisationsinställningar) — orgId, land, valuta, språk, antal anställda, bransch (styr mallval). Identitet (namn/slug/medlemmar) ligger i Better Auth-komponenten; den här raden trigger-seedas vid organisationsskapande och nycklas på komponentens org-id. (Briefens företagssetup, 4.1.) Antal anställda efterfrågas inte i onboardingen; det härleds automatiskt i V2 från importerade medarbetare (beslut 2026-06-05).

**evaluation-model** (en levande modell per organisation):
- `model` — orgId, namn, härkomst (vilken mall den startade från).
- `criterion` — orgId, namn, beskrivning, **hjälptext** (vägledning till bedömaren, skild från beskrivning/ankare — briefens 4.2), **importanceLevel (1–7**; 7 = högst betydelse/vikt 18, 1 = lägst/vikt 8**)**, ordning, isCustom, samt protokoll/bias-fält (syfte, varförRelevant, **överlapp mot andra kriterier**, biasRisk, **biasKommentar**, biasÅtgärd, godkänd, beslutsfattare, datum).
- `criterionAnchor` — criterionId, level (0–5), text. (Ankartexter.)
- `track` / `level` — track-schema (IC/Lead/M; nivåer IC1–5, Lead 1–3, M1–3). Seedas enligt standardmall.md.
- `trackGuardrail` — (track, level, criterion) → min/max (rådgivande). (Ev. senare.)
- `bandThreshold` — orgId, band (1..N), minScore, etikett.
- *Betydelseskalan (7 nivåer → vikt) är **fast** → konstant i `packages/core`, ingen tabell.*

**assessment**:
- `role` — orgId; **jobbprofil**: obligatorisk kärna (titel, funktion/avdelning, team, trackKey, level, syfte, ansvarsområden) + valfria strukturerade fält (beslutsmandat, intressenter, kunskapskrav, finansiellt ansvar, personalansvar, risk/konsekvens, leverabler); status (draft/inReview/approved). Titeln är nivårollens visningstitel (t.ex. "Junior Software Developer"); kodfältet heter `title`.
- `rating` — orgId, roleId, criterionId, value (0–5), ev. motivering (frivillig). **(Sanningskällan.)**
- `anchorRole` — orgId, roleId, förväntat band. (Kalibrering; ev. senare.)

**tvärgående:**
- `auditLog` — orgId, typ (model.change / band.shift …), aktör, tidsstämpel, payload (vad ändrades; för band.shift: roleId, frånBand, tillBand).
- `suggestion` — orgId, mål (roll-fält / kriterium), föreslaget värde, motivering, källa (`ai`), status (föreslagen/bekräftad/avvisad), modell, tidsstämpel. (Förslagslagret — skilt från bekräftade värden; ADR-0003.)

**packages/core** (rent):
- `IMPORTANCE_SCALE` (7 nivåer → vikt: 8,10,11,12,13,14,18).
- `scoreRole(ratings, criteriaWithWeights) → number`
- `assignBand(score, thresholds) → band`
- `computeResults(model, ratingsByRole) → resultat[]`
- `checkGuardrails(role, ratings, scheme) → varningar[]` (rådgivande)

## 4. Epics

- **E1 — Konton & organisation:** Better Auth-org (= organisation), HR-only, roller Admin/Editor, org-scoping i alla funktioner, samt grundläggande företagssetup (namn, land, valuta, språk, antal anställda, bransch).
- **E2 — Modellkonfiguration:** kriterier + ankare + hjälptexter, betydelse-skala (fast 7), bandtrösklar, track-schema, **standardmall** (förifylld), egna kriterier, samt **kriterieurvalsprotokoll** & **bias-granskning** per kriterium (lätt compliance-ställning, nivå 2).
- **E3 — Roller & värdering:** rollregister/jobbprofil, **blindat** betygsflöde mot ankare, status (utkast → granskning → godkänd), frivillig motivering.
- **E4 — Poäng & band-motor:** `packages/core`, live-omräkning, bandutfall (alltid uträknat — ingen manuell override).
- **E5 — Resultat & analys:** resultatvy (poäng + band), bandöversikt, **progressionsvy** (roller skapade / bedömda / bandade — briefens §8), grundläggande analys (**överlapp, avvikare, bandfördelning** — briefens 4.4), jämförelse av roller, export CSV/Excel, samt exporterbar **metodbilaga** (kriterier, betydelser, kriterieurvalsprotokoll, bias-granskning; formulering: "biasreducerande", aldrig "biasfri").
- **E6 — Revisionslogg & spårbarhet:** modelländringar + band-shiftar (tvärgående, vävs in i E2/E4).
- **E7 — Senare:** bulkimport CSV/XLSX, kalibrering/ankarroller, fler roller, Word/PDF-rapporter, djupare bias/governance (se §7).
- **E8 — AI-assistans (tvärgående, ADR-0003):** AI-redo arkitektur (förslagslager + proveniens, AI-anrop via Convex actions, EU-hostad modell). **V1:** generera jobbprofil från titel/beskrivning (+ ev. ankartext-utkast). **Senare:** AI-betygsförslag, kalibrerings-/biaskoll, copilot. Inbäddat i flödet — aldrig chatbot; aldrig i den deterministiska poäng-/bandvägen.

## 5. Byggordning (faser, från briefen anpassad till stacken)

1. **Fas 1 — Fundament:** monorepo-paket (`backend`, `core`, `dashboard`), Convex EU-deploy, Better Auth, organisation + Admin/Editor. (E1)
2. **Fas 2 — Modellmotor & mall:** kriterier/ankare/betydelser, bandtrösklar, standardmall, `packages/core` grundläggande. (E2 + E4-kärna)
3. **Fas 3 — Roller & värdering:** rollregister, blindat betygsflöde, status. (E3)
4. **Fas 4 — Poäng & band:** full motor, bandutfall, revisionslogg. (E4 + E6)
5. **Fas 5 — Resultat & export:** översikts-/jämförelsevyer, CSV/Excel-export. (E5)
6. **Fas 6 — Förbättringar:** bulkimport, kalibrering, rapporter, fler roller. (E7)

## 6. Första vertikala skivan (alpha)

Tunnast möjliga end-to-end som bevisar kärnloopen *modell → roller → poäng → band*:

- En organisation (Better Auth), **standardmallen seedad** (9 kriterier + ankare + förvalda betydelser + standard-bandtrösklar) — skrivskyddad räcker för skivan.
- Registrera några roller manuellt (titel + track/nivå + minimalt antal fält).
- Mata in 0–5-betyg per kriterium mot ankartexterna (blindat).
- `packages/core` räknar poäng → band live.
- Resultatvy: lista roller med poäng + band, samt en enkel bandöversikt.

**Utanför skivan:** full modell-redigering, egna kriterier, revisionslogg, kalibrering, import, override. (De kommer i sina faser.)

Detta motsvarar briefens "definition av en lyckad första version" i minsta körbara form.

**Status (juni 2026):** alfa-loopen levererad i evaluation-loop-skivan: motor i `packages/core` (scoreRole, assignBand, computeResults, checkGuardrails), rollregister med AI-jobbprofilutkast, blind betygsättning (stegvis, ett kriterium i taget, ankartexterna som val), resultatvy med bandöversikt och riktig dashboardnavigering (Översikt/Roller/Modell/Resultat). Skivan levererade mer än minsta form: betydelse- och kriterieredigering, statusmaskin med godkännande/återöppning, arkivering och band.shift-revisionslogg kom med. Ankarroller, kalibrering och import återstår.

## 7. Icke-funktionellt

- **GDPR & EU-hosting (kärnkrav):** *hela* systemet ska hostas inom EU. Convex eu-west-1 (Irland) håller persondata fysiskt i EU och är förenligt med GDPR + ISO 27001. **Beslut:** fysiskt-i-EU räcker för V1; strikt EU-suveränitet (EU-ägd infra, ingen US-moderexponering → självhostad Convex) skjuts upp tills en kund avtalsmässigt kräver det. (Se ADR-0001.)
- **ISO 27001 (framtida certifiering — medvetet tillägg utöver briefen, motiverat av konkurrens/positionering):** ska kunna certifieras. Bygg in tidigt det som ändå hjälper: revisionslogg (finns), RBAC/least-privilege (Better Auth), kryptering (Convex), dataminimering, retention/backup-policy, subprocessor-/DPA-förteckning (Convex, Better Auth, hosting, e-post m.m.). Konkurrenten Sysarb är redan ISO 27001 + GDPR → tabellinsats i branschen.
- **Formuleringsregel (HR-kritiken):** produkten, UI-texter och metodbilagan beskriver modellen som "biasreducerande / könsneutralt designad" — **aldrig** "biasfri".
- **Tenant-isolering:** hård org-scoping i varje Convex-funktion.
- **Determinism:** all poäng/band-logik ren och reproducerbar i `packages/core`.
- **Roll ≠ person:** värderingssteget utesluter person-/prestations-/lönedata.
- **Spårbarhet:** revisionslogg för resultatpåverkande ändringar.
- **i18n:** fem språk från start — **engelska (standard), svenska, norska (nb), danska, finska** — via `packages/i18n` (next-intl, typade nycklar, delat av web + dashboard; `en.json` är basfil och typkälla). Sv/en seedas från ordlistornas i18n-tabeller; nb/da/fi är maskinöversatta utkast som ska granskas av modersmålstalare före lansering. Marknadssajten har locale **synlig** i URL:en (engelska utan prefix, övriga som `/sv/...`) med språkväxlings-dropdown i menyn; dashboarden har **ingen** locale i URL:en, språket är en inställning under account settings.
- **AI inom EU:** AI-anrop använder en EU-hostad modell med no-training-DPA (se ADR-0003); AI är aldrig i den deterministiska poäng-/bandvägen och auto-beslutar aldrig betyg/band.

## 8. Utanför V1 (från briefen)

Avancerad marknads-benchmarking; komplex kompmodellering (bonus/equity/TCC); stora HRIS/payroll-integrationer; BI-tunga dashboards; full flerspråkighet för hela EU (men förberett).

## 9. Öppna frågor (med förslag — att bekräfta)

1. ~~**Bandschema**~~ → **Avgjort (default):** 7 band, trösklar konfigurerbara, Band 1 högst.
2. ~~**HR-roller**~~ → **Avgjort (default):** Admin + Editor.
3. ~~**Värderingsstatus & motivering**~~ → **Avgjort:** status utkast → under granskning → godkänd; **motivering frivillig** (aldrig obligatorisk). *(Medveten avvikelse från HR-kritikens fyra obligatoriska triggers — betyg 0/4/5, utanför track-intervall, nära bandgräns — motiverad av HR-only + blindning. Ev. icke-blockerande uppmaning att motivera är en UX-idé för E3.)* **Ingen manuell bandöverride** — band är alltid det uträknade utfallet (avviker från briefen; vill man ändra justerar man betyg eller modell).
4. ~~**Roll-fält / jobbprofil**~~ → **Avgjort: nivå (2).** Obligatorisk kärna (titel, funktion/avdelning, team, track, nivå, syfte, ansvarsområden) + strukturerade valfria fält (beslutsmandat, intressenter, kunskapskrav, finansiellt ansvar, personalansvar, risk/konsekvens, leverabler). *(Mappning mot briefen 4.3: "beskrivning" → syfte; "ansvarstext" → ansvarsområden.)* **Uppdaterat 2026-06:** fältet heter **titel** (kod `title`), inte namn; titeln är nivårollens visningstitel enligt förklaringsdokumentet (track-level-band.md).
5. ~~**Kalibrering/ankarroller**~~ → **Avgjort:** senare (fast-follow), enligt #8-beslutet (compliance-nivå 2); se E7.
6. ~~**Track-schema**~~ → **Avgjort:** fast (IC/Lead/M) i V1, konfigurerbart senare. Nivåer: **IC1–5, Lead 1–3, M1–3** (definitioner + guardrails i standardmall.md).
7. ~~**CSV/XLSX-import**~~ → **Avgjort (default):** manuell inmatning i V1; import senare.
8. ~~**Compliance-omfång V1**~~ → **Avgjort: nivå (2).** Kärna (ankare, blindning, revisionslogg, roll≠person, ingen bandöverride — band härleds alltid) **+ lätt compliance-ställning:** kriterieurvalsprotokoll (per kriterium: syfte, varför relevant, överlapp mot andra kriterier, bias-risk, beslutad betydelse, beslutsfattare, datum) + bias-granskning (risk låg/medel/hög + kommentar + åtgärd + godkänd) + exporterbar metodbilaga (formulering: "biasreducerande", aldrig "biasfri"). Uppskjutet: obligatorisk kalibrering, formell modellgovernance, dubbel-bedömare, interbedömarreliabilitet.
9. **Designsystem/tema** (öppen): dashboardens utseende (shadcn finns) — ej grillat än.
10. ~~**EU-hosting: residens vs suveränitet**~~ → **Avgjort:** fysiskt-i-EU (Convex eu-west-1) räcker för V1; strikt suveränitet uppskjuten. (ADR-0001.)
11. ~~**AI-modell (EU)**~~ → **Parkerad:** AI-SDK abstraherar leverantören → byte är billigt, beslutas vid bygget av E8. Enda kravet nu: **EU-hostad** modell (ADR-0003). Kandidater: Mistral EU / Azure OpenAI EU / Bedrock EU. Mindre portabelt vid byte: structured-output/caching/vision + prompttrimning per modell.
12. **AI-betygsförslag** (öppen): planeras *senare* (efter att deterministisk kärna + blindning beprövats), inte V1.
13. **Likvärdigt arbete-gruppering (V2-söm, öppen):** "likvärdigt arbete" blir ett **eget grupperingsbegrepp** i framtida people/pay-kontexter, härlett från poäng (ev. toleransband/klustring) — **inte** en rak återanvändning av kompensationsbanden. Bandgränser får inte ensamma avgöra rättslig gruppering. (Se §11.)
14. ~~**Rollfamilj**~~ → **Avgjort (2026-06):** rollfamilj är ett **eget begrepp**, skilt från track (förklaringsdokumentet track-level-band.md: Software Developer är en rollfamilj, IC är dess track; familjer kan också dras bredare, t.ex. Software Engineering). Hierarki: rollfamilj → roll/nivåroll → (V2) medarbetare. **Modelleras inte som egen entitet i V1:** varje `role` är en nivåroll med titel + track + nivå; familjegruppering fångas tills vidare via titlarna. Egen rollfamilj-entitet (och progressionsvy per familj) är en senare fråga. Se evaluation-model-ordlistan.

## 10. Positionering & referenser

- **Sysarb** (https://sysarb.com/) — mogen konkurrent: heltäckande EU-lönetransparens + pay equity (arbetsvärdering, jobbarkitektur, lönespann, gap-analys, lönerevision, comp management), 70+ HRIS-integrationer, ISO 27001 + GDPR, mid-market→enterprise, SE/EN.
- **blueprnt:s vinkel:** börja i *grundlagret* (rollvärdering → banding) för **SMB** — enkel onboarding, Sverige-först, utan enterprise-komplexitet. Sysarb täcker hela stacken ovanför; blueprnt kan växa uppåt (pay equity, gap-analys) senare. ISO 27001 + EU-hosting är dock tabellinsats även för oss.

## 11. V2-riktning — medarbetare & lika/likvärdigt arbete

**Riktning (grundaren, 2026-06):** efter V1 ska systemet kunna **lägga till medarbetare** för att göra **analys av lika och likvärdigt arbete** (svensk lönekartläggning + EU-direktivet 2023/970) ovanpå V1:s rollvärderingsgrund. V2 planeras inte i detalj här — men V1:s sömmar mot V2 är beslutade nedan.

**Rättslig grund (verifierad 2026-06):**
- **Svensk diskrimineringslag (primär drivkraft för SMB):** *årlig* lönekartläggning för alla arbetsgivare; skriftlig dokumentationsplikt vid **10+ anställda**. Gäller *redan idag* — detta, inte direktivets trösklar, är SMB-kundens akuta behov.
- **EU-direktivet 2023/970:** transponeringsdeadline **7 juni 2026**. Gap-rapportering: 250+ anställda årligen fr.o.m. 2027; 150–249 vart tredje år fr.o.m. 2027; 100–149 vart tredje år fr.o.m. **2031**; under 100 ej obligatoriskt. "Arbete av lika värde" bedöms på **kunskap/färdighet, ansträngning, ansvar, arbetsförhållanden** — exakt det V1:s kriterier mäter. Art. 9 kräver uppdelning grundlön vs rörliga delar; kvartilfördelning per kön. **Joint pay assessment** krävs först när *tre* villkor möts: rapporteringsskyldig arbetsgivare + ≥5 % oförklarat gap i en kategori + ej åtgärdat inom 6 månader. Art. 7 ger individen rätt till info om egen lön + genomsnittsnivåer per kön för sin lika/likvärdigt-arbete-kategori — kräver samma grupperingslogik.
- **Utanför blueprnts scope (medvetet):** direktivets rekryteringsregler (lönespann i annonser, förbud mot lönehistorikfrågor) — gäller alla arbetsgivare men är inte vår produkt.

**V2 omfattar (minimal):** medarbetar-entitet (dataminimerad: pseudonym-id, kön, ev. anställningsgrad — ej namn/personnummer om möjligt), koppling medarbetare↔roll (med giltighetsperiod), lönedata (grundlön + rörliga delar separat, tidsstämplad), grupper för **lika arbete** (samma roll) och **likvärdigt arbete** (eget begrepp härlett från poäng — se §9.13), könsdominansflagga per grupp (≥60 %), ojusterad gap-analys (median/medel per grupp × kön + kvartiler), **frysta ögonblicksbilder**, förklarings-/åtgärdslager, exporterbar lönekartläggningsrapport.

**V1:s sömmar mot V2 (beslutade nu, byggs inte nu):**
1. **Stabila roll-id:n:** omvärdering ändrar betyg/poäng/band men aldrig rollens identitet; roll-id återanvänds aldrig. (Policy, gratis.)
2. **Roll ≠ person förblir stenhård:** role-/rating-tabellerna får *aldrig* bära person-, löne- eller prestationsfält — sådan data hör till framtida **people**/**pay**-kontexter (namnen reserverade i CONTEXT-MAP) med egna behörighets-, minimerings- och retention-regler.
3. **Ögonblicksbilder via materialiserade kopior:** en lönekartläggning fryser en *kopia* av (roller, poäng, band, grupper — i V2 även löner) vid ett datum. Det kräver **inte** modellversionering — ADR-0002 (live-omräkning) står fast; V1:s revisionslogg + stabila roll-id:n räcker som grund.
4. **Likvärdigt arbete ≠ band rakt av** (se §9.13) — bandgränskänsligheten gör rak band-återanvändning rättsligt svårförsvarad.
5. **AI-gränsen utvidgas:** AI rör aldrig framtida löneskillnads-/grupperingsvägen heller (utvidgning av ADR-0003); gap-beräkning och gruppering måste vara deterministisk och förklarbar.

**Risker att bevaka:** scope-glidning mot Sysarbs fulla stack (håll V2 = minimal DL-lönekartläggning); köns-datamodell (DL:s binära 60 %-jämförelse vs inkluderande modell — V2-design, ej V1); GDPR-eskalering när lön+kön per individ kommer in (ej "särskilda kategorier" enl. art. 9, men integritetskänsligt → dataminimering + striktare RBAC).
