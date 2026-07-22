import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Alert, AppState, DeviceEventEmitter, Linking, Platform } from "react-native";
import { getLocalSchedules } from "./localSchedules";
import { isScheduleCompleted } from "./scheduleStatus";
import { SCHEDULE_CHANGE_EVENT } from "./scheduleSummary";
import {
  computeReminderTriggerDate,
  normalizeStoredReminderTime,
  parseScheduleDateTime,
} from "./scheduleReminderUtils";

const REMINDER_STORAGE_KEY = "schedwise_schedule_reminder_ids";
const MISSED_STORAGE_KEY = "schedwise_missed_notification_ids";
const MISSED_SENT_STORAGE_KEY = "schedwise_missed_notification_sent";
const PUSH_TOKEN_STORAGE_KEY = "schedwise_fcm_push_token";
const REMINDER_CHANNEL_ID = "schedule-reminders";
const MISSED_CHANNEL_ID = "schedule-missed";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const getReminderNotificationIdentifier = (scheduleId) =>
  `schedwise-reminder-${String(scheduleId)}`;

const getMissedNotificationIdentifier = (scheduleId) =>
  `schedwise-missed-${String(scheduleId)}`;

const loadReminderMap = async () => {
  try {
    const stored = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveReminderMap = async (map) => {
  await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(map));
};

const loadMissedMap = async () => {
  try {
    const stored = await AsyncStorage.getItem(MISSED_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveMissedMap = async (map) => {
  await AsyncStorage.setItem(MISSED_STORAGE_KEY, JSON.stringify(map));
};

const loadMissedSentMap = async () => {
  try {
    const raw = await AsyncStorage.getItem(MISSED_SENT_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveMissedSentMap = async (map) => {
  await AsyncStorage.setItem(MISSED_SENT_STORAGE_KEY, JSON.stringify(map));
};

const getMissedSentKey = (scheduleId, firesAtKey) =>
  `${String(scheduleId)}:${firesAtKey}`;

const wasMissedNotificationSent = async (scheduleId, firesAtKey) => {
  if (!scheduleId || !firesAtKey) {
    return false;
  }

  const map = await loadMissedSentMap();
  return Boolean(map[getMissedSentKey(scheduleId, firesAtKey)]);
};

const markMissedNotificationSent = async (scheduleId, firesAtKey) => {
  if (!scheduleId || !firesAtKey) {
    return;
  }

  const map = await loadMissedSentMap();
  map[getMissedSentKey(scheduleId, firesAtKey)] = Date.now();
  await saveMissedSentMap(map);
};

const clearMissedNotificationSent = async (scheduleId) => {
  if (!scheduleId) {
    return;
  }

  const map = await loadMissedSentMap();
  const prefix = `${String(scheduleId)}:`;
  const nextMap = Object.fromEntries(
    Object.entries(map).filter(([key]) => !key.startsWith(prefix))
  );
  await saveMissedSentMap(nextMap);
};

const normalizeReminderEntry = (value) => {
  if (!value) {
    return { id: "", firesAt: "" };
  }

  if (typeof value === "string") {
    return { id: value, firesAt: "" };
  }

  return {
    id: String(value.id || ""),
    firesAt: String(value.firesAt || ""),
  };
};

const toExactTriggerDate = (triggerDate) => {
  const exactDate = new Date(triggerDate.getTime());
  exactDate.setMilliseconds(0);
  return exactDate;
};

const getReadableDueLabel = (schedule) => {
  const dueDate = parseScheduleDateTime(schedule.date, schedule.timeOnly);

  if (!dueDate) {
    return "your upcoming task";
  }

  return `${schedule.title || "Task"} on ${dueDate.toLocaleDateString()} at ${
    schedule.timeOnly
  }`;
};

const normalizeScheduleReminderFields = (schedule) => {
  if (!schedule) {
    return schedule;
  }

  const reminderTime = normalizeStoredReminderTime(schedule.reminderTime);

  return {
    ...schedule,
    reminderTime,
    reminderEnabled: Boolean(
      schedule.reminderEnabled ?? (reminderTime ? true : false)
    ),
  };
};

const ensureAndroidNotificationChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "Schedule Reminders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#4f7df3",
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync(MISSED_CHANNEL_ID, {
    name: "Missed Tasks",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: "#ef4444",
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

export const requestScheduleNotificationPermission = async () => {
  if (Platform.OS === "web") {
    return false;
  }

  await ensureAndroidNotificationChannel();

  const current = await Notifications.getPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: false,
    },
  });

  return Boolean(
    requested.granted ||
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
};

const buildNotificationTrigger = (
  triggerDate,
  channelId = REMINDER_CHANNEL_ID
) => {
  const exactTriggerDate = toExactTriggerDate(triggerDate);

  if (exactTriggerDate.getTime() <= Date.now()) {
    return null;
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: exactTriggerDate,
    channelId: Platform.OS === "android" ? channelId : undefined,
  };
};

const verifyScheduledNotification = async (identifier) => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.some((item) => item.identifier === identifier);
  } catch {
    return false;
  }
};

export const openReminderSettings = async () => {
  try {
    if (Platform.OS === "android" && Platform.Version >= 31) {
      const packageName =
        Constants.expoConfig?.android?.package || "com.loxanz.schedwise";

      try {
        await Linking.openURL(
          `android.settings.REQUEST_SCHEDULE_EXACT_ALARM?package=${packageName}`
        );
        return;
      } catch {
        // Fall through to app settings.
      }
    }

    await Linking.openSettings();
  } catch {
    Alert.alert(
      "Enable Reminders",
      "Open Android Settings, choose SchedWise, then enable Notifications and Alarms & reminders."
    );
  }
};

export const registerFirebasePushToken = async () => {
  const granted = await requestScheduleNotificationPermission();

  if (!granted) {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  try {
    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getDevicePushTokenAsync();

    const token = tokenResult?.data || "";

    if (token) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    }

    return token || null;
  } catch (error) {
    console.log("Push token registration error:", error?.message);
    return null;
  }
};

export const getStoredPushToken = async () => {
  try {
    return (await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY)) || "";
  } catch {
    return "";
  }
};

export const cancelScheduleReminder = async (scheduleId) => {
  const identifier = getReminderNotificationIdentifier(scheduleId);
  const reminderMap = await loadReminderMap();

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Ignore missing notification IDs.
  }

  delete reminderMap[String(scheduleId)];
  await saveReminderMap(reminderMap);
};

export const cancelMissedTaskNotification = async (scheduleId) => {
  const identifier = getMissedNotificationIdentifier(scheduleId);
  const missedMap = await loadMissedMap();

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Ignore missing notification IDs.
  }

  delete missedMap[String(scheduleId)];
  await saveMissedMap(missedMap);
};

const buildMissedNotificationContent = (schedule, firesAtKey = "") => ({
  title: "SchedWise Missed Task",
  body: `You missed ${schedule.title || "a task"} scheduled for ${schedule.timeOnly || "now"}.`,
  sound: "default",
  priority: Notifications.AndroidNotificationPriority.MAX,
  vibrate: [0, 300, 200, 300],
  data: {
    scheduleId: String(schedule.id),
    type: "schedule-missed",
    firesAt: firesAtKey,
  },
});

export const presentMissedTaskNotificationNow = async (
  schedule,
  dueDate = null
) => {
  if (!schedule?.id || isScheduleCompleted(schedule)) {
    return null;
  }

  const exactDueDate =
    toExactTriggerDate(dueDate) ||
    toExactTriggerDate(parseScheduleDateTime(schedule.date, schedule.timeOnly));
  if (!exactDueDate) {
    return null;
  }

  const firesAtKey = exactDueDate.toISOString();
  if (await wasMissedNotificationSent(schedule.id, firesAtKey)) {
    return null;
  }

  const granted = await requestScheduleNotificationPermission();
  if (!granted) {
    return null;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    identifier: getMissedNotificationIdentifier(schedule.id),
    content: buildMissedNotificationContent(schedule, firesAtKey),
    trigger: null,
  });

  await markMissedNotificationSent(schedule.id, firesAtKey);
  return notificationId;
};

export const syncMissedNotificationForSchedule = async (schedule) => {
  if (!schedule?.id || isScheduleCompleted(schedule)) {
    await cancelMissedTaskNotification(schedule?.id);
    await clearMissedNotificationSent(schedule.id);
    return null;
  }

  const dueDate = parseScheduleDateTime(schedule.date, schedule.timeOnly);
  const exactDueDate = toExactTriggerDate(dueDate);
  if (!exactDueDate) {
    await cancelMissedTaskNotification(schedule.id);
    return null;
  }

  const firesAtKey = exactDueDate.toISOString();
  if (await wasMissedNotificationSent(schedule.id, firesAtKey)) {
    await cancelMissedTaskNotification(schedule.id);
    return null;
  }

  if (exactDueDate.getTime() <= Date.now()) {
    await cancelMissedTaskNotification(schedule.id);
    return presentMissedTaskNotificationNow(schedule, exactDueDate);
  }

  return scheduleMissedTaskNotification(schedule, exactDueDate);
};

export const scheduleMissedTaskNotification = async (schedule, dueDate) => {
  if (!schedule?.id || isScheduleCompleted(schedule)) {
    await cancelMissedTaskNotification(schedule?.id);
    return null;
  }

  const granted = await requestScheduleNotificationPermission();

  if (!granted) {
    return null;
  }

  const exactDueDate = toExactTriggerDate(dueDate);
  const firesAtKey = exactDueDate.toISOString();
  const notificationIdentifier = getMissedNotificationIdentifier(schedule.id);
  const missedMap = await loadMissedMap();
  const existingEntry = normalizeReminderEntry(missedMap[String(schedule.id)]);

  if (existingEntry.firesAt === firesAtKey) {
    return existingEntry.id || null;
  }

  const trigger = buildNotificationTrigger(exactDueDate, MISSED_CHANNEL_ID);

  if (!trigger) {
    return presentMissedTaskNotificationNow(schedule, exactDueDate);
  }

  await cancelMissedTaskNotification(schedule.id);
  await clearMissedNotificationSent(schedule.id);

  const notificationId = await Notifications.scheduleNotificationAsync({
    identifier: notificationIdentifier,
    content: buildMissedNotificationContent(schedule, firesAtKey),
    trigger,
  });

  const missedMapAfter = await loadMissedMap();
  missedMapAfter[String(schedule.id)] = {
    id: notificationId,
    firesAt: firesAtKey,
  };
  await saveMissedMap(missedMapAfter);

  return notificationId;
};

export const syncReminderForSchedule = async (schedule) => {
  const normalizedSchedule = normalizeScheduleReminderFields(schedule);

  if (
    !normalizedSchedule?.id ||
    normalizedSchedule.completed ||
    !normalizedSchedule.reminderEnabled ||
    !normalizedSchedule.reminderTime
  ) {
    await cancelScheduleReminder(normalizedSchedule?.id);
    return null;
  }

  return scheduleScheduleReminder(normalizedSchedule);
};

export const scheduleScheduleReminder = async (schedule) => {
  const normalizedSchedule = normalizeScheduleReminderFields(schedule);

  if (
    !normalizedSchedule?.id ||
    !normalizedSchedule.reminderEnabled ||
    !normalizedSchedule.reminderTime
  ) {
    await cancelScheduleReminder(normalizedSchedule?.id);
    return null;
  }

  const granted = await requestScheduleNotificationPermission();

  if (!granted) {
    console.log("Schedule reminder skipped: notification permission not granted.");
    return null;
  }

  const triggerDate = computeReminderTriggerDate(normalizedSchedule);

  if (!triggerDate || triggerDate.getTime() <= Date.now()) {
    console.log(
      "Schedule reminder skipped: trigger time is missing or already passed.",
      {
        scheduleId: normalizedSchedule.id,
        title: normalizedSchedule.title,
        reminderTime: normalizedSchedule.reminderTime,
        dueAt: `${normalizedSchedule.date} ${normalizedSchedule.timeOnly}`,
      }
    );
    await cancelScheduleReminder(normalizedSchedule.id);
    return null;
  }

  const exactTriggerDate = toExactTriggerDate(triggerDate);
  const firesAtKey = exactTriggerDate.toISOString();
  const notificationIdentifier = getReminderNotificationIdentifier(
    normalizedSchedule.id
  );
  const reminderMap = await loadReminderMap();
  const existingEntry = normalizeReminderEntry(
    reminderMap[String(normalizedSchedule.id)]
  );

  if (existingEntry.firesAt === firesAtKey) {
    return existingEntry.id || null;
  }

  const trigger = buildNotificationTrigger(exactTriggerDate);

  if (!trigger) {
    await cancelScheduleReminder(normalizedSchedule.id);
    return null;
  }

  await cancelScheduleReminder(normalizedSchedule.id);

  const notificationId = await Notifications.scheduleNotificationAsync({
    identifier: notificationIdentifier,
    content: {
      title: "SchedWise Reminder",
      body: `${getReadableDueLabel(normalizedSchedule)} is coming up (${normalizedSchedule.reminderTime}).`,
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 250, 250],
      data: {
        scheduleId: String(normalizedSchedule.id),
        type: "schedule-reminder",
      },
    },
    trigger,
  });

  const isScheduled = await verifyScheduledNotification(notificationIdentifier);

  if (!isScheduled) {
    console.log(
      "Schedule reminder could not be verified after scheduling.",
      notificationIdentifier
    );
  } else {
    console.log("Schedule reminder scheduled.", {
      scheduleId: normalizedSchedule.id,
      title: normalizedSchedule.title,
      firesAt: firesAtKey,
      reminderTime: normalizedSchedule.reminderTime,
    });
  }

  reminderMap[String(normalizedSchedule.id)] = {
    id: notificationId,
    firesAt: firesAtKey,
  };
  await saveReminderMap(reminderMap);

  return notificationId;
};

export const syncScheduleReminders = async (schedules) => {
  const activeSchedules = Array.isArray(schedules) ? schedules : [];
  const activeIds = new Set(activeSchedules.map((item) => String(item.id)));
  const reminderMap = await loadReminderMap();
  const missedMap = await loadMissedMap();

  for (const schedule of activeSchedules) {
    await syncReminderForSchedule(schedule);
    await syncMissedNotificationForSchedule(schedule);
  }

  for (const scheduleId of Object.keys(reminderMap)) {
    if (!activeIds.has(String(scheduleId))) {
      await cancelScheduleReminder(scheduleId);
    }
  }

  for (const scheduleId of Object.keys(missedMap)) {
    if (!activeIds.has(String(scheduleId))) {
      await cancelMissedTaskNotification(scheduleId);
    }
  }
};

export const initScheduleReminders = async () => {
  await ensureAndroidNotificationChannel();

  const granted = await requestScheduleNotificationPermission();

  if (!granted) {
    return false;
  }

  try {
    await registerFirebasePushToken();
  } catch {
    // Local reminders still work without a push token.
  }

  const schedules = await getLocalSchedules();
  await syncScheduleReminders(schedules);

  return true;
};

const runScheduleReminderSync = async () => {
  try {
    const schedules = await getLocalSchedules();
    await syncScheduleReminders(schedules);
  } catch (error) {
    console.log("Schedule reminder sync error:", error?.message);
  }
};

const FOREGROUND_MISSED_CATCHUP_MS = 30000;

export const attachScheduleReminderSync = () => {
  const scheduleSubscription = DeviceEventEmitter.addListener(
    SCHEDULE_CHANGE_EVENT,
    runScheduleReminderSync
  );

  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      runScheduleReminderSync();
    }
  });

  const foregroundIntervalId = setInterval(() => {
    if (AppState.currentState === "active") {
      runScheduleReminderSync();
    }
  }, FOREGROUND_MISSED_CATCHUP_MS);

  const notificationSubscription = Notifications.addNotificationReceivedListener(
    async (notification) => {
      const notificationData = notification?.request?.content?.data;
      const notificationType = notificationData?.type;

      if (notificationType === "schedule-missed") {
        const scheduleId = notificationData?.scheduleId;
        let firesAt = notificationData?.firesAt;

        if (scheduleId && !firesAt) {
          const schedules = await getLocalSchedules();
          const schedule = schedules.find(
            (item) => String(item.id) === String(scheduleId)
          );
          const exactDueDate = schedule
            ? toExactTriggerDate(
                parseScheduleDateTime(schedule.date, schedule.timeOnly)
              )
            : null;
          firesAt = exactDueDate?.toISOString() || "";
        }

        if (scheduleId && firesAt) {
          await markMissedNotificationSent(String(scheduleId), firesAt);
        }
      }

      if (
        notificationType === "schedule-missed" ||
        notificationType === "schedule-reminder"
      ) {
        DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);
      }
    }
  );

  return {
    remove: () => {
      scheduleSubscription.remove();
      appStateSubscription.remove();
      clearInterval(foregroundIntervalId);
      notificationSubscription.remove();
    },
  };
};
