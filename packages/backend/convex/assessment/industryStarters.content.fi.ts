import type { StarterContent } from "./industryStarters"

// Finnish starter sets; same structure as the English module. One role per
// JOB (ADR-0005): seniority lives on the individual, so there are no
// junior/senior title variants; a senior whose work actually differs becomes
// its own role, added by the user. Machine-translated; flag for native review.
export const industryStartersFi: StarterContent = {
  itTelecom: [
    {
      name: "Tuotekehitys",
      roles: [
        {
          title: "Ohjelmistokehittäjä",
          trackKey: "IC",
          purpose:
            "Rakentaa ja ylläpitää ohjelmistoja, jotka täyttävät tuote- ja laatuvaatimukset.",
          responsibilities:
            "Suunnittele ja toteuta ominaisuuksia\nKirjoita ja katselmoi koodia\nKorjaa virheitä ja paranna suorituskykyä\nOsallistu teknisiin päätöksiin",
        },
        {
          title: "Tekninen vastaava",
          trackKey: "Lead",
          purpose:
            "Ohjaa tiimin teknistä suuntaa ja varmistaa hyvät kehityskäytännöt.",
          responsibilities:
            "Aseta tekninen suunta ja standardit\nKatselmoi arkkitehtuuri ja keskeiset päätökset\nOhjaa ja tue kehittäjiä\nKoordinoi toimituksia tiimissä",
        },
        {
          title: "Kehityspäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa kehitystiimiä luotettaviin toimituksiin ja kehittää sen jäseniä.",
          responsibilities:
            "Johda ja kehitä tiimiä\nSuunnittele kapasiteetti ja toimitukset\nAseta tavoitteet ja seuraa niitä\nTue rekrytointia ja kasvua",
        },
      ],
    },
    {
      name: "Tuote",
      roles: [
        {
          title: "Tuotepäällikkö",
          trackKey: "IC",
          purpose:
            "Omistaa tuotteen suunnan ja varmistaa, että oikeat asiat rakennetaan.",
          responsibilities:
            "Määritä tuotestrategia ja tiekartta\nPriorisoi työjonoa\nKerää ja analysoi käyttäjätarpeita\nLinjaa sidosryhmät ja tiimit",
        },
      ],
    },
    {
      name: "Suunnittelu",
      roles: [
        {
          title: "UX-suunnittelija",
          trackKey: "IC",
          purpose:
            "Muotoilee intuitiivisia käyttäjäkokemuksia tutkimuksen ja tuotetavoitteiden pohjalta.",
          responsibilities:
            "Tee käyttäjätutkimusta\nSuunnittele kulkuja ja käyttöliittymiä\nLuo prototyyppejä ja rautalankamalleja\nVahvista suunnitelmat testaamalla",
        },
      ],
    },
    {
      name: "Myynti",
      roles: [
        {
          title: "Asiakkuusmyyjä",
          trackKey: "IC",
          purpose:
            "Kasvattaa liiketoimintaa solmimalla kauppoja ja kehittämällä asiakkuuksia.",
          responsibilities:
            "Hallitse myyntiputkea\nKartoita ja edistä mahdollisuuksia\nNeuvottele ja solmi kauppoja\nYlläpidä asiakassuhteita",
        },
        {
          title: "Myyntijohtaja",
          trackKey: "M",
          purpose:
            "Johtaa myyntiorganisaatiota liikevaihto- ja kasvutavoitteiden saavuttamiseksi.",
          responsibilities:
            "Aseta myyntistrategia ja tavoitteet\nJohda ja valmenna myyntitiimiä\nEnnusta ja raportoi tuloksista\nKehitä avainasiakkaita ja kumppaneita",
        },
      ],
    },
    {
      name: "Asiakasmenestys",
      roles: [
        {
          title: "Tukiasiantuntija",
          trackKey: "IC",
          purpose:
            "Ratkaisee asiakkaiden ongelmia ja varmistaa myönteisen tukikokemuksen.",
          responsibilities:
            "Vastaa asiakkaiden kyselyihin\nSelvitä ja ratkaise ongelmia\nEskaloi monimutkaiset tapaukset\nDokumentoi ratkaisut ja palaute",
        },
        {
          title: "Asiakasmenestyspäällikkö",
          trackKey: "IC",
          purpose:
            "Varmistaa, että asiakkaat saavat arvoa ja jatkavat kasvuaan tuotteen kanssa.",
          responsibilities:
            "Perehdytä ja opasta asiakkaita\nSeuraa käyttöä ja asiakkaan tilaa\nEdistä uusintoja ja laajennuksia\nKerää ja välitä asiakaspalautetta",
        },
      ],
    },
  ],
  consulting: [
    {
      name: "Konsultointi",
      roles: [
        {
          title: "Konsultti",
          trackKey: "IC",
          purpose:
            "Tuottaa asiakastyötä ja neuvontaa, jotka ratkaisevat konkreettisia liiketoimintaongelmia.",
          responsibilities:
            "Analysoi asiakkaan tarpeita\nLaadi suosituksia\nToimita projektityötä\nEsittele tuloksia asiakkaille",
        },
        {
          title: "Toimeksiantovastaava",
          trackKey: "Lead",
          purpose:
            "Johtaa asiakastoimeksiantoja laadukkaisiin tuloksiin aikataulussa.",
          responsibilities:
            "Suunnittele ja rajaa toimeksiannot\nJohda toimitustiimiä\nHallitse asiakassuhteita\nVarmista toimitusten laatu",
        },
        {
          title: "Toimialapäällikkö",
          trackKey: "M",
          purpose:
            "Rakentaa ja pyörittää konsultointitoimialaa ja kehittää sen konsultteja.",
          responsibilities:
            "Aseta toimialan suunta\nJohda ja kehitä konsultteja\nValvo käyttöastetta ja toimituksia\nTue liiketoiminnan kehitystä",
        },
      ],
    },
    {
      name: "Myynti",
      roles: [
        {
          title: "Asiakkuuspäällikkö",
          trackKey: "IC",
          purpose:
            "Ylläpitää ja kasvattaa asiakkuuksia varmistaakseen jatkuvan liiketoiminnan.",
          responsibilities:
            "Hallitse asiakassuhteita\nTunnista uusia mahdollisuuksia\nValmistele tarjouksia\nSaavuta asiakkuustavoitteet",
        },
        {
          title: "Myyntipäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa myyntityötä kasvu- ja liikevaihtotavoitteiden saavuttamiseksi.",
          responsibilities:
            "Aseta myyntitavoitteet\nJohda myyntitiimiä\nEnnusta ja raportoi tuloksia\nKehitä keskeisiä asiakassuhteita",
        },
      ],
    },
    {
      name: "Toiminta",
      roles: [
        {
          title: "Hallinnon asiantuntija",
          trackKey: "IC",
          purpose:
            "Pitää päivittäisen toiminnan käynnissä tarkalla hallinnollisella tuella.",
          responsibilities:
            "Hoida hallinnollisia tehtäviä\nYlläpidä asiakirjoja ja järjestelmiä\nTue sisäisiä prosesseja\nKoordinoi aikatauluja ja logistiikkaa",
        },
        {
          title: "Talouspäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa taloushallintoa ja varmistaa hyvän taloudellisen ohjauksen.",
          responsibilities:
            "Hallitse budjetointia ja raportointia\nValvo kirjanpitoprosesseja\nVarmista taloudellinen vaatimustenmukaisuus\nJohda talousosastoa",
        },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Tuotanto",
      roles: [
        {
          title: "Koneenkäyttäjä",
          trackKey: "IC",
          purpose:
            "Käyttää tuotantolaitteita valmistaakseen tuotteita turvallisesti ja laatuvaatimusten mukaan.",
          responsibilities:
            "Käytä tuotantokoneita\nNoudata turvallisuusmenettelyjä\nSeuraa tuotannon laatua\nRaportoi häiriöt ja seisokit",
        },
        {
          title: "Tuotantoinsinööri",
          trackKey: "IC",
          purpose:
            "Parantaa tuotantoprosesseja tehokkuuden, laadun ja turvallisuuden vuoksi.",
          responsibilities:
            "Optimoi tuotantoprosesseja\nSelvitä teknisiä ongelmia\nTue laitteiden kunnossapitoa\nToteuta prosessiparannuksia",
        },
        {
          title: "Tuotantovastaava",
          trackKey: "Lead",
          purpose:
            "Koordinoi tuotantotiimiä tuotanto- ja laatutavoitteiden saavuttamiseksi.",
          responsibilities:
            "Suunnittele ja jaa vuorotyö\nOhjaa tuotantotiimiä\nSeuraa tuotantoa ja laatua\nRatkaise päivittäisiä ongelmia",
        },
        {
          title: "Tuotantopäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa tuotantotoimintaa volyymi-, kustannus- ja laatutavoitteiden saavuttamiseksi.",
          responsibilities:
            "Suunnittele tuotantokapasiteetti\nJohda tuotantotiimejä\nHallitse kustannuksia ja laatua\nEdistä jatkuvaa parantamista",
        },
      ],
    },
    {
      name: "Laatu",
      roles: [
        {
          title: "Laatuinsinööri",
          trackKey: "IC",
          purpose:
            "Varmistaa, että tuotteet täyttävät laatustandardit ja vaatimukset.",
          responsibilities:
            "Määritä laadunvalvonta\nTarkasta ja testaa tuotteita\nTutki laatupoikkeamia\nEdistä korjaavia toimenpiteitä",
        },
        {
          title: "Laatupäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa laatutoimintoa ja turvaa tuotteiden ja prosessien laadun.",
          responsibilities:
            "Omista laadunhallintajärjestelmä\nJohda laatutiimiä\nVarmista lakisääteinen vaatimustenmukaisuus\nEdistä laadun parantamista",
        },
      ],
    },
    {
      name: "Kunnossapito",
      roles: [
        {
          title: "Kunnossapitoasentaja",
          trackKey: "IC",
          purpose:
            "Pitää laitteet ja tilat toiminnassa korjausten ja huollon avulla.",
          responsibilities:
            "Tee ennakoivaa huoltoa\nDiagnosoi ja korjaa vikoja\nDokumentoi kunnossapitotyöt\nNoudata turvallisuusmenettelyjä",
        },
        {
          title: "Kunnossapitovastaava",
          trackKey: "Lead",
          purpose:
            "Koordinoi kunnossapitotyötä laitteiden käytettävyyden maksimoimiseksi.",
          responsibilities:
            "Suunnittele huoltoaikataulut\nOhjaa kunnossapitotiimiä\nPriorisoi korjaukset\nSeuraa laitteiden luotettavuutta",
        },
      ],
    },
    {
      name: "Logistiikka",
      roles: [
        {
          title: "Logistiikkakoordinaattori",
          trackKey: "IC",
          purpose:
            "Koordinoi tavaravirtaa, jotta toimitukset saapuvat ajallaan.",
          responsibilities:
            "Suunnittele lähetykset ja kuljetukset\nKoordinoi toimittajien kanssa\nSeuraa varastoa ja tilauksia\nRatkaise toimitusongelmia",
        },
        {
          title: "Logistiikkapäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa logistiikkatoimintaa tehokkaan hankinnan ja jakelun varmistamiseksi.",
          responsibilities:
            "Aseta logistiikkastrategia\nJohda logistiikkatiimiä\nOptimoi toimitusketjun virtoja\nHallitse logistiikkakustannuksia",
        },
      ],
    },
  ],
  retail: [
    {
      name: "Myymälät",
      roles: [
        {
          title: "Myyjä",
          trackKey: "IC",
          purpose: "Palvelee asiakkaita ja edistää myyntiä myymälässä.",
          responsibilities:
            "Auta ja neuvo asiakkaita\nKäsittele myyntitapahtumat\nYlläpidä myymälän siisteyttä\nHallitse hyllytavaraa",
        },
        {
          title: "Vuorovastaava",
          trackKey: "Lead",
          purpose:
            "Koordinoi myymälätiimiä vuoron aikana pitääkseen toiminnan sujuvana.",
          responsibilities:
            "Ohjaa henkilöstöä vuoron aikana\nAvaa ja sulje myymälä\nKäsittele asiakkaiden eskalaatiot\nSeuraa päivittäisiä myyntitehtäviä",
        },
        {
          title: "Myymäläpäällikkö",
          trackKey: "M",
          purpose:
            "Pyörittää myymälää myyntitavoitteiden saavuttamiseksi ja vahvan asiakaskokemuksen tuottamiseksi.",
          responsibilities:
            "Johda myymälähenkilöstöä\nEdistä myyntiä ja tavoitteita\nHallitse varastoa ja budjetteja\nVarmista palvelustandardit",
        },
        {
          title: "Aluepäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa myymäläryhmää tasaisen alueellisen tuloksen saavuttamiseksi.",
          responsibilities:
            "Johda useita myymäläpäälliköitä\nAseta aluekohtaiset tavoitteet\nEdistä myyntiä myymälöissä\nVarmista toiminnan yhdenmukaisuus",
        },
      ],
    },
    {
      name: "Verkkokauppa",
      roles: [
        {
          title: "Verkkokaupan asiantuntija",
          trackKey: "IC",
          purpose:
            "Pyörittää ja kehittää verkkokauppaa kasvattaakseen verkkomyyntiä.",
          responsibilities:
            "Ylläpidä tuotetietoja\nSeuraa verkkokaupan tuloksia\nTue kampanjoita ja tarjouksia\nParanna asiakaspolkua",
        },
        {
          title: "Verkkokauppapäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa verkkokauppakanavaa verkkokasvun tavoitteiden saavuttamiseksi.",
          responsibilities:
            "Aseta verkkokauppastrategia\nJohda verkkokauppatiimiä\nEdistä liikennettä ja konversiota\nOmista verkkomyyntitavoitteet",
        },
      ],
    },
    {
      name: "Hankinta",
      roles: [
        {
          title: "Ostaja",
          trackKey: "IC",
          purpose: "Hankkii ja ostaa tuotteita liiketoiminnalle oikein ehdoin.",
          responsibilities:
            "Valitse tuotteet ja toimittajat\nNeuvottele hinnat ja ehdot\nHallitse ostotilauksia\nSeuraa varastotasoja",
        },
        {
          title: "Ostopäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa hankintaa varmistaakseen oikeat tuotteet oikeaan hintaan.",
          responsibilities:
            "Aseta hankintastrategia\nJohda ostotiimiä\nNeuvottele keskeiset toimittajasopimukset\nHallitse hankintabudjetteja",
        },
      ],
    },
    {
      name: "Varasto ja logistiikka",
      roles: [
        {
          title: "Varastotyöntekijä",
          trackKey: "IC",
          purpose:
            "Käsittelee tavaraa varastossa pitääkseen tilaukset liikkeessä tarkasti.",
          responsibilities:
            "Vastaanota ja varastoi tavaraa\nKeräile ja pakkaa tilaukset\nYlläpidä varaston järjestystä\nNoudata turvallisuusmenettelyjä",
        },
        {
          title: "Varastopäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa varastotoimintaa tavaroiden tarkkaa ja oikea-aikaista käsittelyä varten.",
          responsibilities:
            "Johda varastohenkilöstöä\nSuunnittele varastointi ja virrat\nHallitse varaston tarkkuutta\nVarmista turvallisuus ja tehokkuus",
        },
      ],
    },
  ],
  publicSector: [
    {
      name: "Asiankäsittely",
      roles: [
        {
          title: "Asiankäsittelijä",
          trackKey: "IC",
          purpose:
            "Käsittelee asioita ja tekee päätöksiä sääntöjen ja määräysten mukaisesti.",
          responsibilities:
            "Arvioi ja käsittele asioita\nSovella asiaankuuluvia säädöksiä\nDokumentoi päätökset\nViesti hakijoiden kanssa",
        },
        {
          title: "Tiiminvetäjä",
          trackKey: "Lead",
          purpose:
            "Koordinoi asiankäsittelytiimiä varmistaakseen johdonmukaiset ja oikea-aikaiset päätökset.",
          responsibilities:
            "Jaa ja priorisoi asioita\nOhjaa ja tue tiimiä\nSeuraa käsittelyn laatua\nRatkaise monimutkaiset tapaukset",
        },
        {
          title: "Yksikön päällikkö",
          trackKey: "M",
          purpose:
            "Johtaa yksikköä sen tehtävän toteuttamiseksi ja henkilöstön kehittämiseksi.",
          responsibilities:
            "Johda ja kehitä henkilöstöä\nSuunnittele yksikön toimintaa\nAseta tavoitteet ja seuraa niitä\nVarmista lakisääteinen vaatimustenmukaisuus",
        },
      ],
    },
    {
      name: "Kehittäminen",
      roles: [
        {
          title: "Kehittämisasiantuntija",
          trackKey: "IC",
          purpose:
            "Edistää kehittämishankkeita, jotka vahvistavat julkisia palveluja.",
          responsibilities:
            "Analysoi kehittämistarpeita\nEhdota parannuksia\nTue toteutusta\nSeuraa tuloksia",
        },
        {
          title: "Projektivastaava",
          trackKey: "Lead",
          purpose:
            "Johtaa projekteja tavoiteltujen tulosten saavuttamiseksi aikataulussa ja budjetissa.",
          responsibilities:
            "Suunnittele ja rajaa projektit\nKoordinoi projektin jäseniä\nHallitse aikatauluja ja budjettia\nRaportoi edistymisestä",
        },
      ],
    },
    {
      name: "Hallinto",
      roles: [
        {
          title: "Hallintosihteeri",
          trackKey: "IC",
          purpose:
            "Tarjoaa hallinnollista tukea, joka pitää toiminnan käynnissä.",
          responsibilities:
            "Hoida hallinnollisia tehtäviä\nYlläpidä asiakirjoja ja järjestelmiä\nTue sisäisiä prosesseja\nKoordinoi aikatauluja ja kokouksia",
        },
        {
          title: "Kirjaaja",
          trackKey: "IC",
          purpose:
            "Hallinnoi virallisia asiakirjoja varmistaakseen oikean ja saavutettavan dokumentoinnin.",
          responsibilities:
            "Rekisteröi saapuvat asiakirjat\nYlläpidä asiakirjajärjestelmää\nVarmista oikea luokittelu\nTue asiakirjapyyntöjä",
        },
      ],
    },
  ],
  healthcare: [
    {
      name: "Hoito",
      roles: [
        {
          title: "Lähihoitaja",
          trackKey: "IC",
          purpose:
            "Tarjoaa käytännön hoitoa, joka tukee potilaiden päivittäistä hyvinvointia.",
          responsibilities:
            "Avusta potilaita päivittäisessä hoidossa\nTue hoitohenkilöstöä\nSeuraa potilaan vointia\nDokumentoi annettu hoito",
        },
        {
          title: "Sairaanhoitaja",
          trackKey: "IC",
          purpose:
            "Toteuttaa sairaanhoitoa ja turvaa potilaan turvallisuuden ja hyvinvoinnin.",
          responsibilities:
            "Arvioi ja suunnittele potilaan hoito\nAnna hoidot ja lääkitys\nSeuraa potilaan vointia\nDokumentoi ja raportoi hoito",
        },
        {
          title: "Erikoissairaanhoitaja",
          trackKey: "IC",
          purpose:
            "Tarjoaa vaativaa sairaanhoitoa kliinisen erikoisalan puitteissa.",
          responsibilities:
            "Toteuta erikoishoitoa\nOhjaa kollegoita erikoisalalla\nJohda kliinisiä arviointeja\nTue hoidon kehittämistä",
        },
        {
          title: "Yksikön päällikkö",
          trackKey: "M",
          purpose:
            "Johtaa hoitoyksikköä turvallisen ja laadukkaan hoidon tuottamiseksi ja henkilöstön kehittämiseksi.",
          responsibilities:
            "Johda ja kehitä henkilöstöä\nSuunnittele miehitys ja toiminta\nVarmista hoidon laatu ja turvallisuus\nHallitse yksikön budjettia",
        },
      ],
    },
    {
      name: "Sosiaalihuolto",
      roles: [
        {
          title: "Hoiva-avustaja",
          trackKey: "IC",
          purpose:
            "Tukee yksilöitä arjen tarpeissa heidän elämänlaatunsa ylläpitämiseksi.",
          responsibilities:
            "Avusta päivittäisissä toiminnoissa\nTue henkilökohtaista hoivaa\nHavainnoi ja raportoi muutoksia\nDokumentoi annettu tuki",
        },
        {
          title: "Ohjaaja",
          trackKey: "IC",
          purpose: "Tukee yksilöiden kehitystä ja itsenäisyyttä arjessa.",
          responsibilities:
            "Suunnittele ja tarjoa tukea\nKannusta taitoihin ja itsenäisyyteen\nNoudata yksilöllisiä hoitosuunnitelmia\nDokumentoi edistyminen",
        },
      ],
    },
    {
      name: "Hallinto",
      roles: [
        {
          title: "Hoidon hallintosihteeri",
          trackKey: "IC",
          purpose:
            "Tarjoaa hallinnollista tukea, joka pitää hoitotoiminnan käynnissä.",
          responsibilities:
            "Hoida hallinnollisia tehtäviä\nYlläpidä asiakirjoja ja aikatauluja\nTue hoitohenkilöstöä\nKoordinoi tapaamisia",
        },
        {
          title: "Toimintapäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa hoitotoimintaa laadukkaiden palvelujen tuottamiseksi ja henkilöstön kehittämiseksi.",
          responsibilities:
            "Johda ja kehitä henkilöstöä\nSuunnittele ja pyöritä toimintaa\nHallitse budjetteja ja laatua\nVarmista lakisääteinen vaatimustenmukaisuus",
        },
      ],
    },
  ],
  finance: [
    {
      name: "Neuvonta",
      roles: [
        {
          title: "Neuvoja",
          trackKey: "IC",
          purpose:
            "Neuvoo asiakkaita rahoitustuotteissa heidän tarpeidensa täyttämiseksi.",
          responsibilities:
            "Arvioi asiakkaan tarpeita\nSuosittele rahoitustuotteita\nHallitse asiakassuhteita\nVarmista neuvonnan vaatimustenmukaisuus",
        },
        {
          title: "Konttorinjohtaja",
          trackKey: "M",
          purpose:
            "Johtaa konttoria liiketoimintatavoitteiden saavuttamiseksi ja asiakkaiden hyväksi palvelemiseksi.",
          responsibilities:
            "Johda konttorin henkilöstöä\nEdistä myyntiä ja tavoitteita\nVarmista palvelun laatu\nValvo konttorin vaatimustenmukaisuutta",
        },
      ],
    },
    {
      name: "Analyysi",
      roles: [
        {
          title: "Analyytikko",
          trackKey: "IC",
          purpose:
            "Analysoi taloudellista tietoa hyvien liiketoimintapäätösten tueksi.",
          responsibilities:
            "Kerää ja analysoi tietoa\nRakenna talousmalleja\nLaadi raportteja ja näkemyksiä\nTue päätöksentekoa",
        },
        {
          title: "Pääanalyytikko",
          trackKey: "Lead",
          purpose:
            "Johtaa analyysityötä ja asettaa standardin taloudelliselle analyysille.",
          responsibilities:
            "Johda monimutkaisia analyysejä\nOhjaa ja katselmoi analyytikkoja\nMäärittele analyysimenetelmät\nEsittele näkemyksiä johdolle",
        },
      ],
    },
    {
      name: "Riski ja vaatimustenmukaisuus",
      roles: [
        {
          title: "Vaatimustenmukaisuusvastaava",
          trackKey: "IC",
          purpose:
            "Varmistaa, että organisaatio toimii lakien ja määräysten mukaisesti.",
          responsibilities:
            "Seuraa lakisääteistä vaatimustenmukaisuutta\nArvioi vaatimustenmukaisuusriskejä\nNeuvo vaatimuksissa\nRaportoi vaatimustenmukaisuusasioista",
        },
        {
          title: "Riskijohtaja",
          trackKey: "M",
          purpose:
            "Johtaa riskitoimintoa keskeisten riskien tunnistamiseksi ja hallitsemiseksi.",
          responsibilities:
            "Aseta riskikehikko\nJohda riskitiimiä\nValvo riskiarviointia\nRaportoi riskeistä johdolle",
        },
      ],
    },
    {
      name: "Taustatoiminnot",
      roles: [
        {
          title: "Käsittelijä",
          trackKey: "IC",
          purpose:
            "Käsittelee tapahtumat ja kirjaukset tarkasti toiminnan tueksi.",
          responsibilities:
            "Käsittele tapahtumia\nYlläpidä tarkkoja kirjauksia\nTäsmäytä tilejä\nRatkaise poikkeamia",
        },
        {
          title: "Tiiminvetäjä",
          trackKey: "Lead",
          purpose:
            "Koordinoi taustatoimintojen tiimiä tarkkaa ja oikea-aikaista käsittelyä varten.",
          responsibilities:
            "Jaa ja priorisoi työtä\nOhjaa ja tue tiimiä\nSeuraa käsittelyn laatua\nRatkaise monimutkaiset tapaukset",
        },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Projektit",
      roles: [
        {
          title: "Projekti-insinööri",
          trackKey: "IC",
          purpose:
            "Tarjoaa teknistä tukea rakennusprojektien oikeaan toteutukseen.",
          responsibilities:
            "Laadi teknistä dokumentaatiota\nTue projektin suunnittelua\nKoordinoi urakoitsijoiden kanssa\nSeuraa teknistä laatua",
        },
        {
          title: "Projektivastaava",
          trackKey: "Lead",
          purpose:
            "Johtaa projektin toimitusta laajuus-, aika- ja budjettitavoitteiden saavuttamiseksi.",
          responsibilities:
            "Suunnittele ja rajaa projektit\nKoordinoi projektitiimiä\nHallitse aikatauluja ja budjettia\nRaportoi edistymisestä",
        },
        {
          title: "Projektipäällikkö",
          trackKey: "M",
          purpose:
            "Omistaa projektin tulokset ja hallitsee sidosryhmiä, kustannuksia ja riskejä.",
          responsibilities:
            "Johda projektin toimitusta\nHallitse budjettia ja sopimuksia\nKäsittele sidosryhmiä ja riskejä\nVarmista projektin laatu",
        },
      ],
    },
    {
      name: "Tuotanto",
      roles: [
        {
          title: "Ammattilainen",
          trackKey: "IC",
          purpose:
            "Tekee ammattitaitoista käsityötä vaadittujen standardien mukaan työmaalla.",
          responsibilities:
            "Tee ammattityötä työmaalla\nNoudata piirustuksia ja eritelmiä\nYlläpidä laatua ja turvallisuutta\nRaportoi edistymisestä ja ongelmista",
        },
        {
          title: "Työnjohtaja",
          trackKey: "Lead",
          purpose:
            "Koordinoi työmaan työtä pitääkseen sen turvallisena, aikataulussa ja laatuvaatimusten mukaisena.",
          responsibilities:
            "Ohjaa työtä työmaalla\nKoordinoi ammattikuntia ja työryhmiä\nSeuraa turvallisuutta ja laatua\nRaportoi työmaan edistymisestä",
        },
        {
          title: "Vastaava työnjohtaja",
          trackKey: "M",
          purpose:
            "Johtaa työmaan toimintaa rakentamisen turvalliseen ja suunnitelmanmukaiseen toteutukseen.",
          responsibilities:
            "Johda työmaan henkilöstöä ja työryhmiä\nSuunnittele ja pyöritä työmaan toimintaa\nHallitse kustannuksia ja aikataulua\nVarmista työmaan turvallisuus ja laatu",
        },
      ],
    },
    {
      name: "Kiinteistönhallinta",
      roles: [
        {
          title: "Kiinteistöhuoltaja",
          trackKey: "IC",
          purpose:
            "Huoltaa kiinteistöjä pitääkseen rakennukset turvallisina ja toimivina.",
          responsibilities:
            "Tee kiinteistöhuoltoa\nKäsittele korjaukset ja viat\nTarkasta talotekniset järjestelmät\nVastaa asukkaiden pyyntöihin",
        },
        {
          title: "Kiinteistöpäällikkö",
          trackKey: "IC",
          purpose:
            "Hallinnoi kiinteistöjä pitääkseen ne hyvin hoidettuina ja asukkaat tyytyväisinä.",
          responsibilities:
            "Hallitse kiinteistön toimintaa\nHoida asukassuhteita\nKoordinoi huoltoa\nSeuraa kiinteistöbudjetteja",
        },
        {
          title: "Kiinteistöjohtaja",
          trackKey: "M",
          purpose:
            "Johtaa kiinteistönhallintaa kiinteistösalkun optimoimiseksi.",
          responsibilities:
            "Aseta kiinteistöstrategia\nJohda kiinteistötiimiä\nOptimoi salkun tuottoa\nHallitse kiinteistöbudjetteja",
        },
      ],
    },
  ],
  other: [
    {
      name: "Toiminta",
      roles: [
        {
          title: "Toimihenkilö",
          trackKey: "IC",
          purpose: "Tekee päivittäistä työtä, joka pitää toiminnan käynnissä.",
          responsibilities:
            "Tee päivittäisiä tehtäviä\nNoudata vakiintuneita prosesseja\nTue tiimin tavoitteita\nRaportoi ongelmista ja tuloksista",
        },
        {
          title: "Tiiminvetäjä",
          trackKey: "Lead",
          purpose:
            "Koordinoi tiimiä sen päivittäisten tavoitteiden saavuttamiseksi.",
          responsibilities:
            "Jaa ja priorisoi työtä\nOhjaa ja tue tiimiä\nSeuraa laatua ja edistymistä\nRatkaise päivittäisiä ongelmia",
        },
        {
          title: "Päällikkö",
          trackKey: "M",
          purpose:
            "Johtaa tiimiä sen tavoitteiden saavuttamiseksi ja sen jäsenten kehittämiseksi.",
          responsibilities:
            "Johda ja kehitä tiimiä\nSuunnittele ja pyöritä toimintaa\nAseta tavoitteet ja seuraa niitä\nHallitse budjettia ja laatua",
        },
      ],
    },
    {
      name: "Myynti",
      roles: [
        {
          title: "Myyntiedustaja",
          trackKey: "IC",
          purpose: "Edistää myyntiä hankkimalla ja palvelemalla asiakkaita.",
          responsibilities:
            "Tavoittele myyntimahdollisuuksia\nHallitse asiakassuhteita\nNeuvottele ja solmi kauppoja\nSaavuta myyntitavoitteet",
        },
        {
          title: "Myyntipäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa myyntityötä kasvu- ja liikevaihtotavoitteiden saavuttamiseksi.",
          responsibilities:
            "Aseta myyntitavoitteet\nJohda myyntitiimiä\nEnnusta ja raportoi tuloksia\nKehitä keskeisiä asiakassuhteita",
        },
      ],
    },
    {
      name: "Hallinto",
      roles: [
        {
          title: "Hallintosihteeri",
          trackKey: "IC",
          purpose:
            "Tarjoaa hallinnollista tukea, joka pitää liiketoiminnan käynnissä.",
          responsibilities:
            "Hoida hallinnollisia tehtäviä\nYlläpidä asiakirjoja ja järjestelmiä\nTue sisäisiä prosesseja\nKoordinoi aikatauluja ja kokouksia",
        },
        {
          title: "Talouspäällikkö",
          trackKey: "M",
          purpose:
            "Johtaa taloushallintoa ja varmistaa hyvän taloudellisen ohjauksen.",
          responsibilities:
            "Hallitse budjetointia ja raportointia\nValvo kirjanpitoprosesseja\nVarmista taloudellinen vaatimustenmukaisuus\nJohda talousosastoa",
        },
      ],
    },
  ],
}
