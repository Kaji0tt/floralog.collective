-- 040_set_langzeitduenger_duration_to_7_days.sql
-- Set long-term fertilizer duration to 7 days.

update public."RobotPlantShopItem"
set duration_hours = 168,
    description = 'Reduziert taeglichen Verfall fuer 7 Tage.'
where item_key = 'fertilizer_longterm';
