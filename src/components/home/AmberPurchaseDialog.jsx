import { useEffect, useRef, useState } from "react";
import { Gem, Loader2 } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const AMBER_PACKAGES = [
  { id: "amber-30", price: 1.30, amber: 30, label: "30 Bernstein" },
  { id: "amber-100", price: 3.90, amber: 100, label: "100 Bernstein" },
  { id: "amber-240", price: 7.90, amber: 240, label: "240 Bernstein" },
];

let paypalSdkPromise;

function loadPayPalSdk(clientId) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;

  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.getElementById("paypal-sdk");
    if (script) {
      script.addEventListener("load", () => resolve(window.paypal), { once: true });
      script.addEventListener("error", () => reject(new Error("PayPal konnte nicht geladen werden.")), { once: true });
      return;
    }

    const sdkScript = document.createElement("script");
    sdkScript.id = "paypal-sdk";
    sdkScript.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=EUR&intent=capture`;
    sdkScript.async = true;
    sdkScript.onload = () => resolve(window.paypal);
    sdkScript.onerror = () => reject(new Error("PayPal konnte nicht geladen werden."));
    document.body.appendChild(sdkScript);
  });

  return paypalSdkPromise;
}

function getFunctionErrorMessage(error, fallback) {
  return error?.message || fallback;
}

export default function AmberPurchaseDialog({ open, onOpenChange, currentBalance = 0, isLightUi, onPurchased }) {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const paypalContainerRef = useRef(null);
  const onPurchasedRef = useRef(onPurchased);
  const paypalClientId = (import.meta.env.VITE_PAYPAL_CLIENT_ID || "").trim();

  useEffect(() => {
    onPurchasedRef.current = onPurchased;
  }, [onPurchased]);

  const reset = () => {
    setSelectedPackage(null);
    setIsLoading(false);
    setMessage(null);
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open || !selectedPackage || !paypalClientId || !paypalContainerRef.current) return undefined;

    let isCancelled = false;
    let buttons;
    const packageToBuy = selectedPackage;

    const renderButtons = async () => {
      setIsLoading(true);
      try {
        const paypal = await loadPayPalSdk(paypalClientId);
        if (isCancelled || !paypalContainerRef.current || !paypal?.Buttons) return;

        paypalContainerRef.current.replaceChildren();
        buttons = paypal.Buttons({
          createOrder: async () => {
            const { data, error } = await supabase.functions.invoke("createPayPalAmberOrder", {
              body: { price: packageToBuy.price },
            });
            if (error || !data?.orderID) {
              throw new Error(getFunctionErrorMessage(error, "Die PayPal-Bestellung konnte nicht erstellt werden."));
            }
            return data.orderID;
          },
          onApprove: async ({ orderID }) => {
            setIsLoading(true);
            try {
              const { data, error } = await supabase.functions.invoke("capturePayPalAmberPayment", {
                body: { orderID, amber: packageToBuy.amber },
              });
              if (error || !data?.success) {
                throw new Error(getFunctionErrorMessage(error, "Die Zahlung konnte nicht abgeschlossen werden."));
              }
              await onPurchasedRef.current?.();
              setMessage(`${data.amber} Bernstein wurden deinem Konto gutgeschrieben.`);
              setSelectedPackage(null);
            } catch (error) {
              setMessage(error.message || "Die Zahlung konnte nicht abgeschlossen werden.");
            } finally {
              setIsLoading(false);
            }
          },
          onCancel: () => {
            setMessage("Kauf abgebrochen.");
            setSelectedPackage(null);
          },
          onError: (error) => {
            setMessage(error?.message || "PayPal konnte den Kauf nicht verarbeiten.");
            setIsLoading(false);
          },
        });
        await buttons.render(paypalContainerRef.current);
      } catch (error) {
        if (!isCancelled) setMessage(error.message || "PayPal konnte nicht geladen werden.");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    renderButtons();
    return () => {
      isCancelled = true;
      buttons?.close?.().catch?.(() => {});
    };
  }, [open, paypalClientId, selectedPackage]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`max-w-[min(92vw,28rem)] rounded-2xl border p-5 ${isLightUi ? "border-[#c8ac62]/45 bg-[#fffdf7]" : "border-[#f0e5a5]/35 bg-[#141714]"}`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isLightUi ? "text-stone-900" : "text-stone-100"}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isLightUi ? "bg-[#f4e7bf] text-[#8f6b22]" : "bg-[#4f4826] text-[#f0e5a5]"}`}>
              <Gem className="h-4 w-4" />
            </span>
            Bernstein kaufen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${isLightUi ? "border-[#c8ac62]/35 bg-white/80 text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
            <span>Dein Guthaben</span>
            <span className="font-semibold">{currentBalance} Bernstein</span>
          </div>

          {message && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${isLightUi ? "border-[#c8ac62]/35 bg-[#fff9e8] text-stone-700" : "border-[#f0e5a5]/25 bg-black/25 text-stone-200"}`}>
              {message}
            </div>
          )}

          {selectedPackage ? (
            <div className="space-y-3">
              <div className={`rounded-lg border px-4 py-3 ${isLightUi ? "border-[#c8ac62]/45 bg-white" : "border-[#f0e5a5]/30 bg-black/25"}`}>
                <div className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>{selectedPackage.label}</div>
                <div className={`mt-1 text-lg font-bold ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>{selectedPackage.price.toFixed(2).replace(".", ",")} €</div>
              </div>
              {isLoading && <div className="flex justify-center"><Loader2 className={`h-5 w-5 animate-spin ${isLightUi ? "text-stone-600" : "text-stone-300"}`} /></div>}
              <div ref={paypalContainerRef} className={isLoading ? "pointer-events-none opacity-50" : ""} />
              <button type="button" onClick={reset} disabled={isLoading} className={`h-9 w-full rounded-lg border text-xs font-semibold disabled:opacity-50 ${isLightUi ? "border-[#c8ac62]/45 bg-white text-stone-700 hover:bg-[#fff9e8]" : "border-[#f0e5a5]/30 bg-black/25 text-stone-100 hover:bg-black/40"}`}>Zurück</button>
            </div>
          ) : (
            <div className="space-y-2">
              {AMBER_PACKAGES.map((pkg) => (
                <button key={pkg.id} type="button" disabled={!paypalClientId} onClick={() => { setMessage(null); setSelectedPackage(pkg); }} className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${isLightUi ? "border-[#c8ac62]/35 bg-white/80 hover:border-[#c8ac62]/70 hover:bg-white" : "border-[#f0e5a5]/25 bg-black/25 hover:border-[#f0e5a5]/50 hover:bg-black/40"}`}>
                  <span className={`text-sm font-semibold ${isLightUi ? "text-stone-800" : "text-stone-100"}`}>{pkg.label}</span>
                  <span className={`text-sm font-bold ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"}`}>{pkg.price.toFixed(2).replace(".", ",")} €</span>
                </button>
              ))}
              {!paypalClientId && <p className={`text-xs ${isLightUi ? "text-stone-600" : "text-stone-300"}`}>PayPal ist noch nicht konfiguriert.</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}