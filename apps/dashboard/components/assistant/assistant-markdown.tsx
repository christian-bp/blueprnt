import { Streamdown, type StreamdownProps } from "streamdown"

// Assistant answers are model-generated markdown, revealed word by word as
// the reply streams in (Streamdown's animated pass; see AssistantMessage for
// which message gets isAnimating). Links open in a new tab so the
// conversation is not lost, and the typeset class carries the prose look
// (same stylesheet the shadcn chatbot template uses). typeset-docs (in
// globals.css) pins the size at 15px the template's way, so no separate
// text-sm override is needed here.
//
// Streamdown ships its own Tailwind utility classes for every prose tag
// (headings, lists, tables, code, links, ...). Mapping each one to its own
// tag NAME (rather than a component) tells hast-util-to-jsx-runtime to
// render the bare native element with none of Streamdown's classes, so
// typeset.css is the only thing styling the output, matching the previous
// react-markdown behaviour. `a` keeps our external-link treatment; every
// other entry here is a tag Streamdown would otherwise skin on its own
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
  img: "img",
  pre: "pre",
  sup: "sup",
  sub: "sub",
  section: "section",
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer" />
  ),
} satisfies StreamdownProps["components"]

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
    <div className="typeset typeset-docs px-1.5">
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
        animated={true}
        isAnimating={isAnimating}
        components={components}
      >
        {text}
      </Streamdown>
    </div>
  )
}
