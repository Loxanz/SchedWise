import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs, useGlobalSearchParams, usePathname } from "expo-router";
import { useEffect, useState } from "react";

let signedInMemory = false;

const TAB_BAR_STYLE = {
  height: 72,
  paddingTop: 8,
  paddingBottom: 10,
  backgroundColor: "#0d1529",
  borderTopWidth: 1,
  borderTopColor: "#1b2944",
  borderTopLeftRadius: 26,
  borderTopRightRadius: 26,
  position: "absolute",
};

export default function TabsLayout() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  const [isSignedIn, setIsSignedIn] = useState(signedInMemory);

  const isAuthRoute = pathname === "/signin" || pathname === "/signup";
  const isSigningIn = params?.auth === "true";
  const isSigningOut = params?.logout === "true";

  useEffect(() => {
    if (isSigningIn) {
      signedInMemory = true;
      setIsSignedIn(true);
    }

    if (isSigningOut) {
      signedInMemory = false;
      setIsSignedIn(false);
    }
  }, [isSigningIn, isSigningOut]);

  const canAccessDashboard = isSignedIn || isSigningIn;
  const canShowTabs = canAccessDashboard && !isAuthRoute;

  if (!canAccessDashboard && !isAuthRoute) {
    return <Redirect href="/signin" />;
  }

  if (canAccessDashboard && isAuthRoute && !isSigningOut) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      initialRouteName={canAccessDashboard ? "index" : "signin"}
      screenOptions={{
        headerShown: false,
        tabBarStyle: canShowTabs ? TAB_BAR_STYLE : { display: "none" },
        tabBarActiveTintColor: "#65a1ff",
        tabBarInactiveTintColor: "#8ea2c1",
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
    </Tabs>
  );
}