import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import {
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

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const shortMonthNames = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const schedules = [
  {
    id: 1,
    date: "2026-06-12",
    time: "11:59 PM",
    title: "Research Proposal Deadline",
    subject: "Capstone Project",
    location: "Online Submission",
    priority: "High",
    description: "Submit final research proposal.",
  },
  {
    id: 2,
    date: "2026-06-13",
    time: "2:00 PM",
    title: "Group Study Session",
    subject: "Data Structures",
    location: "Library Room 2",
    priority: "Normal",
    description: "Meet classmates for review.",
  },
  {
    id: 3,
    date: "2026-06-15",
    time: "9:00 AM",
    title: "Final Exam Review",
    subject: "Exam Review",
    location: "Self Study",
    priority: "Normal",
    description: "Review major subjects.",
  },
  {
    id: 4,
    date: "2026-06-20",
    time: "8:00 AM",
    title: "Math Quiz",
    subject: "Mathematics",
    location: "Room 204",
    priority: "Normal",
    description: "Review algebra and problem solving.",
  },
];

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function createDateKey(year, monthIndex, day) {
  return `${year}-${padNumber(monthIndex + 1)}-${padNumber(day)}`;
}

function getTodayKey() {
  const today = new Date();

  return createDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
}

function getReadableDate(dateKey) {
  const parts = dateKey.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) return "Selected Date";

  return `${shortMonthNames[month - 1]} ${day}, ${year}`;
}

function getCalendarCells(year, monthIndex) {
  const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const previousMonthDays = new Date(year, monthIndex, 0).getDate();

  const cells = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({
      id: `prev-${i}`,
      day: previousMonthDays - i,
      isCurrentMonth: false,
      dateKey: null,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      id: `current-${day}`,
      day,
      isCurrentMonth: true,
      dateKey: createDateKey(year, monthIndex, day),
    });
  }

  const remainingCells = 42 - cells.length;

  for (let day = 1; day <= remainingCells; day++) {
    cells.push({
      id: `next-${day}`,
      day,
      isCurrentMonth: false,
      dateKey: null,
    });
  }

  return cells;
}

export default function CalendarScreen() {
  const today = new Date();
  const todayKey = getTodayKey();

  const [visibleMonth, setVisibleMonth] = useState(new Date(2026, 5, 1));
  const [selectedDate, setSelectedDate] = useState("2026-06-12");

  const currentYear = visibleMonth.getFullYear();
  const currentMonthIndex = visibleMonth.getMonth();

  const calendarCells = useMemo(
    () => getCalendarCells(currentYear, currentMonthIndex),
    [currentYear, currentMonthIndex]
  );

  const schedulesByDate = useMemo(() => {
    return schedules.reduce((accumulator, schedule) => {
      if (!accumulator[schedule.date]) {
        accumulator[schedule.date] = [];
      }

      accumulator[schedule.date].push(schedule);
      return accumulator;
    }, {});
  }, []);

  const selectedSchedules = schedulesByDate[selectedDate] || [];

  const totalSchedulesThisMonth = schedules.filter((schedule) => {
    const parts = schedule.date.split("-");
    const scheduleYear = Number(parts[0]);
    const scheduleMonth = Number(parts[1]) - 1;

    return scheduleYear === currentYear && scheduleMonth === currentMonthIndex;
  }).length;

  const highPriorityThisMonth = schedules.filter((schedule) => {
    const parts = schedule.date.split("-");
    const scheduleYear = Number(parts[0]);
    const scheduleMonth = Number(parts[1]) - 1;

    return (
      scheduleYear === currentYear &&
      scheduleMonth === currentMonthIndex &&
      schedule.priority === "High"
    );
  }).length;

  const handlePreviousMonth = () => {
    const previousMonth = new Date(currentYear, currentMonthIndex - 1, 1);
    setVisibleMonth(previousMonth);
    setSelectedDate(
      createDateKey(
        previousMonth.getFullYear(),
        previousMonth.getMonth(),
        1
      )
    );
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentYear, currentMonthIndex + 1, 1);
    setVisibleMonth(nextMonth);
    setSelectedDate(
      createDateKey(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
    );
  };

  const handleGoToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
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
            <View style={styles.headerTextArea}>
              <Text style={styles.headerLabel}>Calendar</Text>
              <Text style={styles.headerTitle}>
                {monthNames[currentMonthIndex]} {currentYear}
              </Text>
              <Text style={styles.headerSubtitle}>
                View your academic schedule by month.
              </Text>
            </View>

            <View style={styles.calendarIcon}>
              <Feather name="calendar" size={28} color="#ffffff" />
            </View>
          </View>

          <View style={styles.headerSummaryCard}>
            <View style={styles.headerSummaryItem}>
              <Text style={styles.headerSummaryNumber}>
                {totalSchedulesThisMonth}
              </Text>
              <Text style={styles.headerSummaryLabel}>Schedules</Text>
            </View>

            <View style={styles.headerSummaryDivider} />

            <View style={styles.headerSummaryItem}>
              <Text style={styles.headerSummaryNumber}>
                {highPriorityThisMonth}
              </Text>
              <Text style={styles.headerSummaryLabel}>High Priority</Text>
            </View>

            <View style={styles.headerSummaryDivider} />

            <View style={styles.headerSummaryItem}>
              <Text style={styles.headerSummaryNumber}>
                {selectedSchedules.length}
              </Text>
              <Text style={styles.headerSummaryLabel}>Selected</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity
              style={styles.monthButton}
              activeOpacity={0.8}
              onPress={handlePreviousMonth}
            >
              <Feather name="chevron-left" size={22} color="#8ea2c1" />
            </TouchableOpacity>

            <View style={styles.monthTextArea}>
              <Text style={styles.monthTitle}>
                {monthNames[currentMonthIndex]}
              </Text>
              <Text style={styles.monthSubtitle}>{currentYear}</Text>
            </View>

            <TouchableOpacity
              style={styles.monthButton}
              activeOpacity={0.8}
              onPress={handleNextMonth}
            >
              <Feather name="chevron-right" size={22} color="#8ea2c1" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.todayButton}
            activeOpacity={0.85}
            onPress={handleGoToday}
          >
            <Feather name="navigation" size={16} color="#ffffff" />
            <Text style={styles.todayButtonText}>Go to Today</Text>
          </TouchableOpacity>

          <View style={styles.weekRow}>
            {weekDays.map((item) => (
              <Text key={item} style={styles.weekText}>
                {item}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarCells.map((item) => {
              const daySchedules = item.dateKey
                ? schedulesByDate[item.dateKey] || []
                : [];

              const hasHighPriority = daySchedules.some(
                (schedule) => schedule.priority === "High"
              );

              const isSelected = item.dateKey === selectedDate;
              const isToday = item.dateKey === todayKey;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={item.isCurrentMonth ? 0.8 : 1}
                  disabled={!item.isCurrentMonth}
                  onPress={() => {
                    if (item.dateKey) {
                      setSelectedDate(item.dateKey);
                    }
                  }}
                  style={[
                    styles.dayBox,
                    !item.isCurrentMonth && styles.otherMonthDayBox,
                    isToday && styles.todayBox,
                    isSelected && styles.selectedDayBox,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !item.isCurrentMonth && styles.otherMonthDayText,
                      isToday && styles.todayNumber,
                      isSelected && styles.selectedDayNumber,
                    ]}
                  >
                    {item.day}
                  </Text>

                  {item.isCurrentMonth && daySchedules.length > 0 ? (
                    <View style={styles.dotsRow}>
                      <View
                        style={[
                          styles.eventDot,
                          hasHighPriority ? styles.highDot : styles.normalDot,
                        ]}
                      />

                      {daySchedules.length > 1 ? (
                        <Text
                          style={[
                            styles.eventCount,
                            isSelected && styles.selectedEventCount,
                          ]}
                        >
                          {daySchedules.length}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.selectedDateSection}>
          <View style={styles.selectedDateHeader}>
            <View>
              <Text style={styles.selectedDateLabel}>Selected Date</Text>
              <Text style={styles.selectedDateTitle}>
                {getReadableDate(selectedDate)}
              </Text>
            </View>

            <View style={styles.selectedDateBadge}>
              <Text style={styles.selectedDateBadgeText}>
                {selectedSchedules.length} item
                {selectedSchedules.length === 1 ? "" : "s"}
              </Text>
            </View>
          </View>

          {selectedSchedules.length > 0 ? (
            selectedSchedules.map((item) => (
              <View key={item.id} style={styles.scheduleCard}>
                <View
                  style={[
                    styles.scheduleLine,
                    item.priority === "High"
                      ? styles.highLine
                      : styles.normalLine,
                  ]}
                />

                <View style={styles.scheduleIconBox}>
                  <Feather
                    name={item.priority === "High" ? "alert-circle" : "book"}
                    size={22}
                    color={item.priority === "High" ? "#ff4d5f" : "#65a1ff"}
                  />
                </View>

                <View style={styles.scheduleContent}>
                  <View style={styles.scheduleTop}>
                    <Text style={styles.scheduleTitle}>{item.title}</Text>

                    <View
                      style={
                        item.priority === "High"
                          ? styles.highPriorityBadge
                          : styles.normalPriorityBadge
                      }
                    >
                      <Text
                        style={
                          item.priority === "High"
                            ? styles.highPriorityText
                            : styles.normalPriorityText
                        }
                      >
                        {item.priority}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.scheduleSubject}>{item.subject}</Text>

                  <View style={styles.scheduleInfoRow}>
                    <Feather name="clock" size={14} color="#8ea2c1" />
                    <Text style={styles.scheduleInfoText}>{item.time}</Text>
                  </View>

                  <View style={styles.scheduleInfoRow}>
                    <Feather name="map-pin" size={14} color="#8ea2c1" />
                    <Text style={styles.scheduleInfoText}>
                      {item.location}
                    </Text>
                  </View>

                  <Text style={styles.scheduleDescription}>
                    {item.description}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyScheduleCard}>
              <View style={styles.emptyIcon}>
                <Feather name="calendar" size={26} color="#65a1ff" />
              </View>

              <Text style={styles.emptyTitle}>No schedule for this date</Text>
              <Text style={styles.emptyText}>
                Select another marked date or add schedules from the Home tab.
              </Text>
            </View>
          )}
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
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTextArea: {
    flex: 1,
    paddingRight: 14,
  },

  headerLabel: {
    color: "#8ea2c1",
    fontSize: 14,
    fontWeight: "700",
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
  },

  headerSubtitle: {
    color: "#91a5c6",
    fontSize: 13,
    marginTop: 7,
    lineHeight: 19,
  },

  calendarIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
  },

  headerSummaryCard: {
    marginTop: 24,
    backgroundColor: "rgba(101,161,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(101,161,255,0.25)",
    borderRadius: 22,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  headerSummaryItem: {
    flex: 1,
    alignItems: "center",
  },

  headerSummaryNumber: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },

  headerSummaryLabel: {
    color: "#8ea2c1",
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 4,
  },

  headerSummaryDivider: {
    width: 1,
    height: 35,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  calendarCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#0d1529",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#1b2944",
    padding: 16,
  },

  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  monthButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#121c32",
    alignItems: "center",
    justifyContent: "center",
  },

  monthTextArea: {
    alignItems: "center",
  },

  monthTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },

  monthSubtitle: {
    color: "#8ea2c1",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  todayButton: {
    height: 44,
    borderRadius: 15,
    backgroundColor: "#4f7df3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  todayButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 7,
  },

  weekRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  weekText: {
    flex: 1,
    color: "#65a1ff",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },

  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  dayBox: {
    width: `${100 / 7}%`,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderRadius: 16,
  },

  otherMonthDayBox: {
    opacity: 0.3,
  },

  todayBox: {
    borderWidth: 1,
    borderColor: "#65a1ff",
  },

  selectedDayBox: {
    backgroundColor: "#4f7df3",
    borderColor: "#65a1ff",
  },

  dayNumber: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  otherMonthDayText: {
    color: "#6f819f",
  },

  todayNumber: {
    color: "#ffffff",
  },

  selectedDayNumber: {
    color: "#ffffff",
    fontWeight: "900",
  },

  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
  },

  eventCount: {
    color: "#8ea2c1",
    fontSize: 9,
    fontWeight: "900",
    marginLeft: 3,
  },

  selectedEventCount: {
    color: "#ffffff",
  },

  highDot: {
    backgroundColor: "#ff4d5f",
  },

  normalDot: {
    backgroundColor: "#22c55e",
  },

  selectedDateSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },

  selectedDateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  selectedDateLabel: {
    color: "#8ea2c1",
    fontSize: 13,
    fontWeight: "700",
  },

  selectedDateTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 4,
  },

  selectedDateBadge: {
    backgroundColor: "rgba(101,161,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(101,161,255,0.25)",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 13,
  },

  selectedDateBadgeText: {
    color: "#65a1ff",
    fontSize: 12,
    fontWeight: "900",
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

  scheduleLine: {
    width: 5,
    borderRadius: 10,
    marginRight: 13,
  },

  highLine: {
    backgroundColor: "#ff4d5f",
  },

  normalLine: {
    backgroundColor: "#22c55e",
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

  highPriorityBadge: {
    backgroundColor: "rgba(255,77,95,0.15)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
  },

  normalPriorityBadge: {
    backgroundColor: "rgba(34,197,94,0.15)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
  },

  highPriorityText: {
    color: "#ff4d5f",
    fontSize: 10,
    fontWeight: "900",
  },

  normalPriorityText: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: "900",
  },

  scheduleSubject: {
    color: "#65a1ff",
    fontSize: 12.5,
    fontWeight: "700",
    marginTop: 5,
    marginBottom: 8,
  },

  scheduleInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  scheduleInfoText: {
    color: "#8ea2c1",
    fontSize: 12,
    marginLeft: 7,
  },

  scheduleDescription: {
    color: "#6f819f",
    fontSize: 11.5,
    marginTop: 7,
    lineHeight: 16,
  },

  emptyScheduleCard: {
    backgroundColor: "#0d1529",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1b2944",
    padding: 24,
    alignItems: "center",
  },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#121c32",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  emptyText: {
    color: "#8ea2c1",
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },

  bottomSpace: {
    height: 10,
  },
});