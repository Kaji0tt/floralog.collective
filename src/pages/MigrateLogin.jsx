import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sendOtpToLegacyUser, verifyOtpCode } from '@/api/migrationService';
import { Mail, Loader2, CheckCircle } from 'lucide-react';

export default function MigrateLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = location.state?.email || '';
  const skipEmailInput = location.state?.skipEmailInput || false;

  const [stage, setStage] = useState(skipEmailInput ? 'otp' : 'email');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await sendOtpToLegacyUser(email);
      setSuccess(true);
      setTimeout(() => {
        setStage('otp');
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('OTP request error:', err);
      setError(err.message || 'Fehler beim Senden von OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await verifyOtpCode(email, otp);
      setSuccess(true);
      setTimeout(() => {
        navigate('/migration/set-password', { state: { email } });
      }, 2000);
    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err.message || 'Ungültiger OTP-Code.');
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
            {stage === 'email'
              ? 'Melden Sie sich mit Ihrer bisherigen E-Mail an'
              : 'Geben Sie den OTP-Code ein'}
          </p>

          {stage === 'email' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  OTP erfolgreich versendet!
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
                  Dies muss die E-Mail sein, mit der Sie sich registriert haben
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
                    OTP wird versendet...
                  </>
                ) : (
                  'OTP anfordern'
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
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  OTP verifiziert!
                </div>
              )}

              <div>
                <label htmlFor="otp" className="block text-sm font-medium mb-2">
                  OTP-Code
                </label>
                <input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  maxLength={6}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-gray-500 mt-1">
                  6-stelliger Code per E-Mail an {email}
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wird verifiziert...
                  </>
                ) : (
                  'OTP verifizieren'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStage('email');
                  setOtp('');
                  setError(null);
                }}
                disabled={isLoading}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zurück
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
