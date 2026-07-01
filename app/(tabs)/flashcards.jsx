import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
  progressTrack: "#17233b",
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
  progressTrack: "#dce6f3",
};

const flashcards = [
  {
    id: 1,
    subject: "Science",
    question: "What is photosynthesis?",
    answer:
      "Photosynthesis is the process where plants use sunlight, carbon dioxide, and water to make food and release oxygen.",
  },
  {
    id: 2,
    subject: "Mathematics",
    question: "What is the formula for the area of a circle?",
    answer: "The formula is A = πr², where r is the radius of the circle.",
  },
  {
    id: 3,
    subject: "English",
    question: "What is a noun?",
    answer: "A noun is a word that names a person, place, thing, or idea.",
  },
];

const decks = [
  {
    id: 1,
    title: "Science Reviewer",
    cards: 24,
    progress: "72%",
    icon: "book-open",
    color: "#4f7df3",
  },
  {
    id: 2,
    title: "Math Formulas",
    cards: 18,
    progress: "45%",
    icon: "percent",
    color: "#f59e0b",
  },
  {
    id: 3,
    title: "English Terms",
    cards: 15,
    progress: "60%",
    icon: "edit-3",
    color: "#22c55e",
  },
];

export default function FlashcardsScreen() {
  const [currentCard, setCurrentCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [themeMode, setThemeMode] = useState(null);

  const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const hasUploadedFile = Boolean(uploadedFile);
  const selectedCard = flashcards[currentCard];

  const loadThemeMode = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      setThemeMode(savedTheme === "light" ? "light" : "dark");
    } catch {
      setThemeMode("dark");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();
    }, [loadThemeMode])
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
        type: [
          "application/pdf",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ],
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
        `${file.name} has been added. You can now generate flashcards.`
      );
    } catch (error) {
      Alert.alert("Upload Error", "Something went wrong while adding the file.");
    }
  };

  const handleRemoveFile = () => {
    Alert.alert("Remove File", "Do you want to remove the uploaded file?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setUploadedFile(null);
          setShowAnswer(false);
          setCurrentCard(0);
        },
      },
    ]);
  };

  const requireFileFirst = (title) => {
    if (!hasUploadedFile) {
      Alert.alert(
        "Add File First",
        "Please upload your notes, PDF, document, or PowerPoint file before making flashcards."
      );
      return false;
    }

    Alert.alert(title, "You can connect this feature to your backend later.");
    return true;
  };

  const handleNext = () => {
    if (!hasUploadedFile) {
      requireFileFirst("Next Card");
      return;
    }

    setShowAnswer(false);
    setCurrentCard((prev) => (prev === flashcards.length - 1 ? 0 : prev + 1));
  };

  const handlePrevious = () => {
    if (!hasUploadedFile) {
      requireFileFirst("Previous Card");
      return;
    }

    setShowAnswer(false);
    setCurrentCard((prev) => (prev === 0 ? flashcards.length - 1 : prev - 1));
  };

  if (themeMode === null) {
    return null;
  }

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
                {hasUploadedFile ? "Ready to Generate" : "Add File First"}
              </Text>
              <Text style={styles.overviewText}>
                {hasUploadedFile
                  ? `${uploadedFile.name} is uploaded`
                  : "Upload notes, PDF, DOCX, TXT, or PowerPoint file"}
              </Text>
            </View>

            <View
              style={[
                styles.overviewBadge,
                hasUploadedFile && styles.overviewBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.overviewBadgeText,
                  hasUploadedFile && styles.overviewBadgeTextActive,
                ]}
              >
                {hasUploadedFile ? "Ready" : "Required"}
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
                  ? "This file will be used to make your flashcards."
                  : "Add a file first before generating flashcards."}
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
          >
            <Feather name="plus-circle" size={20} color="#ffffff" />
            <Text style={styles.uploadButtonText}>
              {hasUploadedFile ? "Change File" : "Add File"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Practice Card</Text>
            <Text style={styles.cardCounter}>
              {hasUploadedFile
                ? `${currentCard + 1}/${flashcards.length}`
                : "Locked"}
            </Text>
          </View>

          {hasUploadedFile ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowAnswer((prev) => !prev)}
            >
              <LinearGradient
                colors={
                  showAnswer
                    ? theme.flashcardAnswerGradient
                    : theme.flashcardQuestionGradient
                }
                style={styles.flashcard}
              >
                <View style={styles.cardTop}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectBadgeText}>
                      {selectedCard.subject}
                    </Text>
                  </View>

                  <View style={styles.flipBadge}>
                    <Feather
                      name="repeat"
                      size={14}
                      color={theme.brighterSoftText}
                    />
                    <Text style={styles.flipText}>Tap to flip</Text>
                  </View>
                </View>

                <View style={styles.cardCenter}>
                  <Text style={styles.cardLabel}>
                    {showAnswer ? "Answer" : "Question"}
                  </Text>

                  <Text style={styles.cardMainText}>
                    {showAnswer ? selectedCard.answer : selectedCard.question}
                  </Text>
                </View>

                <View style={styles.cardBottom}>
                  <Text style={styles.cardHint}>
                    {showAnswer
                      ? "Check if you remembered it correctly."
                      : "Think of the answer before tapping."}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <LinearGradient
              colors={theme.flashcardQuestionGradient}
              style={styles.lockedCard}
            >
              <View style={styles.lockIcon}>
                <Feather name="lock" size={28} color="#ffffff" />
              </View>

              <Text style={styles.lockTitle}>Flashcards are locked</Text>
              <Text style={styles.lockText}>
                Please add your lesson file first. After uploading, you can
                generate and review flashcards.
              </Text>

              <TouchableOpacity
                style={styles.lockUploadButton}
                activeOpacity={0.85}
                onPress={handleUploadMaterial}
              >
                <Feather name="upload-cloud" size={19} color="#ffffff" />
                <Text style={styles.lockUploadText}>Add File Now</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}

          <View style={styles.cardControls}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                !hasUploadedFile && styles.disabledButton,
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
                !hasUploadedFile && styles.disabledPrimaryButton,
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
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => requireFileFirst("My Decks")}
            >
              <Text style={styles.viewText}>View All</Text>
            </TouchableOpacity>
          </View>

          {hasUploadedFile ? (
            decks.map((deck) => (
              <TouchableOpacity
                key={deck.id}
                style={styles.deckCard}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.deckIconBox,
                    { backgroundColor: `${deck.color}22` },
                  ]}
                >
                  <Feather name={deck.icon} size={22} color={deck.color} />
                </View>

                <View style={styles.deckContent}>
                  <Text style={styles.deckTitle}>{deck.title}</Text>

                  <View style={styles.deckMetaRow}>
                    <Text style={styles.deckMeta}>{deck.cards} cards</Text>
                    <View style={styles.dot} />
                    <Text style={styles.deckMeta}>
                      {deck.progress} complete
                    </Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: deck.progress,
                          backgroundColor: deck.color,
                        },
                      ]}
                    />
                  </View>
                </View>

                <Feather
                  name="chevron-right"
                  size={21}
                  color={theme.mutedText}
                />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyDeckCard}>
              <Feather name="folder" size={25} color={theme.mutedText} />
              <Text style={styles.emptyDeckTitle}>No decks yet</Text>
              <Text style={styles.emptyDeckText}>
                Your generated flashcard decks will appear here after uploading
                a file.
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

    cardCounter: {
      color: theme.primaryLight,
      fontSize: 12.5,
      fontWeight: "900",
      marginBottom: 10,
    },

    flashcard: {
      minHeight: 225,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      shadowColor: theme.primary,
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },

    lockedCard: {
      minHeight: 215,
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
      justifyContent: "space-between",
      alignItems: "center",
    },

    subjectBadge: {
      backgroundColor: theme.subjectTint,
      borderWidth: 1,
      borderColor: theme.subjectBorder,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 13,
    },

    subjectBadgeText: {
      color: theme.primaryLight,
      fontSize: 11.5,
      fontWeight: "900",
    },

    flipBadge: {
      flexDirection: "row",
      alignItems: "center",
    },

    flipText: {
      color: theme.brighterSoftText,
      fontSize: 11.5,
      fontWeight: "700",
      marginLeft: 5,
    },

    cardCenter: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 18,
    },

    cardLabel: {
      color: theme.mutedText,
      fontSize: 12.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 10,
    },

    cardMainText: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 28,
    },

    cardBottom: {
      borderTopWidth: 1,
      borderTopColor: theme.divider,
      paddingTop: 11,
    },

    cardHint: {
      color: theme.mutedText,
      fontSize: 12,
      textAlign: "center",
      lineHeight: 17,
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

    viewText: {
      color: theme.primaryLight,
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

    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.mutedText,
      marginHorizontal: 7,
    },

    progressTrack: {
      height: 6,
      backgroundColor: theme.progressTrack,
      borderRadius: 20,
      overflow: "hidden",
    },

    progressFill: {
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