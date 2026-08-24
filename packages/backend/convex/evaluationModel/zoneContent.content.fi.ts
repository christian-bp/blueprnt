import type { ZoneContent } from "./zoneContent.content.en"

// Finnish content for the zone and level descriptions (the masterdokument's
// sections 14.5 and 14.6). Translated from zoneContentSv (the substance
// source), cross-checked against zoneContentEn where a Swedish phrase was
// ambiguous. Reviewed against en and sv for terminology, register and false
// friends; "vyöhyke" is the Finnish term the message files already use for a
// zone, "taso" stays reserved for a level, and a role's reach is
// "vaikutusalue" as in the criteria library.
export const zoneContentFi: ZoneContent = {
  zones: {
    A: {
      shortName: "Strateginen johtaminen",
      name: "Koko yrityksen kattavat ja strategiset roolit",
      character:
        "Muovaa yrityksen pitkän aikavälin suuntaa, kriittisiä valintoja tai kokonaisvaltaista menestymiskykyä.",
      typicalProfile:
        "Yritystä johtavat roolit, liiketoimintakriittiset johtavat asiantuntijat tai roolit, joilla on koko yrityksen kattava vastuu.",
      summary: "Strateginen ja koko yrityksen kattava vaikutus.",
    },
    B: {
      shortName: "Laajavaikutteiset johtajat",
      name: "Johtavat asiantuntija- ja esihenkilöroolit, joilla on laaja vaikutus",
      character:
        "Roolilla on laaja, pysyvä ja usein poikkitoiminnallinen vaikutus olennaiseen osaan liiketoimintaa.",
      typicalProfile:
        "Toimintoa johtavat roolit, kokeneet esihenkilöt ja johtavat asiantuntijat, joilla on merkittävä valtuutus tai vastuu seurauksista.",
      summary: "Laaja ja pysyvä vaikutus olennaiseen osaan liiketoimintaa.",
    },
    C: {
      shortName: "Itsenäiset asiantuntijat",
      name: "Itsenäiset asiantuntija- ja operatiiviset johtoroolit",
      character:
        "Roolilla on itsenäistä vastuuta selkeästä alueesta, vaativia työtehtäviä tai vaikutusta tiimeihin ja lähialueen toimintoihin.",
      typicalProfile:
        "Kokeneet asiantuntijat, tiimiesihenkilöt, operatiiviset johtajat ja roolit, joilla on vakiintunut ammatillinen vastuu.",
      summary: "Itsenäinen vastuu ja vaativat tehtävät selkeällä alueella.",
    },
    D: {
      shortName: "Ammatillinen ydin",
      name: "Ammatilliset roolit ja tukiroolit, joiden vaikutus on rajatumpi",
      character:
        "Roolilla on selkeät ja relevantit vaatimukset, mutta tavallisesti rajatumpi vaikutusalue, matalampi päätöstaso tai vakiintuneemmat raamit.",
      typicalProfile:
        "Ammatilliset roolit, koordinoivat roolit, hallinnollinen tuki ja operatiiviset roolit.",
      summary:
        "Selkeät ja relevantit, mutta tavallisesti rajatummat roolin vaatimukset.",
    },
  },
  levelFunctions: {
    A: {
      entry: {
        label: "Vyöhykkeelle pääsy",
        meaning:
          "Rooli täyttää vyöhykkeen perustason laadulliset vaatimukset ja profiilivaatimukset.",
      },
      established: {
        label: "Vakiintunut vyöhykeprofiili",
        meaning:
          "Rooli täyttää vyöhykkeen vaatimukset selkeästi, ja sillä on vakaa, vyöhykkeelle tyypillinen profiili.",
      },
      upper: {
        label: "Vyöhykkeen yläosa",
        meaning:
          "Rooli on arkkitehtuurin ylimmällä tasolla. Sen yläpuolella ei ole vyöhykettä, ja roolin vaikutusalue, monimutkaisuus, vastuu ja seuraukset ovat suurimmat, mitä malli kuvaa.",
      },
    },
    B: {
      entry: {
        label: "Vyöhykkeelle pääsy",
        meaning:
          "Rooli täyttää vyöhykkeen perustason laadulliset vaatimukset ja profiilivaatimukset.",
      },
      established: {
        label: "Vakiintunut vyöhykeprofiili",
        meaning:
          "Rooli täyttää vyöhykkeen vaatimukset selkeästi, ja sillä on vakaa, vyöhykkeelle tyypillinen profiili.",
      },
      upper: {
        label: "Vyöhykkeen yläosa",
        meaning:
          "Rooli on lähellä seuraavaa vyöhykettä laajemman vaikutusalueen, monimutkaisuuden, vastuun tai seurausten vuoksi, mutta ei vielä täytä seuraavan vyöhykkeen kokonaisprofiilia.",
      },
    },
    C: {
      entry: {
        label: "Vyöhykkeelle pääsy",
        meaning:
          "Rooli täyttää vyöhykkeen perustason laadulliset vaatimukset ja profiilivaatimukset.",
      },
      established: {
        label: "Vakiintunut vyöhykeprofiili",
        meaning:
          "Rooli täyttää vyöhykkeen vaatimukset selkeästi, ja sillä on vakaa, vyöhykkeelle tyypillinen profiili.",
      },
      upper: {
        label: "Vyöhykkeen yläosa",
        meaning:
          "Rooli on lähellä seuraavaa vyöhykettä laajemman vaikutusalueen, monimutkaisuuden, vastuun tai seurausten vuoksi, mutta ei vielä täytä seuraavan vyöhykkeen kokonaisprofiilia.",
      },
    },
    D: {
      entry: {
        label: "Vyöhykkeelle pääsy",
        meaning:
          "Rooli täyttää vyöhykkeen perustason laadulliset vaatimukset ja profiilivaatimukset.",
      },
      established: {
        label: "Vakiintunut vyöhykeprofiili",
        meaning:
          "Rooli täyttää vyöhykkeen vaatimukset selkeästi, ja sillä on vakaa, vyöhykkeelle tyypillinen profiili.",
      },
      upper: {
        label: "Vyöhykkeen yläosa",
        meaning:
          "Rooli on lähellä seuraavaa vyöhykettä laajemman vaikutusalueen, monimutkaisuuden, vastuun tai seurausten vuoksi, mutta ei vielä täytä seuraavan vyöhykkeen kokonaisprofiilia.",
      },
    },
  },
}
