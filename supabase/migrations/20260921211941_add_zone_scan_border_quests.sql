-- Season 2: cumulative Geo-Zone scan quests with border accessory rewards.

ALTER TABLE public."Quest"
	ADD COLUMN IF NOT EXISTS requires_zone_scan boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS zone_scan_category text;

ALTER TABLE public."Quest"
	DROP CONSTRAINT IF EXISTS quest_zone_scan_category_check;
ALTER TABLE public."Quest"
	ADD CONSTRAINT quest_zone_scan_category_check
	CHECK (zone_scan_category IS NULL OR zone_scan_category IN ('all', 'forest', 'flower', 'bush'));

INSERT INTO public."Rewards" (id, name, display_name, type, value, spark_price, amber_price)
VALUES
	('reward_logo_accessory_border_gather1', 'accessory_border_gather1', 'Sammel-Rahmen 1', 'logo_accessory', 'border_gather1', 0, null),
	('reward_logo_accessory_border_gather2', 'accessory_border_gather2', 'Sammel-Rahmen 2', 'logo_accessory', 'border_gather2', 0, null),
	('reward_logo_accessory_border_gather3', 'accessory_border_gather3', 'Sammel-Rahmen 3', 'logo_accessory', 'border_gather3', 0, null),
	('reward_logo_accessory_border_gather4', 'accessory_border_gather4', 'Sammel-Rahmen 4', 'logo_accessory', 'border_gather4', 0, null),
	('reward_logo_accessory_border_forest1', 'accessory_border_forest1', 'Wald-Rahmen 1', 'logo_accessory', 'border_forest1', 0, null),
	('reward_logo_accessory_border_forest2', 'accessory_border_forest2', 'Wald-Rahmen 2', 'logo_accessory', 'border_forest2', 0, null),
	('reward_logo_accessory_border_forest3', 'accessory_border_forest3', 'Wald-Rahmen 3', 'logo_accessory', 'border_forest3', 0, null),
	('reward_logo_accessory_border_forest4', 'accessory_border_forest4', 'Wald-Rahmen 4', 'logo_accessory', 'border_forest4', 0, null),
	('reward_logo_accessory_border_flower1', 'accessory_border_flower1', 'Blumen-Rahmen 1', 'logo_accessory', 'border_flower1', 0, null),
	('reward_logo_accessory_border_flower2', 'accessory_border_flower2', 'Blumen-Rahmen 2', 'logo_accessory', 'border_flower2', 0, null),
	('reward_logo_accessory_border_flower3', 'accessory_border_flower3', 'Blumen-Rahmen 3', 'logo_accessory', 'border_flower3', 0, null),
	('reward_logo_accessory_border_flower4', 'accessory_border_flower4', 'Blumen-Rahmen 4', 'logo_accessory', 'border_flower4', 0, null),
	('reward_logo_accessory_border_bush1', 'accessory_border_bush1', 'Sträucher-Rahmen 1', 'logo_accessory', 'border_bush1', 0, null),
	('reward_logo_accessory_border_bush2', 'accessory_border_bush2', 'Sträucher-Rahmen 2', 'logo_accessory', 'border_bush2', 0, null),
	('reward_logo_accessory_border_bush3', 'accessory_border_bush3', 'Sträucher-Rahmen 3', 'logo_accessory', 'border_bush3', 0, null),
	('reward_logo_accessory_border_bush4', 'accessory_border_bush4', 'Sträucher-Rahmen 4', 'logo_accessory', 'border_bush4', 0, null)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
		display_name = EXCLUDED.display_name,
		type = EXCLUDED.type,
		value = EXCLUDED.value;

WITH quest_seed(quest_number, quest_id, title, category_key, target, reward_name, prerequisite_number) AS (
	VALUES
		(9201, 'quest_zone_gather_5',  'Geo-Sammler I',   'all',    5,  'accessory_border_gather1', NULL),
		(9202, 'quest_zone_gather_15', 'Geo-Sammler II',  'all',   15,  'accessory_border_gather2', 9201),
		(9203, 'quest_zone_gather_25', 'Geo-Sammler III', 'all',   25,  'accessory_border_gather3', 9202),
		(9204, 'quest_zone_gather_50', 'Geo-Sammler IV',  'all',   50,  'accessory_border_gather4', 9203),
		(9211, 'quest_zone_forest_5',  'Wald-Entdecker I',   'forest', 5,  'accessory_border_forest1', NULL),
		(9212, 'quest_zone_forest_15', 'Wald-Entdecker II',  'forest', 15, 'accessory_border_forest2', 9211),
		(9213, 'quest_zone_forest_25', 'Wald-Entdecker III', 'forest', 25, 'accessory_border_forest3', 9212),
		(9214, 'quest_zone_forest_50', 'Wald-Entdecker IV',  'forest', 50, 'accessory_border_forest4', 9213),
		(9221, 'quest_zone_flower_5',  'Blumen-Entdecker I',   'flower', 5,  'accessory_border_flower1', NULL),
		(9222, 'quest_zone_flower_15', 'Blumen-Entdecker II',  'flower', 15, 'accessory_border_flower2', 9221),
		(9223, 'quest_zone_flower_25', 'Blumen-Entdecker III', 'flower', 25, 'accessory_border_flower3', 9222),
		(9224, 'quest_zone_flower_50', 'Blumen-Entdecker IV',  'flower', 50, 'accessory_border_flower4', 9223),
		(9231, 'quest_zone_bush_5',  'Sträucher-Entdecker I',   'bush', 5,  'accessory_border_bush1', NULL),
		(9232, 'quest_zone_bush_15', 'Sträucher-Entdecker II',  'bush', 15, 'accessory_border_bush2', 9231),
		(9233, 'quest_zone_bush_25', 'Sträucher-Entdecker III', 'bush', 25, 'accessory_border_bush3', 9232),
		(9234, 'quest_zone_bush_50', 'Sträucher-Entdecker IV',  'bush', 50, 'accessory_border_bush4', 9233)
)
INSERT INTO public."Quest" (
	id, quest_number, title, description, requirement, required_discoveries,
	prerequisite_quest_number, reward_name, seed_reward, requires_zone_scan,
	zone_scan_category, created_date, updated_date
)
SELECT
	quest_id,
	quest_number,
	title,
	'Scanne Pflanzen in aktiven Geo-Zonen.',
	format('%s Scans in Geo-Zonen', target),
	target,
	prerequisite_number,
	reward_name,
	0,
	true,
	category_key,
	now(),
	now()
FROM quest_seed
ON CONFLICT (id) DO UPDATE
SET quest_number = EXCLUDED.quest_number,
		title = EXCLUDED.title,
		description = EXCLUDED.description,
		requirement = EXCLUDED.requirement,
		required_discoveries = EXCLUDED.required_discoveries,
		prerequisite_quest_number = EXCLUDED.prerequisite_quest_number,
		reward_name = EXCLUDED.reward_name,
		seed_reward = EXCLUDED.seed_reward,
		requires_zone_scan = EXCLUDED.requires_zone_scan,
		zone_scan_category = EXCLUDED.zone_scan_category,
		updated_date = now();

CREATE INDEX IF NOT EXISTS idx_quest_zone_scan
	ON public."Quest" (requires_zone_scan, zone_scan_category, quest_number);

NOTIFY pgrst, 'reload schema';
