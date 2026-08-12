import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Assistant answers are model-generated markdown: links open in a new tab so
// the conversation is not lost, and the typeset class carries the prose look
// (same stylesheet the shadcn chatbot template uses). typeset-docs (in
// globals.css) pins the size at 15px the template's way, so no separate
// text-sm override is needed here. Plain <a> is correct: assistant links are
// external or model-written, never internal navigation we control.
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="typeset typeset-docs px-1.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
