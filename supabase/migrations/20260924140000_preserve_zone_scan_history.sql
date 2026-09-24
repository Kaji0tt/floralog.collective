-- Daily zone cleanup must not delete cumulative category-quest scan history.
ALTER TABLE public."RobotPlantZoneScan"
	ALTER COLUMN zone_id DROP NOT NULL;

ALTER TABLE public."RobotPlantZoneScan"
	DROP CONSTRAINT IF EXISTS "RobotPlantZoneScan_zone_id_fkey";

ALTER TABLE public."RobotPlantZoneScan"
	ADD CONSTRAINT "RobotPlantZoneScan_zone_id_fkey"
	FOREIGN KEY (zone_id)
	REFERENCES public."RobotPlantZone" (id)
	ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';