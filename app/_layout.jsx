import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import {
  APP_BACKGROUND_DARK,
  AppThemeProvider,
  useAppTheme,
} from "./_lib/theme";

function RootNavigator() {
  const { backgroundColor, isDark } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: backgroundColor || APP_BACKGROUND_DARK }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: {
            backgroundColor: backgroundColor || APP_BACKGROUND_DARK,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}
