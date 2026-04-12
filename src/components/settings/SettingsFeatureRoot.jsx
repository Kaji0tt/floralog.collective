import SettingsPanel from "./SettingsPanel";

/**
 * SettingsFeatureRoot follows the same architecture pattern as
 * AchievementsFeatureRoot and FriendsFeatureRoot.
 * uiTheme / isLightUi is consumed internally via UiThemeContext.
 */
export default function SettingsFeatureRoot({ user, onUserUpdated, onRequestClose, onHeaderMetaChange }) {
  return (
    <SettingsPanel
      user={user}
      onUserUpdated={onUserUpdated}
    />
  );
}
