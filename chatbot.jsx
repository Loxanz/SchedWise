import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import {
    KeyboardAvoidingView,
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

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

const quickPrompts = [
  "What is my schedule today?",
  "Help me plan my study time",
  "Remind me of my deadlines",
  "Create a review plan",
];

export default function ChatbotScreen() {
  const scrollRef = useRef(null);
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "ai",
      text: "Hi! I’m your SchedWise AI Assistant. Ask me about your schedules, deadlines, study plans, or academic tasks.",
    },
    {
      id: 2,
      sender: "ai",
      text: "Example: “Help me organize my assignments this week.”",
    },
  ]);

  const sendMessage = (textToSend = message) => {
    const trimmedMessage = textToSend.trim();
    if (!trimmedMessage) return;

    const userMessage = {
      id: Date.now(),
      sender: "user",
      text: trimmedMessage,
    };

    const aiReply = {
      id: Date.now() + 1,
      sender: "ai",
      text: "Got it! I can help you organize that. You can connect this chatbot to your AI backend later.",
    };

    setMessages((prev) => [...prev, userMessage, aiReply]);
    setMessage("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#081225"
        translucent={false}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 60}
      >
        <LinearGradient
          colors={["#081225", "#0d2342", "#081225"]}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTextArea}>
              <Text style={styles.headerLabel}>AI Chatbot</Text>
              <Text style={styles.headerTitle}>SchedWise Assistant</Text>
              <Text style={styles.headerSubtitle}>
                Ask AI to manage your schedules, deadlines, and study plans.
              </Text>
            </View>

            <View style={styles.botIconWrapper}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={32}
                color="#ffffff"
              />
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Feather name="zap" size={22} color="#ffffff" />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>AI Assistant is ready</Text>
              <Text style={styles.statusText}>
                Type a question or choose a quick prompt below.
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.chatWrapper}>
          <ScrollView
            ref={scrollRef}
            style={styles.messagesArea}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            {messages.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.messageRow,
                  item.sender === "user"
                    ? styles.userMessageRow
                    : styles.aiMessageRow,
                ]}
              >
                {item.sender === "ai" && (
                  <View style={styles.smallBotIcon}>
                    <MaterialCommunityIcons
                      name="robot-outline"
                      size={18}
                      color="#ffffff"
                    />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    item.sender === "user"
                      ? styles.userBubble
                      : styles.aiBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      item.sender === "user"
                        ? styles.userMessageText
                        : styles.aiMessageText,
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.quickPromptSection}>
              <Text style={styles.quickPromptTitle}>Quick Prompts</Text>

              <View style={styles.quickPromptGrid}>
                {quickPrompts.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.promptChip}
                    activeOpacity={0.8}
                    onPress={() => sendMessage(prompt)}
                  >
                    <Text style={styles.promptChipText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.inputArea}>
            <LinearGradient
              colors={["#0d2342", "#0a1830", "#101f3a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.chatInputBar}
            >
              <TouchableOpacity style={styles.plusButton} activeOpacity={0.75}>
                <Feather name="plus" size={24} color="#b6c7e6" />
              </TouchableOpacity>

              <View style={styles.inputDivider} />

              <TextInput
                placeholder="Ask anything"
                placeholderTextColor="#7f94ba"
                style={styles.chatInput}
                value={message}
                onChangeText={setMessage}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage()}
              />

              <TouchableOpacity style={styles.micButton} activeOpacity={0.75}>
                <Feather name="mic" size={22} color="#b6c7e6" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  message.trim()
                    ? styles.sendButtonActive
                    : styles.sendButtonInactive,
                ]}
                activeOpacity={0.85}
                onPress={() => sendMessage()}
              >
                <Feather name="send" size={22} color="#ffffff" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081225",
  },

  keyboardView: {
    flex: 1,
  },

  header: {
    paddingTop: TOP_SAFE_SPACE + 18,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
    color: "#8ea2c1",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 6,
  },

  headerSubtitle: {
    color: "#b6c7e6",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },

  botIconWrapper: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#6d5dfc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  statusCard: {
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  statusIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#4f7df3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  statusText: {
    color: "#b6c7e6",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },

  chatWrapper: {
    flex: 1,
    backgroundColor: "#081225",
  },

  messagesArea: {
    flex: 1,
  },

  messagesContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
  },

  messageRow: {
    flexDirection: "row",
    marginBottom: 14,
    alignItems: "flex-end",
  },

  aiMessageRow: {
    justifyContent: "flex-start",
  },

  userMessageRow: {
    justifyContent: "flex-end",
  },

  smallBotIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#6d5dfc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  messageBubble: {
    maxWidth: "78%",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  aiBubble: {
    backgroundColor: "#0d1529",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#1b2944",
  },

  userBubble: {
    backgroundColor: "#4f7df3",
    borderBottomRightRadius: 6,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },

  aiMessageText: {
    color: "#d7e4ff",
  },

  userMessageText: {
    color: "#ffffff",
    fontWeight: "600",
  },

  quickPromptSection: {
    marginTop: 8,
  },

  quickPromptTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },

  quickPromptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  promptChip: {
    backgroundColor: "#0d1529",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#1b2944",
  },

  promptChipText: {
    color: "#b6c7e6",
    fontSize: 13,
    fontWeight: "700",
  },

  inputArea: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 90 : 72,
    backgroundColor: "#081225",
    borderTopWidth: 1,
    borderTopColor: "#13203a",
  },

  chatInputBar: {
    minHeight: 64,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: "rgba(142, 162, 193, 0.22)",
    shadowColor: "#4f7df3",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  plusButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  inputDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#31476c",
    opacity: 0.8,
    marginLeft: 8,
    marginRight: 12,
  },

  chatInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 17,
    paddingVertical: 0,
  },

  micButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },

  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonActive: {
    backgroundColor: "#4f7df3",
  },

  sendButtonInactive: {
    backgroundColor: "#22395f",
  },
});