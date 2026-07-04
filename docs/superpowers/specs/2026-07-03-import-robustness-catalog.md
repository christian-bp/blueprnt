# Import robustness catalog: @workspace/import CSV salary-import engine

**Date:** 2026-07-03

**Purpose.** This document catalogs the real-world robustness of the `packages/import` CSV salary-import engine, based on ten discovery probes that ran the actual code against inputs drawn from the payroll and HR systems we target (Visma Lon, Hogia Lon, Fortnox Lon, Agda PS, Personec/CGI, SD Worx, SAP SuccessFactors, Workday) across the four Nordic locales plus English. Each scenario records what the code did, what it should do, a verdict (correct / bug / unsupported / ambiguous / upstream), a severity, and a recommendation. The goal is a single prioritized picture of where the engine silently drops or mangles real files, the product decisions a human must make, and a concrete test plan so that every discovered scenario is locked or fixed with a test.

## Executive summary

**Counts by verdict** (across all dimensions, after cross-dimension dedup):

| Verdict | Count |
| --- | --- |
| correct | 64 |
| bug | 63 |
| unsupported | 27 |
| ambiguous | 12 |
| upstream | 4 |

**Counts by severity:**

| Severity | Count |
| --- | --- |
| critical | 27 |
| high | 39 |
| medium | 26 |
| low | 78 |

**The biggest robustness risks:**

- **Comma-decimal money and percent are the single highest-impact gap.** `parseMoney` and `parsePercent` (and their shape detectors `isMoney` / `isPercent`) reject the dominant Nordic number format ("52 000,50", "87,5", "0,8"). Visma Lon, Hogia Lon, Fortnox, Agda, and any Excel sv-SE / fi-FI / nb-NO export with fractional values is silently classified as text and becomes unimportable. This one fix unblocks the majority of real Swedish, Finnish, and Norwegian files.
- **Norwegian and Danish are effectively unsupported because `fold()` destroys the `o-slash` and `ae` letters.** They have no NFD base+combining decomposition, so the `[^a-z0-9]` strip removes them entirely: "Kjonn" folds to "kjnn" and "Grunnlonn" to "grunnlnn", never matching the synonyms that are already in the list. The knock-on effect is a critical field misassignment (gender to firstName). A one-line pre-NFD substitution (`o-slash -> o`, `ae -> ae`) unblocks two of four in-scope locales. The parser side (`parseGender` / `parseBool`) is missing nb/da/fi words entirely.
- **The `lon` synonym for `basicMonthly` is a substring landmine.** It fires inside "Henkilonro" (Finnish person-number) and "grundlonar", producing critical field swaps that make whole Finnish exports unusable (person-number mapped to salary, base-salary mapped to externalRef). Removing bare `lon` and relying on the specific compounds is a targeted fix.
- **The shape-only fallback at confidence 0.4 pollutes mappings with false positives.** Text/id/percent shapes match almost any column, so blank headers, postal codes, cost-account columns, and pay-band columns are silently assigned to real canonical fields instead of landing in `unmappedColumns`. This hides genuine unmapped columns from the user and, combined with the postal-code-as-money misclassification, mislabels address data as salary.
- **Binary spreadsheet input (XLSX / XLS / ODS) fails silently.** The engine tokenizes the binary as garbage and the pipeline reports a generic "missing columns" blocking error with no signal that the file was the wrong format. Users get no actionable message. A binary-signature guard that raises a typed format error is cheap and high-value.

Secondary but material: dates are ISO-8601-only (every DD.MM.YYYY, DD/MM/YYYY, YYYYMMDD, personnummer-prefix, and Excel-serial column is dropped); leading-zero and personnummer identifiers are corrupted or unrecognized by `parseIntId`; and numeric gender codes (SCB/SAP 1/2) plus 1/0 and Y/N booleans are unrecognized.

**Note on the deduplication.** Comma-decimal money, NBSP/thin-space grouping, and the Nordic gender/fold gaps were each probed from more than one dimension. The clearest single entry is kept in its home dimension and the duplicates are noted as cross-refs rather than repeated as separate rows. Cross-refs use the scenario ids from the source dimensions.

---

## Tokenizer / file structure (tokenizeCsv)

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| T08 Mixed endings, CRLF header then LF data | `name,salary\r\nAlice,50000\nBob,60000` | 1 data row; LF folded into cell values | 3 clean rows | bug | high | Normalise all `\r\n` then lone `\r` to `\n` before papaparse (or pass `newline` explicitly). |
| T09 Mixed endings, LF header then CRLF data | `name,salary\nAlice,50000\r\nBob,60000` | trailing `\r` left inside `50000\r` | 3 clean rows, no `\r` | bug | high | Same normalisation as T08. |
| T12 Excel `sep=;` directive line | `sep=;\nNamn;Lon;...` | headers become `["sep=",""]`; real headers become data row 1 | strip `sep=` line, apply declared delimiter | bug | high | Detect and consume a leading `sep=<char>` line, pass the declared delimiter to papaparse. |
| T13 / T14 `sep=,` and `sep=TAB` variants | `sep=,\nname,salary,...` | same misparse as T12 | strip and use declared delimiter | bug | medium | Same fix as T12. |
| T39 BOM + `sep=;` together | BOM then `sep=;\nNamn;Lon;...` | BOM stripped but `sep=` still misparsed | strip both | bug | high | After BOM strip, also consume `sep=<char>`. |
| T40 `sep=` delimiter disagrees with data | `sep=\|\nname,salary,...` | `sep=\|` single-cell header; papaparse auto-detects commas | strip `sep=` line, fall back to auto-detect | bug | low | Part of T12 fix; if declared delimiter absent from data, auto-detect. |
| T15 Preamble title row | `Lonerapport 2024 Q1\nNamn,Lon,...` | title row promoted to header | detect preamble, re-index | unsupported | high | Add optional `skipRows`, or preamble heuristic in detect (single-cell header vs multi-cell rows). |
| T16 Visma multi-line metadata preamble | `Foretag: Acme AB\nPeriod: 2024-03\nNamn;...` | 2 metadata rows + real header all treated as data | skip preamble | unsupported | high | Scan from top; first row whose cell count matches the mode of following rows is the header. |
| T34 Hash-comment first row | `# Generated by Visma Lon\nNamn,...` | comment row promoted to header | strip comment row | unsupported | medium | Strip leading `#` rows, or fold into preamble heuristic. |
| T17 Units/annotation row under header | `name,salary\n(text),(SEK/year)\nAlice,50000` | units row silently kept as data row 1 | strip or warn | unsupported | medium | Inspect row 1 for bracket/label strings in numeric columns; warn or offer skip. |
| T18 Trailing empty column | `name,salary,dept,\nAlice,...,` | empty `""` header + empty trailing cells kept | strip trailing all-empty column | unsupported | medium | Strip trailing columns where header is `""` and all cells empty. |
| T19 / T20 Ragged rows (short / long) | `id,name,salary,dept\n1,Alice` | short/long rows kept unpadded | pad to header width, record ragged rows | unsupported | medium/low | Normalise each row to header length; record raggedness for validate warnings. |
| T21 Duplicate header names | `name,salary,salary,dept` | duplicates silently kept | dedup or warn | unsupported | medium | Suffix duplicates (`salary_2`) or surface a warning. |
| T22 Blank header cell mid-row | `name,,salary,dept` | `""` header kept | flag blank header | unsupported | low | Flag blank headers; they always land in unmappedColumns. |
| T23 Whitespace-padded headers | `  name  ,  salary  ` | headers NOT trimmed | trim header cells | bug | high | Trim header cells in tokenize; synonym matching uses exact folded compare so padding breaks it. See DC note: fold strips spaces, so impact is on displayed header + edge matching. |
| T35 Null bytes in values | `Alice\0,50000` | null byte preserved | strip or warn | unsupported | low | Strip null bytes post-tokenise. |
| T38 Space-only pseudo-CSV | `employee salary department\n...` | whole file one column, no error | warn: no delimiter | unsupported | low | If headers.length === 1 and all rows single-cell, warn. |
| T25 Double UTF-8 BOM | BOM BOM `name,salary` | both stripped (papaparse absorbs 2nd) | both stripped | correct | low | Works but fragile; consider explicit strip-all-leading-FEFF. |
| T26 UTF-16 BOM as Latin-1 string | `\xFF\xFEname,salary` | `ÿþname` mojibake prefix | caller decodes correctly | upstream | medium | Caller owns decoding; document. See ENC-02/ENC-03. |
| T01-T07, T10-T11, T24, T27-T33, T36-T37 | commas, semicolons, tabs, pipes, quoted delimiters/newlines, doubled quotes, pure CRLF, lone CR, UTF-8 BOM, sv comma-decimal in values, blank/whitespace rows, empty/header-only/single-column, quoted headers, Nordic chars | all correct | same | correct | low | No action. Baselines are robust. |

Cross-ref: T24 (UTF-8 BOM) = ENC-01; T27/T28 (semicolon + comma-in-value) overlap ENC-20.

## Money values (parseMoney and isMoney)

Design note: `parseMoney` is intentionally integer-only per the current spec ("no signs", whole numbers). Every "bug" here that asks for decimals is really a spec-expansion request. See the decision on expansion.

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| M10 Dot-thousands (nb/da/de) | `52.000` | null; column shape text | 52000 | bug | critical | Match `^\d{1,3}(\.\d{3})+$` as grouped integer; strip dots. Add isMoney support. |
| M11 Dot-thousands + comma-decimal | `52.000,50` | null | 52000.50 | bug | critical | Locale-aware normaliser: dot/space = thousands, comma = decimal. |
| M13 Comma-decimal, no grouping | `52000,50` | null | 52000.50 | bug | critical | One comma, no dots, rest digits/spaces: comma is decimal. |
| M14 Space-thousands + comma-decimal | `52 000,50` | null; column shape text | 52000.50 | bug | critical | Strip space groups, then handle trailing comma-decimal. |
| M15 NBSP-thousands + comma-decimal | `52 000,50` (NBSP) | null | 52000.50 | bug | critical | Same as M14 (`\s+` covers NBSP). Most common sv-SE Excel salary format. |
| M16 Comma zero-cents | `52000,00` | null | 52000 | bug | high | Covered by comma-decimal support. |
| M17 Dot-decimal, no grouping | `52000.50` | null; shape text | 52000.50 | bug | high | Single dot in digit string is a decimal point: `^\d+\.\d{1,2}$`. |
| M18 Dot-decimal `.00` | `52000.00` | null | 52000 | bug | high | Same as M17. |
| M19 Space-thousands + dot-decimal | `52 000.50` | null; **isMoney true** (detector/parser mismatch) | 52000.50 | bug | high | Parser must handle dot-decimal after stripping space groups. |
| M33 kr suffix + comma-decimal | `45 250,75 kr` | null | 45250.75 | bug | high | After stripping currency word, apply comma-decimal normalise. |
| M40 Euro symbol suffix | `52000 €` | null (regex only `[a-z]+$`) | 52000 | bug | medium | Extend currency strip to non-ASCII symbols. |
| M41 Run-on currency suffix | `52000kr` | null; **isMoney true** (mismatch) | 52000 | bug | low | Change parser `\s+` to `\s*` to match detector. |
| M43 Large space+dot-decimal+EUR | `1 234 567.00 EUR` | null; **isMoney true** (mismatch) | 1234567.00 | bug | high | Allow optional dot-decimal after suffix + space strip. |
| M01 / M44 Plain integer salary column | `52000` / `["45250","52000",...]` | parses to 52000 but classified `id` | shape `money` when header is salary synonym | bug | high | Header-context boost: upgrade `id` to `money` when header matches salary; or accept bare int > 9999. See D5/B3-bareint. |
| M20 en-US comma-thousands | `52,000` | null | 52000 (in column context) | unsupported | medium | Column heuristic: all match `^\d{1,3}(,\d{3})+(\.\d+)?$` -> comma is thousands. |
| M21 en-US large comma+dot | `1,234,567.00` | null | 1234567.00 | unsupported | medium | Detect en-US pattern, strip commas, parse float. |
| M23 Swiss apostrophe grouping | `52'000` | null | 52000 | unsupported | low | Low priority for Nordic-first; add apostrophe to separators. |
| M24 Negative sign | `-500` | null | -500 | unsupported | medium | Optional leading minus (correction/deduction rows). |
| M25 Parentheses-negative | `(500)` | null | -500 | unsupported | medium | Detect `^\(\d+\)$`, negate. |
| M35 Currency word prefix | `SEK 52000` | null | 52000 | unsupported | medium | Strip known currency word at start before parse. See P3. |
| M02 Zero single-cell | `0` | 0; isMoney false (percent) | ambiguous in isolation | ambiguous | low | No action for single cell; diluted in a real column. |
| M05-M07 Space / NBSP / narrow-space grouped integers | `52 000` variants | 52000; isMoney true | same | correct | low | No action. NBSP + U+202F handled by `\s+`. Cross-ref ENC-08/ENC-09. |

## Percent / FTE (parsePercent and isPercent)

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| pp-07 Fraction 0.8 | `0.8` | 0.8 (treated as 0.8%) | 80 or null+warning | bug | critical | Column-level fraction heuristic: if all non-blank <= 1.0, multiply by 100; at minimum blocking warning. |
| pp-08 Fraction 1.0 | `1.0` | 1 | 100 | bug | critical | Same fraction heuristic. |
| pp-09 Fraction 0.375 | `0.375` | 0.375 | 37.5 | bug | critical | Covered by pp-07 fix. |
| pp-10 / pp-11 Comma-decimal fraction | `0,8` / `1,0` | null | 80 / 100 | bug | critical | Two-step: comma-to-dot, then fraction detection. |
| pp-15 Fraction column | `["1.0","0.8","0.5",...]` | shape text conf 0 | shape percent + fraction flag | bug | critical | Fraction sub-case in percent detection; normalise x100. |
| pp-16 Comma-decimal fraction column | `["1,0","0,8","0,5",...]` | shape text conf 0 | shape percent | bug | critical | Extend isPercent + parsePercent for comma-decimal. |
| pp-24 Mixed integer+fraction | `["1","0.8","0.5","0.75"]` | shape text conf 0.25 | shape percent | bug | high | Fraction detection must cover pure integers in [0,1]. |
| pp-04 / pp-05 / pp-06 Comma-decimal percent | `87,5` / `100,00` / `87,5%` | null | 87.5 / 100 / 87.5 | bug | high | Comma-to-dot when `^\d{1,3},\d{1,2}%?$`; strip `%` first. |
| pp-14 Decimal-percent column | `["87.5","62.5",...]` | shape text conf 0 | shape percent conf 1 | bug | high | Extend isPercent to `^(\d{1,3}(\.\d+)?)\s*%?$`, validate [0,100]. |
| pp-13 Space-before-% column | `["80 %","100 %",...]` | shape text conf 0 | shape percent conf 1 | bug | medium | Extend isPercent to allow `\s*%?`; parsePercent already accepts it (mismatch). |
| pp-18 / pp-19 Text Heltid / Deltid | `Heltid` / `Deltid` | null | 100 / null+warning | unsupported | medium | Text-synonym lookup for heltid=100; deltid ambiguous -> warn. |
| pp-20 Text-prefixed number | `deltid 50%` | null | 50 | unsupported | low | Fallback regex to extract number+% from text in percent columns. |
| pp-17 / pp-23 Over-100 overtime | `110` / `["110","120",...]` | null / shape id | decide: null or 110 | ambiguous | low | Decide if FTE > 100 is supported; header should override shape. |
| pp-12 Dot-decimal percent value | `87.5` | 87.5 (parser correct) | 87.5 | correct | low | Parser correct; detector gap tracked in pp-14. |
| pp-01/02/03/21/22/25 Baselines | `80`, `100%`, `80 %`, blank, `-10`, year column | all correct | same | correct | low | No action. |

## Dates (parseDate and isDate)

Design note: `parseDate` is intentionally ISO-8601-only today. All "unsupported" rows below are spec-expansion requests; the DD/MM vs MM/DD ambiguity is a genuine product decision.

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| date-02 DD/MM/YYYY slash | `15/01/2023` | null | 2023-01-15 (Nordic DD/MM) | unsupported | critical | Add slash parsing; prefer DD/MM for sv/nb/da/fi; flag ambiguous when day <= 12. |
| date-05 DD.MM.YYYY dot | `15.01.2023` | null | 2023-01-15 | unsupported | critical | Dominant nb/da/fi export format. Add dot parsing. Cross-ref B3-dotdate (bug verdict). |
| date-08 Compact YYYYMMDD column | `["20230115",...]` | shape id | shape date | bug | critical | Add compact YYYYMMDD to isDate. |
| date-09 DD/MM/YYYY column | `["15/01/2023",...]` | shape text | shape date | bug | critical | Extend isDate for slash formats. |
| date-10 DD.MM.YYYY column | `["15.01.2023",...]` | shape text | shape date | bug | critical | Extend isDate for dot format. |
| date-03 MM/DD/YYYY (US) | `01/15/2023` | null | 2023-01-15 | unsupported | high | Disambiguate by day > 12. |
| date-04 Ambiguous slash | `01/06/2023` | null | 2023-06-01 (Nordic) + ambiguity warning | unsupported | high | Parse DD/MM for Nordic; warn when day <= 12. |
| date-06 Dot without leading zeros | `5.1.2023` | null | 2023-01-05 | unsupported | high | Variable-width D.M.YYYY. |
| date-07 Compact YYYYMMDD | `20230115` | null | 2023-01-15 | unsupported | high | Parse 8-digit YYYYMMDD; guard vs large salaries. |
| date-11 Datetime with time | `2023-01-15 00:00:00` | null | 2023-01-15 | unsupported | high | Strip trailing time before regex. |
| date-13 Datetime column | `["2023-01-15 00:00:00",...]` | shape text | shape date | bug | high | isDate: YYYY-MM-DD with optional time suffix. |
| date-14 Personnummer full | `19850612-1234` | null | 1985-06-12 | unsupported | high | Extract date prefix; strip suffix. Cross-ref id-03. |
| date-18 Excel serial | `44927` | null | 2023-01-15 | unsupported | high | Detect ~40000-60000 serial in date-headed column; Excel epoch 1899-12-30. |
| date-19 Excel serial column | `["44927",...]` | shape id | shape date | bug | high | Serial detector with date-synonym header. |
| date-12 ISO datetime T | `2023-01-15T00:00:00` | null | 2023-01-15 | unsupported | medium | Strip T-separated time. |
| date-15 Short personnummer | `850612-1234` | null | 1985-06-12 | unsupported | medium | Century expansion; needs reference year. |
| date-16 / date-17 Birth-year only | `1985` / `["1985",...]` | null / shape id | year shape -> birthDate candidate | ambiguous/unsupported | medium | Add a `year` shape for 4-digit ints in [1900,current]. |
| date-20 Two-digit year | `23-01-15` | null | 2023-01-15 | unsupported | medium | YY century expansion + warning. |
| date-21 Month-name | `15 jan 2023` | null | 2023-01-15 | unsupported | medium | Locale month-name parsing (lower priority). |
| date-25 YYYY/MM/DD | `2023/01/15` | null | 2023-01-15 | unsupported | low | Trivial year-first variant. |
| date-01, date-22, date-23, date-24 Baselines | ISO valid, invalid day, invalid month, ISO+blanks column | all correct | same | correct | low | No action. Calendar validation is sound. |

## Gender (parseGender and isGender)

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| GEN-05 Norwegian Mann/Kvinne | `Mann`, `Kvinne` | null | Man / Kvinna | bug | high | Add `mann`, `kvinne` to parseGender + GENDER_VALUES. Cross-ref ENC-06, B4-gender-no. |
| GEN-06 Danish Mand/Kvinde | `Mand`, `Kvinde` | null | Man / Kvinna | bug | high | Add `mand`, `kvinde`. Cross-ref P5. |
| GEN-07 Finnish Mies/Nainen | `Mies`, `Nainen` | null | Man / Kvinna | bug | high | Add `mies`, `nainen`. Cross-ref ENC-07, P5. |
| GEN-08 nb/da/fi gender columns | full-word columns | shape text | shape gender | bug | high | Add nb/da/fi words to GENDER_VALUES. |
| GEN-04 English F | `F` | null | Kvinna | bug | high | Add `f` to female branch + GENDER_VALUES (symmetric with `m`). |
| GEN-10 M/F 50/50 column | `["M","F","M","F"]` | shape text conf 0.5 | shape gender conf 1 | bug | high | Root cause is missing `f`; fixing GEN-04 fixes this. |
| GEN-17 Workday 3M/2F column | `["M","F","M","M","F"]` | shape gender conf 0.60 (marginal) | conf 1 | bug | high | Same missing-`f` root cause. |
| GEN-18 Pure-F column | `["F","F","F","F"]` | shape text conf 0 | shape gender | bug | high | Same missing-`f` root cause. |
| GEN-09 / GEN-21 SCB numeric 1/2 | `parseGender("1")` / `["1","2",...]` | null / shape percent | gender (SCB 1=man 2=kvinna) | unsupported | high | Numeric mapping guarded by header context; document SCB convention. |
| GEN-13 / GEN-22 Non-binary | `Annat`, `Other`, `X`, `Ukjent` | null (conflates missing/unknown/non-binary) | third canonical value | ambiguous | medium | Product decision: add `Okant`/`Other` to the return type; map nb/da/fi/en/sv non-binary tokens; warn at validate. EU Pay Transparency. |
| GEN-19 German Mann/Frau | `Mann`, `Frau` | null | out of scope | ambiguous | low | Adding `mann` for nb incidentally covers de male. |
| GEN-01/02/03/11/12/14/15/16/20 Baselines | sv Man/Kvinna/M/K, en Male/Female/Man/Woman, whitespace, blanks, mixed-with-nonbinary, header synonyms | all correct | same | correct | low | No action. Header synonym matching for gender works across Nordic (via fold). |

## Boolean (parseBool / isBoolean) and Identifiers (parseIntId)

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| bool-01 Norwegian Nei | `Nei` | null | false | bug | high | Add `nei` to false branch + BOOLEAN_VALUES. |
| bool-02 / bool-03 Finnish Kylla / Ei | `Kyllä` / `Ei` | null | true / false | bug | high | Add `kylla`, `ei` (folded). Cross-ref P7. |
| bool-04 Norwegian Ja/Nei column | `["Ja","Nei",...]` | shape boolean conf 0.60 | conf 1 | bug | high | Add `nei` to BOOLEAN_VALUES. |
| bool-05 Finnish Kylla/Ei column | `["Kyllä","Ei",...]` | shape text | shape boolean | bug | high | Add `kylla`, `ei`. |
| bool-06 Numeric 1/0 column | `["1","0",...]` | shape percent | boolean (ambiguous) | ambiguous | medium | Add `1`/`0`; give boolean priority over percent for single-digit, or header disambiguation. |
| bool-07 Y/N | `Y` | null | true/false | unsupported | medium | Add `y`, `n`. |
| bool-08 X/blank checkbox | `["X","","X",...]` | shape text | boolean (X=true, blank=false) | unsupported | medium | Add `x`; treat blank as false in a boolean column. |
| bool-09 Swedish SANT/FALSKT | `SANT` | null | true/false | unsupported | low | Add `sant`, `falskt`. |
| bool-10 / bool-11 Baselines | JA/NEJ, YES/NO/TRUE/FALSE | correct | same | correct | low | No action. |
| id-01 / id-02 Leading-zero employee number | `00042` / `["00042",...]` | 42 (zeros lost); shape id correct | preserve "00042" | bug | critical | Return string (or add parseStringId) so zeros survive; shape detection is already correct. |
| id-05 Alphanumeric code | `EMP001` | shape id, but parseIntId null | verbatim id | bug | critical | parseStringId returns trimmed string for any isId-accepted value; use it for id-shape fields. |
| id-07 18-digit numeric ID | `123456789012345678` | corrupted to ...680 | string or null+diagnostic | bug | high | `Number.isSafeInteger` guard; return string or null. |
| id-03 Personnummer full | `19850612-1234` | null; shape text | id, stored verbatim string | unsupported | critical | Add `^\d{8}-\d{4}$` to isId; parse as string. Cross-ref date-14 for date extraction. |
| id-04 Personnummer short | `850612-1234` | null; shape text | id | unsupported | high | Add `^\d{6}-\d{4}$` to isId. |
| id-08 Space-inside employee number | `["100 42",...]` | null; shape money | id | bug | medium | Header synonym should override shape=money; ambiguous without context. Cross-ref SC-02. |
| id-09 Personnummer no hyphen (10 digits) | `8506121234` | numeric parse, semantics lost | string | ambiguous | medium | String return type by default; heuristic warn for 10-digit personnummer. |
| id-06 / id-10 Baselines | SSYK 4-digit `2512`, plain `10042` | correct | same | correct | low | No action for these inputs; overall string return type recommended. |

## detectColumns header matching

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| DC-13 Norwegian headers | `Kjonn`, `Grunnlonn`, ... | Kjonn -> firstName; salary shape-only; **gender to firstName** | full Norwegian mapping | bug | critical | Pre-NFD substitution `o-slash -> o`, `ae -> ae` in fold. Cross-ref ENC-05. Add nb synonyms. |
| DC-14 Danish headers | `Kon`, `Grundlon`, `Beskaeftigelsesgrad`, ... | Kon -> firstName; **gender to firstName** | full Danish mapping | bug | critical | Same fold fix; synonyms authored assuming `oe` substitution that fold never performs. |
| DC-15 Finnish headers | `Henkilonro`, `Peruspalkka`, ... | **Henkilonro -> basicMonthly, Peruspalkka -> externalRef** | correct mapping | bug | critical | Remove bare `lon` from basicMonthly synonyms; add `henkilonro` to externalRef, `peruspalkka`/`kuukausipalkka` to basicMonthly, `tehtavanimike`/`nimike` to title. Cross-ref DC-25 root cause. |
| DC-25 `lon` substring landmine (root cause) | fold("Henkilonro").includes("lon") | headerScore 0.7 for salary on a person-number | never | bug | critical | Remove `lon` as a substring synonym; keep `manadslon`; if bare `Lon` header needed, add exact-match only or min length >= 5 for substring rule. |
| DC-09 Unknown columns absorbed | `Kostnadskonto`, `Hemort`, `Bokf.enhet` | all assigned via shape-only 0.4 | all in unmappedColumns | bug | high | Restrict shape-only fallback: never for text/id; only for distinctive shapes (gender/boolean). |
| DC-10 Two synonyms of same field | `Lon` + `Grundlon` | Lon wins basicMonthly; Grundlon stolen into `variable` | runner-up to unmappedColumns | bug | high | Track header-candidate columns in pass 1; exclude them from shape-only pass 2. Cross-ref SC-14/SC-25. |
| DC-21 Pay-band columns | `Lonenniva` (1-7), `Loneklass` (A-E) | ftePercent + firstName via shape-only | unmapped | bug | high | Same shape-only restriction as DC-09. |
| DC-17 Personec Manadsarvode / Tjanstebenamning | `Manadsarvode`, `Tjanstebenamning` | Manadsarvode -> payYear; title shape-only | basicMonthly / title | bug | high | Add `manadsarvode`/`arvode` to basicMonthly; `tjanstebenamning`/`benamning` to title. |
| DC-03 Agda Tj.grad % | `Tj.grad %` | ftePercent shape-only 0.4 | header match | bug | medium | Add `tjgrad`, `tjgradprocent`, `tjanstggrad` to ftePercent synonyms. |
| DC-05 Grundlon/ar vs /man | `Grundlon/man` + `Grundlon/ar` | ar-column -> payYear | annualSalary or unmapped | bug | medium | Same `lon`-substring issue; add explicit `arslon` if annual salary field is wanted. |
| DC-06 / DC-23 Anst.dag / Anst.datum | `Anst.dag`, `Anst.datum` | birthDate shape-only (tie-break by field index) | employmentStartDate | bug | medium | Add `anstdag`, `anstdatum`, `mandag` to employmentStartDate synonyms. |
| DC-12 Employer-cost columns | `Lonekostnad`, `Totallonekostnad` | variable / benefitInKind shape-only | unmapped | bug | medium | Same shape-only restriction as DC-09. |
| DC-22 Blank/whitespace headers | `""`, `"   "` | firstName/lastName shape-only | unmappedColumns | bug | medium | `if (!fold(header).length) { unmappedColumns.push; continue; }`. Cross-ref ENC-16. |
| DC-02 Alder column | `Alder (ar)` | birthDate shape-only 0.4 | unmapped (age != date) | bug | low | Suppress shape-only birthDate unless a cell matches YYYY-MM-DD. |
| DC-01, DC-04, DC-07, DC-08, DC-11, DC-16, DC-18, DC-19, DC-20, DC-24 Baselines | ALL-CAPS sv, trailing colon, English SAP, Workday underscores, Landskod/Enhetskod substring, Fortnox full sv, SSYK_Code, Befattningsbeteckning, duplicate gender to unmapped, missing salary | all correct | same | correct | low | No action. Swedish + English detection is robust. |

## classifyColumn shape + detect shape-boost / shape-only interaction

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| SC-05 Swedish postal code as money | `["114 55","752 28",...]` | shape money conf 1 | id or text | bug | critical | 5-digit 3+2 grouped number < ~10000 is not money; require currency suffix or min-value floor for single-group money. |
| SC-20 Comma-decimal salary column | `["45 000,00 kr",...]` | shape text conf 0 | shape money conf 1 | bug | critical | Extend isMoney number-part to `([.,]\d+)?`. Cross-ref M14/M15, B2-money, ENC-10. |
| SC-02 Space-grouped employee numbers | `["114 77","225 88",...]` | shape money | shape id | bug | high | Require currency suffix or value > ~1000 before money without a marker. |
| SC-03 Small integers as percent | `["12","7","3",...]` | shape percent conf 1 | shape id | bug | high | Require `%` for percent, or demote bare-int percent below id in priority. |
| SC-13 / SC-22 Postal-code steals `variable` | `Postnummer`/`Postnr` money-shaped + real `Lon` | Postnr -> variable 0.4 | Postnr unmapped | bug | high | Fix SC-05; add min-value guard for shape-only money promotion. |
| SC-14 / SC-25 Header-matched loser reabsorbed | `Anstallningsnummer` money-shaped, externalRef taken | shunted to variable 0.4 | unmappedColumns | bug | high/medium | Exclude header-candidate columns from shape-only pass. Cross-ref DC-10. |
| SC-09 Sparse column high confidence | 8 blanks + 2 money | shape money conf 1 (from 2 cells) | reflect sparseness | ambiguous | medium | Add sampleSize/fillRate or scale confidence by fill rate; at minimum document. |
| SC-12 Bare `100` column | `Array(10).fill("100")` | shape percent conf 1 | plausible but ambiguous | ambiguous | medium | Document; cross-check header synonym before accepting as ftePercent. |
| SC-23 Unrecognised-header salary | `Ersattning` money-shaped | basicMonthly shape-only 0.4 | intended fallback | correct | low | No action; shape-only for money with a real value works as designed. |
| SC-01, SC-04, SC-06, SC-07, SC-08, SC-10, SC-11, SC-15, SC-16, SC-17, SC-18, SC-19, SC-21, SC-24 Baselines | years, phones, dept codes, floor boundaries, titles-with-digits, currency codes, dept-id header override, birth years, zero-padded ids, SAP alpha ids, mixed gender, compact postal code, currency-suffix-only money | all correct | same | correct | low | No action. Floor + shape-boost mechanics work as documented. |

## Encoding / whitespace robustness

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| ENC-05 fold strips o-slash / ae | `Kjonn` -> `kjnn`, `Kon` -> `kn` | no synonym match; nb/da gender undetected | fold to `kjonn`/`koen` | bug | critical | Pre-NFD: replace `o-slash -> o`, `ae -> ae`. One-line fix unblocks nb/da. Cross-ref DC-13/DC-14. |
| ENC-10 Comma-decimal money | `45 000,00` column | shape text; parseMoney null | shape money 45000 | bug | critical | Extend isMoney + parseMoney for comma-decimal. Cross-ref M14/M15, SC-20, B2. |
| ENC-06 nb/da gender values | `Mann`/`Kvinne`/`Mand`/`Kvinde` | null | Man/Kvinna | bug | critical | Add to parseGender + GENDER_VALUES. Cross-ref GEN-05/06, P5. |
| ENC-07 Finnish gender values | `Mies`/`Nainen` | null | Man/Kvinna | bug | high | Add `mies`/`nainen`. Cross-ref GEN-07. |
| ENC-11 Dot-decimal money parser | `45000.00` / `45 000.00` | null; **isMoney true for spaced** | 45000 | bug | high | parseMoney must strip `.\d+`; fix isMoney/parseMoney mismatch. Cross-ref M17/M19. |
| ENC-21 Non-ISO dates | `15.01.1990`, `15/01/1990`, `19900115` | null; shape not date | parse + shape date | unsupported | high | Extend parseDate + isDate. Cross-ref date-05/07/08/09/10. |
| ENC-16 Trailing whitespace-only column | header `"   "`, empty cells | assigned to title 0.4 | unmappedColumns | bug | medium | Skip empty-folded-header columns in detect. Cross-ref DC-22. |
| ENC-02 UTF-16 LE BOM in string | `\xFFFEname,...` | garbage prefix on header 0 | strip U+FFFE too | bug | low | Extend BOM strip to U+FFFE (synonym survives via fold; display broken). |
| ENC-13 Plain integer salary shape | `["45000","52000",...]` | shape id | money candidate when header salary | ambiguous | medium | Header-match boost for money; or median > 10000 -> money candidate at low conf. Cross-ref M44/D5. |
| ENC-24 Negative salary | `-45000` | null (silent) | distinguishable signal | ambiguous | low | Add a `negative_value` RowIssueCode so correction rows surface named, not opaque. |
| ENC-03 UTF-16 binary blob | mis-decoded bytes | garbage | wizard re-decodes via BOM | upstream | medium | Wizard peeks first 2 bytes, re-decodes utf-16le/be. Engine cannot recover. |
| ENC-04 Windows-1252 mojibake | `KÃ¶n` -> fold `kan` | low-confidence shape-only guess, no warning | wizard re-decode + engine warning | upstream | high | Wizard defaults UTF-8, detects `Ã¥/Ã¶/Ã¤/Ã¸/Ã¦`, offers Windows-1252. validateImport warns on mojibake sequences. |
| ENC-22 Double-encoded UTF-8 | `KÃÂ¶n` -> fold `kaan` | no match | wizard detects/fixes | upstream | medium | Wizard responsibility; warn on suspicious sequences. |
| ENC-12 Continental dot-thousands | `45.000`, `45.000,00` | null; shape text | document unsupported | unsupported | medium | Out of scope V1; secondary heuristic warning if header matched money. Cross-ref M10/M11. |
| ENC-17 Curly quotes as delimiters | `"Anna"` curly | embedded curly quotes in value | normalise to ASCII | unsupported | low | Pre-process: `[curly] -> "` before papaparse. |
| ENC-01, ENC-08, ENC-09, ENC-14, ENC-15, ENC-18, ENC-19, ENC-20, ENC-23 Baselines | UTF-8 BOM, NBSP grouping, thin-space grouping, zero-width space, padded headers, CRLF, TSV, semicolon, emoji in name | all correct | same | correct | low | No action. Document NBSP/thin-space handling explicitly in parse.ts. |

## Binary format handling and end-to-end fixtures

| Scenario | Example input | Observed | Expected | Verdict | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| A1 XLSX passed as string | `PK\x03\x04...` | headers `["PK..."]`, no error | typed ImportFormatError('binary') | unsupported | critical | Binary-signature guard at top of tokenizeCsv; guide user to re-export as CSV. |
| A2 XLS (OLE2) | `\xD0\xCF\x11\xE0...` | garbage headers, no error | typed error | unsupported | critical | Same guard (OLE2 signature). |
| A3 ODS | `PK\x03\x04mimetype...` | garbage header | typed error | unsupported | high | PK guard catches ODS; check MIME string for specific message. |
| A4 Binary through full pipeline | XLSX magic | blocking `missing columns`, no format signal | distinct `invalidFormat` code | bug | high | Throw typed error before pipeline, or add `invalidFormat` blocking code so UI differentiates. |
| B2-money / B2-shape Hogia comma-decimal | `41 300,00` | unparsableMoney every row; shape text | money 41300 | bug | critical | Comma-decimal in parseMoney + isMoney. Cross-ref M14/SC-20/ENC-10 (same fix). |
| B3-bareint / D2 / D5 Workday Base Pay | `72000` under `Base Pay` | shape id; basicMonthly blocked | mapped | bug/high-critical | Add `basepay`/`salary`/`annualsalary`/`grosssalary` to basicMonthly; header-match money boost for bare integers. Cross-ref M44/M01/ENC-13. |
| B3-dotdate / B4-date-birth DD.MM.YYYY | `15.03.2019`, `Fodselsdato 12.05.1987` | null; column shape text | 2019-03-15; birthDate | bug | critical/high | parseDate + isDate DD.MM.YYYY. Cross-ref date-05/10, ENC-21 (unsupported verdict there). |
| B4-gender-no Norwegian gender | `Mann`/`Kvinne` | blankGender every row | Man/Kvinna | bug | critical | Cross-ref GEN-05/ENC-06 (same fix). |
| B4-fraction-fte FTE 0.8 | `0.8` | 0.8% (semantically wrong) | 80% | ambiguous | high | Column [0,1] heuristic x100 + warning. Cross-ref pp-07. |
| D3 / D4 Norwegian synonyms | `Fodselsdato`, `Grunnlonn` | Fodselsdato -> currency; Grunnlonn via fragile `lon` substring | birthDate / basicMonthly | bug | high/medium | Add `fodselsdato` to birthDate; `grunnlonn`/`grundlonn` explicit to basicMonthly; `fornavn`/`etternavn`/`stilling`. |
| D7 / P6 SAP field codes | `PERNR`/`PLANS`/`GESCH`/`ANSAL`, gender 1/2 | all shape-only 0.4; gender/salary blocked | SAP-standard mapping | unsupported | high | Add `pernr`->externalRef, `plans`->title, `gesch`->gender, `ansal`->basicMonthly; numeric gender 1/2. Cross-ref GEN-09. |
| P2 Dot-thousands SAP de | `94.500,00` | null | document unsupported | unsupported | medium | Out of scope V1; unsupported-format message. |
| P3 Currency-prefix | `NOK 54000`, `SEK54000` | null | 54000 | bug | medium | Strip leading currency code. Cross-ref M35. |
| P4 Comma-decimal FTE | `0,8`, `100,00` | null | 80 / 100 | bug | high | Comma-to-dot in parsePercent. Cross-ref pp-10/pp-04. |
| P7 Finnish/Norwegian bool | `kylla`/`ei`/`nei` | null | true/false/false | bug | low | Add to parseBool. Cross-ref bool-01/02/03. |
| B1-ok / D1 / D6 Baselines | Visma NBSP salary, Anst.nr dotted, Tjanstgoringsgrad% | all correct | same | correct | low | No action. Visma sv-SE NBSP path works end-to-end. |

---

## Decisions needed

### Decision A: XLS / XLSX / ODS scope

**Evidence.** A1-A4: binary spreadsheets are tokenized as garbage and fail with a generic "missing columns" blocking error, giving the user no actionable signal. Every major Nordic payroll system (Visma, Hogia, Personec, Agda, Fortnox) offers a direct CSV or semicolon export, so binary support is a convenience, not a necessity, for V1. Client-side XLSX parsing (SheetJS/community) adds roughly 300 kB to the bundle and an untrusted-binary attack surface.

**Options.**
1. Require CSV: add a binary-signature guard (PK`\x03\x04` for XLSX/ODS, `\xD0\xCF\x11\xE0` for XLS) that throws a typed `ImportFormatError('binary')` before papaparse, and show a short in-app guide on exporting CSV from each system.
2. Add a parser (SheetJS) to extract sheet text client-side, then feed the tokenizer.
3. Both: require CSV for V1, keep option 2 as a documented future step.

**Recommendation.** Option 1 for V1, framed as option 3 (document the parser as future work). The guard is cheap, removes the worst failure (silent garbage), and produces a clear user message. Defer the parser until a real customer's system cannot export CSV.

### Decision B: Expand the parsers/heuristics vs lock current behavior

**Evidence.** The largest cluster of critical/high findings is the parsers rejecting the dominant real-world Nordic formats. Comma-decimal money and percent (M13-M16, pp-04-pp-16, SC-20, ENC-10, B2), NBSP grouping already works, dot-thousands (M10/M11), non-ISO dates (date-02 through date-21, ENC-21, B3-dotdate), fraction FTE (pp-07-pp-09, B4-fraction-fte), Nordic gender words (GEN-05-08, ENC-05-07, P5), numeric gender codes (GEN-09, P6), 1/0 and Y/N booleans (bool-06/07), and leading-zero / personnummer id preservation (id-01-05). Two of these conflict with an existing documented spec choice: `parseMoney` is intentionally integer-only with "no signs", and `parseDate` is intentionally ISO-8601-only. The fold `o-slash/ae` fix and the `lon` substring removal are pure bug fixes with no spec conflict.

**Options.**
1. Expand parsers + heuristics to cover the common Nordic formats, revising the money/date spec choices deliberately.
2. Lock current behavior, document the limitations, and require pre-formatting upstream (in the wizard or by the user).
3. Hybrid: fix the pure bugs and locale-parity gaps now (fold, `lon` substring, nb/da/fi gender + boolean words, leading-zero id preservation, shape-only fallback restriction, binary guard); expand the number/date spec (comma-decimal, dot-thousands, non-ISO dates, fraction FTE) as an explicit spec revision with its own ADR.

**Recommendation.** Option 3. The fold fix, `lon` removal, Nordic gender/boolean parity, id string-preservation, shape-only restriction, and binary guard are unambiguous correctness fixes that unblock in-scope locales and should ship immediately. Comma-decimal money/percent and non-ISO dates require revising documented spec choices (integer-only money, ISO-only dates) and touch the deterministic understanding of a salary value, so they warrant an ADR that records: comma is the decimal separator for sv/nb/da/fi; salaries normalise to a number (rounding policy stated); DD/MM is the Nordic default with an ambiguity warning when day <= 12. Fraction FTE is a column-level heuristic with a user-facing warning, not a silent transform.

### Decision C: Non-binary gender representation

**Evidence.** GEN-13/GEN-22: the return type `Man | Kvinna | null` conflates missing, unparseable, and non-binary. The EU Pay Transparency Directive (2023/970/EU) and Swedish law allow reporting beyond binary where such employees exist, so silently nulling non-binary values excludes those employees from the pay-gap analysis.

**Options.**
1. Add a third canonical value (`Okant` / `Other`) and map known non-binary tokens (Annat, Other, Non-binary, Ukjent, Andet, Muu) to it; warn at validate.
2. Keep binary + null and document the limitation.

**Recommendation.** Option 1, but treat it as a product/compliance decision for HR, not a pure engine choice: the third value must flow through the whole pipeline (validate, pay-gap report) coherently. Ship the parser mapping behind the type change plus a validate-time warning so HR decides how to handle those rows.

### Decision D: Confidence semantics for sparse and shape-only columns

**Evidence.** SC-09: a column that is 80% blank reports confidence 1.0 from 2 cells. DC-09/DC-12/DC-21/SC-13: shape-only fallback at 0.4 assigns text/id/percent-shaped columns to real fields, hiding genuine unmapped columns and mislabeling address/cost/pay-band data.

**Options.**
1. Keep confidence as match-ratio-among-non-blank and add a separate `fillRate`/`sampleSize`; restrict shape-only fallback to distinctive shapes (gender/boolean) only.
2. Scale confidence by fill rate and leave shape-only as is.

**Recommendation.** Option 1. Add a `fillRate` field so downstream can distinguish a reliable classification from a 2-cell guess, and restrict shape-only fallback so text/id never earns a canonical assignment (only distinctive shapes do). This surfaces unmapped columns as the valuable signal they are and stops false positives, without breaking the documented shape-boost mechanics that work correctly.

---

## Proposed test plan

Grouped by source file. Each group distinguishes (i) LOCK tests that pin correct current behavior, (ii) FAIL-TODAY tests that document a bug/gap and should be written now (marked skip/todo until the fix lands, or as failing spec if the fix ships in the same change), and (iii) FIXTURE tests for end-to-end real-file cases. Ids reference the catalog rows above.

### tokenize.test.ts

- (i) LOCK: comma / semicolon / tab / pipe delimiters (T01-T04); quoted delimiter, embedded newline, doubled quotes (T05-T07); pure CRLF, lone CR (T10-T11); UTF-8 BOM + double BOM (T24-T25); sv comma-decimal preserved in values (T27-T28); blank/whitespace/empty/header-only/single-column (T29-T33); quoted headers, Nordic chars (T36-T37); TSV + semicolon autodetect (ENC-18-ENC-20).
- (ii) FAIL-TODAY: mixed CRLF/LF both directions (T08, T09); `sep=;`, `sep=,`, `sep=TAB`, BOM+`sep=`, disagreeing `sep=` (T12-T14, T39, T40); preamble title row, multi-line metadata, hash-comment (T15, T16, T34); units row (T17); trailing empty column (T18); ragged short/long rows (T19, T20); duplicate headers (T21); blank/whitespace header cells (T22); whitespace-padded headers trimmed (T23); null bytes stripped (T35); space-only pseudo-CSV warning (T38); UTF-16 LE BOM strip (ENC-02); curly-quote normalise (ENC-17); binary-signature guard raising typed error for XLSX/XLS/ODS (A1-A3).

### shape.test.ts (classifyColumn / isMoney / isPercent / isDate / isGender / isBoolean / isId)

- (i) LOCK: year id (SC-01), phones text (SC-04), dept codes id (SC-06), floor boundaries 0.556 text and 0.6 money (SC-07, SC-08), titles-with-digits text (SC-10), currency codes text (SC-11), birth years id (SC-16), zero-padded ids id (SC-17), SAP alpha ids id (SC-18), mixed gender 0.75 (SC-19), compact postal code id (SC-21), currency-suffix-only money (SC-24); NBSP + thin-space money (M05-M07, ENC-08-ENC-09); gender columns sv/en + blanks + mixed non-binary (GEN-12/14/15); date column ISO + blanks (date-24).
- (ii) FAIL-TODAY: postal code (spaced) as id not money (SC-05); space-grouped employee number id not money (SC-02); small integers id not percent (SC-03); comma-decimal money column money (SC-20, M14, M15, ENC-10, B2-shape); dot-thousands money (M10); comma-decimal percent + decimal-percent + space-before-% percent (pp-14, pp-13); fraction + comma-fraction + mixed int/fraction percent (pp-15, pp-16, pp-24); compact YYYYMMDD, DD/MM, DD.MM, datetime date shapes (date-08, date-09, date-10, date-13, ENC-21); year shape for birth-year column (date-17); nb/da/fi gender columns gender (GEN-08); English M/F and pure-F gender (GEN-10, GEN-17, GEN-18); numeric 1/2 gender (GEN-21); Norwegian Ja/Nei and Finnish Kylla/Ei boolean (bool-04, bool-05); numeric 1/0, Y/N, X/blank boolean (bool-06, bool-07, bool-08); personnummer full/short id (id-03, id-04); fillRate/sparse-confidence field (SC-09).

### parse.test.ts (parseMoney / parsePercent / parseDate / parseGender / parseBool / parseIntId + parseStringId)

- (i) LOCK: parseMoney plain int, space/NBSP/narrow-space grouped, currency-suffix-only (M01, M05-M07, SC-24); parsePercent whole int, `100%`, `80 %`, dot-decimal, blank, negative-null (pp-01/02/03/12/21/22); parseDate ISO valid + invalid day/month reject (date-01/22/23); parseGender sv/en all cases + whitespace + dash/N/A null (GEN-01/02/03/11/16); parseBool JA/NEJ + YES/NO/TRUE/FALSE (bool-10, bool-11); parseIntId SSYK + plain (id-06, id-10).
- (ii) FAIL-TODAY:
  - parseMoney: comma-decimal no-group / space-group / NBSP-group / dot-thousands / dot-thousands+comma (M13, M14, M15, M10, M11); dot-decimal + `.00` + space+dot-decimal (M17, M18, M19, ENC-11); kr+comma-decimal (M33); euro symbol (M40); run-on suffix (M41); large space+dot+EUR (M43); currency prefix (M35, P3); negative + parentheses (M24, M25); en-US comma-thousands column (M20, M21).
  - parsePercent: comma-decimal + comma-fraction + dot-fraction (pp-04/05/06, pp-10/11, pp-07/08/09); text Heltid/Deltid + text-prefixed number (pp-18/19/20).
  - parseDate: DD.MM.YYYY, DD/MM/YYYY, MM/DD/YYYY, ambiguous, D.M.YYYY, compact, datetime, ISO-T, personnummer full/short, Excel serial, YY year, YYYY/MM/DD (date-02 through date-21, date-25, B3-dotdate).
  - parseGender: nb Mann/Kvinne, da Mand/Kvinde, fi Mies/Nainen, en F, numeric 1/2 (GEN-04-07, GEN-09, ENC-06/07, P5, P6).
  - parseBool: nei, kylla, ei, y, n, x, sant, falskt (bool-01/02/03/07/08/09, P7).
  - parseIntId / parseStringId: leading-zero preserved as string (id-01); alphanumeric verbatim (id-05); 18-digit safe-integer guard (id-07); personnummer as string (id-03, id-09).

### detect.test.ts (detectColumns + headerScore)

- (i) LOCK: ALL-CAPS sv, trailing colon, English SAP, Workday underscores, Landskod/Enhetskod substring, Fortnox full sv, SSYK_Code, Befattningsbeteckning, duplicate gender to unmapped, missing-salary handling (DC-01/04/07/08/11/16/18/19/20/24); Anst.nr dotted, Tjanstgoringsgrad% (D1, D6); dept-id header override (SC-15).
- (ii) FAIL-TODAY: Norwegian + Danish full mappings after fold fix (DC-13, DC-14, ENC-05); Finnish mapping with `lon` substring removed (DC-15, DC-25); shape-only fallback no longer absorbs Kostnadskonto/Hemort/Bokf.enhet, Lonekostnad, pay-band columns (DC-09, DC-12, DC-21); duplicate-synonym runner-up to unmappedColumns (DC-10, SC-14, SC-25); Manadsarvode/Tjanstebenamning, Tj.grad, Anst.dag/Anst.datum, Grundlon/ar synonyms (DC-17, DC-03, DC-06, DC-23, DC-05); blank/whitespace-header column to unmappedColumns (DC-22, ENC-16); Alder suppressed from birthDate (DC-02); postal-code column not stolen into variable (SC-13, SC-22); Base Pay + Norwegian synonyms + SAP field codes (D2, D3, D4, D5, D7, B3-bareint, P6).

### validate.test.ts

- (ii) FAIL-TODAY: distinct `invalidFormat` blocking code for binary input (A4); mojibake warning when multiple headers contain `Ã¥/Ã¶/Ã¤/Ã¸/Ã¦` (ENC-04); `negative_value` RowIssueCode for negative salary (ENC-24); fraction-FTE column warning after x100 normalise (pp-07, B4-fraction-fte); textual-FTE warning for Deltid without number (pp-19); non-binary-present warning (GEN-22).

### End-to-end fixtures (fixtures/ + a pipeline test)

Each fixture is a real-shaped file run through tokenize -> detect -> validate, asserting the mapped fields, blocking list, and per-row issues.

- (i) LOCK: `visma-sv.csv` NBSP salary, semicolon, Swedish headers -> all 4 required fields at conf 1.0, no blocking (B1-ok).
- (iii) FIXTURE (FAIL-TODAY until fixes land):
  - `hogia-sv.csv` comma-decimal `41 300,00`, `Grundlon` header -> basicMonthly parsed, no unparsableMoney (B2).
  - `workday-en.csv` bare integer `72000` under `Base Pay`, gender `Female`, `Hire Date` = `15.03.2019`, NOK currency -> basicMonthly + employmentStartDate mapped, no blocking (B3).
  - `personec-no.csv` `Fodselsdato` DD.MM.YYYY, `Grunnlonn`, `Mann`/`Kvinne`, fraction FTE `0,8` -> birthDate + basicMonthly + gender mapped, FTE normalised to 80 with warning (B4, D3, D4).
  - `sap-successfactors.csv` `PERNR`/`PLANS`/`GESCH`/`ANSAL` with GESCH `1`/`2` -> externalRef/title/gender/basicMonthly mapped, no gender/salary blocking (D7, P6).
  - `fortnox-sv.csv` full canonical Swedish vocabulary -> all mapped conf 1.0 (regression companion to DC-16).
  - `binary.xlsx` (first bytes only) -> typed `ImportFormatError('binary')` / `invalidFormat` blocking, not a missing-columns error (A1, A4).
