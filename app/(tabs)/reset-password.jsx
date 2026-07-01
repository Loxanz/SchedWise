import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

const THEME_STORAGE_KEY = "schedwise_app_theme_mode";
const THEME_CHANGE_EVENT = "schedwise_theme_changed";

const DARK_THEME = {
  mode: "dark",
  background: "#081225",
  statusBarStyle: "light-content",
  headerGradient: ["#081225", "#0d2342", "#081225"],
  buttonGradient: ["#4f7df3", "#5f8fff", "#78b7ff"],
  text: "#ffffff",
  mutedText: "#8ea2c1",
  softText: "#91a5c6",
  placeholder: "#7384a3",
  inputIcon: "#8fa3c7",
  primary: "#65a1ff",
  card: "#0d1529",
  input: "#121c32",
  border: "#1b2944",
  inputBorder: "#21304c",
  shadow: "#000",
  danger: "#ff4d5f",
};

const LIGHT_THEME = {
  mode: "light",
  background: "#f4f7fb",
  statusBarStyle: "dark-content",
  headerGradient: ["#eaf2ff", "#f7fbff", "#f4f7fb"],
  buttonGradient: ["#4f7df3", "#5f8fff", "#78b7ff"],
  text: "#10203b",
  mutedText: "#60718f",
  softText: "#4f607a",
  placeholder: "#8a98ad",
  inputIcon: "#60718f",
  primary: "#3f76e8",
  card: "#ffffff",
  input: "#eef4ff",
  border: "#d9e4f2",
  inputBorder: "#ccd8ea",
  shadow: "#9ab8ff",
  danger: "#ef4444",
};

function getValueFromUrl(url, key) {
  if (!url || !key) return "";

  try {
    const parsedUrl = new URL(url);

    const queryValue = parsedUrl.searchParams.get(key);

    if (queryValue) {
      return queryValue;
    }

    const hashText = parsedUrl.hash?.startsWith("#")
      ? parsedUrl.hash.slice(1)
      : parsedUrl.hash || "";

    const hashParams = new URLSearchParams(hashText);

    return hashParams.get(key) || "";
  } catch {
    const queryText = String(url).split("?")[1]?.split("#")[0] || "";
    const hashText = String(url).split("#")[1] || "";

    const queryParams = new URLSearchParams(queryText);
    const hashParams = new URLSearchParams(hashText);

    return queryParams.get(key) || hashParams.get(key) || "";
  }
}

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loadingRecovery, setLoadingRecovery] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [themeMode, setThemeMode] = useState(null);

  const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const loadThemeMode = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      setThemeMode(savedTheme === "light" ? "light" : "dark");
    } catch {
      setThemeMode("dark");
    }
  }, []);

  const prepareRecoverySession = useCallback(async (url) => {
    try {
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();

      if (existingSession) {
        setHasRecoverySession(true);
        return;
      }

      if (!url) {
        setHasRecoverySession(false);
        return;
      }

      const oauthError =
        getValueFromUrl(url, "error_description") || getValueFromUrl(url, "error");

      if (oauthError) {
        throw new Error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
      }

      const code = getValueFromUrl(url, "code");

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        setHasRecoverySession(Boolean(data?.session));
        return;
      }

      const accessToken = getValueFromUrl(url, "access_token");
      const refreshToken = getValueFromUrl(url, "refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          throw error;
        }

        setHasRecoverySession(Boolean(data?.session));
        return;
      }

      setHasRecoverySession(false);
    } catch (error) {
      setHasRecoverySession(false);

      Alert.alert(
        "Reset Link Error",
        error?.message ||
          "Unable to verify your password reset link. Please request a new reset email."
      );
    } finally {
      setLoadingRecovery(false);
    }
  }, []);

  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

  useEffect(() => {
    const themeSubscription = DeviceEventEmitter.addListener(
      THEME_CHANGE_EVENT,
      (nextTheme) => {
        setThemeMode(nextTheme === "light" ? "light" : "dark");
      }
    );

    return () => {
      themeSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();

      if (isMounted) {
        await prepareRecoverySession(initialUrl);
      }
    };

    loadInitialUrl();

    const urlSubscription = Linking.addEventListener("url", async ({ url }) => {
      setLoadingRecovery(true);
      await prepareRecoverySession(url);
    });

    return () => {
      isMounted = false;
      urlSubscription?.remove?.();
    };
  }, [prepareRecoverySession]);

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert(
        "Missing Password",
        "Please enter and confirm your new password."
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 6 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Your passwords do not match.");
      return;
    }

    if (!hasRecoverySession) {
      Alert.alert(
        "Reset Link Required",
        "Please open the password reset link from your email first."
      );
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        "Password Updated",
        "You can now sign in using your new password.",
        [
          {
            text: "OK",
            onPress: async () => {
              await supabase.auth.signOut();
              setPassword("");
              setConfirmPassword("");
              router.replace("/signin");
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Update Failed",
        error?.message || "Unable to update your password."
      );
    } finally {
      setSaving(false);
    }
  };

  if (themeMode === null) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.background}
        translucent={false}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient colors={theme.headerGradient} style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="lock" size={30} color="#ffffff" />
            </View>

            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password below to regain access to SchedWise.
            </Text>
          </LinearGradient>

          <View style={styles.card}>
            {loadingRecovery ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Checking reset link...</Text>
              </View>
            ) : (
              <>
                {!hasRecoverySession ? (
                  <View style={styles.warningBox}>
                    <Feather
                      name="alert-circle"
                      size={20}
                      color={theme.danger}
                    />
                    <Text style={styles.warningText}>
                      Open the reset link from your email first. If the link has
                      expired, request a new password reset email.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.label}>NEW PASSWORD</Text>

                <View style={styles.inputBox}>
                  <Feather name="lock" size={18} color={theme.inputIcon} />

                  <TextInput
                    placeholder="Enter new password"
                    placeholderTextColor={theme.placeholder}
                    style={styles.input}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                  />

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={18}
                      color={theme.inputIcon}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, styles.fieldSpacing]}>
                  CONFIRM PASSWORD
                </Text>

                <View style={styles.inputBox}>
                  <Feather name="shield" size={18} color={theme.inputIcon} />

                  <TextInput
                    placeholder="Confirm new password"
                    placeholderTextColor={theme.placeholder}
                    style={styles.input}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                  >
                    <Feather
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size={18}
                      color={theme.inputIcon}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleUpdatePassword}
                  disabled={saving || !hasRecoverySession}
                >
                  <LinearGradient
                    colors={theme.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.updateButton,
                      (saving || !hasRecoverySession) && styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.updateButtonText}>
                      {saving ? "Updating..." : "Update Password"}
                    </Text>

                    {saving ? (
                      <ActivityIndicator
                        size="small"
                        color="#ffffff"
                        style={styles.buttonIcon}
                      />
                    ) : (
                      <Feather
                        name="check"
                        size={19}
                        color="#ffffff"
                        style={styles.buttonIcon}
                      />
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.replace("/signin")}
                  disabled={saving}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

    keyboardView: {
      flex: 1,
    },

    scrollContent: {
      flexGrow: 1,
      paddingBottom: 30,
    },

    header: {
      paddingTop: TOP_SAFE_SPACE + 42,
      paddingHorizontal: 24,
      paddingBottom: 48,
      alignItems: "center",
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },

    iconCircle: {
      width: 74,
      height: 74,
      borderRadius: 24,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },

    title: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
      textAlign: "center",
    },

    subtitle: {
      color: theme.softText,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginTop: 8,
    },

    card: {
      marginHorizontal: 18,
      marginTop: -24,
      backgroundColor: theme.card,
      borderRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 24,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: theme.mode === "dark" ? 0.25 : 0.14,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
    },

    loadingBox: {
      minHeight: 170,
      alignItems: "center",
      justifyContent: "center",
    },

    loadingText: {
      color: theme.mutedText,
      fontSize: 14,
      fontWeight: "700",
      marginTop: 14,
    },

    warningBox: {
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255,77,95,0.12)"
          : "rgba(239,68,68,0.10)",
      borderWidth: 1,
      borderColor:
        theme.mode === "dark"
          ? "rgba(255,77,95,0.26)"
          : "rgba(239,68,68,0.20)",
      borderRadius: 15,
      padding: 13,
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 18,
    },

    warningText: {
      flex: 1,
      color: theme.danger,
      fontSize: 12.5,
      fontWeight: "700",
      lineHeight: 18,
      marginLeft: 9,
    },

    label: {
      color: theme.mutedText,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginBottom: 9,
    },

    fieldSpacing: {
      marginTop: 18,
    },

    inputBox: {
      height: 52,
      borderRadius: 15,
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      paddingHorizontal: 15,
      flexDirection: "row",
      alignItems: "center",
    },

    input: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      marginLeft: 11,
    },

    updateButton: {
      height: 54,
      borderRadius: 15,
      marginTop: 24,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      shadowColor: "#5f8fff",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 7 },
      elevation: 5,
    },

    disabledButton: {
      opacity: 0.55,
    },

    updateButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "900",
    },

    buttonIcon: {
      marginLeft: 8,
    },

    backButton: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
    },

    backButtonText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: "800",
    },
  });