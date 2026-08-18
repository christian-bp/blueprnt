import type { CriteriaLibraryContent } from "./criteriaLibrary.content.en"

// Finnish content for the criteria library (the masterdokument's sections
// 5-13.5). Machine-translated from criteriaLibraryContentSv (the substance
// source), cross-checked against criteriaLibraryContentEn where a Swedish
// phrase was ambiguous. Structure mirrors en/sv exactly: only the three
// section 13.5 entries (scope-impact, complexity-ambiguity,
// risk-consequence) carry anchor2/anchor4. Machine draft, flagged for
// native review.
export const criteriaLibraryContentFi: CriteriaLibraryContent = {
  dimensions: {
    competence: {
      name: "Osaaminen",
      question:
        "Mitä tietoja, taitoja, kokemusta ja pätevyyttä rooli edellyttää?",
      why: "Suojaa asiantuntija-, ammatti- ja pätevyyttä vaativia rooleja aliarvioinnilta.",
    },
    effort: {
      name: "Ponnistelu ja monimutkaisuus",
      question:
        "Kuinka vaikea, epäselvä, analyyttisesti, viestinnällisesti tai fyysisesti vaativa rooli on?",
      why: "Tekee vaativan työn näkyväksi myös silloin, kun roolilla ei ole muodollista esimiesvaltaa.",
    },
    responsibility: {
      name: "Vastuu ja vaikutus",
      question:
        "Kuinka laaja ulottuvuus, millainen valtuutus ja millaiset seuraukset roolilla on?",
      why: "Kuvaa vastuuta päätöksistä, tuloksista, riskeistä, ihmisistä, laadusta ja liiketoiminnasta.",
    },
    workingConditions: {
      name: "Työolosuhteet",
      question:
        "Onko olemassa erityisiä, objektiivisia ja pysyviä työehtoja, jotka vaikuttavat vaatimuksiin?",
      why: "Tekee näkyväksi esimerkiksi päivystyksen, altistumisen, turvallisuusvaatimukset ja epäsäännölliset olosuhteet.",
    },
  },
  workingConditionsTest: {
    question:
      "Onko olemassa vähintään yksi rooliperhe, jossa erityiset työolosuhteet ovat toistuva, objektiivinen ja olennainen osa roolin vaatimuksia eikä vaatimusta jo kata oikein toinen kriteeri?",
    notMaterialLabel: "Arvioitu, mutta ei olennaisesti relevantti",
  },
  sharedScale: {
    "1": {
      name: "Rajattu vaatimus",
      meaning:
        "Vaatimus on selkeästi määritelty, paikallinen tai laajuudeltaan rajattu. Rooli toimii pääasiassa vakiintuneiden raamien sisällä.",
    },
    "2": {
      name: "Perustason tai kohtalainen vaatimus",
      meaning:
        "Vaatimus toistuu, mutta selkeästi rajatulla alueella. Rooli käsittelee vaihteluita ja yksinkertaisempia poikkeamia.",
    },
    "3": {
      name: "Itsenäinen ja vakiintunut vaatimus",
      meaning:
        "Vaatimus on selkeä ja toistuva osa roolia. Rooli tekee ammatillisia arvioita omalla alueellaan.",
    },
    "4": {
      name: "Pitkälle kehittynyt tai laaja vaatimus",
      meaning:
        "Vaatimus on pitkälle kehittynyt, sillä on laajempi ulottuvuus, tai se edellyttää itsenäistä harkintaa tilanteissa, joissa vakiintuneet toimintatavat eivät aina riitä.",
    },
    "5": {
      name: "Erittäin pitkälle kehittynyt, laaja tai liiketoimintakriittinen vaatimus",
      meaning:
        "Vaatimuksella on erittäin suuri laajuus, vaikeusaste, seuraus tai strateginen merkitys. Rooli muovaa usein suuntaa, standardeja, ratkaisuja tai tuloksia oman lähialueensa ulkopuolella.",
    },
  },
  midpoints: {
    step2: "Harkittu välitaso portaiden 1 ja 3 välillä.",
    step4: "Harkittu välitaso portaiden 3 ja 5 välillä.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Tiedon syvyys ja asiantuntijataso",
      shortUiText:
        "Roolin edellyttämä syvällinen asiantuntemus ja pitkälle kehittynyt ongelmanratkaisu.",
      fullDefinition:
        "Kuvaa roolin edellyttämää syvällistä ammattiosaamista, asiantuntijamenetelmiä, pitkälle kehittynyttä ongelmanratkaisua ja olennaista kokemusta. Kriteeri mittaa roolin tavanomaisesti käyttämän asiantuntemuksen syvyyttä, ei muodollista tutkintoa sinänsä eikä sitä, miten yksittäinen ongelma sattui ratkeamaan.",
      measures:
        "Syvällisen ammattiosaamisen, asiantuntijamenetelmien, pitkälle kehittyneen ongelmanratkaisun ja olennaisen kokemuksen vaatimusta.",
      notMeasures:
        "Muodollista tutkintoa sinänsä, yksittäisen ongelman vaikeutta tai yksilön suoritusta.",
      whenSuitable:
        "Lähes aina relevantti tietointensiivisissä organisaatioissa.",
      whenNotSuitable:
        "Valitse yleensä joko tämä tai laajempi yhdistetty osaamiskriteeri, ei molempia.",
      controlQuestion:
        "Onko roolin edellyttämän asiantuntemuksen syvyydellä merkitystä itsessään, erillään sen laajuudesta, muodollisesta pätevyydestä, toimialakontekstista ja neuvonantoharkinnasta?",
      assessmentQuestion:
        "Millaista asiantuntemuksen syvyyttä rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Rooli käyttää vakiintunutta, hyvin dokumentoitua ammattiosaamista selkeästi rajatulla alueella ja soveltaa tuttuja menetelmiä tuttuihin ongelmiin.",
      anchor3:
        "Rooli soveltaa itsenäisesti syvällistä asiantuntemusta ja vakiintuneita ammattimenetelmiä ratkaistakseen ongelmia omalla alueellaan.",
      anchor5:
        "Roolilla on erittäin pitkälle kehittynyttä asiantuntemusta, ja sitä käytetään usein alan vaikeimpien ongelmien ratkaisemiseen, mikä muovaa ammatillisia standardeja tai käytäntöjä oman tiimin ulkopuolella.",
    },
    "knowledge-breadth": {
      name: "Tiedon laajuus ja monialainen ymmärrys",
      shortUiText:
        "Roolin edellyttämä useiden osaamisalueiden yhdistäminen ja niiden välisten yhteyksien ymmärtäminen.",
      fullDefinition:
        "Kuvaa roolin edellyttämää useiden osaamisalueiden, kuten tuotteen, datan, liiketoiminnan ja teknologian, yhdistämistä ja niiden keskinäisten yhteyksien ymmärtämistä. Kriteeri mittaa yhdistämisen laajuutta, ei niiden henkilöiden määrää, joiden kanssa rooli tekee yhteistyötä.",
      measures:
        "Useiden osaamisalueiden yhdistämisen ja niiden välisten yhteyksien ymmärtämisen vaatimusta.",
      notMeasures: "Yhteistyökumppanien määrää tai organisatorista vaikutusta.",
      whenSuitable:
        "Kun roolien on yhdistettävä useita sisältöalueita, esimerkiksi tuote, data, liiketoiminta ja teknologia.",
      whenNotSuitable:
        "Valitse vain, kun laajuus on itsenäinen ero asiantuntemuksen syvyyteen nähden.",
      controlQuestion:
        "Onko roolin yhdistämän osaamisen laajuudella merkitystä itsessään, erillään siitä, kuinka syvällistä sen asiantuntemus on?",
      assessmentQuestion:
        "Millaista monialaista laajuutta rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Rooli käyttää pääasiassa yhtä osaamisaluetta ja tarvitsee harvoin yhdistää sitä muihin osa-alueisiin.",
      anchor3:
        "Rooli yhdistää itsenäisesti muutamia vakiintuneita osaamisalueita ja ymmärtää, miten ne vaikuttavat toisiinsa.",
      anchor5:
        "Rooli yhdistää useita erilaisia osaamisalueita erittäin pitkälle kehittyneellä tasolla, ja siihen luotetaan tapoina, jotka muovaavat ratkaisuja tai suuntaa oman alueen ulkopuolella.",
    },
    "formal-qualifications": {
      name: "Muodolliset pätevyys-, lupa- ja sertifiointivaatimukset",
      shortUiText:
        "Roolin edellyttämä pakollinen laillistus, lupa tai sertifiointi.",
      fullDefinition:
        "Kuvaa muodollisia vaatimuksia, jotka roolin on täytettävä voidakseen laillisesti harjoittaa, hyväksyä tai vastata työstä, kuten pakollista laillistusta, lupaa tai sertifiointia. Kriteeri mittaa muodollista vaatimusta sinänsä, ei yleistä koulutustasoa tai arvostettua tutkintoa, jota työn tekeminen ei edellytä.",
      measures:
        "Työn harjoittamiseksi, hyväksymiseksi tai siitä vastaamiseksi vaadittavia muodollisia vaatimuksia.",
      notMeasures:
        "Yleistä koulutustasoa, arvostettua tutkintoa tai vapaaehtoisia kursseja.",
      whenSuitable:
        "Säännellyt tai turvallisuuskriittiset roolit, joissa vaaditaan pakollinen laillistus, lupa tai sertifiointi.",
      whenNotSuitable:
        "Ei tule käyttää, kun koulutus on vain väylä osaamiseen, jonka Tiedon syvyys jo kattaa.",
      controlQuestion:
        "Onko roolin pakollisella laillistuksella, luvalla tai sertifioinnilla merkitystä itsessään, erillään asiantuntemuksesta, jota se myös edellyttää?",
      assessmentQuestion:
        "Millaista muodollista pätevyyttä, lupaa tai sertifiointia rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Rooli edellyttää perustason, selkeästi määriteltyä lupaa tai sertifiointia, jonka uusimis- tai laajuusvaatimus on rajallinen.",
      anchor3:
        "Rooli edellyttää vakiintunutta ammatillista laillistusta tai sertifiointia, joka on toistuva, itsenäinen ehto roolin harjoittamiselle.",
      anchor5:
        "Rooli edellyttää pitkälle kehittynyttä tai liiketoimintakriittistä laillistusta, lupaa tai sertifiointia, ilman jota roolia ei voi laillisesti harjoittaa, hyväksyä tai siitä vastata, ja joka usein asettaa standardin, jota muiden on noudatettava.",
    },
    "domain-knowledge": {
      name: "Toimiala- ja liiketoimintaosaaminen",
      shortUiText:
        "Roolin edellyttämä syvällinen, vaikeasti korvattavissa oleva tuntemus omasta toimialastaan tai liiketoimintaympäristöstään.",
      fullDefinition:
        "Kuvaa roolin edellyttämää syvällistä kontekstiosaamista, kuten toimialaa, tuotetta, asiakasympäristöä tai säädöskontekstia, jota ei voida nopeasti korvata yleisellä ammattitaidolla. Kriteeri mittaa kontekstiosaamisen syvyyttä, ei yleistä kokemusta tai organisaatiotuntemusta, jota kaikkien odotetaan kartuttavan ajan myötä.",
      measures:
        "Syvällistä kontekstiosaamista, jota yleinen ammattitaito ei nopeasti korvaa.",
      notMeasures:
        "Yleistä kokemusta tai organisaatiotuntemusta, jota kaikkien odotetaan kartuttavan.",
      whenSuitable:
        "Kun tietyn toimialan, tuotteen, asiakasympäristön tai säädösten tuntemus on roolin oma erillinen edellytys.",
      whenNotSuitable:
        "Toimiala on konteksti; asiantuntijataso on ammatillinen menetelmä ja taito.",
      controlQuestion:
        "Onko roolin kontekstisidonnaisella toimialaosaamisella merkitystä itsessään, erillään sen yleisestä asiantuntijamenetelmästä ja taidosta?",
      assessmentQuestion:
        "Millaista toimiala- ja liiketoimintaosaamista rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Rooli edellyttää toimialaosaamista, joka rajoittuu selkeästi rajattuun tuote-, prosessi- tai asiakaskontekstiin.",
      anchor3:
        "Rooli edellyttää vakiintunutta, itsenäistä tuntemusta omasta toimialastaan, jota yleinen ammattitaito ei nopeasti korvaa.",
      anchor5:
        "Rooli edellyttää erittäin syvällistä, liiketoimintakriittistä toimialaosaamista, jota on vaikea korvata ja joka usein muovaa sitä, miten toimialan standardit tai käytännöt määritellään roolin oman alueen ulkopuolella.",
    },
    "advisory-judgment": {
      name: "Neuvonanto- ja harkintaosaaminen",
      shortUiText:
        "Roolin edellyttämä kyky punnita tietoa ja muuttaa asiantuntemus päteviksi suosituksiksi.",
      fullDefinition:
        "Kuvaa roolin edellyttämää kykyä punnita tietoa, käyttää ammatillista harkintaa ja muuttaa asiantuntemus päteviksi neuvoiksi tai suosituksiksi, joiden pohjalta muut toimivat. Kriteeri mittaa itse neuvonantoharkintaa, ei muodollista valtuutta päättää, mitä seuraavaksi tapahtuu.",
      measures:
        "Tiedon arvioinnin, pätevien neuvojen antamisen ja asiantuntemuksen suosituksiksi muuttamisen vaatimusta.",
      notMeasures: "Muodollista päätösvaltaa.",
      whenSuitable:
        "Konsultti-, partneri-, asiantuntija- ja johtavat asiantuntijaroolit, joissa pätevät neuvot ovat ydintoimitus.",
      whenNotSuitable:
        "Ei tule yhdistää Tiedon syvyys -kriteeriin, jos se vain kuvaa samaa asiantuntemusta eri sanoin.",
      controlQuestion:
        "Onko roolin edellyttämällä neuvonantoharkinnalla merkitystä itsessään, erillään asiantuntemuksesta, johon harkinta perustuu?",
      assessmentQuestion:
        "Millaista neuvonanto- ja harkintaosaamista rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Rooli tuottaa taustatietoa tai yksinkertaisia neuvoja selkeästi rajatulla alueella vakiintuneen ohjeistuksen mukaisesti.",
      anchor3:
        "Rooli punnitsee itsenäisesti tietoa ja antaa vakiintuneita, ammatillisia neuvoja, joihin muut luottavat omalla alueellaan.",
      anchor5:
        "Roolin neuvoja ja harkintaa kysytään erittäin pitkälle kehittyneissä tai liiketoimintakriittisissä kysymyksissä, ja ne muovaavat usein suosituksia, standardeja tai suuntaa, joita muut osat organisaatiosta noudattavat.",
    },
    "complexity-ambiguity": {
      name: "Monimutkaisuus ja epäselvyys",
      shortUiText:
        "Roolin edellyttämä kyky käsitellä epävarmuutta, monitahoisia kysymyksiä ja epäselviä raameja pätevällä harkinnalla.",
      fullDefinition:
        "Kuvaa epävarmuutta, monitahoisia kysymyksiä, epäselviä raameja ja pätevän harkinnan tarvetta, joiden parissa rooli tavanomaisesti työskentelee. Kriteeri mittaa roolin käsittelemien ongelmien luonnetta, ei osaamisvaatimusta sinänsä, työtahtia eikä organisatorista ulottuvuutta.",
      measures:
        "Epävarmuutta, monitahoisia kysymyksiä, epäselviä raameja ja pätevän harkinnan tarvetta.",
      notMeasures:
        "Osaamisvaatimusta sinänsä, nopeaa työtahtia tai organisatorista ulottuvuutta.",
      whenSuitable: "Lähes aina relevantti.",
      whenNotSuitable: "Tulisi yleensä olla ulottuvuuden pääkriteeri.",
      controlQuestion:
        "Onko roolin käsittelemällä monimutkaisuudella ja epäselvyydellä merkitystä itsessään, erillään analyyttisestä ponnistelusta, joka käytetään sen läpikäymiseen?",
      assessmentQuestion:
        "Millaista monimutkaisuutta ja epäselvyyttä rooli normaalisti ja pysyvästi käsittelee?",
      anchor1:
        "Rooli työskentelee pääasiassa selkeästi määriteltyjen kysymysten, vakiintuneiden menetelmien ja ennakoitavissa olevien tilanteiden parissa.",
      anchor2:
        "Rooli käsittelee toistuvia vaihteluita ja yksinkertaisempia poikkeamia, joissa se valitsee tuttujen vaihtoehtojen väliltä.",
      anchor3:
        "Rooli käsittelee itsenäisesti monimutkaisia kysymyksiä omalla alueellaan ja joutuu analysoimaan, priorisoimaan ja mukauttamaan ratkaisuja.",
      anchor4:
        "Rooli käsittelee pitkälle kehittyneitä, eri toimintojen välisiä tai osittain epäselviä ongelmia, joissa vakiintuneet ratkaisut eivät aina riitä.",
      anchor5:
        "Rooli määrittelee ja käsittelee erittäin monimutkaisia tai strategisesti tärkeitä ongelmia suuren epävarmuuden vallitessa ja muovaa usein lähestymistapoja, periaatteita tai pitkän aikavälin ratkaisuja.",
    },
    "analytical-effort": {
      name: "Analyyttinen ja ongelmanratkaisuun liittyvä ponnistelu",
      shortUiText:
        "Analyysin, vianetsinnän tai systemaattisen ongelmanratkaisun laajuus, jota rooli tavanomaisesti tekee.",
      fullDefinition:
        "Kuvaa analyysin, vianetsinnän, mallintamisen, diagnostiikan tai systemaattisen ongelmanratkaisun laajuutta, jota rooli tavanomaisesti tekee. Kriteeri mittaa analyyttistä työtä sinänsä, ei sen taustalla olevaa asiantuntemusta eikä pelkkää epäselvien ongelmien esiintymistä.",
      measures:
        "Analyysin, vianetsinnän, mallintamisen, diagnostiikan tai systemaattisen ongelmanratkaisun laajuutta.",
      notMeasures:
        "Asiantuntemusta tai pelkkää epäselvien ongelmien esiintymistä.",
      whenSuitable:
        "Kun henkinen analyysikuorma eroaa selvästi roolien välillä vastaavasta monimutkaisuudesta huolimatta.",
      whenNotSuitable:
        "Yhdistä Monimutkaisuus-kriteeriin vain, jos ero voidaan selittää: monimutkaisuus on ongelman luonne, analyysi on työ, jota sen käsittely vaatii.",
      controlQuestion:
        "Onko analyyttisellä ponnistelulla, jonka rooli käyttää ongelmien ratkaisemiseen, merkitystä itsessään, erillään siitä, kuinka monimutkaisia tai epäselviä nämä ongelmat ovat?",
      assessmentQuestion:
        "Millaista analyyttistä ja ongelmanratkaisuun liittyvää ponnistelua rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooli tekee yksinkertaista analyysia tai vianetsintää selkeästi rajatun tehtävän puitteissa vakiintuneiden vaiheiden mukaisesti.",
      anchor3:
        "Rooli tekee itsenäisesti vakiintunutta analyysia, diagnostiikkaa tai systemaattista ongelmanratkaisua toistuvana osana omaa aluettaan.",
      anchor5:
        "Rooli tekee erittäin pitkälle kehittynyttä tai laajaa analyysia, mallintamista tai diagnostiikkaa, joka on usein liiketoimintakriittistä ja muovaa sitä, miten vastaavia ongelmia lähestytään oman alueen ulkopuolella.",
    },
    "communication-effort": {
      name: "Viestintää ja vuorovaikutusta vaativa työ",
      shortUiText:
        "Roolin edellyttämä pitkälle kehittynyt viestintä, neuvottelu tai konfliktinhallinta.",
      fullDefinition:
        "Kuvaa roolin edellyttämää pitkälle kehittynyttä viestintää, neuvottelua, vaikuttamista, konfliktinhallintaa tai eri intressien välistä tulkintaa. Kriteeri mittaa viestinnällistä ponnistelua, ei sidosryhmien määrää, joiden kanssa rooli sattuu toimimaan, eikä sen organisatorista vaikutusta.",
      measures:
        "Pitkälle kehittyneen viestinnän, neuvottelun, vaikuttamisen, konfliktinhallinnan tai intressien välisen tulkinnan vaatimusta.",
      notMeasures: "Sidosryhmien määrää tai organisatorista vaikutusta.",
      whenSuitable:
        "Asiakasläheiset, neuvottelevat, neuvoa-antavat tai konfliktinhallintaa vaativat toiminnot, joissa tämä on keskeinen osa työtä.",
      whenNotSuitable:
        "Mitataan viestinnällisenä ponnisteluna, ei verkoston kokona.",
      controlQuestion:
        "Onko viestinnällisellä ponnistelulla, jota rooli kantaa, merkitystä itsessään, erillään siitä, kuinka monta sidosryhmää tai kuinka laajan organisatorisen ulottuvuuden roolilla on?",
      assessmentQuestion:
        "Millaista viestintään ja vuorovaikutukseen liittyvää ponnistelua rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooli viestii selkeästi rajatussa, pääosin rutiininomaisessa vuorovaikutuksessa vakiintuneiden osapuolten kanssa.",
      anchor3:
        "Rooli toteuttaa itsenäisesti vakiintunutta, toistuvaa viestintää, neuvottelua tai konfliktinhallintaa osana omaa aluettaan.",
      anchor5:
        "Rooli kantaa erittäin pitkälle kehittynyttä tai liiketoimintakriittistä viestintää, neuvottelua tai konfliktinhallintaa ja muovaa usein sitä, miten arkaluonteisia suhteita tai kiistoja käsitellään oman alueen ulkopuolella.",
    },
    "operational-intensity": {
      name: "Operatiivinen intensiteetti ja rinnakkaisten tehtävien vaatimus",
      shortUiText:
        "Roolin tavanomainen vaatimus pitää huomio useissa samanaikaisissa prosesseissa ja priorisoida jatkuvasti.",
      fullDefinition:
        "Kuvaa huomiokykyä, rinnakkaista suorituskykyä ja jatkuvaa priorisointia, jota rooli tavanomaisesti edellyttää tavanomaisessa toimintatilassaan. Kriteeri mittaa pysyvää, rakenteellista vaatimusta, ei tilapäisiä huippuja, alimiehitystä tai huonoa suunnittelua, jotka sattuvat lisäämään työmäärää.",
      measures:
        "Huomiokykyä, rinnakkaista suorituskykyä ja jatkuvaa priorisointia tavanomaisessa toimintatilassa.",
      notMeasures:
        "Tilapäisiä huippuja, alimiehitystä tai huonoa suunnittelua.",
      whenSuitable:
        "Operatiiviset, asiakaspalvelu-, logistiikka- tai valvontaroolit, joissa on pysyvä vaatimus hallita useita samanaikaisia prosesseja ja tehdä nopeita priorisointeja.",
      whenNotSuitable:
        "Ei saa käyttää palkitsemaan työmäärää, joka johtuu resurssipulasta.",
      controlQuestion:
        "Onko roolin tavanomaisella operatiivisella intensiteetillä merkitystä itsessään, erillään alimiehityksen tai huonon suunnittelun aiheuttamista tilapäisistä huipuista?",
      assessmentQuestion:
        "Millaista operatiivista intensiteettiä ja rinnakkaisten tehtävien vaatimusta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooli käsittelee tavallisesti yhtä prosessia tai tehtävää kerrallaan selkeästi rajatussa työrytmissä.",
      anchor3:
        "Rooli hallitsee itsenäisesti useita vakiintuneita, samanaikaisia prosesseja ja priorisoi niiden välillä tavanomaisena osana omaa aluettaan.",
      anchor5:
        "Rooli ylläpitää erittäin korkeaa, liiketoimintakriittistä operatiivista intensiteettiä useiden samanaikaisten prosessien yli, ja sen tapa priorisoida asettaa usein mallin, jota muut noudattavat.",
    },
    "physical-sensory": {
      name: "Fyysinen tai aisteihin kohdistuva rasitus",
      shortUiText:
        "Roolin toistuva fyysinen kuormitus, tarkkuusvaatimus tai aisteihin kohdistuva keskittyminen.",
      fullDefinition:
        "Kuvaa toistuvaa fyysistä kuormitusta, tarkkuutta, ergonomisesti vaativia vaiheita tai aisteihin kohdistuvaa keskittymistä, jota rooli tavanomaisesti edellyttää. Kriteeri mittaa fyysistä tai aisteihin kohdistuvaa rasitusta sinänsä, ei turvallisuusriskiä tai altistumista, joita työ voi myös sisältää.",
      measures:
        "Toistuvaa fyysistä kuormitusta, tarkkuutta, ergonomisesti vaativia vaiheita tai aisteihin kohdistuvaa keskittymistä.",
      notMeasures: "Turvallisuusriskiä tai fyysistä altistumista.",
      whenSuitable:
        "Teollisuus, terveydenhuolto, varastointi, tuotanto, kenttähuolto tai laboratoriot.",
      whenNotSuitable:
        "Riskiympäristö ja altistuminen kuuluvat yleensä Työolosuhteet-ulottuvuuteen.",
      controlQuestion:
        "Onko fyysisellä tai aisteihin kohdistuvalla rasituksella, jota rooli kantaa, merkitystä itsessään, erillään turvallisuusriskistä tai altistumisesta, joita se voi myös sisältää?",
      assessmentQuestion:
        "Millaista fyysistä tai aisteihin kohdistuvaa rasitusta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooliin sisältyy kevyitä, satunnaisia fyysisiä tai aisteihin kohdistuvia vaatimuksia selkeästi rajatussa tehtävässä.",
      anchor3:
        "Rooli kantaa itsenäisesti vakiintunutta, toistuvaa fyysistä kuormitusta, tarkkuustyötä tai aisteihin kohdistuvaa keskittymistä tavanomaisena osana omaa aluettaan.",
      anchor5:
        "Rooli kantaa erittäin vaativaa, jatkuvaa fyysistä tai aisteihin kohdistuvaa rasitusta, jonka oikein suorittaminen on usein liiketoimintakriittistä, kuten tarkkuustyötä, jonka standardiin muut sidotaan.",
    },
    "scope-impact": {
      name: "Laajuus ja vaikutus",
      shortUiText:
        "Roolin ulottuvuus: rajatusta tehtävästä tiimiin, toimintoon, useisiin toimintoihin tai koko yritykseen.",
      fullDefinition:
        "Kuvaa, kuinka pitkälle roolin tulokset ja päätökset ulottuvat organisaatiossa, selkeästi rajatuista omista tehtävistä koko yrityksen kattavaan vaikutukseen. Kriteeri mittaa ulottuvuutta, ei muodollista valtuutta.",
      measures:
        "Roolin ulottuvuutta: rajatusta tehtävästä tiimiin, toimintoon, useisiin toimintoihin tai yritykseen.",
      notMeasures:
        "Muodollista henkilöstövastuuta, budjetin kokoa tai itse valtuutusta.",
      whenSuitable: "Lähes aina relevantti.",
      whenNotSuitable:
        "Ei tule yhdistää erilliseen kriteeriin, joka mittaa vain organisatorista ulottuvuutta.",
      controlQuestion:
        "Onko roolienne ulottuvuuden erolla merkitystä itsessään, valtuutuksen ja seurausten lisäksi?",
      assessmentQuestion:
        "Kuinka pitkälle roolin normaali ja pysyvä vaikutus ulottuu?",
      anchor1:
        "Rooli vaikuttaa ensisijaisesti omien selkeästi rajattujen työtehtävien laatuun, tehokkuuteen tai tulokseen.",
      anchor2:
        "Rooli vaikuttaa rajattuun työalueeseen tai toistuvaan toimitukseen tiimin sisällä.",
      anchor3:
        "Roolilla on itsenäinen vastuu tuloksista selkeällä alueella, ja se vaikuttaa tiiminsä tai lähialueen toimintojen toimituksiin ja priorisointeihin.",
      anchor4:
        "Rooli vaikuttaa useisiin tiimeihin, toimintoon tai merkittävään osaan liiketoiminnasta valinnoilla, priorisoinneilla tai ratkaisuilla, joilla on pysyviä seurauksia.",
      anchor5:
        "Rooli vaikuttaa yrityksen yleiseen suuntaan, tuloksiin tai menestymiskykyyn päätöksillä ja vastuulla, joilla on koko yrityksen kattava tai strateginen vaikutus.",
    },
    "autonomy-mandate": {
      name: "Itsenäisyys ja päätösvalta",
      shortUiText:
        "Kuinka itsenäisesti rooli tekee päätöksiä ja millä tasolla, ennen kuin eskalointi on tarpeen.",
      fullDefinition:
        "Kuvaa, kuinka itsenäisesti rooli tekee päätöksiä, millä tasolla päätökset ovat ja kuinka paljon on eskaloitava jollekulle muulle. Kriteeri mittaa itse päätösvaltaa, ei päätöksen seurausta tai sitä, kuinka pitkälle sen vaikutus ulottuu.",
      measures: "Itsenäisyyttä, päätösten tasoa ja eskaloinnin tarvetta.",
      notMeasures: "Päätöksen seurausta tai sen organisatorista ulottuvuutta.",
      whenSuitable: "Lähes aina relevantti.",
      whenNotSuitable:
        "Päätösvalta tarkoittaa oikeutta päättää, laajuus tarkoittaa sitä, missä vaikutus näkyy, ja riski tarkoittaa seurausta, jos jokin menee pieleen.",
      controlQuestion:
        "Onko roolin päätösvallan tasolla merkitystä itsessään, erillään siitä, missä vaikutukset näkyvät ja mitä seurauksia olisi, jos jokin menisi pieleen?",
      assessmentQuestion:
        "Millaista itsenäisyyttä ja päätösvaltaa roolilla on normaalisti ja pysyvästi?",
      anchor1:
        "Rooli tekee päätöksiä selkeästi rajatun tehtävän puitteissa ja eskaloi kaiken, mikä on vakiintuneen rutiinin ulkopuolella.",
      anchor3:
        "Rooli tekee itsenäisesti vakiintuneita päätöksiä omalla alueellaan ja eskaloi vain aidosti uusia tai alueiden välisiä kysymyksiä.",
      anchor5:
        "Roolilla on erittäin laaja tai liiketoimintakriittinen päätösvalta, ja se päättää kysymyksissä, joiden suunta tai standardit ulottuvat oman lähialueen ulkopuolelle, ja eskaloinnin tarve on vähäinen.",
    },
    "risk-consequence": {
      name: "Riski ja seuraukset",
      shortUiText:
        "Seuraukset liiketoiminnalle, jos roolin päätökset, virheet tai puutteet menevät pieleen.",
      fullDefinition:
        "Kuvaa seurauksia, joita roolin päätöksillä, virheillä tai puutteilla voi olla turvallisuudelle, asiakkaalle, laadulle, vaatimustenmukaisuudelle, tiedolle tai brändille. Kriteeri mittaa seurauksia laajasti, ei pelkästään taloudellista riskiä tai sitä, kuinka kuormittavana yksilö kokee roolin.",
      measures:
        "Päätösten, virheiden tai puutteiden seurauksia turvallisuudelle, asiakkaalle, laadulle, vaatimustenmukaisuudelle, tiedolle tai brändille.",
      notMeasures: "Pelkästään taloudellista riskiä tai yksilön stressitasoa.",
      whenSuitable: "Lähes aina relevantti.",
      whenNotSuitable:
        "Vältä erillistä vaatimustenmukaisuusriskiä, jos se on vain esimerkki samasta riskistä ja seurauksesta.",
      controlQuestion:
        "Onko roolin päätösten tai virheiden seurauksella merkitystä itsessään, erillään muodollisesta vaatimustenmukaisuusvastuusta, jota se voi myös kantaa?",
      assessmentQuestion:
        "Millaista riskiä ja seurauksia roolin päätökset ja työ normaalisti ja pysyvästi kantavat?",
      anchor1:
        "Virheillä tai puutteilla on tavallisesti rajalliset ja helposti korjattavat seuraukset omalla työalueella.",
      anchor2:
        "Virheet tai puutteet voivat vaikuttaa tiimin laatuun, tehokkuuteen tai toimitukseen ja edellyttävät tavallisesti korjaamista vakiintuneiden prosessien puitteissa.",
      anchor3:
        "Virheillä, päätöksillä tai puutteilla voi olla selkeitä seurauksia asiakkaalle, toimitukselle, laadulle, taloudelle tai vaatimustenmukaisuudelle yhdellä alueella.",
      anchor4:
        "Virheillä, päätöksillä tai puutteilla voi olla merkittäviä seurauksia useille liiketoiminnan osa-alueille, tärkeille asiakkaille, kriittisille prosesseille tai säännösten noudattamiselle.",
      anchor5:
        "Virheillä, päätöksillä tai puutteilla voi olla erittäin suuria, pitkäkestoisia tai liiketoimintakriittisiä seurauksia strategialle, turvallisuudelle, vaatimustenmukaisuudelle, luottamukselle tai selviytymiskyvylle.",
    },
    "people-leadership": {
      name: "Henkilöstö- ja johtamisvastuu",
      shortUiText:
        "Roolin muodollinen vastuu ihmisten johtamisesta ja tulosten aikaansaamisesta heidän kauttaan.",
      fullDefinition:
        "Kuvaa roolin muodollista vastuuta ihmisten johtamisesta: työn jakamisesta, heidän valmiuksiensa kehittämisestä ja tulosten aikaansaamisesta muiden kautta. Kriteeri mittaa muodollista henkilöstövastuuta, ei projektinjohtoa ilman tätä vastuuta, asiantuntijajohtajuutta eikä tiimin kokoa ainoana mittarina.",
      measures:
        "Vastuuta ihmisten johtamisesta, työn jakamisesta, valmiuksien kehittämisestä ja tulosten aikaansaamisesta muiden kautta.",
      notMeasures:
        "Projektinjohtoa ilman henkilöstövastuuta, asiantuntijajohtajuutta tai tiimin kokoa ainoana mittarina.",
      whenSuitable:
        "Kun muodollinen henkilöstövastuu on olennainen ero roolien välillä.",
      whenNotSuitable:
        "Tulisi yleensä painottaa vähän tai kohtalaisesti, koska esimiesasema näkyy usein jo laajuudessa ja päätösvallassa.",
      controlQuestion:
        "Onko roolin muodollisella henkilöstövastuulla merkitystä itsessään, sen laajuuden ja päätösvallan jo kattaman lisäksi?",
      assessmentQuestion:
        "Millaista henkilöstö- ja johtamisvastuuta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Roolilla ei ole muodollista henkilöstövastuuta tai se on hyvin rajallista, kuten satunnaista yhden tai kahden muun henkilön tehtävien koordinointia.",
      anchor3:
        "Roolilla on vakiintunut, itsenäinen vastuu tiimin johtamisesta: työn jakamisesta, valmiuksien kehittämisestä ja tulosten aikaansaamisesta muiden kautta.",
      anchor5:
        "Rooli kantaa erittäin pitkälle kehittynyttä tai liiketoimintakriittistä henkilöstö- ja johtamisvastuuta, johtaa johtajia tai suurta organisaatiota ja asettaa usein standardin sille, miten ihmisiä johdetaan oman tiimin ulkopuolella.",
    },
    "resource-capacity": {
      name: "Resurssi- ja kapasiteettivastuu",
      shortUiText:
        "Roolin vastuu olennaisten resurssien tai kapasiteetin priorisoinnista ja käytöstä.",
      fullDefinition:
        "Kuvaa roolin vastuuta priorisoida ja käyttää olennaisia resursseja, kapasiteettia, omaisuutta tai kriittistä toimituskykyä siten, että liiketoiminta jatkuu. Kriteeri mittaa itsenäistä resurssiohjausta, ei rutiininomaista budjettiseurantaa tai hankintoja pienten, ennalta määrättyjen rajojen puitteissa.",
      measures:
        "Vastuuta priorisoida ja käyttää resursseja siten, että liiketoiminta toimii.",
      notMeasures:
        "Tavanomaista budjettiseurantaa tai hankintoja pienten rajojen puitteissa.",
      whenSuitable:
        "Kun rooli päättää itsenäisesti olennaisista resursseista, kapasiteetista, omaisuudesta tai kriittisestä toimituskyvystä.",
      whenNotSuitable:
        "Ei tule valita samanaikaisesti suppean taloudellisen vastuun kanssa, jos molemmat mittaavat samaa resurssiohjausta.",
      controlQuestion:
        "Onko roolin itsenäisellä vastuulla resursseista tai kapasiteetista merkitystä itsessään, erillään rutiininomaisesta budjettiseurannasta ennalta määrättyjen rajojen puitteissa?",
      assessmentQuestion:
        "Millaista resurssi- ja kapasiteettivastuuta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooli priorisoi itsenäisesti pienen, selkeästi rajatun resurssi- tai kapasiteettijoukon käyttöä omalla alueellaan, jossa sen valinnoilla on rajallinen ja helposti korjattava vaikutus.",
      anchor3:
        "Rooli priorisoi ja jakaa itsenäisesti vakiintuneita resursseja tai kapasiteettia siten, että oma alue jatkaa toimintaansa.",
      anchor5:
        "Rooli hallinnoi itsenäisesti erittäin merkittäviä tai liiketoimintakriittisiä resursseja, kapasiteettia tai toimituskykyä päätöksillä, jotka muovaavat resurssien priorisointia oman alueen ulkopuolella.",
    },
    "business-customer": {
      name: "Liiketoiminta- ja asiakasvastuu",
      shortUiText:
        "Roolin vastuu olennaisen liiketoiminta-arvon luomisesta, turvaamisesta tai kehittämisestä.",
      fullDefinition:
        "Kuvaa roolin vastuuta luoda, turvata tai kehittää olennaista liiketoiminta-arvoa merkittävän asiakassuhteen, tulovirran, liiketoimintasalkun tai kaupallisen aseman kautta. Kriteeri mittaa tämän liiketoimintavastuun vakautta, ei yksilön myyntisuoritusta, provisiota tai neuvottelutaitoa sinänsä.",
      measures:
        "Vastuuta olennaisen liiketoiminta-arvon luomisesta, turvaamisesta tai kehittämisestä.",
      notMeasures:
        "Yksilön myyntisuoritusta, provisiota tai neuvottelutaitoa sinänsä.",
      whenSuitable:
        "Kun rooli vastaa suoraan merkittävästä asiakassuhteesta, tulovirrasta, liiketoimintasalkusta tai kaupallisesta asemasta.",
      whenNotSuitable:
        "Ei saa automaattisesti suosia myyntirooleja; vastuun on oltava vakaa osa roolia.",
      controlQuestion:
        "Onko roolin vakaalla vastuulla liiketoiminta- tai asiakasarvosta merkitystä itsessään, erillään yksilön myyntisuorituksesta tai neuvottelutaidosta?",
      assessmentQuestion:
        "Millaista liiketoiminta- ja asiakasvastuuta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooli tukee asiakassuhdetta tai liiketoimintaa selkeästi rajatun, vakiintuneen asiakastilin tai tehtävän puitteissa.",
      anchor3:
        "Roolilla on itsenäinen, vakiintunut vastuu asiakassuhteesta, tulovirrasta tai liiketoimintasalkusta, joka on vakaa osa roolia.",
      anchor5:
        "Rooli kantaa erittäin merkittävää tai liiketoimintakriittistä vastuuta suurista asiakassuhteista, tuloista tai kaupallisesta asemasta päätöksillä, jotka muovaavat liiketoiminnan suuntaa oman salkun ulkopuolella.",
    },
    "compliance-control": {
      name: "Tieto-, turvallisuus- tai vaatimustenmukaisuusvastuu",
      shortUiText:
        "Roolin muodollinen vastuu suojauksesta, laadunvarmistuksesta tai vaatimustenmukaisuuden valvonnasta.",
      fullDefinition:
        "Kuvaa roolin muodollista vastuuta suojauksesta, laadunvarmistuksesta, valvonnasta tai kriittisten vaatimusten, kuten tietoturvan tai säännösten noudattamisen, oikeasta soveltamisesta. Kriteeri mittaa erillistä, muodollista valvontavastuuta, ei yleistä riskitietoisuutta, jota jokaisen roolin odotetaan omaavan.",
      measures:
        "Vastuuta suojauksesta, laadunvarmistuksesta, valvonnasta tai kriittisten vaatimusten oikeasta soveltamisesta.",
      notMeasures: "Yleistä riskitietoisuutta.",
      whenSuitable:
        "Säännellyt, turvallisuuskriittiset tai data-painotteiset toiminnot, joissa on erillinen muodollinen valvontavastuu.",
      whenNotSuitable:
        "Valitse vain, jos vastuu on erillinen Riski ja seuraukset -kriteeristä.",
      controlQuestion:
        "Onko roolin muodollisella valvontavastuulla merkitystä itsessään, erillään yleisestä riskistä ja seurauksista, joita se myös kantaa?",
      assessmentQuestion:
        "Millaista tieto-, turvallisuus- tai vaatimustenmukaisuusvastuuta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooli noudattaa vakiintuneita valvontarutiineja selkeästi rajatulla alueella, ilman itsenäistä valvontavastuuta.",
      anchor3:
        "Roolilla on itsenäinen, vakiintunut, muodollinen vastuu suojauksesta, laadunvarmistuksesta tai vaatimustenmukaisuuden valvonnasta omalla alueellaan.",
      anchor5:
        "Rooli kantaa erittäin pitkälle kehittynyttä tai liiketoimintakriittistä valvontavastuuta, ja tapa, jolla se soveltaa kriittisiä vaatimuksia, asettaa usein standardin vaatimustenmukaisuudelle oman alueen ulkopuolella.",
    },
    "safety-exposure": {
      name: "Turvallisuus- ja altistumisolosuhteet",
      shortUiText:
        "Roolin pysyvä vaatimus työskennellä riskiympäristössä suojatoimenpiteiden alaisena.",
      fullDefinition:
        "Kuvaa pysyvää riskiympäristöä, jossa rooli työskentelee, ja vaatimusta työskennellä suojatoimenpiteiden alaisena, mikä kattaa todellisen fyysisen, kemiallisen, biologisen tai ympäristöön liittyvän altistumisen. Kriteeri mittaa itse työolosuhdetta, ei seurausta liiketoiminnalle, jos jokin menee pieleen.",
      measures:
        "Pysyvää riskiympäristöä ja vaatimusta työskennellä suojatoimenpiteiden alaisena.",
      notMeasures: "Seurausta yritykselle virheestä.",
      whenSuitable:
        "Roolit, joissa on todellista fyysistä, kemiallista, biologista, ympäristöön liittyvää tai muuta altistumista.",
      whenNotSuitable:
        "Älä valitse samanaikaisesti laajemman työolosuhdekriteerin kanssa, joka kattaa saman altistumisen.",
      controlQuestion:
        "Onko roolin altistumisella pysyvälle riskiympäristölle merkitystä itsessään, sen lisäksi mitä kriteeri Fyysinen tai aisteihin kohdistuva rasitus jo kattaa?",
      assessmentQuestion:
        "Millaisen turvallisuuden ja altistumisen tasolla rooli normaalisti ja pysyvästi työskentelee?",
      anchor1:
        "Rooli altistuu satunnaisesti selkeästi rajatulle, matalan tason turvallisuus- tai altistumisolosuhteelle, jossa käytetään vakioituja suojatoimenpiteitä.",
      anchor3:
        "Rooli työskentelee vakiintuneessa, toistuvassa riskiympäristössä, joka edellyttää suojatoimenpiteiden johdonmukaista käyttöä tavanomaisena osana työtä.",
      anchor5:
        "Rooli työskentelee erittäin vaativissa tai liiketoimintakriittisissä altistumisolosuhteissa, joissa sen noudattama tai asettama suojelustandardi ulottuu usein oman lähitiimin ulkopuolelle.",
    },
    "on-call": {
      name: "Päivystys, valmius ja saatavuusvaatimukset",
      shortUiText:
        "Roolin toistuva vaatimus olla tavoitettavissa varsinaisen työajan ulkopuolella tai vastata välittömästi.",
      fullDefinition:
        "Kuvaa roolin toistuvaa vaatimusta olla tavoitettavissa varsinaisen työajan ulkopuolella tai vastata välittömästi roolin kiinteänä edellytyksenä. Kriteeri mittaa olennaista, toistuvaa päivystysvaatimusta, ei tilapäistä ylityötä, vapaaehtoista joustavuutta tai yleisesti suurta työmäärää.",
      measures:
        "Toistuvaa vaatimusta tavoitettavuudesta varsinaisen työajan ulkopuolella tai välittömästä toiminnasta.",
      notMeasures:
        "Tilapäistä ylityötä, vapaaehtoista joustavuutta tai suurta työmäärää.",
      whenSuitable:
        "Operatiiviset, IT-, terveydenhuolto-, turvallisuus- ja muut roolit, joissa päivystys on roolin kiinteä edellytys.",
      whenNotSuitable:
        "Tulisi olla oma kriterinsä vain, kun päivystys on olennaista ja toistuvaa.",
      controlQuestion:
        "Onko roolin toistuvalla päivystysvaatimuksella merkitystä itsessään, tilapäisen ylityön tai yleisesti suuren työmäärän lisäksi?",
      assessmentQuestion:
        "Millaista päivystystä, valmiutta ja saatavuutta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooli kattaa satunnaisesti selkeästi rajatun, harvoin toistuvan päivystysvaatimuksen.",
      anchor3:
        "Rooli kantaa vakiintunutta, toistuvaa päivystys- tai saatavuusvaatimusta varsinaisen työajan ulkopuolella tavanomaisena osana roolia.",
      anchor5:
        "Rooli kantaa erittäin vaativaa tai liiketoimintakriittistä päivystysvaatimusta, johon liittyy usein toistuva tai välitön toimintavelvollisuus, jonka ympärille muiden roolien saatavuus usein rakennetaan.",
    },
    "irregularity-mobility": {
      name: "Epäsäännöllisyys, liikkuvuus ja paikkasidonnaisuus",
      shortUiText:
        "Roolin pysyvä vaatimus epäsäännöllisistä työajoista, laajasta matkustamisesta tai työskentelystä tietyissä paikoissa.",
      fullDefinition:
        "Kuvaa roolin pysyvää vaatimusta epäsäännöllisistä työajoista, laajasta matkustamisesta tai tiettyihin paikkoihin sidotusta työstä, kuten kenttä-, vuoro- tai kansainvälisestä työstä. Kriteeri mittaa roolin vakaata, rakenteellista ominaisuutta, ei yksittäisiä matkoja, henkilökohtaisia toiveita tai tilapäistä projektia.",
      measures:
        "Pysyvää vaatimusta epäsäännöllisistä työajoista, laajasta matkustamisesta tai työskentelystä tietyissä paikoissa.",
      notMeasures:
        "Yksittäisiä matkoja, henkilökohtaisia toiveita tai tilapäisiä projekteja.",
      whenSuitable:
        "Kenttäroolit, kansainvälinen toiminta, vuorotyö tai tiheä matkustaminen.",
      whenNotSuitable:
        "Voidaan yhdistää Päivystys/valmius-kriteeriin vain, kun molemmat kuuluvat samaan vakaaseen työehtoon.",
      controlQuestion:
        "Onko roolin pysyvällä epäsäännöllisyys- tai liikkuvuusvaatimuksella merkitystä itsessään, yksittäisten matkojen tai tilapäisen projektin lisäksi?",
      assessmentQuestion:
        "Millaista epäsäännöllisyyttä, liikkuvuutta tai paikkasidonnaisuutta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rooli kantaa toistuvaa, mutta rajallista vaatimusta epäsäännöllisistä ajoista, matkustamisesta tai paikkasidonnaisesta työstä, kuten säännöllistä mutta harvoin toistuvaa mallia, joka on roolin pysyvä osa.",
      anchor3:
        "Rooli kantaa vakiintunutta, toistuvaa mallia epäsäännöllisistä ajoista, matkustamisesta tai paikkasidonnaisesta työstä tavanomaisena ja vakaana osana roolia.",
      anchor5:
        "Rooli kantaa erittäin laajaa tai liiketoimintakriittistä epäsäännöllisyyttä, liikkuvuutta tai paikkasidonnaisuutta, kuten pysyviä kansainvälisiä, vuorotyö- tai kenttäsitoumuksia, jotka muovaavat sitä, miten rooliin voidaan rekrytoida henkilöstöä.",
    },
    "restricted-environments": {
      name: "Erityiset turvallisuus-, salassapito- tai valvontaympäristöt",
      shortUiText:
        "Roolin vaatimus työskennellä erityisten pääsy-, valvonta- tai turvallisuusrajoitusten alaisena.",
      fullDefinition:
        "Kuvaa työolosuhdetta, jossa toimitaan erityisten pääsy-, valvonta- tai turvallisuusrajoitusten alaisena, kuten turvallisuusluokitellussa tai salassapidolle herkässä ympäristössä. Kriteeri mittaa rajoitusta, jonka alaisena rooli työskentelee, ei vastuuta tietoturvasta sinänsä.",
      measures:
        "Työolosuhdetta, jossa työskennellään erityisten pääsy-, valvonta- tai turvallisuusrajoitusten alaisena.",
      notMeasures: "Vastuuta tietoturvasta.",
      whenSuitable:
        "Turvallisuusluokitellut, salassapidolle herkät tai tiukasti valvotut ympäristöt, joissa on todellisia rajoituksia.",
      whenNotSuitable:
        "Käytä vain, kun mitattavana on työympäristö/edellytys, ei valvontavastuu.",
      controlQuestion:
        "Onko roolin vaatimuksella työskennellä erityisten pääsy- tai turvallisuusrajoitusten alaisena merkitystä itsessään, erillään muodollisesta valvontavastuusta, jota se voi myös kantaa?",
      assessmentQuestion:
        "Millaisen turvallisuus-, salassapito- tai valvontarajoituksen alaisena rooli normaalisti ja pysyvästi työskentelee?",
      anchor1:
        "Rooli työskentelee satunnaisesti selkeästi rajatun, matalan tason pääsy- tai salassapitorajoituksen alaisena.",
      anchor3:
        "Rooli työskentelee vakiintuneiden, toistuvien pääsy-, valvonta- tai turvallisuusrajoitusten alaisena tavanomaisena osana roolia.",
      anchor5:
        "Rooli työskentelee erittäin tiukkojen tai liiketoimintakriittisten turvallisuus-, salassapito- tai valvontarajoitusten alaisena, jotka muovaavat sitä, miten roolia ja sen ympäristöä on johdettava.",
    },
  },
}
