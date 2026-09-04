# Arkivpaketet: kravbild och innehåll

Research inför arkivpaketslicen (ADR-0011 beslutspunkt 4), genomförd 2026-09-01. Underlaget togs fram i sju spår (två interna: ADR-krav och byggsubstrat; fem externa: retentionsrätten, DO:s tillsynspraktik, arkivformatpraxis, marknaden, GDPR-ramen), där varje bärande externt påstående därefter verifierades adversariellt mot primärkällorna av oberoende granskare: lagtexterna från riksdagens konsoliderade SFS (2008:567 t.o.m. SFS 2025:736; 1981:130), fyra DO-tillsynsbeslut lästa i fulltext-PDF direkt från do.se, IMY:s levande sidor, Riksarkivets sidor och leverantörernas egna hjälpcenter. Utfall: 14/14 verifierade påståenden bekräftade. Detta dokument styr arkivpaketets innehåll och kompletterar `lonekartlaggning-rapport-kravbild.md` (avsnitt 9 för de två dokumenten).

## 1. Varför paketet finns: tillsynen konsumerar daterade årsdokument

- **Ingen gallringsregel finns.** Hela DL 3 kap. (1-20 §§ lästa) saknar varje bevarande- eller gallringsregel för 13-14 §§-dokumentationen; kravet är endast "skriftligen", utan format- eller mediekrav. Treårsfristen i 13 § 5 p gäller lönejusteringarnas genomförande, inte dokumentets bevarande.
- **Preskriptionen motiverar bevarandet.** Diskrimineringstvister i arbetslivet följer LAS/MBL-fristerna via DL 6 kap. 4 § (korta frister, men DO kan avbryta preskription en gång enligt 6 kap. 5 §), och den allmänna fordringspreskriptionen är tio år (preskriptionslagen 2 §). ADR-0011:s "minst 5 år" är ett golv; tioårssiffran är en preskriptionsanalogi, inte lag (huvudkravbilden avsnitt 2 står fast).
- **DO:s tillsyn är dokumentankrad per år**, verifierat i fyra tillsynsbeslut i fulltext: DO begär "senaste lönekartläggning" (standardformulering i samtliga), arbetsgivare ger in daterade årsdokument (Kriminalvården: kartläggningarna 2019, 2020 och pågående 2022 i ett och samma ärende; Trafikverket: lönerapporten för 2021), DO bedömer efterlevnad per namngivet år och annonserar uppföljning för nästa års dokument (DO 2022/498 → 2023/353). Uppgiftsskyldigheten vilar på DL 4 kap. 3 § med vite via 4 kap. 5 §. Slutsats: det arkivpaketet ska kunna svara på är exakt "ge in er dokumentation för år X", flera år i efterhand.
- **GDPR-ramen tillåter och kravställer.** IMY: ändamålet bestämmer lagringstiden; uppgifter ska ibland bevaras på grund av lag, och då ska åtkomsten ses över och begränsas; radering kan nekas för rättslig förpliktelse och rättsliga anspråk; skyddet får inte bli lägre för att uppgifterna ligger i en kopia. Paketet är arbetsgivarens eget bevarandeexemplar under den lagstadgade kartläggningens ändamål; ansvaret för den nedladdade filens skydd, åtkomst och gallring är arbetsgivarens, och det ska paketet säga självt (avsnitt 3).
- **Format:** PDF/A och Riksarkivets föreskrifter är offentlig sektors regim (Riksarkivets egen inramning) och binder inte privata arbetsgivare; DL kräver bara "skriftligen". Vår PDF uppfyller formkravet. Från arkivpraxisen lånas en lätt integritetskonvention: E-ARK CSIP (Riksarkivets antagna paketstandard FGS Paketstruktur 2.0) kräver checksumma per fil i paketmanifestet; vårt paket bär därför SHA-256 per fil i sin metadata, som verifierbarhet, inte som lagkrav.

## 2. Marknaden: paketet finns inte

Verifierat negativt fynd: ingen granskad leverantör levererar ett samlat arkivpaket. Sysarbs "slutrapport" är uttryckligen manuell montering: kunden laddar ner två separata dokument (Excel-export + Word-mall med gulmarkerad platshållartext att ersätta för hand) och deras övriga exporter är åtta separata filer, ingen PDF. Aons verktyg ger en enda Excel. Pihr beskriver en genererad rapport utan paket-, arkiv- eller retentionsfunktion. Heartpace marknadsför "komplett historik" utan definierat paket eller retentionstid. Ett knapptrycks-arkivpaket med rapport + data + integritetsmanifest är alltså en verklig differentiator ovanpå de redan skeppade exporterna.

## 3. Paketets innehåll (beslutad kravbild)

En ZIP per kartläggning, `<etikett>-arkiv.zip`, med (snedstreck i etiketten viks till bindestreck i alla filnamn, så paketet alltid behåller sin platta layout; en räkenskapsårsetikett som "2026/2027" är vanlig inmatning och jszip tolkar annars "/" som mappgräns):

1. **`<etikett>-signeringsrapport.pdf`**: samverkansdokumentet (ADR-0030, rapportkravbilden avsnitt 9), exakt samma artefakt som den fristående nedladdningen (maskerad enligt ADR-0012, UTKAST-märkt om körningen inte är slutförd).
2. **`<etikett>-detaljbilaga.pdf`**: den fullständiga skriftliga dokumentationen (13-14 §§), omaskerad, samma artefakt som den fristående nedladdningen.
3. **`<etikett>-nyckeltal.xlsx`**: nyckeltalsarbetsboken, samma artefakt som den fristående nedladdningen.
4. **`manifest.json`**: paketets metadata, ADR-0011:s egen ordalydelse ("JSON-metadata") tagen bokstavligt: ändamålsnotis, schemaversion (`schemaVersion` 2 sedan ADR-0030 lade till detaljbilagan), exporttidpunkt, körningens metadata (etikett, status, referensdatum, population) och **manifestet med SHA-256 och storlek per binärfil** (p.1-3).
   - **Ägarbeslut 2026-09-01: registret lämnar inte systemet.** Inget krav (lag, DO, direktiv) motiverar en persondataexport, så paketet innehåller ingen: inga snapshotrader, ingen fritext, inga namn. Det frysta registret i appen förblir det fullständiga exemplaret, med sin raderingshook, och PDF+XLSX bär allt tillsynen och samverkan konsumerar. Det gör också paketets mest sannolika felhantering (att zippen delas vidare, t.ex. i samverkan) ofarlig, och håller IMY:s uppgiftsminimering utan vidare resonemang.
5. **Inte i paketet:** kartläggningens råregister och arbetslagrets fritext (ägarbeslutet ovan). Kan omprövas.

## 4. Leverans

- **Var:** fjärde dokumentpanelen på Rapporter-sidan (ZIP-filtypsikon) och fjärde raden i körningslistans "Ladda ner"-undernivå. Panelens hjälptext bär retentionsrådet (bevara minst fem år; DO begär årsdokument i efterhand).
- **Hur:** allt byggs i klienten av samma byggstenar som de fristående exporterna, via en gemensam renderingsväg så paketets båda PDF:er och dess arbetsbok aldrig kan avvika från de fristående nedladdningarna. ZIP via jszip (finns redan i trädet via exceljs; deklareras explicit). Checksummor via WebCrypto.
- **Loggning:** en rad vid exportgränsen, eget händelseslag (`payMapping.archiveExported`), INNAN filen lämnas ut, med full audit-koppling; en rad för paketet, inte en per fil (paketet är en handling).
- **Utkast:** exporterbart som övriga dokument (plikten sitter på exportgränsen; UTKAST-märkningen bär genom). Avsedd praxis är att arkivera den slutförda körningen, vilket hjälptexten styr mot utan att gaten hårdkodas.

## 5. Öppna ägarbeslut

1. ~~**Facklig rapport i paketet**~~ **AVGJORT genom ADR-0030 (2026-09-03):** den fackliga rapporten finns inte längre. Signeringsrapporten som ersatte den ligger i paketet tillsammans med detaljbilagan (avsnitt 3 p 1-2). Registret i paketet är sedan tidigare AVGJORT (nej, ägarbeslut 2026-09-01).
2. **Utkastexport av arkivet** (default: tillåten, som övriga; kan gatas på slutförd status om avsedd praxis ska tvingas).
3. **Framtida:** ADR-0011:s "separat backup-rutin" (bevarande på serversidan bortom nedladdningen) är en egen senare slice och berörs inte av detta paket.

## 6. Källor (samtliga verifierade 2026-09-01)

- Diskrimineringslag (2008:567): 3 kap. 1-20 §§ (ingen gallringsregel), 4 kap. 3 och 5 §§, 6 kap. 4-6 §§; konsoliderad t.o.m. SFS 2025:736, riksdagen.se. Preskriptionslag (1981:130) 2 §.
- DO-tillsynsbeslut i fulltext: DO 2022/499 (Trafikverket, 2023-04-21), DO 2022/498 (Kriminalvården, 2022-10-13), DO 2023/353 (uppföljningen, 2023-04-28), DO 2023/5350 (Trafikverket-uppföljning, 2024-02-08), do.se.
- IMY: arbetsliv/grundläggande principer (uppdaterad 2026-06-15), radering, säkerhetskopiering.
- Riksarkivet: PDF/A-sidan (2024-08-20), RA-FS-ramverket (offentlig sektor); E-ARK CSIP 2.2.0 (checksummekravet CSIP71-72), FGS Paketstruktur 2.0.
- Marknaden: Sysarb help center (rapport-artikeln), Aon lonestatistik, Pihr, Heartpace (publika ytor; negativa fynd dokumenterade med metod i researchunderlaget).
- Internt: ADR-0011 (beslutspunkt 3-4 med 2026-07-13-uppdateringen), huvudkravbilden avsnitt 2 och 7, byggsubstratsgenomgången (exporthookens flerpassrendering, arbetsboksbyggaren, jszip 3.10.1, ikonutbudet).
