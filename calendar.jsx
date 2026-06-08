import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DeviceEventEmitter,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getLocalSchedules,
  mergeRemoteSchedulesWithLocal,
} from "../lib/localSchedules";
import { getCurrentUser, getUserSchedules } from "../lib/supabase";

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

const THEME_STORAGE_KEY = "schedwise_app_theme_mode";
const THEME_CHANGE_EVENT = "schedwise_theme_changed";
const SCHEDULE_CHANGE_EVENT = "schedwise_schedules_changed";

const DARK_THEME = {
  mode: "dark",
  background: "#081225",
  statusBarStyle: "light-content",
  headerGradient: ["#081225", "#0d2342", "#081225"],
  text: "#ffffff",
  onPrimary: "#ffffff",
  mutedText: "#8ea2c1",
  softText: "#91a5c6",
  placeholderText: "#6f819f",
  primary: "#4f7df3",
  primaryLight: "#65a1ff",
  card: "#0d1529",
  surface: "#121c32",
  border: "#1b2944",
  summaryBackground: "rgba(101,161,255,0.13)",
  summaryBorder: "rgba(101,161,255,0.25)",
  summaryDivider: "rgba(255,255,255,0.12)",
  badgeBackground: "rgba(101,161,255,0.14)",
  selectedBackground: "#4f7df3",
  selectedBorder: "#65a1ff",
  todayBorder: "#65a1ff",
  high: "#ff4d5f",
  highTint: "rgba(255,77,95,0.15)",
  normal: "#22c55e",
  normalTint: "rgba(34,197,94,0.15)",
};

const LIGHT_THEME = {
  mode: "light",
  background: "#f4f7fb",
  statusBarStyle: "dark-content",
  headerGradient: ["#eaf2ff", "#f7fbff", "#f4f7fb"],
  text: "#10203b",
  onPrimary: "#ffffff",
  mutedText: "#60718f",
  softText: "#4f607a",
  placeholderText: "#8a98ad",
  primary: "#4f7df3",
  primaryLight: "#3f76e8",
  card: "#ffffff",
  surface: "#eef4ff",
  border: "#d9e4f2",
  summaryBackground: "rgba(79,125,243,0.12)",
  summaryBorder: "rgba(79,125,243,0.22)",
  summaryDivider: "rgba(16,32,59,0.12)",
  badgeBackground: "rgba(79,125,243,0.11)",
  selectedBackground: "#4f7df3",
  selectedBorder: "#3f76e8",
  todayBorder: "#3f76e8",
  high: "#ef4444",
  highTint: "rgba(239,68,68,0.12)",
  normal: "#16a34a",
  normalTint: "rgba(22,163,74,0.12)",
};

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
  const parts = String(dateKey || "").split("-");
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

function parseScheduleDateTime(dateText, timeText) {
  const [yearText, monthText, dayText] = String(dateText || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const timeMatch = String(timeText || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

  if (!year || !month || !day || !timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const period = timeMatch[3].toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  const dateObject = new Date(year, month - 1, day, hour, minute);

  if (Number.isNaN(dateObject.getTime())) return null;

  return dateObject.getTime();
}

function getCalendarSchedules(databaseSchedules) {
  const activeDatabaseSchedules = (Array.isArray(databaseSchedules)
    ? databaseSchedules
    : []
  ).filter((item) => !Boolean(item?.completed));

  const schedulesWithTimestamp = activeDatabaseSchedules.map((item) => ({
    ...item,
    timestamp: parseScheduleDateTime(item.date, item.timeOnly),
  }));

  const validTimestamps = schedulesWithTimestamp
    .map((item) => item.timestamp)
    .filter((timestamp) => timestamp !== null);

  const earliestTimestamp =
    validTimestamps.length > 0 ? Math.min(...validTimestamps) : null;

  return schedulesWithTimestamp
    .map((item) => {
      const isHigh =
        item.timestamp !== null && item.timestamp === earliestTimestamp;

      const subtasks = Array.isArray(item.subtasks) ? item.subtasks : [];

      const completedSubtasks = subtasks.filter(
        (subtask) => subtask.completed
      ).length;

      return {
        ...item,
        time: item.timeOnly || "No time",
        priority: isHigh ? "High" : "Normal",
        subject: item.reminderEnabled
          ? `Reminder: ${item.reminderTime || "On"}`
          : "SchedWise Schedule",
        location: item.deviceCalendarEventId
          ? "Synced to phone calendar"
          : item.pendingSync
          ? "Saved locally on this phone"
          : "Saved in SchedWise database",
        description:
          subtasks.length > 0
            ? `${completedSubtasks}/${subtasks.length} subtasks completed`
            : item.completed
            ? "Completed with proof"
            : "No subtasks added",
      };
    })
    .sort((a, b) => {
      if (a.timestamp === null) return 1;
      if (b.timestamp === null) return -1;
      return a.timestamp - b.timestamp;
    });
}

export default function CalendarScreen() {
  const today = new Date();
  const todayKey = getTodayKey();

  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => getTodayKey());
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const loadThemeMode = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      setIsDarkMode(savedTheme !== "light");
    } catch {
      setIsDarkMode(true);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      setLoadingSchedules(true);

      const localSchedules = await getLocalSchedules();
      setSchedules(localSchedules);

      const user = await getCurrentUser();

      if (!user) {
        return;
      }

      const { data, error } = await getUserSchedules();

      if (error) {
        console.log("Calendar Supabase schedules unavailable:", error?.message);
        return;
      }

      const mergedSchedules = await mergeRemoteSchedulesWithLocal(data);
      setSchedules(mergedSchedules);
    } catch (error) {
      console.log("Calendar load schedules error:", error?.message);

      const localSchedules = await getLocalSchedules();
      setSchedules(localSchedules);
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const now = new Date();

      loadThemeMode();
      loadSchedules();
      setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
      setSelectedDate(getTodayKey());
    }, [loadThemeMode, loadSchedules])
  );

  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

  useEffect(() => {
    const themeSubscription = DeviceEventEmitter.addListener(
      THEME_CHANGE_EVENT,
      (themeMode) => {
        setIsDarkMode(themeMode !== "light");
      }
    );

    const scheduleSubscription = DeviceEventEmitter.addListener(
      SCHEDULE_CHANGE_EVENT,
      () => {
        loadSchedules();
      }
    );

    return () => {
      themeSubscription.remove();
      scheduleSubscription.remove();
    };
  }, [loadSchedules]);

  const currentYear = visibleMonth.getFullYear();
  const currentMonthIndex = visibleMonth.getMonth();

  const calendarCells = useMemo(
    () => getCalendarCells(currentYear, currentMonthIndex),
    [currentYear, currentMonthIndex]
  );

  const calendarSchedules = useMemo(
    () => getCalendarSchedules(schedules),
    [schedules]
  );

  const schedulesByDate = useMemo(() => {
    return calendarSchedules.reduce((accumulator, schedule) => {
      if (!accumulator[schedule.date]) {
        accumulator[schedule.date] = [];
      }

      accumulator[schedule.date].push(schedule);
      return accumulator;
    }, {});
  }, [calendarSchedules]);

  const selectedSchedules = schedulesByDate[selectedDate] || [];

  const totalSchedulesThisMonth = calendarSchedules.filter((schedule) => {
    const parts = String(schedule.date || "").split("-");
    const scheduleYear = Number(parts[0]);
    const scheduleMonth = Number(parts[1]) - 1;

    return scheduleYear === currentYear && scheduleMonth === currentMonthIndex;
  }).length;

  const highPriorityThisMonth = calendarSchedules.filter((schedule) => {
    const parts = String(schedule.date || "").split("-");
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
    const now = new Date();

    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(getTodayKey());
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.background}
        translucent={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={theme.headerGradient} style={styles.header}>
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
              <Feather
                name="chevron-left"
                size={22}
                color={theme.mutedText}
              />
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
              <Feather
                name="chevron-right"
                size={22}
                color={theme.mutedText}
              />
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

          {loadingSchedules ? (
            <View style={styles.emptyScheduleCard}>
              <View style={styles.emptyIcon}>
                <Feather
                  name="refresh-cw"
                  size={26}
                  color={theme.primaryLight}
                />
              </View>

              <Text style={styles.emptyTitle}>Loading schedules</Text>
              <Text style={styles.emptyText}>
                SchedWise is loading schedules saved on this phone.
              </Text>
            </View>
          ) : selectedSchedules.length > 0 ? (
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
                    color={
                      item.priority === "High" ? theme.high : theme.primaryLight
                    }
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
                    <Feather name="clock" size={14} color={theme.mutedText} />
                    <Text style={styles.scheduleInfoText}>{item.time}</Text>
                  </View>

                  <View style={styles.scheduleInfoRow}>
                    <Feather name="map-pin" size={14} color={theme.mutedText} />
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
                <Feather name="calendar" size={26} color={theme.primaryLight} />
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

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
      color: theme.mutedText,
      fontSize: 14,
      fontWeight: "700",
    },

    headerTitle: {
      color: theme.text,
      fontSize: 30,
      fontWeight: "900",
      marginTop: 5,
    },

    headerSubtitle: {
      color: theme.softText,
      fontSize: 13,
      marginTop: 7,
      lineHeight: 19,
    },

    calendarIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    headerSummaryCard: {
      marginTop: 24,
      backgroundColor: theme.summaryBackground,
      borderWidth: 1,
      borderColor: theme.summaryBorder,
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
      color: theme.text,
      fontSize: 22,
      fontWeight: "900",
    },

    headerSummaryLabel: {
      color: theme.mutedText,
      fontSize: 11.5,
      fontWeight: "700",
      marginTop: 4,
    },

    headerSummaryDivider: {
      width: 1,
      height: 35,
      backgroundColor: theme.summaryDivider,
    },

    calendarCard: {
      marginHorizontal: 20,
      marginTop: 12,
      backgroundColor: theme.card,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: theme.border,
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
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    monthTextArea: {
      alignItems: "center",
    },

    monthTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "900",
    },

    monthSubtitle: {
      color: theme.mutedText,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 2,
    },

    todayButton: {
      height: 44,
      borderRadius: 15,
      backgroundColor: theme.primary,
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
      color: theme.primaryLight,
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
      borderColor: theme.todayBorder,
    },

    selectedDayBox: {
      backgroundColor: theme.selectedBackground,
      borderColor: theme.selectedBorder,
    },

    dayNumber: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "800",
    },

    otherMonthDayText: {
      color: theme.placeholderText,
    },

    todayNumber: {
      color: theme.text,
    },

    selectedDayNumber: {
      color: theme.onPrimary,
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
      color: theme.mutedText,
      fontSize: 9,
      fontWeight: "900",
      marginLeft: 3,
    },

    selectedEventCount: {
      color: theme.onPrimary,
    },

    highDot: {
      backgroundColor: theme.high,
    },

    normalDot: {
      backgroundColor: theme.normal,
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
      color: theme.mutedText,
      fontSize: 13,
      fontWeight: "700",
    },

    selectedDateTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
      marginTop: 4,
    },

    selectedDateBadge: {
      backgroundColor: theme.badgeBackground,
      borderWidth: 1,
      borderColor: theme.summaryBorder,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 13,
    },

    selectedDateBadgeText: {
      color: theme.primaryLight,
      fontSize: 12,
      fontWeight: "900",
    },

    scheduleCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
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
      backgroundColor: theme.high,
    },

    normalLine: {
      backgroundColor: theme.normal,
    },

    scheduleIconBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.surface,
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
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
      flex: 1,
      paddingRight: 8,
    },

    highPriorityBadge: {
      backgroundColor: theme.highTint,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 11,
    },

    normalPriorityBadge: {
      backgroundColor: theme.normalTint,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 11,
    },

    highPriorityText: {
      color: theme.high,
      fontSize: 10,
      fontWeight: "900",
    },

    normalPriorityText: {
      color: theme.normal,
      fontSize: 10,
      fontWeight: "900",
    },

    scheduleSubject: {
      color: theme.primaryLight,
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
      color: theme.mutedText,
      fontSize: 12,
      marginLeft: 7,
    },

    scheduleDescription: {
      color: theme.placeholderText,
      fontSize: 11.5,
      marginTop: 7,
      lineHeight: 16,
    },

    emptyScheduleCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 24,
      alignItems: "center",
    },

    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },

    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },

    emptyText: {
      color: theme.mutedText,
      fontSize: 12.5,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 6,
    },

    bottomSpace: {
      height: 10,
    },
  });