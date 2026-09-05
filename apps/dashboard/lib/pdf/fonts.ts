import { Font } from "@react-pdf/renderer"
import {
  IBM_PLEX_MONO_400,
  INSTRUMENT_SANS_400,
  INSTRUMENT_SANS_500,
} from "./font-data"

// The kit's own typefaces, registered once for every document that imports
// the branded page (which is all of them). Bundled as data URIs rather than
// loaded from a font CDN: a report is generated in the reader's browser, and
// a cover whose title silently falls back to Helvetica when a network call
// fails is worse than one that is always the same.
//
// Register at module scope, like the hyphenation callback beside it:
// @react-pdf/font resolves a source lazily at layout time, so this costs
// nothing until a document is actually rendered.
export const SANS = "Instrument Sans"
export const MONO = "IBM Plex Mono"

Font.register({
  family: SANS,
  fonts: [
    { src: INSTRUMENT_SANS_400, fontWeight: 400 },
    { src: INSTRUMENT_SANS_500, fontWeight: 500 },
  ],
})

Font.register({
  family: MONO,
  fonts: [{ src: IBM_PLEX_MONO_400, fontWeight: 400 }],
})
