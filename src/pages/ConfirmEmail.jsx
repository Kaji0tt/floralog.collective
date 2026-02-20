import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg">
        <div className="p-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <MailCheck className="w-7 h-7 text-green-700" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Bitte E-Mail bestätigen</h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            Wir haben dir einen Bestätigungslink gesendet.
          </p>

          {email && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-gray-700 break-all">
              <strong>E-Mail:</strong> {email}
            </div>
          )}

          <p className="text-sm text-gray-700 mb-6">
            Öffne dein Postfach und klicke auf den Link in der E-Mail. Erst danach kannst du dich einloggen.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg"
            >
              Zum Login
            </button>

            <button
              onClick={() => navigate('/register')}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg"
            >
              Zurück zur Registrierung
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
