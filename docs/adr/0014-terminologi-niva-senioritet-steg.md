# Terminologi: Nivå, Senioritet och Steg

**Status:** accepterad (2026-08-05)

Tre begrepp byter namn, ingen semantik ändras.

1. **Band** (rollens beräknade tyngd, utfallet av poängen via trösklarna) heter **Nivå** (kod `level`). Nivå 1 är fortfarande högst.
2. **Nivå** i sin tidigare betydelse (medarbetarens senioritet inom rollens track, ADR-0005) heter **Senioritet** (kod `seniority`). Ladderns värden (IC1–IC5, Lead-1–Lead-3, M1–M3) är oförändrade.
3. Kriteriets sex lägen på bedömningsskalan 0 till 5, tidigare "nivåer", heter **Steg** (kod `step`).

Samma beräkning, samma riktning, samma data. Endast orden är nya.

## Avvägning / varför

- **Nivå är användarens ord för rollens tyngd.** Band är facktermen ur den engelska kompensationsvärlden och kräver en förklaring i varje samtal och på varje yta. Produktens främsta mål är begriplighet (PLAN-V1 §1), och då ska det viktigaste utfallet heta det HR redan säger om det.
- **Bytet av Band tvingar de andra två.** Gamla Nivå betyder något helt annat (individens senioritet) och numreras dessutom i **motsatt** riktning: IC1 är lägst, medan Nivå 1 är högst. Två begrepp som heter Nivå i samma app, med omvänd skala, är en garanterad förväxling. Senioritet stod redan i ordlistan som godtagbar beskrivning av begreppet, så bytet formaliserar det språk som ändå användes.
- **Ankarskalans "nivåer" var det tredje kolliderande bruket.** Kriteriets 0 till 5-lägen kallades nivåer i både kod (`anchors[].level`) och UI-text, vilket är den kollision som redan tvingade fram omdöpningen av UI-etiketten till "bedömningsskala" (2026-06-24). **Steg** beskriver dessutom bättre vad de är: lägen på en skala, inte klasser.
- **Ordvalen per språk** (en, sv, nb, da, fi): Nivå = Level, Nivå, Nivå, Niveau, Vaativuustaso (kort form Taso {n} i numrerade etiketter, chips och diagramaxlar; vaativuustaso i löptext). Senioritet = Seniority, Senioritet, Senioritet, Senioritet, Senioriteetti. Steg = Step, Steg, Trinn, Trin, Porras.

## Konsekvenser

- **Kod-identifierare och schemafält byter namn utan migrering.** `models.bandThresholds` blir `levelThresholds`, `anchorRoles.expectedBand` blir `expectedLevel`, `personAssignments.level` blir `seniority`, kriteriernas `anchors[].level` blir `anchors[].step`, klassificeringens `suggestedLevel`/`levelSource` blir `suggestedSeniority`/`senioritySource`. I `packages/core` blir `Band`/`BandThreshold` till `Level`/`LevelThreshold` och `assignBand` till `assignLevel`; i `packages/constants` blir `TRACK_LEVELS` till `TRACK_SENIORITIES`. Kriteriets texter per viktpoäng, `weightLevels`, blir `weightMeanings` (mallinnehållet, `getModel`s svarsfält och modellbyggaren), så att `level` i koden enbart betyder rollens beräknade nivå. Pre-launch gäller "no legacy" (CLAUDE.md): inga kompatibilitetsskikt och inga kvarhängande fält. Dev-data nollställs med `db:reset` och prod seedas om.
- **Revisionsloggen följer med.** Händelsen `band.shift` heter `level.shift`, kategorihärledningen matchar prefixet `level.`, och fältnycklarna (`bandThresholds`, `expectedBand`, senioritetens `level`, `levelSource`) byter namn tillsammans med sina etiketter i alla språkfiler. Ingen backfill behövs eftersom dev-data nollställs och lansering inte har skett.
- **i18n-nycklar och etiketter byter namn i samtliga fem språkfiler** (en, sv, nb, da, fi). Svenska och engelska är granskade. **Nb, da och fi är utkast och ska granskas av modersmålstalare**, särskilt finskans `Vaativuustaso` respektive `Taso {n}` och norskans/danskans `Trinn`/`Trin`.
- **Äldre ADR-texter skrivs inte om.** ADR-0002, 0004, 0005, 0011 och 0012 behåller sina ursprungliga ord som historik (docs/README: ett nytt beslut raderar aldrig historiken). ADR-0005, 0011 och 0012 får korta tillägg som pekar hit. Källdokumentet `track-level-band.md` står kvar med sina ord under en repo-anmärkning som innehåller översättningsnyckeln; `viktning-poangbudget.md` behövde ingen översättningsnyckel, dess repo-anmärkning uppdaterades i stället direkt till de nya orden (bandtrösklarna blev nivåtrösklarna) medan källtexten står orörd.
- **De levande dokumenten bär den nya terminologin:** ordlistorna (`docs/contexts/**`), `CONTEXT-MAP.md`, `CLAUDE.md`, `docs/PLAN-V1.md` och go-live-checklistan. Varje omdöpt ordlistepost noterar den gamla termen en gång ("tidigare Band" respektive "tidigare Nivå"), så att äldre text går att läsa utan att någon gissar.
- **Risken vid bytet är förväxling åt andra hållet:** en läsare som möter "nivå" i äldre text kan tro att det handlar om senioritet. Ordlistornas _Undvik_-rader säger därför uttryckligen att Band är utgånget och att Nivå inte längre betyder individens senioritet.

## Övervägda alternativ

- **Behålla Band.** Ingen kod rörs, men det dyraste ordet i produkten fortsätter kräva en förklaring på varje yta, och Nivå fortsätter betyda två saker i dagligt tal ändå (HR säger redan "nivå" om bandet). Bortvald 2026-08-05.
- **Låta båda heta Nivå (nivå på rollen och nivå på individen).** Bortvald: två begrepp med samma namn, olika bärare och **omvänd** numrering är den värsta varianten, och den skulle göra varje mening om "nivå" beroende av sammanhanget.
- **Kalla individens senioritet Grad eller Steg.** Bortvald: Grad är ovanligt i svenskt HR-språk och läses som examensgrad, och Steg behövs för ankarskalans lägen.
- **Bara byta UI-orden och behålla kodens `band`/`level`.** Bortvald: glossariets kod-term ska matcha domäntermen (CLAUDE.md, Domain language), annars återuppstår förväxlingen i varje kodgranskning och i varje ny i18n-nyckel.

*Den svenska texten är utkastad av en assistent; den bör granskas av en modersmålstalare.*
