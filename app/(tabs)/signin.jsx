import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
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
import { supabase } from "../_lib/supabase";

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

const THEME_STORAGE_KEY = "schedwise_app_theme_mode";
const THEME_CHANGE_EVENT = "schedwise_theme_changed";

const PASSWORD_RESET_COOLDOWN_KEY = "schedwise_password_reset_cooldown_until";
const PASSWORD_RESET_COOLDOWN_MS = 5 * 60 * 1000;

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
  primaryDark: "#4f7df3",
  card: "#0d1529",
  input: "#121c32",
  border: "#1b2944",
  inputBorder: "#21304c",
  shadow: "#000",
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
  primaryDark: "#4f7df3",
  card: "#ffffff",
  input: "#eef4ff",
  border: "#d9e4f2",
  inputBorder: "#ccd8ea",
  shadow: "#9ab8ff",
};

function getCooldownSeconds(cooldownUntil) {
  const remainingMs = Number(cooldownUntil || 0) - Date.now();

  if (remainingMs <= 0) return 0;

  return Math.ceil(remainingMs / 1000);
}

function formatCooldown(seconds) {
  if (seconds <= 0) return "";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function isEmailRateLimitError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("email rate limit") ||
    message.includes("rate limit") ||
    message.includes("too many")
  );
}

export default function Signin() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState(0);

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

  const loadResetCooldown = useCallback(async () => {
    try {
      const savedCooldownUntil = await AsyncStorage.getItem(
        PASSWORD_RESET_COOLDOWN_KEY
      );

      const nextSeconds = getCooldownSeconds(savedCooldownUntil);

      setResetCooldownSeconds(nextSeconds);

      if (nextSeconds <= 0) {
        await AsyncStorage.removeItem(PASSWORD_RESET_COOLDOWN_KEY);
      }
    } catch {
      setResetCooldownSeconds(0);
    }
  }, []);

  const startResetCooldown = async () => {
    const cooldownUntil = Date.now() + PASSWORD_RESET_COOLDOWN_MS;

    setResetCooldownSeconds(getCooldownSeconds(cooldownUntil));

    try {
      await AsyncStorage.setItem(
        PASSWORD_RESET_COOLDOWN_KEY,
        String(cooldownUntil)
      );
    } catch {
      // Keep the cooldown active for the current session even if storage fails.
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();
      loadResetCooldown();
      setEmail("");
      setPassword("");
      setShowPassword(false);
    }, [loadThemeMode, loadResetCooldown])
  );

  useEffect(() => {
    loadThemeMode();
    loadResetCooldown();
  }, [loadThemeMode, loadResetCooldown]);

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

  useEffect(() => {
    if (resetCooldownSeconds <= 0) return undefined;

    const timer = setInterval(() => {
      loadResetCooldown();
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [resetCooldownSeconds, loadResetCooldown]);

  const clearInputs = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
  };

  const handleSignIn = async () => {
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail || !password) {
      Alert.alert("Missing Information", "Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert(
        "Sign In Failed",
        "Invalid login credentials. If you just created your account, check your email first."
      );
      return;
    }

    clearInputs();
    router.replace("/");
  };

  const handleForgotPassword = async () => {
    const cleanedEmail = email.trim().toLowerCase();

    if (resetCooldownSeconds > 0) {
      Alert.alert(
        "Please Wait",
        `You can request another reset email in ${formatCooldown(
          resetCooldownSeconds
        )}.`
      );
      return;
    }

    if (!cleanedEmail) {
      Alert.alert(
        "Email Required",
        "Enter your email address first before using forgot password."
      );
      return;
    }

    try {
      setLoading(true);

      const redirectTo = Linking.createURL("reset-password");

      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanedEmail,
        {
          redirectTo,
        }
      );

      if (error) {
        if (isEmailRateLimitError(error)) {
          await startResetCooldown();

          Alert.alert(
            "Too Many Reset Requests",
            "Supabase blocked more reset emails for now. Please wait a few minutes before trying again."
          );
          return;
        }

        Alert.alert("Reset Failed", error.message);
        return;
      }

      await startResetCooldown();

      Alert.alert(
        "Reset Email Sent",
        "Please check your email, open the reset link, then create your new password."
      );
    } catch (error) {
      Alert.alert(
        "Reset Failed",
        error?.message || "Unable to send password reset email."
      );
    } finally {
      setLoading(false);
    }
  };
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
            <View style={styles.logoWrapper}>
              <Image
                source={require("../../assets/images/SchedWise.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome to SchedWise</Text>
            <Text style={styles.subtitle}>
              Sign in to your academic workspace
            </Text>

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputBox}>
              <Feather
                name="mail"
                size={18}
                color={theme.inputIcon}
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="you@university.edu"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={[styles.label, styles.passwordLabel]}>PASSWORD</Text>
            <View style={styles.inputBox}>
              <Feather
                name="lock"
                size={18}
                color={theme.inputIcon}
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Enter your password"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={theme.inputIcon}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotButton}
              activeOpacity={0.7}
              onPress={handleForgotPassword}
              disabled={loading || resetCooldownSeconds > 0}
            >
              <Text style={styles.forgotText}>
                {resetCooldownSeconds > 0
                  ? `Try again in ${formatCooldown(resetCooldownSeconds)}`
                  : "Forgot password?"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSignIn}
              disabled={loading}
            >
              <LinearGradient
                colors={theme.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.signInButton, loading && styles.disabledButton]}
              >
                <Text style={styles.signInText}>
                  {loading ? "Signing In..." : "Sign In"}
                </Text>

                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                    style={styles.signInIcon}
                  />
                ) : (
                  <Feather
                    name="arrow-right"
                    size={19}
                    color="#ffffff"
                    style={styles.signInIcon}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  clearInputs();
                  router.replace("/signup");
                }}
                disabled={loading}
              >
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.termsText}>
            By signing in you agree to our{" "}
            <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
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
      paddingBottom: 28,
    },

    header: {
      minHeight: 330,
      paddingHorizontal: 18,
      paddingTop: TOP_SAFE_SPACE,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },

    logoWrapper: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: -10,
    },

    logoImage: {
      width: 285,
      height: 285,
    },

    card: {
      marginHorizontal: 18,
      marginTop: -28,
      backgroundColor: theme.card,
      borderRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 23,
      paddingBottom: 23,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: theme.mode === "dark" ? 0.25 : 0.14,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7,
    },

    title: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
    },

    subtitle: {
      color: theme.softText,
      fontSize: 15,
      marginTop: 7,
      marginBottom: 25,
    },

    label: {
      color: theme.mutedText,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginBottom: 9,
    },

    passwordLabel: {
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

    inputIcon: {
      marginRight: 11,
    },

    input: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
    },

    forgotButton: {
      alignSelf: "flex-end",
      marginTop: 10,
      minHeight: 22,
      justifyContent: "center",
    },

    forgotText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "600",
    },

    signInButton: {
      height: 54,
      borderRadius: 15,
      marginTop: 22,
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
      opacity: 0.7,
    },

    signInText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "900",
    },

    signInIcon: {
      marginLeft: 8,
    },

    signupRow: {
      marginTop: 22,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },

    signupText: {
      color: theme.softText,
      fontSize: 13,
    },

    signupLink: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "900",
    },

    termsText: {
      marginTop: 21,
      marginHorizontal: 28,
      textAlign: "center",
      color: theme.mutedText,
      fontSize: 11.5,
      lineHeight: 18,
    },

    termsLink: {
      color: theme.primary,
      fontWeight: "700",
    },
  });