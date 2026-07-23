# Pay-mapping analysis and reporting: competitor teardown and build plan

**Date:** 2026-07-13 · **Status:** analysis + roadmap input (feeds per-feature brainstorm -> spec -> plan) · **Scope:** the Analysera and Rapport pillars of the lönekartläggning, plus the survey Overview.

## 1. Purpose

We reviewed a mature Swedish lönekartläggning tool (Sysarb-style: the nav is Översikt / Förbered / Organisera / Analysera / Rapport, scoped to a period like `2025_5`). Its structure maps cleanly onto our own pipeline, so this document turns that inspiration into a concrete plan: what to adopt, what to do better, and where each piece lands in our roadmap (modules M1-M9, the P1/P2/P3 order from ADR-0012, and the guide's Del 3-7).

This is not an implementation plan. Each feature below is sized and sequenced so it can go through the normal brainstorm -> spec -> plan cycle on its own. It is written against the state after the P1 gender-gap primary view was built (the pure `packages/core` gap engine, the `getPayMappingGap` aggregate query, and the two-table lika/likvärdigt view with the four flags).

## 2. The reference tool: a five-stage guided flow

The competitor structures a whole survey as a linear, guided flow with per-period framing:

| Their stage | What it is | Our equivalent |
|---|---|---|
| **Översikt** | A headline dashboard: the org-level gap, distributions, the "equality clock" | New Overview tab on a kartläggning (does not exist yet) |
| **Förbered** | Import and prepare the population | M1 import (shipped) |
| **Organisera** | Job evaluation and leveling (arbetsvärdering) | M2 role evaluation + classification (solid) |
| **Analysera** | Lika arbeten + Likvärdiga arbeten: gap tables, objective reasons, scatter plots | M4/M5 (P1 built) + M6 objective reasons (greenfield) |
| **Rapport** | Multi-format export for union/employer sign-off and management | M8 reporting (greenfield) |

The staged framing itself is worth adopting inside a kartläggning. It matches our "guide the user through every concept" priority: a survey becomes a sequence (Overview -> Analyze -> Report) with a clear completion state, rather than one flat detail page. This is a UX wrapper, not new engine work, and it should be introduced gradually as the analysis and report surfaces land.

## 3. Screen-by-screen teardown

### Screen 1: Översikt dashboard

**What it shows.** Six cards: (a) the unadjusted gap (women vs men mean total pay, with bars); (b) the **adjusted gap**, decomposed into explained factors (age, level) versus an **unexplained residual**, with the explained share called out ("Lönefaktorer 1,6 %"); (c) an **equality clock (jämställdhetsklocka)**, unadjusted and adjusted, rendered as hours:minutes:seconds; (d) a gender-distribution donut; (e) **gender distribution by pay quartile** (a glass-ceiling view); (f) age distribution by gender.

**What is good.** It answers "how do we stand?" at a glance and gives management-ready framing. Two elements stand out:

- The **equality clock** ("how much of the working day one gender effectively works unpaid") is a communicative device, not a new statistic: it is derived directly from the gap percentage. It is highly effective for a management or union presentation, and it is cheap to build.
- The **adjusted (decomposed) gap** is the legally and analytically meaningful number. The raw gap mixes composition effects (who sits where) with unequal pay for equal work; the *unexplained residual* after controlling for legitimate factors is closer to what the law targets.

**What to adopt.** A survey **Overview** as the landing view (before our P1 tables), and specifically **their widget-grid form**: a grid of compact, uniform stat cards, each with one focal statistic or chart, so the whole situation reads in one sweep. Contents: the org-level headline gap, the gender donut, the pay-quartile segregation view, and the age-by-gender distribution. All of these are computable from the frozen snapshot we already have. Our addition to the grid (not in theirs): a **flag summary** widget counting the analysed groups per severity flag with a link into the analysis, so the overview also answers "what needs my attention", not only "how do we stand".

**How to do it better.**
- **Guidance.** They use info icons; we explain each metric inline in plain language (HelpMorphButton), because most HR users do not know what "adjusted gap" or "quartile" means.
- **Reproducibility.** Every figure traces to the frozen snapshot and the deterministic engine, so the overview is auditable and identical on re-open, not a cached dashboard number.
- **Animation.** The equality clock is a natural fit for our morph/animation language (an animated count).
- **Honesty on small n.** The adjusted gap uses a regression; with 118 employees at 18% women it is statistically fragile. We should compute it as a *pure, deterministic* routine in `packages/core`, show its confidence caveat prominently, and never present the residual as precise when the sample cannot support it. This is a differentiator: an honest, explained adjusted gap rather than a false-precision number.

**Where it lands.** M4/M5 (a new Overview surface on the survey), with the quartile split and könsdominans as P2 signals per ADR-0012.

### Screen 2: Analysera / Lika arbeten (objective reasons)

**What it shows.** A worklist of lika-arbete groups with completion tabs (Ej klara / Klara / Alla) and search. For the selected group: **pay differences explained by** factors grouped into three columns, **Marknad** (alternative labour market, pay level at recruitment), **Individ** (experience, historical pay, competence, performance), and **Arbete** (responsibility); a free-text "Fördjupad analys"; a **"Generativa insikter" (AI)** button; and a green **Klarmarkerad** (mark done).

**What is good.** This is the documentation surface that a real lönekartläggning turns on: for every flagged pay difference, the employer must record an objective reason (sakligt skäl) or an action. The grouped Market/Individual/Work taxonomy is the standard framework (it mirrors the Diskrimineringsombudsmannen guidance). The per-group completion state is exactly the mechanism that drives a survey to "done."

**What to adopt.** This is our **M6 (objective reasons)**, and it is the missing half of the P1 view we just built. Adopt: the Market/Individual/Work taxonomy, the per-group worklist with a done-state, and the free-text rationale field. Wiring per-group completion is precisely ADR-0012's **completion gate** (a survey cannot reach Slutförd until every red/amber group carries a documented reason or an action plan).

**How to do it better, and the key architectural constraint.** Their "Generativa insikter" almost certainly reads individual pay and performance to write its analysis (the sample text names "the person with the highest pay in the group"). **We cannot do that**: we never send person PII to the AI (Role != Person, GDPR, ADR-0003). So our AI-assist must operate on **role-level and aggregate-level inputs only**: the group's aggregate gap, the role profile and its evaluation criteria, band and level, and organization context (industry, size, country). From those it can propose *likely reason categories* and *draft neutral language*; the HR user writes any person-specific rationale themselves and confirms the suggestion (provenance, HR-decides). This is both a constraint and a genuine selling point: defensibly GDPR-clean AI in a domain where the incumbent's AI is a data-protection liability.

We can also **pre-fill** likely reasons from our own model: their "Ansvar" (responsibility) is one of our evaluation criteria, so a role scored high on a criterion can pre-suggest the matching work-related reason.

**Where it lands.** M6, layered on the P1 view. It unlocks survey completion (M3 status lifecycle + ADR-0012 gate).

### Screen 3: Analysera / Likvärdiga arbeten (women-dominated, cross-level)

**What it shows.** A **"Kvinnodominerade arbeten"** worklist and a table comparing a women-dominated job against comparator jobs across **levels** (Nivå 7, 6, 5): count, share women, mean pay, mean-pay difference in % and SEK, and a "pay level affected by" tag. The headline finding: a level-7 women-dominated role is paid *less* than roles at level 6 and level 5, that is, higher-valued work is paid less than lower-valued work.

**What is good.** This captures a requirement our current P1 likvärdigt view does not fully express. Our P1 groups by band and compares women vs men *within* a band. But Diskrimineringslagen 3:9 specifically requires identifying **women-dominated** jobs and comparing their pay against equivalent *or higher-valued* non-women-dominated jobs. The "higher band paid less than a lower band" inversion is the core red flag of equivalent-work analysis, and it is a cross-band comparison, not a within-band one.

**What to adopt.** The women-dominated lens (flag roles at >= 60% one gender, which is the könsdominans signal ADR-0012 classes as P2) and the cross-band comparison that surfaces the inversion.

**How to do it better.** Surface the inversion **visually and prominently** (a higher-valued women-dominated role sitting below lower-valued roles on a pay-by-band view) rather than as a dense table, and anchor it to our transparent band weights so the "why is this equivalent" is legible. Explain könsdominans and likvärdigt inline.

**Where it lands.** The könsdominans flag is a P2 signal; the cross-band comparison enriches likvärdigt and sits on the P1 -> P2 boundary. Scope carefully so the mandatory P1 view stays simple and this is an additive "understand why" layer (ADR-0012: P2 complements P1, never replaces it).

### Screens 4 and 5: Analysera / per-person scatter with rich hover

**What it shows.** A scatter plot of individuals (pay on the Y axis, age on the X axis, marker shape/colour by job) for an equivalent-work comparison set, with a diagram-type toggle and a selectable Y metric. Hovering a point reveals the full individual record: job, position title, tenure, time in current position, pay year, base and total pay, gender, statistics code, organization.

**What is good.** As you noted, the scatter is where an analyst *sees the individuals* and can reason about whether a pay position has a historical explanation, spot outliers, and understand dispersion. It is the visual companion to the objective-reasons work: you see an outlier, then you document why.

**What we already have.** We built exactly this pattern for the person page: `PayComparisonSection` plots same-role peers on FTE-adjusted total pay, coloured by **gender** (colourblind-safe tokens, a brand ring for the viewed person), with a rich tooltip that breaks pay into base and variable and shows the gap to the viewed person.

**What to adopt.** Put a per-person scatter on the **kartläggning analysis surface**, over the frozen snapshot, for a lika or likvärdigt group. Add axis flexibility (pay by age / tenure / level) and the diagram-type toggle.

**How to do it better.** Colouring by **gender** is the right primary lens for a gender-gap tool (theirs colours by job); we already do it, colourblind-safe. Reuse our built component against the snapshot rather than rebuilding. Crucially, **link the scatter to the objective-reason tagging**: clicking an outlier should let the analyst record its reason inline, closing the loop between "see it" and "document it". Respect the frozen-snapshot read model (this is HR-only individual data; the export boundary is where masking applies).

**Where it lands.** An analysis-surface scatter reusing the comparison logic against the snapshot (M4/M5), tied to M6 tagging.

### Screen 6: Rapport (export)

**What it shows.** Finished reports (a `.pptx` summary), exports from Organisera (job-evaluation results `.xlsx`, factor plan `.docx`, survey-jobs `.xlsx`), exports from Analysera (a summary `.xlsx`, a per-employee `.xlsx`, an actions `.xlsx`, and per-analysis `.docx` for lika and likvärdiga), and report templates. The stated purpose: a report the union and employer can sign and agree on, or present to management.

**What is good.** The report is the statutory deliverable (EU Art. 9; the internal survey report; the union aggregate; the individual employee extract). Multiple formats serve multiple audiences (management presentation, union negotiation, machine-readable filing).

**What to adopt.** This is our **M8 (reporting and export)**: a summary report for sign-off and presentation, data exports (survey summary, per-employee, actions), and the per-analysis documents.

**How to do it better.**
- **Quality and reproducibility.** We build PDFs with pandoc + typst and a branded `@react-pdf` kit; every figure derives from the frozen snapshot, so the report is reproducible and auditable rather than a screenshot of a live dashboard.
- **Sign-off flow.** A union/employer co-sign step (facket + arbetsgivare acknowledge and agree the outcome) fits our existing compliance-acknowledgement pattern and adds provenance.
- **Logging.** Access and export logging (deferred in M3) lands here, at the boundary where data leaves the system.
- **Masking.** This is the boundary where the small-cell masking must harden. In-app the audience is HR (who already see every salary), so the P1 view masks on total group size (< 4). The moment the aggregate leaves that context in an export, the per-gender minimum decision applies (mask when either gender has fewer than 2). This is already tracked in the go-live checklist and is triggered by this module.

**Where it lands.** M8.

## 4. Cross-cutting principles and constraints

These shape every feature above and are where we differentiate:

1. **Guide every concept.** Adjusted gap, quartile, likvärdigt, könsdominans, sakligt skäl: each is a domain term most HR users do not know. Every surface that introduces one explains it inline in plain language. This is a product priority, not a nicety.
2. **Deterministic and auditable.** Gap, band, and now the adjusted gap are pure `packages/core` computations over the frozen snapshot. Every number on every screen and in every export is reproducible and traceable. The incumbent shows dashboard numbers; we show numbers you can defend to a union or a court.
3. **GDPR-first AI (the load-bearing constraint).** We never send person PII to the AI. Our AI-assist for objective reasons operates on role-level and aggregate inputs only, proposes categories and neutral draft language, and HR confirms. This reshapes the "Generativa insikter" feature relative to the incumbent and is a defensible advantage in a regulated domain.
4. **Small-cell privacy rigor.** We already reason about masking; the export boundary is where the per-gender minimum applies. The scatter and per-employee report inherit this.
5. **Brand and animation.** The overview, the equality clock, and the worklist transitions are opportunities to make the analysis feel alive (Motion, respecting reduced-motion).
6. **Nordic, multi-locale.** Everything ships in en/sv/nb/da/fi. The incumbent is Swedish-only.

## 5. The build plan

Each item is a candidate for its own brainstorm -> spec -> plan. Effort is rough (S/M/L relative to the P1 slice we just built).

### F1. Kartläggning Overview surface (M4/M5) [first slice SHIPPED as a widget grid]

- **What.** The survey's landing view as a **shadcn-style dashboard** (deliberately not a copy of the competitor's uniform card mosaic): a KPI strip of compact stat cards over a row of expandable distribution charts. Each widget carries a real title with inline plain-language help and renders its own honest loading/insufficient state; graphs speak with minimal in-card text.
- **Shipped (fully).** KPI strip: the unadjusted org gap (signed % + severity flag + mini gender-mean bars), the equality clock (digit boxes, F2), and the **flag summary KPI** (red+amber group count + severity breakdown + a link into the analysis; our addition, the competitor's overview stops at "how do we stand" while ours also answers "what needs my attention"). Charts row: the whole survey (gender donut + the headcount), gender-by-pay-quartile (the glass-ceiling view, pure `quartileGenderTallies` in core), and age-by-gender (`ageGenderTallies`, ages at the frozen reference date, unknown birth dates stated). All three charts expand to a large dialog via the reusable `WidgetCard` primitive (title + help + header slot + fullscreen expand), which the person page's pay-comparison plotter also uses.
- **Follow-on.** The adjusted gap + adjusted equality clock join the KPI strip with F7.

### F2. Equality clock (M4/M5, quick win) [SHIPPED]

- **What.** A jämställdhetsklocka derived from the gap: the daily time-equivalent of the pay gap, shown as animated digit boxes (hours : minutes : seconds, the competitor's form) with an honest direction sentence (which gender is behind; "no measurable gap" near zero) instead of a bare minus sign.
- **Shipped.** As an Overview widget: a pure derivation (|gap%| of an 8-hour day) + the animated digit-box component, gated so it never renders a claim while the data is loading or insufficient. The **adjusted** clock (on the decomposed gap) follows F7.
- **Key decisions (settled).** 8-hour workday basis; direction stated in words. **Risk (managed).** Misreading; the sentence and inline help carry the meaning.

### F3. Objective reasons and the completion gate (M6) [recommended next]

- **What.** The sakliga-skäl surface: a worklist of flagged lika (and likvärdigt) groups with a done-state, per-group reason tagging on the Market/Individual/Work taxonomy, a free-text rationale, a GDPR-safe AI-assist that suggests categories and neutral draft language from role/aggregate data only, and the survey completion gate (ADR-0012): a survey reaches Slutförd only when every red/amber group carries a documented reason or an action plan and ⚪ groups are motivated.
- **Scope.** A reason catalog (packages/constants), a per-difference documentation entity + mutations (org-scoped, audited, Role != Person), the worklist + form UI, the AI action (Convex action, EU model, aggregate inputs only, provenance), and the status transitions on the run.
- **Effort.** L. **Priority.** Highest value after P1: it is what makes a kartläggning completable, it is legally required, and screens 2-3 are really about it. **Depends on.** P1 (built), the run status lifecycle (M3 seam exists).
- **Key decisions.** The reason enum and per-code evidence requirements; how the AI-assist is scoped to avoid PII; whether reasons attach to a frozen-snapshot difference or the work layer (ADR-0011 two-layer model). **Risk.** The AI-assist scope is the crux; design it aggregate-only from the start.

### F4. Women-dominated cross-level likvärdigt (M4/M5, P2)

- **What.** Flag women-dominated roles (könsdominans >= 60%) and compare each against comparator roles across bands, surfacing the "higher-valued work paid less" inversion.
- **Scope.** Extends the likvärdigt analysis with a könsdominans classifier (pure core) and a cross-band comparison view.
- **Effort.** M. **Priority.** P2 (additive to the mandatory P1). **Depends on.** P1 likvärdigt (built), band weights (built).
- **Key decisions.** Keep P1 simple and put this in a P2 "understand why" layer; the könsdominans threshold. **Risk.** Blurring the mandatory P1 primary view; keep the boundary clean.

### F5. Per-person analysis scatter over the snapshot (M4/M5)

- **What.** The per-person scatter on the analysis surface, coloured by gender, with a rich hover, axis flexibility, and a link into objective-reason tagging.
- **Scope.** Adapt `PayComparisonSection` to read the frozen snapshot for a group; add axis options; wire the tag-from-outlier interaction.
- **Effort.** M. **Priority.** Supports F3 (the visual companion to reasons). **Depends on.** The snapshot (built), the comparison component (built), ideally F3.
- **Key decisions.** Which axes to offer; HR-only individual view vs the export masking boundary. **Risk.** Low; mostly reuse.

### F6. Reporting and export (M8)

- **What.** A Rapport surface: a branded summary report (PDF/PPTX) for sign-off and management, data exports (survey summary, per-employee, actions), the per-analysis documents, the EU Art. 9 structured export, a union/employer co-sign step, access/export logging, and the hardened small-cell masking.
- **Scope.** Large. Report content generation on the pandoc+typst / @react-pdf foundation, XLSX write paths, the co-sign flow, logging, and the per-gender masking at this boundary.
- **Effort.** L. **Priority.** After the analysis content exists (F1-F5) and objective reasons (F3), since the report renders their output. **Depends on.** M5 metrics, M6 reasons, M7 action plans.
- **Key decisions.** Which formats first (summary PDF is the highest value); the co-sign mechanism; the masking rule at export. **Risk.** Blocked on upstream content; sequence last.

### F7. Adjusted (decomposed) gap (M5, advanced)

- **What.** The regression-decomposed gap: split the raw gap into explained factors (age, tenure, level, ...) and an unexplained residual, with the explained share shown.
- **Scope.** A pure, deterministic regression in `packages/core`, a factor-selection UI, and heavy plain-language framing plus a small-sample confidence caveat.
- **Effort.** M-L. **Priority.** Advanced; after the core P1/overview lands. **Depends on.** The snapshot and stats.
- **Key decisions.** Which factors; how to present confidence; whether to gate it below a minimum n. **Risk.** False precision on small orgs; this is the main reason to caveat heavily and possibly hide it below a sample threshold.

### F8. Action plan (M7) and the staged workflow framing

- **Action plan (M7)** is the other half of the completion gate (an unfair gap with no objective reason needs an åtgärdsplan). It pairs with F3 and is required before a report (F6) is meaningful. Sized separately; sequenced with F3/F6.
- **Staged workflow framing** (Overview -> Analyze -> Report, with a survey completion state) is a UX wrapper introduced gradually as F1/F3/F6 land, not a standalone build.

## 6. Recommended sequencing

1. **F3 Objective reasons + completion gate (M6).** The missing half of P1; makes a survey completable; legally required.
2. **F1 Overview + F2 equality clock.** Quick, high-visibility framing of the mandatory view; small and parallelizable.
3. **F5 Analysis scatter** and **F4 women-dominated cross-level.** The "understand why" layer (P2), supporting the reasons work.
4. **F8 Action plan (M7).** The second completion-gate input.
5. **F6 Reporting and export (M8).** Renders everything above; sequence last.
6. **F7 Adjusted gap.** Advanced, optional, caveated.

This keeps the mandatory P1 view first (ADR-0012), completes the survey lifecycle (reasons + actions + gate), then adds the "understand why" and reporting layers.

## 7. Open decisions

- **AI-assist scope.** Confirm the aggregate/role-only constraint for the objective-reasons AI (no PII to the model). This is the crux of F3.
- **Adjusted gap.** Build it (caveated, possibly gated below a minimum n) or defer? It is powerful but fragile on small orgs.
- **Export co-sign.** Do we want a union/employer acknowledgement/sign flow in the report, or is a static signed PDF enough for V1?
- **Per-gender masking at export.** Already deferred to F6/M8 (go-live checklist); confirm the >= 2-per-gender rule there.
- **Könsdominans threshold.** Confirm 60% for the women-dominated lens (F4).

## 8. Tracker updates applied

The roadmap tracker was updated alongside this document: M4 (comparison groups) and M5 (analysis and statistics) now reflect the shipped P1 gender-gap view (lika + likvärdigt grouping, the pure gap engine, the four flags, and ⚪ masking); M4/M5/M6/M8 verdicts and requirement rows gained the competitor-inspired items (Overview + equality clock, the adjusted gap, the women-dominated cross-level comparison, the analysis scatter, the Market/Individual/Work reason taxonomy with GDPR-safe AI-assist, and the multi-format report with co-sign); and a changelog entry records this teardown.
