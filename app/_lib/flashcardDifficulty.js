export const FLASHCARD_DIFFICULTIES = ["easy", "mid", "high"];

export const normalizeDifficulty = (value) => {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();

  if (["easy", "low", "beginner", "basic"].includes(normalized)) {
    return "easy";
  }

  if (
    ["mid", "medium", "moderate", "normal", "intermediate"].includes(normalized)
  ) {
    return "mid";
  }

  if (["high", "hard", "advanced", "difficult", "expert"].includes(normalized)) {
    return "high";
  }

  return "mid";
};

export const getDifficultyLabel = (difficulty) => {
  const normalized = normalizeDifficulty(difficulty);

  if (normalized === "easy") return "Easy";
  if (normalized === "high") return "High";
  return "Mid";
};

export const getDifficultyColor = (difficulty) => {
  const normalized = normalizeDifficulty(difficulty);

  if (normalized === "easy") return "#22c55e";
  if (normalized === "high") return "#ef4444";
  return "#f59e0b";
};

export const getDifficultySortOrder = (difficulty) => {
  const normalized = normalizeDifficulty(difficulty);
  const order = FLASHCARD_DIFFICULTIES.indexOf(normalized);

  return order >= 0 ? order : 1;
};

export const sortFlashcardsByDifficulty = (flashcards) => {
  return [...(Array.isArray(flashcards) ? flashcards : [])]
    .sort(
      (a, b) =>
        getDifficultySortOrder(a?.difficulty) - getDifficultySortOrder(b?.difficulty)
    )
    .map((card, index) => ({
      ...card,
      id: index + 1,
    }));
};

export const getDifficultyCounts = (flashcards) => {
  const counts = { easy: 0, mid: 0, high: 0 };

  (Array.isArray(flashcards) ? flashcards : []).forEach((card) => {
    const difficulty = normalizeDifficulty(card?.difficulty);
    counts[difficulty] += 1;
  });

  return counts;
};

export const formatDifficultySummary = (flashcards) => {
  const counts = getDifficultyCounts(flashcards);

  return FLASHCARD_DIFFICULTIES.map((level) => {
    const count = counts[level];
    return count > 0 ? `${count} ${getDifficultyLabel(level)}` : null;
  })
    .filter(Boolean)
    .join(" · ");
};
