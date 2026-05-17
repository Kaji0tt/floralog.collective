const buildAssetUrl = (fileName) => new URL(`../../design/${fileName}`, import.meta.url).href;

export const LOGO_ACCESSORY_DEFAULTS = {
  selected_face_asset: "face_original",
  selected_plant_asset: "plant_leaf",
  selected_border_asset: "border_original",
};

const faceOptions = [
  { id: "face_original", label: "Original", fileName: "face_original.png" },
  { id: "face_annoyed", label: "Annoyed", fileName: "face_annoyed.png" },
  { id: "face_blush", label: "Blush", fileName: "face_blush.png" },
  { id: "face_sus", label: "Sus", fileName: "face_sus.png" },
  { id: "face_v", label: "V", fileName: "face_v.png" },
];

const plantOptions = [
  { id: "plant_leaf", label: "Leaf", fileName: "plant_leaf.png" },
  { id: "plant_legacy", label: "Legacy", fileName: "plant_legacy.png" },
  { id: "plant_kirsche", label: "Kirsche", fileName: "plant_kirsche.png" },
  { id: "plant_schilf", label: "Schilf", fileName: "plant_schilf.png" },
];

const borderOptions = [
  { id: "border_original", label: "Original", fileName: "border_original.png" },
];

const withAssetMeta = (options, profileField) =>
  options.map((option) => ({
    id: option.id,
    value: option.id,
    label: option.label,
    profileField,
    imageUrl: buildAssetUrl(option.fileName),
    type: "accessory",
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
