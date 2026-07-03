import { describe, it, expect } from "vitest"
import { tokenizeCsv } from "./tokenize.js"

// Real 16-column header from a Swedish HR export.
const HEADER =
  "Anstallningsdatum;Fornamn;Efternamn;Chef;Kon;Land;Löneår;Födelsedatum;Befattning;Statistikkod;Månadslön;Tjänstebil;Målbonus;Valuta;Anstnr;Sysselssättningsgrad"

// Fixture: UTF-8 BOM + semicolon-delimited, one data row with a quoted field
// containing a semicolon, followed by a blank trailing line.
const BOM = "﻿"
const FIXTURE =
  BOM +
  HEADER +
  "\n" +
  '2023-01-15;Anna;Svensson;Ja;Kvinna;Sverige;2024;1990-05-20;"Chefsassistent; med ansvar";12345;52000;0;5000;SEK;EMP001;100\n' +
  "\n" // blank trailing line

describe("tokenizeCsv", () => {
  it("strips the BOM and returns 16 headers", () => {
    const { headers } = tokenizeCsv(FIXTURE)
    expect(headers.length).toBe(16)
  })

  it("returns the correct header names in order", () => {
    const { headers } = tokenizeCsv(FIXTURE)
    const expected = HEADER.split(";")
    expect(headers).toEqual(expected)
  })

  it("drops the blank trailing line (rows contains only data rows)", () => {
    const { rows } = tokenizeCsv(FIXTURE)
    expect(rows.length).toBe(1)
  })

  it("treats the quoted field with an embedded semicolon as a single cell", () => {
    const { rows } = tokenizeCsv(FIXTURE)
    const dataRow = rows[0]
    if (!dataRow) throw new Error("expected a data row")
    // "Chefsassistent; med ansvar" is one cell (index 8)
    expect(dataRow[8]).toBe("Chefsassistent; med ansvar")
    // and the row has exactly 16 cells
    expect(dataRow.length).toBe(16)
  })
})
