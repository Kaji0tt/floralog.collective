import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '@/api/authService';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

const SAVED_LOGIN_KEY = 'savedLoginCredentials';

const readSavedCredentials = () => {
  try {
    const raw = localStorage.getItem(SAVED_LOGIN_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.password) return null;

    return {
      email: String(parsed.email),
      password: String(parsed.password)
    };
  } catch {
    return null;
  }
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const saved = readSavedCredentials();
    if (!saved) return;

    setEmail(saved.email);
    setPassword(saved.password);
    setRememberLogin(true);
  }, []);

  const persistCredentialsChoice = () => {
    if (!rememberLogin) {
      localStorage.removeItem(SAVED_LOGIN_KEY);
      return;
    }

    localStorage.setItem(
      SAVED_LOGIN_KEY,
      JSON.stringify({
        email,
        password,
        updatedAt: new Date().toISOString()
      })
    );
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      persistCredentialsChoice();
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login fehlgeschlagen. Bitte versuchen Sie es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Floralog Login</h1>
          <p className="text-center text-gray-600 text-sm mb-6">Melde dich mit deinem Account an</p>

          <form onSubmit={handleLogin} className="space-y-4">
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
                autoComplete="username"
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
                autoComplete="current-password"
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

            <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => setRememberLogin(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Login-Daten speichern
            </label>

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
          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors"
            >
              Als Gast stöbern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
