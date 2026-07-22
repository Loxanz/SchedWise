export const parseScheduleDateTime = (dateText, timeText) => {
  if (!dateText || !timeText) {
    return null;
  }

  const [yearText, monthText, dayText] = String(dateText).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const timeMatch = String(timeText)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

  if (!year || !month || !day || !timeMatch) {
    return null;
  }

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const period = timeMatch[3].toUpperCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  const dateObject = new Date(year, month - 1, day, hour, minute);

  if (Number.isNaN(dateObject.getTime())) {
    return null;
  }

  return dateObject;
};

export const normalizeStoredReminderTime = (reminderTime) => {
  const text = String(reminderTime || "").trim().toLowerCase();

  if (!text) {
    return "";
  }

  if (text.includes("same with due date") || text === "on due date") {
    return "Same with due date";
  }

  const normalized = normalizeReminderTimeText(text);

  if (normalized) {
    return normalized;
  }

  const customMatch = text.match(
    /(\d+)\s+(minute|minutes|hour|hours|day|days)\s+before/
  );

  if (customMatch) {
    const value = customMatch[1];
    const unit = customMatch[2].startsWith("minute")
      ? Number(value) === 1
        ? "minute"
        : "minutes"
      : customMatch[2].startsWith("hour")
      ? Number(value) === 1
        ? "hour"
        : "hours"
      : Number(value) === 1
      ? "day"
      : "days";

    return `${value} ${unit} before`;
  }

  return String(reminderTime).trim();
};

export const getReminderOffsetMinutes = (reminderTime) => {
  const normalized = normalizeStoredReminderTime(reminderTime);
  const text = normalized.toLowerCase();

  if (!text) {
    return null;
  }

  if (text.includes("same with due date")) {
    return 0;
  }

  const customMatch = text.match(
    /^(\d+)\s+(minute|minutes|hour|hours|day|days)\s+before$/
  );

  if (!customMatch) {
    return null;
  }

  const value = Number(customMatch[1]);
  const unit = customMatch[2];

  if (unit.startsWith("minute")) {
    return -value;
  }

  if (unit.startsWith("hour")) {
    return -(value * 60);
  }

  if (unit.startsWith("day")) {
    return -(value * 1440);
  }

  return null;
};

const formatReminderOffsetLabel = (value, unit) => {
  const amount = Number(value);

  if (unit.startsWith("minute")) {
    return `${amount} ${amount === 1 ? "minute" : "minutes"} before`;
  }

  if (unit.startsWith("hour")) {
    return `${amount} ${amount === 1 ? "hour" : "hours"} before`;
  }

  return `${amount} ${amount === 1 ? "day" : "days"} before`;
};

export const normalizeReminderTimeText = (text) => {
  const cleaned = String(text || "").trim().toLowerCase();

  if (!cleaned) {
    return "";
  }

  if (
    cleaned.includes("same with due date") ||
    cleaned.includes("on due date")
  ) {
    return "Same with due date";
  }

  const minuteMatch = cleaned.match(
    /\b(\d+)\s*(?:minute|minutes|min)\s+before\b/
  );

  if (minuteMatch) {
    return formatReminderOffsetLabel(minuteMatch[1], "minutes");
  }

  const hourMatch =
    cleaned.match(/\b(\d+)\s*(?:hour|hours|hr|hrs)\s+before\b/) ||
    cleaned.match(/\b(\d+)(?:hr|hrs)\s+before\b/);

  if (hourMatch) {
    return formatReminderOffsetLabel(hourMatch[1], "hours");
  }

  if (/\b(?:one|an|a|1)\s+hour\s+before\b/.test(cleaned)) {
    return "1 hour before";
  }

  if (/\ban?\s+hr\s+before\b/.test(cleaned)) {
    return "1 hour before";
  }

  const dayMatch = cleaned.match(/\b(\d+)\s*(?:day|days)\s+before\b/);

  if (dayMatch) {
    return formatReminderOffsetLabel(dayMatch[1], "days");
  }

  if (/\b(?:one|a)\s+day\s+before\b/.test(cleaned) || cleaned.includes("day before")) {
    return "1 day before";
  }

  return "";
};

export const extractReminderTaskTitle = (text) => {
  const cleaned = String(text || "").trim();

  if (!cleaned) {
    return "";
  }

  const patterns = [
    /\bbefore(?:\s+the)?(?:\s+deadline|\s+due\s+date)?\s+for\s+(?:the\s+)?(.+)$/i,
    /\bfor\s+(?:the\s+)?(.+?)(?=\s+task\s+\d|\s+\d+\s*(?:minute|minutes|min|hour|hours|hr|hrs|day|days)\s+before|\s+\d+(?:hr|hrs)\s+before)/i,
    /\bon\s+(?:the\s+)?(.+?)(?=\s+\d+\s*(?:minute|minutes|min|hour|hours|hr|hrs|day|days)\s+before|\s+\d+(?:hr|hrs)\s+before)/i,
    /\bfor\s+(?:the\s+)?(?!(?:both|all|them|these|those)\b)(.+?)(?:\s+task|\s+schedule)\b/i,
    /\b(?:task|schedule)\s+(.+?)(?=\s+\d+\s*(?:minute|minutes|min|hour|hours|hr|hrs|day|days)\s+before|\s+\d+(?:hr|hrs)\s+before|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);

    if (match?.[1]) {
      return String(match[1])
        .trim()
        .replace(/^(?:the\s+)?/, "")
        .replace(/\s+(?:task|schedule)$/i, "")
        .replace(/[,.]$/, "");
    }
  }

  return "";
};

export const REMINDER_OPTION_EXAMPLES = [
  "Same with due date",
  "5 minutes before",
  "15 minutes before",
  "30 minutes before",
  "1 hour before",
  "1 day before",
];

export const buildReminderClarificationMessage = () => {
  return [
    "What reminder time would you like to set?",
    "",
    "Reply with a specific time, for example:",
    '- "10 minutes before"',
    '- "15 minutes before"',
    '- "45 minutes before"',
    '- "1 hour before"',
    '- "1 day before"',
    '- "same with due date"',
  ].join("\n");
};

export const isReminderIntentMessage = (text) => {
  const cleaned = String(text || "").trim().toLowerCase();

  if (!cleaned) {
    return false;
  }

  return (
    /remind|reminder|alert|notify/i.test(cleaned) ||
    /\b\d+\s*(?:minute|minutes|min|hour|hours|hr|hrs|day|days)\s+before\b/i.test(
      cleaned
    ) ||
    /\b\d+(?:hr|hrs)\s+before\b/i.test(cleaned) ||
    /\b(?:one|an|a)\s+hour\s+before\b/i.test(cleaned) ||
    /\b(same with due date|on due date)\b/i.test(cleaned)
  );
};

export const isAmbiguousReminderMessage = (text) => {
  const cleaned = String(text || "").trim().toLowerCase();

  if (!isReminderIntentMessage(cleaned)) {
    return false;
  }

  if (normalizeReminderTimeText(text)) {
    return false;
  }

  if (/\b\d+\s+before\b/i.test(cleaned)) {
    return true;
  }

  if (/remind|reminder|alert|notify/i.test(cleaned)) {
    return true;
  }

  return false;
};

export const parseReminderRequest = (text) => {
  if (!isReminderIntentMessage(text)) {
    return { status: "none" };
  }

  const reminderTime = normalizeReminderTimeText(text);

  if (reminderTime) {
    return {
      status: "clear",
      reminderTime,
    };
  }

  if (isAmbiguousReminderMessage(text)) {
    return {
      status: "ambiguous",
    };
  }

  return { status: "none" };
};

export const computeReminderTriggerDate = (schedule) => {
  if (!schedule?.reminderEnabled || !schedule?.reminderTime) {
    return null;
  }

  const dueDate = parseScheduleDateTime(schedule.date, schedule.timeOnly);

  if (!dueDate) {
    return null;
  }

  const offsetMinutes = getReminderOffsetMinutes(schedule.reminderTime);

  if (offsetMinutes === null) {
    return null;
  }

  return new Date(dueDate.getTime() + offsetMinutes * 60 * 1000);
};
