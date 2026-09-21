-- Zone lootbox rewards are only obtainable via zone completion, not sold in the shop.
UPDATE public."Rewards"
SET shop_hidden = true
WHERE id IN (
	'reward_logo_accessory_face_snuggles',
	'reward_logo_accessory_face_slug',
	'reward_logo_accessory_face_sputnik',
	'reward_logo_accessory_face_luchsorbit',
	'reward_logo_accessory_face_slugbud'
);

NOTIFY pgrst, 'reload schema';
