export {
  COUNTRY_KEYS,
  type CountryKey,
  CURRENCY_BY_COUNTRY,
  CURRENCY_KEYS,
  type CurrencyKey,
  LANGUAGE_BY_COUNTRY,
  clampCountry,
  countryForLanguage,
  defaultCurrencyFor,
  defaultLanguageFor,
} from "./countries"
export { EMAIL_TEMPLATE_KEYS, type EmailTemplateKey } from "./email"
export { INDUSTRY_KEYS, type IndustryKey, clampIndustry } from "./industries"
export { SLUG_PATTERN, isValidSlug } from "./slug"
export {
  MAX_STARTER_IMPORT_TEXT,
  SUGGESTION_KINDS,
  type SuggestionKind,
} from "./suggestions"
