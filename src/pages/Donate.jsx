import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { getCurrentUser } from "@/api/userApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiTheme } from "@/lib/UiThemeContext";
import { Heart, Coffee, Leaf as LeafIcon, TreeDeciduous, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { useToast } from "@/components/ui/use-toast";

export default function Donate() {
  const location = useLocation();
  const { isLightUi, pushThemeOverride, popThemeOverride } = useUiTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState("5");
  const paypalButtonsRendered = useRef(false);
  const { toast } = useToast();
  const query = new URLSearchParams(location.search);
  const isFromGuestFunnel = query.get("from") === "guest-funnel";

  useEffect(() => {
    if (!isFromGuestFunnel) return;
    pushThemeOverride("dark");
    return () => {
      popThemeOverride();
    };
  }, [isFromGuestFunnel, pushThemeOverride, popThemeOverride]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.log("User not authenticated");
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    // PayPal SDK laden
    if (!document.getElementById('paypal-sdk')) {
      const script = document.createElement('script');
      script.id = 'paypal-sdk';
      script.src = `https://www.paypal.com/sdk/js?client-id=ASv5xp3towIV_O7GNG5l9RE3iHqDT6mo6c-VKJO7aSQhtKvZVtN672jzTjzqOeOFKw-gIFWTbAsZhhy4&currency=EUR`;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const donationOptions = [
    {
      amount: 2,
      icon: Coffee,
      title: "Kleiner Kaffee",
      description: "Hilft bei laufenden API-Kosten und Hosting",
      color: "from-amber-500 to-amber-600"
    },
    {
      amount: 5,
      icon: LeafIcon,
      title: "Eine Pflanze",
      description: "Trägt den laufenden Betrieb und neue Ideen",
      color: "from-green-500 to-green-600"
    },
    {
      amount: 10,
      icon: TreeDeciduous,
      title: "Ein Baum",
      description: "Schafft Luft für neue Features und Ausbau",
      color: "from-emerald-500 to-emerald-600"
    }
  ];

  const handleDonation = (amount) => {
    console.log('🔵 handleDonation called with amount:', amount);
    setSelectedAmount(amount);
    
    // PayPal Buttons rendern
    setTimeout(() => {
      const container = document.getElementById('paypal-button-container');
      console.log('🔵 Container found:', !!container);
      console.log('🔵 PayPal SDK loaded:', !!window.paypal);
      console.log('🔵 Buttons already rendered:', paypalButtonsRendered.current);
      
      if (container && window.paypal && !paypalButtonsRendered.current) {
        container.innerHTML = '';
        
        window.paypal.Buttons({
          createOrder: async () => {
            console.log('🟢 createOrder started');
            setLoading(true);
            try {
              console.log('🟢 Calling createPayPalOrder with amount:', amount || 5);
              const response = await supabase.functions.invoke('createPayPalOrder', {
                body: { amount: amount || 5 }
              });
              console.log('🟢 Full response object:', response);
              console.log('🟢 Response status:', response.status);
              console.log('🟢 Response data:', response.data);

              if (response.error) {
                let detailedMessage = response.error.message || 'PayPal-Bestellung fehlgeschlagen.';
                try {
                  const errorPayload = await response.error.context?.json?.();
                  const backendError = errorPayload?.error;
                  const detailsError = errorPayload?.details?.error;
                  const detailsDescription = errorPayload?.details?.error_description;
                  const parts = [backendError, detailsError, detailsDescription].filter(Boolean);
                  if (parts.length > 0) {
                    detailedMessage = parts.join(': ');
                  }
                } catch (_parseError) {
                  // Ignore response parse errors and keep fallback message.
                }
                throw new Error(detailedMessage);
              }
              
              if (!response.data || !response.data.orderID) {
                console.error('❌ No orderID in response');
                toast({
                  title: "Fehler",
                  description: `Keine OrderID erhalten: ${JSON.stringify(response.data)}`,
                  variant: "destructive"
                });
                setLoading(false);
                throw new Error('No orderID received');
              }
              
              console.log('🟢 OrderID:', response.data.orderID);
              return response.data.orderID;
            } catch (error) {
              console.error('❌ createOrder error:', error);
              console.error('❌ Error message:', error.message);
              console.error('❌ Error response:', error.response);
              toast({
                title: "Fehler",
                description: `PayPal-Bestellung fehlgeschlagen: ${error.message}`,
                variant: "destructive"
              });
              setLoading(false);
              throw error;
            }
          },
          onApprove: async (data) => {
            console.log('🟢 onApprove called with data:', data);
            try {
              console.log('🟢 Calling capturePayPalPayment with orderID:', data.orderID);
              const response = await supabase.functions.invoke('capturePayPalPayment', {
                body: { orderID: data.orderID }
              });
              console.log('🟢 capturePayPalPayment response:', response);

              if (response.error) {
                let detailedMessage = response.error.message || 'Zahlung fehlgeschlagen.';
                try {
                  const errorPayload = await response.error.context?.json?.();
                  const backendError = errorPayload?.error;
                  const detailsError = errorPayload?.details?.error;
                  const detailsDescription = errorPayload?.details?.error_description;
                  const parts = [backendError, detailsError, detailsDescription].filter(Boolean);
                  if (parts.length > 0) {
                    detailedMessage = parts.join(': ');
                  }
                } catch (_parseError) {
                  // Ignore response parse errors and keep fallback message.
                }
                throw new Error(detailedMessage);
              }
              
              if (response.data.success) {
                console.log('✅ Payment successful!');
                toast({
                  title: "Spende erfolgreich! 🎉",
                  description: response.data.message,
                  duration: 5000
                });
                
                // User neu laden
                const updatedUser = await getCurrentUser();
                console.log('✅ Updated user:', updatedUser);
                setUser(updatedUser);
                
                // Prüfe und schalte Donor-Rewards frei
                const { checkAndUnlockRewards } = await import("../components/rewards/rewardUnlocker");
                await checkAndUnlockRewards(updatedUser);
                
                setSelectedAmount(null);
                paypalButtonsRendered.current = false;
              }
            } catch (error) {
              console.error('❌ onApprove error:', error);
              console.error('❌ Error details:', JSON.stringify(error, null, 2));
              toast({
                title: "Fehler",
                description: `Zahlung fehlgeschlagen: ${error.message}`,
                variant: "destructive"
              });
            } finally {
              setLoading(false);
            }
          },
          onCancel: () => {
            console.log('⚠️ Payment cancelled');
            setLoading(false);
            setSelectedAmount(null);
            paypalButtonsRendered.current = false;
            toast({
              title: "Abgebrochen",
              description: "Spende wurde abgebrochen."
            });
          },
          onError: (err) => {
            console.error('❌ PayPal SDK Error:', err);
            console.error('❌ Error type:', typeof err);
            console.error('❌ Error string:', String(err));
            setLoading(false);
            setSelectedAmount(null);
            paypalButtonsRendered.current = false;
            toast({
              title: "Fehler",
              description: `PayPal Fehler: ${String(err)}`,
              variant: "destructive"
            });
          }
        }).render('#paypal-button-container');
        
        paypalButtonsRendered.current = true;
      }
    }, 100);
  };

  const handleCustomDonation = () => {
    const normalized = Number(String(customAmount).replace(",", "."));
    if (!Number.isFinite(normalized) || normalized <= 0) {
      toast({
        title: "Betrag fehlt",
        description: "Bitte gib einen gültigen Betrag größer als 0 ein.",
        variant: "destructive"
      });
      return;
    }

    const rounded = Number(normalized.toFixed(2));
    handleDonation(rounded);
  };

  return (
    <div
      className={`min-h-screen p-3 sm:p-4 md:p-6 ${isLightUi ? "bg-[#f4f6f8] text-stone-800" : "bg-[#11151a] text-stone-100"}`}
      style={{
        backgroundImage: isLightUi
          ? "radial-gradient(circle at 18% 0%, rgba(153, 211, 193, 0.18), transparent 42%), radial-gradient(circle at 82% 90%, rgba(176, 196, 222, 0.2), transparent 42%)"
          : "radial-gradient(circle at 20% 0%, rgba(129, 184, 161, 0.2), transparent 40%), radial-gradient(circle at 82% 90%, rgba(99, 139, 176, 0.22), transparent 42%)"
      }}
    >
      <MobileBackButton />

      <div className="mx-auto max-w-4xl">
        <div
          className={`relative overflow-hidden rounded-[2rem] border ${isLightUi ? "border-white/70 bg-white/75 shadow-[0_20px_64px_rgba(0,0,0,0.14)]" : "border-[#d7cf9c]/45 bg-[linear-gradient(180deg,rgba(24,30,37,0.95)_0%,rgba(15,20,26,0.96)_100%)] shadow-[0_20px_80px_rgba(0,0,0,0.58)]"}`}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: isLightUi
                ? "linear-gradient(145deg,rgba(240,244,249,0.78)_0%,rgba(255,255,255,0.24)_45%,rgba(207,224,216,0.24)_100%)"
                : "linear-gradient(145deg,rgba(58,67,78,0.32)_0%,rgba(24,30,37,0.14)_45%,rgba(52,80,70,0.18)_100%)"
            }}
          />
          <div className={`pointer-events-none absolute inset-0 rounded-[2rem] border ${isLightUi ? "border-white/70" : "border-[#f0e5a5]/22"}`} />

          <div className="relative z-10 px-4 sm:px-5 md:px-8 py-4 md:py-6 space-y-4 md:space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h1 className={`text-3xl md:text-4xl font-bold tracking-tight ${isLightUi ? "text-stone-900" : "text-amber-50"}`}>
            Danke, dass du Floralog mittragst
          </h1>
          <p className={`mt-2 text-sm md:text-base max-w-2xl mx-auto ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>
            Jede Unterstützung hilft uns, Floralog kostenlos und werbefrei zu halten. Deine Spende deckt Server,
            API-Kosten und macht neue Funktionen möglich.
          </p>
        </motion.div>

        {/* Donor Status Anzeige */}
        {user?.donor_status && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={`border ${isLightUi ? "border-amber-300/65 bg-amber-50/85" : "border-amber-500/35 bg-amber-500/10"}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-amber-500" />
                <div>
                  <p className={`font-semibold ${isLightUi ? "text-amber-900" : "text-amber-200"}`}>Donor-Status aktiv</p>
                  <p className={`text-sm ${isLightUi ? "text-amber-800/90" : "text-amber-100/80"}`}>Danke für deine Unterstützung.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* PayPal Button Container */}
        {selectedAmount !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className={`border backdrop-blur-sm shadow-lg ${isLightUi ? "border-emerald-200/80 bg-white/90" : "border-emerald-500/30 bg-stone-900/70"}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-center text-lg ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
                  {selectedAmount > 0 ? `${selectedAmount} EUR spenden` : 'Eigenen Betrag spenden'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                  </div>
                )}
                <div id="paypal-button-container" className={loading ? 'opacity-50 pointer-events-none' : ''}></div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedAmount(null);
                    paypalButtonsRendered.current = false;
                  }}
                  className={`w-full mt-4 ${isLightUi ? "border-stone-300" : "border-stone-600 text-stone-100 hover:bg-stone-800"}`}
                >
                  Abbrechen
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Donation Presets */}
        {selectedAmount === null && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
          >
            <p className={`mb-2 text-xs uppercase tracking-[0.18em] ${isLightUi ? "text-stone-500" : "text-stone-400"}`}>
              Wähle einen Beitrag
            </p>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
              {donationOptions.map((option, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.45 }}
                  className="min-w-[248px] sm:min-w-[280px] max-w-[290px] snap-start"
                >
                  <Card
                    className={`h-full border transition-all duration-300 ${isLightUi
                      ? "border-stone-200/90 bg-white/90 hover:border-emerald-400/70 hover:shadow-[0_12px_28px_rgba(15,23,42,0.16)]"
                      : "border-[#f0e5a5]/22 bg-stone-900/55 hover:border-emerald-300/55 hover:shadow-[0_14px_28px_rgba(0,0,0,0.45)]"
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-11 h-11 bg-gradient-to-br ${option.color} rounded-lg flex items-center justify-center shadow-sm`}>
                          <option.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className={`text-base ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>{option.title}</CardTitle>
                          <p className={`text-xl font-bold ${isLightUi ? "text-emerald-700" : "text-emerald-300"}`}>{option.amount} EUR</p>
                        </div>
                      </div>
                      <p className={`text-sm ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>{option.description}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        onClick={() => handleDonation(option.amount)}
                        className={`w-full font-medium ${isLightUi ? "" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
                      >
                        <Heart className="w-5 h-5 mr-2" />
                        Jetzt spenden
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {selectedAmount === null && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.4 }}
          >
            <Card className={`border ${isLightUi ? "border-stone-200/85 bg-white/85" : "border-[#f0e5a5]/20 bg-stone-900/45"}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-base ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
                  Oder spende einen eigenen Betrag
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:flex-1">
                  <Input
                    type="number"
                    min="1"
                    step="0.50"
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    className={`h-11 pr-14 ${isLightUi ? "bg-white" : "bg-stone-950/55 border-stone-700 text-stone-100"}`}
                    placeholder="z.B. 7"
                  />
                  <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm ${isLightUi ? "text-stone-500" : "text-stone-300"}`}>
                    EUR
                  </span>
                </div>
                <Button
                  onClick={handleCustomDonation}
                  className={`h-11 px-5 sm:w-auto ${isLightUi ? "" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
                >
                  Jetzt spenden
                </Button>
              </CardContent>
            </Card>
          </motion.section>
        )}

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          className={`text-center text-sm md:text-base ${isLightUi ? "text-stone-600" : "text-stone-300"}`}
        >
          Vielen Dank, dass du uns unterstützt. Wir wissen das wirklich sehr zu schätzen.
        </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}