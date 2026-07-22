import { parseScheduleDateTime } from "./scheduleReminderUtils";

const padNumber = (value) => String(value).padStart(2, "0");

export const getTodayDateKey = () => {
  const today = new Date();

  return `${today.getFullYear()}-${padNumber(today.getMonth() + 1)}-${padNumber(
    today.getDate()
  )}`;
};

export const isScheduleCompleted = (schedule) => {
  return Boolean(schedule?.completed);
};

export const isScheduleMissed = (schedule) => {
  if (isScheduleCompleted(schedule)) {
    return false;
  }

  const dateKey = String(schedule?.date || "").trim();

  if (!dateKey) {
    return false;
  }

  const todayKey = getTodayDateKey();

  if (dateKey < todayKey) {
    return true;
  }

  if (dateKey > todayKey) {
    return false;
  }

  const dueDate = parseScheduleDateTime(schedule.date, schedule.timeOnly);

  if (!dueDate) {
    return false;
  }

  return dueDate.getTime() <= Date.now();
};

export const isSchedulePending = (schedule) => {
  if (isScheduleCompleted(schedule)) {
    return false;
  }

  return !isScheduleMissed(schedule);
};

export const filterCalendarSchedules = (schedules) => {
  return (Array.isArray(schedules) ? schedules : []).filter((schedule) =>
    isSchedulePending(schedule)
  );
};

export const filterChatbotSchedulesForDate = (schedules, dateKey) => {
  const todayKey = getTodayDateKey();
  const list = Array.isArray(schedules) ? schedules : [];

  if (dateKey < todayKey) {
    return [];
  }

  return list.filter(
    (schedule) =>
      String(schedule?.date || "") === dateKey && isSchedulePending(schedule)
  );
};

export const getChatbotVisibleSchedules = (schedules) => {
  const todayKey = getTodayDateKey();

  return (Array.isArray(schedules) ? schedules : []).filter((schedule) => {
    const dateKey = String(schedule?.date || "");

    if (!dateKey || dateKey < todayKey) {
      return false;
    }

    return isSchedulePending(schedule);
  });
};

export const partitionSchedulesByStatus = (schedules) => {
  const list = Array.isArray(schedules) ? schedules : [];

  const completed = [];
  const pending = [];
  const missed = [];

  list.forEach((schedule) => {
    if (isScheduleCompleted(schedule)) {
      completed.push(schedule);
      return;
    }

    if (isScheduleMissed(schedule)) {
      missed.push(schedule);
      return;
    }

    pending.push(schedule);
  });

  const sortByDateAsc = (a, b) =>
    String(a?.date || "").localeCompare(String(b?.date || ""));

  const sortByDateDesc = (a, b) =>
    String(b?.date || "").localeCompare(String(a?.date || ""));

  return {
    completed,
    pending: pending.sort(sortByDateAsc),
    missed: missed.sort(sortByDateDesc),
  };
};
