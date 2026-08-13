import Link from "next/link"
import { Streamdown, type StreamdownProps } from "streamdown"

// Word-fade tuned to the arrival rate, never slower (see the animated prop
// below for the arithmetic). sep "word" matches the server's word-sized
// chunks; duration is the softness, stagger is the drain rate.
const ASSISTANT_TEXT_FADE = {
  animation: "fadeIn",
  sep: "word",
  duration: 100,
  stagger: 10,
} satisfies StreamdownProps["animated"]

// Assistant answers are model-generated markdown, revealed word by word as
// the reply streams in (Streamdown's animated pass; see AssistantMessage for
// which message gets isAnimating). A link to one of the app's own pages
// (the assistant's system prompt only ever links its fixed page allowlist,
// starting with "/") navigates client-side via next/link; any other link
// opens in a new tab so the conversation is not lost. The typeset class
// carries the prose look (same stylesheet the shadcn chatbot template
// uses). typeset-docs (in globals.css) pins the size at 15px the
// template's way, so no separate text-sm override is needed here.
//
// Streamdown ships its own Tailwind utility classes for every prose tag
// (headings, lists, tables, code, links, ...). Mapping each one to its own
// tag NAME (rather than a component) tells hast-util-to-jsx-runtime to
// render the bare native element with none of Streamdown's classes, so
// typeset.css is the only thing styling the output, matching the previous
// react-markdown behaviour. `a` keeps our internal/external link split;
// every other entry here is a tag Streamdown would otherwise skin on its own
// (verified against the installed dist/index.d.ts and its default
// component map). GFM (tables, task lists, strikethrough) ships in
// Streamdown by default, so no remark-gfm plugin is needed.
const components = {
  p: "p",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  ul: "ul",
  ol: "ol",
  li: "li",
  hr: "hr",
  strong: "strong",
  table: "table",
  thead: "thead",
  tbody: "tbody",
  tr: "tr",
  th: "th",
  td: "td",
  blockquote: "blockquote",
  code: "code",
  // Model-authored image references are always hallucinations; charts render natively
  img: () => null,
  pre: "pre",
  sup: "sup",
  sub: "sub",
  section: "section",
  // An internal href is one of the assistant's own linked pages
  // (knowledge.ts's fixed allowlist): navigate through Link, in-app, with
  // no target/rel. Streamdown's rehype harden pass rewrites anything it
  // classifies as path-relative (including a protocol-relative "//host")
  // down to pathname+search+hash before this component sees it, but that
  // is an upstream implementation detail, not a contract: the predicate
  // must hold on its own, so it rejects "//" and "/\\" shapes that a
  // browser would resolve to another host. Harden also stamps every
  // link's props with target/rel of its own; they are destructured out so
  // the stamp never leaks onto the internal Link, and the external
  // branch's explicit values are the only ones that apply.
  a: ({ node: _node, href, target: _target, rel: _rel, ...props }) =>
    href !== undefined && isInternalHref(href) ? (
      <Link {...props} href={href} />
    ) : (
      <a {...props} href={href} target="_blank" rel="noreferrer" />
    ),
} satisfies StreamdownProps["components"]

// A single "/" followed by neither "/" nor "\": exactly a same-origin path.
// "//evil.com" is protocol-relative and "/\\evil.com" normalizes to it in
// browsers; both must take the external branch no matter what upstream
// sanitization did or did not run.
export function isInternalHref(href: string) {
  return /^\/(?![/\\])/.test(href)
}

export function AssistantMarkdown({
  text,
  isAnimating = false,
}: {
  text: string
  // Threaded from AssistantMessage: true only for the message currently
  // streaming (midday's pattern). Both this AND `animated` must be truthy
  // for Streamdown's per-word fade to run; a settled message renders static.
  isAnimating?: boolean
}) {
  return (
    // marker: is inheritable, so one class here colours every bullet and
    // ordered-list number in the reply; underline-offset lifts link
    // underscores clear of the descenders.
    <div className="typeset typeset-docs px-1.5 marker:text-brand [&_a]:underline-offset-4">
      <Streamdown
        // Streamdown's own wrapper div always carries a hardcoded
        // `space-y-4` regardless of `components`/`controls` (it is not a
        // per-tag override, so bare components cannot reach it). Verified
        // in a real browser render that this beats typeset's own
        // margin-block-start flow rhythm (Tailwind's utilities layer wins
        // over typeset's components-layer rules by cascade layer order,
        // not specificity). Replacing it with the same --typeset-flow
        // variable typeset itself uses keeps the two in sync instead of
        // hardcoding a second, driftable number.
        className="space-y-(--typeset-flow)"
        controls={false}
        // The fade must drain FASTER than words arrive or an invisible tail
        // accumulates: text arrives word-paced from the server in ~150ms
        // flushes of roughly 15 words, and Streamdown's defaults (150ms
        // fade, 40ms per-word stagger) drain one flush in ~750ms, so the
        // queue grew without bound and a list item whose text sat queued
        // showed as a bare marker for seconds (a ::marker pseudo-element
        // ignores text-span opacity). 10ms stagger drains a 15-word flush
        // in the same 150ms the next one takes to arrive; the short fade
        // keeps the word-by-word softness without ever falling behind.
        animated={ASSISTANT_TEXT_FADE}
        isAnimating={isAnimating}
        components={components}
      >
        {text}
      </Streamdown>
    </div>
  )
}
