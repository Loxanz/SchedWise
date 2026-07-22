import { callGroqChat } from "./groq";
import {
  normalizeDifficulty,
  sortFlashcardsByDifficulty,
} from "./flashcardDifficulty";
import {
  FLASHCARD_TYPES,
  isValidShortAnswer,
  normalizeCardType,
  normalizeMultipleChoiceOptions,
  normalizeShortAnswer,
} from "./flashcardTypes";
import { extractTextFromUploadedFile } from "./fileTextExtractor";

export const FLASHCARD_GROQ_MODEL =
  process.env.EXPO_PUBLIC_GROQ_FLASHCARD_MODEL || "llama-3.3-70b-versatile";

const ESTIMATE_CHARS_PER_TOKEN = 4;
const FLASHCARD_CHUNK_OVERLAP = 300;
const FLASHCARD_MAX_OUTPUT_TOKENS = 1800;
const FLASHCARD_MAX_REQUEST_TOKENS = 8000;

const estimateTokens = (text) => {
  return Math.ceil(String(text || "").length / ESTIMATE_CHARS_PER_TOKEN);
};

const FLASHCARD_EXAMPLES = JSON.stringify(
  [
    {
      type: "standard",
      subject: "IT Roles",
      question:
        "It manages the firewalls, apply patches and vulnerability assessments",
      answer: "Security Admin",
      difficulty: "mid",
    },
    {
      type: "multiple_choice",
      subject: "Networking",
      question: "Which protocol is used to securely browse websites?",
      options: ["HTTP", "HTTPS", "FTP", "SMTP"],
      answer: "HTTPS",
      difficulty: "easy",
    },
    {
      type: "short_answer",
      subject: "Security",
      question: "What acronym stands for Virtual Private Network?",
      answer: "VPN",
      difficulty: "easy",
    },
  ],
  null,
  2
);

const FLASHCARD_SYSTEM_PROMPT =
  "You are SchedWise Flashcard Generator. Create study flashcards only from the student's uploaded material. " +
  "Return ONLY a valid JSON array. Do not use markdown or code fences. " +
  'Each item must include: "type", "subject", "question", "answer", "difficulty". ' +
  'The type must be exactly one of: "standard", "multiple_choice", or "short_answer". ' +
  'The difficulty must be exactly one of: "easy", "mid", or "high". ' +
  "Use standard cards for direct question-and-answer review. " +
  "Use multiple_choice cards with exactly 4 options in the options array and one correct answer. " +
  "Use short_answer cards only when the correct answer is 1 to 3 words. " +
  "Mix all three card types throughout the deck. " +
  `Examples:\n${FLASHCARD_EXAMPLES}\n` +
  "Every card must have a non-empty question and answer. " +
  "Cover the section thoroughly but keep each response concise enough for token limits. " +
  "Order cards from easy to mid to high. " +
  "Do not invent information that is not supported by the uploaded content.";

const getFlashcardChunkSize = () => {
  const fixedOverhead = estimateTokens(FLASHCARD_SYSTEM_PROMPT) + 400;
  const availableInputTokens =
    FLASHCARD_MAX_REQUEST_TOKENS -
    FLASHCARD_MAX_OUTPUT_TOKENS -
    fixedOverhead;

  return Math.max(1500, availableInputTokens * ESTIMATE_CHARS_PER_TOKEN);
};

const normalizeFlashcardFields = (item) => {
  const question = String(
    item?.question || item?.front || item?.term || item?.prompt || ""
  ).trim();

  const answer = String(
    item?.answer || item?.back || item?.definition || item?.response || ""
  ).trim();

  const type = normalizeCardType(item?.type);
  const subject =
    String(item?.subject || item?.topic || "Study Material").trim() ||
    "Study Material";
  const difficulty = normalizeDifficulty(item?.difficulty || item?.level);

  if (!question || !answer) {
    return null;
  }

  if (type === FLASHCARD_TYPES.MULTIPLE_CHOICE) {
    const options = normalizeMultipleChoiceOptions(item?.options, answer);

    if (options.length < 4) {
      return null;
    }

    return {
      type,
      subject,
      question,
      answer,
      options,
      difficulty,
    };
  }

  if (type === FLASHCARD_TYPES.SHORT_ANSWER) {
    const shortAnswer = normalizeShortAnswer(answer);

    if (!isValidShortAnswer(shortAnswer)) {
      return null;
    }

    return {
      type,
      subject,
      question,
      answer: shortAnswer,
      options: [],
      difficulty,
    };
  }

  return {
    type: FLASHCARD_TYPES.STANDARD,
    subject,
    question,
    answer,
    options: [],
    difficulty,
  };
};

const parseFlashcardsResponse = (rawText, { strict = true } = {}) => {
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
      throw new Error("The AI returned an invalid flashcard format. Please try again.");
    }

    parsed = JSON.parse(arrayMatch[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("The AI response was not a flashcard list. Please try again.");
  }

  const flashcards = parsed
    .map((item) => normalizeFlashcardFields(item))
    .filter(Boolean);

  if (flashcards.length === 0) {
    if (strict) {
      throw new Error(
        "No flashcards could be created from this file. Add more study content and try again."
      );
    }

    return [];
  }

  return flashcards;
};

const splitStudyMaterialIntoChunks = (text) => {
  const normalizedText = String(text || "").trim();
  const chunkSize = getFlashcardChunkSize();

  if (!normalizedText) {
    return [];
  }

  if (normalizedText.length <= chunkSize) {
    return [normalizedText];
  }

  const chunks = [];
  let start = 0;

  while (start < normalizedText.length) {
    const end = Math.min(start + chunkSize, normalizedText.length);
    chunks.push(normalizedText.slice(start, end));

    if (end >= normalizedText.length) {
      break;
    }

    start = Math.max(end - FLASHCARD_CHUNK_OVERLAP, start + 1);
  }

  return chunks;
};

const mergeFlashcards = (flashcardGroups) => {
  const seenQuestions = new Set();
  const merged = [];

  flashcardGroups.flat().forEach((card) => {
    const questionKey = `${card.type}:${card.question.toLowerCase()}`;

    if (seenQuestions.has(questionKey)) {
      return;
    }

    seenQuestions.add(questionKey);
    merged.push(card);
  });

  return sortFlashcardsByDifficulty(merged).map((card, index) => ({
    ...card,
    id: index + 1,
  }));
};

const requestFlashcards = async (
  fileName,
  text,
  { chunkIndex = 0, totalChunks = 1, signal } = {}
) => {
  const sectionLabel =
    totalChunks > 1
      ? `Section ${chunkIndex + 1} of ${totalChunks}`
      : "Full document";

  const messages = [
    { role: "system", content: FLASHCARD_SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Create flashcards from this uploaded study file: "${fileName}".\n` +
        `${sectionLabel}.\n\n` +
        `Study material:\n${text}\n\n` +
        "Include standard, multiple_choice, and short_answer cards. " +
        "Short_answer answers must be only 1 to 3 words. " +
        "Multiple_choice cards must have exactly 4 options. " +
        "Cover this section thoroughly and return cards ordered easy to high.",
    },
  ];

  return callGroqChat({
    model: FLASHCARD_GROQ_MODEL,
    messages,
    temperature: 0.35,
    maxTokens: FLASHCARD_MAX_OUTPUT_TOKENS,
    signal,
  });
};

const generateFlashcardsFromText = async (fileName, text, options = {}) => {
  const chunks = splitStudyMaterialIntoChunks(text);

  if (chunks.length === 0) {
    throw new Error("No readable study content was found in the uploaded file.");
  }

  const flashcardGroups = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const responseText = await requestFlashcards(fileName, chunks[index], {
      chunkIndex: index,
      totalChunks: chunks.length,
      signal: options.signal,
    });

    const chunkFlashcards = parseFlashcardsResponse(responseText, {
      strict: false,
    });

    if (chunkFlashcards.length > 0) {
      flashcardGroups.push(chunkFlashcards);
    }
  }

  const flashcards = mergeFlashcards(flashcardGroups);

  if (flashcards.length === 0) {
    throw new Error(
      "No flashcards could be created from this file. Add more study content and try again."
    );
  }

  return flashcards;
};

export const generateFlashcardsFromFile = async (file, options = {}) => {
  const { fileName, text } = await extractTextFromUploadedFile(file);

  try {
    const flashcards = await generateFlashcardsFromText(fileName, text, options);

    return {
      fileName,
      flashcards,
      deckTitle: fileName.replace(/\.[^/.]+$/, "") || "Generated Deck",
    };
  } catch (firstError) {
    const flashcards = await generateFlashcardsFromText(
      fileName,
      `${text}\n\nImportant: include valid standard, multiple_choice, and short_answer cards with complete answers.`,
      options
    );

    if (flashcards.length === 0) {
      throw firstError;
    }

    return {
      fileName,
      flashcards,
      deckTitle: fileName.replace(/\.[^/.]+$/, "") || "Generated Deck",
    };
  }
};
