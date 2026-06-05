# Konton (accounts)

Organisationer (tenants), deras medlemmar och behörighetsroller. Bygger på Better Auth-organisationer som ligger i EU-Convex-deploymentet.

## Språk

**Organisation** *(kod: Organization)*:
En enskild kundtenant — företaget som äger sina värderingsmodeller, roller och värderingar. Implementeras som en Better Auth-organisation; all data scopas till en organisation.
_Undvik_: Arbetsyta (tidigare term, bytt 2026-06-05), Konto, Företag, Tenant, Org

**Medlem** *(kod: Member)*:
En användares medlemskap i en organisation, som bär användarens roll där.
_Undvik_: Användare (en användare är den globala identiteten; en medlem är identiteten *inom* en organisation)

**Admin**:
En medlem som kan konfigurera värderingsmodeller, vikter och bandtrösklar samt hantera medlemmar.
_Undvik_: Ägare, Chef

**Editor**:
En medlem som kan registrera roller och mata in värderingar, men inte ändra modellkonfiguration.
_Undvik_: Bedömare

## Översättningssträngar (i18n)

| Nyckel | Svenska | English |
| --- | --- | --- |
| `accounts.organization` | Organisation | Organization |
| `accounts.member` | Medlem | Member |
| `accounts.role.admin` | Admin | Admin |
| `accounts.role.editor` | Editor | Editor |

## Flaggade oklarheter

- **FLAGGA — "Organisation" får inte överbelastas i V2**: tenanten heter "Organisation" (kod: Organization). V2:s organisationsstruktur (org-trädet: avdelningar, enheter, rapporteringslinjer) får aldrig kallas bara "organisation", eftersom det skulle krocka med tenant-begreppet. Använd "organisationsstruktur" eller "org-träd" för den entiteten när den införs.
- **Endast för HR**: varje medlem är HR/Reward-personal — chefer och anställda använder inte blueprnt. Roller handlar om att dela upp HR-arbetet, inte om att stänga ute opålitliga användare. För V1 kan vi slå ihop till en enda HR-roll, eller behålla Admin (konfigurerar modellen) vs Editor (kör värderingar). (TBD — öppen fråga)
- **Editor vs Bedömare**: "Bedömare" är den som matar in betyg för en roll; "Editor" är behörighetsrollen. I ett HR-only-verktyg är dessa oftast samma person — skilj dem åt bara om ett separat gransknings-/kalibreringssteg kräver det.

## Exempeldialog
— "Kan en Editor ändra vikterna?"
— "Nej — vikter är modellkonfiguration, bara en Admin rör dem. En Editor registrerar roller och matar in betyg inom organisationen."
