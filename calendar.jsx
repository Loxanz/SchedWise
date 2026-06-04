import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Alert,
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

const days = [
  { day: "Mon", date: "10", active: false },
  { day: "Tue", date: "11", active: false },
  { day: "Wed", date: "12", active: true },
  { day: "Thu", date: "13", active: false },
  { day: "Fri", date: "14", active: false },
  { day: "Sat", date: "15", active: false },
];

const schedules = [
  {
    id: 1,
    title: "Research Proposal Deadline",
    subject: "Capstone Project",
    time: "9:00 AM - 11:59 PM",
    location: "Online Submission",
    priority: "High",
    color: "#ff4d5f",
    icon: "file-text",
  },
  {
    id: 2,
    title: "Group Study Session",
    subject: "Data Structures",
    time: "2:00 PM - 4:00 PM",
    location: "Library Room 2",
    priority: "Normal",
    color: "#22c55e",
    icon: "users",
  },
  {
    id: 3,
    title: "Quiz Review",
    subject: "Human Computer Interaction",
    time: "6:00 PM - 7:30 PM",
    location: "Self Study",
    priority: "Medium",
    color: "#f59e0b",
    icon: "book-open",
  },
];

export default function CalendarScreen() {
  const handleAddSchedule = () => {
    Alert.alert("Add Schedule", "You can connect this button to your add schedule form later.");
  };

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
              <Text style={styles.headerLabel}>My Calendar</Text>
              <Text style={styles.headerTitle}>Schedule Planner</Text>
              <Text style={styles.headerSubtitle}>
                Manage your classes, deadlines, and academic tasks.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={handleAddSchedule}
            >
              <Feather name="plus" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.overviewCard}>
            <View style={styles.overviewIcon}>
              <Feather name="calendar" size={28} color="#ffffff" />
            </View>

            <View style={styles.overviewContent}>
              <Text style={styles.overviewTitle}>Today</Text>
              <Text style={styles.overviewText}>3 schedules • 1 high priority</Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>June</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.viewText}>View Month</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysRow}
          >
            {days.map((item) => (
              <TouchableOpacity
                key={item.date}
                activeOpacity={0.8}
                style={[styles.dayCard, item.active && styles.activeDayCard]}
              >
                <Text style={[styles.dayText, item.active && styles.activeDayText]}>
                  {item.day}
                </Text>
                <Text style={[styles.dateText, item.active && styles.activeDateText]}>
                  {item.date}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today’s Schedule</Text>

          {schedules.map((item) => (
            <View key={item.id} style={styles.scheduleCard}>
              <View style={[styles.timeLine, { backgroundColor: item.color }]} />

              <View style={styles.scheduleIconBox}>
                <Feather name={item.icon} size={22} color="#65a1ff" />
              </View>

              <View style={styles.scheduleContent}>
                <View style={styles.scheduleTop}>
                  <Text style={styles.scheduleTitle}>{item.title}</Text>

                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: `${item.color}22` },
                    ]}
                  >
                    <Text style={[styles.priorityText, { color: item.color }]}>
                      {item.priority}
                    </Text>
                  </View>
                </View>

                <Text style={styles.subjectText}>{item.subject}</Text>

                <View style={styles.infoRow}>
                  <Feather name="clock" size={14} color="#8ea2c1" />
                  <Text style={styles.infoText}>{item.time}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Feather name="map-pin" size={14} color="#8ea2c1" />
                  <Text style={styles.infoText}>{item.location}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calendar Tools</Text>

          <View style={styles.toolsGrid}>
            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <View style={styles.toolIconBlue}>
                <Ionicons name="notifications-outline" size={23} color="#ffffff" />
              </View>
              <Text style={styles.toolTitle}>Reminders</Text>
              <Text style={styles.toolSub}>Set alerts for deadlines</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <View style={styles.toolIconPurple}>
                <MaterialCommunityIcons
                  name="google"
                  size={23}
                  color="#ffffff"
                />
              </View>
              <Text style={styles.toolTitle}>Sync</Text>
              <Text style={styles.toolSub}>Connect Google Calendar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule Summary</Text>

          <View style={styles.summaryBox}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>3</Text>
              <Text style={styles.summaryLabel}>Today</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>8</Text>
              <Text style={styles.summaryLabel}>This Week</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>1</Text>
              <Text style={styles.summaryLabel}>Urgent</Text>
            </View>
          </View>
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
    paddingBottom: 115,
  },

  header: {
    paddingTop: TOP_SAFE_SPACE + 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  headerLabel: {
    color: "#8ea2c1",
    fontSize: 14,
    fontWeight: "700",
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 5,
  },

  headerSubtitle: {
    color: "#91a5c6",
    fontSize: 13,
    marginTop: 7,
    lineHeight: 19,
    width: 250,
  },

  addButton: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5f8fff",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },

  overviewCard: {
    marginTop: 26,
    backgroundColor: "rgba(101,161,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(101,161,255,0.25)",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  overviewIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  overviewContent: {
    flex: 1,
  },

  overviewTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  overviewText: {
    color: "#91a5c6",
    fontSize: 13,
    marginTop: 5,
  },

  badge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 13,
  },

  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
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

  viewText: {
    color: "#65a1ff",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 14,
  },

  daysRow: {
    paddingRight: 20,
  },

  dayCard: {
    width: 66,
    height: 86,
    borderRadius: 22,
    backgroundColor: "#0d1529",
    borderWidth: 1,
    borderColor: "#1b2944",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  activeDayCard: {
    backgroundColor: "#4f7df3",
    borderColor: "#65a1ff",
  },

  dayText: {
    color: "#8ea2c1",
    fontSize: 13,
    fontWeight: "700",
  },

  activeDayText: {
    color: "#ffffff",
  },

  dateText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 7,
  },

  activeDateText: {
    color: "#ffffff",
  },

  scheduleCard: {
    backgroundColor: "#0d1529",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1b2944",
    padding: 15,
    flexDirection: "row",
    marginBottom: 13,
    overflow: "hidden",
  },

  timeLine: {
    width: 5,
    borderRadius: 10,
    marginRight: 13,
  },

  scheduleIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#121c32",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  scheduleContent: {
    flex: 1,
  },

  scheduleTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  scheduleTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    flex: 1,
    paddingRight: 8,
  },

  priorityBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
  },

  priorityText: {
    fontSize: 10,
    fontWeight: "900",
  },

  subjectText: {
    color: "#65a1ff",
    fontSize: 12.5,
    fontWeight: "700",
    marginTop: 5,
    marginBottom: 8,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  infoText: {
    color: "#8ea2c1",
    fontSize: 12,
    marginLeft: 7,
  },

  toolsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  toolCard: {
    width: "48%",
    backgroundColor: "#0d1529",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1b2944",
    padding: 16,
  },

  toolIconBlue: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  toolIconPurple: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  toolTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  toolSub: {
    color: "#8ea2c1",
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },

  summaryBox: {
    backgroundColor: "#0d1529",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1b2944",
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  summaryItem: {
    alignItems: "center",
    flex: 1,
  },

  summaryNumber: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },

  summaryLabel: {
    color: "#8ea2c1",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },

  summaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#1b2944",
  },

  bottomSpace: {
    height: 10,
  },
});