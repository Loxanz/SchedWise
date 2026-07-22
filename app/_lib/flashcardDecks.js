import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeDifficulty, sortFlashcardsByDifficulty } from "./flashcardDifficulty";
import {
  FLASHCARD_TYPES,
  isValidShortAnswer,
  normalizeCardType,
  normalizeMultipleChoiceOptions,
  normalizeShortAnswer,
} from "./flashcardTypes";
import { getCurrentUser } from "./supabase";

export const FLASHCARD_DECKS_STORAGE_KEY = "schedwise_flashcard_decks";

export const getFlashcardDecksStorageKey = (userId) => {
  return `schedwise_flashcard_decks_${userId}`;
};

const resolveUserId = async (userId) => {
  if (userId) {
    return userId;
  }

  const user = await getCurrentUser();

  if (!user?.id) {
    throw new Error("You must be signed in to access flashcard decks.");
  }

  return user.id;
};

const migrateLegacyDecksIfNeeded = async (userId) => {
  const userStorageKey = getFlashcardDecksStorageKey(userId);
  const existingUserDecks = await AsyncStorage.getItem(userStorageKey);

  if (existingUserDecks) {
    return;
  }

  const legacyDecks = await AsyncStorage.getItem(FLASHCARD_DECKS_STORAGE_KEY);

  if (!legacyDecks) {
    return;
  }

  await AsyncStorage.setItem(userStorageKey, legacyDecks);
  await AsyncStorage.removeItem(FLASHCARD_DECKS_STORAGE_KEY);
};

const makeDeckId = () => {
  return `deck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeFlashcard = (card, index) => {
  const type = normalizeCardType(card?.type);
  const question = String(card?.question || "").trim();
  const answer = String(card?.answer || "").trim();
  const subject =
    String(card?.subject || "Study Material").trim() || "Study Material";
  const difficulty = normalizeDifficulty(card?.difficulty);

  if (!question || !answer) {
    return null;
  }

  if (type === FLASHCARD_TYPES.MULTIPLE_CHOICE) {
    const options = normalizeMultipleChoiceOptions(card?.options, answer);

    if (options.length < 4) {
      return null;
    }

    return {
      id: Number(card?.id) || index + 1,
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
      id: Number(card?.id) || index + 1,
      type,
      subject,
      question,
      answer: shortAnswer,
      options: [],
      difficulty,
    };
  }

  return {
    id: Number(card?.id) || index + 1,
    type: FLASHCARD_TYPES.STANDARD,
    subject,
    question,
    answer,
    options: [],
    difficulty,
  };
};

const normalizeDeck = (deck) => {
  if (!deck) return null;

  const flashcards = sortFlashcardsByDifficulty(
    (Array.isArray(deck.flashcards) ? deck.flashcards : [])
      .map(normalizeFlashcard)
      .filter(Boolean)
  );

  if (flashcards.length === 0) {
    return null;
  }

  return {
    id: String(deck.id || makeDeckId()),
    title: String(deck.title || deck.deckTitle || "Generated Deck").trim(),
    sourceFileName: String(deck.sourceFileName || deck.fileName || "").trim(),
    flashcards,
    progress: Number.isFinite(deck.progress) ? Math.max(0, deck.progress) : 0,
    createdAt: deck.createdAt || new Date().toISOString(),
    updatedAt: deck.updatedAt || deck.createdAt || new Date().toISOString(),
  };
};

const sortDecks = (decks) => {
  return [...decks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getFlashcardDecks = async (userId) => {
  try {
    const resolvedUserId = await resolveUserId(userId);
    await migrateLegacyDecksIfNeeded(resolvedUserId);

    const storedDecks = await AsyncStorage.getItem(
      getFlashcardDecksStorageKey(resolvedUserId)
    );
    const parsedDecks = storedDecks ? JSON.parse(storedDecks) : [];

    if (!Array.isArray(parsedDecks)) {
      return [];
    }

    return sortDecks(
      parsedDecks.map(normalizeDeck).filter(Boolean)
    );
  } catch (error) {
    console.log("Load flashcard decks error:", error?.message);
    return [];
  }
};

export const saveFlashcardDecks = async (decks, userId) => {
  const resolvedUserId = await resolveUserId(userId);
  const normalizedDecks = sortDecks(
    (Array.isArray(decks) ? decks : []).map(normalizeDeck).filter(Boolean)
  );

  await AsyncStorage.setItem(
    getFlashcardDecksStorageKey(resolvedUserId),
    JSON.stringify(normalizedDecks)
  );

  return normalizedDecks;
};

export const addFlashcardDeck = async ({
  title,
  sourceFileName,
  flashcards,
}) => {
  const currentDecks = await getFlashcardDecks();
  const now = new Date().toISOString();

  const newDeck = normalizeDeck({
    id: makeDeckId(),
    title,
    sourceFileName,
    flashcards,
    progress: 0,
    createdAt: now,
    updatedAt: now,
  });

  if (!newDeck) {
    throw new Error("Could not save deck without valid flashcards.");
  }

  return await saveFlashcardDecks([newDeck, ...currentDecks]);
};

export const deleteFlashcardDeck = async (deckId) => {
  const currentDecks = await getFlashcardDecks();

  return await saveFlashcardDecks(
    currentDecks.filter((deck) => String(deck.id) !== String(deckId))
  );
};

export const clearFlashcardDecks = async (userId) => {
  const resolvedUserId = await resolveUserId(userId);

  await AsyncStorage.setItem(
    getFlashcardDecksStorageKey(resolvedUserId),
    JSON.stringify([])
  );

  return [];
};
