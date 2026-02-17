import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUp } from '@/api/authService';
import { checkLegacyUser, sendOtpToLegacyUser } from '@/api/migrationService';
import { Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMigrationOption, setShowMigrationOption] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (formData.password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setIsLoading(true);

    try {
      // Check if email exists in legacy baseUsers table
      const legacyUser = await checkLegacyUser(formData.email);
      
      if (legacyUser) {
        // Email exists in baseUsers - offer migration instead
        setShowMigrationOption(true);
        setError(null);
        setIsLoading(false);
        return;
      }

      // New user registration
      await signUp(formData.email, formData.password);

      // PublicProfile wird automatisch aus Supabase Auth Daten erstellt
      navigate('/login?registered=true');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registrierung fehlgeschlagen. Bitte versuchen Sie es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigrateAccount = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await sendOtpToLegacyUser(formData.email);
      navigate('/migration/login', { state: { email: formData.email, skipEmailInput: true } });
    } catch (err) {
      console.error('Migration error:', err);
      setError(err.message || 'Fehler beim Starten der Migration.');
      setIsLoading(false);
    }
  };

  if (showMigrationOption) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
          <div className="p-8">
            <h1 className="text-2xl font-bold text-center mb-2">Account Migration erforderlich</h1>
            <p className="text-center text-gray-600 text-sm mb-6">
              Diese E-Mail ist bereits in unserem System registriert
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>Email:</strong> {formData.email}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Diese Email existiert bereits in unserem System. Möchten Sie Ihren bisherigen Account migrieren?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleMigrateAccount}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wird vorbereitet...
                  </>
                ) : (
                  'Ja, Account migrieren'
                )}
              </button>

              <button
                onClick={() => {
                  setShowMigrationOption(false);
                  setFormData({ email: '', password: '', confirmPassword: '', username: '' });
                }}
                disabled={isLoading}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mit anderen Angaben erneut versuchen
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
          <h1 className="text-2xl font-bold text-center mb-2">Floralog Registrierung</h1>
          <p className="text-center text-gray-600 text-sm mb-6">Erstelle einen neuen Account</p>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                <User className="inline w-4 h-4 mr-2" />
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                placeholder="Mein Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                <Mail className="inline w-4 h-4 mr-2" />
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="deine@email.de"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                <Lock className="inline w-4 h-4 mr-2" />
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••••••"
                name="password"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                <Lock className="inline w-4 h-4 mr-2" />
                Password bestätigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••••••"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Wird registriert...
                </>
              ) : (
                'Registrieren'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4">
            Bereits ein Account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-green-600 hover:underline font-medium"
            >
              Hier anmelden
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
