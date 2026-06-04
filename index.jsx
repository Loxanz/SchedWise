import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

export default function HomeDashboard() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#081225"
        translucent={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#081225", "#0d2342", "#081225"]}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Good day</Text>
              <Text style={styles.username}>Welcome to SchedWise</Text>
            </View>

            <View style={styles.logoCircle}>
              <Image
                source={require("../../assets/images/SchedWise.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Today’s Focus</Text>
              <Text style={styles.summaryTitle}>3 academic tasks due</Text>
              <Text style={styles.summarySub}>
                Stay organized and sync your schedule.
              </Text>
            </View>

            <View style={styles.summaryIcon}>
              <Feather name="check-circle" size={28} color="#ffffff" />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.8}
              onPress={() => router.push("/calendar")}
            >
              <View style={[styles.quickIcon, styles.blueIcon]}>
                <Feather name="plus-circle" size={24} color="#ffffff" />
              </View>
              <Text style={styles.quickTitle}>Add Schedule</Text>
              <Text style={styles.quickSub}>Tasks, deadlines, activities</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.8}
              onPress={() => router.push("/calendar")}
            >
              <View style={[styles.quickIcon, styles.greenIcon]}>
                <Feather name="upload-cloud" size={24} color="#ffffff" />
              </View>
              <Text style={styles.quickTitle}>Upload File</Text>
              <Text style={styles.quickSub}>Import schedule data fast</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.8}
              onPress={() => router.push("/chatbot")}
            >
              <View style={[styles.quickIcon, styles.purpleIcon]}>
                <MaterialCommunityIcons
                  name="robot-outline"
                  size={25}
                  color="#ffffff"
                />
              </View>
              <Text style={styles.quickTitle}>Ask AI</Text>
              <Text style={styles.quickSub}>Manage schedule by chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.8}
              onPress={() => router.push("/flashcards")}
            >
              <View style={[styles.quickIcon, styles.orangeIcon]}>
                <Ionicons name="albums-outline" size={24} color="#ffffff" />
              </View>
              <Text style={styles.quickTitle}>Flashcards</Text>
              <Text style={styles.quickSub}>Generate study reviewers</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
            <TouchableOpacity onPress={() => router.push("/calendar")}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.scheduleCard}>
            <View style={styles.dateBox}>
              <Text style={styles.dateDay}>12</Text>
              <Text style={styles.dateMonth}>JUN</Text>
            </View>

            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleTitle}>
                Research Proposal Deadline
              </Text>
              <Text style={styles.scheduleTime}>Today • 11:59 PM</Text>
            </View>

            <View style={styles.priorityBadge}>
              <Text style={styles.priorityText}>High</Text>
            </View>
          </View>

          <View style={styles.scheduleCard}>
            <View style={styles.dateBox}>
              <Text style={styles.dateDay}>13</Text>
              <Text style={styles.dateMonth}>JUN</Text>
            </View>

            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleTitle}>Group Study Session</Text>
              <Text style={styles.scheduleTime}>Tomorrow • 2:00 PM</Text>
            </View>

            <View style={styles.normalBadge}>
              <Text style={styles.normalText}>Normal</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SchedWise Features</Text>

          <TouchableOpacity
            style={styles.featureCard}
            activeOpacity={0.8}
            onPress={() => router.push("/calendar")}
          >
            <View style={styles.featureIconBox}>
              <Feather name="calendar" size={24} color="#65a1ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Schedule Sync</Text>
              <Text style={styles.featureText}>
                Add schedules, deadlines, academic tasks, and sync them with
                Google Calendar.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureCard}
            activeOpacity={0.8}
            onPress={() => router.push("/chatbot")}
          >
            <View style={styles.featureIconBox}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={25}
                color="#65a1ff"
              />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>AI Chatbot Assistant</Text>
              <Text style={styles.featureText}>
                Create, edit, check deadlines, detect conflicts, and monitor
                task progress using AI.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureCard}
            activeOpacity={0.8}
            onPress={() => router.push("/flashcards")}
          >
            <View style={styles.featureIconBox}>
              <Ionicons name="albums-outline" size={24} color="#65a1ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Flashcard Generator</Text>
              <Text style={styles.featureText}>
                Upload notes, documents, or PowerPoint files and generate
                digital flashcards for review.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081225",
  },

  scrollContent: {
    paddingBottom: 110,
  },

  header: {
    paddingTop: TOP_SAFE_SPACE + 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  greeting: {
    color: "#8ea2c1",
    fontSize: 14,
    fontWeight: "600",
  },

  username: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
  },

  logoCircle: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  logoImage: {
    width: 52,
    height: 52,
  },

  summaryCard: {
    marginTop: 26,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "rgba(101,161,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(101,161,255,0.25)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  summaryLabel: {
    color: "#8ea2c1",
    fontSize: 13,
    fontWeight: "700",
  },

  summaryTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
  },

  summarySub: {
    color: "#91a5c6",
    fontSize: 13,
    marginTop: 6,
  },

  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
  },

  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 14,
  },

  viewAll: {
    color: "#65a1ff",
    fontSize: 13,
    fontWeight: "800",
  },

  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },

  quickCard: {
    width: "48%",
    backgroundColor: "#0d1529",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1b2944",
  },

  quickIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  blueIcon: {
    backgroundColor: "#4f7df3",
  },

  greenIcon: {
    backgroundColor: "#22c55e",
  },

  purpleIcon: {
    backgroundColor: "#8b5cf6",
  },

  orangeIcon: {
    backgroundColor: "#f59e0b",
  },

  quickTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  quickSub: {
    color: "#8ea2c1",
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },

  scheduleCard: {
    backgroundColor: "#0d1529",
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: "#1b2944",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  dateBox: {
    width: 54,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#121c32",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  dateDay: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },

  dateMonth: {
    color: "#65a1ff",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },

  scheduleInfo: {
    flex: 1,
  },

  scheduleTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  scheduleTime: {
    color: "#8ea2c1",
    fontSize: 12,
    marginTop: 5,
  },

  priorityBadge: {
    backgroundColor: "rgba(255,77,95,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },

  priorityText: {
    color: "#ff4d5f",
    fontSize: 11,
    fontWeight: "900",
  },

  normalBadge: {
    backgroundColor: "rgba(34,197,94,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },

  normalText: {
    color: "#22c55e",
    fontSize: 11,
    fontWeight: "900",
  },

  featureCard: {
    backgroundColor: "#0d1529",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1b2944",
    flexDirection: "row",
    marginBottom: 12,
  },

  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#121c32",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  featureContent: {
    flex: 1,
  },

  featureTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  featureText: {
    color: "#8ea2c1",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 5,
  },

  bottomSpace: {
    height: 10,
  },
});