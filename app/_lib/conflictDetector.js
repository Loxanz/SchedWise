import { callGroqChat, GROQ_MODEL, isGroqConfigured } from "./groq";

const CONFLICT_SYSTEM_PROMPT =
  "You are SchedWise conflict analyst. Detect scheduling conflicts for a student app. " +
  "Compare the NEW schedule against EXISTING schedules. " +
  "TIME CONFLICT RULE (strict): a time conflict exists ONLY when the NEW schedule has the EXACT same date AND EXACT same start time as an existing schedule. " +
  "Examples that are NOT conflicts: 8:00 AM vs 8:01 AM, 8:00 AM vs 8:30 AM, 8:00 AM vs 9:00 AM. " +
  "Do NOT assume tasks last 60 minutes. Do NOT treat nearby or overlapping windows as conflicts. " +
  "A duplicate_task conflict exists only when the title matches (case-insensitive) on the same date. " +
  "Reply with ONLY valid JSON (no markdown) using this shape: " +
  '{"hasConflicts":boolean,"conflicts":[{"type":"same_time_entry|duplicate_task","message":"string","existingTitle":"string","existingDate":"YYYY-MM-DD","existingTimeOnly":"h:mm AM/PM"}],"suggestions":[{"date":"YYYY-MM-DD","timeOnly":"h:mm AM/PM","label":"string","windowText":"string","reason":"string"}]}. ' +
  "When hasConflicts is true, suggest up to 3 alternative date/times. " +
  "CRITICAL suggestion rules: " +
  "1) NEVER suggest yesterday or any past date/time. Only suggest times strictly after now. " +
  "2) Prefer the MOST EFFICIENT reschedule: same day first, at least 1 HOUR before or 1 HOUR after the conflicting start time, and only if that exact slot is free. " +
  "3) If same day +/- 1 hour options are limited, try further same-day offsets still at least 1 hour away, then next day at a similar time. " +
  "4) Keep suggestions within 6:00 AM - 10:00 PM. " +
  "5) NEVER suggest a date+time that already has an existing task at that EXACT start time. " +
  "6) NEVER suggest a same-day time less than 60 minutes away from the conflicting start time. " +
  "7) Do not invent conflicts. If none, return hasConflicts false with empty arrays. " +
  "8) Labels must use concrete dates (YYYY-MM-DD or Month Day), never the word yesterday.";

const normalizeTimeKey = (value) => {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

  if (!match) {
    return "";
  }

  const hour = Number(match[1]);
  const minute = match[2];
  const period = match[3].toUpperCase();

  if (hour < 1 || hour > 12) {
    return "";
  }

  return `${hour}:${minute} ${period}`;
};

const isExactSameStartTime = (firstSchedule, secondSchedule) => {
  const firstDate = String(firstSchedule?.date || "").trim();
  const secondDate = String(secondSchedule?.date || "").trim();
  const firstTime = normalizeTimeKey(
    firstSchedule?.timeOnly || firstSchedule?.time_only
  );
  const secondTime = normalizeTimeKey(
    secondSchedule?.timeOnly || secondSchedule?.time_only
  );

  return Boolean(
    firstDate &&
      secondDate &&
      firstTime &&
      secondTime &&
      firstDate === secondDate &&
      firstTime === secondTime
  );
};

const isExactDuplicateTitleSameDate = (firstSchedule, secondSchedule) => {
  const firstDate = String(firstSchedule?.date || "").trim();
  const secondDate = String(secondSchedule?.date || "").trim();
  const firstTitle = String(firstSchedule?.title || "")
    .trim()
    .toLowerCase();
  const secondTitle = String(secondSchedule?.title || "")
    .trim()
    .toLowerCase();

  return Boolean(
    firstDate &&
      secondDate &&
      firstTitle &&
      secondTitle &&
      firstDate === secondDate &&
      firstTitle === secondTitle
  );
};

const padNumber = (value) => String(value).padStart(2, "0");

const getDateKey = (dateObject) =>
  `${dateObject.getFullYear()}-${padNumber(dateObject.getMonth() + 1)}-${padNumber(
    dateObject.getDate()
  )}`;

const formatTimeOnly = (dateObject) => {
  let hour = dateObject.getHours();
  const minute = padNumber(dateObject.getMinutes());
  const period = hour >= 12 ? "PM" : "AM";

  hour %= 12;
  hour = hour === 0 ? 12 : hour;

  return `${hour}:${minute} ${period}`;
};

const parseScheduleDateTime = (dateText, timeText) => {
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

  const dateObject = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (Number.isNaN(dateObject.getTime())) return null;

  return dateObject;
};

const mentionsYesterday = (value) =>
  /\byesterday\b/i.test(String(value || ""));

const isFutureSuggestion = (date, timeOnly, now = new Date()) => {
  const when = parseScheduleDateTime(date, timeOnly);

  if (!when) {
    return false;
  }

  return when.getTime() > now.getTime();
};

const isDateTimeOccupied = (date, timeOnly, schedules = []) => {
  const dateKey = String(date || "").trim();
  const timeKey = normalizeTimeKey(timeOnly);

  if (!dateKey || !timeKey) {
    return false;
  }

  return (Array.isArray(schedules) ? schedules : []).some((schedule) => {
    if (Boolean(schedule?.completed)) {
      return false;
    }

    const scheduleDate = String(schedule?.date || "").trim();
    const scheduleTime = normalizeTimeKey(
      schedule?.timeOnly || schedule?.time_only
    );

    return scheduleDate === dateKey && scheduleTime === timeKey;
  });
};

const MIN_SUGGESTION_GAP_MS = 60 * 60 * 1000;

const isAtLeastOneHourFromRequested = (candidateStart, requestedStart) => {
  if (!candidateStart || !requestedStart) {
    return true;
  }

  // Different calendar days are always allowed.
  if (getDateKey(candidateStart) !== getDateKey(requestedStart)) {
    return true;
  }

  return (
    Math.abs(candidateStart.getTime() - requestedStart.getTime()) >=
    MIN_SUGGESTION_GAP_MS
  );
};

const isSlotFree = (candidateStart, schedules) => {
  if (!candidateStart) {
    return false;
  }

  return !isDateTimeOccupied(
    getDateKey(candidateStart),
    formatTimeOnly(candidateStart),
    schedules
  );
};

const createSuggestion = (dateObject, reason) => {
  const date = getDateKey(dateObject);
  const timeOnly = formatTimeOnly(dateObject);

  return {
    date,
    timeOnly,
    label: `${date} • ${timeOnly}`,
    windowText: timeOnly,
    reason,
    timestamp: dateObject.getTime(),
  };
};

const buildEfficientFallbackSuggestions = (
  newSchedule,
  existingSchedules = [],
  now = new Date()
) => {
  const requestedStart =
    parseScheduleDateTime(newSchedule?.date, newSchedule?.timeOnly) || now;
  const suggestions = [];
  const dayStartHour = 6;
  const dayEndHour = 22;

  const tryPush = (candidate, reason) => {
    if (!candidate || suggestions.length >= 3) {
      return;
    }

    if (candidate.getTime() <= now.getTime()) {
      return;
    }

    const hour = candidate.getHours();

    if (hour < dayStartHour || hour >= dayEndHour) {
      return;
    }

    if (!isAtLeastOneHourFromRequested(candidate, requestedStart)) {
      return;
    }

    if (!isSlotFree(candidate, existingSchedules)) {
      return;
    }

    const suggestion = createSuggestion(candidate, reason);
    const duplicate = suggestions.some(
      (item) =>
        item.date === suggestion.date && item.timeOnly === suggestion.timeOnly
    );

    if (!duplicate) {
      suggestions.push(suggestion);
    }
  };

  // Prefer +/- 1 hour first when those slots are free, then farther hourly offsets.
  const sameDayOffsetsHours = [1, -1, 2, -2, 3, -3, 4, -4];

  sameDayOffsetsHours.forEach((offsetHours) => {
    if (suggestions.length >= 2) {
      return;
    }

    tryPush(
      new Date(
        requestedStart.getTime() + offsetHours * MIN_SUGGESTION_GAP_MS
      ),
      offsetHours < 0
        ? "Available time at least 1 hour before"
        : "Available time at least 1 hour after"
    );
  });

  // Next efficient option: next day at a similar time, then hourly offsets.
  const nextDay = new Date(requestedStart);
  nextDay.setDate(nextDay.getDate() + 1);

  for (let step = 0; step <= 6 && suggestions.length < 3; step += 1) {
    tryPush(
      new Date(nextDay.getTime() + step * MIN_SUGGESTION_GAP_MS),
      "Next day at a similar time"
    );
  }

  // Safety net: walk forward from now in 1-hour steps.
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1);

  for (let step = 0; step <= 48 && suggestions.length < 3; step += 1) {
    tryPush(
      new Date(cursor.getTime() + step * MIN_SUGGESTION_GAP_MS),
      "Soonest available future start time"
    );
  }

  return suggestions.slice(0, 3);
};

const extractJsonObject = (text) => {
  const raw = String(text || "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // continue
    }
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return JSON.parse(raw.slice(start, end + 1));
  }

  throw new Error("AI conflict response was not valid JSON.");
};

const compactSchedule = (schedule) => ({
  id: String(schedule?.id || ""),
  title: String(schedule?.title || "Untitled"),
  date: String(schedule?.date || ""),
  timeOnly: String(schedule?.timeOnly || schedule?.time_only || ""),
  completed: Boolean(schedule?.completed),
  reminderTime: String(schedule?.reminderTime || schedule?.reminder_time || ""),
  subtasks: Array.isArray(schedule?.subtasks)
    ? schedule.subtasks.map((item) => String(item?.text || "")).filter(Boolean)
    : [],
});

const findExistingSchedule = (existingSchedules, conflict) => {
  const title = String(conflict?.existingTitle || "")
    .trim()
    .toLowerCase();
  const date = String(conflict?.existingDate || "").trim();
  const timeOnly = String(conflict?.existingTimeOnly || "").trim().toLowerCase();

  return (
    (Array.isArray(existingSchedules) ? existingSchedules : []).find((schedule) => {
      const scheduleTitle = String(schedule?.title || "")
        .trim()
        .toLowerCase();
      const scheduleDate = String(schedule?.date || "").trim();
      const scheduleTime = String(schedule?.timeOnly || "")
        .trim()
        .toLowerCase();

      if (title && scheduleTitle === title && (!date || scheduleDate === date)) {
        return true;
      }

      if (date && timeOnly && scheduleDate === date && scheduleTime === timeOnly) {
        return true;
      }

      return false;
    }) || null
  );
};

const normalizeSuggestions = (
  suggestions,
  newSchedule,
  existingSchedules = [],
  now = new Date()
) => {
  const cleaned = (Array.isArray(suggestions) ? suggestions : [])
    .map((suggestion) => {
      const date = String(suggestion?.date || "").trim();
      const rawTimeOnly = String(suggestion?.timeOnly || "").trim();
      const timeOnly = normalizeTimeKey(rawTimeOnly) || rawTimeOnly;
      const label = String(suggestion?.label || "").trim();
      const windowText = String(suggestion?.windowText || "").trim();
      const reason = String(suggestion?.reason || "").trim();

      if (!date || !timeOnly || !normalizeTimeKey(timeOnly)) {
        return null;
      }

      if (
        mentionsYesterday(date) ||
        mentionsYesterday(timeOnly) ||
        mentionsYesterday(label) ||
        mentionsYesterday(reason)
      ) {
        return null;
      }

      if (!isFutureSuggestion(date, timeOnly, now)) {
        return null;
      }

      // Never suggest a slot that already has a task at that exact time.
      if (isDateTimeOccupied(date, timeOnly, existingSchedules)) {
        return null;
      }

      const when = parseScheduleDateTime(date, timeOnly);
      const requestedStart = parseScheduleDateTime(
        newSchedule?.date,
        newSchedule?.timeOnly
      );

      // Same-day suggestions must be at least 1 hour before or after.
      if (
        when &&
        requestedStart &&
        !isAtLeastOneHourFromRequested(when, requestedStart)
      ) {
        return null;
      }

      return {
        date,
        timeOnly,
        label: label && !mentionsYesterday(label) ? label : `${date} • ${timeOnly}`,
        windowText: windowText || timeOnly,
        reason: reason || "Efficient alternative slot",
        timestamp: when?.getTime() || Number.MAX_SAFE_INTEGER,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  const fallback = buildEfficientFallbackSuggestions(
    newSchedule,
    existingSchedules,
    now
  );

  const requestedStart = parseScheduleDateTime(
    newSchedule?.date,
    newSchedule?.timeOnly
  );

  const merged = [];

  [...cleaned, ...fallback].forEach((suggestion) => {
    if (merged.length >= 3) {
      return;
    }

    if (isDateTimeOccupied(suggestion.date, suggestion.timeOnly, existingSchedules)) {
      return;
    }

    const when = parseScheduleDateTime(suggestion.date, suggestion.timeOnly);

    if (
      when &&
      requestedStart &&
      !isAtLeastOneHourFromRequested(when, requestedStart)
    ) {
      return;
    }

    const duplicate = merged.some(
      (item) =>
        item.date === suggestion.date &&
        normalizeTimeKey(item.timeOnly) === normalizeTimeKey(suggestion.timeOnly)
    );

    if (!duplicate) {
      merged.push(suggestion);
    }
  });

  return merged
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .slice(0, 3)
    .map(({ timestamp, ...rest }) => rest);
};

export async function detectScheduleConflicts(
  newSchedule,
  existingSchedules = []
) {
  if (!newSchedule?.date || !newSchedule?.timeOnly) {
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
      schedule &&
      !schedule.completed &&
      String(schedule.id || "") !== String(newSchedule.id || "")
  );

  if (activeSchedules.length === 0) {
    return {
      hasConflicts: false,
      conflicts: [],
      suggestions: [],
    };
  }

  if (!isGroqConfigured()) {
    throw new Error(
      "Missing Groq API key. Add EXPO_PUBLIC_GROQ_API_KEY to your .env file, then restart Expo."
    );
  }

  const now = new Date();

  const reply = await callGroqChat({
    model: GROQ_MODEL,
    temperature: 0.1,
    maxTokens: 900,
    messages: [
      { role: "system", content: CONFLICT_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          now: now.toISOString(),
          today: getDateKey(now),
          newSchedule: compactSchedule(newSchedule),
          existingSchedules: activeSchedules.map(compactSchedule),
          instruction:
            "Suggest only future slots. Prefer same-day nearest free time after the conflict, then next day. Never use yesterday.",
        }),
      },
    ],
  });

  const parsed = extractJsonObject(reply);
  const rawConflicts = Array.isArray(parsed?.conflicts) ? parsed.conflicts : [];

  const localConflicts = [];

  activeSchedules.forEach((existingSchedule) => {
    if (isExactSameStartTime(newSchedule, existingSchedule)) {
      localConflicts.push({
        id: `same_time_entry-${existingSchedule.id || existingSchedule.title}`,
        type: "same_time_entry",
        message: `Conflicting time entry: "${existingSchedule.title}" already starts at ${normalizeTimeKey(
          existingSchedule.timeOnly
        )} on this date.`,
        existingSchedule,
        newSchedule,
        existingWindowText: `${existingSchedule.date} • ${existingSchedule.timeOnly}`,
        newWindowText: `${newSchedule.date} • ${newSchedule.timeOnly}`,
      });
    } else if (isExactDuplicateTitleSameDate(newSchedule, existingSchedule)) {
      localConflicts.push({
        id: `duplicate_task-${existingSchedule.id || existingSchedule.title}`,
        type: "duplicate_task",
        message: `Duplicate task found: "${existingSchedule.title}" is already scheduled on this date.`,
        existingSchedule,
        newSchedule,
        existingWindowText: `${existingSchedule.date} • ${existingSchedule.timeOnly}`,
        newWindowText: `${newSchedule.date} • ${newSchedule.timeOnly}`,
      });
    }
  });

  const aiConflicts = rawConflicts
    .map((conflict, index) => {
      const existingSchedule = findExistingSchedule(activeSchedules, conflict);
      const message = String(conflict?.message || "").trim();
      const type = String(conflict?.type || "").trim();

      if (!message || !existingSchedule) {
        return null;
      }

      const isValidTimeConflict =
        type === "same_time_entry" &&
        isExactSameStartTime(newSchedule, existingSchedule);
      const isValidDuplicateConflict =
        type === "duplicate_task" &&
        isExactDuplicateTitleSameDate(newSchedule, existingSchedule);

      // Ignore AI near-time / overlap guesses like 8:00 vs 8:01 or 8:30.
      if (!isValidTimeConflict && !isValidDuplicateConflict) {
        return null;
      }

      return {
        id: `${type}-${existingSchedule?.id || index}`,
        type,
        message,
        existingSchedule,
        newSchedule,
        existingWindowText: `${existingSchedule.date} • ${existingSchedule.timeOnly}`,
        newWindowText: `${newSchedule.date} • ${newSchedule.timeOnly}`,
      };
    })
    .filter(Boolean);

  const conflicts = [...localConflicts];

  aiConflicts.forEach((conflict) => {
    const alreadyAdded = conflicts.some(
      (item) =>
        item.type === conflict.type &&
        String(item.existingSchedule?.id || item.existingSchedule?.title) ===
          String(conflict.existingSchedule?.id || conflict.existingSchedule?.title)
    );

    if (!alreadyAdded) {
      conflicts.push(conflict);
    }
  });

  const hasConflicts = conflicts.length > 0;

  return {
    hasConflicts,
    conflicts,
    suggestions: hasConflicts
      ? normalizeSuggestions(
          parsed?.suggestions,
          newSchedule,
          activeSchedules,
          now
        )
      : [],
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

  if (!firstConflict?.message) {
    return "SchedWise found a scheduling conflict.";
  }

  if (suggestions.length > 0) {
    return `${firstConflict.message} Suggested time: ${suggestions[0].label}`;
  }

  return firstConflict.message;
}
