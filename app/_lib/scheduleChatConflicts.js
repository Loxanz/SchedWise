import {
  buildConflictNotificationBody,
  buildConflictSummary,
  detectScheduleConflicts,
} from "./conflictDetector";
import { sendScheduleConflictNotification } from "./conflictNotifications";
import { parseRequestedScheduleDate } from "./scheduleSummary";

const padNumber = (value) => String(value).padStart(2, "0");

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

const getReadableDate = (dateKey) => {
  const [yearText, monthText, dayText] = String(dateKey || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return "Unknown date";
  }

  return `${shortMonthNames[month - 1] || "Date"} ${padNumber(day)}, ${year}`;
};

export const isSaveAnywayMessage = (text) => {
  const normalized = String(text || "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    /^(?:yes[, ]*)?(?:please[, ]*)?(?:save|add|create|schedule)\s+anyway\b/.test(
      normalized
    ) ||
    /^(?:force\s+)?(?:save|add)\b/.test(normalized) ||
    normalized === "anyway" ||
    normalized === "save it anyway" ||
    normalized === "add it anyway"
  );
};

export const parseConflictSuggestionChoice = (text, suggestions = []) => {
  const list = Array.isArray(suggestions) ? suggestions : [];

  if (list.length === 0) {
    return null;
  }

  const trimmed = String(text || "").trim();
  const numberMatch = trimmed.match(/^(\d+)$/);

  if (numberMatch) {
    const index = Number(numberMatch[1]) - 1;

    if (index >= 0 && index < list.length) {
      return list[index];
    }
  }

  const useMatch = trimmed.match(
    /^(?:use|choose|pick|select)\s+(?:suggestion\s+)?(\d+)\b/i
  );

  if (useMatch) {
    const index = Number(useMatch[1]) - 1;

    if (index >= 0 && index < list.length) {
      return list[index];
    }
  }

  return null;
};

const normalizeAdjustmentTimeOnly = (value) => {
  const cleaned = String(value || "").trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

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

const extractAdjustmentTimeOnly = (text) => {
  const cleaned = String(text || "").trim();

  if (!cleaned) {
    return "";
  }

  const match =
    cleaned.match(
      /\b(?:change|update|set|move|reschedule|adjust|make(?:\s+it)?|put(?:\s+it)?)\s+(?:the\s+)?time\s+(?:to|for|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
    ) ||
    cleaned.match(/\b(?:to|at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ||
    cleaned.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);

  if (!match) {
    return "";
  }

  const hour = match[1];
  const minute = match[2] || "00";
  const period = match[3].toUpperCase();

  return normalizeAdjustmentTimeOnly(`${hour}:${minute} ${period}`);
};

/**
 * Parse freeform conflict replies like:
 * - "change time to 8:01 AM"
 * - "8:30 AM"
 * - "move to tomorrow"
 * - "reschedule to July 24 at 2:00 PM"
 */
export const parseConflictDateTimeAdjustment = (text) => {
  const trimmed = String(text || "").trim();

  if (!trimmed || isSaveAnywayMessage(trimmed)) {
    return { date: "", timeOnly: "" };
  }

  if (/^\d+$/.test(trimmed)) {
    return { date: "", timeOnly: "" };
  }

  if (/^(?:use|choose|pick|select)\s+(?:suggestion\s+)?\d+\b/i.test(trimmed)) {
    return { date: "", timeOnly: "" };
  }

  const timeOnly = extractAdjustmentTimeOnly(trimmed);
  const date = parseRequestedScheduleDate(trimmed) || "";

  return { date, timeOnly };
};

export const CONFLICT_ADJUST_HELP =
  'Reply with a suggestion number (for example, 1), freely adjust with a new date/time (for example, "change time to 8:01 AM" or "tomorrow at 9:00 AM"), or say "save anyway" to keep the original time.';

export const formatChatConflictReply = (conflictResult, proposedSchedule) => {
  const title = String(proposedSchedule?.title || "this task").trim();
  const dateLabel = getReadableDate(proposedSchedule?.date);
  const timeLabel = String(proposedSchedule?.timeOnly || "").trim() || "the selected time";
  const summary = buildConflictSummary(conflictResult?.conflicts || []);
  const suggestions = Array.isArray(conflictResult?.suggestions)
    ? conflictResult.suggestions
    : [];

  const lines = [
    `Schedule conflict detected for "${title}" on ${dateLabel} at ${timeLabel}.`,
    "",
    summary,
  ];

  if (suggestions.length > 0) {
    lines.push("", "Best ways to reschedule:");
    suggestions.forEach((suggestion, index) => {
      const reason = String(suggestion?.reason || "").trim();
      lines.push(
        reason
          ? `${index + 1}. ${suggestion.label} — ${reason}`
          : `${index + 1}. ${suggestion.label}`
      );
    });
    lines.push("", CONFLICT_ADJUST_HELP);
  } else {
    lines.push(
      "",
      'Please freely choose a different future date/time (for example, "change time to 8:01 AM" or "tomorrow at 9:00 AM"), or say "save anyway" to keep this schedule anyway.'
    );
  }

  return lines.join("\n");
};

export const notifyScheduleConflict = async (conflictResult) => {
  try {
    await sendScheduleConflictNotification({
      title: "Schedule conflict detected",
      body: buildConflictNotificationBody(
        conflictResult?.conflicts || [],
        conflictResult?.suggestions || []
      ),
    });
  } catch (error) {
    console.log("Chatbot conflict notification failed:", error?.message);
  }
};

export const runChatScheduleConflictCheck = async (
  proposedSchedule,
  existingSchedules = []
) => {
  const conflictResult = await detectScheduleConflicts(
    proposedSchedule,
    existingSchedules
  );

  if (conflictResult.hasConflicts) {
    await notifyScheduleConflict(conflictResult);
  }

  return conflictResult;
};
