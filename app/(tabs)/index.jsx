import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  buildConflictNotificationBody,
  buildConflictSummary,
  detectScheduleConflicts,
} from "../_lib/conflictDetector";
import { sendScheduleConflictNotification } from "../_lib/conflictNotifications";
import { addScheduleToDeviceCalendar } from "../_lib/deviceCalendar";
import {
  syncSchedulePhoneCalendar,
} from "../_lib/phoneCalendarSync";
import {
  addLocalSchedule,
  dedupeSchedules,
  getLocalSchedules,
  isLocalOnlySchedule,
  markLocalScheduleSyncFailed,
  markLocalScheduleSynced,
  mergeRemoteSchedulesWithLocal,
  updateLocalSchedule,
} from "../_lib/localSchedules";
import {
  assignAiSchedulePriorities,
  getPriorityColor,
  getSchedulePriorityFingerprint,
  normalizePriorityLabel,
  PRIORITY_HIGH,
  PRIORITY_LOW,
} from "../_lib/schedulePriority";
import { filterCalendarSchedules } from "../_lib/scheduleStatus";
import { useScheduleRefreshTick } from "../_lib/useScheduleRefreshTick";
import {
  cancelScheduleReminder,
  syncReminderForSchedule,
} from "../_lib/scheduleReminders";
import {
  addUserSchedule,
  getCurrentUser,
  getUserSchedules,
  updateScheduleDeviceCalendarSync,
  updateUserSchedule,
} from "../_lib/supabase";

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

const TIME_ITEM_HEIGHT = 38;
const TIME_WHEEL_PADDING = TIME_ITEM_HEIGHT * 2;

const REMINDER_ITEM_HEIGHT = 40;
const REMINDER_WHEEL_PADDING = REMINDER_ITEM_HEIGHT * 1;

const FONT_TINY = 10;
const FONT_SMALL = 12;
const FONT_LABEL = 13;
const FONT_BODY = 14;
const FONT_MEDIUM = 15;
const FONT_TITLE = 18;
const FONT_HEADER = 22;
const FONT_MODAL_TITLE = 23;
const FONT_WHEEL = 16;
const FONT_WHEEL_ACTIVE = 18;

const THEME_STORAGE_KEY = "schedwise_app_theme_mode";
const SCHEDULE_CHANGE_EVENT = "schedwise_schedules_changed";

const DARK_THEME = {
  mode: "dark",
  background: "#081225",
  statusBarStyle: "light-content",
  headerGradient: ["#081225", "#0d2342", "#081225"],
  text: "#ffffff",
  onPrimary: "#ffffff",
  muted: "#8ea2c1",
  softText: "#b6c7e6",
  placeholder: "#6f819f",
  primary: "#4f7df3",
  primaryLight: "#65a1ff",
  primarySoft: "#8bb8ff",
  primaryTint: "rgba(101,161,255,0.13)",
  primaryTintStrong: "rgba(101,161,255,0.16)",
  primaryTintSoft: "rgba(101,161,255,0.08)",
  primaryBorder: "rgba(101,161,255,0.25)",
  primaryBorderStrong: "rgba(101,161,255,0.55)",
  card: "#0d1529",
  surface: "#121c32",
  input: "#0d1529",
  modal: "#081225",
  border: "#1b2944",
  borderSoft: "#13203a",
  handle: "#334563",
  overlay: "rgba(0,0,0,0.78)",
  modalOverlay: "rgba(0,0,0,0.7)",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ff4d5f",
  switchOff: "#31476c",
  shadow: "#4f7df3",
  dashedBg: "rgba(101,161,255,0.08)",
  dashedBorder: "rgba(101,161,255,0.26)",
};

const LIGHT_THEME = {
  mode: "light",
  background: "#f4f7fb",
  statusBarStyle: "dark-content",
  headerGradient: ["#eef5ff", "#ffffff", "#f4f7fb"],
  text: "#10203b",
  onPrimary: "#ffffff",
  muted: "#60718f",
  softText: "#4f607a",
  placeholder: "#8a98ad",
  primary: "#4f7df3",
  primaryLight: "#3f76e8",
  primarySoft: "#9fc0ff",
  primaryTint: "rgba(79,125,243,0.12)",
  primaryTintStrong: "rgba(79,125,243,0.16)",
  primaryTintSoft: "rgba(79,125,243,0.07)",
  primaryBorder: "rgba(79,125,243,0.22)",
  primaryBorderStrong: "rgba(79,125,243,0.45)",
  card: "#ffffff",
  surface: "#eef4ff",
  input: "#ffffff",
  modal: "#ffffff",
  border: "#d9e4f2",
  borderSoft: "#dce6f3",
  handle: "#b7c4d8",
  overlay: "rgba(7,16,34,0.48)",
  modalOverlay: "rgba(7,16,34,0.46)",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#ef4444",
  switchOff: "#d7e0ec",
  shadow: "#9ab8ff",
  dashedBg: "rgba(79,125,243,0.06)",
  dashedBorder: "rgba(79,125,243,0.22)",
};

const months = [
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

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const hourOptions = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

const minuteOptions = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);

const periodOptions = ["AM", "PM"];

const presetTimes = [
  { label: "9 am", hour: "9", minute: "00", period: "AM" },
  { label: "12 pm", hour: "12", minute: "00", period: "PM" },
  { label: "4 pm", hour: "4", minute: "00", period: "PM" },
  { label: "6 pm", hour: "6", minute: "00", period: "PM" },
];

const reminderOptions = [
  "Same with due date",
  "5 minutes before",
  "15 minutes before",
  "30 minutes before",
  "1 day before",
  "Customize time",
];

const reminderNumberOptions = Array.from({ length: 60 }, (_, index) =>
  String(index + 1)
);

const reminderUnitOptions = ["Minutes", "Hours", "Days"];

const reminderTimingOptions = ["Before"];

const fullWeekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const createLocalDate = (dateText) => {
  if (!dateText) return null;

  const [yearText, monthText, dayText] = dateText.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const getDateKey = (dateObject) => {
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, "0");
  const day = String(dateObject.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const addDaysToDate = (dateObject, amount) => {
  const nextDate = new Date(dateObject);
  nextDate.setDate(dateObject.getDate() + amount);

  return nextDate;
};

const getTodayKey = () => getDateKey(new Date());

const getReadableDate = (dateText) => {
  const dateObject = createLocalDate(dateText);

  if (!dateObject) return "Select a day";

  return `${months[dateObject.getMonth()]} ${String(
    dateObject.getDate()
  ).padStart(2, "0")}`;
};

const getCurrentWeekDays = () => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const dateObject = addDaysToDate(startOfWeek, index);
    const dateKey = getDateKey(dateObject);

    return {
      day: weekDays[dateObject.getDay()],
      fullDay: fullWeekDays[dateObject.getDay()],
      date: String(dateObject.getDate()).padStart(2, "0"),
      month: months[dateObject.getMonth()],
      dateKey,
      isToday: dateKey === getTodayKey(),
    };
  });
};

const getWeekRangeText = (weekItems) => {
  if (!weekItems.length) return "";

  const firstDate = createLocalDate(weekItems[0].dateKey);
  const lastDate = createLocalDate(weekItems[weekItems.length - 1].dateKey);

  if (!firstDate || !lastDate) return "";

  const startLabel = `${months[firstDate.getMonth()]} ${String(
    firstDate.getDate()
  ).padStart(2, "0")}`;
  const endLabel = `${months[lastDate.getMonth()]} ${String(
    lastDate.getDate()
  ).padStart(2, "0")}`;

  return `${startLabel} - ${endLabel}`;
};

const createInitialSchedules = () => {
  const today = new Date();
  const tomorrow = addDaysToDate(today, 1);
  const twoDaysFromNow = addDaysToDate(today, 2);

  return [
    {
      id: 1,
      date: getDateKey(today),
      timeOnly: "11:59 PM",
      title: "Research Proposal Deadline",
      icon: "file-text",
      completed: false,
      proofUri: "",
      reminderEnabled: true,
      reminderTime: "5 minutes before",
      subtasks: [
        {
          id: 101,
          text: "Finalize documentation",
          completed: false,
          proofUri: "",
        },
        {
          id: 102,
          text: "Submit PDF copy",
          completed: false,
          proofUri: "",
        },
      ],
    },
    {
      id: 2,
      date: getDateKey(tomorrow),
      timeOnly: "2:00 PM",
      title: "Group Study Session",
      icon: "users",
      completed: false,
      proofUri: "",
      reminderEnabled: false,
      reminderTime: "",
      subtasks: [
        {
          id: 201,
          text: "Bring notes",
          completed: false,
          proofUri: "",
        },
        {
          id: 202,
          text: "Prepare practice problems",
          completed: false,
          proofUri: "",
        },
      ],
    },
    {
      id: 3,
      date: getDateKey(twoDaysFromNow),
      timeOnly: "9:00 AM",
      title: "Final Exam Review",
      icon: "book-open",
      completed: false,
      proofUri: "",
      reminderEnabled: true,
      reminderTime: "30 minutes before",
      subtasks: [],
    },
  ];
};

const initialSchedules = createInitialSchedules();

export default function HomeDashboard() {
  const router = useRouter();

  const hourScrollRef = useRef(null);
  const minuteScrollRef = useRef(null);
  const periodScrollRef = useRef(null);
  const weekScrollRef = useRef(null);

  const reminderNumberScrollRef = useRef(null);
  const reminderUnitScrollRef = useRef(null);
  const reminderTimingScrollRef = useRef(null);

  const [schedules, setSchedules] = useState([]);
  const scheduleRefreshTick = useScheduleRefreshTick(15000);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [customReminderVisible, setCustomReminderVisible] = useState(false);
  const [proofModalVisible, setProofModalVisible] = useState(false);

  const currentDate = new Date();

  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(currentDate.getMonth());
  const [selectedWeekDate, setSelectedWeekDate] = useState(getTodayKey());

  const [tempHour, setTempHour] = useState("8");
  const [tempMinute, setTempMinute] = useState("00");
  const [tempPeriod, setTempPeriod] = useState("AM");

  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleSubtasksText, setScheduleSubtasksText] = useState("");

  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [selectedReminder, setSelectedReminder] = useState("5 minutes before");

  const [customReminderValue, setCustomReminderValue] = useState("1");
  const [customReminderUnit, setCustomReminderUnit] = useState("Minutes");
  const [customReminderTiming, setCustomReminderTiming] = useState("Before");

  const [proofTarget, setProofTarget] = useState(null);
  const [proofImageUri, setProofImageUri] = useState("");

  const [isDarkMode, setIsDarkMode] = useState(true);

  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [detectedConflicts, setDetectedConflicts] = useState([]);
  const [conflictSuggestions, setConflictSuggestions] = useState([]);
  const [pendingConflictSchedule, setPendingConflictSchedule] = useState(null);
  const [prioritizedSchedules, setPrioritizedSchedules] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const priorityFingerprintRef = useRef("");
  const prioritizedSchedulesRef = useRef([]);

  const theme = isDarkMode === false ? LIGHT_THEME : DARK_THEME;
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
      setSchedules(dedupeSchedules(localSchedules));

      const user = await getCurrentUser();

      if (!user) {
        return;
      }

      const { data, error } = await getUserSchedules();

      if (error) {
        console.log("Supabase schedules unavailable:", error?.message);
        return;
      }

      const mergedSchedules = await mergeRemoteSchedulesWithLocal(data);
      setSchedules(dedupeSchedules(mergedSchedules));
    } catch (error) {
      console.log("Schedule load error:", error?.message);

      const localSchedules = await getLocalSchedules();
      setSchedules(dedupeSchedules(localSchedules));
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const todayKey = getTodayKey();
      setSelectedWeekDate(todayKey);
      loadThemeMode();
      loadSchedules();

      const todayIndex = new Date().getDay();

      setTimeout(() => {
        weekScrollRef.current?.scrollTo({
          x: todayIndex * 78,
          animated: true,
        });
      }, 120);
    }, [loadThemeMode, loadSchedules])
  );

  useEffect(() => {
    const scheduleSubscription = DeviceEventEmitter.addListener(
      SCHEDULE_CHANGE_EVENT,
      () => {
        loadSchedules();
      }
    );

    return () => {
      scheduleSubscription.remove();
    };
  }, [loadSchedules]);

  const resetForm = () => {
    setScheduleTitle("");
    setScheduleDate("");
    setScheduleTime("");
    setScheduleSubtasksText("");
    setReminderEnabled(true);
    setSelectedReminder("5 minutes before");
    setCustomReminderValue("1");
    setCustomReminderUnit("Minutes");
    setCustomReminderTiming("Before");
  };

  const closeModal = () => {
    resetForm();
    setDatePickerVisible(false);
    setTimePickerVisible(false);
    setCustomReminderVisible(false);
    setModalVisible(false);
  };

  const closeProofModal = () => {
    setProofTarget(null);
    setProofImageUri("");
    setProofModalVisible(false);
  };

  const getFormattedPickerDate = (day) => {
    const month = String(pickerMonth + 1).padStart(2, "0");
    const date = String(day).padStart(2, "0");

    return `${pickerYear}-${month}-${date}`;
  };

  const getCalendarGrid = () => {
    const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();

    const blankDays = Array.from({ length: firstDay }, (_, index) => ({
      key: `blank-${index}`,
      day: null,
    }));

    const monthDays = Array.from({ length: daysInMonth }, (_, index) => ({
      key: `day-${index + 1}`,
      day: index + 1,
    }));

    return [...blankDays, ...monthDays];
  };

  const scrollToTimeValues = (hour, minute, period, animated = false) => {
    const hourIndex = Math.max(hourOptions.indexOf(hour), 0);
    const minuteIndex = Math.max(minuteOptions.indexOf(minute), 0);
    const periodIndex = Math.max(periodOptions.indexOf(period), 0);

    hourScrollRef.current?.scrollTo({
      y: hourIndex * TIME_ITEM_HEIGHT,
      animated,
    });

    minuteScrollRef.current?.scrollTo({
      y: minuteIndex * TIME_ITEM_HEIGHT,
      animated,
    });

    periodScrollRef.current?.scrollTo({
      y: periodIndex * TIME_ITEM_HEIGHT,
      animated,
    });
  };

  const scrollToReminderValues = (value, unit, timing, animated = false) => {
    const valueIndex = Math.max(reminderNumberOptions.indexOf(value), 0);
    const unitIndex = Math.max(reminderUnitOptions.indexOf(unit), 0);
    const timingIndex = Math.max(reminderTimingOptions.indexOf(timing), 0);

    reminderNumberScrollRef.current?.scrollTo({
      y: valueIndex * REMINDER_ITEM_HEIGHT,
      animated,
    });

    reminderUnitScrollRef.current?.scrollTo({
      y: unitIndex * REMINDER_ITEM_HEIGHT,
      animated,
    });

    reminderTimingScrollRef.current?.scrollTo({
      y: timingIndex * REMINDER_ITEM_HEIGHT,
      animated,
    });
  };

  const handleWheelScrollEnd = useCallback(
    (event, options, setter, scrollRef) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const rawIndex = Math.round(offsetY / TIME_ITEM_HEIGHT);
      const safeIndex = Math.min(Math.max(rawIndex, 0), options.length - 1);
      const selectedValue = options[safeIndex];
      const targetOffset = safeIndex * TIME_ITEM_HEIGHT;

      setter((currentValue) =>
        currentValue === selectedValue ? currentValue : selectedValue
      );

      if (Math.abs(offsetY - targetOffset) > 1) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: targetOffset,
            animated: false,
          });
        });
      }
    },
    []
  );

  const handleWheelDragEnd = useCallback(
    (event, options, setter, scrollRef) => {
      const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);

      if (velocityY < 0.15) {
        handleWheelScrollEnd(event, options, setter, scrollRef);
      }
    },
    [handleWheelScrollEnd]
  );

  const handleReminderWheelScrollEnd = useCallback(
    (event, options, setter, scrollRef) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const rawIndex = Math.round(offsetY / REMINDER_ITEM_HEIGHT);
      const safeIndex = Math.min(Math.max(rawIndex, 0), options.length - 1);
      const selectedValue = options[safeIndex];
      const targetOffset = safeIndex * REMINDER_ITEM_HEIGHT;

      setter((currentValue) =>
        currentValue === selectedValue ? currentValue : selectedValue
      );

      if (Math.abs(offsetY - targetOffset) > 1) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: targetOffset,
            animated: false,
          });
        });
      }
    },
    []
  );

  const handleReminderWheelDragEnd = useCallback(
    (event, options, setter, scrollRef) => {
      const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);

      if (velocityY < 0.15) {
        handleReminderWheelScrollEnd(event, options, setter, scrollRef);
      }
    },
    [handleReminderWheelScrollEnd]
  );

  const openDatePicker = () => {
    if (scheduleDate) {
      const dateParts = scheduleDate.split("-");
      const selectedYear = Number(dateParts[0]);
      const selectedMonth = Number(dateParts[1]);

      if (selectedYear && selectedMonth) {
        setPickerYear(selectedYear);
        setPickerMonth(selectedMonth - 1);
      }
    }

    setDatePickerVisible(true);
  };

  const openTimePicker = () => {
    let nextHour = tempHour;
    let nextMinute = tempMinute;
    let nextPeriod = tempPeriod;

    const timeMatch = scheduleTime
      .trim()
      .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

    if (timeMatch) {
      nextHour = timeMatch[1];
      nextMinute = timeMatch[2];
      nextPeriod = timeMatch[3].toUpperCase();

      setTempHour(nextHour);
      setTempMinute(nextMinute);
      setTempPeriod(nextPeriod);
    }

    setTimePickerVisible(true);

    setTimeout(() => {
      scrollToTimeValues(nextHour, nextMinute, nextPeriod, false);
    }, 120);
  };

  const openCustomReminderPicker = () => {
    setSelectedReminder("Customize time");
    setCustomReminderVisible(true);

    setTimeout(() => {
      scrollToReminderValues(
        customReminderValue,
        customReminderUnit,
        customReminderTiming,
        false
      );
    }, 120);
  };

  const goToPreviousMonth = () => {
    if (pickerMonth === 0) {
      setPickerMonth(11);
      setPickerYear((prev) => prev - 1);
      return;
    }

    setPickerMonth((prev) => prev - 1);
  };

  const goToNextMonth = () => {
    if (pickerMonth === 11) {
      setPickerMonth(0);
      setPickerYear((prev) => prev + 1);
      return;
    }

    setPickerMonth((prev) => prev + 1);
  };

  const handleSelectDate = (day) => {
    setScheduleDate(getFormattedPickerDate(day));
    setDatePickerVisible(false);
  };

  const handleConfirmTime = () => {
    setScheduleTime(`${tempHour}:${tempMinute} ${tempPeriod}`);
    setTimePickerVisible(false);
  };

  const handlePresetTime = (preset) => {
    setTempHour(preset.hour);
    setTempMinute(preset.minute);
    setTempPeriod(preset.period);

    setTimeout(() => {
      scrollToTimeValues(preset.hour, preset.minute, preset.period, true);
    }, 60);
  };

  const getDateDisplay = (dateText) => {
    const dateParts = dateText.split("-");

    if (dateParts.length === 3) {
      const monthIndex = Number(dateParts[1]) - 1;
      const day = dateParts[2];

      if (months[monthIndex] && day) {
        return {
          day,
          month: months[monthIndex],
        };
      }
    }

    return {
      day: "--",
      month: "DATE",
    };
  };

  const parseScheduleDateTime = (dateText, timeText) => {
    const dateParts = dateText.split("-");

    if (dateParts.length !== 3) return null;

    const year = Number(dateParts[0]);
    const month = Number(dateParts[1]);
    const day = Number(dateParts[2]);

    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const timeMatch = timeText
      .trim()
      .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

    if (!timeMatch) return null;

    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const period = timeMatch[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    const dateObject = new Date(year, month - 1, day, hour, minute);

    if (
      Number.isNaN(dateObject.getTime()) ||
      dateObject.getFullYear() !== year ||
      dateObject.getMonth() !== month - 1 ||
      dateObject.getDate() !== day
    ) {
      return null;
    }

    return dateObject.getTime();
  };

  const formatTimeFromDate = (dateObject) => {
    let hours = dateObject.getHours();
    const minutes = String(dateObject.getMinutes()).padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours === 0 ? 12 : hours;

    return `${hours}:${minutes} ${period}`;
  };

  const getCustomReminderLabel = () => {
    const valueNumber = Number(customReminderValue);
    const unitText =
      valueNumber === 1
        ? customReminderUnit.slice(0, -1).toLowerCase()
        : customReminderUnit.toLowerCase();

    return `${customReminderValue} ${unitText} ${customReminderTiming.toLowerCase()}`;
  };

  const getSelectedReminderDisplay = () => {
    if (selectedReminder === "Customize time") {
      return getCustomReminderLabel();
    }

    return selectedReminder;
  };

  const getCustomReminderPreview = () => {
    const timestamp = parseScheduleDateTime(
      scheduleDate.trim(),
      scheduleTime.trim()
    );

    if (timestamp === null) {
      return "Select date and time first";
    }

    const valueNumber = Number(customReminderValue);
    let offsetMilliseconds = valueNumber * 60 * 1000;

    if (customReminderUnit === "Hours") {
      offsetMilliseconds = valueNumber * 60 * 60 * 1000;
    }

    if (customReminderUnit === "Days") {
      offsetMilliseconds = valueNumber * 24 * 60 * 60 * 1000;
    }

    const reminderTimestamp =
      customReminderTiming === "Before"
        ? timestamp - offsetMilliseconds
        : timestamp + offsetMilliseconds;

    const reminderDate = new Date(reminderTimestamp);
    const today = new Date();

    const isToday =
      reminderDate.getFullYear() === today.getFullYear() &&
      reminderDate.getMonth() === today.getMonth() &&
      reminderDate.getDate() === today.getDate();

    const dateLabel = isToday
      ? "Today"
      : `${months[reminderDate.getMonth()]} ${String(
          reminderDate.getDate()
        ).padStart(2, "0")}`;

    return `${dateLabel} ${formatTimeFromDate(reminderDate)}`;
  };

  const handleSelectReminderOption = (option) => {
    if (option === "Customize time") {
      openCustomReminderPicker();
      return;
    }

    setSelectedReminder(option);
  };

  const handleSaveCustomReminder = () => {
    setSelectedReminder("Customize time");
    setCustomReminderVisible(false);
  };

  const parseSubtasksFromInput = () => {
    return scheduleSubtasksText
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((text, index) => ({
        id: Date.now() + index + 1,
        text,
        completed: false,
        proofUri: "",
      }));
  };

  const getSchedulesWithAutoPriority = useCallback(() => {
    return prioritizedSchedules.map((item) => {
      const dateDisplay = getDateDisplay(item.date);
      const priority = normalizePriorityLabel(item.priority);

      return {
        ...item,
        day: dateDisplay.day,
        month: dateDisplay.month,
        time: `${item.date} • ${item.timeOnly}`,
        priority,
        color: getPriorityColor(priority, theme),
      };
    });
  }, [prioritizedSchedules, theme]);

  useEffect(() => {
    let isMounted = true;

    const refreshPriorities = async () => {
      const fingerprint = getSchedulePriorityFingerprint(schedules);

      if (
        fingerprint === priorityFingerprintRef.current &&
        fingerprint !== ""
      ) {
        return;
      }

      try {
        const ranked = await assignAiSchedulePriorities(
          schedules,
          prioritizedSchedulesRef.current
        );

        if (!isMounted) {
          return;
        }

        priorityFingerprintRef.current = fingerprint;
        prioritizedSchedulesRef.current = ranked;
        setPrioritizedSchedules(ranked);
      } catch (error) {
        console.log("AI priority ranking failed:", error?.message);

        if (!isMounted) {
          return;
        }

        const fallback = filterCalendarSchedules(schedules).map(
          (item, index) => ({
            ...item,
            timestamp: parseScheduleDateTime(item.date, item.timeOnly),
            priority: index === 0 ? PRIORITY_HIGH : PRIORITY_LOW,
          })
        );

        priorityFingerprintRef.current = fingerprint;
        prioritizedSchedulesRef.current = fallback;
        setPrioritizedSchedules(fallback);
      }
    };

    refreshPriorities();

    return () => {
      isMounted = false;
    };
  }, [schedules, scheduleRefreshTick]);

  const clearConflictState = () => {
    setConflictModalVisible(false);
    setDetectedConflicts([]);
    setConflictSuggestions([]);
    setPendingConflictSchedule(null);
  };

  const showScheduleConflict = (conflictResult, schedulePayload) => {
    setDetectedConflicts(conflictResult.conflicts);
    setConflictSuggestions(conflictResult.suggestions);
    setPendingConflictSchedule(schedulePayload);

    setModalVisible(false);

    setTimeout(() => {
      setConflictModalVisible(true);
    }, 280);

    setTimeout(() => {
      sendScheduleConflictNotification({
        title: "Schedule conflict detected",
        body: buildConflictNotificationBody(
          conflictResult.conflicts,
          conflictResult.suggestions
        ),
      }).catch((error) => {
        console.log("Conflict notification failed:", error?.message);
      });
    }, 450);
  };

  const handleEditConflictingSchedule = () => {
    setConflictModalVisible(false);

    setTimeout(() => {
      setModalVisible(true);
    }, 220);
  };

  const saveSchedulePayload = async (schedulePayload) => {
    try {
      setSavingSchedule(true);
      clearConflictState();

      const localSchedule = await addLocalSchedule(schedulePayload);

      setSchedules((prev) => dedupeSchedules([...prev, localSchedule]));

      let finalSchedule = localSchedule;
      let syncedToSupabase = false;

      try {
        const user = await getCurrentUser();

        if (user) {
          const { data: remoteSchedule, error } = await addUserSchedule({
            ...schedulePayload,
            deviceCalendarEventId: localSchedule.deviceCalendarEventId || "",
            deviceCalendarId: localSchedule.deviceCalendarId || "",
            deviceCalendarSyncedAt: localSchedule.deviceCalendarSyncedAt || "",
          });

          if (error) {
            throw error;
          }

          if (remoteSchedule) {
            const syncedLocalSchedule = await markLocalScheduleSynced(
              localSchedule.id,
              remoteSchedule
            );

            finalSchedule = syncedLocalSchedule || remoteSchedule;
            syncedToSupabase = true;

            setSchedules((prev) =>
              dedupeSchedules(
                prev
                  .filter(
                    (schedule) =>
                      String(schedule.id) !== String(localSchedule.id) &&
                      String(schedule.id) !== String(finalSchedule.id)
                  )
                  .concat(finalSchedule)
              )
            );
          }
        }
      } catch (syncError) {
        await markLocalScheduleSyncFailed(
          localSchedule.id,
          syncError?.message || "Saved locally, but Supabase sync failed."
        );

        finalSchedule = {
          ...localSchedule,
          pendingSync: true,
          syncAction: "insert",
          syncError:
            syncError?.message || "Saved locally, but Supabase sync failed.",
        };

        setSchedules((prev) =>
          dedupeSchedules(
            prev.map((schedule) =>
              String(schedule.id) === String(localSchedule.id)
                ? finalSchedule
                : schedule
            )
          )
        );
      }

      try {
        const calendarResult = await addScheduleToDeviceCalendar(finalSchedule);
        const syncedAt = new Date().toISOString();

        const calendarSyncedSchedule = {
          ...finalSchedule,
          deviceCalendarEventId: calendarResult.eventId || "",
          deviceCalendarId: calendarResult.calendarId || "",
          deviceCalendarSyncedAt: syncedAt,
        };

        const updatedLocalSchedule = await updateLocalSchedule(finalSchedule.id, {
          deviceCalendarEventId: calendarResult.eventId || "",
          deviceCalendarId: calendarResult.calendarId || "",
          deviceCalendarSyncedAt: syncedAt,
          pendingSync: !syncedToSupabase || isLocalOnlySchedule(finalSchedule),
          syncAction:
            !syncedToSupabase || isLocalOnlySchedule(finalSchedule)
              ? "insert"
              : "",
          syncError: "",
        });

        finalSchedule = updatedLocalSchedule || calendarSyncedSchedule;

        setSchedules((prev) =>
          dedupeSchedules(
            prev.map((schedule) =>
              String(schedule.id) === String(finalSchedule.id)
                ? finalSchedule
                : schedule
            )
          )
        );

        if (syncedToSupabase && !isLocalOnlySchedule(finalSchedule)) {
          const { data: syncedSchedule, error: calendarSyncError } =
            await updateScheduleDeviceCalendarSync(finalSchedule.id, {
              deviceCalendarEventId: calendarResult.eventId || "",
              deviceCalendarId: calendarResult.calendarId || "",
              deviceCalendarSyncedAt: syncedAt,
            });

          if (calendarSyncError) {
            throw calendarSyncError;
          }

          if (syncedSchedule) {
            await markLocalScheduleSynced(finalSchedule.id, syncedSchedule);

            finalSchedule = syncedSchedule;

            setSchedules((prev) =>
              dedupeSchedules(
                prev.map((schedule) =>
                  String(schedule.id) === String(finalSchedule.id)
                    ? finalSchedule
                    : schedule
                )
              )
            );
          }
        }

        Alert.alert(
          "Schedule Saved",
          syncedToSupabase
            ? "Your schedule was saved locally, synced to Supabase, and added to your phone Calendar app."
            : "Your schedule was saved locally and added to your phone Calendar app. It will sync to Supabase when your account/internet is ready."
        );
      } catch (calendarError) {
        Alert.alert(
          "Schedule Saved",
          syncedToSupabase
            ? "Your schedule was saved locally and synced to Supabase, but it was not added to your phone Calendar app."
            : "Your schedule was saved locally. It will sync to Supabase when your account/internet is ready."
        );

        console.log("Phone calendar sync error:", calendarError?.message);
      }

      DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);

      await syncReminderForSchedule(finalSchedule);

      resetForm();
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        "Save Failed",
        error?.message || "Something went wrong while saving your schedule."
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (savingSchedule || checkingConflicts) return;

    if (!scheduleTitle.trim()) {
      Alert.alert("Missing Title", "Please enter a schedule title.");
      return;
    }

    if (!scheduleDate.trim()) {
      Alert.alert("Missing Date", "Please select a date.");
      return;
    }

    if (!scheduleTime.trim()) {
      Alert.alert("Missing Time", "Please select a time.");
      return;
    }

    const timestamp = parseScheduleDateTime(
      scheduleDate.trim(),
      scheduleTime.trim()
    );

    if (timestamp === null) {
      Alert.alert("Invalid Date or Time", "Please select a valid date and time.");
      return;
    }

    const schedulePayload = {
      date: scheduleDate.trim(),
      timeOnly: scheduleTime.trim(),
      title: scheduleTitle.trim(),
      icon: "calendar",
      completed: false,
      proofUri: "",
      subtasks: parseSubtasksFromInput(),
      reminderEnabled,
      reminderTime: reminderEnabled ? getSelectedReminderDisplay() : "",
    };

    try {
      setCheckingConflicts(true);

      const conflictResult = await detectScheduleConflicts(
        schedulePayload,
        schedules
      );

      if (conflictResult.hasConflicts) {
        showScheduleConflict(conflictResult, schedulePayload);
        return;
      }

      await saveSchedulePayload(schedulePayload);
    } catch (error) {
      Alert.alert(
        "Conflict Check Failed",
        error?.message ||
          "Could not check conflicts with AI. Check your internet connection and Groq API key, then try again."
      );
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleSaveConflictingScheduleAnyway = async () => {
    if (!pendingConflictSchedule || savingSchedule) return;

    await saveSchedulePayload(pendingConflictSchedule);
  };

  const handleUseSuggestedScheduleTime = (suggestion) => {
    if (!suggestion) return;

    setScheduleDate(suggestion.date);
    setScheduleTime(suggestion.timeOnly);
    clearConflictState();

    setTimeout(() => {
      setModalVisible(true);
    }, 220);
  };

  const getScheduleById = (scheduleId) => {
    return schedules.find((item) => String(item.id) === String(scheduleId));
  };

  const handleOpenProofModal = (target) => {
    const schedule = getScheduleById(target.scheduleId);

    if (!schedule) return;

    if (target.type === "task" && schedule.completed) {
      Alert.alert("Already Completed", "This task already has submitted proof.");
      return;
    }

    if (target.type === "subtask") {
      const subtask = schedule.subtasks.find(
        (item) => item.id === target.subtaskId
      );

      if (subtask?.completed) {
        Alert.alert(
          "Already Completed",
          "This subtask already has submitted proof."
        );
        return;
      }
    }

    setProofTarget(target);
    setProofImageUri("");
    setProofModalVisible(true);
  };

  const pickProofImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo access to upload proof."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setProofImageUri(result.assets[0].uri);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofTarget) return;

    if (!proofImageUri) {
      Alert.alert(
        "Proof Required",
        "Please upload proof before marking this as completed."
      );
      return;
    }

    const currentSchedule = getScheduleById(proofTarget.scheduleId);

    if (!currentSchedule) {
      Alert.alert("Schedule Missing", "This schedule could not be found.");
      return;
    }

    let updatedSchedule = currentSchedule;

    if (proofTarget.type === "task") {
      updatedSchedule = {
        ...currentSchedule,
        completed: true,
        proofUri: proofImageUri,
      };
    } else {
      updatedSchedule = {
        ...currentSchedule,
        subtasks: currentSchedule.subtasks.map((subtask) =>
          String(subtask.id) === String(proofTarget.subtaskId)
            ? {
                ...subtask,
                completed: true,
                proofUri: proofImageUri,
              }
            : subtask
        ),
      };
    }

    try {
      const locallyUpdatedSchedule = await updateLocalSchedule(
        currentSchedule.id,
        {
          completed: updatedSchedule.completed,
          proofUri: updatedSchedule.proofUri,
          subtasks: updatedSchedule.subtasks,
          pendingSync: true,
          syncAction: isLocalOnlySchedule(currentSchedule)
            ? "insert"
            : "update",
          syncError: "",
        }
      );

      const localFinalSchedule = locallyUpdatedSchedule || updatedSchedule;

      setSchedules((prev) =>
        dedupeSchedules(
          prev.map((schedule) =>
            String(schedule.id) === String(currentSchedule.id)
              ? localFinalSchedule
              : schedule
          )
        )
      );

      // Drop completed tasks from the Home list immediately so they cannot flash back.
      if (localFinalSchedule.completed) {
        const nextPrioritized = prioritizedSchedulesRef.current.filter(
          (schedule) => String(schedule.id) !== String(localFinalSchedule.id)
        );
        prioritizedSchedulesRef.current = nextPrioritized;
        priorityFingerprintRef.current = getSchedulePriorityFingerprint(
          dedupeSchedules(
            // Use updated schedules for fingerprinting.
            (Array.isArray(schedules) ? schedules : []).map((schedule) =>
              String(schedule.id) === String(localFinalSchedule.id)
                ? localFinalSchedule
                : schedule
            )
          )
        );
        setPrioritizedSchedules(nextPrioritized);
      }

      closeProofModal();

      if (localFinalSchedule.completed) {
        await cancelScheduleReminder(localFinalSchedule.id);
      }

      try {
        const user = await getCurrentUser();

        if (user && !isLocalOnlySchedule(localFinalSchedule)) {
          const { data: savedUpdatedSchedule, error } = await updateUserSchedule(
            localFinalSchedule.id,
            {
              completed: localFinalSchedule.completed,
              proofUri: localFinalSchedule.proofUri,
              subtasks: localFinalSchedule.subtasks,
            }
          );

          if (error) {
            throw error;
          }

          const finalUpdatedSchedule =
            savedUpdatedSchedule || {
              ...localFinalSchedule,
              pendingSync: false,
              syncAction: "",
              syncError: "",
            };

          await markLocalScheduleSynced(
            localFinalSchedule.id,
            finalUpdatedSchedule
          );

          setSchedules((prev) =>
            dedupeSchedules(
              prev.map((schedule) =>
                String(schedule.id) === String(finalUpdatedSchedule.id)
                  ? {
                      ...finalUpdatedSchedule,
                      completed:
                        Boolean(finalUpdatedSchedule.completed) ||
                        Boolean(localFinalSchedule.completed),
                    }
                  : schedule
              )
            )
          );
        }
      } catch (syncError) {
        await markLocalScheduleSyncFailed(
          currentSchedule.id,
          syncError?.message || "Proof saved locally, but Supabase sync failed."
        );

        console.log("Proof Supabase sync error:", syncError?.message);
      }

      if (localFinalSchedule.completed) {
        try {
          const calendarClearedSchedule = await syncSchedulePhoneCalendar(
            {
              ...localFinalSchedule,
              completed: true,
            },
            { remove: true }
          );

          if (calendarClearedSchedule) {
            setSchedules((prev) =>
              dedupeSchedules(
                prev.map((schedule) =>
                  String(schedule.id) === String(calendarClearedSchedule.id)
                    ? {
                        ...calendarClearedSchedule,
                        completed: true,
                        proofUri:
                          calendarClearedSchedule.proofUri ||
                          localFinalSchedule.proofUri,
                      }
                    : schedule
                )
              )
            );
          }
        } catch (calendarError) {
          console.log(
            "Phone calendar remove on complete failed:",
            calendarError?.message
          );
        }
      }

      DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);
    } catch (error) {
      Alert.alert(
        "Proof Upload Failed",
        error?.message || "Something went wrong while saving your proof."
      );
    }
  };

  const getProofTargetTitle = () => {
    if (!proofTarget) return "";

    const schedule = getScheduleById(proofTarget.scheduleId);

    if (!schedule) return "";

    if (proofTarget.type === "task") {
      return schedule.title;
    }

    const subtask = schedule.subtasks.find(
      (item) => String(item.id) === String(proofTarget.subtaskId)
    );

    return subtask?.text || "";
  };

  const displayedSchedules = useMemo(
    () => getSchedulesWithAutoPriority(),
    [getSchedulesWithAutoPriority]
  );
  const todayKey = getTodayKey();
  const currentWeekDays = getCurrentWeekDays();
  const selectedWeekItem = currentWeekDays.find(
    (item) => item.dateKey === selectedWeekDate
  );
  const selectedDaySchedules = useMemo(() => {
    const seenIds = new Set();

    return displayedSchedules.filter((item) => {
      if (item.date !== selectedWeekDate) {
        return false;
      }

      if (item.completed) {
        return false;
      }

      const id = String(item.id || "");

      if (!id || seenIds.has(id)) {
        return false;
      }

      seenIds.add(id);
      return true;
    });
  }, [displayedSchedules, selectedWeekDate]);

  const selectedScheduleTitle =
    selectedWeekDate === todayKey
      ? "Today’s Schedule"
      : `${selectedWeekItem?.fullDay || "Selected Day"} Schedule`;

  const calendarGrid = getCalendarGrid();
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
              <Text style={styles.greeting}>Good day</Text>

              <Text
                style={styles.username}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                Welcome to SchedWise
              </Text>
            </View>

            <View style={styles.logoCircle}>
              <Image
                source={require("../../assets/images/SchedLogo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.weekSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderTextArea}>
              <Text style={styles.sectionTitle}>This Week</Text>
              <Text style={styles.sectionSubtitle}>
                {getWeekRangeText(currentWeekDays)}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.viewMonthButton}
              onPress={() => router.push("/calendar")}
            >
              <Text style={styles.viewText}>View Month</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={weekScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.weekScroll}
            contentContainerStyle={styles.daysRow}
          >
            {currentWeekDays.map((item, index) => {
              const isSelected = selectedWeekDate === item.dateKey;
              const scheduleCount = displayedSchedules.filter(
                (schedule) => schedule.date === item.dateKey
              ).length;
              const isLastDay = index === currentWeekDays.length - 1;

              return (
                <TouchableOpacity
                  key={item.dateKey}
                  activeOpacity={0.85}
                  onPress={() => setSelectedWeekDate(item.dateKey)}
                  style={[
                    styles.dayCard,
                    !isLastDay && styles.dayCardSpacing,
                    isSelected && styles.activeDayCard,
                    item.isToday && !isSelected && styles.todayDayCard,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.activeDayText,
                    ]}
                  >
                    {item.day}
                  </Text>

                  <Text
                    style={[
                      styles.dateText,
                      isSelected && styles.activeDateText,
                    ]}
                  >
                    {item.date}
                  </Text>

                  <Text
                    style={[
                      styles.monthText,
                      isSelected && styles.activeMonthText,
                    ]}
                  >
                    {item.month}
                  </Text>

                  {scheduleCount > 0 ? (
                    <View
                      style={[
                        styles.dayDot,
                        isSelected && styles.activeDayDot,
                      ]}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.scheduleSectionHeader}>
            <View style={styles.sectionHeaderTextArea}>
              <Text style={styles.sectionTitle}>{selectedScheduleTitle}</Text>
            </View>
          </View>

          {selectedDaySchedules.length === 0 ? (
            <View style={styles.emptyScheduleCard}>
              <View style={styles.emptyScheduleIcon}>
                <Feather name="calendar" size={24} color="#65a1ff" />
              </View>
              <Text style={styles.emptyScheduleTitle}>
                No schedule for this day
              </Text>
              <Text style={styles.emptyScheduleText}>
                Tap the + button to add a task, deadline, reminder, or subtask.
              </Text>
            </View>
          ) : (
            selectedDaySchedules.map((item, index) => (
              <View
                key={`${String(item.id)}-${item.date}-${item.timeOnly}-${index}`}
                style={styles.scheduleCard}
              >
                <View
                  style={[styles.timeLine, { backgroundColor: item.color }]}
                />

                <View style={styles.scheduleContent}>
                  <View style={styles.scheduleTop}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.taskCheckbox,
                        item.completed && styles.taskCheckboxCompleted,
                      ]}
                      onPress={() =>
                        handleOpenProofModal({
                          type: "task",
                          scheduleId: item.id,
                        })
                      }
                    >
                      {item.completed ? (
                        <Feather name="check" size={16} color="#ffffff" />
                      ) : null}
                    </TouchableOpacity>

                    <View style={styles.scheduleTitleArea}>
                      <View style={styles.scheduleTitleRow}>
                        <Text
                          style={[
                            styles.scheduleTitle,
                            item.completed && styles.completedScheduleTitle,
                          ]}
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>
                      </View>

                      {item.completed ? (
                        <Text style={styles.proofSubmittedText}>
                          Proof submitted
                        </Text>
                      ) : (
                        <Text style={styles.proofRequiredText}>
                          Proof required before completion
                        </Text>
                      )}
                    </View>

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

                  <View style={styles.scheduleMetaRow}>
                    <View style={styles.metaPill}>
                      <Feather name="clock" size={13} color="#8ea2c1" />
                      <Text style={styles.metaPillText}>{item.timeOnly}</Text>
                    </View>

                    {item.reminderEnabled ? (
                      <View style={styles.metaPill}>
                        <Feather name="bell" size={13} color="#8ea2c1" />
                        <Text style={styles.metaPillText} numberOfLines={1}>
                          {item.reminderTime}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {item.subtasks?.length > 0 ? (
                    <View style={styles.subtaskBox}>
                      <View style={styles.subtaskHeader}>
                        <Feather
                          name="check-square"
                          size={14}
                          color="#65a1ff"
                        />
                        <Text style={styles.subtaskLabel}>Subtasks</Text>
                      </View>

                      {item.subtasks.map((subtask, subtaskIndex) => (
                        <View
                          key={`${String(item.id)}-subtask-${String(
                            subtask.id
                          )}-${subtaskIndex}`}
                          style={styles.subtaskRow}
                        >
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[
                              styles.subtaskCheckbox,
                              subtask.completed &&
                                styles.subtaskCheckboxCompleted,
                            ]}
                            onPress={() =>
                              handleOpenProofModal({
                                type: "subtask",
                                scheduleId: item.id,
                                subtaskId: subtask.id,
                              })
                            }
                          >
                            {subtask.completed ? (
                              <Feather
                                name="check"
                                size={13}
                                color="#ffffff"
                              />
                            ) : null}
                          </TouchableOpacity>

                          <View style={styles.subtaskTextArea}>
                            <Text
                              style={[
                                styles.subtaskText,
                                subtask.completed &&
                                  styles.completedSubtaskText,
                              ]}
                            >
                              {subtask.text}
                            </Text>

                            {subtask.completed ? (
                              <Text style={styles.subtaskProofText}>
                                Proof submitted
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <TouchableOpacity
        style={styles.floatingAddButton}
        activeOpacity={0.88}
        onPress={() => setModalVisible(true)}
      >
        <Feather name="plus" size={30} color="#ffffff" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalCard}>
            <View style={styles.dragHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Feather name="calendar" size={24} color="#ffffff" />
              </View>

              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>New Schedule</Text>
                <Text style={styles.modalSubtitle}>
                  Add a task, deadline, class activity, subtasks, and reminders.
                </Text>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}
            >
              <Text style={styles.inputLabel}>Schedule Title</Text>

              <View style={styles.inputWrapper}>
                <Feather name="edit-3" size={18} color="#65a1ff" />

                <TextInput
                  style={styles.inputField}
                  placeholder="Example: Math Quiz"
                  placeholderTextColor={theme.placeholder}
                  value={scheduleTitle}
                  onChangeText={setScheduleTitle}
                />
              </View>

              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeItem}>
                  <Text style={styles.inputLabel}>Date</Text>

                  <TouchableOpacity
                    style={styles.pickerInput}
                    activeOpacity={0.85}
                    onPress={openDatePicker}
                  >
                    <Feather name="calendar" size={18} color="#65a1ff" />

                    <Text
                      style={
                        scheduleDate
                          ? styles.pickerInputText
                          : styles.pickerPlaceholder
                      }
                      numberOfLines={1}
                    >
                      {scheduleDate || "Select date"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dateTimeSpacer} />

                <View style={styles.dateTimeItem}>
                  <Text style={styles.inputLabel}>Time</Text>

                  <TouchableOpacity
                    style={styles.pickerInput}
                    activeOpacity={0.85}
                    onPress={openTimePicker}
                  >
                    <Feather name="clock" size={18} color="#65a1ff" />

                    <Text
                      style={
                        scheduleTime
                          ? styles.pickerInputText
                          : styles.pickerPlaceholder
                      }
                      numberOfLines={1}
                    >
                      {scheduleTime || "Select time"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.inputLabel}>Subtasks</Text>

              <View style={styles.textAreaWrapper}>
                <Feather
                  name="check-square"
                  size={18}
                  color="#65a1ff"
                  style={styles.textAreaIcon}
                />

                <TextInput
                  style={styles.textArea}
                  placeholder="Add subtasks, one per line..."
                  placeholderTextColor={theme.placeholder}
                  value={scheduleSubtasksText}
                  onChangeText={setScheduleSubtasksText}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.subtaskHintBox}>
                <Feather name="info" size={15} color="#65a1ff" />
                <Text style={styles.subtaskHintText}>
                  Each subtask will get its own checkbox. Proof is required
                  before marking it complete.
                </Text>
              </View>

              <View style={styles.reminderCard}>
                <View style={styles.reminderHeader}>
                  <View style={styles.reminderHeaderText}>
                    <Text style={styles.reminderTitle}>
                      Reminder is {reminderEnabled ? "on" : "off"}
                    </Text>

                    <Text style={styles.reminderSubtitle}>
                      Choose when SchedWise should remind you.
                    </Text>
                  </View>

                  <Switch
                    value={reminderEnabled}
                    onValueChange={setReminderEnabled}
                    trackColor={{
                      false: theme.switchOff,
                      true: theme.primarySoft,
                    }}
                    thumbColor={reminderEnabled ? theme.primary : theme.muted}
                  />
                </View>

                {reminderEnabled ? (
                  <View style={styles.reminderOptions}>
                    <Text style={styles.reminderAtText}>Reminder at</Text>

                    {reminderOptions.map((option) => {
                      const isSelected = selectedReminder === option;

                      return (
                        <TouchableOpacity
                          key={option}
                          style={styles.reminderOptionRow}
                          activeOpacity={0.8}
                          onPress={() => handleSelectReminderOption(option)}
                        >
                          <View
                            style={[
                              styles.reminderCheckbox,
                              isSelected && styles.reminderCheckboxActive,
                            ]}
                          >
                            {isSelected ? (
                              <Feather name="check" size={18} color="#ffffff" />
                            ) : null}
                          </View>

                          <View style={styles.reminderOptionTextArea}>
                            <Text
                              style={[
                                styles.reminderOptionText,
                                isSelected && styles.reminderOptionTextActive,
                              ]}
                            >
                              {option}
                            </Text>

                            {option === "Customize time" &&
                            selectedReminder === "Customize time" ? (
                              <Text style={styles.customReminderSmallText}>
                                {getCustomReminderLabel()}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View style={styles.autoPriorityNote}>
                <View style={styles.noteIconCircle}>
                  <Feather name="zap" size={16} color="#ffffff" />
                </View>

                <View style={styles.noteTextArea}>
                  <Text style={styles.noteTitle}>Automatic Priority</Text>
                  <Text style={styles.autoPriorityText}>
                    Today’s tasks keep High/Medium/Low ranking. Tomorrow’s tasks
                    are Medium Priority. Later tasks are Low Priority.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.85}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (savingSchedule || checkingConflicts) &&
                    styles.conflictDisabledButton,
                ]}
                activeOpacity={0.85}
                disabled={savingSchedule || checkingConflicts}
                onPress={handleSaveSchedule}
              >
                <Feather name="check" size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>
                  {checkingConflicts
                    ? "Checking AI..."
                    : savingSchedule
                    ? "Saving..."
                    : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={conflictModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={clearConflictState}
      >
        <View style={styles.conflictOverlay}>
          <View style={styles.conflictCard}>
            <View style={styles.conflictTopAccent} />

            <View style={styles.conflictIconOuter}>
              <View style={styles.conflictIconCircle}>
                <Feather name="alert-triangle" size={28} color="#ffffff" />
              </View>
            </View>

            <Text style={styles.conflictTitle}>Schedule Conflict Detected</Text>

            <Text style={styles.conflictSubtitle}>
              This schedule may overlap with another task, duplicate an existing
              one, or use the same time entry.
            </Text>

            <View style={styles.conflictSummaryBox}>
              <View style={styles.conflictSummaryHeader}>
                <View style={styles.conflictSummaryIcon}>
                  <Feather name="info" size={14} color={theme.warning} />
                </View>

                <Text style={styles.conflictSummaryTitle}>Conflict Details</Text>
              </View>

              <Text style={styles.conflictSummaryText}>
                {buildConflictSummary(detectedConflicts)}
              </Text>
            </View>

            {conflictSuggestions.length > 0 ? (
              <View style={styles.suggestionBox}>
                <View style={styles.suggestionHeaderRow}>
                  <Text style={styles.suggestionTitle}>
                    Rescheduling Suggestions
                  </Text>

                  <View style={styles.suggestionCountPill}>
                    <Text style={styles.suggestionCountText}>
                      {conflictSuggestions.length}
                    </Text>
                  </View>
                </View>

                {conflictSuggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={`${suggestion.date}-${suggestion.timeOnly}`}
                    style={styles.suggestionOption}
                    activeOpacity={0.88}
                    onPress={() => handleUseSuggestedScheduleTime(suggestion)}
                  >
                    <View style={styles.suggestionIconBox}>
                      <Feather
                        name="clock"
                        size={17}
                        color={theme.primaryLight}
                      />
                    </View>

                    <View style={styles.suggestionTextArea}>
                      <Text style={styles.suggestionLabel} numberOfLines={1}>
                        {suggestion.label}
                      </Text>

                      <Text style={styles.suggestionWindow} numberOfLines={1}>
                        Available: {suggestion.windowText}
                      </Text>
                    </View>

                    <View style={styles.suggestionArrowBox}>
                      <Feather
                        name="chevron-right"
                        size={18}
                        color={theme.primaryLight}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.noSuggestionBox}>
                <Feather name="clock" size={18} color={theme.warning} />

                <Text style={styles.noSuggestionText}>
                  No available time suggestion was found for this day. Try
                  choosing a different date or time.
                </Text>
              </View>
            )}

            <View style={styles.conflictActions}>
              <TouchableOpacity
                style={styles.conflictCancelButton}
                activeOpacity={0.85}
                onPress={handleEditConflictingSchedule}
              >
                <Text style={styles.conflictCancelText} numberOfLines={1}>
                  Edit Schedule
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.conflictSaveButton,
                  savingSchedule && styles.conflictDisabledButton,
                ]}
                activeOpacity={0.85}
                onPress={handleSaveConflictingScheduleAnyway}
                disabled={savingSchedule}
              >
                <Text style={styles.conflictSaveText} numberOfLines={1}>
                  {savingSchedule ? "Saving..." : "Save Anyway"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={proofModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeProofModal}
      >
        <View style={styles.proofOverlay}>
          <View style={styles.proofCard}>
            <View style={styles.proofIconCircle}>
              <Feather name="upload-cloud" size={28} color="#ffffff" />
            </View>

            <Text style={styles.proofTitle}>Completion Proof Required</Text>

            <Text style={styles.proofSubtitle}>
              Upload a photo or screenshot before marking this as completed.
            </Text>

            <View style={styles.proofTargetBox}>
              <Text style={styles.proofTargetLabel}>
                {proofTarget?.type === "task" ? "Task" : "Subtask"}
              </Text>
              <Text style={styles.proofTargetText}>{getProofTargetTitle()}</Text>
            </View>

            {proofImageUri ? (
              <Image
                source={{ uri: proofImageUri }}
                style={styles.proofPreviewImage}
                resizeMode="cover"
              />
            ) : (
              <TouchableOpacity
                style={styles.proofUploadBox}
                activeOpacity={0.85}
                onPress={pickProofImage}
              >
                <Feather name="image" size={28} color="#65a1ff" />
                <Text style={styles.proofUploadText}>Upload proof image</Text>
                <Text style={styles.proofUploadSubtext}>
                  Photo, screenshot, or file evidence
                </Text>
              </TouchableOpacity>
            )}

            {proofImageUri ? (
              <TouchableOpacity
                style={styles.changeProofButton}
                activeOpacity={0.85}
                onPress={pickProofImage}
              >
                <Feather name="refresh-cw" size={16} color="#65a1ff" />
                <Text style={styles.changeProofText}>Change proof</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.proofActions}>
              <TouchableOpacity
                style={styles.proofCancelButton}
                activeOpacity={0.85}
                onPress={closeProofModal}
              >
                <Text style={styles.proofCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.proofSubmitButton}
                activeOpacity={0.85}
                onPress={handleSubmitProof}
              >
                <Feather name="check" size={18} color="#ffffff" />
                <Text style={styles.proofSubmitText}>Submit Proof</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.datePickerCard}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity
                style={styles.monthNavButton}
                activeOpacity={0.85}
                onPress={goToPreviousMonth}
              >
                <Feather name="chevron-left" size={22} color={theme.text} />
              </TouchableOpacity>

              <View style={styles.pickerHeaderCenter}>
                <Text style={styles.pickerTitle}>
                  {monthNames[pickerMonth]} {pickerYear}
                </Text>

                <Text style={styles.pickerSubtitle}>Choose schedule date</Text>
              </View>

              <TouchableOpacity
                style={styles.monthNavButton}
                activeOpacity={0.85}
                onPress={goToNextMonth}
              >
                <Feather name="chevron-right" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {weekDays.map((item) => (
                <Text key={item} style={styles.weekText}>
                  {item}
                </Text>
              ))}
            </View>

            <View style={styles.dateGrid}>
              {calendarGrid.map((item) => {
                const selectedDate =
                  item.day && scheduleDate === getFormattedPickerDate(item.day);

                return item.day ? (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.dateOption,
                      selectedDate && styles.selectedDateOption,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleSelectDate(item.day)}
                  >
                    <Text
                      style={[
                        styles.dateOptionText,
                        selectedDate && styles.selectedDateOptionText,
                      ]}
                    >
                      {item.day}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View key={item.key} style={styles.dateOption} />
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.pickerCancelButton}
              activeOpacity={0.85}
              onPress={() => setDatePickerVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerCard}>
            <Text style={styles.timePickerMainTitle}>Time</Text>

            <View style={styles.timeWheelFrame}>
              <View style={styles.timeWheelHighlight} />

              <View style={styles.timeWheelColumns}>
                <ScrollView
                  ref={hourScrollRef}
                  style={styles.timeWheelColumn}
                  contentContainerStyle={styles.timeWheelScrollContent}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={TIME_ITEM_HEIGHT}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  bounces={false}
                  nestedScrollEnabled
                  onMomentumScrollEnd={(event) =>
                    handleWheelScrollEnd(
                      event,
                      hourOptions,
                      setTempHour,
                      hourScrollRef
                    )
                  }
                  onScrollEndDrag={(event) =>
                    handleWheelDragEnd(
                      event,
                      hourOptions,
                      setTempHour,
                      hourScrollRef
                    )
                  }
                >
                  {hourOptions.map((hour, index) => (
                    <TouchableOpacity
                      key={hour}
                      style={styles.timeWheelRow}
                      activeOpacity={0.75}
                      onPress={() => {
                        setTempHour(hour);
                        hourScrollRef.current?.scrollTo({
                          y: index * TIME_ITEM_HEIGHT,
                          animated: true,
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.timeWheelText,
                          tempHour === hour && styles.timeWheelActiveText,
                        ]}
                      >
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.timeColonColumn}>
                  <Text style={styles.timeColonActiveText}>:</Text>
                </View>

                <ScrollView
                  ref={minuteScrollRef}
                  style={styles.timeWheelColumn}
                  contentContainerStyle={styles.timeWheelScrollContent}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={TIME_ITEM_HEIGHT}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  bounces={false}
                  nestedScrollEnabled
                  onMomentumScrollEnd={(event) =>
                    handleWheelScrollEnd(
                      event,
                      minuteOptions,
                      setTempMinute,
                      minuteScrollRef
                    )
                  }
                  onScrollEndDrag={(event) =>
                    handleWheelDragEnd(
                      event,
                      minuteOptions,
                      setTempMinute,
                      minuteScrollRef
                    )
                  }
                >
                  {minuteOptions.map((minute, index) => (
                    <TouchableOpacity
                      key={minute}
                      style={styles.timeWheelRow}
                      activeOpacity={0.75}
                      onPress={() => {
                        setTempMinute(minute);
                        minuteScrollRef.current?.scrollTo({
                          y: index * TIME_ITEM_HEIGHT,
                          animated: true,
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.timeWheelText,
                          tempMinute === minute && styles.timeWheelActiveText,
                        ]}
                      >
                        {minute}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ScrollView
                  ref={periodScrollRef}
                  style={styles.timePeriodColumn}
                  contentContainerStyle={styles.timeWheelScrollContent}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={TIME_ITEM_HEIGHT}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  bounces={false}
                  nestedScrollEnabled
                  onMomentumScrollEnd={(event) =>
                    handleWheelScrollEnd(
                      event,
                      periodOptions,
                      setTempPeriod,
                      periodScrollRef
                    )
                  }
                  onScrollEndDrag={(event) =>
                    handleWheelDragEnd(
                      event,
                      periodOptions,
                      setTempPeriod,
                      periodScrollRef
                    )
                  }
                >
                  {periodOptions.map((period, index) => (
                    <TouchableOpacity
                      key={period}
                      style={styles.timeWheelRow}
                      activeOpacity={0.75}
                      onPress={() => {
                        setTempPeriod(period);
                        periodScrollRef.current?.scrollTo({
                          y: index * TIME_ITEM_HEIGHT,
                          animated: true,
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.timePeriodText,
                          tempPeriod === period && styles.timePeriodActiveText,
                        ]}
                      >
                        {period.toLowerCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Text style={styles.presetsLabel}>Presets</Text>

            <View style={styles.presetsRow}>
              {presetTimes.map((preset, index) => {
                const isActive =
                  tempHour === preset.hour &&
                  tempMinute === preset.minute &&
                  tempPeriod === preset.period;

                return (
                  <TouchableOpacity
                    key={preset.label}
                    activeOpacity={0.85}
                    style={[
                      styles.presetButton,
                      isActive && styles.activePresetButton,
                      index !== presetTimes.length - 1 &&
                        styles.presetButtonSpacing,
                    ]}
                    onPress={() => handlePresetTime(preset)}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        isActive && styles.activePresetButtonText,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.timeDoneButton}
              activeOpacity={0.9}
              onPress={handleConfirmTime}
            >
              <Text style={styles.timeDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={customReminderVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setCustomReminderVisible(false)}
      >
        <View style={styles.customReminderOverlay}>
          <View style={styles.customReminderCard}>
            <Text style={styles.customReminderTitle}>
              Customize Reminder Time
            </Text>

            <View style={styles.customReminderWheelFrame}>
              <View style={styles.customReminderHighlight} />

              <View style={styles.customReminderColumns}>
                <ScrollView
                  ref={reminderNumberScrollRef}
                  style={styles.customReminderNumberColumn}
                  contentContainerStyle={styles.customReminderWheelContent}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={REMINDER_ITEM_HEIGHT}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  bounces={false}
                  nestedScrollEnabled
                  onMomentumScrollEnd={(event) =>
                    handleReminderWheelScrollEnd(
                      event,
                      reminderNumberOptions,
                      setCustomReminderValue,
                      reminderNumberScrollRef
                    )
                  }
                  onScrollEndDrag={(event) =>
                    handleReminderWheelDragEnd(
                      event,
                      reminderNumberOptions,
                      setCustomReminderValue,
                      reminderNumberScrollRef
                    )
                  }
                >
                  {reminderNumberOptions.map((value, index) => (
                    <TouchableOpacity
                      key={value}
                      style={styles.customReminderWheelRow}
                      activeOpacity={0.75}
                      onPress={() => {
                        setCustomReminderValue(value);
                        reminderNumberScrollRef.current?.scrollTo({
                          y: index * REMINDER_ITEM_HEIGHT,
                          animated: true,
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.customReminderWheelText,
                          customReminderValue === value &&
                            styles.customReminderWheelActiveText,
                        ]}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ScrollView
                  ref={reminderUnitScrollRef}
                  style={styles.customReminderUnitColumn}
                  contentContainerStyle={styles.customReminderWheelContent}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={REMINDER_ITEM_HEIGHT}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  bounces={false}
                  nestedScrollEnabled
                  onMomentumScrollEnd={(event) =>
                    handleReminderWheelScrollEnd(
                      event,
                      reminderUnitOptions,
                      setCustomReminderUnit,
                      reminderUnitScrollRef
                    )
                  }
                  onScrollEndDrag={(event) =>
                    handleReminderWheelDragEnd(
                      event,
                      reminderUnitOptions,
                      setCustomReminderUnit,
                      reminderUnitScrollRef
                    )
                  }
                >
                  {reminderUnitOptions.map((unit, index) => (
                    <TouchableOpacity
                      key={unit}
                      style={styles.customReminderWheelRow}
                      activeOpacity={0.75}
                      onPress={() => {
                        setCustomReminderUnit(unit);
                        reminderUnitScrollRef.current?.scrollTo({
                          y: index * REMINDER_ITEM_HEIGHT,
                          animated: true,
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.customReminderWheelText,
                          customReminderUnit === unit &&
                            styles.customReminderWheelActiveText,
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ScrollView
                  ref={reminderTimingScrollRef}
                  style={styles.customReminderTimingColumn}
                  contentContainerStyle={styles.customReminderWheelContent}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={REMINDER_ITEM_HEIGHT}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  bounces={false}
                  nestedScrollEnabled
                  onMomentumScrollEnd={(event) =>
                    handleReminderWheelScrollEnd(
                      event,
                      reminderTimingOptions,
                      setCustomReminderTiming,
                      reminderTimingScrollRef
                    )
                  }
                  onScrollEndDrag={(event) =>
                    handleReminderWheelDragEnd(
                      event,
                      reminderTimingOptions,
                      setCustomReminderTiming,
                      reminderTimingScrollRef
                    )
                  }
                >
                  {reminderTimingOptions.map((timing, index) => (
                    <TouchableOpacity
                      key={timing}
                      style={styles.customReminderWheelRow}
                      activeOpacity={0.75}
                      onPress={() => {
                        setCustomReminderTiming(timing);
                        reminderTimingScrollRef.current?.scrollTo({
                          y: index * REMINDER_ITEM_HEIGHT,
                          animated: true,
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.customReminderWheelText,
                          customReminderTiming === timing &&
                            styles.customReminderWheelActiveText,
                        ]}
                      >
                        {timing}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.customReminderPreviewPill}>
              <Text style={styles.customReminderPreviewText}>
                {getCustomReminderPreview()}
              </Text>
            </View>

            <View style={styles.customReminderActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCustomReminderVisible(false)}
              >
                <Text style={styles.customReminderCancelText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSaveCustomReminder}
              >
                <Text style={styles.customReminderSaveText}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
      paddingBottom: 145,
    },

    header: {
      paddingTop: TOP_SAFE_SPACE + 10,
      paddingHorizontal: 20,
      paddingBottom: 22,
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
      paddingRight: 12,
    },

    greeting: {
      color: theme.muted,
      fontSize: FONT_BODY,
      fontWeight: "600",
      lineHeight: 20,
    },

    username: {
      color: theme.text,
      fontSize: FONT_HEADER,
      fontWeight: "900",
      marginTop: 5,
      flexShrink: 1,
      lineHeight: 28,
    },

    logoCircle: {
      width: 62,
      height: 62,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      borderWidth: 0,
    },

    logoImage: {
      width: 60,
      height: 60,
    },

    weekSection: {
      paddingHorizontal: 20,
      marginTop: 16,
    },

    section: {
      paddingHorizontal: 20,
      marginTop: 18,
    },

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },

    sectionHeaderTextArea: {
      flex: 1,
      paddingRight: 12,
    },

    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 25,
    },

    sectionSubtitle: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      fontWeight: "700",
      marginTop: 4,
      lineHeight: 17,
    },

    viewMonthButton: {
      minHeight: 30,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 2,
    },

    viewText: {
      color: theme.primaryLight,
      fontSize: FONT_LABEL,
      fontWeight: "800",
      lineHeight: 18,
    },

    weekScroll: {
      marginHorizontal: -20,
    },

    daysRow: {
      paddingHorizontal: 20,
      paddingTop: 12,
    },

    dayCard: {
      width: 66,
      minHeight: 96,
      borderRadius: 22,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },

    dayCardSpacing: {
      marginRight: 12,
    },

    activeDayCard: {
      backgroundColor: theme.primary,
      borderColor: theme.primarySoft,
      shadowColor: theme.primary,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 7,
    },

    todayDayCard: {
      borderColor: theme.primaryBorderStrong,
      backgroundColor: theme.primaryTintSoft,
    },

    dayText: {
      color: theme.muted,
      fontSize: FONT_LABEL,
      fontWeight: "800",
      lineHeight: 17,
      textAlign: "center",
    },

    activeDayText: {
      color: theme.onPrimary,
    },

    dateText: {
      color: theme.text,
      fontSize: 23,
      fontWeight: "900",
      marginTop: 7,
      lineHeight: 27,
      textAlign: "center",
    },

    activeDateText: {
      color: theme.onPrimary,
    },

    monthText: {
      color: theme.placeholder,
      fontSize: FONT_TINY,
      fontWeight: "900",
      marginTop: 2,
      lineHeight: 13,
      textAlign: "center",
    },

    activeMonthText: {
      color: theme.onPrimary,
    },

    dayDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.primaryLight,
      marginTop: 7,
    },

    activeDayDot: {
      backgroundColor: theme.text,
    },

    scheduleSectionHeader: {
      marginBottom: 10,
    },

    scheduleCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
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

    scheduleContent: {
      flex: 1,
      minWidth: 0,
    },

    scheduleTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      width: "100%",
    },

    taskCheckbox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.placeholder,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
      marginTop: 1,
    },

    taskCheckboxCompleted: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },

    scheduleTitleArea: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },

    scheduleTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 30,
    },

    scheduleTitle: {
      flex: 1,
      color: theme.text,
      fontSize: FONT_MEDIUM,
      fontWeight: "900",
      lineHeight: 20,
      flexShrink: 1,
    },

    completedScheduleTitle: {
      color: theme.muted,
      textDecorationLine: "line-through",
    },

    proofRequiredText: {
      color: theme.warning,
      fontSize: FONT_SMALL,
      fontWeight: "700",
      marginTop: 5,
      lineHeight: 16,
    },

    proofSubmittedText: {
      color: theme.success,
      fontSize: FONT_SMALL,
      fontWeight: "800",
      marginTop: 5,
      lineHeight: 16,
    },

    priorityBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 11,
      alignSelf: "flex-start",
      marginTop: 2,
    },

    priorityText: {
      fontSize: FONT_TINY,
      fontWeight: "900",
      lineHeight: 13,
      textAlign: "center",
    },

    scheduleMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 11,
    },

    metaPill: {
      minHeight: 32,
      borderRadius: 13,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      marginRight: 8,
      marginBottom: 8,
      maxWidth: "100%",
    },

    metaPillText: {
      color: theme.softText,
      fontSize: FONT_SMALL,
      fontWeight: "800",
      marginLeft: 6,
      maxWidth: 150,
      lineHeight: 16,
    },

    emptyScheduleCard: {
      backgroundColor: theme.primaryTintSoft,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      borderRadius: 24,
      padding: 18,
      alignItems: "center",
    },

    emptyScheduleIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },

    emptyScheduleTitle: {
      color: theme.text,
      fontSize: FONT_MEDIUM,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 20,
    },

    emptyScheduleText: {
      color: theme.muted,
      fontSize: FONT_LABEL,
      lineHeight: 19,
      textAlign: "center",
      marginTop: 6,
      fontWeight: "600",
    },

    subtaskBox: {
      backgroundColor: theme.primaryTintSoft,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      borderRadius: 14,
      padding: 10,
      marginTop: 12,
    },

    subtaskHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },

    subtaskLabel: {
      color: theme.primaryLight,
      fontSize: FONT_SMALL,
      fontWeight: "900",
      marginLeft: 6,
      lineHeight: 16,
    },

    subtaskRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 7,
    },

    subtaskCheckbox: {
      width: 23,
      height: 23,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: theme.placeholder,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    subtaskCheckboxCompleted: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },

    subtaskTextArea: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },

    subtaskText: {
      color: theme.softText,
      fontSize: FONT_SMALL,
      lineHeight: 18,
      fontWeight: "700",
      flexShrink: 1,
    },

    completedSubtaskText: {
      color: theme.muted,
      textDecorationLine: "line-through",
    },

    subtaskProofText: {
      color: theme.success,
      fontSize: FONT_TINY,
      fontWeight: "800",
      marginTop: 3,
      lineHeight: 13,
    },

    bottomSpace: {
      height: 10,
    },

    floatingAddButton: {
      position: "absolute",
      right: 22,
      bottom: Platform.OS === "ios" ? 105 : 92,
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.primary,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 12,
      zIndex: 50,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: "flex-end",
    },

    modalCard: {
      maxHeight: "92%",
      backgroundColor: theme.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === "ios" ? 30 : 22,
      borderWidth: 1,
      borderColor: theme.border,
    },

    dragHandle: {
      width: 44,
      height: 5,
      borderRadius: 100,
      backgroundColor: theme.handle,
      alignSelf: "center",
      marginBottom: 18,
    },

    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
    },

    modalIconBox: {
      width: 50,
      height: 50,
      borderRadius: 17,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    modalHeaderText: {
      flex: 1,
    },

    modalTitle: {
      color: theme.text,
      fontSize: FONT_MODAL_TITLE,
      fontWeight: "900",
      lineHeight: 28,
    },

    modalSubtitle: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      marginTop: 5,
      lineHeight: 17,
      fontWeight: "600",
    },

    formContent: {
      paddingBottom: 18,
    },

    inputLabel: {
      color: theme.text,
      fontSize: FONT_BODY,
      fontWeight: "800",
      marginBottom: 8,
      lineHeight: 19,
    },

    inputWrapper: {
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },

    inputField: {
      flex: 1,
      color: theme.text,
      fontSize: FONT_BODY,
      marginLeft: 10,
      paddingVertical: 0,
      height: "100%",
      textAlignVertical: "center",
    },

    pickerInput: {
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },

    pickerInputText: {
      flex: 1,
      color: theme.text,
      fontSize: FONT_BODY,
      fontWeight: "800",
      marginLeft: 10,
      lineHeight: 19,
    },

    pickerPlaceholder: {
      flex: 1,
      color: theme.placeholder,
      fontSize: FONT_BODY,
      fontWeight: "700",
      marginLeft: 10,
      lineHeight: 19,
    },

    dateTimeRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },

    dateTimeItem: {
      flex: 1,
    },

    dateTimeSpacer: {
      width: 12,
    },

    textAreaWrapper: {
      minHeight: 115,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: 14,
      paddingTop: 14,
      marginBottom: 10,
    },

    textAreaIcon: {
      marginTop: 2,
    },

    textArea: {
      flex: 1,
      minHeight: 90,
      color: theme.text,
      fontSize: FONT_BODY,
      marginLeft: 10,
      paddingTop: 0,
      paddingBottom: 0,
      lineHeight: 20,
    },

    subtaskHintBox: {
      backgroundColor: theme.primaryTintSoft,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      borderRadius: 15,
      padding: 12,
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 16,
    },

    subtaskHintText: {
      flex: 1,
      color: theme.muted,
      fontSize: FONT_SMALL,
      lineHeight: 17,
      fontWeight: "700",
      marginLeft: 8,
    },

    reminderCard: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 22,
      padding: 16,
      marginBottom: 16,
    },

    reminderHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    reminderHeaderText: {
      flex: 1,
      paddingRight: 12,
    },

    reminderTitle: {
      color: theme.text,
      fontSize: FONT_TITLE,
      fontWeight: "900",
      lineHeight: 23,
    },

    reminderSubtitle: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      marginTop: 4,
      lineHeight: 17,
      fontWeight: "600",
    },

    reminderOptions: {
      marginTop: 18,
    },

    reminderAtText: {
      color: theme.text,
      fontSize: FONT_BODY,
      fontWeight: "800",
      marginBottom: 10,
      lineHeight: 19,
    },

    reminderOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
      paddingVertical: 8,
    },

    reminderCheckbox: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.placeholder,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 13,
    },

    reminderCheckboxActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },

    reminderOptionTextArea: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },

    reminderOptionText: {
      color: theme.muted,
      fontSize: FONT_BODY,
      fontWeight: "700",
      lineHeight: 19,
    },

    reminderOptionTextActive: {
      color: theme.text,
      fontWeight: "900",
    },

    customReminderSmallText: {
      color: theme.primaryLight,
      fontSize: FONT_BODY,
      fontWeight: "800",
      marginTop: 3,
      lineHeight: 19,
    },

    autoPriorityNote: {
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      borderRadius: 18,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
    },

    noteIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 13,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    noteTextArea: {
      flex: 1,
    },

    noteTitle: {
      color: theme.text,
      fontSize: FONT_LABEL,
      fontWeight: "900",
      marginBottom: 3,
      lineHeight: 18,
    },

    autoPriorityText: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      lineHeight: 17,
      fontWeight: "600",
    },

    modalActions: {
      flexDirection: "row",
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.borderSoft,
    },

    cancelButton: {
      flex: 1,
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },

    cancelButtonText: {
      color: theme.softText,
      fontSize: FONT_MEDIUM,
      fontWeight: "900",
      lineHeight: 20,
    },

    saveButton: {
      flex: 1,
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },

    saveButtonText: {
      color: theme.onPrimary,
      fontSize: FONT_MEDIUM,
      fontWeight: "900",
      marginLeft: 7,
      lineHeight: 20,
    },

    conflictOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },

    conflictCard: {
      width: "100%",
      maxHeight: "90%",
      backgroundColor: theme.background,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      paddingHorizontal: 18,
      paddingTop: 22,
      paddingBottom: 18,
      alignItems: "center",
      overflow: "hidden",
      shadowColor: theme.shadow,
      shadowOpacity: 0.24,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },

    conflictTopAccent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 5,
      backgroundColor: theme.warning,
    },

    conflictIconOuter: {
      width: 76,
      height: 76,
      borderRadius: 26,
      backgroundColor: theme.primaryTintSoft,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 13,
    },

    conflictIconCircle: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: theme.warning,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.warning,
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 7,
    },

    conflictTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 25,
    },

    conflictSubtitle: {
      color: theme.muted,
      fontSize: FONT_LABEL,
      lineHeight: 20,
      textAlign: "center",
      marginTop: 7,
      fontWeight: "700",
      paddingHorizontal: 4,
    },

    conflictSummaryBox: {
      width: "100%",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      padding: 14,
      marginTop: 17,
    },

    conflictSummaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },

    conflictSummaryIcon: {
      width: 24,
      height: 24,
      borderRadius: 9,
      backgroundColor: `${theme.warning}22`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },

    conflictSummaryTitle: {
      color: theme.warning,
      fontSize: FONT_SMALL,
      fontWeight: "900",
      lineHeight: 16,
    },

    conflictSummaryText: {
      color: theme.text,
      fontSize: FONT_LABEL,
      fontWeight: "700",
      lineHeight: 20,
    },

    suggestionBox: {
      width: "100%",
      marginTop: 15,
    },

    suggestionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    suggestionTitle: {
      color: theme.text,
      fontSize: FONT_BODY,
      fontWeight: "900",
      lineHeight: 19,
    },

    suggestionCountPill: {
      minWidth: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },

    suggestionCountText: {
      color: theme.primaryLight,
      fontSize: FONT_SMALL,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 16,
    },

    suggestionOption: {
      minHeight: 66,
      borderRadius: 19,
      backgroundColor: theme.primaryTintSoft,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 9,
    },

    suggestionIconBox: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
    },

    suggestionTextArea: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },

    suggestionLabel: {
      color: theme.text,
      fontSize: FONT_LABEL,
      fontWeight: "900",
      lineHeight: 18,
    },

    suggestionWindow: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      fontWeight: "700",
      lineHeight: 17,
      marginTop: 4,
    },

    suggestionArrowBox: {
      width: 30,
      height: 30,
      borderRadius: 11,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },

    noSuggestionBox: {
      width: "100%",
      backgroundColor: theme.primaryTintSoft,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      borderRadius: 18,
      padding: 14,
      marginTop: 15,
      flexDirection: "row",
      alignItems: "flex-start",
    },

    noSuggestionText: {
      flex: 1,
      color: theme.muted,
      fontSize: FONT_LABEL,
      fontWeight: "700",
      lineHeight: 19,
      marginLeft: 9,
    },

    conflictActions: {
      flexDirection: "row",
      width: "100%",
      marginTop: 17,
    },

    conflictCancelButton: {
      flex: 1,
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
      paddingHorizontal: 0,
    },

    conflictCancelText: {
      width: "100%",
      color: theme.softText,
      fontSize: FONT_BODY,
      fontWeight: "900",
      lineHeight: 19,
      textAlign: "center",
      includeFontPadding: false,
      textAlignVertical: "center",
    },

    conflictSaveButton: {
      flex: 1,
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.warning,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
      paddingHorizontal: 0,
      flexDirection: "column",
      shadowColor: theme.warning,
      shadowOpacity: 0.25,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 5 },
      elevation: 6,
    },

    conflictDisabledButton: {
      opacity: 0.65,
    },

    conflictSaveText: {
      width: "100%",
      color: theme.onPrimary,
      fontSize: FONT_BODY,
      fontWeight: "900",
      lineHeight: 19,
      textAlign: "center",
      includeFontPadding: false,
      textAlignVertical: "center",
    },

    proofOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },

    proofCard: {
      width: "100%",
      backgroundColor: theme.background,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      alignItems: "center",
    },

    proofIconCircle: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },

    proofTitle: {
      color: theme.text,
      fontSize: FONT_TITLE,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 23,
    },

    proofSubtitle: {
      color: theme.muted,
      fontSize: FONT_LABEL,
      lineHeight: 19,
      textAlign: "center",
      marginTop: 7,
      fontWeight: "600",
    },

    proofTargetBox: {
      width: "100%",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 14,
      marginTop: 16,
      marginBottom: 15,
    },

    proofTargetLabel: {
      color: theme.primaryLight,
      fontSize: FONT_SMALL,
      fontWeight: "900",
      marginBottom: 5,
      lineHeight: 16,
    },

    proofTargetText: {
      color: theme.text,
      fontSize: FONT_BODY,
      fontWeight: "800",
      lineHeight: 19,
    },

    proofUploadBox: {
      width: "100%",
      height: 150,
      borderRadius: 20,
      backgroundColor: theme.dashedBg,
      borderWidth: 1,
      borderColor: theme.dashedBorder,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },

    proofUploadText: {
      color: theme.text,
      fontSize: FONT_BODY,
      fontWeight: "900",
      marginTop: 8,
      lineHeight: 19,
    },

    proofUploadSubtext: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      fontWeight: "700",
      marginTop: 4,
      lineHeight: 16,
    },

    proofPreviewImage: {
      width: "100%",
      height: 180,
      borderRadius: 20,
      marginBottom: 12,
    },

    changeProofButton: {
      height: 40,
      borderRadius: 14,
      paddingHorizontal: 14,
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },

    changeProofText: {
      color: theme.primaryLight,
      fontSize: FONT_LABEL,
      fontWeight: "900",
      marginLeft: 7,
      lineHeight: 18,
    },

    proofActions: {
      flexDirection: "row",
      width: "100%",
      marginTop: 14,
    },

    proofCancelButton: {
      flex: 1,
      height: 52,
      borderRadius: 17,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    proofCancelText: {
      color: theme.softText,
      fontSize: FONT_BODY,
      fontWeight: "900",
      lineHeight: 19,
    },

    proofSubmitButton: {
      flex: 1,
      height: 52,
      borderRadius: 17,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 9,
    },

    proofSubmitText: {
      color: theme.onPrimary,
      fontSize: FONT_BODY,
      fontWeight: "900",
      marginLeft: 7,
      lineHeight: 19,
    },

    pickerOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },

    datePickerCard: {
      width: "100%",
      backgroundColor: theme.background,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
    },

    pickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },

    pickerHeaderCenter: {
      alignItems: "center",
      flex: 1,
      paddingHorizontal: 10,
    },

    monthNavButton: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    pickerTitle: {
      color: theme.text,
      fontSize: FONT_HEADER,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 28,
    },

    pickerSubtitle: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      marginTop: 4,
      textAlign: "center",
      lineHeight: 16,
    },

    weekRow: {
      flexDirection: "row",
      marginBottom: 10,
    },

    weekText: {
      flex: 1,
      color: theme.primaryLight,
      fontSize: FONT_SMALL,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 16,
    },

    dateGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },

    dateOption: {
      width: `${100 / 7}%`,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      marginBottom: 6,
    },

    selectedDateOption: {
      backgroundColor: theme.primary,
    },

    dateOptionText: {
      color: theme.text,
      fontSize: FONT_BODY,
      fontWeight: "800",
      textAlign: "center",
      lineHeight: 19,
    },

    selectedDateOptionText: {
      color: theme.onPrimary,
      fontWeight: "900",
    },

    pickerCancelButton: {
      height: 50,
      borderRadius: 16,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },

    pickerCancelText: {
      color: theme.softText,
      fontSize: FONT_BODY,
      fontWeight: "900",
      lineHeight: 19,
    },

    timePickerOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },

    timePickerCard: {
      width: "100%",
      backgroundColor: theme.background,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
    },

    timePickerMainTitle: {
      color: theme.text,
      fontSize: FONT_WHEEL,
      fontWeight: "900",
      textAlign: "center",
      marginBottom: 8,
      lineHeight: 21,
    },

    timeWheelFrame: {
      height: 190,
      justifyContent: "center",
      marginBottom: 14,
    },

    timeWheelHighlight: {
      position: "absolute",
      left: 36,
      right: 36,
      top: 76,
      height: 38,
      borderRadius: 13,
      backgroundColor: theme.primaryTintStrong,
      borderWidth: 1,
      borderColor: theme.dashedBorder,
    },

    timeWheelColumns: {
      height: TIME_ITEM_HEIGHT * 5,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    timeWheelColumn: {
      width: 58,
      height: TIME_ITEM_HEIGHT * 5,
    },

    timePeriodColumn: {
      width: 62,
      height: TIME_ITEM_HEIGHT * 5,
    },

    timeWheelScrollContent: {
      paddingVertical: TIME_WHEEL_PADDING,
    },

    timeColonColumn: {
      width: 22,
      height: TIME_ITEM_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },

    timeWheelRow: {
      height: TIME_ITEM_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },

    timeWheelText: {
      color: theme.placeholder,
      fontSize: FONT_WHEEL,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 21,
    },

    timeWheelActiveText: {
      color: theme.text,
      fontSize: FONT_HEADER,
      fontWeight: "900",
      lineHeight: 28,
    },

    timeColonActiveText: {
      color: theme.text,
      fontSize: FONT_HEADER,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 28,
    },

    timePeriodText: {
      color: theme.placeholder,
      fontSize: FONT_MEDIUM,
      fontWeight: "800",
      textTransform: "lowercase",
      textAlign: "center",
      lineHeight: 20,
    },

    timePeriodActiveText: {
      color: theme.text,
      fontSize: FONT_WHEEL_ACTIVE,
      fontWeight: "900",
      lineHeight: 23,
    },

    presetsLabel: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      fontWeight: "900",
      marginBottom: 9,
      lineHeight: 16,
    },

    presetsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 13,
    },

    presetButton: {
      flex: 1,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },

    presetButtonSpacing: {
      marginRight: 8,
    },

    activePresetButton: {
      borderColor: theme.primaryLight,
      backgroundColor: theme.primaryTintStrong,
    },

    presetButtonText: {
      color: theme.muted,
      fontSize: FONT_SMALL,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 16,
    },

    activePresetButtonText: {
      color: theme.primaryLight,
    },

    timeDoneButton: {
      height: 48,
      borderRadius: 15,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    timeDoneText: {
      color: theme.onPrimary,
      fontSize: FONT_BODY,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 19,
    },

    customReminderOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },

    customReminderCard: {
      width: "100%",
      backgroundColor: theme.background,
      borderRadius: 26,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 18,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.primary,
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },

    customReminderTitle: {
      color: theme.text,
      fontSize: FONT_TITLE,
      fontWeight: "900",
      marginBottom: 26,
      lineHeight: 23,
    },

    customReminderWheelFrame: {
      height: 112,
      justifyContent: "center",
    },

    customReminderHighlight: {
      position: "absolute",
      left: 14,
      right: 14,
      top: 36,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.primaryTintStrong,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
    },

    customReminderColumns: {
      height: REMINDER_ITEM_HEIGHT * 3,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    customReminderNumberColumn: {
      width: 60,
      height: REMINDER_ITEM_HEIGHT * 3,
    },

    customReminderUnitColumn: {
      width: 120,
      height: REMINDER_ITEM_HEIGHT * 3,
    },

    customReminderTimingColumn: {
      width: 95,
      height: REMINDER_ITEM_HEIGHT * 3,
    },

    customReminderWheelContent: {
      paddingVertical: REMINDER_WHEEL_PADDING,
    },

    customReminderWheelRow: {
      height: REMINDER_ITEM_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },

    customReminderWheelText: {
      color: theme.placeholder,
      fontSize: FONT_WHEEL,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 21,
    },

    customReminderWheelActiveText: {
      color: theme.text,
      fontSize: FONT_WHEEL_ACTIVE,
      fontWeight: "900",
      lineHeight: 23,
    },

    customReminderPreviewPill: {
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 14,
      marginTop: 18,
      paddingHorizontal: 12,
    },

    customReminderPreviewText: {
      color: theme.softText,
      fontSize: FONT_LABEL,
      fontWeight: "800",
      textAlign: "center",
      lineHeight: 18,
    },

    customReminderActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginTop: 22,
    },

    customReminderCancelText: {
      color: theme.muted,
      fontSize: FONT_BODY,
      fontWeight: "900",
      marginRight: 30,
      lineHeight: 19,
    },

    customReminderSaveText: {
      color: theme.primaryLight,
      fontSize: FONT_BODY,
      fontWeight: "900",
      lineHeight: 19,
    },
  });