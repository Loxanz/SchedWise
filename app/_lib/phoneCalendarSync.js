import {
  addScheduleToDeviceCalendar,
  removeScheduleFromDeviceCalendar,
  updateScheduleOnDeviceCalendar,
} from "./deviceCalendar";
import {
  isLocalOnlySchedule,
  markLocalScheduleSynced,
  updateLocalSchedule,
} from "./localSchedules";
import {
  clearScheduleDeviceCalendarSync,
  getCurrentUser,
  updateScheduleDeviceCalendarSync,
} from "./supabase";

const clearCalendarFields = {
  deviceCalendarEventId: "",
  deviceCalendarId: "",
  deviceCalendarSyncedAt: "",
};

const persistCalendarFields = async (schedule, fields) => {
  const updatedLocalSchedule = await updateLocalSchedule(schedule.id, {
    ...fields,
    // Preserve completion state across calendar metadata writes.
    completed: Boolean(schedule.completed),
    proofUri: schedule.proofUri || "",
    subtasks: Array.isArray(schedule.subtasks) ? schedule.subtasks : undefined,
    pendingSync: !fields.deviceCalendarEventId
      ? Boolean(schedule.pendingSync)
      : isLocalOnlySchedule(schedule),
    syncAction: isLocalOnlySchedule(schedule)
      ? schedule.syncAction || "insert"
      : fields.deviceCalendarEventId
        ? schedule.syncAction || ""
        : schedule.syncAction || "update",
    syncError: "",
  });

  let finalSchedule =
    updatedLocalSchedule || {
      ...schedule,
      ...fields,
      completed: Boolean(schedule.completed),
    };

  try {
    const user = await getCurrentUser();

    if (!user || isLocalOnlySchedule(finalSchedule)) {
      return finalSchedule;
    }

    if (fields.deviceCalendarEventId) {
      const { data: syncedSchedule, error } =
        await updateScheduleDeviceCalendarSync(finalSchedule.id, fields);

      if (!error && syncedSchedule) {
        const marked = await markLocalScheduleSynced(
          finalSchedule.id,
          {
            ...syncedSchedule,
            completed:
              Boolean(finalSchedule.completed) ||
              Boolean(syncedSchedule.completed),
            proofUri: finalSchedule.proofUri || syncedSchedule.proofUri || "",
            subtasks: finalSchedule.subtasks,
          }
        );
        finalSchedule = marked || {
          ...syncedSchedule,
          completed: Boolean(finalSchedule.completed),
        };
      }
    } else {
      const { data: clearedSchedule, error } =
        await clearScheduleDeviceCalendarSync(finalSchedule.id);

      if (!error && clearedSchedule) {
        const marked = await markLocalScheduleSynced(
          finalSchedule.id,
          {
            ...clearedSchedule,
            completed:
              Boolean(finalSchedule.completed) ||
              Boolean(clearedSchedule.completed),
            proofUri: finalSchedule.proofUri || clearedSchedule.proofUri || "",
            subtasks: finalSchedule.subtasks,
          }
        );
        finalSchedule = marked || {
          ...clearedSchedule,
          completed: Boolean(finalSchedule.completed),
        };
      }
    }
  } catch (error) {
    console.log("Phone calendar metadata sync failed:", error?.message);
  }

  return {
    ...finalSchedule,
    completed: Boolean(finalSchedule.completed) || Boolean(schedule.completed),
  };
};

/**
 * Create or update the schedule on the phone Calendar app.
 * Completed schedules are removed from the phone calendar.
 */
export async function syncSchedulePhoneCalendar(
  schedule,
  { remove = false } = {}
) {
  if (!schedule?.id) {
    return schedule;
  }

  const shouldRemove = remove || Boolean(schedule.completed);

  try {
    if (shouldRemove) {
      if (schedule.deviceCalendarEventId) {
        await removeScheduleFromDeviceCalendar(schedule);
      }

      return persistCalendarFields(schedule, clearCalendarFields);
    }

    if (schedule.deviceCalendarEventId) {
      const calendarResult = await updateScheduleOnDeviceCalendar(schedule);
      const syncedAt = new Date().toISOString();

      return persistCalendarFields(schedule, {
        deviceCalendarEventId: calendarResult.eventId || schedule.deviceCalendarEventId,
        deviceCalendarId:
          calendarResult.calendarId || schedule.deviceCalendarId || "",
        deviceCalendarSyncedAt: syncedAt,
      });
    }

    const calendarResult = await addScheduleToDeviceCalendar(schedule);
    const syncedAt = new Date().toISOString();

    return persistCalendarFields(schedule, {
      deviceCalendarEventId: calendarResult.eventId || "",
      deviceCalendarId: calendarResult.calendarId || "",
      deviceCalendarSyncedAt: syncedAt,
    });
  } catch (error) {
    console.log("Phone calendar sync error:", error?.message);
    return schedule;
  }
}

export async function removeSchedulePhoneCalendar(schedule) {
  return syncSchedulePhoneCalendar(schedule, { remove: true });
}
