import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
  db: {
    schema: "public",
  },
});

export const SCHEDULES_TABLE = "schedules";

const SCHEDULES_TABLE_MISSING_MESSAGE =
  "The schedules table was not found in Supabase. Create public.schedules in Supabase SQL Editor first, then restart Expo with npx expo start -c.";

const isSchedulesTableMissingError = (error) => {
  if (!error) return false;

  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const hint = String(error.hint || "").toLowerCase();

  return (
    error.code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    details.includes("schedules") ||
    hint.includes("schedules")
  );
};

const normalizeScheduleError = (error) => {
  if (!error) return null;

  if (isSchedulesTableMissingError(error)) {
    return new Error(SCHEDULES_TABLE_MISSING_MESSAGE);
  }

  return error;
};

export const mapScheduleRowToApp = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    timeOnly: row.time_only,
    title: row.title,
    icon: row.icon || "calendar",
    completed: Boolean(row.completed),
    proofUri: row.proof_uri || "",
    reminderEnabled: Boolean(row.reminder_enabled),
    reminderTime: row.reminder_time || "",
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],

    deviceCalendarEventId: row.device_calendar_event_id || "",
    deviceCalendarId: row.device_calendar_id || "",
    deviceCalendarSyncedAt: row.device_calendar_synced_at || "",

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const mapScheduleAppToRow = (schedule) => {
  return {
    date: schedule.date,
    time_only: schedule.timeOnly,
    title: schedule.title,
    icon: schedule.icon || "calendar",
    completed: Boolean(schedule.completed),
    proof_uri: schedule.proofUri || "",
    reminder_enabled: Boolean(schedule.reminderEnabled),
    reminder_time: schedule.reminderTime || "",
    subtasks: Array.isArray(schedule.subtasks) ? schedule.subtasks : [],

    device_calendar_event_id: schedule.deviceCalendarEventId || null,
    device_calendar_id: schedule.deviceCalendarId || null,
    device_calendar_synced_at: schedule.deviceCalendarSyncedAt || null,
  };
};

export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
};

export const getCurrentSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  return session;
};

export const getUserSchedules = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return {
      data: [],
      error: new Error("No signed-in user found."),
    };
  }

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: true })
    .order("time_only", { ascending: true })
    .order("created_at", { ascending: true });

  const normalizedError = normalizeScheduleError(error);

  return {
    data: normalizedError ? [] : (data || []).map(mapScheduleRowToApp),
    error: normalizedError,
  };
};

export const addUserSchedule = async ({
  date,
  timeOnly,
  title,
  icon = "calendar",
  completed = false,
  proofUri = "",
  reminderEnabled = true,
  reminderTime = "",
  subtasks = [],

  deviceCalendarEventId = "",
  deviceCalendarId = "",
  deviceCalendarSyncedAt = "",
}) => {
  const user = await getCurrentUser();

  if (!user) {
    return {
      data: null,
      error: new Error("No signed-in user found."),
    };
  }

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .insert({
      user_id: user.id,
      date,
      time_only: timeOnly,
      title,
      icon,
      completed,
      proof_uri: proofUri,
      reminder_enabled: reminderEnabled,
      reminder_time: reminderTime,
      subtasks: Array.isArray(subtasks) ? subtasks : [],

      device_calendar_event_id: deviceCalendarEventId || null,
      device_calendar_id: deviceCalendarId || null,
      device_calendar_synced_at: deviceCalendarSyncedAt || null,
    })
    .select("*")
    .single();

  const normalizedError = normalizeScheduleError(error);

  return {
    data: normalizedError ? null : mapScheduleRowToApp(data),
    error: normalizedError,
  };
};

export const updateUserSchedule = async (scheduleId, updates) => {
  const user = await getCurrentUser();

  if (!user) {
    return {
      data: null,
      error: new Error("No signed-in user found."),
    };
  }

  const formattedUpdates = {};

  if (updates.date !== undefined) {
    formattedUpdates.date = updates.date;
  }

  if (updates.timeOnly !== undefined) {
    formattedUpdates.time_only = updates.timeOnly;
  }

  if (updates.title !== undefined) {
    formattedUpdates.title = updates.title;
  }

  if (updates.icon !== undefined) {
    formattedUpdates.icon = updates.icon;
  }

  if (updates.completed !== undefined) {
    formattedUpdates.completed = Boolean(updates.completed);
  }

  if (updates.proofUri !== undefined) {
    formattedUpdates.proof_uri = updates.proofUri || "";
  }

  if (updates.reminderEnabled !== undefined) {
    formattedUpdates.reminder_enabled = Boolean(updates.reminderEnabled);
  }

  if (updates.reminderTime !== undefined) {
    formattedUpdates.reminder_time = updates.reminderTime || "";
  }

  if (updates.subtasks !== undefined) {
    formattedUpdates.subtasks = Array.isArray(updates.subtasks)
      ? updates.subtasks
      : [];
  }

  if (updates.deviceCalendarEventId !== undefined) {
    formattedUpdates.device_calendar_event_id =
      updates.deviceCalendarEventId || null;
  }

  if (updates.deviceCalendarId !== undefined) {
    formattedUpdates.device_calendar_id = updates.deviceCalendarId || null;
  }

  if (updates.deviceCalendarSyncedAt !== undefined) {
    formattedUpdates.device_calendar_synced_at =
      updates.deviceCalendarSyncedAt || null;
  }

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .update(formattedUpdates)
    .eq("id", scheduleId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  const normalizedError = normalizeScheduleError(error);

  return {
    data: normalizedError ? null : mapScheduleRowToApp(data),
    error: normalizedError,
  };
};

export const updateScheduleDeviceCalendarSync = async (
  scheduleId,
  {
    deviceCalendarEventId = "",
    deviceCalendarId = "",
    deviceCalendarSyncedAt = new Date().toISOString(),
  }
) => {
  const user = await getCurrentUser();

  if (!user) {
    return {
      data: null,
      error: new Error("No signed-in user found."),
    };
  }

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .update({
      device_calendar_event_id: deviceCalendarEventId || null,
      device_calendar_id: deviceCalendarId || null,
      device_calendar_synced_at: deviceCalendarSyncedAt || null,
    })
    .eq("id", scheduleId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  const normalizedError = normalizeScheduleError(error);

  return {
    data: normalizedError ? null : mapScheduleRowToApp(data),
    error: normalizedError,
  };
};

export const clearScheduleDeviceCalendarSync = async (scheduleId) => {
  const user = await getCurrentUser();

  if (!user) {
    return {
      data: null,
      error: new Error("No signed-in user found."),
    };
  }

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .update({
      device_calendar_event_id: null,
      device_calendar_id: null,
      device_calendar_synced_at: null,
    })
    .eq("id", scheduleId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  const normalizedError = normalizeScheduleError(error);

  return {
    data: normalizedError ? null : mapScheduleRowToApp(data),
    error: normalizedError,
  };
};

export const deleteUserSchedule = async (scheduleId) => {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: new Error("No signed-in user found."),
    };
  }

  const { error } = await supabase
    .from(SCHEDULES_TABLE)
    .delete()
    .eq("id", scheduleId)
    .eq("user_id", user.id);

  return {
    error: normalizeScheduleError(error),
  };
};

export const checkSchedulesTable = async () => {
  const { error } = await supabase.from(SCHEDULES_TABLE).select("id").limit(1);

  return {
    exists: !error,
    error: normalizeScheduleError(error),
  };
};

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh().catch(() => {
        // Ignore offline / network refresh failures.
      });
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}