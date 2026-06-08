import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, useFocusEffect, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, DeviceEventEmitter, View } from "react-native";
import { supabase } from "../lib/supabase";

const THEME_STORAGE_KEY = "schedwise_app_theme_mode";
const THEME_CHANGE_EVENT = "schedwise_theme_changed";

const DARK_THEME = {
  mode: "dark",
  background: "#081225",
  tabBarBackground: "#0d1529",
  tabBarBorder: "#1b2944",
  activeTint: "#65a1ff",
  inactiveTint: "#8ea2c1",
  loadingIndicator: "#65a1ff",
};

const LIGHT_THEME = {
  mode: "light",
  background: "#f4f7fb",
  tabBarBackground: "#ffffff",
  tabBarBorder: "#d9e4f2",
  activeTint: "#3f76e8",
  inactiveTint: "#60718f",
  loadingIndicator: "#3f76e8",
};

const createTabBarStyle = (theme) => ({
  height: 72,
  paddingTop: 8,
  paddingBottom: 10,
  backgroundColor: theme.tabBarBackground,
  borderTopWidth: 1,
  borderTopColor: theme.tabBarBorder,
  borderTopLeftRadius: 26,
  borderTopRightRadius: 26,
  position: "absolute",
});

function LoadingScreen({ theme }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator size="large" color={theme.loadingIndicator} />
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [themeMode, setThemeMode] = useState(null);

  const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME;
  const tabBarStyle = useMemo(() => createTabBarStyle(theme), [theme]);

  const loadThemeMode = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      setThemeMode(savedTheme === "light" ? "light" : "dark");
    } catch {
      setThemeMode("dark");
    }
  }, []);

  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();
    }, [loadThemeMode])
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      THEME_CHANGE_EVENT,
      (nextTheme) => {
        setThemeMode(nextTheme === "light" ? "light" : "dark");
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const isAuthRoute = useMemo(() => {
    return (
      pathname === "/signin" ||
      pathname === "/signup" ||
      pathname.endsWith("/signin") ||
      pathname.endsWith("/signup")
    );
  }, [pathname]);

  const isResetPasswordRoute = useMemo(() => {
    return (
      pathname === "/reset-password" || pathname.endsWith("/reset-password")
    );
  }, [pathname]);

  const isPublicRoute = isAuthRoute || isResetPasswordRoute;
  const isSignedIn = Boolean(session);
  const canShowTabs = isSignedIn && !isPublicRoute;

  useEffect(() => {
    let isMounted = true;

    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setCheckingSession(false);
      }
    }, 2500);

    const loadSession = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.log("Supabase session error:", error.message);
        }

        if (isMounted) {
          setSession(currentSession ?? null);
        }
      } catch (error) {
        console.log("Session loading error:", error?.message);

        if (isMounted) {
          setSession(null);
        }
      } finally {
        clearTimeout(fallbackTimer);

        if (isMounted) {
          setCheckingSession(false);
        }
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession ?? null);
      setCheckingSession(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (checkingSession || themeMode === null) return;

    if (!isSignedIn && !isPublicRoute) {
      router.navigate("/signin");
      return;
    }

    if (isSignedIn && isAuthRoute) {
      router.navigate("/");
    }
  }, [
    checkingSession,
    themeMode,
    isSignedIn,
    isAuthRoute,
    isPublicRoute,
    router,
  ]);

  if (themeMode === null) {
    return null;
  }

  if (checkingSession) {
    return <LoadingScreen theme={theme} />;
  }

  return (
    <Tabs
      initialRouteName={isSignedIn ? "index" : "signin"}
      screenOptions={{
        headerShown: false,
        tabBarStyle: canShowTabs ? tabBarStyle : { display: "none" },
        tabBarActiveTintColor: theme.activeTint,
        tabBarInactiveTintColor: theme.inactiveTint,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chatbot"
        options={{
          title: "AI Chatbot",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="robot-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="flashcards"
        options={{
          title: "Flashcards",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="signin"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="signup"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="reset-password"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}