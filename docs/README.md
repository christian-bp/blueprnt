# Dokumentationsguide

Hur vi dokumenterar lösningar och beslut i blueprnt. Regeln är enkel: varje
avgjord fråga skrivs ner samma dag den avgörs, i det mest specifika hem den
har. Koden förklarar hur; dokumenten förklarar vad och varför.

## Var saker hör hemma

| Vad | Var | Exempel |
| --- | --- | --- |
| Domäntermer och språkregler | `docs/contexts/*/CONTEXT.md` (ordlistorna) | Bandutfall, Rollfamilj, Betyg kontra Poäng |
| Arkitekturinvarianter och teknikval | `docs/adr/` | EU-residens, live-omräkning utan versionering, AI som inbäddad assistent |
| Scope, byggordning, öppna frågor | `docs/PLAN-V1.md` | Öppna frågor i paragraf 9 flyttas till Avgjort med datum när de avgörs |
| Skivornas design och utförandeplaner | `docs/superpowers/specs/` och `docs/superpowers/plans/` | En spec och en plan per skiva, daterade |
| UI- och animationslärdomar | `docs/ui-animation.md` | Buggar vi inte vill skeppa två gånger |
| Regler för agenter och utvecklare | `CLAUDE.md`, `AGENTS.md` | Konventioner och absoluta regler |
| Domänunderlag | `docs/contexts/*/` | standardmall.md, track-level-band.md |

## Så avgörs en fråga

1. Frågan ställs och får ett förslag: i PLAN-V1 paragraf 9 (öppna frågor)
   eller direkt i en skiv-spec under `docs/superpowers/specs/`.
2. När grundaren avgör den uppdateras källan samma dag:
   - Påverkar den språket: ordlistan (och i18n-tabellen i samma fil).
   - Påverkar den en invariant: ny eller ändrad ADR.
   - Påverkar den scope eller datamodell: PLAN-V1 (stryk frågan, skriv
     Avgjort med datum).
3. Ett beslut som ändrar ett tidigare beslut raderar aldrig historiken:
   skriv det nya beslutet med datum och låt det gamla stå kvar
   överstruket eller refererat. Exempel: rollfamilj som entitet
   (2026-06-06) ändrade 9.14-beslutet från juni 2026.

## Språk

Domändokument skrivs på svenska och får behålla svenska filnamn. Kod,
kommentarer, commit-meddelanden och processdokument (specs, plans) skrivs
på engelska. Tankstreck används aldrig i text vi skriver; använd punkt,
komma, kolon eller parentes.
