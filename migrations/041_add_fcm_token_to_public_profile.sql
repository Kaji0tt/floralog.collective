-- Add native push token storage for Capacitor/FCM delivery.
ALTER TABLE public."PublicProfile"
ADD COLUMN IF NOT EXISTS fcm_token text;
