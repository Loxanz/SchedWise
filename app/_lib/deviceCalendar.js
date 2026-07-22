import * as Calendar from "expo-calendar";
import { getReminderOffsetMinutes } from "./scheduleReminderUtils";

const DEFAULT_EVENT_DURATION_MINUTES = 60;
const DEFAULT_TIME_ZONE = "Asia/Manila";

function parseScheduleDateTime(dateText, timeText) {
  if (!dateText || !timeText) {
    throw new Error("Missing schedule date or time.");
  }

  const [yearText, monthText, dayText] = String(dateText).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const timeMatch = String(timeText)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

  if (!year || !month || !day || !timeMatch) {
    throw new Error("Invalid schedule date or time.");
  }

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const period = timeMatch[3].toUpperCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new Error("Invalid schedule time.");
  }

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  const dateObject = new Date(year, month - 1, day, hour, minute);

  if (Number.isNaN(dateObject.getTime())) {
    throw new Error("Invalid schedule date.");
  }

  return dateObject;
}

function getReminderOffset(reminderTime) {
  return getReminderOffsetMinutes(reminderTime);
}

function buildScheduleNotes(schedule) {
  const subtasks = Array.isArray(schedule.subtasks) ? schedule.subtasks : [];

  if (subtasks.length === 0) {
    return "Created from SchedWise.";
  }

  const subtaskText = subtasks
    .map((item) => `- ${item.text || "Untitled subtask"}`)
    .join("\n");

  return `Created from SchedWise.\n\nSubtasks:\n${subtaskText}`;
}

function getAlarmDetails(alarmOffset) {
  if (alarmOffset === null || alarmOffset === undefined) {
    return [];
  }

  const alarm = {
    relativeOffset: alarmOffset,
  };

  const defaultMethod =
    Calendar.AlarmMethod?.DEFAULT || Calendar.AlarmMethod?.ALERT;

  if (defaultMethod) {
    alarm.method = defaultMethod;
  }

  return [alarm];
}

function getEventId(createdEvent) {
  if (!createdEvent) return "";

  if (typeof createdEvent === "string") {
    return createdEvent;
  }

  if (typeof createdEvent === "object") {
    return createdEvent.id || createdEvent.eventId || "";
  }

  return "";
}

function buildEventDetails(schedule) {
  const startDate = parseScheduleDateTime(schedule.date, schedule.timeOnly);
  const endDate = new Date(
    startDate.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000
  );

  const alarmOffset = schedule.reminderEnabled
    ? getReminderOffset(schedule.reminderTime)
    : null;

  return {
    title: schedule.title || "SchedWise Schedule",
    startDate,
    endDate,
    timeZone: DEFAULT_TIME_ZONE,
    notes: buildScheduleNotes(schedule),
    allDay: false,
    alarms: getAlarmDetails(alarmOffset),
  };
}

async function requestCalendarPermission() {
  let permission = null;

  if (typeof Calendar.requestCalendarPermissions === "function") {
    permission = await Calendar.requestCalendarPermissions(false);
  } else if (typeof Calendar.requestCalendarPermissionsAsync === "function") {
    permission = await Calendar.requestCalendarPermissionsAsync();
  } else {
    throw new Error(
      "Calendar permission API was not found. Rebuild the development app after installing expo-calendar."
    );
  }

  if (permission?.status !== "granted") {
    throw new Error("Calendar permission was denied.");
  }

  return permission;
}

async function getDeviceCalendars() {
  const eventType =
    Calendar.EntityTypes?.EVENT || Calendar.EntityTypes?.event || "event";

  if (typeof Calendar.getCalendars === "function") {
    const calendars = Calendar.getCalendars(eventType);
    return Array.isArray(calendars) ? calendars : await calendars;
  }

  if (typeof Calendar.getCalendarsAsync === "function") {
    return await Calendar.getCalendarsAsync(eventType);
  }

  throw new Error(
    "Calendar list API was not found. Rebuild the development app after installing expo-calendar."
  );
}

function isWritableCalendar(calendar) {
  if (!calendar || !calendar.id) return false;
  if (calendar.allowsModifications === false) return false;

  const accessLevel = String(calendar.accessLevel || "").toLowerCase();

  if (
    accessLevel &&
    accessLevel.includes("read") &&
    !accessLevel.includes("write")
  ) {
    return false;
  }

  return true;
}

function isBestCalendar(calendar) {
  return (
    isWritableCalendar(calendar) &&
    calendar.isVisible !== false &&
    calendar.isSynced !== false
  );
}

async function getWritableCalendar() {
  await requestCalendarPermission();

  const calendars = await getDeviceCalendars();

  console.log(
    "SchedWise available calendars:",
    calendars.map((calendar) => ({
      id: calendar.id,
      title: calendar.title,
      name: calendar.name,
      allowsModifications: calendar.allowsModifications,
      isVisible: calendar.isVisible,
      isSynced: calendar.isSynced,
      isPrimary: calendar.isPrimary,
      accessLevel: calendar.accessLevel,
      ownerAccount: calendar.ownerAccount,
      source: calendar.source,
      hasCreateEvent: typeof calendar.createEvent === "function",
    }))
  );

  const primaryCalendar = calendars.find(
    (calendar) => isBestCalendar(calendar) && calendar.isPrimary === true
  );

  if (primaryCalendar) return primaryCalendar;

  const visibleSyncedCalendar = calendars.find(isBestCalendar);

  if (visibleSyncedCalendar) return visibleSyncedCalendar;

  const anyWritableCalendar = calendars.find(isWritableCalendar);

  if (anyWritableCalendar) return anyWritableCalendar;

  throw new Error(
    "No writable calendar found. Open your phone Calendar app and enable at least one local or Google calendar."
  );
}

async function createCalendarEvent(calendar, eventDetails) {
  if (!calendar?.id) {
    throw new Error("Missing calendar ID.");
  }

  if (calendar && typeof calendar.createEvent === "function") {
    const createdEvent = await calendar.createEvent(eventDetails);
    return getEventId(createdEvent);
  }

  if (typeof Calendar.createEventAsync === "function") {
    const createdEvent = await Calendar.createEventAsync(
      calendar.id,
      eventDetails
    );

    return getEventId(createdEvent);
  }

  throw new Error(
    "Calendar create event API was not found. Rebuild the development app after installing expo-calendar."
  );
}

async function updateCalendarEvent(eventId, eventDetails) {
  if (!eventId) {
    throw new Error("Missing calendar event ID.");
  }

  if (typeof Calendar.updateEventAsync === "function") {
    await Calendar.updateEventAsync(String(eventId), eventDetails);
    return String(eventId);
  }

  throw new Error(
    "Calendar update event API was not found. Rebuild the development app after installing expo-calendar."
  );
}

async function deleteCalendarEvent(eventId) {
  if (!eventId) {
    return false;
  }

  if (typeof Calendar.deleteEventAsync === "function") {
    await Calendar.deleteEventAsync(String(eventId));
    return true;
  }

  throw new Error(
    "Calendar delete event API was not found. Rebuild the development app after installing expo-calendar."
  );
}

export async function addScheduleToDeviceCalendar(schedule) {
  if (!schedule) {
    throw new Error("Missing schedule data.");
  }

  const calendar = await getWritableCalendar();
  const eventDetails = buildEventDetails(schedule);
  const eventId = await createCalendarEvent(calendar, eventDetails);

  if (!eventId) {
    throw new Error("Phone calendar did not return an event ID.");
  }

  console.log("SchedWise calendar event created:", {
    eventId,
    calendarId: calendar.id,
    calendarTitle: calendar.title || calendar.name,
  });

  return {
    eventId,
    calendarId: calendar.id,
  };
}

export async function updateScheduleOnDeviceCalendar(schedule) {
  if (!schedule) {
    throw new Error("Missing schedule data.");
  }

  const eventId = String(schedule.deviceCalendarEventId || "").trim();

  if (!eventId) {
    return addScheduleToDeviceCalendar(schedule);
  }

  await requestCalendarPermission();

  try {
    const eventDetails = buildEventDetails(schedule);
    await updateCalendarEvent(eventId, eventDetails);

    console.log("SchedWise calendar event updated:", {
      eventId,
      calendarId: schedule.deviceCalendarId || "",
    });

    return {
      eventId,
      calendarId: schedule.deviceCalendarId || "",
    };
  } catch (error) {
    console.log(
      "SchedWise calendar update failed, recreating event:",
      error?.message
    );

    try {
      await deleteCalendarEvent(eventId);
    } catch {
      // Continue and create a fresh event.
    }

    return addScheduleToDeviceCalendar(schedule);
  }
}

export async function removeScheduleFromDeviceCalendar(schedule) {
  const eventId = String(schedule?.deviceCalendarEventId || "").trim();

  if (!eventId) {
    return { removed: false };
  }

  await requestCalendarPermission();
  await deleteCalendarEvent(eventId);

  console.log("SchedWise calendar event removed:", { eventId });

  return { removed: true, eventId };
}
