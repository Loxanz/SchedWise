const DEFAULT_SCHEDULE_DURATION_MINUTES = 60;
const SUGGESTION_STEP_MINUTES = 30;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;

function normalizeTitle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function getDateKey(dateObject) {
  return `${dateObject.getFullYear()}-${padNumber(
    dateObject.getMonth() + 1
  )}-${padNumber(dateObject.getDate())}`;
}

function formatTimeOnly(dateObject) {
  let hour = dateObject.getHours();
  const minute = padNumber(dateObject.getMinutes());
  const period = hour >= 12 ? "PM" : "AM";

  hour %= 12;
  hour = hour === 0 ? 12 : hour;

  return `${hour}:${minute} ${period}`;
}

function parseScheduleDateTime(dateText, timeText) {
  if (!dateText || !timeText) return null;

  const [yearText, monthText, dayText] = String(dateText).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const timeMatch = String(timeText)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

  if (!year || !month || !day || !timeMatch) return null;

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

  return dateObject;
}

function getScheduleWindow(schedule) {
  const startDate = parseScheduleDateTime(schedule?.date, schedule?.timeOnly);

  if (!startDate) return null;

  const durationMinutes =
    Number(schedule?.durationMinutes || schedule?.duration_minutes) ||
    DEFAULT_SCHEDULE_DURATION_MINUTES;

  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  return {
    startDate,
    endDate,
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
    durationMinutes,
  };
}

function windowsOverlap(firstWindow, secondWindow) {
  if (!firstWindow || !secondWindow) return false;

  return (
    firstWindow.startMs < secondWindow.endMs &&
    secondWindow.startMs < firstWindow.endMs
  );
}

function isSameSchedule(firstSchedule, secondSchedule) {
  if (!firstSchedule?.id || !secondSchedule?.id) return false;
  return String(firstSchedule.id) === String(secondSchedule.id);
}

function formatReadableWindow(window) {
  if (!window) return "Invalid time";
  return `${formatTimeOnly(window.startDate)} - ${formatTimeOnly(
    window.endDate
  )}`;
}

function createConflict(
  type,
  message,
  existingSchedule,
  newSchedule,
  existingWindow,
  newWindow
) {
  return {
    id: `${type}-${existingSchedule?.id || existingSchedule?.title || Date.now()}`,
    type,
    message,
    existingSchedule,
    newSchedule,
    existingWindowText: formatReadableWindow(existingWindow),
    newWindowText: formatReadableWindow(newWindow),
  };
}

function createDateAtTime(dateText, hour, minute = 0) {
  const [yearText, monthText, dayText] = String(dateText).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function createSuggestionFromDate(dateObject, durationMinutes) {
  const endDate = new Date(dateObject.getTime() + durationMinutes * 60 * 1000);

  return {
    date: getDateKey(dateObject),
    timeOnly: formatTimeOnly(dateObject),
    label: `${getDateKey(dateObject)} • ${formatTimeOnly(dateObject)}`,
    windowText: `${formatTimeOnly(dateObject)} - ${formatTimeOnly(endDate)}`,
  };
}

function isCandidateFree(candidateStart, durationMinutes, schedules) {
  const candidateWindow = {
    startMs: candidateStart.getTime(),
    endMs: candidateStart.getTime() + durationMinutes * 60 * 1000,
  };

  return !schedules.some((schedule) => {
    const window = getScheduleWindow(schedule);
    return windowsOverlap(candidateWindow, window);
  });
}

export function generateReschedulingSuggestions(newSchedule, existingSchedules = []) {
  const newWindow = getScheduleWindow(newSchedule);

  if (!newWindow) return [];

  const durationMinutes = newWindow.durationMinutes;
  const suggestions = [];

  const blockedSchedules = (Array.isArray(existingSchedules)
    ? existingSchedules
    : []
  ).filter(
    (schedule) =>
      schedule && !schedule.completed && !isSameSchedule(schedule, newSchedule)
  );

  const pushSuggestion = (candidateStart) => {
    if (!candidateStart || suggestions.length >= 3) return;

    const dayStart = createDateAtTime(getDateKey(candidateStart), DAY_START_HOUR, 0);
    const dayEnd = createDateAtTime(getDateKey(candidateStart), DAY_END_HOUR, 0);
    const candidateEnd = new Date(
      candidateStart.getTime() + durationMinutes * 60 * 1000
    );

    if (candidateStart.getTime() <= Date.now()) return;
    if (candidateStart < dayStart || candidateEnd > dayEnd) return;

    if (!isCandidateFree(candidateStart, durationMinutes, blockedSchedules)) {
      return;
    }

    const suggestion = createSuggestionFromDate(candidateStart, durationMinutes);

    const alreadyAdded = suggestions.some(
      (item) =>
        item.date === suggestion.date && item.timeOnly === suggestion.timeOnly
    );

    const sameAsOriginal =
      suggestion.date === String(newSchedule.date || "") &&
      suggestion.timeOnly === String(newSchedule.timeOnly || "");

    if (!alreadyAdded && !sameAsOriginal) {
      suggestions.push(suggestion);
    }
  };

  for (let step = 1; step <= 16 && suggestions.length < 3; step += 1) {
    pushSuggestion(
      new Date(newWindow.startMs + step * SUGGESTION_STEP_MINUTES * 60 * 1000)
    );
  }

  const sameDayStart = createDateAtTime(newSchedule.date, DAY_START_HOUR, 0);
  const sameDayEnd = createDateAtTime(newSchedule.date, DAY_END_HOUR, 0);

  for (
    let timeMs = sameDayStart?.getTime() || 0;
    sameDayStart &&
    sameDayEnd &&
    timeMs <= sameDayEnd.getTime() &&
    suggestions.length < 3;
    timeMs += SUGGESTION_STEP_MINUTES * 60 * 1000
  ) {
    pushSuggestion(new Date(timeMs));
  }

  for (let dayOffset = 1; dayOffset <= 3 && suggestions.length < 3; dayOffset += 1) {
    const nextDate = new Date(newWindow.startDate);
    nextDate.setDate(newWindow.startDate.getDate() + dayOffset);

    [9, 10, 13, 15, 17].forEach((hour) => {
      if (suggestions.length < 3) {
        pushSuggestion(createDateAtTime(getDateKey(nextDate), hour, 0));
      }
    });
  }

  return suggestions;
}

export function detectScheduleConflicts(newSchedule, existingSchedules = []) {
  const conflicts = [];
  const newWindow = getScheduleWindow(newSchedule);
  const newTitle = normalizeTitle(newSchedule?.title);

  if (!newWindow) {
    return {
      hasConflicts: true,
      conflicts: [
        {
          id: "invalid-time-entry",
          type: "invalid_time_entry",
          message:
            "The selected date or time is invalid. Choose a valid schedule date and time.",
          existingSchedule: null,
          newSchedule,
          existingWindowText: "",
          newWindowText: "Invalid time",
        },
      ],
      suggestions: [],
    };
  }

  const activeSchedules = (Array.isArray(existingSchedules)
    ? existingSchedules
    : []
  ).filter(
    (schedule) =>
      schedule && !schedule.completed && !isSameSchedule(schedule, newSchedule)
  );

  activeSchedules.forEach((existingSchedule) => {
    const existingWindow = getScheduleWindow(existingSchedule);
    if (!existingWindow) return;

    const sameDate =
      String(existingSchedule.date || "") === String(newSchedule.date || "");
    const sameTime =
      String(existingSchedule.timeOnly || "") === String(newSchedule.timeOnly || "");

    const existingTitle = normalizeTitle(existingSchedule.title);
    const sameTitle = Boolean(
      newTitle && existingTitle && newTitle === existingTitle
    );

    if (sameTitle && sameDate) {
      conflicts.push(
        createConflict(
          "duplicate_task",
          `Duplicate task found: "${existingSchedule.title}" is already scheduled on this date.`,
          existingSchedule,
          newSchedule,
          existingWindow,
          newWindow
        )
      );
    }

    if (sameDate && sameTime) {
      conflicts.push(
        createConflict(
          "same_time_entry",
          `Conflicting time entry: "${existingSchedule.title}" already starts at ${existingSchedule.timeOnly}.`,
          existingSchedule,
          newSchedule,
          existingWindow,
          newWindow
        )
      );
    }

    if (windowsOverlap(newWindow, existingWindow)) {
      conflicts.push(
        createConflict(
          "overlapping_schedule",
          `Overlapping schedule: "${newSchedule.title}" overlaps with "${existingSchedule.title}".`,
          existingSchedule,
          newSchedule,
          existingWindow,
          newWindow
        )
      );
    }
  });

  const uniqueConflicts = conflicts.filter(
    (conflict, index, list) =>
      index ===
      list.findIndex(
        (item) =>
          item.type === conflict.type &&
          String(item.existingSchedule?.id || item.existingSchedule?.title) ===
            String(conflict.existingSchedule?.id || conflict.existingSchedule?.title)
      )
  );

  return {
    hasConflicts: uniqueConflicts.length > 0,
    conflicts: uniqueConflicts,
    suggestions: generateReschedulingSuggestions(newSchedule, activeSchedules),
  };
}

export function buildConflictSummary(conflicts = []) {
  if (!conflicts.length) return "No conflicts detected.";

  return conflicts
    .slice(0, 3)
    .map((conflict, index) => `${index + 1}. ${conflict.message}`)
    .join("\n");
}

export function buildConflictNotificationBody(conflicts = [], suggestions = []) {
  const firstConflict = conflicts[0];
  const firstSuggestion = suggestions[0];

  if (!firstConflict) {
    return "SchedWise found a scheduling conflict.";
  }

  if (firstSuggestion) {
    return `${firstConflict.message} Suggested time: ${firstSuggestion.label}.`;
  }

  return `${firstConflict.message} Please choose another time.`;
}