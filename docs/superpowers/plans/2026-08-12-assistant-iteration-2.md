# Blueprnt AI Iteration 2: Flow, Titles, History, Hero

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. This iteration builds on the completed assistant feature (plan: `2026-08-12-assistant-chatbot.md`); its Global Constraints apply verbatim and are not repeated here.

**Goal:** Four user-directed improvements: smooth midday-like reply flow, fresh conversations from the overview prompt, AI-generated conversation titles with an animated header and a browsable history, and a midday-inspired centered overview hero.

**Research basis:** midday internals and streamdown@2.5.0 verified against source (session research 2026-08-12); key facts inlined per task.

## Decisions

- **Streamdown 2.5.0** replaces react-markdown in `assistant-markdown.tsx`: standalone (React-only peers), `animated` + `isAnimating` per-word fadeIn (150ms/40ms stagger defaults) with OFFSET-based newness detection, so multi-word Convex flushes stagger into a flowing reveal; `remend`-based incomplete-markdown repair. Our typeset look is preserved by overriding `components` with bare elements (Streamdown's per-tag utility classes never render), `controls` disabled. `import "streamdown/styles.css"` plus a `prefers-reduced-motion` override (`[data-sd-animate] { animation: none }`) added app-side; the Tailwind `@source` line added defensively. Flush cadence tightens to 150ms (`ASSISTANT_FLUSH_INTERVAL_MS`). react-markdown + remark-gfm are removed (no-legacy rule).
- **Titles**: generated once per thread (first user turn), in the generation action, in parallel with the main stream (fire before `streamText`, await after finalize; failure is non-critical and never breaks the reply). Model: `AI_PROFILE_MODEL_ID` (small). Prompt: concise 3-5 word title in the thread's locale, never a person name. Usage recorded with new kind `assistant.title`. Stored on `assistantThreads.title` (optional string); reactivity delivers it to the client, no stream part needed.
- **History**: `listThreads` (org+user, desc lastMessageAt, take 50, titles + status) and `switchConversation` (ownership-checked; archives current active, re-activates the selected thread). UI: history icon button opening a `DropdownMenu` (house row-action pattern) in the chat header row; untitled threads show a localized fallback with their date; switching disabled while streaming (same orphan guard as New conversation).
- **Fresh-from-overview**: `sendMessage` gains `fresh: v.optional(v.boolean())`; when true it archives the active thread before creating the new one, atomically in the same mutation. The overview prompt always sends `fresh: true`.
- **Header row** (chat page): `justify-between` with the history trigger left, the animated title centered (midday's exact treatment: AnimatePresence + width 0-to-auto + opacity, 300ms, cubic-bezier(0.25,0.1,0.25,1), truncated max-w-[300px]), New conversation right. Motion via `motion/react`, honoring the global MotionConfig.
- **Overview hero**: the block from greeting through the chat box becomes a viewport-centered hero (midday: `flex flex-col justify-center min-h-[calc(100vh-<chrome>)]`, greeting block `items-center text-center`); greeting stays our `WelcomeGreeting` (house typography, centered variant); beneath it ONE status line: todo.total > 0 renders a localized "you have N things to do" sentence linking to the todo section, else the all-caught-up line (midday's single-insight branch, no ticker); then `AssistantPrompt`. Existing overview content (TodoActions, OverviewWidgets, OverviewCharts) renders below the hero unchanged.

## Tasks

### Task 21: backend (titles, history, fresh flag, cadence)
Files: `convex/assistant/tables.ts` (title field), `chat.ts` (fresh flag in sendMessage; listThreads; switchConversation; getActiveThread returns title), `generate.ts` (title pipeline parallel to the stream; clears nothing on failure), new `convex/assistant/title.ts` if separation is cleaner, `ai/config.ts` (`ASSISTANT_FLUSH_INTERVAL_MS` 250 to 150; `ASSISTANT_TITLE_MAX_WORDS` if needed), `ai/usage`/pricing untouched (small model already priced). Tests: fresh-flag archival, listThreads scoping/order, switchConversation ownership + busy interplay, title persistence via a stubbed internal mutation test (action body remains browser-verified), context exclusion unchanged.

### Task 22: streamdown adoption
Files: `apps/dashboard/package.json` (+streamdown, -react-markdown -remark-gfm), `assistant-markdown.tsx` (Streamdown with components override preserving typeset, animated + isAnimating prop threaded from message streaming state), `assistant-message.tsx` (passes isAnimating for the last streaming message only, midday-style), `packages/ui/src/styles/globals.css` (styles import, @source line, reduced-motion override; documented addition), tests updated (animation spans are markup noise; assert content, not spans).

### Task 23: chat header (animated title + history)
Files: `app/(app)/assistant/page.tsx` (header row restructure), new `components/assistant/assistant-title.tsx` (midday animation exactly), new `components/assistant/assistant-history.tsx` (DropdownMenu + switchConversation wiring), `use-assistant-chat.ts` (expose title + threads), i18n keys (history label, untitled fallback) all five locales. Tests: title animates in when present (presence assertions), history lists and switches, busy disables switching.

### Task 24: overview hero
Files: `app/(app)/page.tsx` (hero restructure), `components/overview/welcome-greeting.tsx` (centered variant without breaking existing tests, or a wrapper), new status-line component reading the existing todo hook (no new queries), i18n keys (todoSummary with ICU count + link text, allCaughtUp) all five locales. Existing sections below unchanged; page invariant tests must keep passing. Tests: status line branches (todo vs caught up), hero renders prompt, below-fold sections intact.

### Task 25: verification addendum
Browser pass items: reply flow feels continuous (word stagger over flush chunks); title appears animated after the first reply and survives reload; history switch round-trip; fresh-from-overview archives; hero centered with correct status line both branches; reduced-motion disables the word fade.
