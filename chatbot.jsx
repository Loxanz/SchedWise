import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DeviceEventEmitter,
  Image,
  Keyboard,
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

const REST_INPUT_BOTTOM_PADDING = Platform.OS === "ios" ? 100 : 30;
const DEFAULT_INPUT_BOTTOM_PADDING = Platform.OS === "ios" ? 100 : 85;
const CLOSED_INPUT_BOTTOM_PADDING = REST_INPUT_BOTTOM_PADDING;
const OPEN_INPUT_BOTTOM_PADDING = Platform.OS === "ios" ? 12 : 10;

const THEME_STORAGE_KEY = "schedwise_app_theme_mode";
const THEME_CHANGE_EVENT = "schedwise_theme_changed";

const DARK_THEME = {
  mode: "dark",
  background: "#081225",
  statusBarStyle: "light-content",
  headerGradient: ["#081225", "#0d2342", "#081225"],
  inputGradient: ["#0d2342", "#0a1830", "#101f3a"],
  text: "#ffffff",
  mutedText: "#8ea2c1",
  softText: "#b6c7e6",
  aiText: "#d7e4ff",
  placeholder: "#7f94ba",
  primary: "#4f7df3",
  primaryLight: "#65a1ff",
  card: "#0d1529",
  border: "#1b2944",
  borderSoft: "#13203a",
  inputBorder: "rgba(142, 162, 193, 0.22)",
  divider: "#31476c",
  iconMuted: "#b6c7e6",
  userBubble: "#4f7df3",
  aiBubble: "#0d1529",
  sendInactive: "#22395f",
  chipBackground: "#0d1529",
  inputAreaBackground: "#081225",
};

const LIGHT_THEME = {
  mode: "light",
  background: "#f4f7fb",
  statusBarStyle: "dark-content",
  headerGradient: ["#eaf2ff", "#f7fbff", "#f4f7fb"],
  inputGradient: ["#ffffff", "#f3f7ff", "#edf4ff"],
  text: "#10203b",
  mutedText: "#60718f",
  softText: "#4f607a",
  aiText: "#243654",
  placeholder: "#8a98ad",
  primary: "#4f7df3",
  primaryLight: "#3f76e8",
  card: "#ffffff",
  border: "#d9e4f2",
  borderSoft: "#dce6f3",
  inputBorder: "rgba(79,125,243,0.18)",
  divider: "#d0dced",
  iconMuted: "#60718f",
  userBubble: "#4f7df3",
  aiBubble: "#ffffff",
  sendInactive: "#b9c8df",
  chipBackground: "#ffffff",
  inputAreaBackground: "#f4f7fb",
};

const botImage = require("../../assets/images/SchedWise bot.png");

const quickPrompts = [
  "What is my schedule today?",
  "Help me plan my study time",
  "Remind me of my deadlines",
  "Create a review plan",
  "Organize my assignments",
  "Check my upcoming tasks",
  "Make a weekly study plan",
  "Help me prioritize tasks",
];

export default function ChatbotScreen() {
  const scrollRef = useRef(null);
  const keyboardWasOpenedRef = useRef(false);
  const hasInteractedRef = useRef(false);

  const [message, setMessage] = useState("");
  const [inputBottomPadding, setInputBottomPadding] = useState(
    DEFAULT_INPUT_BOTTOM_PADDING
  );

  const [themeMode, setThemeMode] = useState(null);

  const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "ai",
      text: "Hi! I'm your SchedWise AI Assistant. Ask me about your schedules, deadlines, study plans, or academic tasks.",
    },
    {
      id: 2,
      sender: "ai",
      text: 'Example: "Help me organize my assignments this week."',
    },
  ]);

  const loadThemeMode = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      setThemeMode(savedTheme === "light" ? "light" : "dark");
    } catch {
      setThemeMode("dark");
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();

      keyboardWasOpenedRef.current = false;

      if (!hasInteractedRef.current) {
        setInputBottomPadding(DEFAULT_INPUT_BOTTOM_PADDING);
      } else {
        setInputBottomPadding(CLOSED_INPUT_BOTTOM_PADDING);
      }

      return () => {};
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

  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const keyboardHideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(keyboardShowEvent, () => {
      hasInteractedRef.current = true;
      keyboardWasOpenedRef.current = true;
      setInputBottomPadding(OPEN_INPUT_BOTTOM_PADDING);
      scrollToBottom();
    });

    const keyboardHideListener = Keyboard.addListener(keyboardHideEvent, () => {
      keyboardWasOpenedRef.current = false;
      setInputBottomPadding(CLOSED_INPUT_BOTTOM_PADDING);

      setTimeout(() => {
        scrollToBottom();
      }, 150);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [scrollToBottom]);

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
    scrollToBottom();
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

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <LinearGradient colors={theme.headerGradient} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTextArea}>
              <Text style={styles.headerLabel}>AI Chatbot</Text>

              <Text
                style={styles.headerTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                SchedWise Assistant
              </Text>

              <Text style={styles.headerSubtitle}>
                Ask AI to manage your schedules, deadlines, and study plans.
              </Text>
            </View>

            <View style={styles.botIconWrapper}>
              <Image
                source={botImage}
                style={styles.botIconImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.chatWrapper}>
          <ScrollView
            ref={scrollRef}
            style={styles.messagesArea}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
                    <Image
                      source={botImage}
                      style={styles.smallBotImage}
                      resizeMode="contain"
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
          </ScrollView>

          <View
            style={[
              styles.inputArea,
              {
                paddingBottom: inputBottomPadding,
              },
            ]}
          >
            <View style={styles.quickPromptSection}>
              <Text style={styles.quickPromptTitle}>Quick Prompts</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickPromptHorizontal}
                keyboardShouldPersistTaps="handled"
              >
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
              </ScrollView>
            </View>

            <LinearGradient
              colors={theme.inputGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.chatInputBar}
            >
              <TouchableOpacity style={styles.plusButton} activeOpacity={0.75}>
                <Feather name="plus" size={24} color={theme.iconMuted} />
              </TouchableOpacity>

              <View style={styles.inputDivider} />

              <TextInput
                placeholder="Ask anything"
                placeholderTextColor={theme.placeholder}
                style={styles.chatInput}
                value={message}
                onChangeText={setMessage}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage()}
                onFocus={() => {
                  hasInteractedRef.current = true;
                  keyboardWasOpenedRef.current = true;
                  setInputBottomPadding(OPEN_INPUT_BOTTOM_PADDING);
                  scrollToBottom();
                }}
              />

              <TouchableOpacity style={styles.micButton} activeOpacity={0.75}>
                <Feather name="mic" size={22} color={theme.iconMuted} />
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
                <View style={styles.sendIconWrapper}>
                  <Feather
                    name="send"
                    size={21}
                    color="#ffffff"
                    style={styles.sendIcon}
                  />
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

    keyboardView: {
      flex: 1,
    },

    header: {
      paddingTop: TOP_SAFE_SPACE + 16,
      paddingHorizontal: 20,
      paddingBottom: 22,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },

    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    headerTextArea: {
      flex: 1,
      paddingRight: 10,
    },

    headerLabel: {
      color: theme.mutedText,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },

    headerTitle: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
      marginTop: 5,
      flexShrink: 1,
    },

    headerSubtitle: {
      color: theme.softText,
      fontSize: 13.5,
      lineHeight: 19,
      marginTop: 7,
      paddingRight: 4,
    },

    botIconWrapper: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
      overflow: "hidden",
    },

    botIconImage: {
      width: 40,
      height: 40,
    },

    chatWrapper: {
      flex: 1,
      backgroundColor: theme.background,
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
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
      overflow: "hidden",
    },

    smallBotImage: {
      width: 25,
      height: 25,
    },

    messageBubble: {
      maxWidth: "78%",
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 12,
    },

    aiBubble: {
      backgroundColor: theme.aiBubble,
      borderBottomLeftRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },

    userBubble: {
      backgroundColor: theme.userBubble,
      borderBottomRightRadius: 6,
    },

    messageText: {
      fontSize: 14,
      lineHeight: 20,
    },

    aiMessageText: {
      color: theme.aiText,
    },

    userMessageText: {
      color: "#ffffff",
      fontWeight: "600",
    },

    inputArea: {
      paddingHorizontal: 14,
      paddingTop: 10,
      backgroundColor: theme.inputAreaBackground,
      borderTopWidth: 1,
      borderTopColor: theme.borderSoft,
    },

    quickPromptSection: {
      marginBottom: 10,
    },

    quickPromptTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "900",
      marginBottom: 9,
    },

    quickPromptHorizontal: {
      paddingRight: 14,
    },

    promptChip: {
      backgroundColor: theme.chipBackground,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 10,
    },

    promptChipText: {
      color: theme.softText,
      fontSize: 13,
      fontWeight: "700",
    },

    chatInputBar: {
      minHeight: 64,
      borderRadius: 32,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 14,
      paddingRight: 8,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      shadowColor: theme.primary,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },

    plusButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },

    inputDivider: {
      width: 1,
      height: 30,
      backgroundColor: theme.divider,
      opacity: 0.8,
      marginLeft: 8,
      marginRight: 12,
    },

    chatInput: {
      flex: 1,
      color: theme.text,
      fontSize: 17,
      paddingVertical: 0,
      includeFontPadding: false,
    },

    micButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 2,
      marginRight: 4,
    },

    sendButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      overflow: "hidden",
    },

    sendIconWrapper: {
      width: 52,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
    },

    sendIcon: {
      textAlign: "center",
      textAlignVertical: "center",
      includeFontPadding: false,
      transform: [{ translateX: -1 }, { translateY: 1 }],
    },

    sendButtonActive: {
      backgroundColor: theme.primary,
    },

    sendButtonInactive: {
      backgroundColor: theme.sendInactive,
    },
  });