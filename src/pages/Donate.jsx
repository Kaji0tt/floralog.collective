
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Coffee, Leaf, Sparkles, TreeDeciduous } from "lucide-react";
import { motion } from "framer-motion";
import MobileBackButton from "../components/navigation/MobileBackButton";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Donate() {
  const donationOptions = [
    {
      amount: 2,
      icon: Coffee,
      title: "Kleiner Kaffee",
      description: "Unterstütze uns mit einem symbolischen Kaffee",
      color: "from-amber-500 to-amber-600"
    },
    {
      amount: 5,
      icon: Leaf,
      title: "Eine Pflanze",
      description: "Hilf uns, die App zu pflegen und zu erweitern",
      color: "from-green-500 to-green-600"
    },
    {
      amount: 10,
      icon: TreeDeciduous,
      title: "Ein Baum",
      description: "Ermögliche neue Features und mehr Pflanzen",
      color: "from-emerald-500 to-emerald-600"
    },
    {
      amount: 0,
      icon: Sparkles,
      title: "Eigener Betrag",
      description: "Wähle deinen individuellen Spendenbetrag",
      color: "from-purple-500 to-purple-600"
    }
  ];

  const handleDonation = (amount) => {
    if (amount > 0) {
      window.open(
        `https://www.paypal.com/paypalme/jaschakruse/${amount}EUR`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.paypal.com/paypalme/jaschakruse`,
        '_blank'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-4">
            Helfe beim Wachsen! 🌱
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            PlantDex ist AI gestütztes Bildungsprojekt. Begleite und Unterstütze die Idee beim Keimen.
            Du hilfst mit jeder Form des Feedbacks, durch jedes Teilen mit Freunden oder einfach durch das Benutzen der App.
            Mit einer kleinen Aufmerksamkeit unterstützt du nicht nur dabei, die Serverkosten zu bewältigen, sondern symbolisierst zusätzlich deine Wertschätzung der Idee.
          </p>
        </motion.div>

        {/* Donation Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {donationOptions.map((option, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
            >
              <Card className="border-2 border-stone-200 hover:border-green-400 hover:shadow-xl transition-all duration-300 h-full">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`w-16 h-16 bg-gradient-to-br ${option.color} rounded-xl flex items-center justify-center shadow-md`}>
                      <option.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-stone-900">{option.title}</CardTitle>
                      {option.amount > 0 && (
                        <p className="text-2xl font-bold text-green-700">{option.amount} EUR</p>
                      )}
                    </div>
                  </div>
                  <p className="text-stone-600">{option.description}</p>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleDonation(option.amount)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6"
                  >
                    <Heart className="w-5 h-5 mr-2" />
                    Jetzt spenden
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-stone-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-blue-600" />
                Wofür werden Spenden verwendet?
              </h3>
              <ul className="space-y-2 text-stone-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Erweiterung der Pflanzendatenbank mit mehr Arten</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Verbesserung der KI-gestützten Pflanzenerkennung</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Entwicklung neuer Features für Schulen und Lehrer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Server- und Wartungskosten</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Kostenfreier Zugang für alle Nutzer</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Thank You Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-8 text-center"
        >
          <Card className="border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
            <CardContent className="p-8">
              <Heart className="w-12 h-12 text-red-500 fill-red-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-stone-900 mb-2">
                Vielen Dank! 💚
              </h3>
              <p className="text-stone-600 max-w-xl mx-auto">
                Jede Spende hilft uns dabei, PlantDex für alle kostenlos und werbefrei zu halten. 
                Gemeinsam können wir Menschen für die Natur begeistern!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
