import AsyncStorage from "@react-native-async-storage/async-storage";
import { addScheduleToDeviceCalendar } from "./deviceCalendar";

export const LOCAL_SCHEDULES_STORAGE_KEY = "schedwise_local_schedules";

const makeId = () => {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const sortSchedules = (schedules) => {
  return [...schedules].sort((a, b) => {
    const dateA = String(a.date || "");
    const dateB = String(b.date || "");

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    return String(a.timeOnly || "").localeCompare(String(b.timeOnly || ""));
  });
};

const normalizeSyncAction = (value) => {
  if (value === "insert" || value === "update" || value === "delete") {
    return value;
  }

  return "";
};

export const isLocalOnlySchedule = (schedule) => {
  return String(schedule?.id || "").startsWith("local-");
};

export const normalizeSchedule = (schedule) => {
  if (!schedule) return null;

  const scheduleId = String(schedule.id || makeId());
  const localOnly = scheduleId.startsWith("local-");

  const normalizedSubtasks = Array.isArray(schedule.subtasks)
    ? schedule.subtasks.map((subtask, index) => ({
        id: String(subtask.id || `${Date.now()}-${index}`),
        text: subtask.text || "Untitled subtask",
        completed: Boolean(subtask.completed),
        proofUri: subtask.proofUri || subtask.proof_uri || "",
      }))
    : [];

  const pendingSync = Boolean(
    schedule.pendingSync ?? schedule.pending_sync ?? false
  );

  return {
    id: scheduleId,
    userId: schedule.userId || schedule.user_id || "local-device",
    date: schedule.date || "",
    timeOnly: schedule.timeOnly || schedule.time_only || "",
    title: schedule.title || "Untitled Schedule",
    icon: schedule.icon || "calendar",
    completed: Boolean(schedule.completed),
    proofUri: schedule.proofUri || schedule.proof_uri || "",
    reminderEnabled: Boolean(
      schedule.reminderEnabled ?? schedule.reminder_enabled ?? false
    ),
    reminderTime: schedule.reminderTime || schedule.reminder_time || "",
    subtasks: normalizedSubtasks,

    deviceCalendarEventId:
      schedule.deviceCalendarEventId || schedule.device_calendar_event_id || "",
    deviceCalendarId:
      schedule.deviceCalendarId || schedule.device_calendar_id || "",
    deviceCalendarSyncedAt:
      schedule.deviceCalendarSyncedAt ||
      schedule.device_calendar_synced_at ||
      "",

    pendingSync,
    syncAction: pendingSync
      ? normalizeSyncAction(schedule.syncAction || schedule.sync_action) ||
        (localOnly ? "insert" : "update")
      : "",
    syncError: schedule.syncError || schedule.sync_error || "",

    createdAt:
      schedule.createdAt || schedule.created_at || new Date().toISOString(),
    updatedAt:
      schedule.updatedAt || schedule.updated_at || new Date().toISOString(),
  };
};

export const getLocalSchedules = async () => {
  try {
    const storedSchedules = await AsyncStorage.getItem(
      LOCAL_SCHEDULES_STORAGE_KEY
    );

    const parsedSchedules = storedSchedules ? JSON.parse(storedSchedules) : [];

    if (!Array.isArray(parsedSchedules)) {
      return [];
    }

    return sortSchedules(parsedSchedules.map(normalizeSchedule).filter(Boolean));
  } catch (error) {
    console.log("Load local schedules error:", error?.message);
    return [];
  }
};

export const saveLocalSchedules = async (schedules) => {
  const normalizedSchedules = sortSchedules(
    (Array.isArray(schedules) ? schedules : [])
      .map(normalizeSchedule)
      .filter(Boolean)
  );

  await AsyncStorage.setItem(
    LOCAL_SCHEDULES_STORAGE_KEY,
    JSON.stringify(normalizedSchedules)
  );

  return normalizedSchedules;
};

export const replaceLocalSchedules = async (schedules) => {
  return await saveLocalSchedules(schedules);
};

export const addLocalSchedule = async (schedule) => {
  const currentSchedules = await getLocalSchedules();
  const now = new Date().toISOString();

  const newSchedule = normalizeSchedule({
    ...schedule,
    id: schedule.id || makeId(),

    // New schedules are stored locally first.
    // If internet is unavailable, they remain accessible on this phone.
    pendingSync: schedule.pendingSync ?? schedule.pending_sync ?? true,
    syncAction: schedule.syncAction || schedule.sync_action || "insert",
    syncError: "",

    createdAt: schedule.createdAt || now,
    updatedAt: now,
  });

  await saveLocalSchedules([...currentSchedules, newSchedule]);

  return newSchedule;
};

export const upsertLocalSchedule = async (schedule) => {
  const normalizedSchedule = normalizeSchedule(schedule);

  if (!normalizedSchedule) return null;

  const currentSchedules = await getLocalSchedules();

  const existingIndex = currentSchedules.findIndex(
    (item) => String(item.id) === String(normalizedSchedule.id)
  );

  let nextSchedules = [];

  if (existingIndex >= 0) {
    nextSchedules = currentSchedules.map((item) =>
      String(item.id) === String(normalizedSchedule.id)
        ? normalizeSchedule({
            ...item,
            ...normalizedSchedule,
            deviceCalendarEventId:
              normalizedSchedule.deviceCalendarEventId ||
              item.deviceCalendarEventId ||
              "",
            deviceCalendarId:
              normalizedSchedule.deviceCalendarId ||
              item.deviceCalendarId ||
              "",
            deviceCalendarSyncedAt:
              normalizedSchedule.deviceCalendarSyncedAt ||
              item.deviceCalendarSyncedAt ||
              "",
          })
        : item
    );
  } else {
    nextSchedules = [...currentSchedules, normalizedSchedule];
  }

  await saveLocalSchedules(nextSchedules);

  return normalizedSchedule;
};

export const updateLocalSchedule = async (scheduleId, updates) => {
  const currentSchedules = await getLocalSchedules();
  const targetId = String(scheduleId);
  let updatedSchedule = null;

  const nextSchedules = currentSchedules.map((schedule) => {
    if (String(schedule.id) !== targetId) {
      return schedule;
    }

    const nextPendingSync = Boolean(
      updates.pendingSync ?? updates.pending_sync ?? true
    );

    const nextSyncAction =
      normalizeSyncAction(updates.syncAction || updates.sync_action) ||
      (isLocalOnlySchedule(schedule) ? "insert" : "update");

    updatedSchedule = normalizeSchedule({
      ...schedule,
      ...updates,
      pendingSync: nextPendingSync,
      syncAction: nextPendingSync ? nextSyncAction : "",
      syncError: nextPendingSync ? updates.syncError || "" : "",
      updatedAt: new Date().toISOString(),
    });

    return updatedSchedule;
  });

  await saveLocalSchedules(nextSchedules);

  return updatedSchedule;
};

export const deleteLocalSchedule = async (scheduleId) => {
  const currentSchedules = await getLocalSchedules();
  const targetId = String(scheduleId);

  const nextSchedules = currentSchedules.filter(
    (schedule) => String(schedule.id) !== targetId
  );

  await saveLocalSchedules(nextSchedules);

  return true;
};

export const getPendingSyncSchedules = async () => {
  const currentSchedules = await getLocalSchedules();

  return currentSchedules.filter((schedule) => schedule.pendingSync);
};

export const markLocalScheduleSynced = async (
  localScheduleId,
  syncedSchedule
) => {
  const currentSchedules = await getLocalSchedules();
  const targetId = String(localScheduleId);
  let updatedSchedule = null;

  const nextSchedules = currentSchedules.map((schedule) => {
    if (String(schedule.id) !== targetId) {
      return schedule;
    }

    const normalizedSyncedSchedule = normalizeSchedule({
      ...schedule,
      ...syncedSchedule,
      id: syncedSchedule?.id || schedule.id,
      deviceCalendarEventId:
        syncedSchedule?.deviceCalendarEventId ||
        syncedSchedule?.device_calendar_event_id ||
        schedule.deviceCalendarEventId ||
        "",
      deviceCalendarId:
        syncedSchedule?.deviceCalendarId ||
        syncedSchedule?.device_calendar_id ||
        schedule.deviceCalendarId ||
        "",
      deviceCalendarSyncedAt:
        syncedSchedule?.deviceCalendarSyncedAt ||
        syncedSchedule?.device_calendar_synced_at ||
        schedule.deviceCalendarSyncedAt ||
        "",
      pendingSync: false,
      syncAction: "",
      syncError: "",
      updatedAt:
        syncedSchedule?.updatedAt ||
        syncedSchedule?.updated_at ||
        new Date().toISOString(),
    });

    updatedSchedule = normalizedSyncedSchedule;

    return normalizedSyncedSchedule;
  });

  await saveLocalSchedules(nextSchedules);

  return updatedSchedule;
};

export const markLocalScheduleSyncFailed = async (scheduleId, errorMessage) => {
  return await updateLocalSchedule(scheduleId, {
    pendingSync: true,
    syncError: errorMessage || "Unable to sync schedule.",
  });
};

export const mergeRemoteSchedulesWithLocal = async (remoteSchedules) => {
  const localSchedules = await getLocalSchedules();

  const normalizedRemoteSchedules = (Array.isArray(remoteSchedules)
    ? remoteSchedules
    : []
  )
    .map((schedule) =>
      normalizeSchedule({
        ...schedule,
        pendingSync: false,
        syncAction: "",
        syncError: "",
      })
    )
    .filter(Boolean);

  const mergedRemoteSchedules = normalizedRemoteSchedules.map(
    (remoteSchedule) => {
      const localMatch = localSchedules.find(
        (localSchedule) => String(localSchedule.id) === String(remoteSchedule.id)
      );

      if (!localMatch) {
        return remoteSchedule;
      }

      return normalizeSchedule({
        ...remoteSchedule,
        deviceCalendarEventId:
          remoteSchedule.deviceCalendarEventId ||
          localMatch.deviceCalendarEventId ||
          "",
        deviceCalendarId:
          remoteSchedule.deviceCalendarId || localMatch.deviceCalendarId || "",
        deviceCalendarSyncedAt:
          remoteSchedule.deviceCalendarSyncedAt ||
          localMatch.deviceCalendarSyncedAt ||
          "",
        pendingSync: false,
        syncAction: "",
        syncError: "",
      });
    }
  );

  const remoteIds = new Set(
    mergedRemoteSchedules.map((schedule) => String(schedule.id))
  );

  const localPendingSchedules = localSchedules.filter((schedule) => {
    if (schedule.pendingSync) return true;

    // Keep local-only schedules even if they are not synced yet.
    if (isLocalOnlySchedule(schedule) && !remoteIds.has(String(schedule.id))) {
      return true;
    }

    return false;
  });

  return await saveLocalSchedules([
    ...mergedRemoteSchedules,
    ...localPendingSchedules,
  ]);
};

export const syncLocalScheduleToDeviceCalendar = async (schedule) => {
  const normalizedSchedule = normalizeSchedule(schedule);

  if (!normalizedSchedule) {
    throw new Error("Missing schedule data.");
  }

  if (normalizedSchedule.deviceCalendarEventId) {
    return normalizedSchedule;
  }

  const calendarResult = await addScheduleToDeviceCalendar(normalizedSchedule);
  const syncedAt = new Date().toISOString();

  const updatedSchedule = await updateLocalSchedule(normalizedSchedule.id, {
    deviceCalendarEventId: calendarResult.eventId || "",
    deviceCalendarId: calendarResult.calendarId || "",
    deviceCalendarSyncedAt: syncedAt,
    pendingSync: true,
    syncAction: isLocalOnlySchedule(normalizedSchedule) ? "insert" : "update",
    syncError: "",
  });

  return (
    updatedSchedule || {
      ...normalizedSchedule,
      deviceCalendarEventId: calendarResult.eventId || "",
      deviceCalendarId: calendarResult.calendarId || "",
      deviceCalendarSyncedAt: syncedAt,
      pendingSync: true,
      syncAction: isLocalOnlySchedule(normalizedSchedule) ? "insert" : "update",
      syncError: "",
    }
  );
};

export const clearAllLocalSchedules = async () => {
  await AsyncStorage.removeItem(LOCAL_SCHEDULES_STORAGE_KEY);
};