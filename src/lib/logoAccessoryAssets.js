// Recursive glob so files inside design/legacy/ (not just design/ root) are bundled and resolvable.
const designAssetUrls = import.meta.glob("../../design/**/*.png", { eager: true, query: "?url", import: "default" });

const buildAssetUrl = (fileName) => {
  const entry = Object.entries(designAssetUrls).find(([path]) => path.endsWith(`/design/${fileName}`));
  return entry ? entry[1] : new URL(`../../design/${fileName}`, import.meta.url).href;
};

export const LOGO_ACCESSORY_DEFAULTS = {
  selected_face_asset: "face_default",
  selected_plant_asset: "plant_leaf",
  selected_border_asset: "border_default",
};

// Mirrors production DEFAULT_UNLOCKED_IDS (supabase/functions/syncLogoAssets, workers/assets-catalog):
// these stay visible/unlocked for everyone. border_original/face_original were retired to
// design/legacy (and R2 custom_logo/legacy/) and are no longer default-unlocked.
export const LOGO_ACCESSORY_DEFAULT_UNLOCKED_IDS = new Set([
  "plant_leaf",
  "border_default",
  "border_hacked",
  "border_orbit",
  "border_triad",
  "face_bug",
  "face_default",
  "face_mask",
  "face_smile",
]);

// Shared border-tint presets used by both the Shop and the guest pre-registration picker.
export const BORDER_COLOR_PRESETS = [
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#00c7be",
  "#0a84ff",
  "#5856d6",
  "#bf5af2",
  "#ff2d55",
  "#8e8e93",
  "#ffffff",
  "#000000",
];

// Normal, currently-designed options (design/ root).
const faceOptions = [
  // Default starter-pack (R2 custom_logo/default/) - always free/unlocked for everyone.
  { id: "face_default", label: "Default", fileName: "default/face_default.png" },
  { id: "face_bug", label: "Bug", fileName: "default/face_bug.png" },
  { id: "face_mask", label: "Mask", fileName: "default/face_mask.png" },
  { id: "face_smile", label: "Smile", fileName: "default/face_smile.png" },
  { id: "face_blush", label: "Blush", fileName: "face_blush.png" },
  { id: "face_golem", label: "Golem", fileName: "face_golem.png" },
  { id: "face_marien", label: "Marien", fileName: "face_marien.png" },
  { id: "face_raupe", label: "Raupe", fileName: "face_raupe.png" },
  { id: "face_reh", label: "Reh", fileName: "face_reh.png" },
  { id: "face_teufel", label: "Teufel", fileName: "face_teufel.png" },
  { id: "face_tiger", label: "Tiger", fileName: "face_tiger.png" },
  // Legacy (retired) - only visible/equippable if explicitly owned or default-unlocked.
  { id: "face_original", label: "Original", fileName: "legacy/face_original.png", isLegacy: true },
  { id: "face_annoyed", label: "Annoyed", fileName: "legacy/face_annoyed.png", isLegacy: true },
  { id: "face_sus", label: "Sus", fileName: "legacy/face_sus.png", isLegacy: true },
  { id: "face_v", label: "V", fileName: "legacy/face_v.png", isLegacy: true },
];

const plantOptions = [
  { id: "plant_forest_eiche", label: "Eiche", fileName: "plant_forest_eiche.png" },
  { id: "plant_forest_moos", label: "Moos", fileName: "plant_forest_moos.png" },
  { id: "plant_forest_waldmeister", label: "Waldmeister", fileName: "plant_forest_waldmeister.png" },
  { id: "plant_meadow_brennnessel", label: "Brennnessel", fileName: "plant_meadow_brennnessel.png" },
  { id: "plant_meadow_kornblume", label: "Kornblume", fileName: "plant_meadow_kornblume.png" },
  { id: "plant_meadow_sonnenblume", label: "Sonnenblume", fileName: "plant_meadow_sonnenblume.png" },
  { id: "plant_urban_efeu", label: "Efeu", fileName: "plant_urban_efeu.png" },
  { id: "plant_urban_platane", label: "Platane", fileName: "plant_urban_platane.png" },
  { id: "plant_urban_rose", label: "Rose", fileName: "plant_urban_rose.png" },
  { id: "plant_water_rohrkolben", label: "Rohrkolben", fileName: "plant_water_rohrkolben.png" },
  { id: "plant_water_sandhafer", label: "Sandhafer", fileName: "plant_water_sandhafer.png" },
  { id: "plant_water_seerose", label: "Seerose", fileName: "plant_water_seerose.png" },
  // Legacy (retired) - only visible/equippable if explicitly owned or default-unlocked.
  { id: "plant_leaf", label: "Leaf", fileName: "legacy/plant_leaf.png", isLegacy: true },
  { id: "plant_legacy", label: "Legacy", fileName: "legacy/plant_legacy.png", isLegacy: true },
  { id: "plant_kirsche", label: "Kirsche", fileName: "legacy/plant_sakura.png", isLegacy: true },
  { id: "plant_schilf", label: "Schilf", fileName: "legacy/plant_schilf.png", isLegacy: true },
];

const borderOptions = [
  // Default starter-pack (R2 custom_logo/default/) - always free/unlocked for everyone.
  { id: "border_default", label: "Default", fileName: "default/border_default.png" },
  { id: "border_hacked", label: "Hacked", fileName: "default/border_hacked.png" },
  { id: "border_orbit", label: "Orbit", fileName: "default/border_orbit.png" },
  { id: "border_triad", label: "Triad", fileName: "default/border_triad.png" },
  { id: "border_efeu", label: "Efeu", fileName: "border_efeu.png" },
  { id: "border_hawaii", label: "Hawaii", fileName: "border_hawaii.png" },
  { id: "border_maori", label: "Maori", fileName: "border_maori.png" },
  { id: "border_rose", label: "Rose", fileName: "border_rose.png" },
  { id: "border_schaltung", label: "Schaltung", fileName: "border_schaltung.png" },
  { id: "border_technik-rose", label: "Technik-Rose", fileName: "border_technik-rose.png" },
  { id: "border_winde", label: "Winde", fileName: "border_winde.png" },
  // Legacy (retired) - only visible/equippable if explicitly owned or default-unlocked.
  { id: "border_original", label: "Original", fileName: "legacy/border_original.png", isLegacy: true },
];

const withAssetMeta = (options, profileField) =>
  options.map((option) => ({
    id: option.id,
    value: option.id,
    label: option.label,
    profileField,
    imageUrl: buildAssetUrl(option.fileName),
    type: "accessory",
    isLegacy: Boolean(option.isLegacy),
  }));

export const LOGO_ACCESSORY_SECTIONS = [
  {
    key: "face",
    title: "Gesicht",
    profileField: "selected_face_asset",
    options: withAssetMeta(faceOptions, "selected_face_asset"),
  },
  {
    key: "plant",
    title: "Pflanze",
    profileField: "selected_plant_asset",
    options: withAssetMeta(plantOptions, "selected_plant_asset"),
  },
  {
    key: "border",
    title: "Rahmen",
    profileField: "selected_border_asset",
    options: withAssetMeta(borderOptions, "selected_border_asset"),
  },
];

const OPTION_BY_FIELD = LOGO_ACCESSORY_SECTIONS.reduce((acc, section) => {
  const field = section.profileField;
  acc[field] = section.options.reduce((optionMap, option) => {
    optionMap[option.value] = option;
    return optionMap;
  }, {});
  return acc;
}, {});

const resolveAssetOption = (field, selectedValue) => {
  const options = OPTION_BY_FIELD[field] || {};
  const fallback = LOGO_ACCESSORY_DEFAULTS[field];
  return options[selectedValue] || options[fallback] || null;
};

const PROFILE_FIELD_TO_ASSET_TYPE = {
  selected_face_asset: "face",
  selected_plant_asset: "plant",
  selected_border_asset: "border",
};

const buildCatalogAssetMaps = (logoAssets = []) => {
  const byTypeAndId = {
    face: new Map(),
    plant: new Map(),
    border: new Map(),
  };

  for (const asset of Array.isArray(logoAssets) ? logoAssets : []) {
    const assetType = String(asset?.asset_type || "").trim();
    const assetId = String(asset?.asset_id || "").trim();
    if (!byTypeAndId[assetType] || !assetId) continue;

    byTypeAndId[assetType].set(assetId, {
      id: assetId,
      value: assetId,
      label: String(asset?.display_name || assetId),
      profileField: `selected_${assetType}_asset`,
      imageUrl: String(asset?.public_url || ""),
      type: "accessory",
    });
  }

  return byTypeAndId;
};

const resolveAssetOptionWithCatalog = (field, selectedValue, catalogAssetsByTypeAndId) => {
  const assetType = PROFILE_FIELD_TO_ASSET_TYPE[field];
  const normalizedSelected = String(selectedValue || "").trim();
  const defaultId = LOGO_ACCESSORY_DEFAULTS[field];

  const catalogTypeMap = assetType ? catalogAssetsByTypeAndId?.[assetType] : null;
  if (catalogTypeMap) {
    if (normalizedSelected && catalogTypeMap.has(normalizedSelected)) {
      return catalogTypeMap.get(normalizedSelected);
    }
    if (defaultId && catalogTypeMap.has(defaultId)) {
      return catalogTypeMap.get(defaultId);
    }
  }

  return resolveAssetOption(field, selectedValue);
};

export const resolveEquippedLogoAssets = (profile = {}) => {
  const faceOption = resolveAssetOption("selected_face_asset", profile?.selected_face_asset);
  const plantOption = resolveAssetOption("selected_plant_asset", profile?.selected_plant_asset);
  const borderOption = resolveAssetOption("selected_border_asset", profile?.selected_border_asset);

  return {
    face: faceOption,
    plant: plantOption,
    border: borderOption,
    borderColor: profile?.selected_border_color || null,
  };
};

export const resolveEquippedLogoAssetsWithCatalog = (profile = {}, logoAssets = []) => {
  const catalogAssetsByTypeAndId = buildCatalogAssetMaps(logoAssets);
  const equipped = {
    face: resolveAssetOptionWithCatalog(
      "selected_face_asset",
      profile?.selected_face_asset,
      catalogAssetsByTypeAndId
    ),
    plant: resolveAssetOptionWithCatalog(
      "selected_plant_asset",
      profile?.selected_plant_asset,
      catalogAssetsByTypeAndId
    ),
    border: resolveAssetOptionWithCatalog(
      "selected_border_asset",
      profile?.selected_border_asset,
      catalogAssetsByTypeAndId
    ),
    borderColor: profile?.selected_border_color || null,
  };

  const assetUrlById = new Map(
    (Array.isArray(logoAssets) ? logoAssets : [])
      .filter((asset) => asset?.asset_id && asset?.public_url)
      .map((asset) => [String(asset.asset_id), String(asset.public_url)])
  );

  const withResolvedUrl = (entry) => {
    if (!entry) return entry;
    return {
      ...entry,
      imageUrl: assetUrlById.get(entry.value) || entry.imageUrl,
    };
  };

  return {
    border: withResolvedUrl(equipped.border),
    plant: withResolvedUrl(equipped.plant),
    face: withResolvedUrl(equipped.face),
    borderColor: equipped.borderColor,
  };
};
