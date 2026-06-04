# Backend på managed Convex (EU-region) med Better Auth för EU-baserad auth

**Status:** accepterad

blueprnt är ett verktyg för EU-lönetransparensefterlevnad som hanterar EU-anställdas persondata (roller, värderingar, identiteter), så all data ska ligga inom EU. Vi använder **managed Convex Cloud i EU-region (AWS eu-west-1, Irland)** som databas + funktionsbackend, och **Better Auth** (organisations-plugin) via den officiella Convex-komponenten för autentisering och multitenancy — så identitets- och organisationsdata ligger i samma EU-Convex-deployment. En Better Auth-organisation är **arbetsytan** (tenant); Convex-funktioner scopar all data per organisation.

## Övervägda alternativ

- **Clerk + Convex (US):** beprövade orgs/RBAC, men Clerk hostar identitetsdata i USA → bryter EU-residens. Bortvalt.
- **Självhostad Convex på EU-/suverän leverantör:** maximal kontroll och äkta suveränitet, men offrar Convex noll-drift-fördel (Docker + Postgres + backup + uppgraderingar + övervakning). Onödigt nu när managed Convex har EU-region; omprövas bara om en kund avtalsmässigt kräver EU-ägd (icke-US-moder) infra.
- **Convex Auth (inbyggd):** fortfarande beta, ingen organisationsprimitiv — vi skulle bygga all tenancy själva. Bortvalt.
- **Annan EU-managed backend (t.ex. Supabase EU):** skulle innebära att släppa Convex, som teamet valt för dess reaktiva modell. Bortvalt.

## Konsekvenser

- EU-deployments debiteras ~30 % högre på resursanvändning, on-demand (Starter/Pro-inkluderade kvoter gäller inte).
- Regioner kan inte auto-migreras — flytt kräver backup + restore. EU-regionsvalet är i praktiken en enkelriktad dörr.
- eu-west-1 är en AWS-region (amerikanskt moderbolag): GDPR-residens, men inte "suverän molntjänst". **Residensnivå bekräftad för V1: fysiskt-i-EU räcker; strikt EU-suveränitet uppskjuten** tills en kund avtalsmässigt kräver det.
- Förenligt med framtida **ISO 27001**-certifiering.
- Att de-riska tidigt: bekräfta att Better Auths **organisations-plugin** fungerar med Convex-komponenten, och att Convex DPA täcker loggar/fillagring i EU.
