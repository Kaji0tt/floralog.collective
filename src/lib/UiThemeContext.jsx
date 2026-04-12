import React, { createContext, useContext, useState } from "react";

const UiThemeContext = createContext({
  uiTheme: "dark",
  isLightUi: false,
  setUiTheme: () => {},
});

export function UiThemeProvider({ children }) {
  const [uiTheme, setUiThemeState] = useState(() => {
    try {
      return localStorage.getItem("home-ui-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  const setUiTheme = (theme) => {
    setUiThemeState(theme);
    try {
      localStorage.setItem("home-ui-theme", theme);
    } catch {}
  };

  return (
    <UiThemeContext.Provider value={{ uiTheme, isLightUi: uiTheme === "light", setUiTheme }}>
      {children}
    </UiThemeContext.Provider>
  );
}

export function useUiTheme() {
  return useContext(UiThemeContext);
}
