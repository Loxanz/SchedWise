import { callGroqChat, GROQ_MODEL, isGroqConfigured } from "./groq";
import { filterCalendarSchedules } from "./scheduleStatus";

export const PRIORITY_HIGH = "High Priority";
export const PRIORITY_MEDIUM = "Medium Priority";
export const PRIORITY_LOW = "Low Priority";

const PRIORITY_SYSTEM_PROMPT =
  "You are SchedWise priority planner for students. " +
  "Rank ONLY today's pending schedules. " +
  "Use exactly these labels: " +
  '"High Priority", "Medium Priority", or "Low Priority". ' +
  "Rules: " +
  "1) Prefer High Priority for the heaviest urgent work today (many subtasks, exams, nearer times). " +
  "2) If a task has an EARLIER time than another task today, but that other task has MORE subtasks, " +
  "assign the earlier task Medium Priority (not High Priority). " +
  "3) Use Low Priority for routine lighter tasks today. " +
  "Do not invent schedules. Reply with ONLY valid JSON (no markdown): " +
  '{"priorities":[{"id":"string","priority":"High Priority|Medium Priority|Low Priority","reason":"short"}]}';

const padNumber = (value) => String(value).padStart(2, "0");

const getDateKey = (dateObject) =>
  `${dateObject.getFullYear()}-${padNumber(dateObject.getMonth() + 1)}-${padNumber(
    dateObject.getDate()
  )}`;

const getTodayDateKey = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getDateKey(today);
};

const getTomorrowDateKey = () => {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateKey(tomorrow);
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

  throw new Error("AI priority response was not valid JSON.");
};

const compactSchedule = (schedule) => ({
  id: String(schedule?.id || ""),
  title: String(schedule?.title || "Untitled"),
  date: String(schedule?.date || ""),
  timeOnly: String(schedule?.timeOnly || schedule?.time_only || ""),
  reminderTime: String(schedule?.reminderTime || schedule?.reminder_time || ""),
  subtasksCount: Array.isArray(schedule?.subtasks) ? schedule.subtasks.length : 0,
});

const parseScheduleTimestamp = (dateText, timeText) => {
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

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  const dateObject = new Date(year, month - 1, day, hour, minute);

  if (Number.isNaN(dateObject.getTime())) return null;

  return dateObject.getTime();
};

const getSubtaskCount = (schedule) =>
  Array.isArray(schedule?.subtasks) ? schedule.subtasks.length : 0;

export const normalizePriorityLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "high" ||
    normalized === "high priority" ||
    normalized === "highpriority"
  ) {
    return PRIORITY_HIGH;
  }

  if (
    normalized === "medium" ||
    normalized === "medium priority" ||
    normalized === "mid" ||
    normalized === "mid priority"
  ) {
    return PRIORITY_MEDIUM;
  }

  if (
    normalized === "low" ||
    normalized === "low priority" ||
    normalized === "normal" ||
    normalized === "normal priority"
  ) {
    return PRIORITY_LOW;
  }

  return PRIORITY_LOW;
};

export const isHighPriority = (priority) =>
  normalizePriorityLabel(priority) === PRIORITY_HIGH;

export const isMediumPriority = (priority) =>
  normalizePriorityLabel(priority) === PRIORITY_MEDIUM;

export const getPriorityColor = (priority, theme = {}) => {
  const label = normalizePriorityLabel(priority);

  if (label === PRIORITY_HIGH) {
    return theme.danger || theme.high || "#ff4d5f";
  }

  if (label === PRIORITY_MEDIUM) {
    return theme.warning || theme.medium || "#f59e0b";
  }

  return theme.success || theme.normal || theme.low || "#22c55e";
};

const hasEarlierTimeWithHeavierLaterTask = (schedule, schedules) => {
  const timestamp = schedule.timestamp;
  const subtasksCount = getSubtaskCount(schedule);

  if (timestamp === null) {
    return false;
  }

  return (Array.isArray(schedules) ? schedules : []).some((other) => {
    if (String(other.id) === String(schedule.id)) {
      return false;
    }

    if (other.timestamp === null) {
      return false;
    }

    return (
      timestamp < other.timestamp && getSubtaskCount(other) > subtasksCount
    );
  });
};

const applyTodayPriorityRules = (schedules) => {
  const items = (Array.isArray(schedules) ? schedules : []).map((schedule) => ({
    ...schedule,
  }));

  if (items.length === 1) {
    items[0].priority = PRIORITY_HIGH;
    return items;
  }

  items.forEach((schedule) => {
    if (hasEarlierTimeWithHeavierLaterTask(schedule, items)) {
      schedule.priority = PRIORITY_MEDIUM;
      return;
    }

    schedule.priority = normalizePriorityLabel(schedule.priority);
  });

  const hasHigh = items.some((item) => item.priority === PRIORITY_HIGH);

  if (!hasHigh && items.length > 0) {
    const candidates = [...items]
      .filter((item) => item.timestamp !== null)
      .sort((a, b) => {
        const subtaskDiff = getSubtaskCount(b) - getSubtaskCount(a);

        if (subtaskDiff !== 0) {
          return subtaskDiff;
        }

        return a.timestamp - b.timestamp;
      });

    const preferred =
      candidates.find(
        (item) => !hasEarlierTimeWithHeavierLaterTask(item, items)
      ) || candidates[0];

    if (preferred) {
      preferred.priority = PRIORITY_HIGH;
    }
  }

  return items;
};

const buildTodayFallbackPriorities = (schedules) => {
  const items = (Array.isArray(schedules) ? schedules : []).map((schedule) => ({
    ...schedule,
    priority: PRIORITY_LOW,
  }));

  if (items.length === 0) {
    return items;
  }

  if (items.length === 1) {
    items[0].priority = PRIORITY_HIGH;
    return items;
  }

  const sortedByTime = [...items]
    .filter((item) => item.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  sortedByTime.forEach((schedule, index) => {
    if (hasEarlierTimeWithHeavierLaterTask(schedule, items)) {
      schedule.priority = PRIORITY_MEDIUM;
      return;
    }

    schedule.priority = index === 0 ? PRIORITY_HIGH : PRIORITY_LOW;
  });

  const heaviestLater = [...items]
    .filter((item) => item.timestamp !== null)
    .sort((a, b) => {
      const subtaskDiff = getSubtaskCount(b) - getSubtaskCount(a);

      if (subtaskDiff !== 0) {
        return subtaskDiff;
      }

      return a.timestamp - b.timestamp;
    })[0];

  if (
    heaviestLater &&
    getSubtaskCount(heaviestLater) > 0 &&
    !hasEarlierTimeWithHeavierLaterTask(heaviestLater, items)
  ) {
    const soonest = sortedByTime[0];

    if (
      soonest &&
      String(soonest.id) !== String(heaviestLater.id) &&
      getSubtaskCount(heaviestLater) > getSubtaskCount(soonest)
    ) {
      soonest.priority = PRIORITY_MEDIUM;
      heaviestLater.priority = PRIORITY_HIGH;
    }
  }

  return applyTodayPriorityRules(items);
};

const buildPriorityFingerprint = (
  schedules,
  { includeReminder = false } = {}
) => {
  const todayKey = getTodayDateKey();
  const tomorrowKey = getTomorrowDateKey();

  return (Array.isArray(schedules) ? schedules : [])
    .map((schedule) => {
      const subtasksCount = getSubtaskCount(schedule);
      const base = `${schedule.id}|${schedule.date}|${schedule.timeOnly}|${schedule.title}|${schedule.completed}|${subtasksCount}`;

      if (!includeReminder) {
        return `${base}|${todayKey}|${tomorrowKey}`;
      }

      const reminderEnabled = Boolean(schedule?.reminderEnabled) ? "1" : "0";
      const reminderTime = String(
        schedule?.reminderTime || schedule?.reminder_time || ""
      ).trim();

      return `${base}|${reminderEnabled}|${reminderTime}|${todayKey}|${tomorrowKey}`;
    })
    .sort()
    .join("||");
};

export const getSchedulePriorityFingerprint = (schedules) =>
  buildPriorityFingerprint(filterCalendarSchedules(schedules), {
    includeReminder: true,
  });

const assignPrioritiesForToday = async (daySchedules) => {
  const withTimestamps = daySchedules.map((schedule) => ({
    ...schedule,
    timestamp: parseScheduleTimestamp(schedule.date, schedule.timeOnly),
  }));

  let priorityById = {};

  if (withTimestamps.length === 1) {
    priorityById[String(withTimestamps[0].id)] = PRIORITY_HIGH;
  } else if (!isGroqConfigured()) {
    buildTodayFallbackPriorities(withTimestamps).forEach((schedule) => {
      priorityById[String(schedule.id)] = schedule.priority;
    });
  } else {
    const reply = await callGroqChat({
      model: GROQ_MODEL,
      temperature: 0.1,
      maxTokens: 700,
      messages: [
        { role: "system", content: PRIORITY_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            now: new Date().toISOString(),
            date: withTimestamps[0]?.date || "",
            schedules: withTimestamps.map(compactSchedule),
            rule:
              "Rank only today's tasks. If task A is earlier than task B but B has more subtasks, A must be Medium Priority.",
          }),
        },
      ],
    });

    const parsed = extractJsonObject(reply);
    const priorities = Array.isArray(parsed?.priorities)
      ? parsed.priorities
      : [];

    priorities.forEach((entry) => {
      const id = String(entry?.id || "").trim();

      if (id) {
        priorityById[id] = normalizePriorityLabel(entry?.priority);
      }
    });
  }

  return applyTodayPriorityRules(
    withTimestamps.map((schedule) => ({
      ...schedule,
      priority: priorityById[String(schedule.id)] || PRIORITY_LOW,
    }))
  );
};

const reuseTodayPriorities = (daySchedules, previousRanked = []) => {
  const previousById = new Map(
    (Array.isArray(previousRanked) ? previousRanked : []).map((schedule) => [
      String(schedule.id),
      normalizePriorityLabel(schedule.priority),
    ])
  );

  const withTimestamps = daySchedules.map((schedule) => ({
    ...schedule,
    timestamp: parseScheduleTimestamp(schedule.date, schedule.timeOnly),
    priority: previousById.get(String(schedule.id)) || PRIORITY_LOW,
  }));

  const allMapped = withTimestamps.every((schedule) =>
    previousById.has(String(schedule.id))
  );

  if (!allMapped) {
    return null;
  }

  return withTimestamps;
};

/**
 * Priority rules:
 * - due today → keep existing High/Medium/Low ranking for today
 * - due tomorrow → Medium Priority
 * - otherwise → Low Priority
 */
export async function assignAiSchedulePriorities(
  schedules = [],
  previousRanked = []
) {
  const activeSchedules = filterCalendarSchedules(schedules);
  const todayKey = getTodayDateKey();
  const tomorrowKey = getTomorrowDateKey();

  if (activeSchedules.length === 0) {
    return [];
  }

  const todaySchedules = activeSchedules.filter(
    (schedule) => String(schedule.date || "") === todayKey
  );
  const otherSchedules = activeSchedules.filter(
    (schedule) => String(schedule.date || "") !== todayKey
  );

  let rankedToday = [];

  if (todaySchedules.length > 0) {
    const currentFingerprint = buildPriorityFingerprint(todaySchedules);
    const previousToday = (Array.isArray(previousRanked) ? previousRanked : []).filter(
      (schedule) => String(schedule.date || "") === todayKey
    );
    const previousFingerprint = buildPriorityFingerprint(previousToday);

    if (
      currentFingerprint &&
      currentFingerprint === previousFingerprint
    ) {
      rankedToday = reuseTodayPriorities(todaySchedules, previousToday) || [];
    }

    if (rankedToday.length === 0) {
      rankedToday = await assignPrioritiesForToday(todaySchedules);
    }
  }

  const rankedOthers = otherSchedules.map((schedule) => ({
    ...schedule,
    timestamp: parseScheduleTimestamp(schedule.date, schedule.timeOnly),
    priority:
      String(schedule.date || "") === tomorrowKey
        ? PRIORITY_MEDIUM
        : PRIORITY_LOW,
  }));

  return [...rankedToday, ...rankedOthers].sort((a, b) => {
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return a.timestamp - b.timestamp;
  });
}
