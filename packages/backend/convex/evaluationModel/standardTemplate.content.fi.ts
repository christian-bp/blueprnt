import type { StandardTemplateContent } from "./standardTemplate.content.en"

// Finnish content for the standard template. This is a translation draft of
// the Swedish source (standardTemplate.content.sv.ts) and must be reviewed by
// a native speaker before it ships to users. All structural decisions live in
// standardTemplate.ts; this module carries only prose.
//
// Per criterion: `description` is the short criterion description shown inline;
// `helpText` is the extended description shown behind the info help and in the
// rating flow.
export const standardTemplateContentFi: StandardTemplateContent = {
  modelName: "Vakiomalli",
  criteria: {
    scope: {
      name: "Laajuus ja vaikutus",
      description:
        "Kuinka laajaan alueeseen rooli vaikuttaa ja millä organisaation tasolla vaikutukset näkyvät.",
      helpText:
        "Tämä kriteeri kuvaa roolin organisatorista ulottuvuutta. Se kattaa sekä vastuun laajuuden että sen, kuinka pitkälle roolin työn, päätösten tai priorisointien vaikutukset ulottuvat. Vaikutus voi rajoittua omaan tehtäväalueeseen tai tiimiin, mutta se voi myös kattaa useita funktioita tai koko yrityksen.",
      anchors: [
        "Vastuu omista tehtävistä selkeästi rajatulla alueella.",
        "Vaikutus oman tiimin sisällä; vastuu hyvin määritellyistä toimituksista.",
        "Omistajuus osa-alueesta tai toistuvasta prosessista; vaikutus pienemmän funktion sisällä.",
        "Vastuu suuremmasta alueesta, projektista tai virrasta; vaikuttaa useisiin tiimeihin/funktioihin.",
        "Vaikuttaa liiketoiminta-/toimintoalueeseen; määrittää suunnan suuremmille osille organisaatiota.",
        "Yrityksenlaajuinen vaikutus; strateginen vastuu ja suora vaikutus organisaation tuloksiin.",
      ],
      weightLevels: [
        "Yritys haluaa, että vastuun laajuudella ja organisatorisella vaikutuksella on vain rajallinen painoarvo roolin arvioinnissa. Roolit, joiden ulottuvuus on suppeampi, eivät siis saa erityisen vahvaa palkkiota juuri tällä ulottuvuudella.",
        "Yritys pitää laajuutta ja vaikutusta merkityksellisenä, mutta katsoo, että sen tulee normaalisti painaa vähemmän kuin mallin tärkeämmät kriteerit. Laajemman vastuun tulee vaikuttaa arviointiin, mutta ei olla sen päätekijä.",
        "Yritys haluaa, että laajuudella ja vaikutuksella on selkeä ja tasapainoinen paikka mallissa. Roolit, joiden organisatorinen ulottuvuus on suurempi, saavat painoarvoa ilman, että tämä ulottuvuus hallitsee arviointia.",
        "Yritys haluaa, että tällä kriteerillä on vahva vaikutus mallissa. Erot laajuudessa, vastuussa ja vaikutuksessa tiimitasolta yritystasolle vaikuttavat selkeästi siihen, miten rooleja arvioidaan suhteessa toisiinsa.",
        "Yritys pitää laajuutta ja vaikutusta yhtenä mallin ratkaisevimmista ulottuvuuksista. Roolit, joiden organisatorinen ulottuvuus on suuri ja vaikutus laaja, arvioidaan siksi selvästi korkeammalle, kun tätä kriteeriä arvioidaan korkeaksi.",
      ],
      compliance: {
        purpose:
          "Mittaa roolin organisatorista ulottuvuutta: kuinka laajaan alueeseen rooli vaikuttaa ja kuinka pitkälle sen työn, päätösten ja priorisointien vaikutukset ulottuvat, riippumatta henkilöstä tai hierarkkisesta tasosta.",
        whyRelevant:
          "Ulottuvuus ja vaikutus heijastavat roolin panosta toiminnan tuloksiin. Sitä arvioidaan tosiasiallisen organisatorisen vaikutuksen perusteella, ei tittelin tai näkyvän valtuutuksen perusteella, mikä tekee kriteeristä sukupuolineutraalin.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerien Itsenäisyys ja päätösvalta (päätösvalta) sekä Henkilöstö-/esihenkilövastuu kanssa; tässä painopiste on nimenomaan siinä, kuinka pitkälle roolin vaikutukset ulottuvat organisaatiossa.",
        biasRisk: "low",
        biasComment:
          "Näkyvän valtuutuksen palkitseminen enemmän kuin tosiasiallisen vaikutuksen voi suosia perinteisesti näkyviä rooleja. Tasokuvaukset lähtevät vaikutuksesta ja vastuusta arvon sijaan ja ovat sukupuolineutraaleja.",
        biasAction:
          "Tasoankkurit kuvaavat tosiasiallista ulottuvuutta ja tuloksia, eivät muodollista asemaa, jotta myös roolit ilman näkyvää titteliä voidaan arvioida korkealle.",
      },
    },
    risk: {
      name: "Riski ja seuraukset",
      description:
        "Mitä seurauksia roolin päätöksillä, työllä tai puutteilla voi olla toiminnalle.",
      helpText:
        "Tämä kriteeri kuvaa, mitä seurauksia roolilla voi olla toiminnalle, jos jokin menee pieleen, jää tekemättä tai hoidetaan riittämättömästi. Se kattaa vaikutuksen esimerkiksi laatuun, toimituksiin, talouteen, vaatimustenmukaisuuteen, turvallisuuteen, asiakassuhteisiin ja brändiin. Painopiste on seurausten laajuudessa ja merkityksessä toiminnalle.",
      anchors: [
        "Vähäinen vaikutus; virheet voidaan korjata helposti.",
        "Vaikuttaa lähinnä omaan työhön tai tiimiin.",
        "Virheet vaikuttavat toimituksiin tai laatuun pienemmässä mittakaavassa.",
        "Virheillä on tuntuvia seurauksia prosesseille, aikatauluille tai asiakassuhteille.",
        "Suuri vaikutus talouteen, maineeseen tai vaatimustenmukaisuuteen.",
        "Kriittinen vaikutus organisaation tuloksiin, strategiaan tai sääntelyn noudattamiseen.",
      ],
      weightLevels: [
        "Yritys haluaa, että riskillä ja seurauksilla on vain rajallinen vaikutus roolin arviointiin. Rooleja, joissa virheillä on suuremmat seuraukset, ei siis palkita erityisen paljon tällä ulottuvuudella.",
        "Yritys arvioi riskin ja seuraukset merkityksellisiksi, mutta katsoo, että tämän kriteerin tulee normaalisti painaa vähemmän kuin mallin tärkeimmät ulottuvuudet.",
        "Yritys haluaa, että riskillä ja seurauksilla on tasapainoinen paikka mallissa. Erot vaikutuksessa laatuun, vaatimustenmukaisuuteen, toimintaan tai brändiin otetaan huomioon normaalilla tasolla.",
        "Yritys haluaa, että riskillä ja seurauksilla on vahva vaikutus siihen, miten rooleja arvioidaan. Roolit, joissa virheillä voi olla selkeitä seurauksia toiminnalle, asiakkaalle, taloudelle, vaatimustenmukaisuudelle tai luottamukselle, saavat siksi korkeamman palkkion.",
        "Yritys pitää riskiä ja seurauksia yhtenä mallin ratkaisevimmista tekijöistä. Korkeat roolipisteet tällä ulottuvuudella saavat siksi erittäin suuren painoarvon kokonaisarvioinnissa ja siten normaalisti myös suhteellisessa palkka-asemoinnissa.",
      ],
      compliance: {
        purpose:
          "Mittaa, mitä seurauksia roolin päätöksillä, työllä tai puutteilla voi olla toiminnalle: laatu, toimitukset, talous, vaatimustenmukaisuus, turvallisuus, asiakassuhteet ja brändi.",
        whyRelevant:
          "Seurausten laajuus on osa roolin arvoa toiminnalle. Sitä arvioidaan sen perusteella, mikä tosiasiassa on pelissä, ei sen perusteella, kuinka näkyvää tai dramaattista työ on, mikä tekee kriteeristä sukupuolineutraalin.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerin Laajuus ja vaikutus kanssa; tässä painopiste on virheiden tai puutteiden seurauksissa itse ulottuvuuden sijaan.",
        biasRisk: "low",
        biasComment:
          "Näkyvät operatiiviset tai tekniset riskit voidaan yliarvioida, kun taas hiljainen laatu-, huolenpito- tai vaatimustenmukaisuustyö aliarvioidaan. Tasokuvaukset kattavat myös laadun, vaatimustenmukaisuuden ja suhteet ja ovat sukupuolineutraaleja.",
        biasAction:
          "Ankkuritekstit sisältävät seuraukset laadulle, vaatimustenmukaisuudelle ja asiakassuhteille, eivät vain taloudellisia tai teknisiä virheitä, jotta erilaiset vastuutyypit arvioidaan tasavertaisesti.",
      },
    },
    complexity: {
      name: "Monimutkaisuus ja epäselvyys",
      description:
        "Kuinka monimutkaisia, monitahoisia ja epäselviä kysymyksiä rooli käsittelee.",
      helpText:
        "Tämä kriteeri kuvaa työn vaikeusastetta. Se kattaa teknisen, liiketoiminnallisen ja organisatorisen monimutkaisuuden sekä epävarmuuden asteen tilanteissa, joissa tieto, suunta tai ratkaisu ei ole alusta alkaen selvä. Kriteeri kuvaa, kuinka monta muuttujaa, riippuvuutta ja kompromissia rooliin tyypillisesti liittyy.",
      anchors: [
        "Työ on rutiininomaista ja hyvin määriteltyä selkein ohjein.",
        "Käsittelee standardoituja tehtäviä, joissa on vähän vaihtelua.",
        "Ratkaisee tehtäviä, joissa on jonkin verran vaihtelua ja tarvetta omalle analyysille.",
        "Työskentelee useiden riippuvuuksien ja kompromissien kanssa; vaatii tulkintaa ja priorisointia.",
        "Suuri monimutkaisuus; käsittelee ristiriitaisia vaatimuksia ja epäselviä edellytyksiä.",
        "Äärimmäisen monimutkaisia tilanteita; vie eteenpäin tuntemattomilla/innovatiivisilla alueilla, joissa epävarmuus on suuri.",
      ],
      weightLevels: [
        "Yritys haluaa, että monimutkaisuudella ja epäselvyydellä on vain pieni vaikutus roolin kokonaisarviointiin. Rooleja, joiden edellytykset ovat monimutkaisemmat ja epävarmemmat, ei siksi palkita erityisen paljon tällä ulottuvuudella.",
        "Yritys arvioi monimutkaisuuden ja epävarmuuden merkityksellisiksi, mutta katsoo, että tämän ulottuvuuden tulee normaalisti painaa vähemmän kuin tärkeimmät kriteerit.",
        "Yritys haluaa, että monimutkaisuudella ja epäselvyydellä on tasapainoinen ja selkeä paikka mallissa. Roolit, jotka vaativat ongelmanratkaisua epävarmemmissa tai vaikeasti tulkittavissa yhteyksissä, saavat normaalin painoarvon arvioinnissa.",
        "Yritys haluaa, että monimutkaisuudella ja epäselvyydellä on vahva vaikutus roolin arviointiin. Roolit, jotka käsittelevät vaikeita, monitulkintaisia tai epävarmoja ongelmia, saavat siksi selvästi korkeamman palkkion mallissa.",
        "Yritys pitää monimutkaisuutta ja epäselvyyttä yhtenä mallin ratkaisevimmista tekijöistä. Tämä tarkoittaa, että roolit, jotka saavat korkeat arviointipisteet tällä kriteerillä, saavat myös suuren painoarvon kokonaisarvioinnissa ja arvioidaan siten normaalisti suhteellisesti korkeammalle palkan osalta.",
      ],
      compliance: {
        purpose:
          "Mittaa työn vaikeusastetta: teknistä, liiketoiminnallista ja organisatorista monimutkaisuutta sekä epävarmuuden astetta, kun tieto, suunta tai ratkaisu ei ole alusta alkaen annettu.",
        whyRelevant:
          "Kyky käsitellä monia muuttujia, riippuvuuksia ja kompromisseja on keskeinen osa roolin arvoa. Sitä arvioidaan tehtävien tosiasiallisen monimutkaisuuden perusteella, ei sen perusteella, kuinka tekniseltä työ näyttää, mikä tekee kriteeristä sukupuolineutraalin.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerin Osaamisen syvyys/laajuus kanssa; tässä painopiste on ongelmien monimutkaisuudessa ja epävarmuudessa vaaditun tiedon sijaan.",
        biasRisk: "low",
        biasComment:
          "Tekninen monimutkaisuus voidaan yliarvioida, kun taas suhteisiin liittyvä, koordinoiva tai monitulkintainen monimutkaisuus aliarvioidaan. Tasokuvaukset kattavat myös organisatorisen ja liiketoiminnallisen monimutkaisuuden ja ovat sukupuolineutraaleja.",
        biasAction:
          "Ankkuritekstit kuvaavat monimutkaisuutta laajasti (tekninen, liiketoiminnallinen ja organisatorinen), jotta myös koordinoivat ja monitulkintaiset yhteydet arvioidaan monimutkaisiksi.",
      },
    },
    autonomy: {
      name: "Itsenäisyys ja päätösvalta",
      description:
        "Kuinka itsenäinen rooli on ja millainen valtuutus sillä on tehdä päätöksiä.",
      helpText:
        "Tämä kriteeri kuvaa roolin liikkumavaraa ja päätöstasoa. Se kattaa itsenäisyyden asteen, kuinka paljon ohjausta rooli toimii alaisena ja millaiset päätökset luontevasti kuuluvat tehtävään. Kriteeri kuvaa sekä vapautta toimia että valtuutusta, joka roolilla on vaikuttaa suuntaan, priorisointeihin tai lopputuloksiin.",
      anchors: [
        "Työskentelee tiiviisti ohjattuna; noudattaa ohjeita.",
        "Itsenäinen arkisissa tehtävissä määriteltyjen raamien sisällä.",
        "Tekee omia aloitteita ja priorisointeja omalla alueellaan.",
        "Tekee taktisia päätöksiä, jotka vaikuttavat tiimiin tai työnkulkuun.",
        "Tekee strategisia päätöksiä toimialueensa sisällä ja määrittää suunnan osa-alueelle.",
        "Tekee päätöksiä, jotka vaikuttavat useisiin toimialueisiin tai koko organisaatioon.",
      ],
      weightLevels: [
        "Yritys haluaa, että itsenäisyyden asteella ja päätösvallalla on vain pieni vaikutus roolin kokonaisarviointiin.",
        "Yritys pitää itsenäisyyttä ja päätöstasoa merkityksellisenä, mutta katsoo, että sen tulee normaalisti painaa vähemmän kuin mallin tärkeämmät kriteerit.",
        "Yritys haluaa, että itsenäisyydellä ja päätösvallalla on selkeä ja tasapainoinen paikka mallissa. Roolin arviointiin vaikuttaa se, kuinka itsenäisesti se toimii, ilman että tälle kriteerille annetaan erityisen vahvaa painoa.",
        "Yritys haluaa, että tällä kriteerillä on vahva vaikutus. Roolit, joilla on suurempi itsenäisyys ja korkeampi päätösvalta, saavat siksi selvästi suuremman painoarvon kokonaisarvioinnissa.",
        "Yritys pitää itsenäisyyttä ja päätösvaltaa yhtenä mallin ratkaisevimmista ulottuvuuksista. Roolit, jotka arvioidaan korkealle itsenäisyyden ja päätöstason osalta, arvioidaan siksi selvästi korkeammalle suhteessa muihin rooleihin.",
      ],
      compliance: {
        purpose:
          "Mittaa roolin liikkumavaraa ja päätöstasoa: itsenäisyyden astetta, kuinka paljon ohjausta rooli toimii alaisena ja millainen valtuutus sillä on vaikuttaa suuntaan, priorisointeihin ja lopputuloksiin.",
        whyRelevant:
          "Itsenäisyys ja päätösvalta heijastavat roolin kantamaa vastuuta. Sitä arvioidaan sen perusteella, mitä päätöksiä tosiasiassa tehdään, ei muodollisen tittelin perusteella, mikä tekee kriteeristä sukupuolineutraalin.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerien Laajuus ja vaikutus sekä Henkilöstö-/esihenkilövastuu kanssa; tässä painopiste on itsenäisyydessä ja päätösvallassa ulottuvuuden tai muiden johtamisen sijaan.",
        biasRisk: "medium",
        biasComment:
          "Näkyvä päätösvalta voidaan yliarvioida suhteessa tosiasialliseen vaikutukseen, mikä voi suosia muodollista valtuutusta kantavia rooleja verrattuna senioriasiantuntijoihin, joilla on todellista vaikutusvaltaa. Tasokuvaukset ovat sukupuolineutraaleja.",
        biasAction:
          "Ankkuritekstit kattavat myös itsenäisen aloitteellisuuden ja ongelmanratkaisun, eivät vain muodollista päätösvaltaa, jotta todellinen vaikutusvalta ilman titteliä voidaan arvioida korkealle.",
      },
    },
    stakeholders: {
      name: "Sidosryhmien laajuus",
      description:
        "Kuinka laajaa ja vaihtelevaa roolin yhteistyö sisäisten ja ulkoisten osapuolten kanssa on.",
      helpText:
        "Tämä kriteeri kuvaa roolin kontaktipintojen ja yhteistyötarpeiden laajuutta. Se kattaa sisäiset ja ulkoiset sidosryhmät, toimintorajat ylittävän yhteistyön ja tarpeen koordinoida työtä eri henkilöiden, tiimien, funktioiden tai ulkoisten osapuolten välillä. Kriteeri kuvaa, kuinka vaihtelevaa ja laajaa tämä yhteistyö on.",
      anchors: [
        "Yhteistyö pääasiassa oman tiimin sisällä.",
        "Yhteistyö lähifunktioiden kanssa.",
        "Säännöllistä toimintorajat ylittävää yhteistyötä.",
        "Koordinointi ulkoisten osapuolten/asiakkaiden tai useiden sisäisten funktioiden kanssa.",
        "Hallitsee monimutkaista sidosryhmäympäristöä, jossa on kilpailevia intressejä.",
        "Edustaa organisaatiota ulospäin ja hallitsee strategisia sidosryhmiä.",
      ],
      weightLevels: [
        "Yritys haluaa, että yhteistyön ja koordinoinnin laajuudella on vain pieni vaikutus siihen, miten rooleja arvioidaan suhteessa toisiinsa.",
        "Yritys arvioi sidosryhmien laajuuden merkitykselliseksi, mutta katsoo, että kriteerin tulee normaalisti painaa vähemmän kuin mallin tärkeimmät ulottuvuudet.",
        "Yritys haluaa, että sidosryhmien laajuudella on selkeä ja tasapainoinen paikka mallissa. Roolit, joilla on laaja sisäinen tai ulkoinen yhteistyö, saavat normaalin painoarvon arvioinnissa.",
        "Yritys haluaa, että tällä kriteerillä on vahva vaikutus. Roolit, jotka vaativat laajaa koordinointia, monia kontaktipintoja ja runsasta yhteistyötä, arvioidaan siksi selvästi korkeammalle.",
        "Yritys pitää sidosryhmien laajuutta yhtenä mallin ratkaisevimmista tekijöistä. Korkeat roolin arviointipisteet tällä ulottuvuudella antavat siksi suuren painoarvon siihen, miten rooleja arvioidaan suhteessa toisiinsa ja asemoidaan.",
      ],
      compliance: {
        purpose:
          "Mittaa roolin kontaktipintojen ja yhteistyötarpeiden laajuutta: sisäiset ja ulkoiset sidosryhmät, toimintorajat ylittävä yhteistyö ja tarve koordinoida työtä henkilöiden, tiimien ja osapuolten välillä.",
        whyRelevant:
          "Laaja yhteistyö ja koordinointi ovat todellinen panos toimintaan. Kriteeri tekee näkyväksi suhteisiin liittyvän ja koordinoivan työn, jota arvioidaan yhteistyön tosiasiallisen laajuuden perusteella ja joka on sukupuolineutraali.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerin Laajuus ja vaikutus kanssa; tässä painopiste on yhteistyön laajuudessa ja vaihtelevuudessa tuloksen ulottuvuuden sijaan.",
        biasRisk: "low",
        biasComment:
          "Tämä kriteeri vastustaa tunnettua biasia arvottamalla nimenomaisesti suhteisiin liittyvän ja koordinoivan työn. Jäljelle jäävä riski: ulkoinen, näkyvä edustus voidaan yliarvioida suhteessa sisäiseen koordinointityöhön. Tasokuvaukset ovat sukupuolineutraaleja.",
        biasAction:
          "Ankkuritekstit arvottavat sisäisen toimintorajat ylittävän koordinoinnin tasavertaisesti ulkoisen edustuksen kanssa, jotta näkyvä ulkoinen verkostoituminen ei sinänsä paina enemmän.",
      },
    },
    knowledge: {
      name: "Osaamisen syvyys/laajuus",
      description:
        "Millaista erityisosaamisen tasoa, kokemusta ja laajuutta useilla alueilla rooli vaatii.",
      helpText:
        "Tämä kriteeri kuvaa, millaiseen tietoon ja minkä tasoiseen osaamiseen rooli perustuu. Se kattaa asiantuntijasyvyyden, käytännön kokemuksen, menetelmien ymmärtämisen ja kyvyn työskennellä useiden tieteenalojen tai alueiden poikki. Kriteeri kuvaa, vaatiiko rooli ennen kaikkea syventymistä yhteen alueeseen vai useiden näkökulmien ja osaamisten yhdistelmää.",
      anchors: [
        "Rooli vaatii perustason osaamista. Rooli edellyttää perehdytystasoa omalla alueellaan ja että tehtävät voidaan suorittaa vakiintuneiden rutiinien ja ohjeiden avulla.",
        "Rooli vaatii vankkaa ammattiosaamista määritellyllä alueella. Rooli tarvitsee selkeästi määriteltyä ja vakiintunutta osaamista toimialueellaan sekä kykyä soveltaa standardoituja työmenetelmiä.",
        "Rooli vaatii syvennettyä osaamista ja menetelmien ymmärrystä. Roolin on käsiteltävä monimutkaisempia tehtäviä, käytettävä edistyneempiä menetelmiä/työkaluja ja ymmärrettävä hyvin, miten alue toimii käytännössä.",
        "Rooli vaatii edistynyttä erityisosaamista. Rooli vaatii syvempää osaamista yhdellä tai useammalla osa-alueella sekä kykyä käsitellä vaikeampia ongelmia, tehdä analyysejä ja tuottaa ratkaisuja, joista tulee ohjaavia operatiivisessa työssä.",
        "Rooli vaatii asiantuntijaosaamista monimutkaisella toimialueella. Rooli edellyttää, että sen haltija määrittelee menetelmät, rakenteet ja työtavat toimialueellaan ja toimii sisäisenä asiantuntijana vaativissa kysymyksissä.",
        "Rooli vaatii toimialaa johtavaa osaamista ja tiedon kehittämistä. Rooli vaatii, että sen haltija kehittää uusia työtapoja, malleja tai tekniikoita ja määrittää suunnan ja periaatteet organisaation tuleville kyvykkyyksille alueella.",
      ],
      weightLevels: [
        "Yritys haluaa, että syvän asiantuntemuksen, kokemuksen tai tieteenalat ylittävän laajuuden vaatimuksilla on vain rajallinen vaikutus roolin kokonaisarviointiin.",
        "Yritys pitää osaamisen syvyyttä ja laajuutta merkityksellisenä, mutta katsoo, että sen tulee normaalisti painaa vähemmän kuin tärkeimmät kriteerit.",
        "Yritys haluaa, että osaamisen syvyydellä ja laajuudella on selkeä ja tasapainoinen paikka mallissa. Asiantuntemuksen ja kokemuksen vaatimusten tulee vaikuttaa arviointiin normaalilla tasolla.",
        "Yritys haluaa, että tällä kriteerillä on vahva vaikutus. Roolit, jotka vaativat syvää erityisosaamista, laajaa toimialaymmärrystä tai mittavaa kokemusta, arvioidaan siksi selvästi korkeammalle mallissa.",
        "Yritys pitää osaamisen syvyyttä ja laajuutta yhtenä mallin ratkaisevimmista ulottuvuuksista. Korkeat pisteet tällä tekijällä antavat siksi vahvan painoarvon roolin kokonaisarvioinnissa ja vaikuttavat normaalisti korkeampaan suhteelliseen palkka-asemointiin.",
      ],
      compliance: {
        purpose:
          "Mittaa, millaiseen tietoon ja minkä tasoiseen osaamiseen rooli perustuu: asiantuntijasyvyys, käytännön kokemus, menetelmien ymmärtäminen ja kyky työskennellä useiden tieteenalojen tai alueiden poikki.",
        whyRelevant:
          "Osaamisen taso ja kokemus ovat osa roolin arvoa. Kriteeri arvioi tosiasiallista osaamista ja sovellettua kyvykkyyttä, ei muodollisia ansioita sinänsä, mikä tekee siitä sukupuolineutraalin.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerien Monimutkaisuus ja epäselvyys sekä Muodollinen pätevyys kanssa; tässä painopiste on tosiasiallisessa tiedossa ja kokemuksessa ongelmien monimutkaisuuden tai muodollisten vaatimusten sijaan.",
        biasRisk: "low",
        biasComment:
          "Muodollisesti tunnustettu tai näkyvä asiantuntemus voidaan yliarvioida suhteessa hiljaiseen, kokemusperäiseen tietoon. Tasokuvaukset lähtevät sovelletusta osaamisesta, eivät pelkästä tittelistä tai koulutuksesta, ja ovat sukupuolineutraaleja.",
        biasAction:
          "Ankkuritekstit arvottavat käytännön kokemuksen ja sovelletun menetelmäymmärryksen tasavertaisesti muodollisesti tunnustetun erikoistumisen kanssa.",
      },
    },
    financial: {
      name: "Taloudellinen vastuu",
      description:
        "Kuinka suuri vastuu roolilla on budjetista, kustannuksista, tuotoista tai taloudellisesta tuloksesta.",
      helpText:
        "Tämä kriteeri kuvaa roolin vastuuta taloudellisista resursseista tai taloudellisista lopputuloksista. Se voi kattaa budjetin, kustannukset, tuotot, kannattavuuden, investoinnit tai vastuun liiketoiminta-alueesta, portfoliosta tai muista taloudellisista raameista. Kriteeri kuvaa, kuinka keskeinen taloudellinen ulottuvuus roolissa on.",
      anchors: [
        "Ei budjetti- tai kustannusvastuuta.",
        "Vaikuttaa kustannuksiin välillisesti päätösten kautta.",
        "Vastuu pienemmästä kustannusraamista tai osasta projektia/budjettia.",
        "Budjettivastuu omalla alueella/tiimissä.",
        "Vastuu suuremmasta budjetista/liiketoiminta-alueesta.",
        "Vastuu merkittävästä osasta yrityksen taloutta tai tulosta.",
      ],
      weightLevels: [
        "Yritys haluaa, että taloudellisella vastuulla on vain rajallinen vaikutus roolin kokonaisarviointiin. Budjetti- tai tulosvastuulle ei siis anneta erityisen suurta painoa mallissa.",
        "Yritys pitää taloudellista vastuuta merkityksellisenä, mutta katsoo, että sen tulee normaalisti painaa vähemmän kuin tärkeimmät kriteerit.",
        "Yritys haluaa, että taloudellisella vastuulla on selkeä ja tasapainoinen paikka mallissa. Budjettivaikutus, kustannusvastuu tai tulosvastuu lasketaan mukaan arvioinnin normaalina osana.",
        "Yritys haluaa, että tällä kriteerillä on vahva vaikutus. Roolit, joilla on selkeä vaikutus budjettiin, kustannuksiin, tuottoihin tai taloudellisiin tuloksiin, arvioidaan siksi korkeammalle suhteessa muihin rooleihin.",
        "Yritys pitää taloudellista vastuuta yhtenä mallin ratkaisevimmista ulottuvuuksista. Korkeat pisteet taloudellisessa vastuussa saavat siksi erittäin vahvan painoarvon roolin kokonaisarvioinnissa ja vaikuttavat normaalisti korkeampaan suhteelliseen palkka-asemointiin.",
      ],
      compliance: {
        purpose:
          "Mittaa roolin vastuuta taloudellisista resursseista tai lopputuloksista: budjetti, kustannukset, tuotot, kannattavuus, investoinnit tai vastuu liiketoiminta-alueen taloudesta.",
        whyRelevant:
          "Taloudellinen vastuu on osa roolin panosta, mutta sitä arvioidaan talouden tosiasiallisen päätösvastuun asteen perusteella, ei budjetin koon perusteella sinänsä, mikä tekee kriteeristä sukupuolineutraalin.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerien Itsenäisyys ja päätösvalta (päätösvalta) sekä Laajuus ja vaikutus kanssa; tässä painopiste on nimenomaan vastuussa taloudellisista raameista ja tuloksista.",
        biasRisk: "medium",
        biasComment:
          "Suurelle budjetille voidaan antaa liian suuri paino verrattuna monimutkaisuuteen, vastuuseen ja erityisosaamiseen, mikä voi suosia perinteisesti miesvaltaisia budjettia kantavia rooleja. Tasokuvaukset ovat sukupuolineutraaleja.",
        biasAction:
          "Kriteeri pidetään maltillisella painolla mallissa, jotta budjetin koko ei sinänsä hallitse arviointia, ja tasot kuvaavat päätösvastuuta pelkkien summien koon sijaan.",
      },
    },
    people: {
      name: "Henkilöstö-/esihenkilövastuu",
      description:
        "Kuinka suuri vastuu roolilla on muiden johtamisesta, työn organisoinnista ja tulosten saavuttamisesta ihmisten kautta.",
      helpText:
        "Tämä kriteeri kuvaa roolin vastuuta muiden johtamisesta. Se kattaa muodollisen henkilöstövastuun, operatiivisen työnjohdon, tiimin johtamisen ja vastuun suuremmista organisatorisista yksiköistä tai muista esihenkilöistä. Kriteeri kuvaa sekä johtamistehtävän laajuutta että vastuuta kapasiteetista, priorisoinnista, kehittämisestä ja suunnasta muiden kautta.",
      anchors: [
        "Ei henkilöstö- tai esihenkilövastuuta.",
        "Työn operatiivista ohjausta, mutta ei HR-vastuuta.",
        "Henkilöstövastuu työntekijöistä (M1).",
        "Esihenkilö useille tiimeille tai lähiesihenkilöille (M2).",
        "Toiminnon johtaja, jolla on useita johtamistasoja tai suurempi organisaatio.",
        "Strateginen johtaja yritystasolla (Head/Director/C-level).",
      ],
      weightLevels: [
        "Yritys haluaa, että henkilöstö- ja esihenkilövastuulla on vain rajallinen vaikutus roolin kokonaisarviointiin. Muodollinen johtajuus ei siis itsessään aja arviointia erityisen paljon.",
        "Yritys arvioi henkilöstö- ja esihenkilövastuun merkitykselliseksi, mutta katsoo, että sen tulee normaalisti painaa vähemmän kuin mallin tärkeimmät kriteerit.",
        "Yritys haluaa, että henkilöstö- ja esihenkilövastuulla on selkeä ja tasapainoinen paikka mallissa. Muiden johtamisen tulee vaikuttaa arviointiin, mutta ilman erityisen vahvistettua painoa.",
        "Yritys haluaa, että tällä kriteerillä on vahva vaikutus. Roolit, joilla on suurempi esihenkilövastuu, tiimivastuu tai muodollinen johtajuus, arvioidaan siksi selvästi korkeammalle suhteessa muihin rooleihin.",
        "Yritys pitää henkilöstö- ja esihenkilövastuuta yhtenä mallin ratkaisevimmista tekijöistä. Korkeat roolin arviointipisteet tällä ulottuvuudella saavat siksi suuren painoarvon kokonaisarvioinnissa ja normaalisti myös suhteellisessa palkkalogiikassa.",
      ],
      compliance: {
        purpose:
          "Mittaa roolin vastuuta muiden johtamisesta: muodollinen henkilöstövastuu, operatiivinen työnjohto, tiimin johtaminen sekä vastuu kapasiteetista, priorisoinnista ja kehittämisestä muiden ihmisten kautta.",
        whyRelevant:
          "Muiden johtaminen on osa roolin panosta toiminnan arvoon. Sitä arvioidaan johtamistehtävän laajuuden ja sisällön perusteella, ei tittelin tai alaisten lukumäärän perusteella, jotta pienen tiimin hyvä johtaminen ja suuren johtaminen arvioidaan tosiasiallisen vastuun eikä näkyvän arvon perusteella.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerien Laajuus ja vaikutus (organisatorinen ulottuvuus) sekä Itsenäisyys ja päätösvalta (päätösvalta) kanssa; tässä painopiste on nimenomaan vastuussa, jota käytetään muiden ihmisten kautta.",
        biasRisk: "medium",
        biasComment:
          "Näkyvän valtuutuksen ja alaisten lukumäärän palkitseminen enemmän kuin tosiasiallisen johtamisvaikutuksen voi yliarvioida perinteisesti miesvaltaisia esihenkilörooleja ja aliarvioida senioriasiantuntijoita ja koordinointipainotteista työtä. Tasokuvaukset sinänsä ovat sukupuolineutraaleja.",
        biasAction:
          "Tasoankkurit kuvaavat johtajuuden sisältöä pelkän alaisten lukumäärän sijaan, ja kriteeri pidetään maltillisella painolla, jotta esihenkilötitteli ei sinänsä hallitse arviointia.",
      },
    },
    formal: {
      name: "Muodollinen pätevyys",
      description:
        "Millaiset muodolliset pätevyysvaatimukset, kuten koulutus tai sertifiointi, rooliin tavallisesti liittyvät.",
      helpText:
        "Tämä kriteeri kuvaa muodollisia osaamisvaatimuksia, jotka tyypillisesti liittyvät rooliin. Se voi kattaa koulutustason, tutkinnon, sertifioinnin, laillistuksen tai muun muodollisesti tunnustetun osaamisen, jota vaaditaan tai tavallisesti edellytetään. Kriteeri kuvaa roolin muodollisen sisääntulotason riippumatta nykyisen henkilön taustasta.",
      anchors: [
        "Muodollisia ennakkovaatimuksia ei ole. Roolin voi oppia alusta sisäisellä perehdytyksellä. Ei vaadi erityistä teoreettista pohjaa tai ammattikoulutusta.",
        "Vaaditaan ammatillista perusosaamista. Rooli vaatii jonkin verran ennakko-osaamista alueelta (esim. lyhyempiä kursseja tai käytännön kokemusta), mutta ei toisen asteen jälkeistä koulutusta.",
        "Vaaditaan toisen asteen jälkeinen ammatillinen koulutus tai vastaava ennakko-osaaminen. Rooli vaatii ammattikorkeakoulutasoisen koulutuksen, sertifioinnin tai vastaavan teoreettisen pohjan tehtävien suorittamiseksi.",
        "Vaaditaan korkeakoulututkinto tai vastaava pätevöittävä ennakko-osaaminen. Rooli vaatii kandidaatin tutkinnon/insinööritutkinnon tai vastaavan dokumentoidun osaamisen tyypillisten tehtävien hoitamiseksi.",
        "Vaaditaan edistynyt akateeminen taso tai edistynyt erityissertifiointi. Rooli vaatii esim. maisterin tutkinnon, edistyneen sertifioinnin (IFRS, TISAX, turvallisuusselvitys, CPA jne.) tai vastaavan korkean teoreettisen tason.",
        "Vaaditaan korkeimman tason ammattiasiantuntemusta. Rooli vaatii tutkimustason osaamista, edistynyttä asiantuntija-akkreditointia tai erittäin merkittävää toimialakohtaista asiantuntemusta, joka asettaa normin alueelle.",
      ],
      weightLevels: [
        "Yritys haluaa, että muodollisen pätevyyden vaatimuksilla on vain rajallinen vaikutus roolin kokonaisarviointiin.",
        "Yritys arvioi muodollisen pätevyyden merkitykselliseksi, mutta katsoo, että kriteerin tulee normaalisti painaa vähemmän kuin mallin tärkeämmät ulottuvuudet.",
        "Yritys haluaa, että muodollisella pätevyydellä on selkeä ja tasapainoinen paikka mallissa. Koulutusvaatimusten tai vastaavien kokemusvaatimusten tulee vaikuttaa arviointiin normaalilla tasolla.",
        "Yritys haluaa, että tällä kriteerillä on vahva vaikutus. Roolit, joissa muodollinen pätevyys tai vastaava kokemustaso on erityisen tärkeä, saavat siksi selvästi suuremman painoarvon mallissa.",
        "Yritys pitää muodollista pätevyyttä yhtenä mallin ratkaisevimmista ulottuvuuksista. Korkeat arviointipisteet tällä tekijällä vaikuttavat siksi vahvasti roolin kokonaisarviointiin ja vaikuttavat normaalisti korkeampaan suhteelliseen palkka-asemointiin.",
      ],
      compliance: {
        purpose:
          "Mittaa muodollisia osaamisvaatimuksia, jotka tyypillisesti liittyvät rooliin: koulutustaso, tutkinto, sertifiointi, laillistus tai muu muodollisesti tunnustettu osaaminen, riippumatta nykyisen henkilön taustasta.",
        whyRelevant:
          "Muodolliset pätevyysvaatimukset voivat heijastaa roolin edellyttämää tiedon tasoa. Kriteeri kuvaa roolin muodollista sisääntulotasoa, ei yksilöä, ja se pidetään sidottuna tosiasialliseen työn sisältöön pysyäkseen sukupuolineutraalina.",
        overlapNotes:
          "Menee osittain päällekkäin kriteerin Osaamisen syvyys/laajuus kanssa; tässä painopiste on muodollisissa vaatimuksissa tosiasiallisesti sovelletun tiedon ja kokemuksen sijaan.",
        biasRisk: "medium",
        biasComment:
          "Muodolliseen asemaan nojaaminen tosiasiallisen työn sisällön sijaan voi asettaa epäedulliseen asemaan osaamisen, joka on hankittu muita kuin perinteisen koulutuksen kautta. Tasokuvaukset sallivat vastaavan dokumentoidun kokemuksen ja ovat sukupuolineutraaleja.",
        biasAction:
          "Tasot tunnustavat nimenomaisesti vastaavan kokemuksen muodollisen koulutuksen rinnalla, ja kriteeri pidetään matalalla painolla, jotta muodolliset ansiot eivät sinänsä aja arviointia.",
      },
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
