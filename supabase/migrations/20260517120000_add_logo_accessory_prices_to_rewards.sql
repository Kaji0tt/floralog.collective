alter table "Rewards"
  add column if not exists spark_price integer,
  add column if not exists amber_price integer;

alter table "Rewards"
  drop constraint if exists rewards_spark_price_non_negative,
  drop constraint if exists rewards_amber_price_non_negative;

alter table "Rewards"
  add constraint rewards_spark_price_non_negative check (spark_price is null or spark_price >= 0),
  add constraint rewards_amber_price_non_negative check (amber_price is null or amber_price >= 0);

notify pgrst, 'reload schema';
