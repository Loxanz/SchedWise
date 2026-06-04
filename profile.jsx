import { useRouter } from "expo-router";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileScreen() {
  const router = useRouter();

  const handleSignOut = () => {
    router.replace({
      pathname: "/signin",
      params: { logout: "true" },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>
          Manage your account and app preferences.
        </Text>

        <TouchableOpacity
          style={styles.signOutButton}
          activeOpacity={0.85}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081225",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  card: {
    width: "100%",
    backgroundColor: "#0d1529",
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: "#1b2944",
    alignItems: "center",
  },

  title: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },

  subtitle: {
    color: "#8ea2c1",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  signOutButton: {
    width: "100%",
    height: 52,
    borderRadius: 15,
    backgroundColor: "#ff4d5f",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  signOutText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
});