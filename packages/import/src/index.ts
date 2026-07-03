export { CANONICAL_FIELDS, fold } from "./fields.js"
export type {
  CanonicalFieldKey,
  FieldTier,
  ValueShape,
  FieldDef,
} from "./fields.js"

export { tokenizeCsv } from "./tokenize.js"

export { classifyColumn } from "./shape.js"

export { detectColumns } from "./detect.js"
export type { DetectedMapping } from "./detect.js"

export {
  parseMoney,
  parseCurrency,
  parsePercent,
  parseGender,
  parseDate,
  parseBool,
  parseIntId,
} from "./parse.js"
