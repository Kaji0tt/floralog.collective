-- Use the player-facing term "Entdecker-Knospe" for existing zone pools.
-- Internal table and function names remain ZoneLootbox* for compatibility.

UPDATE public."ZoneLootboxPool"
SET
  name = CASE zone_theme
    WHEN 'forest' THEN 'Wald-Entdecker-Knospe'
    WHEN 'water' THEN 'Wasser-Entdecker-Knospe'
    WHEN 'meadow' THEN 'Wiesen-Entdecker-Knospe'
    WHEN 'urban' THEN 'Stadt-Entdecker-Knospe'
    WHEN 'beach' THEN 'Strand-Entdecker-Knospe'
    WHEN 'wetlands' THEN 'Feuchtgebiets-Entdecker-Knospe'
    WHEN 'all' THEN 'Allgemeine Entdecker-Knospe'
    ELSE name
  END,
  description = CASE zone_theme
    WHEN 'all' THEN 'Fallback-Knospe für alle Zone-Themes.'
    WHEN 'forest' THEN 'Belohnungen aus dem Wald-Theme.'
    WHEN 'water' THEN 'Belohnungen aus dem Wasser-Theme.'
    WHEN 'meadow' THEN 'Belohnungen aus dem Wiesen-Theme.'
    WHEN 'urban' THEN 'Belohnungen aus dem Stadt-Theme.'
    WHEN 'beach' THEN 'Belohnungen aus dem Strand-Theme.'
    WHEN 'wetlands' THEN 'Belohnungen aus dem Feuchtgebiets-Theme.'
    ELSE description
  END,
  updated_at = now()
WHERE zone_theme IN ('forest', 'water', 'meadow', 'urban', 'beach', 'wetlands', 'all');

NOTIFY pgrst, 'reload schema';
