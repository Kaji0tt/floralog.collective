-- Seed: logo_accessory Reward-Rows für käufliche Accessoires
-- Face-Accessories (face_annoyed, face_sus, face_v) werden normalerweise von
-- syncLogoAssets erzeugt, sobald sie im R2-Katalog hinterlegt sind.
-- Border-Accessories (border_efeu, border_rose, border_winde) sind noch
-- nicht im Frontend-Katalog – diese Rows fungieren als Platzhalter bis
-- die Assets in logoAccessoryAssets.js + R2 eingetragen werden.
--
-- Preise (spark_price / amber_price) nach Bedarf anpassen.
-- Wert NULL = diese Währung wird für den Kauf nicht benötigt.

insert into "Rewards" (id, name, display_name, type, value, spark_price, amber_price)
values
  ('reward_logo_accessory_face_annoyed', 'accessory_face_annoyed', 'Annoyed',       'logo_accessory', 'face_annoyed',    10, null),
  ('reward_logo_accessory_face_sus',     'accessory_face_sus',     'Sus',            'logo_accessory', 'face_sus',        10, null),
  ('reward_logo_accessory_face_v',       'accessory_face_v',       'V',              'logo_accessory', 'face_v',          10, null),
  ('reward_logo_accessory_border_efeu',  'accessory_border_efeu',  'Efeu-Rahmen',    'logo_accessory', 'border_efeu',     20, null),
  ('reward_logo_accessory_border_rose',  'accessory_border_rose',  'Rosen-Rahmen',   'logo_accessory', 'border_rose',     20, null),
  ('reward_logo_accessory_border_winde', 'accessory_border_winde', 'Winden-Rahmen',  'logo_accessory', 'border_winde',    20, null)
on conflict (id) do update
  set
    display_name = excluded.display_name,
    type         = excluded.type,
    value        = excluded.value,
    spark_price  = excluded.spark_price,
    amber_price  = excluded.amber_price;

notify pgrst, 'reload schema';
