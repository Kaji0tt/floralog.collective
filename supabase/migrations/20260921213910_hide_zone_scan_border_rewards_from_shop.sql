-- Quest rewards are granted through quest redemption, not sold in the shop.
UPDATE public."Rewards"
SET shop_hidden = true
WHERE id IN (
	'reward_logo_accessory_border_gather1',
	'reward_logo_accessory_border_gather2',
	'reward_logo_accessory_border_gather3',
	'reward_logo_accessory_border_gather4',
	'reward_logo_accessory_border_forest1',
	'reward_logo_accessory_border_forest2',
	'reward_logo_accessory_border_forest3',
	'reward_logo_accessory_border_forest4',
	'reward_logo_accessory_border_flower1',
	'reward_logo_accessory_border_flower2',
	'reward_logo_accessory_border_flower3',
	'reward_logo_accessory_border_flower4',
	'reward_logo_accessory_border_bush1',
	'reward_logo_accessory_border_bush2',
	'reward_logo_accessory_border_bush3',
	'reward_logo_accessory_border_bush4'
);

NOTIFY pgrst, 'reload schema';
