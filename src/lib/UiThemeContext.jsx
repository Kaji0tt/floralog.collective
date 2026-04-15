import React, { createContext, useContext, useState, useCallback } from "react";

const UiThemeContext = createContext({
  uiTheme: "dark",
  isLightUi: false,
  setUiTheme: () => {},
  pushThemeOverride: () => {},
  popThemeOverride: () => {},
});

export function UiThemeProvider({ children }) {
  const [uiTheme, setUiThemeState] = useState(() => {
    try {
      return localStorage.getItem("home-ui-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  // Contextual override used by Friend pages to apply the friend's preferred theme.
  // Does NOT modify localStorage — restores automatically when Friend pages unmount.
  const [themeOverride, setThemeOverride] = useState(null);

  const setUiTheme = useCallback((theme) => {
    setUiThemeState(theme);
    try {
      localStorage.setItem("home-ui-theme", theme);
    } catch {}
  }, []);

  /** Push a temporary theme override (used by Friend context pages). */
  const pushThemeOverride = useCallback((theme) => {
    setThemeOverride(theme === "light" ? "light" : "dark");
  }, []);

  /** Remove the temporary override and restore the user's own theme. */
  const popThemeOverride = useCallback(() => {
    setThemeOverride(null);
  }, []);

  const effectiveTheme = themeOverride !== null ? themeOverride : uiTheme;

  return (
    <UiThemeContext.Provider
      value={{
        uiTheme,
        isLightUi: effectiveTheme === "light",
        setUiTheme,
        pushThemeOverride,
        popThemeOverride,
      }}
    >
      {children}
    </UiThemeContext.Provider>
  );
}

export function useUiTheme() {
  return useContext(UiThemeContext);
}
