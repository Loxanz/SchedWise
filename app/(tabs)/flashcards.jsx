import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FLASHCARD_UPLOAD_TYPES } from "../_lib/fileTextExtractor";
import {
  addFlashcardDeck,
  clearFlashcardDecks,
  getFlashcardDecks,
} from "../_lib/flashcardDecks";
import {
  formatDifficultySummary,
  getDifficultyColor,
  getDifficultyLabel,
} from "../_lib/flashcardDifficulty";
import { generateFlashcardsFromFile } from "../_lib/flashcardService";
import {
  answersMatch,
  FLASHCARD_TYPES,
  normalizeCardType,
} from "../_lib/flashcardTypes";
import { supabase } from "../_lib/supabase";

const PRACTICE_CARD_HEIGHT = 460;
const ANSWER_ADVANCE_DELAY_MS = 1100;

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

const THEME_STORAGE_KEY = "schedwise_app_theme_mode";
const THEME_CHANGE_EVENT = "schedwise_theme_changed";

const DARK_THEME = {
  mode: "dark",
  background: "#081225",
  statusBarStyle: "light-content",
  headerGradient: ["#081225", "#0d2342", "#081225"],
  flashcardQuestionGradient: ["#0d1529", "#101f3a", "#0d1529"],
  flashcardAnswerGradient: ["#14294d", "#0d2342", "#101f3a"],
  text: "#ffffff",
  onPrimary: "#ffffff",
  mutedText: "#8ea2c1",
  softText: "#91a5c6",
  brighterSoftText: "#b6c7e6",
  primary: "#4f7df3",
  primaryLight: "#65a1ff",
  purple: "#6d5dfc",
  card: "#0d1529",
  surface: "#17233b",
  border: "#1b2944",
  borderSoft: "rgba(142, 162, 193, 0.22)",
  divider: "rgba(142, 162, 193, 0.16)",
  overviewBackground: "rgba(101,161,255,0.13)",
  overviewBorder: "rgba(101,161,255,0.25)",
  warning: "#f59e0b",
  warningTint: "rgba(245,158,11,0.18)",
  warningBorder: "rgba(245,158,11,0.35)",
  success: "#22c55e",
  successTint: "rgba(34,197,94,0.18)",
  successBorder: "rgba(34,197,94,0.35)",
  danger: "#ef4444",
  dangerButton: "rgba(239,68,68,0.85)",
  subjectTint: "rgba(101,161,255,0.16)",
  subjectBorder: "rgba(101,161,255,0.28)",
  disabledPrimary: "#24324d",
  progressTrack: "#d1d5db",
  progressFill: "#22c55e",
};

const LIGHT_THEME = {
  mode: "light",
  background: "#f4f7fb",
  statusBarStyle: "dark-content",
  headerGradient: ["#eaf2ff", "#f7fbff", "#f4f7fb"],
  flashcardQuestionGradient: ["#ffffff", "#f3f7ff", "#ffffff"],
  flashcardAnswerGradient: ["#eef5ff", "#ffffff", "#f3f7ff"],
  text: "#10203b",
  onPrimary: "#ffffff",
  mutedText: "#60718f",
  softText: "#4f607a",
  brighterSoftText: "#40516e",
  primary: "#4f7df3",
  primaryLight: "#3f76e8",
  purple: "#6d5dfc",
  card: "#ffffff",
  surface: "#eef4ff",
  border: "#d9e4f2",
  borderSoft: "rgba(79,125,243,0.18)",
  divider: "rgba(16,32,59,0.12)",
  overviewBackground: "rgba(79,125,243,0.12)",
  overviewBorder: "rgba(79,125,243,0.22)",
  warning: "#d97706",
  warningTint: "rgba(217,119,6,0.12)",
  warningBorder: "rgba(217,119,6,0.24)",
  success: "#16a34a",
  successTint: "rgba(22,163,74,0.12)",
  successBorder: "rgba(22,163,74,0.24)",
  danger: "#ef4444",
  dangerButton: "rgba(239,68,68,0.9)",
  subjectTint: "rgba(79,125,243,0.12)",
  subjectBorder: "rgba(79,125,243,0.22)",
  disabledPrimary: "#b9c8df",
  progressTrack: "#d1d5db",
  progressFill: "#22c55e",
};

const SUPPORTED_UPLOAD_TYPES = FLASHCARD_UPLOAD_TYPES;

const DECK_COLORS = ["#4f7df3", "#f59e0b", "#22c55e", "#6d5dfc", "#ef4444"];

export default function FlashcardsScreen() {
  const [currentCard, setCurrentCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [savedDecks, setSavedDecks] = useState([]);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [shortUserAnswer, setShortUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");

  const advanceTimeoutRef = useRef(null);
  const currentCardRef = useRef(0);
  const cardAnim = useRef(new Animated.Value(1)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const activeDeck = useMemo(() => {
    return (
      savedDecks.find((deck) => String(deck.id) === String(activeDeckId)) ||
      null
    );
  }, [savedDecks, activeDeckId]);

  const generatedFlashcards = activeDeck?.flashcards || [];
  const deckTitle = activeDeck?.title || "";
  const hasUploadedFile = Boolean(uploadedFile);
  const hasSavedDecks = savedDecks.length > 0;
  const hasGeneratedFlashcards =
    Boolean(activeDeckId) && generatedFlashcards.length > 0;
  const selectedCard = hasGeneratedFlashcards
    ? generatedFlashcards[currentCard]
    : null;
  const practiceProgressPercent = hasGeneratedFlashcards
    ? Math.round(
        ((currentCard + (showAnswer ? 1 : 0)) /
          Math.max(generatedFlashcards.length, 1)) *
          100
      )
    : 0;

  const loadThemeMode = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      setThemeMode(savedTheme === "light" ? "light" : "dark");
    } catch {
      setThemeMode("dark");
    }
  }, []);

  const loadFlashcardDecks = useCallback(async ({ preserveActiveDeck = true } = {}) => {
    try {
      const decks = await getFlashcardDecks();
      setSavedDecks(decks);

      if (!preserveActiveDeck) {
        setActiveDeckId(null);
        setUploadedFile(null);
        setCurrentCard(0);
        setShowAnswer(false);
        setShortUserAnswer("");
        setSelectedOption(null);
        return;
      }

      setActiveDeckId((currentActiveDeckId) => {
        if (
          currentActiveDeckId &&
          decks.some((deck) => String(deck.id) === String(currentActiveDeckId))
        ) {
          return currentActiveDeckId;
        }

        return null;
      });
    } catch {
      setSavedDecks([]);
    }
  }, []);

  const resetPracticeCardState = useCallback(() => {
    setActiveDeckId(null);
    setUploadedFile(null);
    setCurrentCard(0);
    setShowAnswer(false);
    setShortUserAnswer("");
    setSelectedOption(null);
    setIsGenerating(false);
  }, []);

  const handleSelectDeck = useCallback((deckId) => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    setActiveDeckId(deckId);
    setCurrentCard(0);
    setShowAnswer(false);
    setShortUserAnswer("");
    setSelectedOption(null);
    setIsAdvancing(false);
    cardAnim.setValue(1);
    feedbackAnim.setValue(0);
  }, [cardAnim, feedbackAnim]);

  const handleClearDecks = useCallback(() => {
    if (!hasSavedDecks) {
      return;
    }

    Alert.alert(
      "Clear My Decks",
      "This will remove all saved flashcard decks. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearFlashcardDecks();
              setSavedDecks([]);
              setActiveDeckId(null);
              setCurrentCard(0);
              setShowAnswer(false);
              setShortUserAnswer("");
              setSelectedOption(null);
            } catch (error) {
              Alert.alert(
                "Clear Failed",
                error?.message || "Could not clear saved decks. Please try again."
              );
            }
          },
        },
      ]
    );
  }, [hasSavedDecks]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        resetPracticeCardState();
        setSavedDecks([]);
        return;
      }

      if (event === "SIGNED_IN") {
        resetPracticeCardState();
        loadFlashcardDecks({ preserveActiveDeck: false });
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadFlashcardDecks, resetPracticeCardState]);

  useEffect(() => {
    currentCardRef.current = currentCard;
  }, [currentCard]);

  useEffect(() => {
    setShowAnswer(false);
    setShortUserAnswer("");
    setSelectedOption(null);
    feedbackAnim.setValue(0);
  }, [currentCard, activeDeckId, feedbackAnim]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();
      loadFlashcardDecks();
    }, [loadThemeMode, loadFlashcardDecks])
  );

  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      THEME_CHANGE_EVENT,
      (nextTheme) => {
        setThemeMode(nextTheme === "light" ? "light" : "dark");
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const handleUploadMaterial = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_UPLOAD_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];

      if (!file) {
        Alert.alert("Upload Failed", "No file was selected.");
        return;
      }

      setUploadedFile(file);

      Alert.alert(
        "File Added",
        `${file.name} has been added. Tap "Generate Flashcards" to create your study reviewer.`
      );
    } catch (error) {
      Alert.alert("Upload Error", "Something went wrong while adding the file.");
    }
  };

  const handleRemoveFile = () => {
    Alert.alert(
      "Remove File",
      "The uploaded file will be removed from Practice Card. Your saved decks in My Decks will stay available.",
      [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setUploadedFile(null);
          setActiveDeckId(null);
          setCurrentCard(0);
          setShowAnswer(false);
        },
      },
    ]);
  };

  const requireFileFirst = () => {
    if (!hasUploadedFile) {
      Alert.alert(
        "Add File First",
        "Please upload a study file first. Supported formats include PDF, Word, PowerPoint, Excel, TXT, and more."
      );
      return false;
    }

    return true;
  };

  const handleGenerateFlashcards = async () => {
    if (!requireFileFirst() || isGenerating) {
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateFlashcardsFromFile(uploadedFile);

      const decks = await addFlashcardDeck({
        title: result.deckTitle,
        sourceFileName: result.fileName,
        flashcards: result.flashcards,
      });

      setSavedDecks(decks);
      setActiveDeckId(decks[0]?.id || null);
      setCurrentCard(0);
      setShowAnswer(false);

      Alert.alert(
        "Flashcards Ready",
        `${result.flashcards.length} flashcards were created from ${result.fileName}.`
      );
    } catch (error) {
      Alert.alert(
        "Generation Failed",
        error?.message ||
          "Something went wrong while generating flashcards. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const clearAdvanceTimeout = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }, []);

  const resetAnswerState = useCallback(() => {
    setShowAnswer(false);
    setShortUserAnswer("");
    setSelectedOption(null);
    feedbackAnim.setValue(0);
  }, [feedbackAnim]);

  const animateToCard = useCallback(
    (nextIndex) => {
      clearAdvanceTimeout();
      setIsAdvancing(true);

      Animated.timing(cardAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        resetAnswerState();
        setCurrentCard(nextIndex);

        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start(() => {
          setIsAdvancing(false);
        });
      });
    },
    [cardAnim, clearAdvanceTimeout, resetAnswerState]
  );

  const scheduleAdvanceAfterAnswer = useCallback(() => {
    clearAdvanceTimeout();
    feedbackAnim.setValue(0);

    Animated.spring(feedbackAnim, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();

    advanceTimeoutRef.current = setTimeout(() => {
      const total = generatedFlashcards.length;
      if (total <= 0) {
        return;
      }

      const prev = currentCardRef.current;
      const nextIndex = prev === total - 1 ? 0 : prev + 1;
      animateToCard(nextIndex);
    }, ANSWER_ADVANCE_DELAY_MS);
  }, [
    animateToCard,
    clearAdvanceTimeout,
    feedbackAnim,
    generatedFlashcards.length,
  ]);

  const handleCheckShortAnswer = () => {
    if (isAdvancing) {
      return;
    }

    if (!shortUserAnswer.trim()) {
      Alert.alert("Enter an Answer");
      return;
    }

    setShowAnswer(true);
    scheduleAdvanceAfterAnswer();
  };

  const handleSelectOption = (option) => {
    if (isAdvancing || showAnswer) {
      return;
    }

    setSelectedOption(option);
    setShowAnswer(true);
    scheduleAdvanceAfterAnswer();
  };

  const handleFlipStandardCard = () => {
    if (isAdvancing) {
      return;
    }

    if (showAnswer) {
      clearAdvanceTimeout();
      setShowAnswer(false);
      feedbackAnim.setValue(0);
      return;
    }

    setShowAnswer(true);
    scheduleAdvanceAfterAnswer();
  };

  const renderPracticeCardBody = (card) => {
    const cardType = normalizeCardType(card.type);
    const isStandard = cardType === FLASHCARD_TYPES.STANDARD;
    const isMultipleChoice = cardType === FLASHCARD_TYPES.MULTIPLE_CHOICE;
    const isShortAnswer = cardType === FLASHCARD_TYPES.SHORT_ANSWER;
    const isShortCorrect =
      isShortAnswer && showAnswer
        ? answersMatch(shortUserAnswer, card.answer)
        : null;
    const isOptionCorrect =
      isMultipleChoice && showAnswer
        ? selectedOption === card.answer
        : null;

    const feedbackMessage = isMultipleChoice
      ? isOptionCorrect
        ? "Correct!"
        : `Incorrect. Correct answer: ${card.answer}`
      : isShortAnswer
      ? isShortCorrect
        ? "Correct!"
        : `Incorrect. Correct answer: ${card.answer}`
      : null;

    const showPinnedFeedback =
      showAnswer && (isMultipleChoice || isShortAnswer) && feedbackMessage;

    return (
      <LinearGradient
        colors={
          showAnswer
            ? theme.flashcardAnswerGradient
            : theme.flashcardQuestionGradient
        }
        style={styles.flashcard}
      >
        <View style={styles.cardTop}>
          <View
            style={[
              styles.difficultyBadge,
              {
                backgroundColor: `${getDifficultyColor(card.difficulty)}22`,
                borderColor: `${getDifficultyColor(card.difficulty)}55`,
              },
            ]}
          >
            <Text
              style={[
                styles.difficultyBadgeText,
                { color: getDifficultyColor(card.difficulty) },
              ]}
            >
              {getDifficultyLabel(card.difficulty)}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={styles.cardCenter}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.cardMainText}>
            {showAnswer && isStandard ? card.answer : card.question}
          </Text>

          {isMultipleChoice ? (
            <View style={styles.optionsList}>
              {(card.options || []).map((option) => {
                const isSelected = selectedOption === option;
                const isCorrectOption = option === card.answer;
                const showResult = showAnswer;

                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      showResult &&
                        isCorrectOption &&
                        styles.optionButtonCorrect,
                      showResult &&
                        isSelected &&
                        !isCorrectOption &&
                        styles.optionButtonWrong,
                    ]}
                    activeOpacity={0.85}
                    disabled={showAnswer || isAdvancing}
                    onPress={() => handleSelectOption(option)}
                  >
                    <Text style={styles.optionButtonText}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {isShortAnswer && !showAnswer ? (
            <View style={styles.shortAnswerBox}>
              <TextInput
                placeholder="Enter an answer"
                placeholderTextColor={theme.placeholder || theme.mutedText}
                style={styles.shortAnswerInput}
                value={shortUserAnswer}
                onChangeText={setShortUserAnswer}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isAdvancing}
              />
              <TouchableOpacity
                style={styles.checkAnswerButton}
                activeOpacity={0.85}
                disabled={isAdvancing}
                onPress={handleCheckShortAnswer}
              >
                <Text style={styles.checkAnswerText}>Check Answer</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>

        {showPinnedFeedback ? (
          <Animated.View
            style={[
              styles.feedbackBox,
              {
                opacity: feedbackAnim,
                transform: [
                  {
                    translateY: feedbackAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                {
                  color:
                    (isMultipleChoice && isOptionCorrect) ||
                    (isShortAnswer && isShortCorrect)
                      ? theme.success
                      : theme.danger,
                },
              ]}
            >
              {feedbackMessage}
            </Text>
          </Animated.View>
        ) : null}
      </LinearGradient>
    );
  };

  const handleNext = () => {
    if (isAdvancing) {
      return;
    }

    if (!hasGeneratedFlashcards) {
      if (hasSavedDecks) {
        Alert.alert(
          "Select a Deck",
          "Tap a deck in My Decks below to start practicing again."
        );
        return;
      }

      if (!hasUploadedFile) {
        requireFileFirst();
        return;
      }

      Alert.alert(
        "Generate Flashcards First",
        "Upload your file, then tap Generate Flashcards before reviewing cards."
      );
      return;
    }

    const nextIndex =
      currentCard === generatedFlashcards.length - 1 ? 0 : currentCard + 1;
    animateToCard(nextIndex);
  };

  const handlePrevious = () => {
    if (isAdvancing) {
      return;
    }

    if (!hasGeneratedFlashcards) {
      if (hasSavedDecks) {
        Alert.alert(
          "Select a Deck",
          "Tap a deck in My Decks below to start practicing again."
        );
        return;
      }

      if (!hasUploadedFile) {
        requireFileFirst();
        return;
      }

      Alert.alert(
        "Generate Flashcards First",
        "Upload your file, then tap Generate Flashcards before reviewing cards."
      );
      return;
    }

    const previousIndex =
      currentCard === 0
        ? generatedFlashcards.length - 1
        : currentCard - 1;
    animateToCard(previousIndex);
  };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.background}
        translucent={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={theme.headerGradient} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTextArea}>
              <Text style={styles.headerLabel}>Flashcards</Text>
              <Text style={styles.headerTitle}>Study Reviewer</Text>
              <Text style={styles.headerSubtitle}>
                Upload your lesson file first before creating AI-generated
                flashcards.
              </Text>
            </View>

            <View style={styles.headerIcon}>
              <Ionicons name="albums-outline" size={30} color="#ffffff" />
            </View>
          </View>

          <View style={styles.overviewCard}>
            <View style={styles.overviewIcon}>
              <MaterialCommunityIcons
                name="cards-outline"
                size={27}
                color="#ffffff"
              />
            </View>

            <View style={styles.overviewContent}>
              <Text style={styles.overviewTitle}>
                {isGenerating
                  ? "Generating Flashcards"
                  : hasGeneratedFlashcards
                  ? "Flashcards Ready"
                  : hasUploadedFile
                  ? "Ready to Generate"
                  : "Add File First"}
              </Text>
              <Text style={styles.overviewText}>
                {isGenerating
                  ? "Groq AI is reading your file and creating flashcards. Large files are processed in smaller sections."
                  : hasGeneratedFlashcards
                  ? `${generatedFlashcards.length} cards created from ${uploadedFile?.name || "your file"}`
                  : hasUploadedFile
                  ? `${uploadedFile.name} is uploaded`
                  : "Upload PDF, Word, PowerPoint, Excel, TXT, or other study files"}
              </Text>
            </View>

            <View
              style={[
                styles.overviewBadge,
                hasUploadedFile && styles.overviewBadgeActive,
                hasGeneratedFlashcards && styles.overviewBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.overviewBadgeText,
                  hasUploadedFile && styles.overviewBadgeTextActive,
                  hasGeneratedFlashcards && styles.overviewBadgeTextActive,
                ]}
              >
                {hasGeneratedFlashcards
                  ? "Ready"
                  : hasUploadedFile
                  ? "Ready"
                  : "Required"}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Material File</Text>

          <View style={styles.uploadBox}>
            <View style={styles.uploadIconBox}>
              <Feather
                name={hasUploadedFile ? "file-text" : "upload-cloud"}
                size={25}
                color="#ffffff"
              />
            </View>

            <View style={styles.uploadContent}>
              <Text style={styles.uploadTitle} numberOfLines={1}>
                {hasUploadedFile ? uploadedFile.name : "No file added yet"}
              </Text>

              <Text style={styles.uploadSubtitle}>
                {hasUploadedFile
                  ? "Generate flashcards from this file using Groq AI."
                  : "Add a study file first. PDF, DOCX, PPTX, XLSX, TXT, and more are supported."}
              </Text>
            </View>

            {hasUploadedFile ? (
              <TouchableOpacity
                style={styles.removeFileButton}
                activeOpacity={0.8}
                onPress={handleRemoveFile}
              >
                <Feather name="x" size={17} color="#ffffff" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.uploadButton}
            activeOpacity={0.85}
            onPress={handleUploadMaterial}
            disabled={isGenerating}
          >
            <Feather name="plus-circle" size={20} color="#ffffff" />
            <Text style={styles.uploadButtonText}>
              {hasUploadedFile ? "Change File" : "Add File"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.generateButton,
              (!hasUploadedFile || isGenerating) && styles.disabledPrimaryButton,
            ]}
            activeOpacity={0.85}
            onPress={handleGenerateFlashcards}
            disabled={!hasUploadedFile || isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialCommunityIcons
                name="robot-outline"
                size={20}
                color="#ffffff"
              />
            )}
            <Text style={styles.generateButtonText}>
              {isGenerating ? "Generating..." : "Generate Flashcards"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Practice Card</Text>
            <Text style={styles.cardCounter}>
              {hasGeneratedFlashcards
                ? `${currentCard + 1}/${generatedFlashcards.length}`
                : hasUploadedFile
                ? "Generate first"
                : hasSavedDecks
                ? "Select deck"
                : "Locked"}
            </Text>
          </View>

          {hasGeneratedFlashcards ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        Math.max(practiceProgressPercent, 0),
                        100
                      )}%`,
                      minWidth: practiceProgressPercent > 0 ? 36 : 0,
                    },
                  ]}
                >
                  {practiceProgressPercent >= 18 ? (
                    <Text style={styles.progressFillText}>
                      {practiceProgressPercent}%
                    </Text>
                  ) : null}
                </View>

                {practiceProgressPercent < 18 ? (
                  <Text style={styles.progressTrackText}>
                    {practiceProgressPercent}%
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {hasGeneratedFlashcards && selectedCard ? (
            <Animated.View
              style={{
                opacity: cardAnim,
                transform: [
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                  {
                    scale: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              }}
            >
              {normalizeCardType(selectedCard.type) ===
              FLASHCARD_TYPES.STANDARD ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={isAdvancing}
                  onPress={handleFlipStandardCard}
                >
                  {renderPracticeCardBody(selectedCard)}
                </TouchableOpacity>
              ) : (
                <View>{renderPracticeCardBody(selectedCard)}</View>
              )}
            </Animated.View>
          ) : (
            <LinearGradient
              colors={theme.flashcardQuestionGradient}
              style={styles.lockedCard}
            >
              <View style={styles.lockIcon}>
                <Feather name="lock" size={28} color="#ffffff" />
              </View>

              <Text style={styles.lockTitle}>
                {hasUploadedFile
                  ? "Generate your flashcards"
                  : hasSavedDecks
                  ? "Select a deck to practice"
                  : "Flashcards are locked"}
              </Text>
              <Text style={styles.lockText}>
                {hasUploadedFile
                  ? "Your file is uploaded. Tap Generate Flashcards so Groq AI can read it and create your study reviewer."
                  : hasSavedDecks
                  ? "Your saved decks are still in My Decks below. Tap any deck to open it in Practice Card again."
                  : "Please add your lesson file first. After uploading, generate flashcards to start reviewing."}
              </Text>

              {!hasSavedDecks || hasUploadedFile ? (
                <TouchableOpacity
                  style={styles.lockUploadButton}
                  activeOpacity={0.85}
                  onPress={
                    hasUploadedFile
                      ? handleGenerateFlashcards
                      : handleUploadMaterial
                  }
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Feather
                      name={hasUploadedFile ? "zap" : "upload-cloud"}
                      size={19}
                      color="#ffffff"
                    />
                  )}
                  <Text style={styles.lockUploadText}>
                    {isGenerating
                      ? "Generating..."
                      : hasUploadedFile
                      ? "Generate Flashcards"
                      : "Add File Now"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </LinearGradient>
          )}

          <View style={styles.cardControls}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                !hasGeneratedFlashcards && styles.disabledButton,
              ]}
              activeOpacity={0.8}
              onPress={handlePrevious}
            >
              <Feather name="chevron-left" size={22} color={theme.text} />
              <Text style={styles.controlButtonText}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryControlButton,
                !hasGeneratedFlashcards && styles.disabledPrimaryButton,
              ]}
              activeOpacity={0.8}
              onPress={handleNext}
            >
              <Text style={styles.primaryControlText}>Next Card</Text>
              <Feather name="chevron-right" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Decks</Text>
            {hasSavedDecks ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleClearDecks}
              >
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {savedDecks.length > 0 ? (
            savedDecks.map((deck, index) => {
              const deckColor = DECK_COLORS[index % DECK_COLORS.length];
              const isActive = String(deck.id) === String(activeDeckId);
              const progressLabel = `${deck.progress || 0}%`;

              return (
                <TouchableOpacity
                  key={deck.id}
                  style={[
                    styles.deckCard,
                    isActive && styles.deckCardActive,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleSelectDeck(deck.id)}
                >
                  <View
                    style={[
                      styles.deckIconBox,
                      { backgroundColor: `${deckColor}22` },
                    ]}
                  >
                    <Feather name="book-open" size={22} color={deckColor} />
                  </View>

                  <View style={styles.deckContent}>
                    <Text style={styles.deckTitle}>{deck.title}</Text>
                    <Text style={styles.deckSource} numberOfLines={1}>
                      {deck.sourceFileName || "Uploaded study file"}
                    </Text>

                    <View style={styles.deckMetaRow}>
                      <Text style={styles.deckMeta}>
                        {deck.flashcards.length} cards
                      </Text>
                    </View>

                    <Text style={styles.deckDifficultySummary}>
                      {formatDifficultySummary(deck.flashcards)}
                    </Text>

                    <View style={styles.deckProgressTrack}>
                      <View
                        style={[
                          styles.deckProgressFill,
                          {
                            width: progressLabel,
                            backgroundColor: deckColor,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <Feather
                    name={isActive ? "check-circle" : "chevron-right"}
                    size={21}
                    color={isActive ? theme.success : theme.mutedText}
                  />
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyDeckCard}>
              <Feather name="folder" size={25} color={theme.mutedText} />
              <Text style={styles.emptyDeckTitle}>No decks yet</Text>
              <Text style={styles.emptyDeckText}>
                Your generated flashcard decks will stay here even after you
                upload another file.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

    scrollContent: {
      paddingBottom: 82,
    },

    header: {
      paddingTop: TOP_SAFE_SPACE + 10,
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomLeftRadius: 26,
      borderBottomRightRadius: 26,
    },

    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },

    headerTextArea: {
      flex: 1,
      paddingRight: 14,
    },

    headerLabel: {
      color: theme.mutedText,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    headerTitle: {
      color: theme.text,
      fontSize: 26,
      fontWeight: "900",
      marginTop: 4,
    },

    headerSubtitle: {
      color: theme.softText,
      fontSize: 12.5,
      marginTop: 5,
      lineHeight: 18,
    },

    headerIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
    },

    overviewCard: {
      marginTop: 18,
      backgroundColor: theme.overviewBackground,
      borderWidth: 1,
      borderColor: theme.overviewBorder,
      borderRadius: 22,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
    },

    overviewIcon: {
      width: 50,
      height: 50,
      borderRadius: 17,
      backgroundColor: theme.purple,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    overviewContent: {
      flex: 1,
    },

    overviewTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },

    overviewText: {
      color: theme.softText,
      fontSize: 12.5,
      marginTop: 4,
      lineHeight: 17,
    },

    overviewBadge: {
      backgroundColor: theme.warningTint,
      borderWidth: 1,
      borderColor: theme.warningBorder,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      marginLeft: 8,
    },

    overviewBadgeActive: {
      backgroundColor: theme.successTint,
      borderColor: theme.successBorder,
    },

    overviewBadgeText: {
      color: theme.warning,
      fontSize: 11.5,
      fontWeight: "800",
    },

    overviewBadgeTextActive: {
      color: theme.success,
    },

    section: {
      paddingHorizontal: 20,
      marginTop: 18,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    sectionTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
      marginBottom: 10,
    },

    uploadBox: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
    },

    uploadIconBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
    },

    uploadContent: {
      flex: 1,
    },

    uploadTitle: {
      color: theme.text,
      fontSize: 14.5,
      fontWeight: "900",
    },

    uploadSubtitle: {
      color: theme.mutedText,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },

    removeFileButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: theme.dangerButton,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },

    uploadButton: {
      height: 50,
      borderRadius: 17,
      backgroundColor: theme.primary,
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    uploadButtonText: {
      color: "#ffffff",
      fontSize: 14.5,
      fontWeight: "900",
      marginLeft: 8,
    },

    generateButton: {
      height: 50,
      borderRadius: 17,
      backgroundColor: theme.purple,
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    generateButtonText: {
      color: "#ffffff",
      fontSize: 14.5,
      fontWeight: "900",
      marginLeft: 8,
    },

    cardCounter: {
      color: theme.primaryLight,
      fontSize: 12.5,
      fontWeight: "900",
      marginBottom: 10,
    },

    progressBlock: {
      marginBottom: 14,
      width: "100%",
    },

    progressTrack: {
      height: 28,
      width: "100%",
      borderRadius: 999,
      backgroundColor: theme.progressTrack,
      overflow: "hidden",
      justifyContent: "center",
    },

    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: theme.progressFill,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingRight: 10,
    },

    progressFillText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "800",
      includeFontPadding: false,
    },

    progressTrackText: {
      position: "absolute",
      right: 12,
      color: theme.softText,
      fontSize: 13,
      fontWeight: "800",
      includeFontPadding: false,
    },

    flashcard: {
      height: PRACTICE_CARD_HEIGHT,
      borderRadius: 24,
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      shadowColor: theme.primary,
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
      overflow: "hidden",
    },

    lockedCard: {
      height: PRACTICE_CARD_HEIGHT,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
    },

    lockIcon: {
      width: 56,
      height: 56,
      borderRadius: 19,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },

    lockTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: "900",
      textAlign: "center",
    },

    lockText: {
      color: theme.mutedText,
      fontSize: 12.5,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 7,
    },

    lockUploadButton: {
      height: 45,
      borderRadius: 15,
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    lockUploadText: {
      color: "#ffffff",
      fontSize: 13.5,
      fontWeight: "900",
      marginLeft: 7,
    },

    cardTop: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },

    difficultyBadge: {
      borderWidth: 1,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 13,
    },

    difficultyBadgeText: {
      fontSize: 11.5,
      fontWeight: "900",
      textTransform: "uppercase",
    },

    optionsList: {
      width: "100%",
      marginTop: 14,
      gap: 8,
    },

    optionButton: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      minHeight: 44,
      justifyContent: "center",
    },

    optionButtonCorrect: {
      backgroundColor: theme.successTint,
      borderColor: theme.successBorder,
    },

    optionButtonWrong: {
      backgroundColor: "rgba(239,68,68,0.12)",
      borderColor: theme.danger,
    },

    optionButtonText: {
      color: theme.text,
      fontSize: 13.5,
      fontWeight: "700",
      textAlign: "center",
    },

    shortAnswerBox: {
      width: "100%",
      marginTop: 16,
    },

    shortAnswerInput: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 16,
      fontWeight: "600",
    },

    checkAnswerButton: {
      marginTop: 10,
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
    },

    checkAnswerText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "800",
    },

    feedbackBox: {
      marginTop: 8,
      paddingTop: 10,
      paddingHorizontal: 6,
      paddingBottom: 4,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
      minHeight: 52,
      justifyContent: "center",
    },

    feedbackText: {
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center",
      lineHeight: 20,
    },

    cardScroll: {
      flex: 1,
      minHeight: 0,
    },

    cardCenter: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      paddingTop: 4,
      paddingBottom: 12,
    },

    cardMainText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 26,
      width: "100%",
    },

    cardControls: {
      flexDirection: "row",
      marginTop: 10,
    },

    controlButton: {
      flex: 1,
      height: 50,
      borderRadius: 17,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 7,
    },

    controlButtonText: {
      color: theme.text,
      fontSize: 13.5,
      fontWeight: "800",
      marginLeft: 4,
    },

    primaryControlButton: {
      flex: 1,
      height: 50,
      borderRadius: 17,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 7,
    },

    primaryControlText: {
      color: "#ffffff",
      fontSize: 13.5,
      fontWeight: "900",
      marginRight: 4,
    },

    disabledButton: {
      opacity: 0.55,
    },

    disabledPrimaryButton: {
      backgroundColor: theme.disabledPrimary,
      opacity: 0.8,
    },

    clearText: {
      color: theme.danger,
      fontSize: 12.5,
      fontWeight: "800",
      marginBottom: 10,
    },

    deckCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },

    deckCardActive: {
      borderColor: theme.primary,
      backgroundColor: theme.overviewBackground,
    },

    deckIconBox: {
      width: 47,
      height: 47,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
    },

    deckContent: {
      flex: 1,
    },

    deckTitle: {
      color: theme.text,
      fontSize: 14.5,
      fontWeight: "900",
    },

    deckSource: {
      color: theme.mutedText,
      fontSize: 11.5,
      marginTop: 3,
    },

    deckMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      marginBottom: 8,
    },

    deckMeta: {
      color: theme.mutedText,
      fontSize: 11.5,
      fontWeight: "700",
    },

    deckDifficultySummary: {
      color: theme.softText,
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 8,
    },

    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.mutedText,
      marginHorizontal: 7,
    },

    deckProgressTrack: {
      height: 6,
      backgroundColor: theme.progressTrack,
      borderRadius: 20,
      overflow: "hidden",
    },

    deckProgressFill: {
      height: "100%",
      borderRadius: 20,
    },

    emptyDeckCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      alignItems: "center",
    },

    emptyDeckTitle: {
      color: theme.text,
      fontSize: 15.5,
      fontWeight: "900",
      marginTop: 8,
    },

    emptyDeckText: {
      color: theme.mutedText,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 5,
    },

    bottomSpace: {
      height: 6,
    },
  });