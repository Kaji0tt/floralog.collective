-- Store browser/device push subscription JSON for Web Push delivery.
ALTER TABLE "PublicProfile"
ADD COLUMN IF NOT EXISTS push_subscription text;
