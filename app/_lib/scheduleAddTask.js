import { DeviceEventEmitter } from "react-native";
import {
  addLocalSchedule,
  getLocalSchedules,
  markLocalScheduleSynced,
} from "./localSchedules";
import { syncSchedulePhoneCalendar } from "./phoneCalendarSync";
import {
  CONFLICT_ADJUST_HELP,
  formatChatConflictReply,
  isSaveAnywayMessage,
  parseConflictDateTimeAdjustment,
  parseConflictSuggestionChoice,
  runChatScheduleConflictCheck,
} from "./scheduleChatConflicts";
import { syncReminderForSchedule } from "./scheduleReminders";
import {
  parseRequestedScheduleDate,
  SCHEDULE_CHANGE_EVENT,
} from "./scheduleSummary";
import { addUserSchedule, getCurrentUser } from "./supabase";

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

const normalizeTimeOnly = (value) => {
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

const extractTimeFromText = (text) => {
  const match = String(text || "").match(
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
  );

  if (!match) {
    return { timeOnly: "", remainder: String(text || "").trim() };
  }

  const hour = match[1];
  const minute = match[2] || "00";
  const period = match[3].toUpperCase();
  const timeOnly = normalizeTimeOnly(`${hour}:${minute} ${period}`);
  const remainder = String(text || "")
    .replace(match[0], " ")
    .replace(/\s+/g, " ")
    .trim();

  return { timeOnly, remainder };
};

const stripParsedDateFromText = (text) => {
  return String(text || "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b/gi,
      " "
    )
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ")
    .replace(/\b(?:on|at|for|scheduled)\b/gi, " ")
    .replace(/[,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanTaskTitle = (text) => {
  return String(text || "")
    .replace(/^title[\s:]+/i, "")
    .replace(/^called[\s:]+/i, "")
    .replace(/^named[\s:]+/i, "")
    .replace(/[,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const isAddTaskRequest = (text) => {
  const normalized = String(text || "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (
    (/\b(what|show|check|list|view|tell)\b/.test(normalized) ||
      normalized.startsWith("what")) &&
    /\b(schedule|tasks?)\b/.test(normalized)
  ) {
    return false;
  }

  // "add reminder for Capstone 1hr before" is a reminder update, not a new task.
  if (
    /\b(add|set|create)\s+(?:a\s+)?reminder\b/.test(normalized) ||
    /\bremind\s+me\b/.test(normalized) ||
    (/\breminder\b/.test(normalized) &&
      /\b(before|for)\b/.test(normalized) &&
      !/\badd\s+(?:a\s+)?(?:new\s+)?task\b/.test(normalized))
  ) {
    return false;
  }

  if (/^add\s+task\b/.test(normalized)) {
    return true;
  }

  if (
    /\bschedule\s+(?:a\s+)?(?:new\s+)?(?:task|event|appointment)\b/.test(
      normalized
    )
  ) {
    return true;
  }

  return (
    /\b(add|create|new|make|insert)\b/.test(normalized) &&
    /\b(task|event|appointment)\b/.test(normalized)
  );
};

export const hasIncompleteAddTaskDraft = (draft) => {
  if (!draft || typeof draft !== "object") {
    return false;
  }

  if (draft.awaitingConflictConfirm) {
    return true;
  }

  return !draft.title || !draft.date || !draft.timeOnly;
};

export const parseAddTaskMessage = (text) => {
  let working = String(text || "").trim();

  working = working.replace(
    /^(?:please\s+)?(?:add|create|new|make|insert|schedule)\s+(?:a\s+)?(?:task|schedule|event|appointment)(?:\s+title)?[\s:,-]*/i,
    ""
  );

  working = working.replace(
    /^(?:please\s+)?(?:change|update|set|move|reschedule|adjust|make(?:\s+it)?|put(?:\s+it)?)\s+(?:the\s+)?(?:time|date|schedule|task)?\s*(?:to|for|at)?\s*/i,
    ""
  );

  const { timeOnly, remainder: afterTime } = extractTimeFromText(working);
  working = afterTime;

  const date = parseRequestedScheduleDate(working) || "";
  const titleSource = date ? stripParsedDateFromText(working) : working;
  const title = cleanTaskTitle(titleSource);

  return {
    title,
    date,
    timeOnly,
  };
};

const isLikelyTitleNoise = (title) => {
  const normalized = String(title || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return true;
  }

  if (
    /^(?:the\s+)?(?:time|date|schedule|task|it|this|to|for|at|on)$/.test(
      normalized
    )
  ) {
    return true;
  }

  return /^(?:change|update|set|move|reschedule|adjust|make|put)\b/.test(
    normalized
  );
};

const mergeAddTaskDraft = (
  parsed,
  pendingDraft = null,
  { preserveTitleOnNoise = false } = {}
) => ({
  title:
    preserveTitleOnNoise && isLikelyTitleNoise(parsed.title)
      ? pendingDraft?.title || ""
      : parsed.title || pendingDraft?.title || "",
  date: parsed.date || pendingDraft?.date || "",
  timeOnly: parsed.timeOnly || pendingDraft?.timeOnly || "",
});

const buildMissingFieldsMessage = (draft) => {
  const missing = [];

  if (!draft.title) {
    missing.push("task title");
  }

  if (!draft.date) {
    missing.push("date");
  }

  if (!draft.timeOnly) {
    missing.push("time");
  }

  if (missing.length === 0) {
    return "";
  }

  return `Please provide the ${missing.join(", ")}. For example: Capstone, July 3, 5:00 PM`;
};

const buildSchedulePayload = (draft) => ({
  title: draft.title,
  date: draft.date,
  timeOnly: draft.timeOnly,
  icon: "calendar",
  completed: false,
  proofUri: "",
  reminderEnabled: false,
  reminderTime: "",
  subtasks: [],
});

const saveNewScheduleFromChat = async (schedulePayload) => {
  const localSchedule = await addLocalSchedule(schedulePayload);
  let finalSchedule = localSchedule;

  try {
    const user = await getCurrentUser();

    if (user) {
      const { data: remoteSchedule, error } = await addUserSchedule({
        ...schedulePayload,
        deviceCalendarEventId: "",
        deviceCalendarId: "",
        deviceCalendarSyncedAt: "",
      });

      if (!error && remoteSchedule) {
        const syncedSchedule = await markLocalScheduleSynced(
          localSchedule.id,
          remoteSchedule
        );

        finalSchedule = syncedSchedule || remoteSchedule;
      }
    }
  } catch {
    // Keep the local copy if remote sync fails.
  }

  if (finalSchedule) {
    await syncReminderForSchedule(finalSchedule);
    finalSchedule = await syncSchedulePhoneCalendar(finalSchedule);
  }

  DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);

  return finalSchedule;
};

const completeAddTaskSave = async (draft) => {
  const savedSchedule = await saveNewScheduleFromChat(buildSchedulePayload(draft));

  return {
    handled: true,
    updated: true,
    pendingAdd: null,
    schedule: savedSchedule,
    reply: `You have added a task titled "${savedSchedule.title}" scheduled for ${getReadableDate(
      savedSchedule.date
    )} at ${savedSchedule.timeOnly}.`,
  };
};

export const handleAddTaskChatAction = async (message, pendingDraft = null) => {
  const trimmed = String(message || "").trim();
  const hasPending = hasIncompleteAddTaskDraft(pendingDraft);
  const isExplicitAdd = isAddTaskRequest(trimmed);
  const awaitingConflict = Boolean(pendingDraft?.awaitingConflictConfirm);

  if (!isExplicitAdd && !hasPending) {
    return { handled: false };
  }

  if (awaitingConflict && isSaveAnywayMessage(trimmed)) {
    return completeAddTaskSave({
      title: pendingDraft.title,
      date: pendingDraft.date,
      timeOnly: pendingDraft.timeOnly,
    });
  }

  if (awaitingConflict) {
    const suggestion = parseConflictSuggestionChoice(
      trimmed,
      pendingDraft.conflictSuggestions
    );

    if (suggestion) {
      return completeAddTaskSave({
        title: pendingDraft.title,
        date: suggestion.date,
        timeOnly: suggestion.timeOnly,
      });
    }

    const adjustment = parseConflictDateTimeAdjustment(trimmed);

    if (adjustment.date || adjustment.timeOnly) {
      const adjustedDraft = {
        title: pendingDraft.title,
        date: adjustment.date || pendingDraft.date,
        timeOnly: adjustment.timeOnly || pendingDraft.timeOnly,
      };

      try {
        const existingSchedules = await getLocalSchedules();
        const conflictResult = await runChatScheduleConflictCheck(
          buildSchedulePayload(adjustedDraft),
          existingSchedules
        );

        if (conflictResult.hasConflicts) {
          return {
            handled: true,
            updated: false,
            pendingAdd: {
              ...adjustedDraft,
              awaitingConflictConfirm: true,
              conflictSuggestions: conflictResult.suggestions || [],
            },
            reply: formatChatConflictReply(conflictResult, adjustedDraft),
          };
        }
      } catch (error) {
        return {
          handled: true,
          updated: false,
          pendingAdd: {
            ...adjustedDraft,
            awaitingConflictConfirm: true,
            conflictSuggestions: [],
          },
          reply:
            error?.message ||
            'I could not finish the AI conflict check. Reply "save anyway" to add the task, or send a different date/time.',
        };
      }

      return completeAddTaskSave(adjustedDraft);
    }
  }

  const parsed = parseAddTaskMessage(trimmed);

  if (
    awaitingConflict &&
    !isExplicitAdd &&
    !parsed.title &&
    !parsed.date &&
    !parsed.timeOnly
  ) {
    return {
      handled: true,
      updated: false,
      pendingAdd: pendingDraft,
      reply: CONFLICT_ADJUST_HELP,
    };
  }

  if (
    awaitingConflict &&
    !isExplicitAdd &&
    !parsed.date &&
    !parsed.timeOnly &&
    isLikelyTitleNoise(parsed.title)
  ) {
    return {
      handled: true,
      updated: false,
      pendingAdd: pendingDraft,
      reply: CONFLICT_ADJUST_HELP,
    };
  }

  const draft = mergeAddTaskDraft(parsed, pendingDraft, {
    preserveTitleOnNoise: awaitingConflict,
  });

  if (!draft.title || !draft.date || !draft.timeOnly) {
    return {
      handled: true,
      updated: false,
      pendingAdd: {
        ...draft,
        awaitingConflictConfirm: false,
        conflictSuggestions: [],
      },
      reply: buildMissingFieldsMessage(draft),
    };
  }

  const skipConflictCheck =
    awaitingConflict &&
    draft.title === pendingDraft.title &&
    draft.date === pendingDraft.date &&
    draft.timeOnly === pendingDraft.timeOnly &&
    isSaveAnywayMessage(trimmed);

  if (!skipConflictCheck) {
    try {
      const existingSchedules = await getLocalSchedules();
      const conflictResult = await runChatScheduleConflictCheck(
        buildSchedulePayload(draft),
        existingSchedules
      );

      if (conflictResult.hasConflicts) {
        return {
          handled: true,
          updated: false,
          pendingAdd: {
            ...draft,
            awaitingConflictConfirm: true,
            conflictSuggestions: conflictResult.suggestions || [],
          },
          reply: formatChatConflictReply(conflictResult, draft),
        };
      }
    } catch (error) {
      return {
        handled: true,
        updated: false,
        pendingAdd: {
          ...draft,
          awaitingConflictConfirm: true,
          conflictSuggestions: [],
        },
        reply:
          error?.message ||
          'I could not finish the AI conflict check. Reply "save anyway" to add the task, or send a different date/time.',
      };
    }
  }

  return completeAddTaskSave(draft);
};
