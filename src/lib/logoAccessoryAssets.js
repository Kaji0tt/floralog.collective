const buildAssetUrl = (fileName) => new URL(`../../design/${fileName}`, import.meta.url).href;

export const LOGO_ACCESSORY_DEFAULTS = {
  selected_face_asset: "face_original",
  selected_plant_asset: "plant_leaf",
  selected_border_asset: "border_original",
};

const faceOptions = [
  { id: "face_original", label: "Original", fileName: "face_original.png" },
  { id: "face_annoyed", label: "Annoyed", fileName: "face_annoyed.png" },
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
