import { DeviceEventEmitter } from "react-native";
import { callGroqChat } from "./groq";
import {
  markLocalScheduleSynced,
  updateLocalSchedule,
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
import {
  buildTitleAmbiguityMessage,
  parseTitleChangeRequest,
} from "./scheduleEditUtils";
import { syncReminderForSchedule } from "./scheduleReminders";
import {
  buildReminderClarificationMessage,
  extractReminderTaskTitle,
  normalizeReminderTimeText,
  parseReminderRequest,
} from "./scheduleReminderUtils";
import { filterCalendarSchedules, isScheduleMissed } from "./scheduleStatus";
import { SCHEDULE_CHANGE_EVENT } from "./scheduleSummary";
import { getCurrentUser, updateUserSchedule } from "./supabase";

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

const normalizeDateKey = (value) => {
  const cleaned = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);

  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const yearPart = slashMatch[3];
    const year = yearPart
      ? Number(yearPart.length === 2 ? `20${yearPart}` : yearPart)
      : new Date().getFullYear();

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${padNumber(month)}-${padNumber(day)}`;
    }
  }

  const monthDayMatch = cleaned.match(
    /^([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/
  );

  if (monthDayMatch) {
    const month = monthNameToNumber[monthDayMatch[1].toLowerCase()];
    const day = Number(monthDayMatch[2]);
    const year = monthDayMatch[3]
      ? Number(monthDayMatch[3])
      : new Date().getFullYear();

    if (month && day >= 1 && day <= 31) {
      return `${year}-${padNumber(month)}-${padNumber(day)}`;
    }
  }

  return "";
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

const buildSubtaskObjects = (subtasks, scheduleIndex = 0) => {
  return (Array.isArray(subtasks) ? subtasks : [])
    .map((subtask, subtaskIndex) => {
      const text =
        typeof subtask === "string"
          ? subtask
          : String(subtask?.text || subtask?.title || "").trim();

      if (!text) {
        return null;
      }

      return {
        id: `${Date.now()}-${scheduleIndex}-${subtaskIndex}`,
        text,
        completed: false,
        proofUri: "",
      };
    })
    .filter(Boolean);
};

export const isScheduleModificationRequest = (text) => {
  const normalized = String(text || "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  // Relative reminders on existing tasks: "add reminder for Capstone 1hr before"
  if (
    /\b(add|set|create)\s+(?:a\s+)?reminder\b/.test(normalized) ||
    /\bremind\s+me\b/.test(normalized) ||
    (/\breminder\b/.test(normalized) &&
      /\b(before|for|on)\b/.test(normalized))
  ) {
    return true;
  }

  const hasAction =
    /\b(change|update|move|reschedule|edit|modify|shift|rename|set|remind|reminder)\b/.test(
      normalized
    );

  const hasTarget =
    /\b(date|time|schedule|task|title|reminder|subtask|due|before|notify|alert|deadline)\b/.test(
      normalized
    ) || /\bto\b/.test(normalized);

  return hasAction && hasTarget;
};

const getIncompleteSchedules = (schedules) => {
  return (Array.isArray(schedules) ? schedules : []).filter(
    (item) => !Boolean(item?.completed)
  );
};

const getEditableSchedules = (schedules) => {
  return filterCalendarSchedules(schedules);
};

const applyScheduleMatchFilters = (schedules, matchTitle, matchDate) => {
  const titleNeedle = String(matchTitle || "").trim().toLowerCase();
  const dateKey = normalizeDateKey(matchDate);

  let matches = schedules;

  if (titleNeedle) {
    matches = matches.filter((schedule) =>
      String(schedule.title || "")
        .toLowerCase()
        .includes(titleNeedle)
    );
  }

  if (dateKey) {
    const dateMatches = matches.filter((schedule) => schedule.date === dateKey);

    if (dateMatches.length > 0) {
      matches = dateMatches;
    }
  }

  return matches;
};

const findMatchingSchedules = (
  schedules,
  matchTitle,
  matchDate,
  { pendingOnly = true } = {}
) => {
  const pool = pendingOnly
    ? getEditableSchedules(schedules)
    : getIncompleteSchedules(schedules);

  return applyScheduleMatchFilters(pool, matchTitle, matchDate);
};

const buildScheduleListForAI = (schedules) => {
  return getEditableSchedules(schedules).map((schedule) => ({
    id: schedule.id,
    title: schedule.title,
    date: schedule.date,
    timeOnly: schedule.timeOnly,
    reminderEnabled: Boolean(schedule.reminderEnabled),
    reminderTime: schedule.reminderTime || "",
    subtasks: (schedule.subtasks || []).map((item) => item.text),
  }));
};

const parseModificationResponse = (rawText) => {
  const cleaned = String(rawText || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!objectMatch) {
      return null;
    }

    return JSON.parse(objectMatch[0]);
  }
};

const requestScheduleModification = async (message, schedules) => {
  const scheduleList = buildScheduleListForAI(schedules);

  const responseText = await callGroqChat({
    messages: [
      {
        role: "system",
        content:
          "You are SchedWise Schedule Editor. Read the user's edit request and return ONLY valid JSON. " +
          'Shape: {"action":"update|none","matchTitle":"","matchDate":"YYYY-MM-DD or empty","updates":{"date":"","timeOnly":"","title":"","subtasks":[],"reminderEnabled":true,"reminderTime":""},"reply":""}. ' +
          "Only include fields inside updates that should change. " +
          'Use date format YYYY-MM-DD and time format like "1:15 PM". ' +
          'For reminders use formats like "10 minutes before", "15 minutes before", "45 minutes before", "2 hours before", "1 day before", or "same with due date". Use the exact number of minutes, hours, or days from the user request. ' +
          "If the user gives an unclear reminder like \"1 before\" without a unit, return action none and ask them to choose a specific reminder time in reply. Never guess minutes, hours, or days. " +
          "matchTitle should identify the task to edit. matchDate helps when multiple tasks share a title. " +
          "For title changes, put the new title in updates.title and the current task name in matchTitle. " +
          "If the request is unclear or no matching task exists, return action none and explain in reply.",
      },
      {
        role: "user",
        content:
          `Current schedules:\n${JSON.stringify(scheduleList)}\n\n` +
          `User request: "${message}"`,
      },
    ],
    temperature: 0.2,
    maxTokens: 1024,
  });

  return parseModificationResponse(responseText);
};

const buildPastTasksOnlyReply = (matchTitle) => {
  const label = String(matchTitle || "").trim();

  if (label) {
    return `Matching "${label}" tasks have already passed. Check Profile → Missed, or mention a specific upcoming date and time.`;
  }

  return "Those tasks have already passed. Check Profile → Missed, or ask about an upcoming task instead.";
};

const normalizeUpdates = (updates = {}, existingSchedule = {}, scheduleIndex = 0) => {
  const nextUpdates = {};

  if (updates.title !== undefined && String(updates.title || "").trim()) {
    nextUpdates.title = String(updates.title).trim();
  }

  if (updates.date !== undefined) {
    const date = normalizeDateKey(updates.date);

    if (date) {
      nextUpdates.date = date;
    }
  }

  if (updates.timeOnly !== undefined) {
    const timeOnly = normalizeTimeOnly(updates.timeOnly);

    if (timeOnly) {
      nextUpdates.timeOnly = timeOnly;
    }
  }

  if (Array.isArray(updates.subtasks) && updates.subtasks.length > 0) {
    nextUpdates.subtasks = buildSubtaskObjects(updates.subtasks, scheduleIndex);
  } else if (updates.appendSubtasks && Array.isArray(updates.appendSubtasks)) {
    const appended = buildSubtaskObjects(updates.appendSubtasks, scheduleIndex);
    nextUpdates.subtasks = [...(existingSchedule.subtasks || []), ...appended];
  }

  if (updates.reminderEnabled !== undefined) {
    nextUpdates.reminderEnabled = Boolean(updates.reminderEnabled);
  }

  if (updates.reminderTime !== undefined) {
    const reminderTime = normalizeReminderTimeText(updates.reminderTime);

    if (reminderTime) {
      nextUpdates.reminderEnabled = true;
      nextUpdates.reminderTime = reminderTime;
    }
  }

  return nextUpdates;
};

const persistScheduleUpdate = async (schedule, updates) => {
  const localUpdates = {
    ...updates,
    pendingSync: true,
    syncAction: String(schedule?.id || "").startsWith("local-")
      ? "insert"
      : "update",
    syncError: "",
  };

  const updatedLocalSchedule = await updateLocalSchedule(
    schedule.id,
    localUpdates
  );
  let finalSchedule = updatedLocalSchedule || { ...schedule, ...updates };

  try {
    const user = await getCurrentUser();

    if (user) {
      const { data: remoteSchedule, error } = await updateUserSchedule(
        schedule.id,
        updates
      );

      if (!error && remoteSchedule) {
        const syncedSchedule = await markLocalScheduleSynced(
          schedule.id,
          remoteSchedule
        );

        finalSchedule = syncedSchedule || remoteSchedule;
      }
    }
  } catch {
    // Keep local update if remote sync fails.
  }

  await syncReminderForSchedule(finalSchedule);
  finalSchedule = await syncSchedulePhoneCalendar(finalSchedule);

  DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);

  return finalSchedule;
};

const applyScheduleUpdateWithConflictCheck = async (
  schedule,
  updates,
  schedules,
  { skipConflictCheck = false } = {}
) => {
  const needsConflictCheck =
    !skipConflictCheck &&
    (updates.date !== undefined || updates.timeOnly !== undefined);

  if (needsConflictCheck) {
    try {
      const proposedSchedule = {
        ...schedule,
        ...updates,
      };

      const conflictResult = await runChatScheduleConflictCheck(
        proposedSchedule,
        schedules
      );

      if (conflictResult.hasConflicts) {
        return {
          blocked: true,
          conflictResult,
          proposedSchedule,
          reply: formatChatConflictReply(conflictResult, proposedSchedule),
        };
      }
    } catch (error) {
      return {
        blocked: true,
        conflictResult: { hasConflicts: true, conflicts: [], suggestions: [] },
        proposedSchedule: { ...schedule, ...updates },
        reply:
          error?.message ||
          'I could not finish the AI conflict check. Reply "save anyway" to apply the change, or send a different date/time.',
      };
    }
  }

  const updatedSchedule = await persistScheduleUpdate(schedule, updates);

  return {
    blocked: false,
    schedule: updatedSchedule,
  };
};

const buildConflictPendingSelection = (schedule, updates, conflictResult) => ({
  matchIds: [schedule.id],
  updates,
  awaitingConflictConfirm: true,
  conflictSuggestions: conflictResult?.suggestions || [],
});

const buildSuccessReply = (schedule, changeNote = "") => {
  if (changeNote) {
    return changeNote;
  }

  const readableDate = getReadableDate(schedule.date);
  const lines = [
    `Updated ${schedule.title || "the task"} to ${readableDate} at ${
      schedule.timeOnly || "No time set"
    }.`,
  ];

  if (Array.isArray(schedule.subtasks) && schedule.subtasks.length > 0) {
    lines.push(
      "",
      `Subtasks: ${schedule.subtasks.map((item) => item.text).join(", ")}`
    );
  }

  if (schedule.reminderEnabled && schedule.reminderTime) {
    lines.push("", `Reminder: ${schedule.reminderTime}`);
  }

  return lines.join("\n");
};

const tryQuickTitleUpdate = (message, schedules) => {
  const titleRequest = parseTitleChangeRequest(message, schedules);

  if (titleRequest.status === "clear") {
    return {
      schedule: schedules[titleRequest.scheduleIndex],
      newTitle: titleRequest.newTitle,
      previousTitle: titleRequest.previousTitle,
    };
  }

  if (titleRequest.status === "ambiguous") {
    return {
      ambiguous: true,
      titleRequest,
      reply: buildTitleAmbiguityMessage(titleRequest.matches || schedules),
    };
  }

  if (titleRequest.status === "not_found") {
    return {
      notFound: true,
      reply: `I couldn't find a task matching "${titleRequest.matchTitle}". Please check the name and try again.`,
    };
  }

  return null;
};

const tryQuickReminderUpdate = (message, schedules) => {
  const reminderRequest = parseReminderRequest(message);

  if (reminderRequest.status !== "clear") {
    return null;
  }

  let matches = getEditableSchedules(schedules);
  const taskTitle = extractReminderTaskTitle(message);

  if (taskTitle) {
    matches = findMatchingSchedules(matches, taskTitle, "");
  }

  if (matches.length === 1) {
    return {
      schedule: matches[0],
      reminderTime: reminderRequest.reminderTime,
      status: "clear",
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      matches,
      reminderTime: reminderRequest.reminderTime,
      taskTitle,
    };
  }

  if (taskTitle) {
    return {
      status: "not_found",
      taskTitle,
      reminderTime: reminderRequest.reminderTime,
    };
  }

  return null;
};

const buildUpdateSuccessReply = (schedule, updates = {}) => {
  if (updates.title !== undefined) {
    return `Renamed the task to "${schedule.title}".`;
  }

  if (updates.reminderTime !== undefined) {
    return `Set reminder for ${schedule.title} to ${schedule.reminderTime}. You'll be notified before the task is due.`;
  }

  return buildSuccessReply(schedule);
};

const buildScheduleSelectionPrompt = (matches) => {
  const options = matches
    .map(
      (schedule, index) =>
        `${index + 1}. ${getReadableDate(schedule.date)} at ${
          schedule.timeOnly
        } - ${schedule.title}`
    )
    .join("\n");

  return `I found multiple matching schedules:\n\n${options}\n\nReply with the number of the task you want to update (for example, 1 or 2).`;
};

export const tryResolvePendingScheduleSelection = async (
  message,
  schedules,
  pendingSelection
) => {
  if (!pendingSelection?.matchIds?.length || !pendingSelection?.updates) {
    return { handled: false };
  }

  const trimmed = String(message || "").trim();

  if (pendingSelection.awaitingConflictConfirm) {
    const targetSchedule = schedules.find(
      (schedule) => schedule.id === pendingSelection.matchIds[0]
    );

    if (!targetSchedule) {
      return {
        handled: true,
        updated: false,
        pendingSelection: null,
        reply:
          "I couldn't find that schedule anymore. Please send your change request again.",
      };
    }

    if (isSaveAnywayMessage(trimmed)) {
      const updatedSchedule = await persistScheduleUpdate(
        targetSchedule,
        pendingSelection.updates
      );

      return {
        handled: true,
        updated: true,
        pendingSelection: null,
        schedule: updatedSchedule,
        reply: buildUpdateSuccessReply(
          updatedSchedule,
          pendingSelection.updates
        ),
      };
    }

    const suggestion = parseConflictSuggestionChoice(
      trimmed,
      pendingSelection.conflictSuggestions
    );

    if (suggestion) {
      const updates = {
        ...pendingSelection.updates,
        date: suggestion.date,
        timeOnly: suggestion.timeOnly,
      };

      const updatedSchedule = await persistScheduleUpdate(
        targetSchedule,
        updates
      );

      return {
        handled: true,
        updated: true,
        pendingSelection: null,
        schedule: updatedSchedule,
        reply: buildUpdateSuccessReply(updatedSchedule, updates),
      };
    }

    const adjustment = parseConflictDateTimeAdjustment(trimmed);

    if (adjustment.date || adjustment.timeOnly) {
      const updates = {
        ...pendingSelection.updates,
      };

      if (adjustment.date) {
        updates.date = adjustment.date;
      }

      if (adjustment.timeOnly) {
        updates.timeOnly = adjustment.timeOnly;
      }

      const applyResult = await applyScheduleUpdateWithConflictCheck(
        targetSchedule,
        updates,
        schedules
      );

      if (applyResult.blocked) {
        return {
          handled: true,
          updated: false,
          pendingSelection: buildConflictPendingSelection(
            targetSchedule,
            updates,
            applyResult.conflictResult
          ),
          reply: applyResult.reply,
        };
      }

      return {
        handled: true,
        updated: true,
        pendingSelection: null,
        schedule: applyResult.schedule,
        reply: buildUpdateSuccessReply(applyResult.schedule, updates),
      };
    }

    return {
      handled: true,
      updated: false,
      pendingSelection,
      reply: CONFLICT_ADJUST_HELP,
    };
  }

  const numberMatch = trimmed.match(/^(\d+)$/);

  if (!numberMatch) {
    return { handled: false };
  }

  const index = Number(numberMatch[1]) - 1;
  const { matchIds, updates } = pendingSelection;

  if (index < 0 || index >= matchIds.length) {
    return {
      handled: true,
      updated: false,
      pendingSelection,
      reply: `Please reply with a number between 1 and ${matchIds.length}.`,
    };
  }

  const targetSchedule = schedules.find(
    (schedule) => schedule.id === matchIds[index]
  );

  if (!targetSchedule) {
    return {
      handled: true,
      updated: false,
      pendingSelection: null,
      reply:
        "I couldn't find that schedule anymore. Please send your change request again.",
    };
  }

  const applyResult = await applyScheduleUpdateWithConflictCheck(
    targetSchedule,
    updates,
    schedules
  );

  if (applyResult.blocked) {
    return {
      handled: true,
      updated: false,
      pendingSelection: buildConflictPendingSelection(
        targetSchedule,
        updates,
        applyResult.conflictResult
      ),
      reply: applyResult.reply,
    };
  }

  return {
    handled: true,
    updated: true,
    pendingSelection: null,
    schedule: applyResult.schedule,
    reply: buildUpdateSuccessReply(applyResult.schedule, updates),
  };
};

export const handleScheduleChatAction = async (message, schedules) => {
  if (!isScheduleModificationRequest(message)) {
    return { handled: false };
  }

  const editableSchedules = getEditableSchedules(schedules);

  if (editableSchedules.length === 0) {
    return {
      handled: true,
      updated: false,
      reply:
        "You do not have any upcoming schedules in SchedWise to update. Past tasks are in Profile → Missed.",
    };
  }

  const quickTitle = tryQuickTitleUpdate(message, editableSchedules);

  if (quickTitle?.ambiguous) {
    const titleRequest = quickTitle.titleRequest;

    if (
      titleRequest?.newTitle &&
      Array.isArray(titleRequest.matches) &&
      titleRequest.matches.length > 1
    ) {
      return {
        handled: true,
        updated: false,
        pendingSelection: {
          matchIds: titleRequest.matches.map((schedule) => schedule.id),
          updates: { title: titleRequest.newTitle },
        },
        reply: `${quickTitle.reply}\n\nReply with the number of the task you want to rename.`,
      };
    }

    return {
      handled: true,
      updated: false,
      reply: quickTitle.reply,
    };
  }

  if (quickTitle?.notFound) {
    return {
      handled: true,
      updated: false,
      reply: quickTitle.reply,
    };
  }

  if (quickTitle) {
    const updatedSchedule = await persistScheduleUpdate(quickTitle.schedule, {
      title: quickTitle.newTitle,
    });

    return {
      handled: true,
      updated: true,
      schedule: updatedSchedule,
      reply: `Renamed "${quickTitle.previousTitle || "the task"}" to "${updatedSchedule.title}".`,
    };
  }

  const reminderRequest = parseReminderRequest(message);

  if (reminderRequest.status === "ambiguous") {
    return {
      handled: true,
      updated: false,
      reply: buildReminderClarificationMessage(),
    };
  }

  const quickReminder = tryQuickReminderUpdate(message, editableSchedules);

  if (quickReminder?.status === "clear" && quickReminder.schedule) {
    const updatedSchedule = await persistScheduleUpdate(quickReminder.schedule, {
      reminderEnabled: true,
      reminderTime: quickReminder.reminderTime,
    });

    return {
      handled: true,
      updated: true,
      schedule: updatedSchedule,
      reply: `Set reminder for ${updatedSchedule.title} to ${updatedSchedule.reminderTime}. You'll be notified before the task is due.`,
    };
  }

  if (quickReminder?.status === "ambiguous") {
    return {
      handled: true,
      updated: false,
      pendingSelection: {
        matchIds: quickReminder.matches.map((schedule) => schedule.id),
        updates: {
          reminderEnabled: true,
          reminderTime: quickReminder.reminderTime,
        },
      },
      reply: buildScheduleSelectionPrompt(quickReminder.matches),
    };
  }

  if (quickReminder?.status === "not_found") {
    return {
      handled: true,
      updated: false,
      reply: `I couldn't find a task matching "${quickReminder.taskTitle}". Please check the name and try again.`,
    };
  }

  let parsed;

  try {
    parsed = await requestScheduleModification(message, editableSchedules);
  } catch (error) {
    return {
      handled: true,
      updated: false,
      reply:
        error?.message ||
        "Sorry, I could not update your schedule right now. Please try again.",
    };
  }

  if (!parsed || parsed.action === "none") {
    return {
      handled: true,
      updated: false,
      reply:
        String(parsed?.reply || "").trim() ||
        "I couldn't tell which schedule to update. Try mentioning the task name and the new date or time.",
    };
  }

  const matches = findMatchingSchedules(
    schedules,
    parsed.matchTitle,
    parsed.matchDate
  );

  const updates = normalizeUpdates(
    parsed.updates,
    matches[0] || {},
    0
  );

  if (reminderRequest.status === "clear") {
    updates.reminderEnabled = true;
    updates.reminderTime = reminderRequest.reminderTime;
  }

  if (matches.length === 0) {
    const pastMatches = findMatchingSchedules(
      schedules,
      parsed.matchTitle,
      parsed.matchDate,
      { pendingOnly: false }
    ).filter((schedule) => isScheduleMissed(schedule));

    if (pastMatches.length > 0) {
      return {
        handled: true,
        updated: false,
        reply: buildPastTasksOnlyReply(parsed.matchTitle),
      };
    }

    return {
      handled: true,
      updated: false,
      reply:
        String(parsed?.reply || "").trim() ||
        "I couldn't find a matching schedule to update in SchedWise.",
    };
  }

  if (matches.length > 1) {
    if (Object.keys(updates).length === 0) {
      return {
        handled: true,
        updated: false,
        reply:
          String(parsed?.reply || "").trim() ||
          "I understood the request, but I couldn't figure out what to change.",
      };
    }

    return {
      handled: true,
      updated: false,
      pendingSelection: {
        matchIds: matches.map((schedule) => schedule.id),
        updates,
      },
      reply: buildScheduleSelectionPrompt(matches),
    };
  }

  const targetSchedule = matches[0];

  if (Object.keys(updates).length === 0) {
    return {
      handled: true,
      updated: false,
      reply:
        String(parsed?.reply || "").trim() ||
        "I understood the request, but I couldn't figure out what to change.",
    };
  }

  const applyResult = await applyScheduleUpdateWithConflictCheck(
    targetSchedule,
    updates,
    schedules
  );

  if (applyResult.blocked) {
    return {
      handled: true,
      updated: false,
      pendingSelection: buildConflictPendingSelection(
        targetSchedule,
        updates,
        applyResult.conflictResult
      ),
      reply: applyResult.reply,
    };
  }

  return {
    handled: true,
    updated: true,
    schedule: applyResult.schedule,
    reply:
      String(parsed?.reply || "").trim() ||
      buildUpdateSuccessReply(applyResult.schedule, updates),
  };
};
