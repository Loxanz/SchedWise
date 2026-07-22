import { DeviceEventEmitter } from "react-native";
import { extractTextFromUploadedFile } from "./fileTextExtractor";
import { callGroqChat } from "./groq";
import {
  addLocalSchedule,
  getLocalSchedules,
  markLocalScheduleSynced,
} from "./localSchedules";
import { syncSchedulePhoneCalendar } from "./phoneCalendarSync";
import {
  formatChatConflictReply,
  runChatScheduleConflictCheck,
} from "./scheduleChatConflicts";
import {
  buildReminderClarificationMessage,
  normalizeReminderTimeText,
  parseReminderRequest,
} from "./scheduleReminderUtils";
import {
  applyTitleToSchedules,
  buildTitleAmbiguityMessage,
  parseTitleChangeRequest,
} from "./scheduleEditUtils";
import { syncReminderForSchedule } from "./scheduleReminders";
import { SCHEDULE_CHANGE_EVENT } from "./scheduleSummary";
import { addUserSchedule, getCurrentUser } from "./supabase";

const SCHEDULE_IMPORT_MAX_CHARS = 12000;

const SCHEDULE_IMPORT_SYSTEM_PROMPT =
  "You are SchedWise Schedule Importer. Extract academic schedule items only from the uploaded file text. " +
  "Return ONLY a valid JSON array. Do not use markdown or code fences. " +
  'Each item must include: "date" (YYYY-MM-DD), "timeOnly" (example: "2:00 PM"), "title". ' +
  'Optional fields: "subtasks" (array of strings), "reminderEnabled" (boolean), "reminderTime" (string). ' +
  "Use only dates and tasks supported by the file. Do not invent items. " +
  "If no schedules are found, return [].";

const padNumber = (value) => String(value).padStart(2, "0");

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

export const normalizeImportedSchedule = (item, index) => {
  const date = normalizeDateKey(item?.date);
  const title = String(item?.title || item?.task || "").trim();
  const timeOnly = normalizeTimeOnly(item?.timeOnly || item?.time || item?.time_only);

  if (!date || !title || !timeOnly) {
    return null;
  }

  return {
    date,
    timeOnly,
    title,
    icon: "calendar",
    completed: false,
    proofUri: "",
    reminderEnabled: Boolean(item?.reminderEnabled ?? item?.reminder_enabled),
    reminderTime: String(item?.reminderTime || item?.reminder_time || "").trim(),
    subtasks: buildSubtaskObjects(item?.subtasks, index),
  };
};

const parseSchedulesResponse = (rawText) => {
  const cleaned = String(rawText || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);

    if (!arrayMatch) {
      throw new Error("The AI could not read a schedule list from this file.");
    }

    parsed = JSON.parse(arrayMatch[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("The AI response was not a schedule list.");
  }

  const schedules = parsed
    .map((item, index) => normalizeImportedSchedule(item, index))
    .filter(Boolean);

  if (schedules.length === 0) {
    throw new Error(
      "No schedules could be found in this file. Try a clearer file with dates, times, and task titles."
    );
  }

  return schedules;
};

const requestSchedulesFromText = async (fileName, text, userNote = "") => {
  const trimmedText = String(text || "").slice(0, SCHEDULE_IMPORT_MAX_CHARS);
  const trimmedNote = String(userNote || "").trim();

  const userContent = trimmedNote
    ? `User message: "${trimmedNote}"\n\nExtract schedules from this uploaded file: "${fileName}".\n\n${trimmedText}\n\nReturn only schedules that are clearly supported by the file.`
    : `Extract schedules from this uploaded file: "${fileName}".\n\n${trimmedText}\n\nReturn only schedules that are clearly supported by the file.`;

  return callGroqChat({
    messages: [
      { role: "system", content: SCHEDULE_IMPORT_SYSTEM_PROMPT },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: 0.2,
    maxTokens: 2048,
  });
};

const formatSchedulePreviewLine = (schedule, index) => {
  const readableDate = getReadableDate(schedule.date);
  const lines = [`${index + 1}. ${readableDate} at ${schedule.timeOnly} - ${schedule.title}`];

  if (Array.isArray(schedule.subtasks) && schedule.subtasks.length > 0) {
    lines.push(
      `   Subtasks: ${schedule.subtasks.map((item) => item.text).join(", ")}`
    );
  }

  if (schedule.reminderEnabled && schedule.reminderTime) {
    lines.push(`   Reminder: ${schedule.reminderTime}`);
  }

  return lines.join("\n");
};

export const buildImportPreviewSummary = (fileName, schedules) => {
  const lines = schedules.map((schedule, index) =>
    formatSchedulePreviewLine(schedule, index)
  );

  return [
    `I found ${schedules.length} schedule${schedules.length === 1 ? "" : "s"} from "${fileName}":`,
    "",
    ...lines,
    "",
    "I have not added these to SchedWise yet.",
    "You can edit this suggestion first, for example:",
    '- "change the title of Capstone to Final Project"',
    '- "change the date to July 5 and remind me a day before"',
    '- "add subtasks Chapter 1, Chapter 2, and Chapter 3"',
    "",
    "Reply Yes to add them to SchedWise, or No to cancel.",
  ].join("\n");
};

export const buildUpdatedImportPreviewSummary = (fileName, schedules, changeNote) => {
  const lines = schedules.map((schedule, index) =>
    formatSchedulePreviewLine(schedule, index)
  );

  return [
    changeNote,
    "",
    `Updated suggestion from "${fileName}":`,
    "",
    ...lines,
    "",
    "Reply Yes to add them to SchedWise, or No to cancel.",
  ].join("\n");
};

export const isImportConfirmationYes = (text) => {
  const normalized = String(text || "").trim().toLowerCase();

  return [
    "yes",
    "y",
    "yeah",
    "yep",
    "correct",
    "looks good",
    "keep",
    "confirm",
    "right",
    "that's right",
    "thats right",
    "add it",
    "add them",
    "go ahead",
  ].includes(normalized);
};

export const isImportConfirmationNo = (text) => {
  const normalized = String(text || "").trim().toLowerCase();

  return [
    "no",
    "n",
    "nope",
    "wrong",
    "remove",
    "delete",
    "cancel",
    "not right",
    "incorrect",
    "don't add",
    "dont add",
  ].includes(normalized);
};

const splitSubtaskText = (rawText) => {
  return String(rawText || "")
    .split(/,|\band\b/gi)
    .map((item) => item.trim())
    .filter(Boolean);
};

const applySubtasksToSchedules = (schedules, subtaskTexts, scheduleIndex = null) => {
  const nextSubtasks = buildSubtaskObjects(subtaskTexts);

  if (nextSubtasks.length === 0) {
    return schedules;
  }

  return schedules.map((schedule, index) => {
    if (scheduleIndex !== null && index !== scheduleIndex) {
      return schedule;
    }

    return {
      ...schedule,
      subtasks: nextSubtasks.map((subtask, subtaskIndex) => ({
        ...subtask,
        id: `${Date.now()}-${index}-${subtaskIndex}`,
      })),
    };
  });
};

const applyReminderToSchedules = (schedules, reminderTime, scheduleIndex = null) => {
  const normalizedReminder = normalizeReminderTimeText(reminderTime);

  if (!normalizedReminder) {
    return schedules;
  }

  return schedules.map((schedule, index) => {
    if (scheduleIndex !== null && index !== scheduleIndex) {
      return schedule;
    }

    return {
      ...schedule,
      reminderEnabled: true,
      reminderTime: normalizedReminder,
    };
  });
};

const getFallbackYearFromSchedules = (schedules) => {
  const firstDate = String(schedules?.[0]?.date || "");

  if (/^\d{4}-/.test(firstDate)) {
    return Number(firstDate.slice(0, 4));
  }

  return new Date().getFullYear();
};

const parseDateFromDraftMessage = (text, fallbackYear) => {
  const patterns = [
    /(?:dates?|due\s*dates?|deadlines?)\s+(?:to|on)\s+([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /(?:change|move|reschedule|update|set)\s+(?:the\s+)?(?:dates?|due\s*dates?|deadlines?)\s+to\s+([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /\bto\s+([A-Za-z]+\s+\d{1,2})(?:,?\s*(\d{4}))?(?=\s+(?:and|at|for|both|all|them|these|those)\b|[,.]|$)/i,
    /\bon\s+([A-Za-z]+\s+\d{1,2})(?:,?\s*(\d{4}))?(?=\s+(?:and|at|for|both|all|them|these|those)\b|[,.]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);

    if (!match) {
      continue;
    }

    let dateText = String(match[1] || "").trim();

    if (match[2] && !dateText.includes(match[2])) {
      dateText = `${dateText}, ${match[2]}`;
    }

    if (!/\d{4}/.test(dateText) && fallbackYear) {
      dateText = `${dateText} ${fallbackYear}`;
    }

    const normalized = normalizeDateKey(dateText);

    if (normalized) {
      return normalized;
    }
  }

  return "";
};

const shouldApplyDraftChangeToAll = (text, schedules = []) => {
  const cleaned = String(text || "").trim().toLowerCase();

  if (!cleaned) {
    return false;
  }

  if ((Array.isArray(schedules) ? schedules : []).length <= 1) {
    return true;
  }

  return (
    /\b(both|all|every|each|them|these|those)\b/.test(cleaned) ||
    /\bfor\s+(?:both|all|every|each|them|these|those)\b/.test(cleaned) ||
    /\ball\s+(?:tasks?|schedules?|items?)\b/.test(cleaned) ||
    /\bboth\s+(?:tasks?|schedules?|items?)\b/.test(cleaned)
  );
};

const parseTimeFromDraftMessage = (text) => {
  const cleaned = String(text || "").trim();

  if (!/\b(time|at\s+\d{1,2}:\d{2}|\d{1,2}:\d{2}\s*(?:AM|PM))/i.test(cleaned)) {
    return "";
  }

  const match =
    cleaned.match(/\bat\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i) ||
    cleaned.match(/\bto\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i) ||
    cleaned.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

  return match ? normalizeTimeOnly(match[1]) : "";
};

const applyDateTimeToSchedules = (
  schedules,
  { date, timeOnly },
  scheduleIndex = null
) => {
  return schedules.map((schedule, index) => {
    if (scheduleIndex !== null && index !== scheduleIndex) {
      return schedule;
    }

    const next = { ...schedule };

    if (date) {
      next.date = date;
    }

    if (timeOnly) {
      next.timeOnly = timeOnly;
    }

    return next;
  });
};

const applyDraftUpdatesToSchedules = (schedules, updates, scheduleIndex = null) => {
  let nextSchedules = schedules;

  if (updates.date || updates.timeOnly) {
    nextSchedules = applyDateTimeToSchedules(
      nextSchedules,
      { date: updates.date, timeOnly: updates.timeOnly },
      scheduleIndex
    );
  }

  if (updates.subtasks?.length) {
    nextSchedules = applySubtasksToSchedules(
      nextSchedules,
      updates.subtasks,
      scheduleIndex
    );
  }

  if (updates.reminderTime) {
    nextSchedules = applyReminderToSchedules(
      nextSchedules,
      updates.reminderTime,
      scheduleIndex
    );
  }

  if (updates.title) {
    nextSchedules = applyTitleToSchedules(
      nextSchedules,
      updates.title,
      scheduleIndex
    );
  }

  return nextSchedules;
};

const tryApplyRuleBasedDraftModification = (message, schedules) => {
  const text = String(message || "").trim();
  let targetScheduleIndex = schedules.length === 1 ? 0 : null;
  const fallbackYear = getFallbackYearFromSchedules(schedules);
  let updatedSchedules = schedules;
  const changeNotes = [];
  const applyToAll = shouldApplyDraftChangeToAll(text, schedules);

  if (applyToAll) {
    targetScheduleIndex = null;
  }

  const titleRequest = parseTitleChangeRequest(text, schedules);

  if (titleRequest.status === "clear") {
    targetScheduleIndex = titleRequest.scheduleIndex;
    updatedSchedules = applyTitleToSchedules(
      updatedSchedules,
      titleRequest.newTitle,
      targetScheduleIndex
    );

    changeNotes.push(
      `Renamed "${titleRequest.previousTitle || "the task"}" to "${titleRequest.newTitle}".`
    );
  } else if (titleRequest.status === "ambiguous") {
    return {
      schedules,
      changeNote: buildTitleAmbiguityMessage(titleRequest.matches || schedules),
    };
  } else if (titleRequest.status === "not_found") {
    return {
      schedules,
      changeNote: `I couldn't find a task matching "${titleRequest.matchTitle}". Please check the name and try again.`,
    };
  }

  const subtaskMatch = text.match(
    /add subtasks?(?: for (?:it|this|them|the task|the schedule))?[: ]*(.+)$/i
  );

  if (subtaskMatch) {
    const subtaskTexts = splitSubtaskText(subtaskMatch[1]);
    updatedSchedules = applySubtasksToSchedules(
      updatedSchedules,
      subtaskTexts,
      targetScheduleIndex
    );

    changeNotes.push(
      `Added ${subtaskTexts.length} subtask${
        subtaskTexts.length === 1 ? "" : "s"
      } to the suggested schedule.`
    );
  }

  const hasDateIntent =
    /\b(dates?|due\s*dates?|deadlines?|reschedule|move)\b/i.test(text) ||
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}\b/i.test(
      text
    );

  if (hasDateIntent) {
    const date = parseDateFromDraftMessage(text, fallbackYear);
    const timeOnly = parseTimeFromDraftMessage(text);

    if (date || timeOnly) {
      // "both/all" (or a single draft item) updates every suggested schedule.
      const dateTargetIndex = applyToAll ? null : targetScheduleIndex;

      updatedSchedules = applyDateTimeToSchedules(
        updatedSchedules,
        { date, timeOnly },
        dateTargetIndex
      );

      if (date) {
        changeNotes.push(
          applyToAll || updatedSchedules.length > 1 && dateTargetIndex === null
            ? `Changed the date for all suggested tasks to ${getReadableDate(date)}.`
            : `Changed the date to ${getReadableDate(date)}.`
        );
      }

      if (timeOnly) {
        changeNotes.push(`Changed the time to ${timeOnly}.`);
      }
    }
  }

  if (
    /remind|reminder|alert|notify|minutes before|minute before|hours before|hour before|days before|day before/i.test(
      text
    )
  ) {
    const reminderRequest = parseReminderRequest(text);

    if (reminderRequest.status === "clear") {
      updatedSchedules = applyReminderToSchedules(
        updatedSchedules,
        reminderRequest.reminderTime,
        targetScheduleIndex
      );

      changeNotes.push(
        `Set the reminder to "${reminderRequest.reminderTime}".`
      );
    } else if (reminderRequest.status === "ambiguous") {
      if (changeNotes.length > 0) {
        return {
          schedules: updatedSchedules,
          changeNote: `${changeNotes.join(" ")}\n\n${buildReminderClarificationMessage()}`,
        };
      }

      return {
        schedules,
        changeNote: buildReminderClarificationMessage(),
      };
    }
  }

  if (changeNotes.length === 0) {
    return null;
  }

  return {
    schedules: updatedSchedules,
    changeNote: changeNotes.join(" "),
  };
};

const requestDraftModificationFromAI = async (message, schedules) => {
  const responseText = await callGroqChat({
    messages: [
      {
        role: "system",
        content:
          "You update SchedWise import draft schedules based on the user's edit request. " +
          "Return ONLY valid JSON with this shape: " +
          '{"scheduleIndex":0,"updates":{"date":"","timeOnly":"","title":"","subtasks":[],"reminderTime":""},"changeNote":""}. ' +
          "Include only fields inside updates that should change. The user may request multiple changes at once. " +
          "Use scheduleIndex to target a specific task when multiple draft schedules exist. " +
          'Use date format YYYY-MM-DD and time format like "1:15 PM". ' +
          'For reminders use formats like "10 minutes before", "15 minutes before", "45 minutes before", "2 hours before", "1 day before", or "same with due date". Use the exact number from the user request. ' +
          "If the user gives an unclear reminder like \"1 before\" without a unit, omit reminderTime and ask them to choose a specific reminder time in changeNote. " +
          "Never guess minutes, hours, or days when the unit is missing.",
      },
      {
        role: "user",
        content:
          `Draft schedules:\n${JSON.stringify(schedules)}\n\n` +
          `User request: "${message}"`,
      },
    ],
    temperature: 0.2,
    maxTokens: 1024,
  });

  const cleaned = String(responseText || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!objectMatch) {
      return null;
    }

    parsed = JSON.parse(objectMatch[0]);
  }

  if (!parsed) {
    return null;
  }

  if (parsed.action === "none") {
    return parsed?.changeNote
      ? {
          schedules,
          changeNote: String(parsed.changeNote),
        }
      : null;
  }

  const scheduleIndex =
    typeof parsed.scheduleIndex === "number" ? parsed.scheduleIndex : null;
  const updates = parsed.updates || {};
  const draftUpdates = {};

  if (updates.date) {
    const date = normalizeDateKey(updates.date);

    if (date) {
      draftUpdates.date = date;
    }
  }

  if (updates.timeOnly) {
    const timeOnly = normalizeTimeOnly(updates.timeOnly);

    if (timeOnly) {
      draftUpdates.timeOnly = timeOnly;
    }
  }

  if (updates.title) {
    draftUpdates.title = String(updates.title).trim();
  }

  if (Array.isArray(updates.subtasks) && updates.subtasks.length > 0) {
    draftUpdates.subtasks = updates.subtasks
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  } else if (parsed.action === "add_subtasks") {
    draftUpdates.subtasks = Array.isArray(parsed.subtasks)
      ? parsed.subtasks.map((item) => String(item || "").trim()).filter(Boolean)
      : splitSubtaskText(parsed.subtasks);
  }

  const userReminder = parseReminderRequest(message);
  const aiReminder = normalizeReminderTimeText(
    updates.reminderTime || parsed.reminderTime || ""
  );

  if (userReminder.status === "ambiguous") {
    if (Object.keys(draftUpdates).length > 0) {
      const updatedSchedules = applyDraftUpdatesToSchedules(
        schedules,
        draftUpdates,
        scheduleIndex
      );

      return {
        schedules: updatedSchedules,
        changeNote: `${String(parsed.changeNote || "Updated the suggested schedule.").trim()}\n\n${buildReminderClarificationMessage()}`,
      };
    }

    return {
      schedules,
      changeNote: buildReminderClarificationMessage(),
    };
  }

  if (userReminder.status === "clear") {
    draftUpdates.reminderTime = userReminder.reminderTime;
  } else if (aiReminder) {
    draftUpdates.reminderTime = aiReminder;
  } else if (
    parsed.action === "set_reminder" &&
    normalizeReminderTimeText(parsed.reminderTime || message)
  ) {
    draftUpdates.reminderTime = normalizeReminderTimeText(
      parsed.reminderTime || message
    );
  }

  if (Object.keys(draftUpdates).length === 0) {
    return parsed?.changeNote
      ? {
          schedules,
          changeNote: String(parsed.changeNote),
        }
      : null;
  }

  const updatedSchedules = applyDraftUpdatesToSchedules(
    schedules,
    draftUpdates,
    scheduleIndex
  );

  return {
    schedules: updatedSchedules,
    changeNote:
      String(parsed.changeNote || "").trim() ||
      "Updated the suggested schedule.",
  };
};

export const applyImportDraftModification = async (message, schedules) => {
  const ruleBasedResult = tryApplyRuleBasedDraftModification(message, schedules);

  if (ruleBasedResult) {
    return ruleBasedResult;
  }

  const reminderRequest = parseReminderRequest(message);

  if (reminderRequest.status === "ambiguous") {
    return {
      schedules,
      changeNote: buildReminderClarificationMessage(),
    };
  }

  try {
    const aiResult = await requestDraftModificationFromAI(message, schedules);

    if (aiResult) {
      return aiResult;
    }
  } catch {
    // Fall through to help text.
  }

  return null;
};

const saveImportedSchedule = async (schedulePayload) => {
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

  return finalSchedule;
};

export const previewSchedulesFromFile = async (file, { userNote = "" } = {}) => {
  const { fileName, text } = await extractTextFromUploadedFile(file);
  const trimmedNote = String(userNote || "").trim();
  const responseText = await requestSchedulesFromText(fileName, text, trimmedNote);
  const parsedSchedules = parseSchedulesResponse(responseText);

  return {
    fileName,
    schedules: parsedSchedules,
    confirmationMessage: buildImportPreviewSummary(fileName, parsedSchedules),
  };
};

export const confirmImportDraft = async (draftSchedules) => {
  const schedules = Array.isArray(draftSchedules) ? draftSchedules : [];
  const savedSchedules = [];
  const conflictNotes = [];
  let existingSchedules = [];

  try {
    existingSchedules = await getLocalSchedules();
  } catch {
    existingSchedules = [];
  }

  for (const schedulePayload of schedules) {
    try {
      const conflictResult = await runChatScheduleConflictCheck(
        schedulePayload,
        [...existingSchedules, ...savedSchedules]
      );

      if (conflictResult.hasConflicts) {
        conflictNotes.push(
          formatChatConflictReply(conflictResult, schedulePayload)
        );
        continue;
      }
    } catch (error) {
      conflictNotes.push(
        `Skipped "${schedulePayload?.title || "a schedule"}": ${
          error?.message || "conflict check failed"
        }`
      );
      continue;
    }

    const savedSchedule = await saveImportedSchedule(schedulePayload);
    savedSchedules.push(savedSchedule);
  }

  if (savedSchedules.length > 0) {
    DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);
  }

  return {
    schedules: savedSchedules,
    conflictNotes,
  };
};

export const handleImportDraftMessage = async ({
  message,
  fileName,
  schedules,
}) => {
  const trimmedMessage = String(message || "").trim();

  if (isImportConfirmationYes(trimmedMessage)) {
    const confirmResult = await confirmImportDraft(schedules);
    const savedSchedules = confirmResult.schedules || [];
    const conflictNotes = confirmResult.conflictNotes || [];

    let reply =
      savedSchedules.length === 0
        ? "I did not add any schedules because of conflicts."
        : savedSchedules.length === 1
        ? "Great. I added the schedule to SchedWise."
        : `Great. I added ${savedSchedules.length} schedules to SchedWise.`;

    if (conflictNotes.length > 0) {
      reply += `\n\nSome items were skipped due to conflicts:\n\n${conflictNotes.join(
        "\n\n"
      )}`;
    }

    return {
      status: "confirmed",
      schedules: savedSchedules,
      reply,
    };
  }

  if (isImportConfirmationNo(trimmedMessage)) {
    return {
      status: "cancelled",
      schedules: [],
      reply: "Okay, I did not add the suggested schedule to SchedWise.",
    };
  }

  const modification = await applyImportDraftModification(trimmedMessage, schedules);

  if (modification) {
    return {
      status: "updated",
      schedules: modification.schedules,
      reply: buildUpdatedImportPreviewSummary(
        fileName,
        modification.schedules,
        modification.changeNote
      ),
    };
  }

  return {
    status: "awaiting",
    schedules,
    reply:
      'You can edit the suggestion first, for example "change the date to July 5 and remind me a day before" or "add subtasks Chapter 1, Chapter 2". Reply Yes to add them, or No to cancel.',
  };
};

// Backward-compatible alias used during migration.
export const importSchedulesFromFile = previewSchedulesFromFile;

export const removeImportedSchedules = async () => {
  return;
};
