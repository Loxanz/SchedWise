import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
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

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

export default function Signin() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#081225"
        translucent={false}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={["#081225", "#0d2342", "#081225"]}
            style={styles.header}
          >
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
                color="#8fa3c7"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="you@university.edu"
                placeholderTextColor="#7384a3"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={[styles.label, styles.passwordLabel]}>PASSWORD</Text>
            <View style={styles.inputBox}>
              <Feather
                name="lock"
                size={18}
                color="#8fa3c7"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor="#7384a3"
                style={styles.input}
                secureTextEntry={!showPassword}
              />

              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color="#8fa3c7"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotButton} activeOpacity={0.7}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.replace({
                  pathname: "/",
                  params: { auth: "true" },
                })
              }
            >
              <LinearGradient
                colors={["#4f7df3", "#5f8fff", "#78b7ff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInButton}
              >
                <Text style={styles.signInText}>Sign In</Text>
                <Feather
                  name="arrow-right"
                  size={19}
                  color="#ffffff"
                  style={styles.signInIcon}
                />
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity style={styles.googleButton} activeOpacity={0.8}>
              <FontAwesome name="google" size={20} color="#ff4d5f" />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/signup")}
              >
                <Text style={styles.signupLink}>Sign up free</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081225",
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
    backgroundColor: "#0d1529",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 23,
    paddingBottom: 23,
    borderWidth: 1,
    borderColor: "#1b2944",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },

  title: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
  },

  subtitle: {
    color: "#91a5c6",
    fontSize: 15,
    marginTop: 7,
    marginBottom: 25,
  },

  label: {
    color: "#8ea2c1",
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
    backgroundColor: "#121c32",
    borderWidth: 1,
    borderColor: "#21304c",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  inputIcon: {
    marginRight: 11,
  },

  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 10,
  },

  forgotText: {
    color: "#65a1ff",
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

  signInText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  signInIcon: {
    marginLeft: 8,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#263552",
  },

  dividerText: {
    color: "#8ea2c1",
    fontSize: 13,
    marginHorizontal: 12,
  },

  googleButton: {
    height: 51,
    borderRadius: 15,
    backgroundColor: "#121c32",
    borderWidth: 1,
    borderColor: "#233350",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  googleText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 12,
  },

  signupRow: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  signupText: {
    color: "#91a5c6",
    fontSize: 13,
  },

  signupLink: {
    color: "#65a1ff",
    fontSize: 13,
    fontWeight: "900",
  },

  termsText: {
    marginTop: 21,
    marginHorizontal: 28,
    textAlign: "center",
    color: "#8ea2c1",
    fontSize: 11.5,
    lineHeight: 18,
  },

  termsLink: {
    color: "#65a1ff",
    fontWeight: "700",
  },
});