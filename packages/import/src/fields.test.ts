import { describe, expect, it } from "vitest"
import { CANONICAL_FIELDS, fold } from "./fields.js"

describe("fold", () => {
  it("lowercases, strips accents, strips non-alphanumerics", () => {
    expect(fold("Sysselssättningsgrad")).toBe("sysselssattningsgrad")
    expect(fold("Kön")).toBe("kon")
  })

  it("handles plain ASCII unchanged", () => {
    expect(fold("employeeId")).toBe("employeeid")
  })

  it("strips spaces and hyphens", () => {
    expect(fold("first name")).toBe("firstname")
    expect(fold("last-name")).toBe("lastname")
  })

  it("folds Norwegian o-slash to o so nb headers survive (ENC-05, DC-13)", () => {
    expect(fold("Kjønn")).toBe("kjonn")
    expect(fold("Grunnlønn")).toBe("grunnlonn")
    expect(fold("Fødselsdato")).toBe("fodselsdato")
  })

  it("folds Danish ae ligature to ae so da headers survive (ENC-05, DC-14)", () => {
    // ø (o-slash) -> "o", so Danish Køn folds to "kon" (which is a gender synonym)
    expect(fold("Køn")).toBe("kon")
    expect(fold("Beskæftigelsesgrad")).toBe("beskaeftigelsesgrad")
  })

  it("uppercase o-slash and AE ligature fold identically", () => {
    expect(fold("KJØNN")).toBe("kjonn")
    expect(fold("ÆRE")).toBe("aere")
  })
})

describe("CANONICAL_FIELDS", () => {
  it("has exactly four required fields", () => {
    const required = CANONICAL_FIELDS.filter((f) => f.tier === "required").map(
      (f) => f.key
    )
    expect(required.sort()).toEqual(
      ["basicMonthly", "externalRef", "gender", "title"].sort()
    )
  })

  it("has unique keys", () => {
    const keys = CANONICAL_FIELDS.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("every field has at least one synonym", () => {
    for (const field of CANONICAL_FIELDS) {
      expect(
        field.synonyms.length,
        `${field.key} has no synonyms`
      ).toBeGreaterThan(0)
    }
  })

  it("synonyms are already folded (lowercased, accent-stripped, alphanum only)", () => {
    const nonAlphanum = /[^a-z0-9]/
    for (const field of CANONICAL_FIELDS) {
      for (const syn of field.synonyms) {
        expect(
          nonAlphanum.test(syn),
          `synonym "${syn}" on ${field.key} is not folded`
        ).toBe(false)
        expect(syn, `synonym "${syn}" on ${field.key} is not lowercase`).toBe(
          syn.toLowerCase()
        )
      }
    }
  })

  it("synonym lists contain expected candidates", () => {
    const byKey = Object.fromEntries(
      CANONICAL_FIELDS.map((f) => [f.key, f.synonyms])
    )
    expect(byKey.externalRef).toContain("anstnr")
    expect(byKey.externalRef).toContain("employeeid")
    expect(byKey.gender).toContain("kon")
    expect(byKey.gender).toContain("sukupuoli")
    expect(byKey.basicMonthly).toContain("manadslon")
    expect(byKey.basicMonthly).toContain("monthlysalary")
    expect(byKey.title).toContain("befattning")
    expect(byKey.ftePercent).toContain("sysselsattningsgrad")
    expect(byKey.ftePercent).toContain("sysselssattningsgrad")
  })

  it("each field's synonym list has no duplicates", () => {
    for (const field of CANONICAL_FIELDS) {
      const unique = new Set(field.synonyms)
      expect(
        unique.size,
        `${field.key} has duplicate synonyms: ${field.synonyms.filter((s, i) => field.synonyms.indexOf(s) !== i).join(", ")}`
      ).toBe(field.synonyms.length)
    }
  })
})

describe("CANONICAL_FIELDS synonyms after Plan A additions", () => {
  const byKey = Object.fromEntries(
    CANONICAL_FIELDS.map((f) => [f.key, f.synonyms])
  )

  it("removes the bare lon substring landmine from basicMonthly (DC-25)", () => {
    expect(byKey.basicMonthly).not.toContain("lon")
  })

  it("adds Finnish person-number and SAP pernr to externalRef (DC-15, D7)", () => {
    expect(byKey.externalRef).toContain("henkilonro")
    expect(byKey.externalRef).toContain("pernr")
  })

  it("adds fi/nb/da/Workday/SAP salary synonyms to basicMonthly (DC-15, DC-13, DC-14, DC-17, D5, D7)", () => {
    for (const syn of [
      "peruspalkka",
      "kuukausipalkka",
      "grunnlonn",
      "grundlonn",
      "manadsarvode",
      "arvode",
      "basepay",
      "salary",
      "annualsalary",
      "grosssalary",
      "ansal",
    ]) {
      expect(byKey.basicMonthly, `basicMonthly missing ${syn}`).toContain(syn)
    }
  })

  it("adds fi/Personec/SAP title synonyms (DC-15, DC-17, D7)", () => {
    for (const syn of [
      "tehtavanimike",
      "nimike",
      "tjanstebenamning",
      "benamning",
      "plans",
    ]) {
      expect(byKey.title, `title missing ${syn}`).toContain(syn)
    }
  })

  it("adds SAP gesch header synonym to gender (D7)", () => {
    expect(byKey.gender).toContain("gesch")
  })

  it("adds Agda tj.grad synonyms to ftePercent (DC-03)", () => {
    for (const syn of ["tjgrad", "tjgradprocent", "tjanstggrad"]) {
      expect(byKey.ftePercent, `ftePercent missing ${syn}`).toContain(syn)
    }
  })

  it("adds Norwegian fodselsdato to birthDate (D3, B4)", () => {
    expect(byKey.birthDate).toContain("fodselsdato")
  })

  it("adds Norwegian first/last name synonyms (D3)", () => {
    expect(byKey.firstName).toContain("fornavn")
    expect(byKey.lastName).toContain("etternavn")
  })

  it("adds Agda/Personec employment-start synonyms (DC-06, DC-23)", () => {
    for (const syn of ["anstdag", "anstdatum", "mandag"]) {
      expect(
        byKey.employmentStartDate,
        `employmentStartDate missing ${syn}`
      ).toContain(syn)
    }
  })
})
