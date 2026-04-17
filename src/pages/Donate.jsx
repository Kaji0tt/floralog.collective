import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { getCurrentUser } from "@/api/userApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Coffee, Leaf as LeafIcon, TreeDeciduous, Sparkles, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { useToast } from "@/components/ui/use-toast";

export default function Donate() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const paypalButtonsRendered = useRef(false);
  const { toast } = useToast();

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
      description: "Hilft bei laufenden API-Kosten",
      color: "from-amber-500 to-amber-600"
    },
    {
      amount: 5,
      icon: LeafIcon,
      title: "Eine Pflanze",
      description: "Sichert Betrieb und Weiterentwicklung",
      color: "from-green-500 to-green-600"
    },
    {
      amount: 10,
      icon: TreeDeciduous,
      title: "Ein Baum",
      description: "Ermöglicht neue Features",
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
                amount: amount || 5 
              });
              console.log('🟢 Full response object:', response);
              console.log('🟢 Response status:', response.status);
              console.log('🟢 Response data:', response.data);
              
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
                orderID: data.orderID 
              });
              console.log('🟢 capturePayPalPayment response:', response);
              
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

  return (
    <div className="min-h-screen bg-background text-foreground p-3 sm:p-4 md:p-6">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.14),transparent_46%)]" />
        <MobileBackButton />
      
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-4"
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Helfe beim Wachsen</h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            Kurz und direkt: Mit deiner Spende decken wir Server- und API-Kosten.
          </p>
        </motion.div>

        {/* Donor Status Anzeige */}
        {user?.donor_status && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Card className="border border-amber-500/35 bg-amber-500/10 dark:bg-amber-500/15">
              <CardContent className="p-3 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-amber-500" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Donor-Status aktiv</p>
                  <p className="text-sm text-amber-800/90 dark:text-amber-100/80">Danke für deine Unterstützung.</p>
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
            className="mb-4"
          >
            <Card className="border border-primary/30 bg-card/90 backdrop-blur-sm shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-center text-lg">
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
                  className="w-full mt-4"
                >
                  Abbrechen
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Donation Options */}
        {selectedAmount === null && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {donationOptions.map((option, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.45 }}
              >
                <Card className="h-full border border-border/80 bg-card/90 backdrop-blur-sm hover:border-primary/45 hover:shadow-md transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-11 h-11 bg-gradient-to-br ${option.color} rounded-lg flex items-center justify-center shadow-sm`}>
                        <option.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{option.title}</CardTitle>
                        {option.amount > 0 && (
                          <p className="text-xl font-bold text-primary">{option.amount} EUR</p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      onClick={() => handleDonation(option.amount)}
                      className="w-full font-medium"
                    >
                      <Heart className="w-5 h-5 mr-2" />
                      Jetzt spenden
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Compact Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
        >
          <Card className="border border-border/80 bg-card/80">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Du kannst auch ohne Spende helfen: Feedback, Ideen und Bug-Reports machen Floralog besser.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}