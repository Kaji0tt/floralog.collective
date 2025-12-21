import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Coffee, Leaf as LeafIcon, Sparkles, TreeDeciduous } from "lucide-react";
import { motion } from "framer-motion";
import MobileBackButton from "../components/navigation/MobileBackButton";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

export default function Donate() {
  const [user, setUser] = useState(null);
  const [averageColor, setAverageColor] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (currentUser?.background_color) {
          setAverageColor(currentUser.background_color);
        } else if (currentUser?.background_image_url) {
          const color = await getAverageColor(currentUser.background_image_url);
          if (color) setAverageColor(color);
        }
      } catch (error) {
        console.log("User not authenticated");
      }
    };
    loadUser();
  }, []);

  const getAverageColor = (imageUrl) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const size = 50;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 16) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          resolve(`rgb(${r}, ${g}, ${b})`);
        } catch (error) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  };

  const getRgbaFromRgb = (rgbString, opacity) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
  };

  const getLighterColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.min(255, Math.floor(parseInt(match[1]) * 1.4));
    const g = Math.min(255, Math.floor(parseInt(match[2]) * 1.4));
    const b = Math.min(255, Math.floor(parseInt(match[3]) * 1.4));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getDarkerColor = (rgbString) => {
    if (!rgbString) return null;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbString;
    const r = Math.floor(parseInt(match[1]) * 0.6);
    const g = Math.floor(parseInt(match[2]) * 0.6);
    const b = Math.floor(parseInt(match[3]) * 0.6);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const isColorDark = (rgbString) => {
    if (!rgbString) return false;
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return false;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 100;
  };
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
      icon: LeafIcon,
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
    <>
      <style>{`
        :root {
          --profile-bg-color: ${averageColor || 'rgb(250, 250, 249)'};
          --profile-bg-color-light: ${averageColor ? getLighterColor(averageColor) : 'rgb(255, 255, 255)'};
          --profile-bg-color-mid: ${averageColor ? averageColor : 'rgb(236, 253, 245)'};
          --profile-bg-color-dark: ${averageColor ? getDarkerColor(averageColor) : 'rgb(220, 252, 231)'};
          --profile-border-color: ${averageColor ? getRgbaFromRgb(averageColor, 0.4) : 'rgb(134, 239, 172)'};
          --profile-text-color: ${averageColor && isColorDark(averageColor) ? 'rgb(255, 255, 255)' : 'rgb(28, 25, 23)'};
        }
      `}</style>
      <div 
        className="min-h-screen p-4 md:p-8"
        style={{
          background: averageColor 
            ? `linear-gradient(135deg, var(--profile-bg-color-light) 0%, var(--profile-bg-color-mid) 50%, var(--profile-bg-color-dark) 100%)`
            : 'linear-gradient(to bottom right, rgb(250, 250, 249), rgb(236, 253, 245))'
        }}
      >
        <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="mb-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--profile-text-color)' }}>
              Helfe beim Wachsen! 🌱
            </h1>
          </div>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--profile-text-color)', opacity: 0.8 }}>
Helfe PlantDex zu wachsen! Ob Feedback, Teilen oder Spenden – jede Unterstützung zählt. Mit einer kleinen Spende sicherst du den Betrieb und erhältst als Dank einen besonderen Hintergrund für dein Engagement.
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
          <Card className="border-0 bg-transparent shadow-none">
            <CardContent className="p-8">
              <Heart className="w-12 h-12 text-red-500 fill-red-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--profile-text-color)' }}>
                Vielen Dank! 💚
              </h3>
              <p className="max-w-xl mx-auto" style={{ color: 'var(--profile-text-color)', opacity: 0.8 }}>
                Jede Spende hilft uns dabei, PlantDex für alle kostenlos und werbefrei zu halten. 
                Gemeinsam können wir Menschen für die Natur begeistern!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      </div>
    </>
  );
}