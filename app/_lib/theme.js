import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DeviceEventEmitter } from "react-native";

export const THEME_STORAGE_KEY = "schedwise_app_theme_mode";
export const THEME_CHANGE_EVENT = "schedwise_theme_changed";

export const APP_BACKGROUND_DARK = "#081225";
export const APP_BACKGROUND_LIGHT = "#f4f7fb";

const darkColors = {
  hex000: "#000",
  hex081225: "#081225",
  hex0a1121: "#0a1121",
  hex0a1830: "#0a1830",
  hex0d1529: "#0d1529",
  hex0d2342: "#0d2342",
  hex101f3a: "#101f3a",
  hex121c32: "#121c32",
  hex13203a: "#13203a",
  hex14294d: "#14294d",
  hex17233b: "#17233b",
  hex1b2944: "#1b2944",
  hex21304c: "#21304c",
  hex22395f: "#22395f",
  hex233350: "#233350",
  hex24324d: "#24324d",
  hex263552: "#263552",
  hex31476c: "#31476c",
  hex334563: "#334563",
  hex345fa8: "#345fa8",
  hex3b4964: "#3b4964",
  hex40506f: "#40506f",
  hex4f7df3: "#4f7df3",
  hex5f8fff: "#5f8fff",
  hex65a1ff: "#65a1ff",
  hex667895: "#667895",
  hex6d5dfc: "#6d5dfc",
  hex6f819f: "#6f819f",
  hex7384a3: "#7384a3",
  hex78b7ff: "#78b7ff",
  hex7e8fa9: "#7e8fa9",
  hex7f94ba: "#7f94ba",
  hex8bb8ff: "#8bb8ff",
  hex8ea2c1: "#8ea2c1",
  hex8fa3c7: "#8fa3c7",
  hex91a5c6: "#91a5c6",
  hexb6c7e6: "#b6c7e6",
  hexd7e4ff: "#d7e4ff",
  hexffffff: "#ffffff",
  hex22c55e: "#22c55e",
  hexf59e0b: "#f59e0b",
  hexff4d5f: "#ff4d5f",
  hexffcc66: "#ffcc66",
};

const lightColors = {
  hex000: "#000",
  hex081225: "#f5f8ff",
  hex0a1121: "#edf2fb",
  hex0a1830: "#eef4ff",
  hex0d1529: "#ffffff",
  hex0d2342: "#e7efff",
  hex101f3a: "#eef4ff",
  hex121c32: "#f8fbff",
  hex13203a: "#dce6f7",
  hex14294d: "#e6efff",
  hex17233b: "#eef3fb",
  hex1b2944: "#d7e0f0",
  hex21304c: "#d3ddec",
  hex22395f: "#d9e6fb",
  hex233350: "#d7e0ef",
  hex24324d: "#d9e2f1",
  hex263552: "#d2dceb",
  hex31476c: "#c8d7f0",
  hex334563: "#cbd8ea",
  hex345fa8: "#8bb8ff",
  hex3b4964: "#d2dae8",
  hex40506f: "#9aa8bd",
  hex4f7df3: "#4f7df3",
  hex5f8fff: "#5f8fff",
  hex65a1ff: "#3f7fe7",
  hex667895: "#6b7890",
  hex6d5dfc: "#6d5dfc",
  hex6f819f: "#64748b",
  hex7384a3: "#7a8699",
  hex78b7ff: "#78b7ff",
  hex7e8fa9: "#718096",
  hex7f94ba: "#66758e",
  hex8bb8ff: "#5f93ed",
  hex8ea2c1: "#64748b",
  hex8fa3c7: "#64748b",
  hex91a5c6: "#5f6f8a",
  hexb6c7e6: "#475569",
  hexd7e4ff: "#1f2a44",
  hexffffff: "#0f172a",
  hex22c55e: "#16a34a",
  hexf59e0b: "#d97706",
  hexff4d5f: "#e11d48",
  hexffcc66: "#b7791f",
};

export const normalizeThemeMode = (value) =>
  value === "light" ? "light" : "dark";

export const getAppBackgroundColor = (themeMode) =>
  normalizeThemeMode(themeMode) === "light"
    ? APP_BACKGROUND_LIGHT
    : APP_BACKGROUND_DARK;

export const applyNativeBackground = async (themeMode) => {
  try {
    await SystemUI.setBackgroundColorAsync(getAppBackgroundColor(themeMode));
  } catch {
    // Native background sync is best-effort.
  }
};

const ThemeContext = createContext({
  themeMode: "dark",
  isDark: true,
  colors: darkColors,
  backgroundColor: APP_BACKGROUND_DARK,
  isThemeReady: false,
  setThemeMode: async () => {},
  toggleTheme: async () => {},
});

export function AppThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState("dark");
  const [isThemeReady, setIsThemeReady] = useState(false);

  const applyThemeMode = useCallback(async (nextThemeMode, { persist = true, emit = true } = {}) => {
    const normalizedTheme = normalizeThemeMode(nextThemeMode);

    setThemeModeState(normalizedTheme);
    await applyNativeBackground(normalizedTheme);

    if (emit) {
      DeviceEventEmitter.emit(THEME_CHANGE_EVENT, normalizedTheme);
    }

    if (persist) {
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
      } catch {
        // Keep the selected theme active for the current session even if storage fails.
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const normalizedTheme = normalizeThemeMode(savedTheme);

        if (!isMounted) {
          return;
        }

        setThemeModeState(normalizedTheme);
        await applyNativeBackground(normalizedTheme);
        DeviceEventEmitter.emit(THEME_CHANGE_EVENT, normalizedTheme);
      } catch {
        if (isMounted) {
          setThemeModeState("dark");
          await applyNativeBackground("dark");
        }
      } finally {
        if (isMounted) {
          setIsThemeReady(true);
        }
      }
    };

    loadTheme();

    const subscription = DeviceEventEmitter.addListener(
      THEME_CHANGE_EVENT,
      (nextTheme) => {
        const normalizedTheme = normalizeThemeMode(nextTheme);
        setThemeModeState(normalizedTheme);
        applyNativeBackground(normalizedTheme);
      }
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const setThemeMode = useCallback(
    async (nextThemeMode) => {
      await applyThemeMode(nextThemeMode, { persist: true, emit: true });
    },
    [applyThemeMode]
  );

  const value = useMemo(() => {
    const isDark = themeMode === "dark";

    return {
      themeMode,
      isDark,
      colors: isDark ? darkColors : lightColors,
      backgroundColor: getAppBackgroundColor(themeMode),
      isThemeReady,
      setThemeMode,
      toggleTheme: () => setThemeMode(isDark ? "light" : "dark"),
    };
  }, [isThemeReady, setThemeMode, themeMode]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
