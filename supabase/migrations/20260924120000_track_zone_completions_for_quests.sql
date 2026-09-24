-- Keep cumulative quest progress independent from active daily zones and client-side scan timing.
CREATE TABLE IF NOT EXISTS public."RobotPlantZoneCompletion" (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	zone_id uuid NOT NULL UNIQUE,
	auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	zone_theme text,
	completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_robotplant_zonecompletion_auth_completed
	ON public."RobotPlantZoneCompletion" (auth_id, completed_at DESC);

ALTER TABLE public."RobotPlantZoneCompletion" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."RobotPlantZoneCompletion" FROM anon, authenticated;
GRANT SELECT ON TABLE public."RobotPlantZoneCompletion" TO authenticated;

DROP POLICY IF EXISTS robotplant_zonecompletion_select_own
	ON public."RobotPlantZoneCompletion";
CREATE POLICY robotplant_zonecompletion_select_own
	ON public."RobotPlantZoneCompletion"
	FOR SELECT
	TO authenticated
	USING ((SELECT auth.uid()) = auth_id);

-- RobotPlantZoneScan already had RLS enabled, but no SELECT policy. That made every
-- scan-based zone quest appear to have zero progress in the client.
REVOKE ALL ON TABLE public."RobotPlantZoneScan" FROM anon, authenticated;
GRANT SELECT ON TABLE public."RobotPlantZoneScan" TO authenticated;

DROP POLICY IF EXISTS robotplant_zonescan_select_own
	ON public."RobotPlantZoneScan";
CREATE POLICY robotplant_zonescan_select_own
	ON public."RobotPlantZoneScan"
	FOR SELECT
	TO authenticated
	USING ((SELECT auth.uid()) = auth_id);

-- Preserve progress for zones completed before the durable completion ledger existed.
INSERT INTO public."RobotPlantZoneCompletion" (zone_id, auth_id, zone_theme, completed_at)
SELECT
	state.zone_id,
	state.auth_id,
	zone.theme,
	COALESCE(state.last_scan_at, now())
FROM public."RobotPlantUserZoneState" state
JOIN public."RobotPlantZone" zone ON zone.id = state.zone_id
WHERE state.scans_in_zone >= COALESCE(zone.required_scan_count, 5)
	AND state.last_scan_at >= timestamptz '2026-09-21 00:00:00+00'
ON CONFLICT (zone_id) DO NOTHING;

ALTER TABLE public."Quest"
	ADD COLUMN IF NOT EXISTS requires_zone_completion boolean NOT NULL DEFAULT false;

UPDATE public."Quest"
SET
	title = CASE id
		WHEN 'quest_zone_gather_5' THEN 'Zonen-Pionier I'
		WHEN 'quest_zone_gather_15' THEN 'Zonen-Pionier II'
		WHEN 'quest_zone_gather_25' THEN 'Zonen-Pionier III'
		WHEN 'quest_zone_gather_50' THEN 'Zonen-Pionier IV'
		ELSE title
	END,
	description = 'Schließe Geo-Zonen vollständig ab.',
	requirement = format('%s Geo-Zonen abschließen', required_discoveries),
	requires_zone_scan = false,
	zone_scan_category = NULL,
	requires_zone_completion = true,
	updated_date = now()
WHERE id IN (
	'quest_zone_gather_5',
	'quest_zone_gather_15',
	'quest_zone_gather_25',
	'quest_zone_gather_50'
);

NOTIFY pgrst, 'reload schema';