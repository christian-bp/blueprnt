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
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
