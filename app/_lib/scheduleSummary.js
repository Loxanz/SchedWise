import {
  filterCalendarSchedules,
  filterChatbotSchedulesForDate,
  getChatbotVisibleSchedules,
  getTodayDateKey as getStatusTodayDateKey,
} from "./scheduleStatus";
import { getLocalSchedules, mergeRemoteSchedulesWithLocal } from "./localSchedules";
import { getCurrentUser, getUserSchedules } from "./supabase";

const shortMonthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const monthNameToNumber = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export const TODAY_SCHEDULE_PROMPT = "What is my schedule today?";
export const TOMORROW_SCHEDULE_PROMPT = "What is my schedule for tomorrow?";
export const NEXT_WEEK_SCHEDULE_PROMPT =
  "Check my upcoming tasks for next week";
export const SCHEDULE_CHANGE_EVENT = "schedwise_schedules_changed";

const padNumber = (value) => String(value).padStart(2, "0");

export const createDateKey = (year, month, day) => {
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
};

export const getTodayDateKey = () => {
  const today = new Date();

  return createDateKey(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );
};

const shiftDateKey = (dayOffset) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);

  return createDateKey(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
};

export const getTomorrowDateKey = () => shiftDateKey(1);

const weekDayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const dateKeyToDate = (dateKey) => {
  const [yearText, monthText, dayText] = String(dateKey || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return new Date(year, month - 1, day);
};

const getWeekStartDate = (date) => {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  return weekStart;
};

export const getNextCalendarWeekDateKeys = () => {
  const nextWeekStart = getWeekStartDate(new Date());
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(nextWeekStart);
    day.setDate(nextWeekStart.getDate() + index);

    return createDateKey(
      day.getFullYear(),
      day.getMonth() + 1,
      day.getDate()
    );
  });
};

const getReadableWeekdayDate = (dateKey) => {
  const date = dateKeyToDate(dateKey);

  return `${weekDayNames[date.getDay()]}, ${getReadableDate(dateKey)}`;
};

const getReadableDate = (dateKey) => {
  const parts = String(dateKey || "").split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) return "Today";

  return `${shortMonthNames[month - 1]} ${day}, ${year}`;
};

const parseScheduleDateTime = (dateText, timeText) => {
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
};

export const loadUserSchedules = async () => {
  const localSchedules = await getLocalSchedules();
  const user = await getCurrentUser();

  if (!user) {
    return localSchedules;
  }

  const { data, error } = await getUserSchedules();

  if (error) {
    return localSchedules;
  }

  return await mergeRemoteSchedulesWithLocal(data);
};

const sortSchedulesByTime = (schedules) => {
  return schedules
    .map((item) => ({
      ...item,
      timestamp: parseScheduleDateTime(item.date, item.timeOnly),
    }))
    .sort((a, b) => {
      if (a.timestamp === null) return 1;
      if (b.timestamp === null) return -1;
      return a.timestamp - b.timestamp;
    });
};

const formatTodayScheduleLine = (schedule) => {
  const readableDate = getReadableDate(schedule.date || getTodayDateKey());
  const time = schedule.timeOnly || "No time set";
  const title = schedule.title || "Untitled Schedule";

  return `${time}, ${readableDate}, ${title}`;
};

const formatScheduleEntry = (schedule, index) => {
  const lines = [
    `${index + 1}. ${schedule.timeOnly || "No time"} - ${schedule.title || "Untitled Schedule"}`,
  ];

  if (schedule.reminderEnabled && schedule.reminderTime) {
    lines.push(`   Reminder: ${schedule.reminderTime}`);
  }

  const subtasks = Array.isArray(schedule.subtasks) ? schedule.subtasks : [];

  if (subtasks.length > 0) {
    const completedCount = subtasks.filter((subtask) => subtask.completed).length;
    lines.push(
      `   Subtasks: ${completedCount}/${subtasks.length} completed`
    );

    subtasks.forEach((subtask) => {
      const status = subtask.completed ? "[done]" : "[pending]";
      lines.push(`   - ${status} ${subtask.text || "Untitled subtask"}`);
    });
  }

  return lines.join("\n");
};

const hasScheduleIntent = (text) => {
  const normalized = text.trim().toLowerCase();

  if (
    (/\b(add|create|new|make|insert)\b/.test(normalized) &&
      /\b(task|event|appointment)\b/.test(normalized)) ||
    /^add\s+task\b/.test(normalized) ||
    /\bschedule\s+(?:a\s+)?(?:new\s+)?(?:task|event|appointment)\b/.test(
      normalized
    )
  ) {
    return false;
  }

  return (
    normalized.includes("schedule") ||
    normalized.includes("task") ||
    normalized.includes("agenda") ||
    normalized.includes("calendar") ||
    normalized.includes("what do i have") ||
    normalized.includes("what's on") ||
    normalized.includes("whats on")
  );
};

export const parseRequestedScheduleDate = (text) => {
  const normalized = text.trim().toLowerCase();

  if (/\btoday\b/.test(normalized)) {
    return getTodayDateKey();
  }

  if (/\btomorrow\b/.test(normalized)) {
    return shiftDateKey(1);
  }

  if (/\byesterday\b/.test(normalized)) {
    return shiftDateKey(-1);
  }

  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (isoMatch) {
    return isoMatch[0];
  }

  const monthDayMatch = normalized.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/
  );

  if (monthDayMatch) {
    const month = monthNameToNumber[monthDayMatch[1]];
    const day = Number(monthDayMatch[2]);
    const year = monthDayMatch[3]
      ? Number(monthDayMatch[3])
      : new Date().getFullYear();

    if (month && day >= 1 && day <= 31) {
      return createDateKey(year, month, day);
    }
  }

  const slashMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);

  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const yearPart = slashMatch[3];
    const year = yearPart
      ? Number(yearPart.length === 2 ? `20${yearPart}` : yearPart)
      : new Date().getFullYear();

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return createDateKey(year, month, day);
    }
  }

  return null;
};

export const isTomorrowScheduleRequest = (text) => {
  const normalized = text.trim().toLowerCase();

  return (
    normalized === TOMORROW_SCHEDULE_PROMPT.toLowerCase() ||
    (normalized.includes("tomorrow") &&
      (normalized.includes("schedule") || normalized.includes("task")))
  );
};

export const isNextWeekScheduleRequest = (text) => {
  const normalized = text.trim().toLowerCase();

  return (
    normalized === NEXT_WEEK_SCHEDULE_PROMPT.toLowerCase() ||
    (normalized.includes("next week") &&
      (normalized.includes("task") ||
        normalized.includes("schedule") ||
        normalized.includes("upcoming")))
  );
};

export const isTodayScheduleRequest = (text) => {
  const normalized = text.trim().toLowerCase();

  return (
    normalized === TODAY_SCHEDULE_PROMPT.toLowerCase() ||
    normalized === "what's my schedule today?" ||
    normalized === "show my schedule today" ||
    (normalized.includes("schedule") &&
      normalized.includes("today") &&
      (normalized.includes("my") || normalized.startsWith("what")))
  );
};

export const getRequestedScheduleDateKey = (text) => {
  if (isTodayScheduleRequest(text)) {
    return getTodayDateKey();
  }

  if (isTomorrowScheduleRequest(text)) {
    return getTomorrowDateKey();
  }

  if (isNextWeekScheduleRequest(text)) {
    return null;
  }

  if (!hasScheduleIntent(text)) {
    return null;
  }

  return parseRequestedScheduleDate(text);
};

export const buildDateScheduleSummary = async (
  preloadedSchedules,
  dateKey
) => {
  const readableDate = getReadableDate(dateKey);

  let schedules = preloadedSchedules;

  if (!Array.isArray(schedules)) {
    try {
      schedules = await loadUserSchedules();
    } catch {
      return "Sorry, I couldn't load your schedules right now. Please try again.";
    }
  }

  const daySchedules = sortSchedulesByTime(
    filterChatbotSchedulesForDate(schedules, dateKey)
  );

  if (daySchedules.length === 0) {
    if (dateKey < getStatusTodayDateKey()) {
      return `You have no upcoming tasks for ${readableDate}. Past-day tasks are in Profile → Missed.`;
    }

    if (dateKey === getTodayDateKey()) {
      return "You have no tasks for today.";
    }

    return `You have no task scheduled for ${readableDate}.`;
  }

  const isToday = dateKey === getTodayDateKey();
  const header = isToday
    ? "Your schedule for today is:"
    : `Your schedule for ${readableDate} is:`;

  return [header, "", ...daySchedules.map(formatTodayScheduleLine)].join("\n");
};

export const buildTodayScheduleSummary = async (preloadedSchedules) => {
  return buildDateScheduleSummary(preloadedSchedules, getTodayDateKey());
};

export const buildUpcomingWeekScheduleSummary = async (preloadedSchedules) => {
  let schedules = preloadedSchedules;

  if (!Array.isArray(schedules)) {
    try {
      schedules = await loadUserSchedules();
    } catch {
      return "Sorry, I couldn't load your schedules right now. Please try again.";
    }
  }

  const weekKeys = getNextCalendarWeekDateKeys();
  const weekKeySet = new Set(weekKeys);
  const weekSchedules = sortSchedulesByTime(
    filterCalendarSchedules(
      schedules.filter((item) => weekKeySet.has(item.date))
    )
  );

  if (weekSchedules.length === 0) {
    return "You have no upcoming tasks for next week.";
  }

  const lines = [
    `Your upcoming tasks for next week (${getReadableDate(
      weekKeys[0]
    )} - ${getReadableDate(weekKeys[weekKeys.length - 1])}) are:`,
    "",
  ];

  weekKeys.forEach((dateKey) => {
    const daySchedules = weekSchedules.filter(
      (schedule) => schedule.date === dateKey
    );

    if (daySchedules.length === 0) {
      return;
    }

    lines.push(`${getReadableWeekdayDate(dateKey)}:`);

    daySchedules.forEach((schedule, index) => {
      lines.push(
        `${index + 1}. ${schedule.timeOnly || "No time"} - ${
          schedule.title || "Untitled Schedule"
        }`
      );
    });

    lines.push("");
  });

  return lines.join("\n").trim();
};

const getActiveSchedules = (schedules) => {
  return sortSchedulesByTime(getChatbotVisibleSchedules(schedules));
};

export const buildScheduleContextForAI = (schedules) => {
  const todayKey = getTodayDateKey();
  const readableToday = getReadableDate(todayKey);
  const activeSchedules = getActiveSchedules(schedules);

  if (activeSchedules.length === 0) {
    return (
      `Current date: ${readableToday} (${todayKey})\n` +
      "The user has no active schedules saved in SchedWise right now."
    );
  }

  const schedulesByDate = activeSchedules.reduce((accumulator, schedule) => {
    const dateKey = schedule.date || "Unknown date";

    if (!accumulator[dateKey]) {
      accumulator[dateKey] = [];
    }

    accumulator[dateKey].push(schedule);
    return accumulator;
  }, {});

  const sortedDateKeys = Object.keys(schedulesByDate)
    .filter((dateKey) => dateKey >= todayKey)
    .sort();

  const sections = sortedDateKeys.map((dateKey) => {
    const readableDate = getReadableDate(dateKey);
    const dayLabel =
      dateKey === todayKey
        ? `Today (${readableDate})`
        : `Upcoming (${readableDate})`;

    const entries = schedulesByDate[dateKey]
      .map((schedule, index) => formatScheduleEntry(schedule, index))
      .join("\n");

    return `${dayLabel}:\n${entries}`;
  });

  return [
    `Current date: ${readableToday} (${todayKey})`,
    `Active schedules in SchedWise: ${activeSchedules.length}`,
    "",
    sections.join("\n\n"),
  ].join("\n");
};
