# ADR-0021: Konstitution, dimensioner och kriteriebibliotek

**Status:** accepterad (2026-08-18)

## Kontext

Masterdokumentet för anpassningsbar rollvärdering (`docs/rollvardering-masterdokument.md`, 2026-08-18) fastställer modellens metodlag: fyra obligatoriska värderingsdimensioner (EU 2023/970), ett kontrollerat kriteriebibliotek med 21 definierade kriterier, urvalsregler med dimensionstak, materialitetsprövning av arbetsförhållanden samt bedömningsskalan. Designen och besluten dokumenteras i `docs/superpowers/specs/2026-08-18-adaptable-role-evaluation-design.md`.

## Beslut

1. **Fyra fasta dimensioner som konstanter, inte tabellrader** (ADR-0006-mönstret): `competence`, `effort`, `responsibility`, `workingConditions`. Dimensionerna är metodlag och aldrig konfigurerbara. Varje kriterium bär exakt en primär dimension, härledd ur sin biblioteksnyckel.
   *Tillägg samma dag (2026-08-18, efter fas 1):* egna kriterier utgår helt och bibliotekstexterna är fasta. En kriterierad lagrar endast valet (biblioteksnyckel, viktpoäng, ordning, viktmotiv, organisationens protokoll- och biasdokumentation); namn, definitioner, ankare och bedömningsfråga renderas alltid lokaliserat ur biblioteksinnehållet. Det ger identiska, kvalitetssäkrade definitioner i varje organisation och tar bort hela ägarskapsöverföringsmaskineriet. Ompröva endast om en kunds sakliga skillnad bevisligen saknar bibliotekskriterium.
2. **Kriteriebiblioteket ersätter standardmallen.** De 21 bibliotekskriterierna (5/5/7/4 per dimension) blir kanonisk källa som lokaliserade innehållsmoduler i backend (samma mönster som standardmallen). `standardTemplate.*` raderas helt (ingen legacy före lansering). Orörda biblioteksrader omlokaliseras vid läsning via `libraryKey`; en textredigering rensar nyckeln och organisationen äger texten. Branschstartvalen blir rekommendationschips i väljaren, aldrig automatiska val.
3. **Urvalsregler:** 6 till 8 aktiva kriterier (hårda gränser i V1), dimensionstak 2/2/3/1 utan särskilt beslut, överlappningsvarningar från bibliotekets parkarta.
4. **Materialitetsprövning för arbetsförhållanden** lagras på modellen: `aktiv` eller `provad_ej_materiell` med motivering, beslutsfattare och datum. Ett aktivt arbetsförhållandekriterium gäller alla roller i modellen; en roll som inte omfattas bedöms 0.
5. **Bedömningsskalan blir 1 till 5.** Värdet 0 finns endast för ett aktivt arbetsförhållandekriterium och betyder "omfattas inte". Ankartexter är obligatoriska på steg 1, 3 och 5; steg 2 och 4 är valfria mellanlägen (gemensam mellanlägestext tills organisationen författar egna). Motivering krävs vid bedömning 1, 4 och 5.

## Avvägning / avvikelser från masterdokumentet

- Masterdokumentets krav på aktiveringsmotiv vid själva kriterievalet ersätts av kontrollfrågan som bekräftelse i väljaren plus dokumentationskravet (kriterieurvalsprotokollet) före modellgodkännande. Dokumentationen hamnar där den redan bor i stället för som friktion vid varje tillägg.
- Undantaget "fler än 8 med särskilt beslut" skjuts upp tills en kund behöver det.

## Konsekvenser

- Skalbytet gör gamla betyg ogiltiga: dev-data nollställs (pre-launch, ingen migreringskompatibilitet). Nivåtrösklar omkalibreras (ADR-0022).
- Ordlistan och i18n-termerna uppdateras (Dimension, Kriteriebibliotek, Materialitetsprövning; Steg blir 1 till 5).
- Innehållslyftet: 18 av 21 kriterier saknar källankare och författas enligt den gemensamma skalans semantik; nb/da/fi är maskinutkast flaggade för granskning.
