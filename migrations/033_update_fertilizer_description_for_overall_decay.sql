-- 033_update_fertilizer_description_for_overall_decay.sql
-- Clarify fertilizer effect based on overall daily decay formula.

update public."RobotPlantShopItem"
set description = 'Reduziert den taeglichen Decay (Basis: floor(Gesamtgesundheit/10), min. 1) kurzfristig.'
where item_key = 'fertilizer_basic';

update public."RobotPlantShopItem"
set description = 'Reduziert den taeglichen Decay (Basis: floor(Gesamtgesundheit/10), min. 1) fuer einen laengeren Zeitraum.'
where item_key = 'fertilizer_longterm';
