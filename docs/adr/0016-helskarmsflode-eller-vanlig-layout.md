# Helskärmsflöde eller vanlig layout

**Status:** accepterad (2026-08-06)

Utlöst av frågan om lönekartläggningens guidade resa (`/pay-mappings/[slug]/review`) ska tas bort eller tvärtom användas mer, och om rollvärderingen i så fall också borde bli ett helskärmsflöde. Appen hade två familjer av flerstegsflöden utan nedskriven regel för vilken ett nytt flöde hör till, och den luckan hade redan kostat en dubblering. Regeln nedan gäller hela dashboarden, inte bara lönekartläggningen.

## Beslut

1. **Ett helskärmsövertagande är förbehållet transaktioner.** `WizardShell` i ett `fixed inset-0`-lager används endast för flöden med en enda commit i slutet, där ett avbrott halvvägs inte lämnar någon giltig delprodukt: onboarding (användaren är inte inne i appen förrän den är klar) och de två importflödena (ingenting landar i registret förrän verkställ-steget). Chromet får säga "du är inne i den här saken nu" enbart när det är sant.
2. **Inkrementellt sparat arbete lever i vanlig layout**, hur sekventiellt och ett-i-taget det än är. Kännetecknet är att varje steg committar för sig och att den som lämnar mitt i har kvar en riktig, giltig delprodukt: rollvärderingen (autosparar per kriterium), modellbyggaren, klassificeringen och lönekartläggningens dokumentationsresa (varje klarmarkering sparas, arbetet sträcker sig över veckor och åtgärdsuppföljningen över år). En stepper i vanlig layout är fortfarande en stepper: ett steg i taget, framsteg synligt, tangentbordsstöd.
3. **Distraktionsfrihet är en skalfråga, inte en flödesfråga.** Behöver vi ett fokusläge byggs det en gång i `AppShell` och gäller varje yta, aldrig som en kopia av ett enskilt flöde. Sidopanelen är redan hopfällbar med sparat läge, vilket är merparten av det värdet; ett läge som dessutom fäller in headern är en möjlig påbyggnad, inte ett skäl att duplicera ett flöde.
4. **Kartläggningsresan flyttar hem.** `/pay-mappings/[slug]/review` med `PayMappingReview`, `ReviewProgress`, `ContinueReviewItem` och wizardens egen `ReviewChapterIntro` tas bort. Analysfliken blir den enda ytan för resan, och stegkomponenterna (`ReviewStartStep`, `ReviewPraxisStep`, `ReviewGroupStep`) renderas från ett enda ställe.

## Avvägning / varför

- **Dubbleringen var ett symtom på felklassningen, inte ett underhållsslarv.** Kartläggningsresan var det enda övertagandet vars arbete är inkrementellt. Eftersom arbetet också är kontextuellt behövde appen en variant i vanlig layout, så den fick två: två köbyggen, två framåtregler (`goForward` = index+1 mot `advanceAfter` = nästa oavklarade), två slutförandepaneler, två extragrupp-luckor. Två ytor kunde ge olika svar på "vad är nästa" och på "är plikten fullgjord" från identiskt tillstånd. Importerna och onboarding har aldrig behövt en dubblett, eftersom de är korrekt klassade.
- **Ett övertagande tar bort användarens karta.** Sidopanel och flikar är det som säger var i produkten man är. För en uppgift som görs en gång om året och avbryts ständigt är det precis då kartan behövs mest.
- **Kostnaden per övertagande är inte chromet utan följderna.** Varje instans blir en egen route, en egen utgång, en egen progress, en egen återupptagningsregel, egna tester, och (som fallet visade) en dragning mot att forka logiken.
- **Rollvärderingen ska därför inte bli ett helskärmsflöde.** Den är inkrementellt sparat arbete, och en wizard skulle byta bort orienteringen mot en fokuskänsla som skalet kan ge billigare och överallt.

## Konsekvenser

- Analysfliken blir kartläggningens enda arbetsyta och måste bära det: ett steg i taget i panelen, hopfälld fördjupning, och en checklista som fungerar som karta. Strukturen beskrivs i Iteration 3-planen (`docs/superpowers/plans/2026-08-06-iteration-3-analysis-ladder.md`).
- `/review` tas bort utan redirect-shim (pre-launch, "no legacy before launch"); varje producent av `?step=`-länkar riktas om i samma ändring, och i18n-nycklar som tappar sin konsument raderas i alla fem språkfiler.
- Wizard-primitiverna (`WizardShell`, `WizardFooter`, `WizardDots`, `WizardProgress`) blir renodlade transaktionsprimitiver med tre call sites kvar: onboarding, personimport, rollimport. `ScreenShell` är däremot inte wizard-specifik och används fortsatt av stegskärmar i båda familjerna.
- Ett framtida fokusläge, om vi vill ha det, är en ändring i `AppShell` med en användarpreferens, inte en ny route. Det är inte del av Iteration 3.
- ADR-0011:s livscykel och ADR-0012:s prioritetsordning påverkas inte: detta är en presentationsregel, inte en ändring av vad som ska göras eller när kartläggningen är klar.
