const monthPattern =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;

const stripQuotes = (value) => {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
};

const looksLikeDateText = (text) => {
  const cleaned = String(text || "").trim();

  if (!cleaned) {
    return false;
  }

  return (
    /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ||
    /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(cleaned) ||
    monthPattern.test(cleaned) ||
    /\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i.test(cleaned)
  );
};

export const findSchedulesByTitleHint = (schedules, hint) => {
  const needle = String(hint || "").trim().toLowerCase();

  if (!needle) {
    return Array.isArray(schedules) ? schedules : [];
  }

  return (Array.isArray(schedules) ? schedules : []).filter((schedule) =>
    String(schedule?.title || "")
      .toLowerCase()
      .includes(needle)
  );
};

export const applyTitleToSchedules = (
  schedules,
  newTitle,
  scheduleIndex = null
) => {
  const title = stripQuotes(newTitle);

  if (!title) {
    return schedules;
  }

  return schedules.map((schedule, index) => {
    if (scheduleIndex !== null && index !== scheduleIndex) {
      return schedule;
    }

    return {
      ...schedule,
      title,
    };
  });
};

export const buildTitleAmbiguityMessage = (matches = []) => {
  if (matches.length > 1) {
    const options = matches
      .map(
        (schedule, index) =>
          `${index + 1}. ${schedule.title || "Untitled"} (${schedule.date || "No date"} at ${
            schedule.timeOnly || "No time"
          })`
      )
      .join("\n");

    return `I found multiple tasks that match:\n\n${options}\n\nPlease mention the exact task name in your message.`;
  }

  return "Which task should I rename? Please mention the task name, for example: \"change the title of Capstone to Final Project\".";
};

export const parseTitleChangeRequest = (text, schedules = []) => {
  const cleaned = String(text || "").trim();
  const scheduleList = Array.isArray(schedules) ? schedules : [];

  if (!cleaned || !/\b(rename|change|update|edit|modify)\b/i.test(cleaned)) {
    return { status: "none" };
  }

  const hasTitleKeyword = /\b(title|name)\b/i.test(cleaned);
  const hasRename = /\brename\b/i.test(cleaned);

  if (!hasTitleKeyword && !hasRename) {
    return { status: "none" };
  }

  if (
    /\b(date|due\s*date|deadline|reschedule)\b/i.test(cleaned) &&
    !hasTitleKeyword
  ) {
    return { status: "none" };
  }

  let matchTitle = "";
  let newTitle = "";

  const specificMatch = cleaned.match(
    /(?:change|update|edit|modify|rename)\s+(?:the\s+)?(?:task\s+)?title\s+of\s+(?:the\s+)?(.+?)\s+to\s+(.+)$/i
  );

  if (specificMatch) {
    matchTitle = specificMatch[1].trim();
    newTitle = specificMatch[2].trim();
  } else {
    const simpleMatch = cleaned.match(
      /(?:change|update|edit|modify|rename)\s+(?:the\s+)?(?:task\s+)?title\s+to\s+(.+)$/i
    );

    if (simpleMatch) {
      newTitle = simpleMatch[1].trim();
    } else {
      const taskNameMatch = cleaned.match(
        /(?:change|update|edit|modify|rename)\s+(?:the\s+)?task\s+(?:name|title)\s+to\s+(.+)$/i
      );

      if (taskNameMatch) {
        newTitle = taskNameMatch[1].trim();
      } else if (hasRename) {
        const renameMatch = cleaned.match(
          /rename\s+(?:the\s+)?(?:task\s+)?(.+?)\s+to\s+(.+)$/i
        );

        if (renameMatch) {
          matchTitle = renameMatch[1].trim();
          newTitle = renameMatch[2].trim();

          if (looksLikeDateText(newTitle)) {
            return { status: "none" };
          }
        }
      }
    }
  }

  newTitle = stripQuotes(newTitle);

  if (!newTitle) {
    return { status: "none" };
  }

  matchTitle = stripQuotes(matchTitle);

  if (matchTitle) {
    const matches = findSchedulesByTitleHint(scheduleList, matchTitle);

    if (matches.length === 1) {
      return {
        status: "clear",
        matchTitle,
        newTitle,
        scheduleIndex: scheduleList.findIndex((schedule) => schedule === matches[0]),
        previousTitle: matches[0].title || "",
      };
    }

    if (matches.length === 0) {
      return {
        status: "not_found",
        matchTitle,
        newTitle,
      };
    }

    return {
      status: "ambiguous",
      matchTitle,
      newTitle,
      matches,
    };
  }

  if (scheduleList.length === 1) {
    return {
      status: "clear",
      matchTitle: "",
      newTitle,
      scheduleIndex: 0,
      previousTitle: scheduleList[0]?.title || "",
    };
  }

  if (scheduleList.length > 1) {
    return {
      status: "ambiguous",
      newTitle,
      reason: "no_task_specified",
      matches: scheduleList,
    };
  }

  return { status: "none" };
};
