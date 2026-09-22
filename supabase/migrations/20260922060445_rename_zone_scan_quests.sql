-- Rename the cumulative Geo-Zone scan quests without changing their progress,
-- prerequisites, categories, or rewards.
UPDATE public."Quest"
SET title = CASE id
	WHEN 'quest_zone_gather_5' THEN 'Zonen-Kunde I'
	WHEN 'quest_zone_gather_15' THEN 'Zonen-Kunde II'
	WHEN 'quest_zone_gather_25' THEN 'Zonen-Kunde III'
	WHEN 'quest_zone_gather_50' THEN 'Zonen-Kunde IV'
	WHEN 'quest_zone_flower_5' THEN 'Knospen für Blumen I'
	WHEN 'quest_zone_flower_15' THEN 'Knospen für Blumen II'
	WHEN 'quest_zone_flower_25' THEN 'Knospen für Blumen III'
	WHEN 'quest_zone_flower_50' THEN 'Knospen für Blumen IV'
	WHEN 'quest_zone_forest_5' THEN 'Knospen für Bäume I'
	WHEN 'quest_zone_forest_15' THEN 'Knospen für Bäume II'
	WHEN 'quest_zone_forest_25' THEN 'Knospen für Bäume III'
	WHEN 'quest_zone_forest_50' THEN 'Knospen für Bäume IV'
	WHEN 'quest_zone_bush_5' THEN 'Knospen für Sträucher I'
	WHEN 'quest_zone_bush_15' THEN 'Knospen für Sträucher II'
	WHEN 'quest_zone_bush_25' THEN 'Knospen für Sträucher III'
	WHEN 'quest_zone_bush_50' THEN 'Knospen für Sträucher IV'
	ELSE title
END,
updated_date = now()
WHERE id IN (
	'quest_zone_gather_5', 'quest_zone_gather_15', 'quest_zone_gather_25', 'quest_zone_gather_50',
	'quest_zone_flower_5', 'quest_zone_flower_15', 'quest_zone_flower_25', 'quest_zone_flower_50',
	'quest_zone_forest_5', 'quest_zone_forest_15', 'quest_zone_forest_25', 'quest_zone_forest_50',
	'quest_zone_bush_5', 'quest_zone_bush_15', 'quest_zone_bush_25', 'quest_zone_bush_50'
);

NOTIFY pgrst, 'reload schema';
