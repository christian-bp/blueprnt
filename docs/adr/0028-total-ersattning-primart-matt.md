# Total ersättning som primärt mått för lika arbete

**Status:** accepterad 2026-09-02 (ägarbeslut). Ersätter ADR-0015 §5 (grundlön primärt); ADR-0015 består i övrigt.

Granskningsnoteringarna 2026-09-01 läste lika arbete-gruppens punktdiagram som "sorterat på grundlön och inte totallön": en man med 73 i totallön låg under en kvinna med 71, eftersom plotten (liksom badgarna, medellinjerna och medlemstabellens diff) ritade gruppens primära mått, som sedan ADR-0015 var FTE-justerad grundlön. Läsningen var inte ett fel i vyn utan i måttvalet: den som gör en lönekartläggning läser "lön" som det som faktiskt betalas ut, och DO:s vägledning räknar in samtliga ersättningar och förmåner i den lön som ska jämföras. Ägaren beslutade att byta primärt mått.

## Beslut

1. **Total ersättning (TCC) är gruppernas primära mått.** FTE-justerad total ersättning (grundlön plus registrerade lönekomponenter) är det mått som lika arbete-gruppens badgar, punktdiagram, medellinjer, medlemstabellens diff mot männens medel och standardsortering, rapportens grupptabell (medel och median) samt årsjämförelsen läser. FTE-justerad grundlön beräknas och visas parallellt: som andra badge när den ändrar bilden, som egen kolumn i medlemstabellen och i metrikexporten.
2. **Insläppning på endera måttet består.** ADR-0015:s villkor (minst en kvinna och en man, kvinnorna understiger männen) prövas fortsatt på båda måtten: en grupp släpps in när gapet är positivt på totalen ELLER grundlönen. Ett rent totalmått skulle dölja den spegelvända blindfläcken, ett gap i den fasta lönen som kvinnornas rörliga delar råkar täcka; grundlönen är den fasta, garanterade delen och en skillnad där är ett fynd i sig.
3. **`baseDriven` speglar `tccDriven`.** En grupp som släpps in enbart på grundlönsgapet (totalgapet noll eller omvänt) markeras `baseDriven` och läser grundlönsmåttet i badgar, plot, medellinjer och medlemsdiff; i rapporten bär den `*`-markören och en metarad med grundlönssiffrorna. Flaggan är oförändrat den allvarligaste av de två riktade måttflaggorna (ADR-0015 §5, andra meningen), så ett fynd på endera måttet behåller sin dokumentationsplikt.
4. **Kapitel 4 och org-aggregatet är oförändrade.** Den kvinnodominerade jämförelsen rankade redan på hela gruppens totala ersättning; org-nyckeltalet (ADR-0012) läser total ersättning. Ändringen gör lika arbete konsekvent med resten av kartläggningen i stället för att avvika från den.

## Konsekvenser

- **Wire-formen:** `GapGroupWire.tccDriven` byter namn och semantik till `baseDriven` (`classifyEqualWorkGroup` i `packages/core`, `getPayMappingGap`). Klientens `primaryGapMetric` läser `baseDriven ? base : tcc`.
- **Rapporten:** grupptabellens kolumner och medianer räknas på total ersättning; `tccLine`/`tccDrivenMarker` blir `baseLine`/`baseDrivenMarker`; `equalWorkIntro` och `measuresNote` anger måttet i alla fem språk.
- **Fyndmeningarna `less`, `lessTcc`, `lessTccWorse` utgår** ur alla språkfiler: siffrorna bärs sedan tidigare av badgarna, och bara "ingen mätbar skillnad"-meningen renderas. Användarguidens avsnitt om fyndet skrevs om till samma sanning och korpusen synkades.
- **Ingen datamigrering.** Måttet härleds vid läsning ur de frysta snapshotraderna; inga lagrade fynd eller flaggor byter form. Klarmarkeringar och dokumentation på befintliga grupper består, men en grupp kan byta insläppningsutfall (en `tccDriven`-grupp är nu en vanlig grupp; en grupp som tidigare släpptes in på grundlönen är nu `baseDriven`), vilket är avsikten.
- **ADR-0015 §5 ersätts;** dess övriga punkter (instegsvillkor, singletons, könsrena grupper, riktningsregeln, tvärnivåkontrollen, åtgärdslagret) består oförändrade.

## Alternativ som avvisades

- **Bara plotten på total.** Återinför exakt den motsägelse en tidigare fix tog bort: badgar som anger ett medel på ett mått över medellinjer ritade på ett annat.
- **Enbart totalmått i villkor och flagga (grundlönen ut ur analysen).** Enklare kod, men öppnar blindfläcken för ett gap i den fasta lönen som rörliga delar maskerar, och avviker från praxis att analysera grundlön och rörliga delar var för sig.
- **En växel grundlön/total per grupp.** Håller ADR-0015 orörd men lägger ett kontrollmoment på varje steg och gör "vilket mått gäller" till ett tillstånd i stället för en regel; ägaren valde regeln.
