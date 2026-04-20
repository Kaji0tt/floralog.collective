-- 037_add_plantgenus_category_dex_unique.sql
-- Prevent duplicate genus numbers inside the same category.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."PlantGenus"
    WHERE category_dex_number IS NOT NULL
    GROUP BY category, category_dex_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate PlantGenus numbers found for (category, category_dex_number). Resolve duplicates first, then rerun this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS plantgenus_category_dex_unique
  ON public."PlantGenus" (category, category_dex_number)
  WHERE category_dex_number IS NOT NULL;
