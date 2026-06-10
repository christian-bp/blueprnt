import type { StandardTemplateContent } from "./standardTemplate.content.en"

// Finnish content for the standard template. This is a translation draft of
// the Swedish source (standardTemplate.content.sv.ts) and must be reviewed by
// a native speaker before it ships to users. All structural decisions live in
// standardTemplate.ts; this module carries only prose.
export const standardTemplateContentFi: StandardTemplateContent = {
  modelName: "Vakiomalli",
  criteria: {
    scope: {
      name: "Laajuus ja vaikutus",
      description: "Tulosten/vastuun ulottuvuus (tiimistä yritykseen).",
      helpText:
        "Punnitse roolin ulottuvuutta: kuinka pitkälle sen tulokset ja vastuu yltävät, omista tehtävistä koko yrityksen laajuiseen vaikutukseen.",
      anchors: [
        "Vastuu omista tehtävistä selkeästi rajatulla alueella.",
        "Vaikutus oman tiimin sisällä; vastuu hyvin määritellyistä toimituksista.",
        "Omistajuus osa-alueesta tai toistuvasta prosessista; vaikutus pienemmän funktion sisällä.",
        "Vastuu suuremmasta alueesta, projektista tai virrasta; vaikuttaa useisiin tiimeihin/funktioihin.",
        "Vaikuttaa liiketoiminta-/toimintoalueeseen; määrittää suunnan suuremmille osille organisaatiota.",
        "Yrityksenlaajuinen vaikutus; strateginen vastuu ja suora vaikutus organisaation tuloksiin.",
      ],
    },
    risk: {
      name: "Riski ja seuraukset",
      description: "Virheiden hinta, vaatimustenmukaisuus, brändi.",
      helpText:
        "Punnitse seurausta, jos rooli tekee virheen: helposti korjattavista virheistä kriittiseen vaikutukseen tuloksiin, maineeseen tai vaatimustenmukaisuuteen.",
      anchors: [
        "Vähäinen vaikutus; virheet voidaan korjata helposti.",
        "Vaikuttaa lähinnä omaan työhön tai tiimiin.",
        "Virheet vaikuttavat toimituksiin tai laatuun pienemmässä mittakaavassa.",
        "Virheillä on tuntuvia seurauksia prosesseille, aikatauluille tai asiakassuhteille.",
        "Suuri vaikutus talouteen, maineeseen tai vaatimustenmukaisuuteen.",
        "Kriittinen vaikutus organisaation tuloksiin, strategiaan tai sääntelyn noudattamiseen.",
      ],
    },
    complexity: {
      name: "Monimutkaisuus ja epäselvyys",
      description: "Tekninen/liiketoiminnallinen monimutkaisuus ja epävarmuus.",
      helpText:
        "Punnitse työn vaikeutta ja epävarmuutta: rutiininomaisista, hyvin määritellyistä tehtävistä uusiin alueisiin, joissa epävarmuus on suuri.",
      anchors: [
        "Työ on rutiininomaista ja hyvin määriteltyä selkein ohjein.",
        "Käsittelee standardoituja tehtäviä, joissa on vähän vaihtelua.",
        "Ratkaisee tehtäviä, joissa on jonkin verran vaihtelua ja tarvetta omalle analyysille.",
        "Työskentelee useiden riippuvuuksien ja kompromissien kanssa; vaatii tulkintaa ja priorisointia.",
        "Suuri monimutkaisuus; käsittelee ristiriitaisia vaatimuksia ja epäselviä edellytyksiä.",
        "Äärimmäisen monimutkaisia tilanteita; vie eteenpäin tuntemattomilla/innovatiivisilla alueilla, joissa epävarmuus on suuri.",
      ],
    },
    autonomy: {
      name: "Itsenäisyys ja päätösvalta",
      description: "Itsenäisyys ja päätösten taso.",
      helpText:
        "Punnitse kuinka itsenäisesti rooli toimii ja kuinka painavia päätöksiä se tekee: ohjeiden noudattamisesta päätöksiin, jotka vaikuttavat koko organisaatioon.",
      anchors: [
        "Työskentelee tiiviisti ohjattuna; noudattaa ohjeita.",
        "Itsenäinen arkisissa tehtävissä määriteltyjen raamien sisällä.",
        "Tekee omia aloitteita ja priorisointeja omalla alueellaan.",
        "Tekee taktisia päätöksiä, jotka vaikuttavat tiimiin tai työnkulkuun.",
        "Tekee strategisia päätöksiä toimialueensa sisällä ja määrittää suunnan osa-alueelle.",
        "Tekee päätöksiä, jotka vaikuttavat useisiin toimialueisiin tai koko organisaatioon.",
      ],
    },
    stakeholders: {
      name: "Sidosryhmien laajuus",
      description:
        "Sisäinen/ulkoinen yhteistyö, toimintorajat ylittävä koordinointi.",
      helpText:
        "Punnitse roolin yhteistyön laajuutta ja monimutkaisuutta: oman tiimin sisällä työskentelystä strategisten ulkoisten sidosryhmien hallintaan.",
      anchors: [
        "Yhteistyö pääasiassa oman tiimin sisällä.",
        "Yhteistyö lähifunktioiden kanssa.",
        "Säännöllistä toimintorajat ylittävää yhteistyötä.",
        "Koordinointi ulkoisten osapuolten/asiakkaiden tai useiden sisäisten funktioiden kanssa.",
        "Hallitsee monimutkaista sidosryhmäympäristöä, jossa on kilpailevia intressejä.",
        "Edustaa organisaatiota ulospäin ja hallitsee strategisia sidosryhmiä.",
      ],
    },
    knowledge: {
      name: "Osaamisen syvyys/laajuus",
      description:
        "Asiantuntemuksen taso, poikkitieteellinen laajuus, kokemus.",
      helpText:
        "Punnitse roolin vaatimaa osaamista: perehdytystasosta vakiintuneine rutiineineen toimialaa johtavaan asiantuntemukseen, joka määrittää suunnan organisaation tuleville kyvykkyyksille.",
      anchors: [
        "Rooli vaatii perustason osaamista. Rooli edellyttää perehdytystasoa omalla alueellaan ja että tehtävät voidaan suorittaa vakiintuneiden rutiinien ja ohjeiden avulla.",
        "Rooli vaatii vankkaa ammattiosaamista määritellyllä alueella. Rooli tarvitsee selkeästi määriteltyä ja vakiintunutta osaamista toimialueellaan sekä kykyä soveltaa standardoituja työmenetelmiä.",
        "Rooli vaatii syvennettyä osaamista ja menetelmien ymmärrystä. Roolin on käsiteltävä monimutkaisempia tehtäviä, käytettävä edistyneempiä menetelmiä/työkaluja ja ymmärrettävä hyvin, miten alue toimii käytännössä.",
        "Rooli vaatii edistynyttä erityisosaamista. Rooli vaatii syvempää osaamista yhdellä tai useammalla osa-alueella sekä kykyä käsitellä vaikeampia ongelmia, tehdä analyysejä ja tuottaa ratkaisuja, joista tulee ohjaavia operatiivisessa työssä.",
        "Rooli vaatii asiantuntijaosaamista monimutkaisella toimialueella. Rooli edellyttää, että sen haltija määrittelee menetelmät, rakenteet ja työtavat toimialueellaan ja toimii sisäisenä asiantuntijana vaativissa kysymyksissä.",
        "Rooli vaatii toimialaa johtavaa osaamista ja tiedon kehittämistä. Rooli vaatii, että sen haltija kehittää uusia työtapoja, malleja tai tekniikoita ja määrittää suunnan ja periaatteet organisaation tuleville kyvykkyyksille alueella.",
      ],
    },
    financial: {
      name: "Taloudellinen vastuu",
      description: "Budjetti/tuloslaskelma/portfolio.",
      helpText:
        "Punnitse roolin taloudellista vastuuta: budjettivastuun puuttumisesta vastuuseen merkittävästä osasta yrityksen taloutta tai tulosta.",
      anchors: [
        "Ei budjetti- tai kustannusvastuuta.",
        "Vaikuttaa kustannuksiin välillisesti päätösten kautta.",
        "Vastuu pienemmästä kustannusraamista tai osasta projektia/budjettia.",
        "Budjettivastuu omalla alueella/tiimissä.",
        "Vastuu suuremmasta budjetista/liiketoiminta-alueesta.",
        "Vastuu merkittävästä osasta yrityksen taloutta tai tulosta.",
      ],
    },
    people: {
      name: "Henkilöstö-/esihenkilövastuu",
      description: "Lead/M1-M3/Head ja tiimin koko.",
      helpText:
        "Punnitse roolin muodollista henkilöstö- ja esihenkilövastuuta: vastuun puuttumisesta strategiseen johtajuuteen yritystasolla.",
      anchors: [
        "Ei henkilöstö- tai esihenkilövastuuta.",
        "Työn operatiivista ohjausta, mutta ei HR-vastuuta.",
        "Henkilöstövastuu työntekijöistä (M1).",
        "Esihenkilö useille tiimeille tai lähiesihenkilöille (M2).",
        "Toiminnon johtaja, jolla on useita johtamistasoja tai suurempi organisaatio.",
        "Strateginen johtaja yritystasolla (Head/Director/C-level).",
      ],
    },
    formal: {
      name: "Muodollinen pätevyys",
      description: "Vaadittu koulutustaso tai vastaava kokemus rekrytoinnissa.",
      helpText:
        "Punnitse roolin rekrytoinnissa vaatimaa muodollista koulutusta tai vastaavaa kokemusta: ei ennakkovaatimuksia aina korkeimman tason ammattiasiantuntemukseen.",
      anchors: [
        "Muodollisia ennakkovaatimuksia ei ole. Roolin voi oppia alusta sisäisellä perehdytyksellä. Ei vaadi erityistä teoreettista pohjaa tai ammattikoulutusta.",
        "Vaaditaan ammatillista perusosaamista. Rooli vaatii jonkin verran ennakko-osaamista alueelta (esim. lyhyempiä kursseja tai käytännön kokemusta), mutta ei toisen asteen jälkeistä koulutusta.",
        "Vaaditaan toisen asteen jälkeinen ammatillinen koulutus tai vastaava ennakko-osaaminen. Rooli vaatii ammattikorkeakoulutasoisen koulutuksen, sertifioinnin tai vastaavan teoreettisen pohjan tehtävien suorittamiseksi.",
        "Vaaditaan korkeakoulututkinto tai vastaava pätevöittävä ennakko-osaaminen. Rooli vaatii kandidaatin tutkinnon/insinööritutkinnon tai vastaavan dokumentoidun osaamisen tyypillisten tehtävien hoitamiseksi.",
        "Vaaditaan edistynyt akateeminen taso tai edistynyt erityissertifiointi. Rooli vaatii esim. maisterin tutkinnon, edistyneen sertifioinnin (IFRS, TISAX, turvallisuusselvitys, CPA jne.) tai vastaavan korkean teoreettisen tason.",
        "Vaaditaan korkeimman tason ammattiasiantuntemusta. Rooli vaatii tutkimustason osaamista, edistynyttä asiantuntija-akkreditointia tai erittäin merkittävää toimialakohtaista asiantuntemusta, joka asettaa normin alueelle.",
      ],
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
