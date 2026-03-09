import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sendOtpToLegacyUser } from '@/api/migrationService';
import { Mail, Loader2, CheckCircle } from 'lucide-react';

export default function MigrateLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = location.state?.email || '';
  const skipEmailInput = location.state?.skipEmailInput || false;

  const [email, setEmail] = useState(initialEmail);
  const [hasSentEmail, setHasSentEmail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let didCancel = false;

    const autoSendOtp = async () => {
      if (!skipEmailInput || !initialEmail) return;
      setError(null);
      setIsLoading(true);

      try {
        await sendOtpToLegacyUser(initialEmail);
        if (didCancel) return;
        setSuccess(true);
        setHasSentEmail(true);
        setTimeout(() => {
          if (!didCancel) setSuccess(false);
        }, 2000);
      } catch (err) {
        if (didCancel) return;
        console.error('Auto OTP request error:', err);
        setError(err.message || 'Fehler beim Senden der E-Mail.');
      } finally {
        if (!didCancel) setIsLoading(false);
      }
    };

    autoSendOtp();
    return () => { didCancel = true; };
  }, [skipEmailInput, initialEmail]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await sendOtpToLegacyUser(email);
      setSuccess(true);
      setHasSentEmail(true);
      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('OTP request error:', err);
      setError(err.message || 'Fehler beim Senden der E-Mail.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Floralog - Account Migration</h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            {hasSentEmail
              ? 'Wir haben dir eine E-Mail mit einem Bestätigungslink zur Migration geschickt. Bitte prüfe dein Postfach und klicke auf den Link, um fortzufahren.'
              : 'Gib deine bisherige E-Mail-Adresse ein, um die Migration zu starten.'}
          </p>
          <form onSubmit={handleRequestOtp} className="space-y-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                E-Mail mit Bestätigungslink erfolgreich versendet!
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                <Mail className="inline w-4 h-4 mr-2" />
                Ihre E-Mail-Adresse
              </label>
              <input
                id="email"
                type="email"
                placeholder="deine@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Dies muss die E-Mail sein, mit der Sie sich registriert haben.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  E-Mail wird versendet...
                </>
              ) : (
                'E-Mail senden'
              )}
            </button>

            <p className="text-center text-sm text-gray-600 pt-2">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-green-600 hover:underline font-medium"
              >
                Neu registrieren
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
