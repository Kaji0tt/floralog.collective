import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getSession, updatePassword } from '@/api/authService';
import { supabase } from '@/api/supabaseClient';

const getPasswordStrength = (pwd) => {
  let strength = 0;
  if (pwd.length >= 8) strength++;
  if (pwd.length >= 12) strength++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
  if (/\d/.test(pwd)) strength++;
  if (/[^A-Za-z0-9]/.test(pwd)) strength++;
  return strength;
};

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isRecoverySessionReady, setIsRecoverySessionReady] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    let isMounted = true;
    let hasRecoverySession = false;
    let timeoutId = null;
    let subscriptionRef = null;

    const resolveRecoverySession = async () => {
      try {
        const session = await getSession();

        if (!isMounted) return;

        if (session?.user) {
          hasRecoverySession = true;
          setIsRecoverySessionReady(true);
          setIsCheckingSession(false);
          return;
        }

        // Wait briefly for Supabase to process hash tokens and create recovery session.
        const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (!isMounted) return;
          if (event === 'PASSWORD_RECOVERY' || !!nextSession?.user) {
            hasRecoverySession = true;
            setIsRecoverySessionReady(true);
            setIsCheckingSession(false);
          }
        });
        subscriptionRef = data?.subscription || null;

        timeoutId = setTimeout(() => {
          if (!isMounted) return;
          setIsCheckingSession(false);
          if (!hasRecoverySession) {
            setError('Der Reset-Link ist ungueltig oder abgelaufen. Bitte fordere einen neuen Link an.');
          }
          subscriptionRef?.unsubscribe();
        }, 1500);
      } catch (err) {
        if (!isMounted) return;
        console.error('Reset password session check failed:', err);
        setError('Der Reset-Link konnte nicht verifiziert werden. Bitte fordere einen neuen Link an.');
        setIsCheckingSession(false);
      }
    };

    resolveRecoverySession();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscriptionRef?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isRecoverySessionReady) {
      setError('Bitte nutze den Link aus der E-Mail, um dein Passwort zurueckzusetzen.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwoerter stimmen nicht ueberein.');
      return;
    }

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError('Passwort muss Klein-, Grossbuchstaben und Zahlen enthalten.');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);

      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (err) {
      console.error('Reset password update failed:', err);
      setError(err.message || 'Passwort konnte nicht gespeichert werden.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Neues Passwort setzen</h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            Vergib jetzt ein neues Passwort fuer deinen Floralog Account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Passwort erfolgreich aktualisiert.</p>
                  <p className="text-sm">Weiterleitung zum Login...</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                <Lock className="inline w-4 h-4 mr-2" />
                Neues Passwort
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isCheckingSession || success}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />

              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < passwordStrength ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {passwordStrength === 0 && 'Sehr schwach'}
                    {passwordStrength === 1 && 'Schwach'}
                    {passwordStrength === 2 && 'Mittel'}
                    {passwordStrength === 3 && 'Gut'}
                    {passwordStrength === 4 && 'Sehr gut'}
                    {passwordStrength === 5 && 'Ausgezeichnet'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                <Lock className="inline w-4 h-4 mr-2" />
                Passwort bestaetigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading || isCheckingSession || success}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>

            <p className="text-xs text-gray-500">
              Anforderungen: Mindestens 8 Zeichen, Klein-/Grossbuchstaben und Zahlen.
            </p>

            <button
              type="submit"
              disabled={isLoading || isCheckingSession || success}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading || isCheckingSession ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isCheckingSession ? 'Link wird geprueft...' : 'Wird gespeichert...'}
                </>
              ) : (
                'Neues Passwort speichern'
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              disabled={isLoading}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Zurueck zum Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
