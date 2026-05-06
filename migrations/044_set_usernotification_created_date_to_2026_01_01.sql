BEGIN;

-- Set all existing UserNotification entries to a fixed reference date.
UPDATE "UserNotification"
SET created_date = '2026-01-01T00:00:00.000Z';

COMMIT;
