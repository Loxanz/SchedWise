import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
    Alert,
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
    answer:
      "A noun is a word that names a person, place, thing, or idea.",
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

  const selectedCard = flashcards[currentCard];

  const handleNext = () => {
    setShowAnswer(false);
    setCurrentCard((prev) =>
      prev === flashcards.length - 1 ? 0 : prev + 1
    );
  };

  const handlePrevious = () => {
    setShowAnswer(false);
    setCurrentCard((prev) =>
      prev === 0 ? flashcards.length - 1 : prev - 1
    );
  };

  const handleComingSoon = (title) => {
    Alert.alert(title, "You can connect this feature to your backend later.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#081225"
        translucent={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#081225", "#0d2342", "#081225"]}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTextArea}>
              <Text style={styles.headerLabel}>Flashcards</Text>
              <Text style={styles.headerTitle}>Study Reviewer</Text>
              <Text style={styles.headerSubtitle}>
                Review lessons, memorize key terms, and prepare for exams faster.
              </Text>
            </View>

            <View style={styles.headerIcon}>
              <Ionicons name="albums-outline" size={32} color="#ffffff" />
            </View>
          </View>

          <View style={styles.overviewCard}>
            <View style={styles.overviewIcon}>
              <MaterialCommunityIcons
                name="cards-outline"
                size={30}
                color="#ffffff"
              />
            </View>

            <View style={styles.overviewContent}>
              <Text style={styles.overviewTitle}>Today’s Review</Text>
              <Text style={styles.overviewText}>
                16 cards due • 8 mastered
              </Text>
            </View>

            <View style={styles.overviewBadge}>
              <Text style={styles.overviewBadgeText}>Active</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>57</Text>
            <Text style={styles.statLabel}>Total Cards</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>8</Text>
            <Text style={styles.statLabel}>Mastered</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>16</Text>
            <Text style={styles.statLabel}>Due Today</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Practice Card</Text>
            <Text style={styles.cardCounter}>
              {currentCard + 1}/{flashcards.length}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowAnswer((prev) => !prev)}
          >
            <LinearGradient
              colors={
                showAnswer
                  ? ["#14294d", "#0d2342", "#101f3a"]
                  : ["#0d1529", "#101f3a", "#0d1529"]
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
                  <Feather name="repeat" size={14} color="#b6c7e6" />
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

          <View style={styles.cardControls}>
            <TouchableOpacity
              style={styles.controlButton}
              activeOpacity={0.8}
              onPress={handlePrevious}
            >
              <Feather name="chevron-left" size={22} color="#ffffff" />
              <Text style={styles.controlButtonText}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryControlButton}
              activeOpacity={0.8}
              onPress={handleNext}
            >
              <Text style={styles.primaryControlText}>Next Card</Text>
              <Feather name="chevron-right" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Tools</Text>

          <View style={styles.toolsGrid}>
            <TouchableOpacity
              style={styles.toolCard}
              activeOpacity={0.8}
              onPress={() => handleComingSoon("Upload Material")}
            >
              <View style={styles.toolIconBlue}>
                <Feather name="upload-cloud" size={24} color="#ffffff" />
              </View>
              <Text style={styles.toolTitle}>Upload</Text>
              <Text style={styles.toolSub}>Import notes or files</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolCard}
              activeOpacity={0.8}
              onPress={() => handleComingSoon("AI Generate")}
            >
              <View style={styles.toolIconPurple}>
                <MaterialCommunityIcons
                  name="robot-outline"
                  size={25}
                  color="#ffffff"
                />
              </View>
              <Text style={styles.toolTitle}>AI Generate</Text>
              <Text style={styles.toolSub}>Create cards from notes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolCard}
              activeOpacity={0.8}
              onPress={() => handleComingSoon("Quiz Mode")}
            >
              <View style={styles.toolIconOrange}>
                <Feather name="help-circle" size={24} color="#ffffff" />
              </View>
              <Text style={styles.toolTitle}>Quiz Mode</Text>
              <Text style={styles.toolSub}>Test your memory</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolCard}
              activeOpacity={0.8}
              onPress={() => handleComingSoon("Review Plan")}
            >
              <View style={styles.toolIconGreen}>
                <Feather name="clock" size={24} color="#ffffff" />
              </View>
              <Text style={styles.toolTitle}>Review Plan</Text>
              <Text style={styles.toolSub}>Schedule study sessions</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Decks</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.viewText}>View All</Text>
            </TouchableOpacity>
          </View>

          {decks.map((deck) => (
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
                <Feather name={deck.icon} size={23} color={deck.color} />
              </View>

              <View style={styles.deckContent}>
                <Text style={styles.deckTitle}>{deck.title}</Text>

                <View style={styles.deckMetaRow}>
                  <Text style={styles.deckMeta}>{deck.cards} cards</Text>
                  <View style={styles.dot} />
                  <Text style={styles.deckMeta}>{deck.progress} complete</Text>
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

              <Feather name="chevron-right" size={22} color="#8ea2c1" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Review</Text>

          <View style={styles.recommendCard}>
            <View style={styles.recommendIcon}>
              <Feather name="zap" size={25} color="#ffffff" />
            </View>

            <View style={styles.recommendContent}>
              <Text style={styles.recommendTitle}>
                Review difficult cards first
              </Text>
              <Text style={styles.recommendText}>
                Start with cards you missed recently so you can improve recall
                before your exam.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081225",
  },

  scrollContent: {
    paddingBottom: 115,
  },

  header: {
    paddingTop: TOP_SAFE_SPACE + 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  headerTextArea: {
    flex: 1,
    paddingRight: 16,
  },

  headerLabel: {
    color: "#8ea2c1",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 5,
  },

  headerSubtitle: {
    color: "#91a5c6",
    fontSize: 13,
    marginTop: 7,
    lineHeight: 19,
  },

  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  overviewCard: {
    marginTop: 26,
    backgroundColor: "rgba(101,161,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(101,161,255,0.25)",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  overviewIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#6d5dfc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  overviewContent: {
    flex: 1,
  },

  overviewTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  overviewText: {
    color: "#91a5c6",
    fontSize: 13,
    marginTop: 5,
  },

  overviewBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 13,
  },

  overviewBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 20,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#0d1529",
    borderWidth: 1,
    borderColor: "#1b2944",
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    marginHorizontal: 4,
  },

  statNumber: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },

  statLabel: {
    color: "#8ea2c1",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },

  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 14,
  },

  cardCounter: {
    color: "#65a1ff",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 14,
  },

  flashcard: {
    minHeight: 260,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(142, 162, 193, 0.22)",
    shadowColor: "#4f7df3",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  subjectBadge: {
    backgroundColor: "rgba(101,161,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(101,161,255,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },

  subjectBadgeText: {
    color: "#65a1ff",
    fontSize: 12,
    fontWeight: "900",
  },

  flipBadge: {
    flexDirection: "row",
    alignItems: "center",
  },

  flipText: {
    color: "#b6c7e6",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },

  cardCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },

  cardLabel: {
    color: "#8ea2c1",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },

  cardMainText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 31,
  },

  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: "rgba(142, 162, 193, 0.16)",
    paddingTop: 14,
  },

  cardHint: {
    color: "#8ea2c1",
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
  },

  cardControls: {
    flexDirection: "row",
    marginTop: 14,
  },

  controlButton: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#0d1529",
    borderWidth: 1,
    borderColor: "#1b2944",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  controlButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 4,
  },

  primaryControlButton: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#4f7df3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  primaryControlText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    marginRight: 4,
  },

  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  toolCard: {
    width: "48%",
    backgroundColor: "#0d1529",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1b2944",
    padding: 16,
    marginBottom: 13,
  },

  toolIconBlue: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  toolIconPurple: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#6d5dfc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  toolIconOrange: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  toolIconGreen: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  toolTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  toolSub: {
    color: "#8ea2c1",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },

  viewText: {
    color: "#65a1ff",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 14,
  },

  deckCard: {
    backgroundColor: "#0d1529",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1b2944",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  deckIconBox: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  deckContent: {
    flex: 1,
  },

  deckTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  deckMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    marginBottom: 10,
  },

  deckMeta: {
    color: "#8ea2c1",
    fontSize: 12,
    fontWeight: "700",
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#8ea2c1",
    marginHorizontal: 8,
  },

  progressTrack: {
    height: 7,
    backgroundColor: "#17233b",
    borderRadius: 20,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 20,
  },

  recommendCard: {
    backgroundColor: "#0d1529",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1b2944",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  recommendIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  recommendContent: {
    flex: 1,
  },

  recommendTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  recommendText: {
    color: "#8ea2c1",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 5,
  },

  bottomSpace: {
    height: 10,
  },
});