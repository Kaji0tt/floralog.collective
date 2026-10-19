-- Lootbox-only rewards must not be purchasable in the shop. syncLogoAssets used to
-- reset shop_hidden=false for every active logo asset; exclusive_source now protects them.
update public."Rewards" r
set
	shop_hidden = true,
	exclusive_source = 'zone_lootbox'
where r.id in (
	select distinct e.reward_id
	from public."ZoneLootboxEntry" e
	where e.reward_id is not null
)
	and r.exclusive_source is null;
