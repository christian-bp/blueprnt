// The retrieval evaluation set, checked in so a chunker change, a
// CHUNKER_VERSION bump, or an embedding-model swap has something to measure
// against. Run with `bun run docs:eval` (opt-in: it costs embedding calls and
// needs a live deployment, so it is not part of the test suite).
//
// `expected` is the slug that should appear in the top results. Questions are
// phrased the way a user asks them, not the way the page is written: a probe
// that reuses the page's own wording measures nothing.

export interface DocsEvalProbe {
  query: string
  expected: string
}

export const DOCS_EVAL_PROBES: Record<string, DocsEvalProbe[]> = {
  en: [
    { query: "how do I erase an employee", expected: "erasing-a-person" },
    {
      query: "what happens to the pay mapping when someone is erased",
      expected: "erasing-a-person",
    },
    {
      query: "how many weight points can I distribute",
      expected: "weighting-and-point-budget",
    },
    { query: "where do I see the levels", expected: "levels-views" },
    {
      query: "how often must a pay mapping be done",
      expected: "what-is-pay-mapping",
    },
    { query: "what is an anchor role", expected: "anchor-roles" },
    { query: "how do I invite a colleague", expected: "invitations" },
    {
      query: "which payroll files can I import",
      expected: "supported-payroll-exports",
    },
    {
      query: "how do I set up two-factor login",
      expected: "two-factor-authentication",
    },
    {
      query: "what is the difference between level and seniority",
      expected: "key-concepts",
    },
    { query: "how do I rate a role", expected: "evaluating-a-role" },
    { query: "where do I document actions", expected: "actions-and-notes" },
    {
      query: "I get the error weightsUnbalanced",
      expected: "troubleshooting-model-and-evaluation",
    },
  ],
  sv: [
    { query: "hur raderar jag en anställd", expected: "erasing-a-person" },
    {
      query: "vad händer med lönekartläggningen vid radering",
      expected: "erasing-a-person",
    },
    {
      query: "hur många viktpoäng får jag fördela",
      expected: "weighting-and-point-budget",
    },
    { query: "var ser jag nivåerna", expected: "levels-views" },
    {
      query: "hur ofta ska lönekartläggning göras",
      expected: "what-is-pay-mapping",
    },
    { query: "vad är en ankarroll", expected: "anchor-roles" },
    { query: "hur bjuder jag in en kollega", expected: "invitations" },
    {
      query: "vilka lönefiler kan jag importera",
      expected: "supported-payroll-exports",
    },
    {
      query: "hur sätter jag tvåfaktorsinloggning",
      expected: "two-factor-authentication",
    },
    {
      query: "vad är skillnaden mellan nivå och senioritet",
      expected: "key-concepts",
    },
    { query: "hur betygsätter jag en roll", expected: "evaluating-a-role" },
    { query: "var dokumenterar jag åtgärder", expected: "actions-and-notes" },
    {
      query: "jag får felet weightsUnbalanced",
      expected: "troubleshooting-model-and-evaluation",
    },
  ],
}

// Questions the documentation genuinely does not answer. A retrieval layer
// with a working relevance floor returns NOTHING for these; without one it
// hands the model five confident-looking excerpts carrying real deep links,
// under a prompt that tells it to prefer them.
export const DOCS_EVAL_OFFTOPIC: Record<string, string[]> = {
  en: [
    "what is the weather in Stockholm tomorrow",
    "can I book a conference trip in the system",
    "how do I write an employment contract",
    "which pizza is the most popular in Sweden",
  ],
  sv: [
    "vad är vädret i Stockholm imorgon",
    "kan jag boka en konferensresa i systemet",
    "hur skriver jag ett anställningsavtal",
    "vilken pizza är populärast i Sverige",
  ],
}
