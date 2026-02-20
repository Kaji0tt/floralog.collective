import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { completeMigration } from '@/api/migrationService';
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
  const [migrationSteps, setMigrationSteps] = useState([]); // Track migration progress
  const [currentStep, setCurrentStep] = useState(null);

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
      console.log('[SetPassword] Starting migration with email:', email);
      await completeMigration(email, password, (progress) => {
        // Update state with migration progress
        setCurrentStep(progress.step);
        setMigrationSteps(prev => [...prev, progress.step]);
        console.log(`[SetPassword] Migration progress: ${progress.completed}/${progress.total} - ${progress.step.name}`);
      });
      
      console.log('[SetPassword] Migration completed successfully! Navigating to login...');
      setSuccess(true);

      setTimeout(() => {
        navigate('/login?migrated=true');
      }, 3000);
    } catch (err) {
      console.error('[SetPassword] MIGRATION FAILED:', err);
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
                  <p className="font-medium">Migration erfolgreich!</p>
                  <p className="text-sm">Sie werden weitergeleitet...</p>
                </div>
              </div>
            )}

            {isLoading && migrationSteps.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Migration läuft...
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {migrationSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-blue-800 animate-in fade-in duration-300">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>{step.name}</span>
                    </div>
                  ))}
                  {currentStep && migrationSteps.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      <span>{currentStep.name}</span>
                    </div>
                  )}
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
