import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signIn } from '@/api/authService';
import { checkLegacyUser } from '@/api/migrationService';
import { Mail, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);

  const wasMigrated = searchParams.get('migrated') === 'true';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      
      // Check if user exists in baseUser but not migrated yet
      if (err.message && err.message.includes('Invalid login credentials')) {
        try {
          const legacyUser = await checkLegacyUser(email);
          if (legacyUser && !legacyUser.auth_id) {
            // User exists in baseUser but hasn't migrated yet
            setShowMigrationPrompt(true);
            setIsLoading(false);
            return;
          }
        } catch (checkErr) {
          console.error('Check legacy user error:', checkErr);
        }
      }
      
      setError(err.message || 'Login fehlgeschlagen. Bitte versuchen Sie es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showMigrationPrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
          <div className="p-8">
            <h1 className="text-2xl font-bold text-center mb-2">Account Migration erforderlich</h1>
            <p className="text-center text-gray-600 text-sm mb-6">
              Dieser Account muss erst migriert werden
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>Email:</strong> {email}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Bitte migrieren Sie Ihren Account, um fortzufahren
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/migrate', { state: { email, skipEmailInput: !!email } })}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
              >
                Zur Migration
              </button>

              <button
                onClick={() => {
                  setShowMigrationPrompt(false);
                  setEmail('');
                  setPassword('');
                }}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg"
              >
                Zurück
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Floralog Login</h1>
          <p className="text-center text-gray-600 text-sm mb-6">Melde dich mit deinem Account an</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {wasMigrated && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Account erfolgreich migriert!</p>
                  <p className="text-sm">Du kannst dich jetzt anmelden</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                <Mail className="inline w-4 h-4 mr-2" />
                Email
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
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password', { state: { email } })}
                  className="text-sm text-green-600 hover:underline"
                >
                  Passwort vergessen?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Wird angemeldet...
                </>
              ) : (
                'Anmelden'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4 pb-2">
            Noch kein Account?{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-green-600 hover:underline font-medium"
            >
              Hier registrieren
            </button>
          </p>
          <div className="text-center text-sm text-gray-600">
            Schon einen Alt-Account?{' '}
            <button
              onClick={() => navigate('/migrate', { state: { email, skipEmailInput: !!email } })}
              className="text-green-600 hover:underline font-medium"
            >
              Jetzt migrieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
