import React, { useMemo, useState } from 'react';
import { Lock, Loader2, CheckCircle, AlertCircle, Leaf } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { updatePassword } from '@/api/authService';

const getPasswordStrength = (pwd) => {
  let strength = 0;
  if (pwd.length >= 8) strength++;
  if (pwd.length >= 12) strength++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
  if (/\d/.test(pwd)) strength++;
  if (/[^A-Za-z0-9]/.test(pwd)) strength++;
  return strength;
};

/**
 * Modal shown when the user arrives via a password-reset email link.
 * The PASSWORD_RECOVERY session is already established by AuthContext.
 */
export default function ResetPasswordModal({ open, onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError('Passwort muss Klein-, Großbuchstaben und Zahlen enthalten.');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err) {
      console.error('Reset password update failed:', err);
      setError(err.message || 'Passwort konnte nicht gespeichert werden.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {/* intentionally non-dismissible */}}>
      <DialogContent
        className="max-w-sm mx-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center items-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-3 mx-auto shadow-lg">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-stone-900">
            Neues Passwort setzen
          </DialogTitle>
          <DialogDescription className="text-stone-600 mt-1">
            Vergib jetzt ein neues Passwort für deinen Floralog Account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded flex items-start text-sm">
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded flex items-start text-sm">
              <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Passwort erfolgreich aktualisiert.</p>
                <p>Du wirst jetzt eingeloggt…</p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="rp-password" className="block text-sm font-medium mb-1">
              <Lock className="inline w-4 h-4 mr-1" />
              Neues Passwort
            </label>
            <input
              id="rp-password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || success}
              required
              autoComplete="new-password"
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
            <label htmlFor="rp-confirm" className="block text-sm font-medium mb-1">
              <Lock className="inline w-4 h-4 mr-1" />
              Passwort bestätigen
            </label>
            <input
              id="rp-confirm"
              type="password"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading || success}
              required
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            />
          </div>

          <p className="text-xs text-gray-500">
            Anforderungen: Mindestens 8 Zeichen, Klein-/Großbuchstaben und Zahlen.
          </p>

          <button
            type="submit"
            disabled={isLoading || success}
            className="w-full bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Wird gespeichert…
              </>
            ) : (
              'Neues Passwort speichern'
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
