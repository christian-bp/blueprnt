# Design: application-wide design system refactor (Verve-pattern shell, frames, tables)

Status: approved design, not yet implemented. Work happens on branch `feat/design-system-refactor`; nothing is committed without explicit approval.
Date: 2026-08-22.
Scope decided with the founder: one coherent design language across the whole dashboard, modeled closely on the Verve CRM demo (verve-crm.reui.io) while keeping our brand, component stack, and product rules. Three decisions were made explicitly: full icon rail (all areas including Assistant and Guide), pay-mapping run navigation moves to the inner sidebar while the model keeps its in-page chapter journey, and Verve-compact control density app-wide.

Grounding: the Verve pages were fetched and their DOM inspected directly (settings, account/profile, settings/team, attainment, quota-plan), so every measurement below comes from their actual markup, not from screenshots. Verve is built on the same Base UI shadcn generation we use (identical `data-slot` vocabulary: item, field, input-group, kbd, button-group), which makes the port near 1:1. ReUI's registry exposes the `Frame` component Verve builds every surface from (`https://reui.io/r/frame.json`, plain cva + CSS variables, no Radix dependency).

## 1. Application shell

The app adopts the shadcn sidebar `inset` pattern: a light gray frame with the icon rail on it, and the whole app content in a white rounded sheet.

- Wrapper: `SidebarProvider` with `bg-sidebar` showing through, `--header-height: 50px`, `--sidebar-width-inner: 240px` (the inner sidebar width; the assistant's conversations panel keeps 280px via a per-area override).
- Outer icon rail (on the gray, outside the sheet):
  - Top: the blueprnt mark, a `size-7 rounded-lg bg-primary` square with the white "b" glyph cropped out of the existing wordmark SVG in `components/logo.tsx` (tight viewBox around the b path; no new asset).
  - Middle: one icon per area (existing HugeIcons), 32px buttons, centered, tooltip with the area name, active state on the sidebar accent tokens.
  - Bottom: Guide (docs), Settings, then the user avatar opening the account menu (the account menu absorbs what the old sidebar footer carried beyond docs/search, e.g. language).
  - The rail is fixed on desktop: no expand/collapse, no SidebarTrigger. Below `md` the shadcn sheet shows the full nav, area rows plus the active area's sub-rows (Verve's mobile pattern).
- White sheet (`SidebarInset`): `m-2 ml-0 rounded-xl border shadow-sm` on the gray ground. Header, inner sidebar, and content all live inside it.
- Top bar (inside the sheet, 50px, sticky, border-b), three zones:
  - Left: the organization switcher (today's `org-switch-menu`, restyled as a compact dropdown trigger like Verve's workspace crumb). On mobile the sheet trigger sits before it.
  - Center (absolutely centered): the search trigger styled as an input group, about `w-80`, magnifier + "Search..." + `⌘K` kbd, opening the existing command palette. `nav-search.tsx` retires.
  - Right: a "Create" dropdown (new role, new person, import, the same actions the palette exposes). Nothing else lands here in V1.

## 2. Inner sidebar

One shell-level component; the existing `InnerSidebar` (assistant, docs) is rebuilt into it, keeping the Motion spring geometry and the animation-doc rules it already encodes.

- Anatomy (Verve's): `--sidebar-width-inner` wide, `border-r` as the seam against the content, ScrollArea for overflow, group label `text-[11px] font-medium uppercase text-foreground/70 px-3 pt-2 pb-1`, rows are ghost buttons `h-7 px-2.5 text-[0.8rem] gap-2.5` with `size-3.5` icons, active row `bg-accent font-medium text-accent-foreground`, optional footer slot pinned under a top border.
- Collapse: Verve's rail handle. A fixed 12x28px hit area at the sidebar's right border, vertically centered, drawing two 2x8px bars that rotate into a chevron on hover, with a tooltip (Collapse/Expand). Click toggles; collapsed means width 0 (no gap residue, per the existing InnerSidebar geometry split), and the handle remains at the sheet edge to expand again. State persists per user with the same cookie pattern as today's sidebar state. Keyboard reachable (focus ring, aria-label). Verve's drag-to-resize is deliberately dropped.
- Areas without an inner sidebar (Home, Model) render content directly; no empty gutter and no handle.

## 3. Information architecture (rail areas and their inner navs)

`lib/navigation.ts` and `lib/section-pages.ts` remain the single source of truth; the registry grows an area/inner-nav shape and every surface (rail, inner sidebar, mobile sheet, command palette) renders from it. Admin gating keeps working via `navGroupsFor`/`canSeeNavEntry`; a group whose rows are all gated away never renders.

| Rail (top to bottom) | Inner sidebar |
| --- | --- |
| Home `/` | none (the dashboard takes the width) |
| Assistant `/assistant` | the conversations panel (as today, on the new component) |
| Work `/work` + `/roles` | Overview, Roles |
| Model `/model` | none; the four-chapter journey with its progress spine stays in-page |
| People `/people` | People, Classify |
| Pay mappings `/pay-mappings` | list: none (open item 11); inside a run: see below |
| (bottom) Guide `/docs` | the docs nav (as today, on the new component) |
| (bottom) Settings | grouped: ORGANIZATION (General, Members), ACCOUNT (Profile, Security), Audit log; org rows admin-gated |
| (bottom) avatar | account menu (switch org, language, sign out) |

- Inside a pay-mapping run (`/pay-mappings/<slug>/...`) the inner sidebar carries: a back row ("All pay mappings"), the run switcher (today's `PayMappingRunIndicator` content), and the run's destinations (Overview, Analysis, Actions, Report). The analysis chapters keep their in-page guided journey below.
- Platform admin (`/admin/...`) becomes its own area for platform admins only: a rail icon visible to them, inner sidebar with Organizations, AI usage, Audit log, Email log.
- All header tab components retire: `SectionTabs`, `PeopleTabs`, `OrganizationTabs`, `AccountTabs`, `AdminTabs`, `PayMappingTabs`, `header-tab-link`, plus `SiteHeader`'s section-title logic. Deleted completely in the same change that replaces them (no legacy).

## 4. Page structure: breadcrumb row, width, titles

- Every page starts with a header row (`min-h-9`, flex, justify-between): breadcrumb left, page-level actions right (Export, Create role, and similar move up here from the old PageHeader action slot).
- Breadcrumb IS the title: "Home › Settings › Members" style, ancestors as muted links, the last segment `text-foreground`, an sr-only `h1` for assistive tech. Built on the existing `PageBreadcrumb`/breadcrumb vendor component; segments derive from the nav registry plus the page's own entity name (role title, family name, run name), so labels reuse the existing nav i18n keys.
- `PageHeader`, `PageHeading`, and `page-header-slot` retire completely. Page descriptions move into Frame headers. Every `HelpMorphButton` currently anchored to a page title re-anchors to the Frame title that names the same concept (the help-after-title rule holds; no orphaned icons).
- Width: content is `mx-auto w-full max-w-7xl` inside `p-4` padding (Verve's exact geometry: a `flex flex-1 flex-col overflow-y-auto p-4` pane with centered 7xl children, breadcrumb row and content column sharing the cap). Documented exceptions stay: pay-mapping analysis keeps the 85rem wide cap (centered), `/work` stays full-bleed with its height lock, `/model` stays uncapped (its columns divide whatever they get), `/assistant` keeps its height-locked row with the conversations panel flush left. `shellLayoutClasses` is rewritten around: inner-sidebar presence per area, centered caps, and these exceptions; its unit tests follow.

## 5. Frame: the card-in-card anatomy

`Frame` is vendored from the ReUI registry into `packages/ui` (vendor code, updated via the CLI like the rest). Its recipe, confirmed from the DOM:

- Outer: `bg-muted/50 border rounded-[var(--frame-radius)]` with `--frame-radius: var(--radius-xl)` and 3px (`spacing(0.75)`) padding and gap.
- Panel header (in the outer, above the panel): title `text-sm font-semibold`, description `text-sm text-muted-foreground`, `px-3 py-1.5`.
- Inner panel: `bg-card border shadow-xs` with radius `calc(var(--frame-radius) - var(--frame-px) - 1px)` so nested corners stay concentric; content padding via panel variables.
- Panel footer (in the outer, under the panel): actions right-aligned, cancel as outline first, primary last, `px-3 py-1.5`.
- Joined variant (`p-0 gap-0`, panels flush, used by dense data surfaces like Verve's attainment) comes along.

Settings surfaces rebuild on Frame + the already-vendored `Field` components: one field row per setting, `px-5 py-4`, label column (label `text-sm font-medium` + description `text-sm text-muted-foreground`, `max-w-sm`) and control column right-aligned (`max-w-[34rem]`, inputs full width within), `FieldSeparator` between rows, the save action in the frame footer. React-hook-form + Zod + the shadcn `Form` rules are unchanged (including the `isValid`/`isDirty` gates); only the row layout changes. Applies to `/organization/general`, `/account/profile`, `/account/security`, and the platform admin settings surfaces.

Dialogs keep the standard anatomy rule; density changes flow in via the shared components.

## 6. Tables

Register tables move inside a Frame (panel `p-0`) with Verve's anatomy; the TanStack layer (sorting, filtering, client pagination, `table-fixed` with header-declared widths, default sorts, skeleton rules with the shared PAGE_SIZE) is kept, presentation is replaced.

- Panel head row: title `text-2xl font-semibold tracking-tight` + count badge (`rounded-full border h-5 text-xs`) left; search (input group `h-7 w-72`), filter dropdown buttons (outline), and the section's primary action right; separator below.
- Table: header row `h-8`, sort buttons as ghost `h-6 px-2 font-normal text-secondary-foreground/80` with chevron, `aria-sort` on the `th`; cells `px-2 py-1.5 text-sm`; first/last cells inherit the panel's edge padding (`ps/pe-(--frame-panel-px)`); row hover `bg-muted/40`; borders only between rows.
- Pagination in the panel foot (`px-(--frame-panel-px) py-3`): "Rows per page [25]" select left; "1-25 of 132" + page numbers + prev/next right. `TablePagination` is rebuilt to this shape.
- Row actions keep our trailing `...` dropdown rule (Verve's hover-revealed inline buttons are not adopted).
- Applies to: people, roles, organization members, audit log, the pay-mappings list, and the platform admin tables. Grouped registers and chronological histories take the same frame look without per-column sorting, per the existing rule.

## 7. Density (Verve-compact) and vendor strategy

Chosen approach: edit our vendored shadcn components to Verve's measurements, and store every edit in `packages/ui/patches` so `bun run ui:update` replays them across future vendor updates. Each vendor edit is documented in the commit message per the vendor-code rule. Rejected alternatives: importing ReUI's whole theme preset (would clobber brand/chart/gender tokens), and per-call-site `size="sm"` (guaranteed drift).

**Deviation (2026-08-22, user-directed):** the density-patch strategy above was replaced mid-implementation by a real shadcn STYLE switch. Verve turned out to be shadcn's `base-nova` style (its compact controls are nova's `sm` size, matched byte-for-byte against the registry), so `packages/ui/components.json` now declares `"style": "base-nova"`, every registry component was re-vendored from nova, and the density patches (button, input, input-group, table) were deleted. The 8 remaining patches are functional-only deviations. Density therefore comes from the style itself; compact rows opt into `size="sm"` (e.g. `CHAPTER_ACTION_BUTTON_SIZE`). Nova is taken as-is rather than pixel-matched to Verve's own overlays (per direction: "behöver inte vara exakt samma som Verve").

**Deviation (2026-08-22):** section 4's retirement list said `page-header-slot` retires with PageHeader. The slot mechanism survived, renamed to `page-breadcrumb-slots.tsx` (`BreadcrumbSlotProvider`/`BreadcrumbAdornmentSlot`/`BreadcrumbAsideSlot`/`BreadcrumbAdornment`/`BreadcrumbAside`): the kartläggning still needs to fill the breadcrumb row's adornment/aside from two layouts below, and the breadcrumb row now plays the role the PageHeader played as the slots' render target.

The target measurements, from Verve's DOM:

- Button: default `h-7 gap-1 px-2.5 text-[0.8rem]`, radius `min(var(--radius-md), 12px)`, icons `size-3.5`; icon button `size-7`; the existing `xs`/`sm` steps re-tune around the new default.
- Input: `h-8 rounded-lg px-2.5 md:text-sm`; input-group `h-7` wrapper with `h-8` control inside.
- Select trigger: default `h-8`, sm `h-7`.
- Badge: `h-5 min-w-5 px-1.25 py-0.5 text-xs rounded-sm`, plus soft status variants (`border-success/15 bg-success/10 text-success-foreground` shape) mapped onto our existing status color tokens; the plan verifies which success/warning/destructive tokens exist before adding any.
- Switch: default 32x18.4px with 16px thumb, sm 24x14.
- Table cells and header heights as in section 6.
- Header height 50px, page padding `p-4`, section gap `gap-5`.
- Running text stays floored at `text-sm` everywhere (the readability rule is untouched; 0.8rem appears only on control labels and nav rows, which are scanned, not read).

Colors and type: the rose brand primary stays on CTAs/links/judgement values (Verve's black primary is not copied); titles stay in regular ink; Source Sans 3 + Hedvig Letters Serif stay. Sidebar/muted/border tokens are already close to Verve's neutral scale and are not changed in this refactor.

## 8. Untouched

Morph family (Help/Confirm/Popover and placement math), the entire chart ruleset and gender/role encodings, toasts, form validation rules, the onboarding wizard (its own full-screen shell), the rating flow, docs content, `/work`'s full-bleed matrix, the AI assistant's behavior. Home dashboard widget cards keep their current anatomy in this refactor (they only inherit density and centering); converting widgets to the frame look is a separate later decision.

## 9. Stages (each one reviewable on the branch)

1. Density + Frame: vendor edits with patches, Frame vendored in. Visual density changes, layout unchanged.
2. Shell: rail, white sheet, top bar (org switcher, search, Create), inner sidebar framework, breadcrumb row, centered 7xl; header tabs replaced area by area; assistant/docs migrate onto the new inner sidebar.
3. Settings surfaces to Frames (organization, account, platform admin).
4. Register tables to frame tables.
5. Pay-mapping run inner sidebar + cleanup: retire PageHeader/tab components, remove dead i18n keys, add new keys in all five locales (production quality, cross-locale QA pass), rewrite affected tests, update memory notes (layout direction, chart/table conventions unchanged).

## 10. Testing and i18n implications

- `shellLayoutClasses` tests rewritten; `app-shell`, `site-header` (replaced), `inner-sidebar`, `table-pagination`, `page-breadcrumb` tests follow their components. New tests: frame nesting radius/slots smoke test, rail active-state mapping, inner-sidebar collapse persistence, breadcrumb derivation from the nav registry.
- Skeleton rules re-verified after density changes (skeleton rows must still measure identical to data rows at the new heights).
- New i18n keys: collapse/expand labels, Create menu items, settings group labels, breadcrumb "Home", search placeholder. Removed keys cleaned everywhere; the parity test guards.
- Every stage ends with `bun run test` green and a zero-warning Biome pass; vendor files stay out of Biome as today.

## 11. Open items the implementation plan must resolve

- Whether our tokens already include `success`/`warning` shades for soft badges, or which existing tokens map to them.
- The exact Create-menu contents and which existing mutations/flows each entry opens.
- Breadcrumb derivation for entity pages (role, family, person, run) and which query supplies the display name early enough to avoid layout shift (skeleton bar for the last crumb).
- Mobile sheet composition details (area rows + active area's sub-rows).
- Where the pay-mappings LIST page lands (inner sidebar absent vs a one-row sidebar; default absent).
- `/model`'s cap under the new centered layout (stays uncapped initially; revisit after seeing it in the shell).
