import type { CriteriaLibraryContent } from "./criteriaLibrary.content.en"

// Finnish content for the criteria library (the masterdokument's sections
// 5-13.5). Machine-translated from criteriaLibraryContentSv (the substance
// source), cross-checked against criteriaLibraryContentEn where a Swedish
// phrase was ambiguous. Structure mirrors en/sv exactly: only the three
// section 13.5 entries (scope-impact, complexity-ambiguity,
// risk-consequence) carry anchor2/anchor4. Reviewed against en and sv for
// terminology, register and false friends; "ulottuvuus" is reserved for the
// dimension, so a role's reach is "vaikutusalue".
export const criteriaLibraryContentFi: CriteriaLibraryContent = {
  modelName: "Roolien arviointimalli",
  dimensions: {
    competence: {
      name: "Osaaminen",
      question:
        "Mitä tietoja, taitoja, kokemusta ja pätevyyttä rooli edellyttää?",
      why: "Suojaa asiantuntija-, ammatti- ja pätevyyttä vaativia rooleja aliarvioinnilta.",
    },
    effort: {
      name: "Ponnistus ja monimutkaisuus",
      question:
        "Kuinka vaikea, epäselvä, analyyttisesti, viestinnällisesti tai fyysisesti vaativa rooli on?",
      why: "Tekee vaativan työn näkyväksi myös silloin, kun roolilla ei ole muodollista esihenkilövaltaa.",
    },
    responsibility: {
      name: "Vastuu ja vaikutus",
      question:
        "Kuinka laaja vaikutusalue, millainen päätösvalta ja millaiset seuraukset roolilla on?",
      why: "Kuvaa vastuuta päätöksistä, tuloksista, riskeistä, ihmisistä, laadusta ja liiketoiminnasta.",
    },
    workingConditions: {
      name: "Työolosuhteet",
      question:
        "Onko olemassa erityisiä, objektiivisia ja pysyviä työolosuhteita, jotka vaikuttavat vaatimuksiin?",
      why: "Tekee näkyväksi esimerkiksi päivystyksen, altistumisen, turvallisuusvaatimukset ja epäsäännölliset olosuhteet.",
    },
  },
  workingConditionsTest: {
    question:
      "Onko olemassa vähintään yksi rooliperhe, jossa erityiset työolosuhteet ovat toistuva, objektiivinen ja olennainen osa roolin vaatimuksia eikä vaatimusta jo kata oikein toinen kriteeri?",
    notMaterialLabel: "Testattu, mutta ei olennaisesti relevantti",
  },
  sharedScale: {
    "1": {
      name: "Rajattu vaatimus",
      meaning:
        "Vaatimus on selkeästi määritelty, paikallinen tai laajuudeltaan rajattu. Vakiintuneet puitteet ja toimintatavat riittävät yleensä.",
    },
    "2": {
      name: "Perustasosta kohtalaiseen ulottuva vaatimus",
      meaning:
        "Vaatimus toistuu selkeästi rajatulla alueella. Vaihtelut ja yksinkertaisemmat poikkeamat on hoidettava.",
    },
    "3": {
      name: "Itsenäinen ja vakiintunut vaatimus",
      meaning:
        "Vaatimus on selkeä ja toistuva osa aluetta. Ammatilliset arviot tehdään vakiintuneiden puitteiden sisällä.",
    },
    "4": {
      name: "Vaativa tai laaja-alainen vaatimus",
      meaning:
        "Vaatimus on vaativa, ulottuu laajemmalle tai edellyttää itsenäisiä punnintoja, joihin vakiintuneet toimintatavat eivät aina riitä.",
    },
    "5": {
      name: "Erittäin vaativa, laaja tai liiketoimintakriittinen vaatimus",
      meaning:
        "Vaatimuksella on erittäin suuri laajuus, vaikeusaste, seuraus tai strateginen merkitys. Se voi vaikuttaa suuntaan, standardeihin, ratkaisuihin tai tuloksiin myös lähialueen ulkopuolella.",
    },
  },
  midpoints: {
    step2: "Harkittu välitaso portaiden 1 ja 3 välillä.",
    step4: "Harkittu välitaso portaiden 3 ja 5 välillä.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Tiedon syvyys ja asiantuntijataso",
      shortUiText: "Syvä erikoisosaaminen rajatulla ammattialueella.",
      fullDefinition:
        "Kattaa syvän ammattitiedon, asiantuntijamenetelmät ja olennaisen kokemuksen yhdellä pääalueella. Kriteeri koskee sitä, kuinka syvää osaamisen on oltava, jotta alueen vaikeat kysymykset voidaan ratkaista. Se ei koske osaamisen laajuutta, muodollisia kelpoisuuksia, toimintaympäristön tuntemusta eikä neuvonantoa omana alueenaan.",
      measures:
        "Syvä ammattitieto, asiantuntijamenetelmät, olennainen ja pysyvä kokemus yhdeltä alueelta.",
      notMeasures:
        "Osaamisalueiden lukumäärä, muodollinen tutkinto tai sertifiointi sinänsä, tietyn toimialan tai organisaation tuntemus sinänsä, päätösvalta tai yksilön suoriutuminen.",
      whenSuitable:
        "Valitse, kun syvää erikoisosaamista yhdellä ammattialueella halutaan painottaa erityisesti samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään koulutusvaatimusten, useiden ammattialueiden välisen laajan yhteistyön tai neuvonannon vuoksi. Arvioi sen sijaan, kattaako jokin lähikriteeri paremmin sen, mitä yritys haluaa painottaa.",
      controlQuestion:
        "Onko syvä erikoisosaaminen alue, jota haluatte painottaa erityisesti samanarvoisuuden arvioinnissa?",
      assessmentQuestion:
        "Millaista asiantuntemuksen syvyyttä rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Vakiintunutta ja hyvin dokumentoitua ammattitietoa selkeästi rajatulla alueella. Tunnetut menetelmät riittävät tuttuihin kysymyksiin.",
      anchor3:
        "Syvennettyä erikoisosaamista ja vakiintunutta ammattimetodiikkaa käytetään itsenäisesti alueen toistuviin ja vaativampiin kysymyksiin.",
      anchor5:
        "Erittäin syvää erikoisosaamista käytetään alan vaikeimpiin kysymyksiin. Osaaminen auttaa kehittämään menetelmiä, laatutasoja tai ammatillista käytäntöä.",
    },
    "knowledge-breadth": {
      name: "Tiedon laajuus ja poikkitieteellinen ymmärrys",
      shortUiText:
        "Kyky yhdistää useita osaamisalueita ja ymmärtää niiden väliset yhteydet.",
      fullDefinition:
        "Kattaa tarpeen yhdistää tietoa useilta eri alueilta, esimerkiksi liiketoiminnasta, tekniikasta, datasta, tuotteesta ja toiminnasta. Kriteeri koskee alueiden välisten yhteyksien ja punnintojen ymmärtämistä. Se ei koske yksittäisen ammattialueen syvyyttä eikä kontaktien tai yhteistyökumppanien määrää.",
      measures:
        "Osaamisalueiden laajuus, alueiden välisten yhteyksien ymmärtäminen, kyky punnita eri näkökulmia keskenään.",
      notMeasures:
        "Syvä erikoisosaaminen yhdellä alueella, kokousten, sidosryhmien tai kontaktipintojen määrä, organisatorinen ulottuvuus.",
      whenSuitable:
        "Valitse, kun kokonaisnäkemystä ja kykyä yhdistää useita osaamisalueita halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään lukuisten kontaktipintojen vuoksi. Jos kyse on ennen kaikkea syvästä ammattitiedosta yhdellä alueella, 7.1 osuu paremmin.",
      controlQuestion:
        "Onko kyky yhdistää useita osaamisalueita keskeinen sille, miten toiminta luo arvoa?",
      assessmentQuestion:
        "Millaista monialaista laajuutta rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Käytössä on yksi pääosaamisalue. Yhteyksiä muihin alueisiin tarvitaan harvoin.",
      anchor3:
        "Muutamaa vakiintunutta osaamisaluetta yhdistetään itsenäisesti ymmärtäen, miten ne vaikuttavat toisiinsa.",
      anchor5:
        "Monia eri osaamisalueita yhdistetään tavalla, joka vaikuttaa siihen, miten laajempia ratkaisuja, tarjoomia tai toimintatapoja muotoillaan.",
    },
    "formal-qualifications": {
      name: "Muodolliset kelpoisuus-, pätevyys- ja sertifiointivaatimukset",
      shortUiText: "Pakollinen laillistus, pätevyys tai sertifiointi.",
      fullDefinition:
        "Kattaa muodolliset vaatimukset, joiden on täytyttävä, jotta tiettyä toimintaa saa tehdä, hyväksyä, allekirjoittaa tai siitä vastata. Esimerkkejä ovat laillistus, lakisääteinen pätevyys ja pakollinen sertifiointi. Kriteeri koskee pakollisia vaatimuksia, ei koulutuksia, kursseja tai tutkintoja, jotka ovat ansioksi mutta eivät välttämättömiä.",
      measures:
        "Pakollinen laillistus, lakisääteinen tai toiminnan edellyttämä pätevyys, pakollinen sertifiointi.",
      notMeasures:
        "Yleinen koulutustaso, vapaaehtoiset kurssit, arvostettu tutkinto ilman pätevyysvaatimusta.",
      whenSuitable:
        "Valitse, kun pakollisia laillistuksia, pätevyyksiä tai sertifiointeja halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse, kun koulutus on ennen kaikkea väylä osaamiseen, jonka 7.1 Tiedon syvyys ja asiantuntijataso jo kattaa.",
      controlQuestion:
        "Halutaanko pakollisten laillistusten, pätevyyksien tai sertifiointien vaikuttaa samanarvoisuuden arviointiin?",
      assessmentQuestion:
        "Millaista muodollista pätevyyttä, lupaa tai sertifiointia rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Ei pakollista vaatimusta, tai perustason selkeästi rajattu vaatimus, jonka uusiminen tai laajuus on vähäinen.",
      anchor3:
        "Vakiintunut ammatillinen laillistus tai sertifiointi, joka on toistuva ja itsenäinen ehto alalla toimimiselle.",
      anchor5:
        "Vaativa tai toiminnan kannalta kriittinen pätevyys, jota edellytetään erittäin suuria seurauksia sisältävän toiminnan hyväksymiseen, allekirjoittamiseen tai siitä vastaamiseen.",
    },
    "domain-knowledge": {
      name: "Toimiala- ja toimintaympäristötuntemus",
      shortUiText:
        "Syvä tuntemus toimialasta, tuotteesta, asiakasympäristöstä tai toimintaympäristöstä.",
      fullDefinition:
        "Kattaa tuntemuksen siitä ympäristöstä, jossa toimintaa harjoitetaan, esimerkiksi toimialasta, tuotteesta, asiakasympäristöstä, liiketoimintamallista tai sääntelystä. Kriteeri koskee ympäristösidonnaista tietoa, joka ei korvaudu nopeasti yleisellä ammattitiedolla. Se ei koske tavanomaista organisaation tuntemusta, joka karttuu perehdytyksen ja kokemuksen myötä.",
      measures:
        "Toimialatuntemus, tuote- ja asiakastuntemus, liiketoimintamallin tai sääntely-ympäristön tuntemus.",
      notMeasures:
        "Yleinen ammattitaito, tavanomainen organisaation tuntemus, muodollinen pätevyys.",
      whenSuitable:
        "Valitse, kun toimintaympäristön erityistuntemusta halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse, kun yleinen ammattitieto ja tavanomainen perehdytys riittävät toimintaympäristön ymmärtämiseen.",
      controlQuestion:
        "Halutteko ottaa huomioon, kuinka paljon toiminta- ja toimialatuntemusta eri alueilla tarvitaan?",
      assessmentQuestion:
        "Millaista toimiala- ja liiketoimintaosaamista rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Selkeästi rajatun tuote-, prosessi- tai asiakasympäristön tuntemus.",
      anchor3:
        "Vakiintunut ja itsenäinen toimintaympäristön tuntemus, joka ei korvaudu nopeasti yleisellä ammattitiedolla.",
      anchor5:
        "Erittäin syvä ja vaikeasti korvattava toimialan, markkinan, asiakkaiden tai sääntelyn tuntemus, joka vaikuttaa tärkeisiin valintoihin ja toimintatapoihin.",
    },
    "advisory-judgment": {
      name: "Neuvonanto- ja harkintaosaaminen",
      shortUiText:
        "Pätevä neuvonanto ja ammatillinen harkinta muiden päätösten pohjaksi.",
      fullDefinition:
        "Kattaa pätevän neuvonannon toistuvana osana toiminnan tarjoomaa tai ratkaisevana päätöstukena asiakkaille, kumppaneille tai sisäisille päättäjille. Siihen kuuluu tosiseikkojen punnitseminen, epävarman tai ristiriitaisen aineiston arviointi sekä sellaisten neuvojen tai suositusten muotoilu, joita muut käyttävät omissa valinnoissaan. Kriteeri koskee neuvonannon ja harkinnan laatua. Se ei koske muodollista oikeutta tehdä lopullinen päätös.",
      measures:
        "Aineiston pätevä arviointi, neuvonanto ja suositukset, ammatillinen harkinta punnintaa vaativissa kysymyksissä.",
      notMeasures:
        "Muodollinen päätösvalta, yleisen tiedon jakaminen, erikoisosaaminen sinänsä.",
      whenSuitable:
        "Valitse, kun pätevää neuvonantoa ja ammatillista harkintaa halutaan painottaa erityisesti samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään tiedon jakamisen tai rutiinivastausten vuoksi. Neuvonannolla on oltava selkeä merkitys valinnoille tai päätöksille.",
      controlQuestion:
        "Onko pätevä neuvonanto ja ammatillinen harkinta jotain, jolle haluatte antaa painoa samanarvoisuuden arvioinnissa?",
      assessmentQuestion:
        "Millaista neuvonanto- ja harkintaosaamista rooli normaalisti ja pysyvästi edellyttää?",
      anchor1:
        "Aineistoa tai mutkattomia neuvoja selkeästi rajatulla alueella vakiintuneen ohjeistuksen tuella.",
      anchor3:
        "Itsenäisiä ja vakiintuneita ammatillisia neuvoja yhdellä alueella olennaisen tiedon punnintaan perustuen.",
      anchor5:
        "Neuvoja ja arvioita erittäin vaativissa tai arkaluonteisissa kysymyksissä, joilla on suuri merkitys toiminnan valinnoille tai riskien hallinnalle.",
    },
    "complexity-ambiguity": {
      name: "Monimutkaisuus ja epäselvyys",
      shortUiText:
        "Käsiteltävien kysymysten vaikeusaste, epävarmuus ja epäselvyys.",
      fullDefinition:
        "Kattaa epävarmuuden asteen, ristiriitaiset vaatimukset, epäselvät tavoitteet ja valmiiden ratkaisujen puuttumisen. Kriteeri koskee itse ongelmien luonnetta. Se ei koske niiden käsittelyyn käytetyn analyysin määrää, työtahtia eikä organisatorista ulottuvuutta.",
      measures:
        "Epäselvät puitteet ja tavoitteet, ristiriitaiset vaatimukset ja punninnat, epävarmuus ja monimutkaiset riippuvuudet.",
      notMeasures:
        "Analyysityön laajuus, suuri työmäärä tai tahti, erikoisosaaminen sinänsä.",
      whenSuitable:
        "Valitse, kun vaikeiden, epäselvien tai monitahoisten kysymysten käsittelyä halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään laajan analyysin tai monen samanaikaisen tehtävän vuoksi. Ne kattavat 8.2 ja 8.4, jos ne valitaan.",
      controlQuestion:
        "Halutteko ottaa huomioon käsiteltävien kysymysten epäselvyyden ja vaikeusasteen?",
      assessmentQuestion:
        "Millaista monimutkaisuutta ja epäselvyyttä rooli normaalisti ja pysyvästi käsittelee?",
      anchor1:
        "Selkeästi määritellyt kysymykset, vakiintuneet menetelmät ja ennakoitavat tilanteet.",
      anchor2:
        "Toistuvia vaihteluita ja yksinkertaisempia poikkeamia käsitellään valitsemalla tuttujen vaihtoehtojen väliltä.",
      anchor3:
        "Monimutkaisia kysymyksiä vakiintuneiden puitteiden sisällä, joissa tarvitaan analyysia, priorisointia ja sopeuttamista.",
      anchor4:
        "Vaativia, eri toimintojen välisiä tai osittain epäselviä ongelmia käsitellään, kun vakiintuneet ratkaisut eivät aina riitä.",
      anchor5:
        "Erittäin monimutkaisia tai strategisesti merkittäviä kysymyksiä, joissa epävarmuus on suuri ja joihin on muotoiltava uusia lähestymistapoja tai pitkän aikavälin ratkaisuja.",
    },
    "analytical-effort": {
      name: "Analyyttinen ja ongelmanratkaisua vaativa panos",
      shortUiText:
        "Järjestelmällisen analyysin, vianhaun ja ongelmanratkaisun laajuus.",
      fullDefinition:
        "Kattaa järjestelmällisen analyysin, vianhaun, mallinnuksen, diagnostiikan, testauksen ja laskennan, joita ratkaisuihin pääseminen edellyttää. Kriteeri koskee analyyttistä panosta. Se ei koske pelkästään sitä, että ongelma on epäselvä, eikä analyysin taustalla olevaa erikoisosaamista.",
      measures:
        "Järjestelmällinen analyysi, vianhaku ja diagnostiikka, mallinnus, testaus ja laskenta.",
      notMeasures:
        "Ongelman epäselvyys sinänsä, erikoisosaaminen sinänsä, tilapäinen suuri työmäärä.",
      whenSuitable:
        "Valitse, kun järjestelmällistä analyysi- ja ongelmanratkaisutyötä halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään epäselvien kysymysten vuoksi. Analyysin, vianhaun tai diagnostiikan on oltava toistuva ja selkeä osa työtä.",
      controlQuestion:
        "Halutaanko järjestelmällisen analyysi- ja ongelmanratkaisutyön laajuuden vaikuttaa samanarvoisuuden arviointiin?",
      assessmentQuestion:
        "Millaista analyyttistä ja ongelmanratkaisuun liittyvää ponnistusta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Mutkatonta analyysia tai vianhakua selkeästi rajatussa kysymyksessä vakiintuneiden vaiheiden mukaan.",
      anchor3:
        "Itsenäistä ja vakiintunutta analyysia, diagnostiikkaa tai järjestelmällistä ongelmanratkaisua yhdellä alueella.",
      anchor5:
        "Erittäin vaativaa tai laajaa analyysia, mallinnusta tai diagnostiikkaa, jolla on suuri merkitys toiminnan kyvylle ratkaista kriittisiä tai toistuvia ongelmia.",
    },
    "communication-effort": {
      name: "Viestintää ja vuorovaikutusta vaativa työ",
      shortUiText:
        "Vaatimukset pätevälle viestinnälle, neuvottelulle ja ristiriitaisten etujen käsittelylle.",
      fullDefinition:
        "Kattaa viestinnän, neuvottelun, vaikuttamisen, ristiriitojen käsittelyn sekä eri tarpeiden ja etujen välisen tulkinnan vaikeusasteen. Kriteeri koskee viestinnällistä ja vuorovaikutuksellista panosta. Se ei koske kontaktien määrää, organisatorista ulottuvuutta eikä liiketoimintavastuuta.",
      measures:
        "Neuvottelu ja vaikuttaminen, vaikeiden keskustelujen ja ristiriitojen käsittely, eri tarpeiden ja etujen välinen tulkinta.",
      notMeasures:
        "Kontaktien tai kokousten määrä, asiakas- tai tuottovastuu, organisatorinen ulottuvuus.",
      whenSuitable:
        "Valitse, kun pätevää viestintää, neuvottelua ja ristiriitaisten etujen käsittelyä halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään kokousten tai asiakaskontaktien määrän vuoksi. Painotettavan on oltava viestinnän vaikeusaste.",
      controlQuestion:
        "Halutaanko pätevän viestinnän, neuvottelun ja ristiriitaisten etujen käsittelyn vaikuttaa samanarvoisuuden arviointiin?",
      assessmentQuestion:
        "Millaista viestintään ja vuorovaikutukseen liittyvää ponnistusta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Selkeästi rajattua ja pääosin rutiininomaista viestintää vakiintuneiden osapuolten kanssa.",
      anchor3:
        "Itsenäistä ja toistuvaa viestintää, neuvottelua tai ristiriitojen käsittelyä vakiintuneiden puitteiden sisällä.",
      anchor5:
        "Erittäin vaativaa tai arkaluonteista viestintää, neuvottelua tai ristiriitojen käsittelyä, jonka lopputuloksella on suuri merkitys toiminnan suhteille tai valinnoille.",
    },
    "operational-intensity": {
      name: "Operatiivinen intensiteetti ja samanaikaisuusvaatimukset",
      shortUiText:
        "Vaatimus hallita useita samanaikaisia virtoja ja priorisoida jatkuvasti.",
      fullDefinition:
        "Kattaa tarkkaavaisuuden, samanaikaisen suorituskyvyn ja jatkuvan priorisoinnin vaatimukset useiden virtojen välillä normaalitilanteessa. Esimerkkejä voivat olla asiakastapaukset, hälytykset, toimitukset tai käyttövirrat. Kriteeri koskee vakaata ja rakenteellista vaatimusta, ei tilapäisiä huippuja, resurssipulaa eikä puutteellista suunnittelua.",
      measures:
        "Useita samanaikaisia virtoja, jatkuva priorisointi, tarkkaavaisuus aikapaineessa normaalitilanteessa.",
      notMeasures:
        "Tilapäinen suuri työkuorma, alimiehitys, itse asiakysymyksen monimutkaisuus.",
      whenSuitable:
        "Valitse, kun useiden samanaikaisten virtojen hallintaa ja priorisointia halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse korvaamaan tilapäisiä työhuippuja tai resurssipulaa. Vaatimuksen on oltava pysyvä osa toiminnan työtapaa.",
      controlQuestion:
        "Halutteko ottaa huomioon vaatimuksen hallita useita samanaikaisia virtoja ja priorisoida jatkuvasti?",
      assessmentQuestion:
        "Millaista operatiivista intensiteettiä ja rinnakkaisten tehtävien vaatimusta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Yksi virta tai tehtävä kerrallaan selkeästi rajatussa rytmissä.",
      anchor3:
        "Useita vakiintuneita ja samanaikaisia virtoja hallitaan itsenäisesti jatkuvasti priorisoiden.",
      anchor5:
        "Erittäin korkea operatiivinen intensiteetti monen samanaikaisen virran yli, jolloin väärä priorisointi voi nopeasti aiheuttaa suuria seurauksia toiminnalle.",
    },
    "physical-sensory": {
      name: "Fyysinen tai aistinvarainen rasitus",
      shortUiText:
        "Toistuva fyysinen kuormitus, tarkkuus tai pitkäkestoisen aistikeskittymisen vaatimus.",
      fullDefinition:
        "Kattaa fyysisen kuormituksen, ergonomisesti vaativat vaiheet, tarkkuuden sekä näköön, kuuloon tai muihin aisteihin perustuvan keskittymisen. Kriteeri koskee kehoon ja tarkkaavaisuuteen kohdistuvia vaatimuksia. Se ei koske riskiympäristöjä, altistumista vaarallisille aineille eikä seurauksia toiminnalle, jos jokin menee vikaan.",
      measures:
        "Fyysinen ja ergonominen kuormitus, tarkkuusvaatimukset, pitkäkestoinen aisteihin perustuva keskittyminen.",
      notMeasures:
        "Riskiympäristö tai altistuminen, yleinen kuormittuneisuus, virheiden seuraukset.",
      whenSuitable:
        "Valitse, kun fyysistä kuormitusta, tarkkuutta tai aistikeskittymistä halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään työympäristön riskin vuoksi. Jos altistuminen ja suojatoimet ovat keskeisiä, 10.1 sopii paremmin.",
      controlQuestion:
        "Halutaanko toistuvan fyysisen kuormituksen, tarkkuuden tai pitkäkestoisen keskittymisen vaikuttaa samanarvoisuuden arviointiin?",
      assessmentQuestion:
        "Millaista fyysistä tai aisteihin kohdistuvaa rasitusta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Kevyitä ja satunnaisia fyysisiä tai aistinvaraisia vaatimuksia selkeästi rajatussa tehtävässä.",
      anchor3:
        "Toistuvaa fyysistä kuormitusta, tarkkuutta vaativia vaiheita tai aistikeskittymistä vakiintuneena osana aluetta.",
      anchor5:
        "Erittäin vaativaa ja pitkäkestoista fyysistä tai aistinvaraista rasitusta, jossa tarkkuus ja johdonmukainen suoritus ovat ratkaisevia.",
    },
    "scope-impact": {
      name: "Vaikutusala ja vaikuttavuus",
      shortUiText: "Tulosten ja vaikutusten ulottuvuus toiminnassa.",
      fullDefinition:
        "Kattaa sen, kuinka laajalle tulokset, valinnat ja toimitukset vaikuttavat toiminnassa: selkeästi rajatusta alueesta tiimeihin, toimintoihin, useisiin yrityksen osiin tai koko yritykseen. Kriteeri koskee sitä, missä vaikutus näkyy. Se ei koske muodollista päätösvaltaa, henkilöstövastuuta eikä budjetin kokoa sinänsä.",
      measures:
        "Tulosten ja vaikutusten ulottuvuus, toiminnan koskettamien osien laajuus, pysyvät seuraukset toiminnan toimituskyvylle tai suunnalle.",
      notMeasures:
        "Muodollinen henkilöstövastuu, päätösvalta, resurssi- tai budjettivastuu sinänsä.",
      whenSuitable:
        "Valitse, kun tulosten ja vaikutusten ulottuvuutta halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään nimikkeen, esihenkilötason, budjetin koon tai päätösvallan vuoksi. Arvioi, kattaako jokin erillisistä vastuukriteereistä paremmin sen, mitä halutaan painottaa.",
      controlQuestion:
        "Onko teille olennaista ottaa huomioon, kuinka laajalle tulokset ja vaikutukset toiminnassa ulottuvat?",
      assessmentQuestion:
        "Kuinka pitkälle roolin normaali ja pysyvä vaikutus ulottuu?",
      anchor1:
        "Tulokset ja vaikutukset rajoittuvat pääosin selkeästi rajattuun alueeseen tai yksittäiseen toimitukseen.",
      anchor2:
        "Vaikutus ulottuu rajattuun työalueeseen tai toistuvaan toimitukseen tiimin sisällä.",
      anchor3:
        "Tulokset ja vaikutukset ulottuvat selkeään alueeseen ja vaikuttavat toimituksiin tai painotuksiin lähialueilla.",
      anchor4:
        "Vaikutus ulottuu useisiin tiimeihin, toimintoon tai merkittävään osaan liiketoiminnasta valinnoilla, priorisoinneilla tai ratkaisuilla, joilla on pysyviä seurauksia.",
      anchor5:
        "Tulokset ja vaikutukset ulottuvat useisiin yrityksen osiin tai koko yritykseen ja vaikuttavat kokonaissuuntaan, tulokseen tai onnistumisen edellytyksiin.",
    },
    "autonomy-mandate": {
      name: "Itsenäisyys ja päätösvalta",
      shortUiText: "Itsenäisyys ja valtuudet tehdä punnintoja ja päätöksiä.",
      fullDefinition:
        "Kattaa valtuudet tehdä itsenäisesti punnintoja ja päätöksiä määritellyllä alueella. Kriteeri koskee sitä liikkumavaraa, joka on valita suunta, priorisoida vaihtoehtojen välillä ja päättää sopivista ratkaisuista alueen sisällä. Se ei koske sitä, kuinka laajalle päätöksen vaikutus ulottuu, kuinka suuria seurauksia virheellä voi olla, eikä sitä, minkätyyppistä vastuuta päätös koskee.",
      measures:
        "Valtuudet tehdä itsenäisiä päätöksiä, liikkumavara valita olennaisten vaihtoehtojen välillä, valtuudet priorisoida ja punnita, itsenäisyyden aste määritellyllä alueella.",
      notMeasures:
        "Tulosten tai vaikutusten ulottuvuus, virheellisten päätösten seuraus, henkilöstö-, resurssi- tai asiakasvastuu sinänsä, yrityksen sisäiset hyväksymisprosessit tai kuulemisen muodot.",
      whenSuitable:
        "Valitse, kun itsenäistä päätösvaltaa halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse kuvaamaan sitä, kuinka laajalle päätöksen vaikutus ulottuu, mitä seurauksia virheellä voi olla tai minkätyyppistä vastuuta päätös koskee. Muut vastuukriteerit kattavat ne, jos ne valitaan.",
      controlQuestion:
        "Halutaanko itsenäisen päätösvallan asteen vaikuttaa samanarvoisuuden arviointiin?",
      assessmentQuestion:
        "Millaista itsenäisyyttä ja päätösvaltaa roolilla on normaalisti ja pysyvästi?",
      anchor1:
        "Rajallinen päätösvalta valita selkeästi määriteltyjen vaihtoehtojen välillä vakiintuneiden ohjeiden puitteissa.",
      anchor3:
        "Itsenäinen päätösvalta tehdä vakiintuneita punnintoja, priorisoida vaihtoehtojen välillä ja tehdä päätöksiä määritellyllä alueella.",
      anchor5:
        "Erittäin laaja päätösvalta tehdä punnintoja ja päätöksiä, jotka asettavat suunnan, periaatteet tai painotukset toiminnan useille osille.",
    },
    "risk-consequence": {
      name: "Riski ja seuraus",
      shortUiText:
        "Virheiden, puutteiden tai virheellisten päätösten mahdollisten seurausten vakavuus.",
      fullDefinition:
        "Kattaa sen, mitä seurauksia virheillä, puutteilla tai virheellisillä päätöksillä voi olla esimerkiksi asiakkaille, laadulle, taloudelle, turvallisuudelle, tiedolle, vaatimustenmukaisuudelle ja luottamukselle. Kriteeri koskee seurausta, jos jokin menee vikaan. Se ei koske sitä, kenellä on muodollinen vastuu valvoa, että säännöt tai suojaukset toimivat.",
      measures:
        "Seuraukset asiakkaalle, laadulle ja toimitukselle, seuraukset turvallisuudelle, tiedolle ja vaatimustenmukaisuudelle, taloudelliset ja maineeseen liittyvät seuraukset.",
      notMeasures:
        "Yksilön kokema kuormitus, budjetin koko sinänsä, muodollinen valvontavastuu.",
      whenSuitable:
        "Valitse, kun virheiden ja puutteiden mahdollisten seurausten eroja halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse kuvaamaan sitä, kuinka paineiselta tai vaativalta jokin tuntuu. Arvioi asiallinen ja mahdollinen seuraus, jos jokin menee vikaan.",
      controlQuestion:
        "Onko virheiden tai puutteiden mahdollisten seurausten eroilla merkitystä samanarvoisuuden arvioinnissa?",
      assessmentQuestion:
        "Millaisia riskejä ja seurauksia roolin päätökset ja työ normaalisti ja pysyvästi kantavat?",
      anchor1:
        "Virheillä tai puutteilla on yleensä rajalliset ja helposti korjattavat seuraukset rajatulla alueella.",
      anchor2:
        "Virheet tai puutteet voivat vaikuttaa tiimin laatuun, tehokkuuteen tai toimitukseen ja edellyttävät tavallisesti korjaamista vakiintuneiden prosessien puitteissa.",
      anchor3:
        "Virheillä, puutteilla tai virheellisillä päätöksillä voi olla selkeitä seurauksia asiakkaalle, toimitukselle, laadulle, taloudelle tai vaatimustenmukaisuudelle yhdellä alueella.",
      anchor4:
        "Virheillä, päätöksillä tai puutteilla voi olla merkittäviä seurauksia useille liiketoiminnan osa-alueille, tärkeille asiakkaille, kriittisille prosesseille tai säännösten noudattamiselle.",
      anchor5:
        "Virheillä tai puutteilla voi olla erittäin suuria, pitkäkestoisia tai toiminnan kannalta kriittisiä seurauksia turvallisuudelle, vaatimustenmukaisuudelle, luottamukselle, taloudelle tai toiminnan jatkuvuudelle.",
    },
    "people-leadership": {
      name: "Johtamis- ja henkilöstövastuu",
      shortUiText:
        "Vastuu ihmisten johtamisesta, toiminnan koordinoinnista ja tulosten aikaansaamisesta muiden kautta.",
      fullDefinition:
        "Kattaa vastuun ihmisten tai toiminnan osien johtamisesta ja koordinoinnista tulosten aikaansaamiseksi muiden kautta. Se voi sisältää vastuun painotuksista, työnjaosta, suunnasta, toimintatapojen kehittämisestä tai toimituksen koordinoinnista. Muodollinen henkilöstövastuu kuuluu tähän, kun vastuu kattaa myös työntekijöiden tavoitteet, kehittymisen, suoriutumisen ja työympäristön. Kriteeri koskee johtamisvastuuta muiden kautta, ei pelkkää asiantuntijavaikuttamista, projektikoordinointia tai laajaa omaa päätösvaltaa.",
      measures:
        "Vastuu työn johtamisesta ja koordinoinnista muiden kautta, vastuu suunnasta, painotuksista ja toimituksesta toiminnan osassa, vastuu toimintatapojen tai kapasiteetin kehittämisestä muiden kautta, muodollinen vastuu työntekijöiden tavoitteista, kehittymisestä ja suoriutumisesta.",
      notMeasures:
        "Asiantuntijavaikuttaminen ilman vastuuta muiden työstä tai toiminnan osasta, yksittäisten tehtävien tilapäinen koordinointi, projektinjohto ilman pysyvää vastuuta ihmisistä tai toiminnan osasta, oma päätösvalta ilman vastuuta tulosten aikaansaamisesta muiden kautta.",
      whenSuitable:
        "Valitse, kun vastuuta ihmisten tai toiminnan osien johtamisesta muiden kautta halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään siksi, että koordinointia, asiantuntijatukea tai projektinjohtoa esiintyy. Vastuun suunnasta, painotuksista, toimituksesta tai kehittämisestä muiden kautta on oltava pysyvä.",
      controlQuestion:
        "Halutaanko vastuun ihmisten tai toiminnan osien johtamisesta muiden kautta vaikuttaa samanarvoisuuden arviointiin?",
      assessmentQuestion:
        "Millaista henkilöstö- ja johtamisvastuuta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Rajallinen vastuu muiden työn koordinoinnista selkeästi rajatulla alueella. Ei pysyvää vastuuta suunnasta, toimituksesta tai työntekijöiden kehittymisestä.",
      anchor3:
        "Pysyvä vastuu tiimin, työnkulun tai toiminnan osan johtamisesta ja koordinoinnista muiden kautta. Vastuu kattaa painotukset, työnjaon ja toimituksen. Muodollista henkilöstövastuuta voi olla, mutta se ei ole tällä tasolla vaatimus.",
      anchor5:
        "Laaja vastuu suuremman toiminnan osan tai useiden tiimien johtamisesta muiden kautta. Vastuu kattaa suunnan, kapasiteetin, tulokset ja kehittymisen ajan myötä. Muodollinen henkilöstövastuu muista esihenkilöistä tai laajemmasta organisaatiosta kuuluu tälle tasolle yleensä.",
    },
    "resource-capacity": {
      name: "Resurssi- ja kapasiteettivastuu",
      shortUiText:
        "Vastuu rajallisten resurssien priorisoinnista toiminnan tarpeiden välillä.",
      fullDefinition:
        "Kattaa vastuun punnita kilpailevia tarpeita, kun resurssit ovat rajalliset. Resursseja voivat olla esimerkiksi aika, budjetti, laitteet, varasto, miehitys tai toimituskapasiteetti. Kriteeri koskee sitä, millaisia painotuksia tarvitaan, jotta resurssit ja kapasiteetti käytetään siellä, missä ne hyödyttävät toimintaa eniten. Kriteeri ei koske ihmisten johtamista, kehittämistä tai koordinointia sinänsä. Se ei koske myöskään rutiininomaista budjettiseurantaa, hankintoja tai jakoa pienissä ja ennalta määrätyissä rajoissa.",
      measures:
        "Priorisointi kilpailevien tarpeiden välillä, rajallisten resurssien ja kapasiteetin jakaminen, punninta käytettävissä olevien resurssien, tarpeiden ja toimituskyvyn välillä.",
      notMeasures:
        "Ihmisten johtaminen tai kehittäminen, rutiininomainen budjettiseuranta, hankinnat pienissä kiinteissä rajoissa, liiketoiminnan tulos sinänsä.",
      whenSuitable:
        "Valitse, kun vastuuta rajallisten resurssien priorisoinnista toiminnan tarpeiden välillä halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään budjettiseurannan, hankintojen tai ihmisten koordinoinnin vuoksi. Vastuun kilpailevien tarpeiden ja rajallisten resurssien punninnasta on oltava pysyvä.",
      controlQuestion:
        "Halutteko painottaa vastuuta rajallisten resurssien priorisoinnista toiminnan eri tarpeiden välillä?",
      assessmentQuestion:
        "Millaista resurssi- ja kapasiteettivastuuta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Priorisointia pienessä ja selkeästi rajatussa resurssijoukossa, jossa valintojen vaikutus on rajallinen ja helposti korjattavissa.",
      anchor3:
        "Itsenäistä priorisointia vakiintuneiden tarpeiden ja rajallisten resurssien tai kapasiteetin välillä yhdellä alueella.",
      anchor5:
        "Priorisointia erittäin merkittävien tai toiminnan kannalta kriittisten tarpeiden ja resurssien välillä, jolloin punninnat vaikuttavat toiminnan toimituskykyyn useissa osissa.",
    },
    "business-customer": {
      name: "Liiketoiminta- ja asiakasvastuu",
      shortUiText:
        "Vastuu tärkeistä asiakkaista, tuotoista tai liiketoiminnan tuloksesta.",
      fullDefinition:
        "Kattaa pysyvän vastuun liiketoiminta-arvon luomisesta, turvaamisesta tai kehittämisestä esimerkiksi asiakassuhteiden, tuottovirtojen, sopimusten, liiketoimintasalkkujen tai markkina-aseman kautta. Kriteeri koskee vastuuta, joka kuuluu toimintaan. Se ei koske yksittäisiä myyntituloksia, provisiota eikä taitavuutta yksittäisessä neuvottelussa.",
      measures:
        "Vastuu asiakassuhteista, vastuu tuotoista tai liiketoimintasalkusta, vastuu liiketoiminnan tuloksesta tai markkina-asemasta.",
      notMeasures:
        "Asiakaskontakti sinänsä, yksilön myyntisuoritus, neuvottelutaito sinänsä.",
      whenSuitable:
        "Valitse, kun vastuuta asiakkaista, tuotoista tai liiketoiminnan tuloksesta halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään asiakaskontaktin tai myynnin vuoksi. Vastuun asiakasarvosta, tuotoista tai liiketoiminnan tuloksesta on oltava pysyvä.",
      controlQuestion:
        "Onko vastuu asiakkaista, tuotoista tai liiketoiminnan tuloksesta jotain, jolle haluatte antaa erityistä painoa samanarvoisuuden arvioinnissa?",
      assessmentQuestion:
        "Millaista liiketoiminta- ja asiakasvastuuta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Tukea vakiintuneelle asiakassuhteelle tai liiketoiminnalle rajatulla asiakkuudella tai alueella.",
      anchor3:
        "Itsenäinen ja vakiintunut vastuu asiakassuhteesta, tuottovirrasta tai liiketoimintasalkusta.",
      anchor5:
        "Vastuu asiakkaista, tuotoista tai liiketoiminta-alueista, joilla on suuri merkitys yritykselle ja vaikutusta markkina-asemaan tai tulevaan liiketoimintaan.",
    },
    "compliance-control": {
      name: "Tieto-, turvallisuus- tai vaatimustenmukaisuusvastuu",
      shortUiText:
        "Muodollinen vastuu valvonnasta, suojauksesta, laadunvarmistuksesta tai säännösten noudattamisesta.",
      fullDefinition:
        "Kattaa muodollisen vastuun siitä, että tärkeitä vaatimuksia valvotaan, laadunvarmistetaan tai niiden noudattaminen varmistetaan, esimerkiksi tietoturvassa, laadussa, turvallisuudessa tai sääntelyssä. Kriteeri koskee vastuuta siitä, että vaatimuksia sovelletaan oikein. Se ei koske yleistä velvollisuutta noudattaa sääntöjä tai olla riskitietoinen.",
      measures:
        "Valvonta- ja laadunvarmistusvastuu, vastuu tiedon tai turvallisuuden suojaamisesta, vastuu vaatimusten ja sääntelyn oikeasta soveltamisesta.",
      notMeasures:
        "Yleinen riskitietoisuus, sellaisten ohjeiden noudattaminen, joista vastaa joku muu, seuraus, jos virhe tapahtuu.",
      whenSuitable:
        "Valitse, kun muodollista vastuuta valvonnasta, suojauksesta ja vaatimustenmukaisuudesta halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse, kun alue kattaa vain vakiintuneiden valvontakäytäntöjen noudattamisen. Vastuun siitä, että valvonta ja vaatimukset toimivat, on oltava selkeä.",
      controlQuestion:
        "Halutaanko muodollisen valvonta-, suojaus- ja vaatimustenmukaisuusvastuun vaikuttaa samanarvoisuuden arviointiin?",
      assessmentQuestion:
        "Millaista tieto-, turvallisuus- tai vaatimustenmukaisuusvastuuta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Vakiintuneita valvontakäytäntöjä noudatetaan selkeästi rajatulla alueella ilman itsenäistä valvontavastuuta.",
      anchor3:
        "Itsenäinen ja muodollinen vastuu suojauksesta, laadunvarmistuksesta tai vaatimustenmukaisuuden valvonnasta yhdellä alueella.",
      anchor5:
        "Erittäin vaativa tai toiminnan kannalta kriittinen valvontavastuu, jossa tulkinnat ja toimintatavat ohjaavat sitä, miten tärkeitä vaatimuksia noudatetaan toiminnan useissa osissa.",
    },
    "safety-exposure": {
      name: "Turvallisuus- ja altistumisolosuhteet",
      shortUiText:
        "Pysyvä altistuminen fysikaalisille, kemiallisille, biologisille tai ympäristöriskeille.",
      fullDefinition:
        "Kattaa toistuvan työskentelyn ympäristöissä, joissa on todellista fysikaalista, kemiallista, biologista tai ympäristöön liittyvää altistumista ja vaatimus suojatoimista. Esimerkkejä ovat melu, vaaralliset aineet, tartunta, korkeus, kuumuus, kylmyys ja vaaralliset koneet. Kriteeri koskee työolosuhdetta, ei fyysistä rasitusta eikä seurausta toiminnalle, jos jokin menee vikaan.",
      measures:
        "Riskiympäristö ja todellinen altistuminen, toistuva suojatoimien tarve, ympäristön erityiset turvallisuusolosuhteet.",
      notMeasures:
        "Fyysinen tai aistinvarainen rasitus sinänsä, muodollinen turvallisuusvastuu, liiketoiminnallinen tai organisatorinen riski.",
      whenSuitable:
        "Valitse, kun erityisiä turvallisuus- ja altistumisolosuhteita halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään turvallisuusvastuun tai päätösriskin vuoksi. Kyse on oltava todellisesta ja pysyvästä altistumisesta toiminnan ympäristöissä.",
      controlQuestion:
        "Onko työskentely erityisissä turvallisuus- tai altistumisolosuhteissa jotain, jonka haluatte ottaa huomioon samanarvoisuuden arvioinnissa?",
      assessmentQuestion:
        "Millaisen turvallisuuden ja altistumisen tasolla rooli normaalisti ja pysyvästi työskentelee?",
      anchor1:
        "Satunnaista ja vähäistä altistumista selkeästi rajatuissa olosuhteissa vakioiduin suojatoimin.",
      anchor3:
        "Toistuvaa altistumista vakiintuneessa riskiympäristössä, joka edellyttää suojatoimien johdonmukaista käyttöä.",
      anchor5:
        "Erittäin vaativia tai toiminnan kannalta kriittisiä altistumisolosuhteita, joissa suojaus, turvallisuuskäytännöt ja oikea toiminta ovat ratkaisevia turvalliselle toiminnalle.",
    },
    "on-call": {
      name: "Päivystys-, varallaolo- ja tavoitettavuusvaatimukset",
      shortUiText:
        "Toistuva päivystys, varallaolo tai nopean tavoitettavuuden vaatimus.",
      fullDefinition:
        "Kattaa toistuvat vaatimukset olla tavoitettavissa tai kyetä toimimaan säännöllisen työajan ulkopuolella, tai kyetä vastaamaan välittömästi työvuoron aikana. Kriteeri koskee suunniteltua tai odotettua varallaoloa, joka on vakaa osa toiminnan edellytyksiä. Se ei koske satunnaista ylityötä, vapaaehtoista joustavuutta eikä tilapäisesti suurta työkuormaa.",
      measures:
        "Päivystys ja varallaolo, nopean tavoitettavuuden vaatimus, toistuvat hälytystehtävät säännöllisen työajan ulkopuolella.",
      notMeasures:
        "Tilapäinen ylityö, epäviralliset odotukset vastaamisesta, yleisesti suuri työmäärä.",
      whenSuitable:
        "Valitse, kun päivystystä, varallaoloa tai nopean tavoitettavuuden vaatimusta halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse, kun tavoitettavuutta tarvitaan vain satunnaisissa kriiseissä tai kun sillä ei ole selkeää ja toistuvaa perustaa toiminnassa.",
      controlQuestion:
        "Onko toistuva päivystys, varallaolo tai nopean tavoitettavuuden vaatimus työn edellytys, jonka haluatte ottaa huomioon samanarvoisuuden arvioinnissa?",
      assessmentQuestion:
        "Millaista päivystystä, valmiutta ja tavoitettavuutta rooli normaalisti ja pysyvästi kantaa?",
      anchor1: "Satunnaista ja selkeästi rajattua varallaoloa harvoin.",
      anchor3:
        "Vakiintunutta ja toistuvaa varallaoloa tai tavoitettavuutta säännöllisen työajan ulkopuolella.",
      anchor5:
        "Erittäin vaativaa varallaoloa, jossa toimintavelvollisuus on tiheä tai välitön ja jossa toiminta on vahvasti riippuvainen nopeasta tavoitettavuudesta.",
    },
    "irregularity-mobility": {
      name: "Epäsäännöllisyys, liikkuvuus ja paikkasidonnaisuus",
      shortUiText:
        "Pysyvät vaatimukset epäsäännöllisistä ajoista, matkustamisesta tai työstä tietyissä paikoissa.",
      fullDefinition:
        "Kattaa pysyvät vaatimukset epäsäännöllisestä työajasta, laajasta matkustamisesta tai paikkasidonnaisesta työstä, esimerkiksi kenttätyöstä, vuorotyöstä tai kansainvälisestä läsnäolosta. Kriteeri koskee toiminnan vakaata ja rakenteellista olosuhdetta. Se ei koske yksittäisiä matkoja, henkilökohtaisia toiveita eikä tilapäisiä projekteja.",
      measures:
        "Epäsäännöllinen työaika, laaja ja toistuva matkustaminen, kenttä-, vuoro- tai paikkasidonnainen työ.",
      notMeasures:
        "Yksittäiset työmatkat, tilapäiset projektit, päivystys tai varallaolo työajan ulkopuolella.",
      whenSuitable:
        "Valitse, kun epäsäännöllisiä aikoja, liikkuvuutta tai paikkasidonnaisuutta halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse, kun vaatimus on tilapäinen tai esiintyy harvoin olematta vakaa osa toiminnan edellytyksiä.",
      controlQuestion:
        "Halutteko ottaa huomioon pysyvät vaatimukset epäsäännöllisistä ajoista, matkustamisesta tai paikkasidonnaisesta työstä?",
      assessmentQuestion:
        "Millaista epäsäännöllisyyttä, liikkuvuutta tai paikkasidonnaisuutta rooli normaalisti ja pysyvästi kantaa?",
      anchor1:
        "Toistuvia mutta rajallisia vaatimuksia epäsäännöllisistä ajoista, matkustamisesta tai paikkasidonnaisesta työstä.",
      anchor3:
        "Vakiintunut ja toistuva epäsäännöllisten aikojen, matkustamisen tai paikkasidonnaisen työn kaava.",
      anchor5:
        "Erittäin laajat vaatimukset vuorotyöstä, matkustamisesta, kenttätyöstä tai kansainvälisestä läsnäolosta, jotka vaikuttavat selvästi suunnitteluun ja miehitykseen.",
    },
    "restricted-environments": {
      name: "Erityiset turvallisuus-, salassapito- tai valvontaympäristöt",
      shortUiText:
        "Työ erityisten pääsy-, salassapito-, turvallisuus- tai valvontasääntöjen alaisena.",
      fullDefinition:
        "Kattaa työolosuhteet, joissa on erityisiä rajoituksia pääsylle, salassapidolle, turvallisuudelle tai valvonnalle, esimerkiksi turvaluokitellut ympäristöt tai erityistä suojaa vaativa tieto. Kriteeri koskee ympäristössä voimassa olevia sääntöjä ja rajoituksia. Se ei koske vastuuta tietoturvan suunnittelusta, seurannasta tai valvonnasta.",
      measures:
        "Erityiset pääsyrajoitukset, salassapito- ja turvallisuusrajoitukset, valvontavaatimukset, jotka vaikuttavat työn tekemisen tapaan.",
      notMeasures:
        "Muodollinen vastuu tietoturvasta, yleinen vaitiolovelvollisuus, yleinen riskitietoisuus.",
      whenSuitable:
        "Valitse, kun erityisiä pääsy-, salassapito- tai turvallisuusrajoituksia halutaan painottaa samanarvoisuuden arvioinnissa.",
      whenNotSuitable:
        "Älä valitse pelkästään luottamuksellisen tiedon vuoksi. Rajoitusten on oltava erityisiä, toistuvia ja vaikutettava siihen, miten työtä voidaan tehdä.",
      controlQuestion:
        "Halutaanko erityisten pääsy-, salassapito- tai turvallisuusrajoitusten alaisen työn vaikuttaa samanarvoisuuden arviointiin?",
      assessmentQuestion:
        "Millaisen turvallisuus-, salassapito- tai valvontarajoituksen alaisena rooli normaalisti ja pysyvästi työskentelee?",
      anchor1:
        "Satunnaisia ja selkeästi rajattuja matalan tason pääsy- tai salassapitorajoituksia.",
      anchor3:
        "Vakiintuneita ja toistuvia pääsy-, valvonta- tai turvallisuusrajoituksia.",
      anchor5:
        "Erittäin tiukkoja tai toiminnan kannalta kriittisiä turvallisuus-, salassapito- tai valvontarajoituksia, jotka ohjaavat suuresti suunnittelua, toteutusta ja dokumentointia.",
    },
  },
}
