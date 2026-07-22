import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
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
  backButton: "rgba(255,255,255,0.08)",
  backButtonBorder: "rgba(255,255,255,0.08)",
  backIcon: "#d7e4ff",
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
  card: "#ffffff",
  input: "#eef4ff",
  border: "#d9e4f2",
  inputBorder: "#ccd8ea",
  backButton: "rgba(79,125,243,0.10)",
  backButtonBorder: "rgba(79,125,243,0.18)",
  backIcon: "#3f76e8",
  shadow: "#9ab8ff",
};

export default function SignupScreen() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");

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

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }, [loadThemeMode])
  );

  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

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

  const clearInputs = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleCreateAccount = async () => {
    const cleanedName = fullName.trim();
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedName || !cleanedEmail || !password || !confirmPassword) {
      Alert.alert("Missing Information", "Please complete all fields.");
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

    setLoading(true);

    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: cleanedEmail,
      password,
      options: {
        data: {
          full_name: cleanedName,
        },
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert("Sign Up Failed", error.message);
      return;
    }

    clearInputs();

    if (!session) {
      Alert.alert(
        "Check Your Email",
        "Your account was created, but Supabase email confirmation is enabled. Please verify your email first before signing in."
      );

      router.replace("/signin");
      return;
    }

    Alert.alert("Account Created", "Welcome to SchedWise!");
    router.replace("/");
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
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.75}
              onPress={() => {
                clearInputs();
                router.replace("/signin");
              }}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={22} color={theme.backIcon} />
            </TouchableOpacity>

            <View style={styles.logoWrapper}>
              <Image
                source={require("../../assets/images/SchedWise.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Start organizing your academic schedule with SchedWise
            </Text>

            <Text style={styles.label}>FULL NAME</Text>
            <View style={styles.inputBox}>
              <Feather
                name="user"
                size={18}
                color={theme.inputIcon}
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Enter your full name"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
              />
            </View>

            <Text style={[styles.label, styles.fieldSpacing]}>
              EMAIL ADDRESS
            </Text>
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

            <Text style={[styles.label, styles.fieldSpacing]}>PASSWORD</Text>
            <View style={styles.inputBox}>
              <Feather
                name="lock"
                size={18}
                color={theme.inputIcon}
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Create a password"
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

            <Text style={[styles.label, styles.fieldSpacing]}>
              CONFIRM PASSWORD
            </Text>
            <View style={styles.inputBox}>
              <Feather
                name="shield"
                size={18}
                color={theme.inputIcon}
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Confirm your password"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                activeOpacity={0.7}
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
              onPress={handleCreateAccount}
              disabled={loading}
            >
              <LinearGradient
                colors={theme.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.createButton, loading && styles.disabledButton]}
              >
                <Text style={styles.createButtonText}>
                  {loading ? "Creating..." : "Create Account"}
                </Text>

                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                    style={styles.createIcon}
                  />
                ) : (
                  <Feather
                    name="arrow-right"
                    size={19}
                    color="#ffffff"
                    style={styles.createIcon}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signinRow}>
              <Text style={styles.signinText}>Already have an account? </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  clearInputs();
                  router.replace("/signin");
                }}
                disabled={loading}
              >
                <Text style={styles.signinLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.termsText}>
            By creating an account, you agree to our{" "}
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
      minHeight: 300,
      paddingHorizontal: 18,
      paddingTop: TOP_SAFE_SPACE,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },

    backButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.backButton,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.backButtonBorder,
    },

    logoWrapper: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: -18,
    },

    logoImage: {
      width: 270,
      height: 270,
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
      lineHeight: 21,
    },

    label: {
      color: theme.mutedText,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginBottom: 9,
    },

    fieldSpacing: {
      marginTop: 16,
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

    createButton: {
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
      opacity: 0.7,
    },

    createButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "900",
    },

    createIcon: {
      marginLeft: 8,
    },

    signinRow: {
      marginTop: 22,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },

    signinText: {
      color: theme.softText,
      fontSize: 13,
    },

    signinLink: {
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