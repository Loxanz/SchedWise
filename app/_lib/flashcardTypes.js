export const FLASHCARD_TYPES = {
  STANDARD: "standard",
  MULTIPLE_CHOICE: "multiple_choice",
  SHORT_ANSWER: "short_answer",
};

export const normalizeCardType = (value) => {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (
    ["multiple_choice", "multiplechoice", "mcq", "choice", "choices"].includes(
      normalized
    )
  ) {
    return FLASHCARD_TYPES.MULTIPLE_CHOICE;
  }

  if (
    ["short_answer", "shortanswer", "input", "type_answer", "fill_in"].includes(
      normalized
    )
  ) {
    return FLASHCARD_TYPES.SHORT_ANSWER;
  }

  return FLASHCARD_TYPES.STANDARD;
};

export const countWords = (text) => {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
};

export const isValidShortAnswer = (answer) => {
  const words = countWords(answer);
  return words >= 1 && words <= 3;
};

export const normalizeShortAnswer = (answer) => {
  return String(answer || "")
    .trim()
    .replace(/\s+/g, " ");
};

export const answersMatch = (userAnswer, correctAnswer) => {
  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ");

  return normalize(userAnswer) === normalize(correctAnswer);
};

export const normalizeMultipleChoiceOptions = (options, answer) => {
  const cleanedOptions = (Array.isArray(options) ? options : [])
    .map((option) => String(option || "").trim())
    .filter(Boolean);

  const uniqueOptions = [...new Set(cleanedOptions)];
  const correctAnswer = String(answer || "").trim();

  if (!correctAnswer) {
    return [];
  }

  if (!uniqueOptions.includes(correctAnswer)) {
    uniqueOptions.unshift(correctAnswer);
  }

  return uniqueOptions.slice(0, 4);
};

export const getCardTypeLabel = (type) => {
  const normalized = normalizeCardType(type);

  if (normalized === FLASHCARD_TYPES.MULTIPLE_CHOICE) {
    return "Multiple Choice";
  }

  if (normalized === FLASHCARD_TYPES.SHORT_ANSWER) {
    return "Short Answer";
  }

  return "Flashcard";
};
