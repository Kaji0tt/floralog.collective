
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Database, Upload } from "lucide-react";

export default function AdminPlantImporter() {
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const { data: genera = [] } = useQuery({
    queryKey: ['genera'],
    queryFn: () => base44.entities.PlantGenus.list(),
  });

  const createPlantMutation = useMutation({
    mutationFn: (data) => base44.entities.Plant.create(data),
  });

  const findGenusId = (genusName) => {
    const genus = genera.find(g => 
      g.genus_name.toLowerCase() === genusName.toLowerCase()
    );
    return genus ? genus.id : null;
  };

  const plantsToImport = [
    // BÄUME - Eiche
    { genusName: "Eiche", species_name: "Stieleiche", scientific_name: "Quercus robur", rarity: "Häufig", description: "Die Stieleiche ist ein mächtiger Laubbaum mit tief gelappten Blättern. Ihre Eicheln sitzen an langen Stielen.", identification_features: "Lange Blattstiele, kurze Fruchtstiele mit gestielten Eicheln", fun_fact: "Eine Stieleiche kann über 1000 Jahre alt werden!" },
    { genusName: "Eiche", species_name: "Traubeneiche", scientific_name: "Quercus petraea", rarity: "Gelegentlich", description: "Die Traubeneiche ähnelt der Stieleiche, ihre Eicheln sitzen aber in Büscheln direkt am Zweig.", identification_features: "Kurze oder keine Blattstiele, Eicheln in traubenförmigen Büscheln", fun_fact: "Traubeneichen können bis zu 40 Meter hoch werden!" },
    { genusName: "Eiche", species_name: "Roteiche", scientific_name: "Quercus rubra", rarity: "Selten", description: "Nordamerikanische Eiche mit roter Herbstfärbung.", identification_features: "Spitz gezähnte Blätter, rote Herbstfärbung", fun_fact: "Die Roteiche wächst sehr schnell!" },
    
    // Buche
    { genusName: "Buche", species_name: "Rotbuche", scientific_name: "Fagus sylvatica", rarity: "Häufig", description: "Die Rotbuche ist der häufigste Laubbaum in deutschen Wäldern mit glatter grauer Rinde.", identification_features: "Glatte graue Rinde, eiförmige Blätter mit welligem Rand", fun_fact: "Bucheckern waren früher ein wichtiges Nahrungsmittel!" },
    
    // Birke
    { genusName: "Birke", species_name: "Sandbirke", scientific_name: "Betula pendula", rarity: "Häufig", description: "Die Sandbirke hat eine charakteristische weiße Rinde und hängende Zweige.", identification_features: "Weiße Rinde mit schwarzen Rauten, dreieckige gezähnte Blätter", fun_fact: "Die weiße Rinde schützt vor Sonnenbrand!" },
    { genusName: "Birke", species_name: "Moorbirke", scientific_name: "Betula pubescens", rarity: "Gelegentlich", description: "Die Moorbirke wächst auf feuchten Böden und hat behaarte Zweige.", identification_features: "Weiße Rinde ohne Rauten, behaarte Zweige, rundliche Blätter", fun_fact: "Moorbirken können auf sehr nassen Böden wachsen!" },
    
    // Ahorn
    { genusName: "Ahorn", species_name: "Bergahorn", scientific_name: "Acer pseudoplatanus", rarity: "Häufig", description: "Der Bergahorn ist ein großer Baum mit fünflappigen Blättern.", identification_features: "Große fünflappige Blätter, geflügelte Früchte", fun_fact: "Aus Bergahorn werden Violinen gebaut!" },
    { genusName: "Ahorn", species_name: "Spitzahorn", scientific_name: "Acer platanoides", rarity: "Häufig", description: "Der Spitzahorn hat spitz zulaufende Blattlappen.", identification_features: "Spitze Blattlappen, gelbe Herbstfärbung", fun_fact: "Der Spitzahorn blüht schon im zeitigen Frühjahr!" },
    { genusName: "Ahorn", species_name: "Feldahorn", scientific_name: "Acer campestre", rarity: "Gelegentlich", description: "Kleinerer Ahorn mit korkigen Zweigen.", identification_features: "Kleine Blätter mit stumpfen Lappen, korkige Rinde", fun_fact: "Wird oft als Hecke gepflanzt!" },
    
    // Linde
    { genusName: "Linde", species_name: "Winterlinde", scientific_name: "Tilia cordata", rarity: "Häufig", description: "Laubbaum mit herzförmigen Blättern und duftenden Blüten.", identification_features: "Kleine herzförmige Blätter, rostbraune Haarbüschel in Blattachseln", fun_fact: "Lindenblütentee hilft bei Erkältungen!" },
    { genusName: "Linde", species_name: "Sommerlinde", scientific_name: "Tilia platyphyllos", rarity: "Häufig", description: "Größere Linde mit größeren Blättern.", identification_features: "Größere Blätter als Winterlinde, weiße Haarbüschel", fun_fact: "Sommerlinden werden bis zu 1000 Jahre alt!" },
    
    // Kastanie
    { genusName: "Kastanie", species_name: "Rosskastanie", scientific_name: "Aesculus hippocastanum", rarity: "Häufig", description: "Baum mit gefingerten Blättern und stacheligen Früchten.", identification_features: "5-7 gefingerte Blätter, weiße Blütenkerzen, stachelige Früchte", fun_fact: "Kinder spielen damit Kastanien-Wettbewerbe!" },
    
    // Kiefer
    { genusName: "Kiefer", species_name: "Waldkiefer", scientific_name: "Pinus sylvestris", rarity: "Häufig", description: "Nadelbaum mit rotbrauner Rinde und langen Nadeln.", identification_features: "Paarweise Nadeln, rotbraune Rinde im oberen Bereich", fun_fact: "Kiefern können über 600 Jahre alt werden!" },
    { genusName: "Kiefer", species_name: "Schwarzkiefer", scientific_name: "Pinus nigra", rarity: "Gelegentlich", description: "Kiefer mit dunklerer Rinde und steiferen Nadeln.", identification_features: "Dunkelgraue bis schwarze Rinde, steife dunkelgrüne Nadeln", fun_fact: "Sehr trockenheitsresistent!" },
    
    // Fichte
    { genusName: "Fichte", species_name: "Gemeine Fichte", scientific_name: "Picea abies", rarity: "Häufig", description: "Der klassische Weihnachtsbaum mit hängenden Zapfen.", identification_features: "Einzeln stehende Nadeln, hängende Zapfen", fun_fact: "Die Fichte ist der häufigste Nadelbaum in Deutschland!" },
    
    // Tanne
    { genusName: "Tanne", species_name: "Weißtanne", scientific_name: "Abies alba", rarity: "Gelegentlich", description: "Nadelbaum mit aufrecht stehenden Zapfen.", identification_features: "Nadeln mit weißen Streifen unten, aufrechte Zapfen", fun_fact: "Tannen können über 500 Jahre alt werden!" },
    
    // Erle
    { genusName: "Erle", species_name: "Schwarzerle", scientific_name: "Alnus glutinosa", rarity: "Häufig", description: "Baum der an Gewässern wächst mit kleinen Zapfen.", identification_features: "Klebrige junge Blätter, kleine Zapfen", fun_fact: "Erlenholz wird unter Wasser nicht morsch!" },
    { genusName: "Erle", species_name: "Grauerle", scientific_name: "Alnus incana", rarity: "Gelegentlich", description: "Kleinere Erle mit grauen Zweigen.", identification_features: "Graue Rinde, spitze Blätter", fun_fact: "Wächst an Flussufern und Gebirgsbächen!" },
    
    // Ulme
    { genusName: "Ulme", species_name: "Bergulme", scientific_name: "Ulmus glabra", rarity: "Selten", description: "Großer Laubbaum mit asymmetrischen Blättern.", identification_features: "Asymmetrische Blattbasis, raue Oberseite", fun_fact: "Ulmen sind durch das Ulmensterben bedroht!" },
    { genusName: "Ulme", species_name: "Feldulme", scientific_name: "Ulmus minor", rarity: "Selten", description: "Mittelgroßer Baum mit kleinen Blättern.", identification_features: "Kleinere Blätter als Bergulme, gefurchte Rinde", fun_fact: "War früher sehr häufig!" },
    
    // Esche
    { genusName: "Esche", species_name: "Gemeine Esche", scientific_name: "Fraxinus excelsior", rarity: "Häufig", description: "Hoher Laubbaum mit gefiederten Blättern.", identification_features: "Gefiederte Blätter, schwarze Knospen", fun_fact: "Eschenholz ist sehr elastisch!" },
    
    // Pappel
    { genusName: "Pappel", species_name: "Zitterpappel", scientific_name: "Populus tremula", rarity: "Häufig", description: "Baum dessen Blätter schon bei leichtem Wind zittern.", identification_features: "Runde zitternde Blätter, glatte Rinde", fun_fact: "Die Blätter zittern wegen ihrer besonderen Blattstiele!" },
    { genusName: "Pappel", species_name: "Schwarzpappel", scientific_name: "Populus nigra", rarity: "Gelegentlich", description: "Großer Baum mit dreieckigen Blättern.", identification_features: "Dreieckige Blätter, dunkle rissige Rinde", fun_fact: "Kann über 30 Meter hoch werden!" },
    
    // Weide
    { genusName: "Weide", species_name: "Silberweide", scientific_name: "Salix alba", rarity: "Häufig", description: "Baum mit silbrig schimmernden Blättern.", identification_features: "Silbrige Blattunterseite, schmale Blätter", fun_fact: "Aus Weidenrinde wurde früher Aspirin gewonnen!" },
    { genusName: "Weide", species_name: "Trauerweide", scientific_name: "Salix babylonica", rarity: "Gelegentlich", description: "Baum mit hängenden Zweigen.", identification_features: "Stark hängende Zweige, schmale Blätter", fun_fact: "Wächst oft an Teichen!" },
    { genusName: "Weide", species_name: "Salweide", scientific_name: "Salix caprea", rarity: "Häufig", description: "Strauch mit weichen Kätzchen im Frühjahr.", identification_features: "Weiche gelbe Kätzchen, rundliche Blätter", fun_fact: "Wichtige Nahrung für Bienen im Frühjahr!" },
    
    // Eberesche
    { genusName: "Eberesche", species_name: "Vogelbeere", scientific_name: "Sorbus aucuparia", rarity: "Häufig", description: "Baum mit gefiederten Blättern und roten Beeren.", identification_features: "Gefiederte Blätter, orange-rote Beeren", fun_fact: "Die Beeren sind roh ungenießbar, gekocht aber essbar!" },
    
    // Kirsche
    { genusName: "Kirsche", species_name: "Vogelkirsche", scientific_name: "Prunus avium", rarity: "Häufig", description: "Wildkirsche mit weißen Blüten und kleinen Früchten.", identification_features: "Weiße Blüten, kleine schwarzrote Kirschen", fun_fact: "Aus ihr wurden unsere Süßkirschen gezüchtet!" },
    { genusName: "Kirsche", species_name: "Traubenkirsche", scientific_name: "Prunus padus", rarity: "Gelegentlich", description: "Strauch mit duftenden weißen Blütentrauben.", identification_features: "Lange hängende Blütentrauben, bittere schwarze Beeren", fun_fact: "Duftet wunderbar im Frühling!" },
    
    // Apfel
    { genusName: "Apfel", species_name: "Holzapfel", scientific_name: "Malus sylvestris", rarity: "Selten", description: "Wildapfel mit kleinen sauren Früchten.", identification_features: "Kleine grüne Äpfel, oft dornige Zweige", fun_fact: "Urform unserer Kulturäpfel!" },
    
    // Birne
    { genusName: "Birne", species_name: "Holzbirne", scientific_name: "Pyrus pyraster", rarity: "Selten", description: "Wildbirne mit kleinen harten Früchten.", identification_features: "Kleine harte Birnen, glänzende Blätter", fun_fact: "Wurde früher für Werkzeugstiele verwendet!" },
    
    // Hainbuche
    { genusName: "Hainbuche", species_name: "Hainbuche", scientific_name: "Carpinus betulus", rarity: "Häufig", description: "Laubbaum mit geriffeltem Stamm.", identification_features: "Geriffelter grauer Stamm, gezähnte Blätter", fun_fact: "Ist keine echte Buche, sondern verwandt mit Birken!" },
    
    // Lärche
    { genusName: "Lärche", species_name: "Europäische Lärche", scientific_name: "Larix decidua", rarity: "Gelegentlich", description: "Nadelbaum der im Winter seine Nadeln verliert.", identification_features: "Weiche Nadelbüschel, im Herbst gold-gelbe Färbung", fun_fact: "Der einzige heimische Nadelbaum der seine Nadeln verliert!" },
    
    // Douglasie
    { genusName: "Douglasie", species_name: "Gewöhnliche Douglasie", scientific_name: "Pseudotsuga menziesii", rarity: "Gelegentlich", description: "Nordamerikanischer Nadelbaum.", identification_features: "Zapfen mit herausragenden Deckschuppen", fun_fact: "Wächst extrem schnell!" },
    
    // Wacholder
    { genusName: "Wacholder", species_name: "Gemeiner Wacholder", scientific_name: "Juniperus communis", rarity: "Gelegentlich", description: "Nadelgehölz mit blauen Beerenzapfen.", identification_features: "Nadelblätter in Dreiergruppen, blaue Beeren", fun_fact: "Die Beeren würzen Gin!" },
    
    // Eibe
    { genusName: "Eibe", species_name: "Europäische Eibe", scientific_name: "Taxus baccata", rarity: "Selten", description: "Immergrüner Nadelbaum mit roten Früchten.", identification_features: "Flache weiche Nadeln, rote becherförmige Früchte", fun_fact: "Extrem giftig, aber der rote Samenmantel ist essbar!" },
    
    // Robinie
    { genusName: "Robinie", species_name: "Scheinakazie", scientific_name: "Robinia pseudoacacia", rarity: "Häufig", description: "Baum mit gefiederten Blättern und duftenden weißen Blüten.", identification_features: "Gefiederte Blätter, Dornen an Zweigen, weiße Blütentrauben", fun_fact: "Stammt aus Nordamerika!" },
    
    // Platane
    { genusName: "Platane", species_name: "Ahornblättrige Platane", scientific_name: "Platanus × hispanica", rarity: "Gelegentlich", description: "Großer Stadtbaum mit abblätternder Rinde.", identification_features: "Fleckige abblätternde Rinde, ahornähnliche Blätter", fun_fact: "Kann Luftverschmutzung gut vertragen!" },
    
    // STRÄUCHER
    // Holunder
    { genusName: "Holunder", species_name: "Schwarzer Holunder", scientific_name: "Sambucus nigra", rarity: "Häufig", description: "Strauch mit weißen Blütendolden und schwarzen Beeren.", identification_features: "Gefiederte Blätter, weiße Dolden, schwarze Beeren", fun_fact: "Aus Holunderblüten macht man leckeren Sirup!" },
    { genusName: "Holunder", species_name: "Trauben-Holunder", scientific_name: "Sambucus racemosa", rarity: "Gelegentlich", description: "Strauch mit roten Beeren.", identification_features: "Gelbe Blüten, rote Beeren", fun_fact: "Wächst oft in Bergwäldern!" },
    
    // Haselnuss
    { genusName: "Haselnuss", species_name: "Gemeine Hasel", scientific_name: "Corylus avellana", rarity: "Häufig", description: "Strauch mit essbaren Nüssen.", identification_features: "Runde gezähnte Blätter, männliche Kätzchen, essbare Nüsse", fun_fact: "Liefert uns die leckeren Haselnüsse!" },
    
    // Brombeere
    { genusName: "Brombeere", species_name: "Echte Brombeere", scientific_name: "Rubus fruticosus", rarity: "Häufig", description: "Stacheliger Strauch mit schwarzen Beeren.", identification_features: "Stachelige Ranken, zusammengesetzte Blätter, schwarze Sammelfrüchte", fun_fact: "Es gibt über 400 Brombeerarten!" },
    { genusName: "Brombeere", species_name: "Himbeere", scientific_name: "Rubus idaeus", rarity: "Häufig", description: "Strauch mit roten süßen Beeren.", identification_features: "Bestachelte Ranken, unterseits weiß-filzige Blätter, rote Beeren", fun_fact: "Wilde Himbeeren sind besonders aromatisch!" },
    
    // Heckenrose
    { genusName: "Heckenrose", species_name: "Hundsrose", scientific_name: "Rosa canina", rarity: "Häufig", description: "Wilde Rose mit rosa Blüten und Hagebutten.", identification_features: "Rosa Blüten, gebogene Stacheln, rote Hagebutten", fun_fact: "Hagebutten enthalten sehr viel Vitamin C!" },
    { genusName: "Heckenrose", species_name: "Weinrose", scientific_name: "Rosa rubiginosa", rarity: "Gelegentlich", description: "Rose die nach Äpfeln duftet.", identification_features: "Blätter duften nach Äpfeln, rosa Blüten", fun_fact: "Auch Apfelrose genannt!" },
    
    // Weißdorn
    { genusName: "Weißdorn", species_name: "Eingriffeliger Weißdorn", scientific_name: "Crataegus monogyna", rarity: "Häufig", description: "Dorniger Strauch mit weißen Blüten.", identification_features: "Tief gelappte Blätter, ein Griffel, rote Beeren", fun_fact: "Wichtig für die Herzgesundheit!" },
    { genusName: "Weißdorn", species_name: "Zweigriffeliger Weißdorn", scientific_name: "Crataegus laevigata", rarity: "Häufig", description: "Weißdorn mit zwei Griffeln.", identification_features: "Weniger tief gelappte Blätter, zwei Griffel", fun_fact: "Blüht wunderschön im Mai!" },
    
    // Schlehe
    { genusName: "Schlehe", species_name: "Schwarzdorn", scientific_name: "Prunus spinosa", rarity: "Häufig", description: "Sehr dorniger Strauch mit blauen Früchten.", identification_features: "Sehr dornig, weiße Blüten vor den Blättern, blaue Früchte", fun_fact: "Die Früchte werden erst nach Frost genießbar!" },
    
    // Liguster
    { genusName: "Liguster", species_name: "Gewöhnlicher Liguster", scientific_name: "Ligustrum vulgare", rarity: "Häufig", description: "Halbimmergrüner Strauch für Hecken.", identification_features: "Gegenständige Blätter, weiße Blüten, schwarze Beeren", fun_fact: "Sehr beliebt als Heckenpflanze!" },
    
    // Flieder
    { genusName: "Flieder", species_name: "Gemeiner Flieder", scientific_name: "Syringa vulgaris", rarity: "Häufig", description: "Strauch mit duftenden Blütenrispen.", identification_features: "Herzförmige Blätter, duftende lila oder weiße Rispen", fun_fact: "Stammt ursprünglich vom Balkan!" },
    
    // Hartriegel
    { genusName: "Hartriegel", species_name: "Roter Hartriegel", scientific_name: "Cornus sanguinea", rarity: "Häufig", description: "Strauch mit roten Zweigen im Winter.", identification_features: "Rote Zweige, weiße Blüten, schwarze Beeren", fun_fact: "Die Zweige färben sich im Winter blutrot!" },
    { genusName: "Hartriegel", species_name: "Gelber Hartriegel", scientific_name: "Cornus mas", rarity: "Gelegentlich", description: "Strauch mit gelben Frühlingsblüten.", identification_features: "Gelbe Blüten im Februar-März, rote essbare Früchte", fun_fact: "Blüht als einer der ersten im Jahr!" },
    
    // Schneeball
    { genusName: "Schneeball", species_name: "Gewöhnlicher Schneeball", scientific_name: "Viburnum opulus", rarity: "Häufig", description: "Strauch mit kugelförmigen weißen Blüten.", identification_features: "Ahornähnliche Blätter, weiße Blütendolden, rote Beeren", fun_fact: "Die Beeren bleiben oft den ganzen Winter hängen!" },
    { genusName: "Schneeball", species_name: "Wolliger Schneeball", scientific_name: "Viburnum lantana", rarity: "Gelegentlich", description: "Schneeball mit filzigen Blättern.", identification_features: "Unterseits filzige Blätter, erst rote dann schwarze Beeren", fun_fact: "Wächst gerne auf Kalkböden!" },
    
    // Pfaffenhütchen
    { genusName: "Pfaffenhütchen", species_name: "Europäisches Pfaffenhütchen", scientific_name: "Euonymus europaeus", rarity: "Gelegentlich", description: "Strauch mit auffälligen rosa Früchten.", identification_features: "Vierkantige Zweige, rosa kapselartige Früchte mit orangen Samen", fun_fact: "Sehr giftig aber wunderschön!" },
    
    // Stechpalme
    { genusName: "Stechpalme", species_name: "Europäische Stechpalme", scientific_name: "Ilex aquifolium", rarity: "Gelegentlich", description: "Immergrüner Strauch mit stacheligen Blättern.", identification_features: "Glänzende stachelige Blätter, rote Beeren", fun_fact: "Traditionelle Weihnachtsdekoration!" },
    
    // Ginster
    { genusName: "Ginster", species_name: "Besenginster", scientific_name: "Cytisus scoparius", rarity: "Häufig", description: "Strauch mit gelben Schmetterlingsblüten.", identification_features: "Grüne Rutenzweige, gelbe Blüten", fun_fact: "Wurde früher zu Besen verarbeitet!" },
    { genusName: "Ginster", species_name: "Deutscher Ginster", scientific_name: "Genista germanica", rarity: "Selten", description: "Kleinerer Ginster mit Dornen.", identification_features: "Dornige Zweige, kleine gelbe Blüten", fun_fact: "Steht unter Naturschutz!" },
    
    // Sanddorn
    { genusName: "Sanddorn", species_name: "Sanddorn", scientific_name: "Hippophae rhamnoides", rarity: "Gelegentlich", description: "Dorniger Strauch mit orangenen vitaminreichen Beeren.", identification_features: "Silbrige schmale Blätter, orange Beeren", fun_fact: "Enthält mehr Vitamin C als Zitronen!" },
    
    // Berberitze
    { genusName: "Berberitze", species_name: "Gewöhnliche Berberitze", scientific_name: "Berberis vulgaris", rarity: "Gelegentlich", description: "Dorniger Strauch mit sauren roten Beeren.", identification_features: "Dreiteilige Dornen, gelbe Blütentrauben, rote Beeren", fun_fact: "Die Beeren sind sehr vitaminreich!" },
    
    // Heckenkirsche
    { genusName: "Heckenkirsche", species_name: "Rote Heckenkirsche", scientific_name: "Lonicera xylosteum", rarity: "Häufig", description: "Strauch mit paarweisen Blüten.", identification_features: "Gelblichweiße paarige Blüten, rote Beeren", fun_fact: "Die Beeren sind giftig!" },
    
    // Forsythie
    { genusName: "Forsythie", species_name: "Forsythie", scientific_name: "Forsythia × intermedia", rarity: "Häufig", description: "Zierstrauch mit gelben Frühjahrsblüten.", identification_features: "Gelbe Blüten vor den Blättern im März-April", fun_fact: "Ein Zeichen dass der Frühling kommt!" },
    
    // Deutzie
    { genusName: "Deutzie", species_name: "Raue Deutzie", scientific_name: "Deutzia scabra", rarity: "Gelegentlich", description: "Zierstrauch mit weißen Blüten.", identification_features: "Weiße oder rosa Blüten, raue Blätter", fun_fact: "Beliebt in Gärten!" },
    
    // Felsenmispel
    { genusName: "Felsenmispel", species_name: "Zwergmispel", scientific_name: "Cotoneaster", rarity: "Häufig", description: "Immergrüner Bodendecker mit roten Beeren.", identification_features: "Kleine glänzende Blätter, rote Beeren", fun_fact: "Sehr pflegeleicht!" },
    
    // Heidekraut
    { genusName: "Heidekraut", species_name: "Besenheide", scientific_name: "Calluna vulgaris", rarity: "Häufig", description: "Niedriger Strauch der Heidelandschaften prägt.", identification_features: "Nadelförmige Blättchen, rosa Blüten", fun_fact: "Lüneburger Heide ist nach ihr benannt!" },
    
    // Kreuzdorn
    { genusName: "Kreuzdorn", species_name: "Purgier-Kreuzdorn", scientific_name: "Rhamnus cathartica", rarity: "Gelegentlich", description: "Dorniger Strauch mit schwarzen Beeren.", identification_features: "Dornige Zweigenden, schwarze Beeren", fun_fact: "Wurde früher als Abführmittel verwendet!" },
    
    // BLUMEN & KRÄUTER
    // Löwenzahn
    { genusName: "Löwenzahn", species_name: "Gewöhnlicher Löwenzahn", scientific_name: "Taraxacum officinale", rarity: "Häufig", description: "Gelbe Wiesenblume mit Pusteblumen.", identification_features: "Gezähnte Blätter, gelbe Blüten, weiße Pusteblumen", fun_fact: "Aus Löwenzahn kann man Gelee machen!" },
    
    // Gänseblümchen
    { genusName: "Gänseblümchen", species_name: "Gänseblümchen", scientific_name: "Bellis perennis", rarity: "Häufig", description: "Kleine weiße Wiesenblume.", identification_features: "Weiße Zungenblüten, gelbe Mitte, rosettenförmige Blätter", fun_fact: "Gänseblümchen schließen nachts ihre Blüten!" },
    
    // Brennnessel
    { genusName: "Brennnessel", species_name: "Große Brennnessel", scientific_name: "Urtica dioica", rarity: "Häufig", description: "Kraut mit brennenden Haaren.", identification_features: "Brennhaare, gezähnte Blätter, hängende Blütenstände", fun_fact: "Brennnesseln sind super gesund und essbar!" },
    { genusName: "Brennnessel", species_name: "Kleine Brennnessel", scientific_name: "Urtica urens", rarity: "Häufig", description: "Kleinere einjährige Brennnessel.", identification_features: "Kleiner als Große Brennnessel, stärker brennend", fun_fact: "Brennt noch stärker als die Große!" },
    
    // Klee
    { genusName: "Klee", species_name: "Rotklee", scientific_name: "Trifolium pratense", rarity: "Häufig", description: "Futterpflanze mit rosa Blütenköpfen.", identification_features: "Dreigeteilte Blätter mit hellem Fleck, rosa Köpfe", fun_fact: "Wichtige Futterpflanze!" },
    { genusName: "Klee", species_name: "Weißklee", scientific_name: "Trifolium repens", rarity: "Häufig", description: "Kriechender Klee mit weißen Blüten.", identification_features: "Kriechend, weiße Blütenköpfe", fun_fact: "Vierblättrige Kleeblätter bringen Glück!" },
    
    // Wegerich
    { genusName: "Wegerich", species_name: "Spitzwegerich", scientific_name: "Plantago lanceolata", rarity: "Häufig", description: "Heilpflanze mit langen schmalen Blättern.", identification_features: "Lange schmale Blätter, Blütenähren", fun_fact: "Hilft bei Insektenstichen!" },
    { genusName: "Wegerich", species_name: "Breitwegerich", scientific_name: "Plantago major", rarity: "Häufig", description: "Robuste Pflanze auf Wegen.", identification_features: "Breite ovale Blätter in Rosette", fun_fact: "Überlebt sogar Tritte auf dem Weg!" },
    
    // Kamille
    { genusName: "Kamille", species_name: "Echte Kamille", scientific_name: "Matricaria chamomilla", rarity: "Häufig", description: "Heilpflanze mit weißen Blüten.", identification_features: "Weiße Zungenblüten, hohler Blütenboden, aromatischer Duft", fun_fact: "Kamillentee beruhigt den Magen!" },
    { genusName: "Kamille", species_name: "Hundskamille", scientific_name: "Anthemis arvensis", rarity: "Gelegentlich", description: "Ähnelt der Echten Kamille.", identification_features: "Gefüllter Blütenboden, weniger Duft", fun_fact: "Keine Heilwirkung wie Echte Kamille!" },
    
    // Schafgarbe
    { genusName: "Schafgarbe", species_name: "Gemeine Schafgarbe", scientific_name: "Achillea millefolium", rarity: "Häufig", description: "Heilpflanze mit weißen Dolden.", identification_features: "Fein gefiederte Blätter, weiße oder rosa Dolden", fun_fact: "Achilles soll damit seine Wunden behandelt haben!" },
    
    // Johanniskraut
    { genusName: "Johanniskraut", species_name: "Echtes Johanniskraut", scientific_name: "Hypericum perforatum", rarity: "Häufig", description: "Heilpflanze mit gelben Blüten.", identification_features: "Gelbe Blüten, durchscheinend punktierte Blätter", fun_fact: "Hilft bei leichten Depressionen!" },
    
    // Glockenblume
    { genusName: "Glockenblume", species_name: "Rundblättrige Glockenblume", scientific_name: "Campanula rotundifolia", rarity: "Häufig", description: "Zierliche blaue Wiesenblume.", identification_features: "Blaue glockenförmige Blüten, schmale Stängelblätter", fun_fact: "Die Grundblätter sind rund!" },
    { genusName: "Glockenblume", species_name: "Wiesen-Glockenblume", scientific_name: "Campanula patula", rarity: "Gelegentlich", description: "Größere Glockenblume der Wiesen.", identification_features: "Violettblaue offene Glocken", fun_fact: "Mag magere Wiesen!" },
    
    // Veilchen
    { genusName: "Veilchen", species_name: "März-Veilchen", scientific_name: "Viola odorata", rarity: "Häufig", description: "Duftendes Frühlingsveilchen.", identification_features: "Herzförmige Blätter, violette duftende Blüten", fun_fact: "Riecht wunderbar nach Frühling!" },
    { genusName: "Veilchen", species_name: "Acker-Stiefmütterchen", scientific_name: "Viola arvensis", rarity: "Häufig", description: "Kleines wildes Stiefmütterchen.", identification_features: "Kleine dreifarbige Blüten", fun_fact: "Wächst auf Äckern!" },
    
    // Storchschnabel
    { genusName: "Storchschnabel", species_name: "Wiesen-Storchschnabel", scientific_name: "Geranium pratense", rarity: "Häufig", description: "Wiesenpflanze mit blauen Blüten.", identification_features: "Blauviolette Blüten, tief geteilte Blätter", fun_fact: "Die Früchte sehen aus wie ein Storchenschnabel!" },
    
    // Hahnenfuß
    { genusName: "Hahnenfuß", species_name: "Scharfer Hahnenfuß", scientific_name: "Ranunculus acris", rarity: "Häufig", description: "Gelbe Butterblume der Wiesen.", identification_features: "Glänzend gelbe Blüten, geteilte Blätter", fun_fact: "Alle Hahnenfußarten sind giftig!" },
    { genusName: "Hahnenfuß", species_name: "Kriechender Hahnenfuß", scientific_name: "Ranunculus repens", rarity: "Häufig", description: "Hahnenfuß mit Ausläufern.", identification_features: "Kriechende Ausläufer, gelbe Blüten", fun_fact: "Verbreitet sich stark über Ausläufer!" },
    
    // Schaumkraut
    { genusName: "Schaumkraut", species_name: "Wiesen-Schaumkraut", scientific_name: "Cardamine pratensis", rarity: "Häufig", description: "Zarte rosa Frühjahrsblume.", identification_features: "Rosa Blüten, gefiederte Blätter", fun_fact: "Blüht im Frühling auf feuchten Wiesen!" },
    
    // Labkraut
    { genusName: "Labkraut", species_name: "Echtes Labkraut", scientific_name: "Galium verum", rarity: "Häufig", description: "Gelb blühendes Kraut.", identification_features: "Schmale Blätter in Quirlen, gelbe Blütenrispen", fun_fact: "Wurde früher zum Käsen verwendet!" },
    { genusName: "Labkraut", species_name: "Kletten-Labkraut", scientific_name: "Galium aparine", rarity: "Häufig", description: "Klebendes Labkraut.", identification_features: "Haftet an Kleidung, weiße Blüten", fun_fact: "Bleibt überall hängen!" },
    
    // Taubnessel
    { genusName: "Taubnessel", species_name: "Weiße Taubnessel", scientific_name: "Lamium album", rarity: "Häufig", description: "Brennnessel-ähnlich aber ohne Brennhaare.", identification_features: "Weiße Lippenblüten, brennt nicht", fun_fact: "Sieht aus wie Brennnessel, brennt aber nicht!" },
    { genusName: "Taubnessel", species_name: "Rote Taubnessel", scientific_name: "Lamium purpureum", rarity: "Häufig", description: "Kleine rötliche Taubnessel.", identification_features: "Rötliche Blätter und Blüten", fun_fact: "Wichtige Bienenweide im Frühjahr!" },
    
    // Hornklee
    { genusName: "Hornklee", species_name: "Gewöhnlicher Hornklee", scientific_name: "Lotus corniculatus", rarity: "Häufig", description: "Gelbe Schmetterlingsblüten.", identification_features: "Gelbe Blüten, hornförmige Früchte", fun_fact: "Die Hülsen sehen aus wie kleine Hörner!" },
    
    // Ampfer
    { genusName: "Ampfer", species_name: "Sauerampfer", scientific_name: "Rumex acetosa", rarity: "Häufig", description: "Essbares Wildkraut mit saurem Geschmack.", identification_features: "Pfeilförmige Blätter, rötliche Blütenstände", fun_fact: "Schmeckt sauer und ist essbar!" },
    { genusName: "Ampfer", species_name: "Stumpfblättriger Ampfer", scientific_name: "Rumex obtusifolius", rarity: "Häufig", description: "Großes Unkraut.", identification_features: "Große Blätter, lange Blütenstände", fun_fact: "Schwer aus dem Garten zu entfernen!" },
    
    // Mohn
    { genusName: "Mohn", species_name: "Klatschmohn", scientific_name: "Papaver rhoeas", rarity: "Häufig", description: "Leuchtend rote Ackerblume.", identification_features: "Große rote Blüten, behaarte Stängel", fun_fact: "Symbol für gefallene Soldaten!" },
    
    // Sonnenblume
    { genusName: "Sonnenblume", species_name: "Bastard-Sonnenblume", scientific_name: "Helianthus × laetiflorus", rarity: "Gelegentlich", description: "Mehrjährige Kreuzung aus verschiedenen Sonnenblumenarten.", identification_features: "Mehrjährig, 1-2 Meter hoch, gelbe Zungenblüten, raue Blätter", fun_fact: "Diese Sonnenblume ist eine Kreuzung und kommt wild in Europa vor!" },
    { genusName: "Sonnenblume", species_name: "Gewöhnliche Sonnenblume", scientific_name: "Helianthus annuus", rarity: "Gelegentlich", description: "Die einjährige Sonnenblume mit großen gelben Blütenköpfen.", identification_features: "Einjährig, bis 3 Meter hoch, sehr große Blütenköpfe", fun_fact: "Sonnenblumen drehen sich nach der Sonne!" },
    { genusName: "Sonnenblume", species_name: "Topinambur", scientific_name: "Helianthus tuberosus", rarity: "Selten", description: "Mehrjährige Sonnenblume mit essbaren Knollen.", identification_features: "Essbare Wurzelknollen, kleinere gelbe Blüten", fun_fact: "Die Knollen schmecken leicht nussig und sind gesund!" },
    
    // Distel
    { genusName: "Distel", species_name: "Acker-Kratzdistel", scientific_name: "Cirsium arvense", rarity: "Häufig", description: "Stachelige Pflanze mit lila Blüten.", identification_features: "Sehr stachelig, lila Blütenköpfe", fun_fact: "Schwer zu bekämpfendes Unkraut!" },
    { genusName: "Distel", species_name: "Kohl-Kratzdistel", scientific_name: "Cirsium oleraceum", rarity: "Gelegentlich", description: "Weniger stachelige Distel.", identification_features: "Gelbliche Blüten, weniger stachelig", fun_fact: "Mag feuchte Standorte!" },
    
    // Steinklee
    { genusName: "Steinklee", species_name: "Echter Steinklee", scientific_name: "Melilotus officinalis", rarity: "Häufig", description: "Gelb blühendes Kraut mit Cumarinduft.", identification_features: "Gelbe Blütentrauben, duftet nach Cumarin", fun_fact: "Riecht wie frisch gemähtes Heu!" },
    
    // Leimkraut
    { genusName: "Leimkraut", species_name: "Weißes Leimkraut", scientific_name: "Silene latifolia", rarity: "Häufig", description: "Weiße nachtduftende Blume.", identification_features: "Weiße Blüten, aufgeblasener Kelch", fun_fact: "Duftet nachts stärker!" },
    
    // Rainfarn
    { genusName: "Rainfarn", species_name: "Rainfarn", scientific_name: "Tanacetum vulgare", rarity: "Häufig", description: "Gelbe knopfartige Blüten.", identification_features: "Gefiederte Blätter, gelbe Knopfblüten", fun_fact: "Wurde früher gegen Ungeziefer verwendet!" },
    
    // Beifuß
    { genusName: "Beifuß", species_name: "Gewöhnlicher Beifuß", scientific_name: "Artemisia vulgaris", rarity: "Häufig", description: "Hochgewachsenes Gewürzkraut.", identification_features: "Graugrüne Blattunterseiten, unscheinbare Blüten", fun_fact: "Traditionelles Gewürz für Gänsebraten!" },
    
    // Baldrian
    { genusName: "Baldrian", species_name: "Echter Baldrian", scientific_name: "Valeriana officinalis", rarity: "Häufig", description: "Heilpflanze mit rosa Blüten.", identification_features: "Gefiederte Blätter, rosa Blütendolden", fun_fact: "Beruhigt und hilft beim Einschlafen!" },
    
    // Bärenklau
    { genusName: "Bärenklau", species_name: "Wiesen-Bärenklau", scientific_name: "Heracleum sphondylium", rarity: "Häufig", description: "Große Doldenblütler.", identification_features: "Große geteilte Blätter, weiße Dolden", fun_fact: "Nicht verwechseln mit giftigem Riesen-Bärenklau!" },
    
    // Odermennig
    { genusName: "Odermennig", species_name: "Kleiner Odermennig", scientific_name: "Agrimonia eupatoria", rarity: "Gelegentlich", description: "Gelb blühendes Rosengewächs.", identification_features: "Gelbe Ähren, gefiederte Blätter", fun_fact: "Alte Heilpflanze!" },
    
    // Knöterich
    { genusName: "Knöterich", species_name: "Vogelknöterich", scientific_name: "Polygonum aviculare", rarity: "Häufig", description: "Niederliegendes Unkraut.", identification_features: "Kriechend, kleine weiße Blüten", fun_fact: "Wächst auch auf festgetrampelten Wegen!" },
    
    // Ehrenpreis
    { genusName: "Ehrenpreis", species_name: "Gamander-Ehrenpreis", scientific_name: "Veronica chamaedrys", rarity: "Häufig", description: "Kleine blaue Frühjahrsblume.", identification_features: "Himmelblaue Blüten mit weißer Mitte", fun_fact: "Blüht schon früh im Jahr!" },
    
    // Günsel
    { genusName: "Günsel", species_name: "Kriechender Günsel", scientific_name: "Ajuga reptans", rarity: "Häufig", description: "Blauer Bodendecker.", identification_features: "Blaue Lippenblüten, kriechende Ausläufer", fun_fact: "Bildet dichte Teppiche!" },
    
    // Salbei
    { genusName: "Salbei", species_name: "Wiesen-Salbei", scientific_name: "Salvia pratensis", rarity: "Gelegentlich", description: "Blauviolette Wiesenblume.", identification_features: "Große blauviolette Lippenblüten", fun_fact: "Wichtige Nektarquelle für Bienen!" },
    
    // Fingerhut
    { genusName: "Fingerhut", species_name: "Roter Fingerhut", scientific_name: "Digitalis purpurea", rarity: "Gelegentlich", description: "Hohe Pflanze mit glockenförmigen Blüten.", identification_features: "Rosa-lila Glockenblüten an hohem Stängel", fun_fact: "Sehr giftig, aber wichtige Herzmedizin!" },
    
    // Natternkopf
    { genusName: "Natternkopf", species_name: "Gewöhnlicher Natternkopf", scientific_name: "Echium vulgare", rarity: "Häufig", description: "Blaue stachelige Pflanze.", identification_features: "Blaue Trichterblüten, borstige Behaarung", fun_fact: "Ändert Blütenfarbe von rosa zu blau!" },
    
    // Königskerze
    { genusName: "Königskerze", species_name: "Großblütige Königskerze", scientific_name: "Verbascum densiflorum", rarity: "Gelegentlich", description: "Hohe Pflanze mit gelbem Blütenstand.", identification_features: "Bis 2m hoch, gelbe Blütenkerze, filzige Blätter", fun_fact: "Wurde früher als Fackel verwendet!" },
    
    // Nelke
    { genusName: "Nelke", species_name: "Rote Lichtnelke", scientific_name: "Silene dioica", rarity: "Häufig", description: "Rosa Waldblume.", identification_features: "Rosa Blüten, behaart", fun_fact: "Mag halbschattige Standorte!" },
    
    // Weidenröschen
    { genusName: "Weidenröschen", species_name: "Schmalblättriges Weidenröschen", scientific_name: "Epilobium angustifolium", rarity: "Häufig", description: "Rosa Hochstaude.", identification_features: "Rosa Blütentrauben, schmale Blätter", fun_fact: "Besiedelt als erstes Kahlschläge!" },
  ];

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResults([]);
    setProgress(0);

    const successResults = [];
    const errorResults = [];
    const total = plantsToImport.length;

    for (let i = 0; i < plantsToImport.length; i++) {
      const plant = plantsToImport[i];
      
      try {
        const genusId = findGenusId(plant.genusName);
        
        if (!genusId) {
          errorResults.push(`${plant.species_name}: Gattung "${plant.genusName}" nicht gefunden`);
          continue;
        }

        const plantData = {
          genus_id: genusId,
          species_name: plant.species_name,
          scientific_name: plant.scientific_name,
          description: plant.description,
          identification_features: plant.identification_features,
          fun_fact: plant.fun_fact,
          rarity: plant.rarity || "Häufig", // Use provided rarity or default to "Häufig"
          discovered: false
        };

        await createPlantMutation.mutateAsync(plantData);
        successResults.push(`✓ ${plant.species_name} (${plant.rarity || 'Häufig'})`); // Use provided rarity or default
      } catch (err) {
        errorResults.push(`${plant.species_name}: ${err.message}`);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResults([...successResults, ...errorResults]);
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ['plants'] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-xl border-2 border-green-200">
          <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100 border-b-2">
            <CardTitle className="text-3xl font-bold text-stone-900 flex items-center gap-3">
              <Database className="w-8 h-8 text-green-600" />
              PlantDex Datenbank Importieren
            </CardTitle>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            <Alert className="border-2 border-blue-200 bg-blue-50">
              <AlertDescription className="text-base">
                <strong>Info:</strong> Dieses Tool importiert automatisch {plantsToImport.length} Pflanzenarten in die Datenbank.
                Die Gattungen werden automatisch zugeordnet und Raritäten vergeben.
              </AlertDescription>
            </Alert>

            <div className="bg-stone-100 rounded-lg p-4">
              <p className="text-sm font-semibold mb-2">Gefundene Gattungen: {genera.length}</p>
              <div className="flex flex-wrap gap-2">
                {genera.slice(0, 10).map(g => (
                  <span key={g.id} className="px-2 py-1 bg-white rounded text-xs">
                    {g.genus_name}
                  </span>
                ))}
                {genera.length > 10 && <span className="text-xs text-stone-600">...und {genera.length - 10} weitere</span>}
              </div>
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || genera.length === 0}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Importiere... {progress}%
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  {plantsToImport.length} Pflanzen importieren
                </>
              )}
            </Button>

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <p className="text-center text-sm font-semibold text-stone-700">{progress}% abgeschlossen</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="mt-6 max-h-96 overflow-y-auto bg-stone-50 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-3 sticky top-0 bg-stone-50">
                  Ergebnisse ({results.length})
                </h3>
                <div className="space-y-1">
                  {results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`text-sm p-2 rounded ${
                        result.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}
                    >
                      {result}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <Alert className="border-2 border-red-200 bg-red-50">
                <AlertDescription className="text-red-900">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
