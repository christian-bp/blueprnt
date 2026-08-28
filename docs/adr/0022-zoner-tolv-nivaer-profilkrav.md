# ADR-0022: Zoner, tolv nivåer och profilkrav

**Status:** accepterad (2026-08-18)

## Kontext

Masterdokumentet (§14) rekommenderar fyra zoner med tolv nivåer i stället för dagens sju, där högre zoner kräver både lägsta viktad totalpoäng och profilkrav på de högst viktade kriterierna. Beslutet togs att införa hela §14 i ett steg (spec 2026-08-18).

## Beslut

1. **Tolv nivåer i fyra zoner.** Zontillhörighet är strukturlag, aldrig konfiguration: A = nivå 1 till 3, B = 4 till 6, C = 7 till 9, D = 10 till 12. Nivå 1 är fortsatt högst. Modellens `levelThresholds` (7) blir `levelRules` (12) med `minScore` på den normaliserade 0 till 100-skalan (ADR-0004 består).
2. **Profilkriterier härleds, lagras aldrig:** kriterierna med viktpoäng 4 eller 5 (masterdokumentets höga viktklasser). En helt platt modell (alla 3) har inga profilkriterier och därmed inga profilkrav, vilket är principiellt riktigt: inga deklarerade prioriteringar, ingen profilgrind.
3. **Per zon ett valfritt profilkrav** (`zoneProfileRules`: lägsta steg som varje profilkriterium måste nå). Standard: A kräver 4, B kräver 3, C och D inga.
4. **Deterministisk placering utan override.** Motorn placerar rollen i den högsta zon vars profilkrav den uppfyller (poängzonen är kandidat; profilen kan endast begränsa, aldrig lyfta; zon D släpper alltid in). En begränsad roll får den landade zonens ÖVERSTA nivå (t.ex. nivå 4 i zon B) och flaggan `profileLimited`, som är masterdokumentets "kalibrering krävs": placeringen är alltid definierad, en människa ombeds titta. Kalibrering är en bekräftelse (rollens bedömning markeras kalibrerad med notering) eller en metodändring, aldrig en lagrad nivåoverride (invarianten "ingen nivåoverride" består).
   *Beslutsnot (2026-08-18):* masterdokumentets §14.6 kallar zonens "första nivå" för inträde, men dess egen §14.6-exempeltext motsäger §14.3:s numrering, så begreppet är tvetydigt i källan. Vi väljer poängtrogen klampning: poängen ville högre, profilen begränsar ZONEN, och inom zonen tar rollen dess översta nivå. Botten-av-zon prövades och förkastades som dubbelbestraffning.
   *Beslutsnot 2 (2026-08-18):* ett arbetsförhållandekriterium är ALDRIG profilkriterium, oavsett vikt. Dess 0 betyder "omfattas inte" (strukturell nolla, §10.1), inte lågt krav; att grinda zon A på t.ex. jourexponering skulle systematiskt kapa alla icke-exponerade roller, vilket inget av §14.7:s profilkravsexempel avser. Bidraget till totalpoängen består; endast zongrindningen undantas.
5. **Kalibreringskön är härledd:** profilbegränsade placeringar utan bekräftelse, ankarroller vars beräknade nivå avviker från `expectedLevel`, samt bedömningar låsta före senaste metodgodkännandet.

## Avvägning / avvikelser från masterdokumentet

- §17.4:s pseudokod returnerar ett oavgjort läge vid profilkonflikt. Vår motor placerar alltid deterministiskt och flaggar i stället, eftersom poäng och nivå alltid härleds (ADR-0002) och en override-fri arkitektur inte kan lämna placeringen öppen. Samma intention, definierat utfall.
- §14.3:s konfigurationsparameter för numreringsriktning avstås: "nivå 1 är högst" är en appövergripande invariant i ordlista, UI-copy och kod.

## Konsekvenser

- Likvärdigt arbete grupperas fortsatt per nivå. Tolv nivåer ger finare grupper: fler små grupper och fler singletons utanför instegsvillkoren i små organisationer, vilket analysen redan redovisar öppet (ADR-0015). Accepterat.
- Gamla frysta kartläggningar är självbärande och orörda; nya fryser tolvnivåreglerna.
- Nivåstegen, matrisen och arkitekturöversikten renderar zonerna som visuell gruppering; zonen är aldrig ett bedömningsfält.
- **Standardtrösklarna lever i koden, inte här.** `DEFAULT_LEVEL_RULES` (`packages/core/src/zones.ts`) seedar varje ny organisation, och tabellen med det aktuella värdet per nivå står i `docs/contexts/evaluation-model/standardmall.md`. ADR-0004:s sju värden (98/83/74/63/53/41/0) är därmed historik; de gäller inte längre. Trösklarna är fortsatt per organisation redigerbara och ska kalibreras mot ankarroller före lansering enligt masterdokumentet §14.2, aldrig anpassas för att fördelningen ska se jämn ut.
