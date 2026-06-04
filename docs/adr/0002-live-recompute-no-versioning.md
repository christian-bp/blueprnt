# V1: live-omräkning av poäng/band utan modellversionering

**Status:** accepted

I V1 har varje arbetsyta **en levande värderingsmodell** utan versioner. Poäng och band lagras inte, utan **härleds** från sparade betyg (0–5) + den aktuella modellen. När HR ändrar modellen (betydelser, kriterier, bandtrösklar) räknas alla rollers poäng/band om direkt. Valt för enkelhet, och passar Convex reaktiva modell väl.

## Avvägning / avvikelse

Avviker medvetet från CTO-briefens krav: *"modelländringar får inte retroaktivt skriva över historiska bedömningar utan versionering."* Konsekvens: en modelländring kan tyst flytta roller mellan band utan att tidigare utfall bevaras.

## Övervägda alternativ

- **Versionerad modell (briefens linje):** varje värdering stämplas med modellversion; ändringar skapar ny version; gamla utfall bevaras. Mest spårbart, mest att bygga. Bortvald för V1.
- **Utkast → publicera:** versionering med explicit publiceringssteg. Bortvald för V1.

## Konsekvenser

- Datamodellen lagrar **betyg** som sanning; poäng/band är härledda (rena funktioner i `packages/core`).
- Ingen historik över tidigare band per roll utan extra åtgärd.
- Mildras av en **revisionslogg** som ingår i V1: fångar modelländringar (vem/vad/när) + vilka roller som bytte band till följd. Täcker briefens krav på ändringsloggning.
- Att ångra beslutet (införa versionering) blir dyrare ju fler värderingar som finns — betrakta som en medveten V1-genväg.
