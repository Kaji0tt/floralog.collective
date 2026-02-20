import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { Lock, Loader2, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function SetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateProfile } = useAuth();
  const email = location.state?.email;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    if (!email) {
      navigate('/migration/login');
    }
  }, [email, navigate]);

  const calculatePasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/@$!%*?&/.test(pwd)) strength++;
    return strength;
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    setPasswordStrength(calculatePasswordStrength(pwd));
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError('Passwort muss Klein-, Großbuchstaben und Zahlen enthalten');
      return;
    }

    setIsLoading(true);

    try {
      console.log('[SetPassword] Setting password for email:', email);
      
      // Get the verified auth user (already created by signInWithOtp + verifyOtp)
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        console.error('[SetPassword] Auth user not found:', authError);
        throw new Error('Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      }

      console.log('[SetPassword] Auth user ID:', authData.user.id);

      // Update password for this user
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error('[SetPassword] Password update failed:', updateError);
        throw updateError;
      }
      console.log('[SetPassword] Password updated successfully');

      // Sign in with the new password to establish session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        console.error('[SetPassword] Sign-in after password update failed:', signInError);
        throw signInError;
      }

      console.log('[SetPassword] Sign-in successful. Setting migration flag and navigating to dashboard...');
      
      // Set flag so Home page knows to trigger migration
      // Edge Function will handle all database updates including PublicProfile creation
      localStorage.setItem('migration_pending', 'true');
      
      setSuccess(true);

      setTimeout(() => {
        // Navigate to dashboard where migration will automatically start
        navigate('/', { replace: true });
      }, 1000);
    } catch (err) {
      console.error('[SetPassword] FAILED:', err);
      console.error('[SetPassword] Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      setError(err.message || 'Fehler beim Speichern des Passworts.');
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
            Erstellen Sie ein sicheres Passwort für Ihren Floralog Account
          </p>

          <form onSubmit={handleSetPassword} className="space-y-4">
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
                  <p className="font-medium">Passwort gesetzt!</p>
                  <p className="text-sm">Sie werden weitergeleitet...</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-600 mb-2">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                <Lock className="inline w-4 h-4 mr-2" />
                Passwort
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={handlePasswordChange}
                disabled={isLoading}
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

              <p className="text-xs text-gray-500 mt-2">
                Anforderungen: Mindestens 8 Zeichen, Klein-/Großbuchstaben, Zahlen
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                <Lock className="inline w-4 h-4 mr-2" />
                Passwort bestätigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword || success}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                'Passwort speichern & migrieren'
              )}
            </button>

            {!success && (
              <button
                type="button"
                onClick={() => navigate('/migration/login')}
                disabled={isLoading}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zurück
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
