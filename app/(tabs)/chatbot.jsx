import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  Image,
  Keyboard,
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
import * as DocumentPicker from "expo-document-picker";
import {
  isDeepgramConfigured,
  transcribeAudioWithDeepgram,
} from "../_lib/deepgramTranscription";
import {
  alertExpoAudioNativeModuleError,
  cleanupVoiceRecording,
  isExpoAudioNativeModuleError,
  isVoiceRecordingAvailable,
  startVoiceRecording,
  stopVoiceRecording,
} from "../_lib/voiceRecording";
import { FLASHCARD_UPLOAD_TYPES } from "../_lib/fileTextExtractor";
import {
  handleAddTaskChatAction,
  hasIncompleteAddTaskDraft,
  isAddTaskRequest,
} from "../_lib/scheduleAddTask";
import {
  handleScheduleChatAction,
  isScheduleModificationRequest,
  tryResolvePendingScheduleSelection,
} from "../_lib/scheduleChatActions";
import { isReminderIntentMessage } from "../_lib/scheduleReminderUtils";
import { sendChatToGroq } from "../_lib/groq";
import {
  handleImportDraftMessage,
  previewSchedulesFromFile,
} from "../_lib/scheduleImportService";
import {
  buildDateScheduleSummary,
  buildScheduleContextForAI,
  buildUpcomingWeekScheduleSummary,
  getRequestedScheduleDateKey,
  isNextWeekScheduleRequest,
  isTodayScheduleRequest,
  isTomorrowScheduleRequest,
  loadUserSchedules,
  NEXT_WEEK_SCHEDULE_PROMPT,
  SCHEDULE_CHANGE_EVENT,
  TODAY_SCHEDULE_PROMPT,
  TOMORROW_SCHEDULE_PROMPT,
} from "../_lib/scheduleSummary";
import { supabase } from "../_lib/supabase";

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

const TAB_BAR_INPUT_PADDING = Platform.OS === "ios" ? 100 : 85;
const KEYBOARD_OPEN_INPUT_PADDING = Platform.OS === "ios" ? 12 : 10;
const KEYBOARD_VISIBILITY_BUFFER = Platform.OS === "android" ? 24 : 12;

const getKeyboardInset = (event) => {
  const coordinates = event?.endCoordinates;

  if (!coordinates) {
    return 0;
  }

  const windowHeight = Dimensions.get("window").height;
  const insetFromScreenY = windowHeight - (coordinates.screenY || 0);
  const inset = Math.max(coordinates.height || 0, insetFromScreenY);

  return Math.max(0, inset + KEYBOARD_VISIBILITY_BUFFER);
};

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

const getInitialMessages = () => [
  {
    id: 1,
    sender: "ai",
    text:
      "Hi! I'm your SchedWise AI Assistant. Ask me about your schedules, deadlines, study plans, or academic tasks. Tap + to attach a schedule file, review the suggestion, then reply Yes to add it.",
  },
];

const quickPrompts = [
  TODAY_SCHEDULE_PROMPT,
  TOMORROW_SCHEDULE_PROMPT,
  NEXT_WEEK_SCHEDULE_PROMPT,
];

export default function ChatbotScreen() {
  const scrollRef = useRef(null);
  const hasInteractedRef = useRef(false);
  const schedulesRef = useRef([]);
  const pendingImportRef = useRef({ fileName: "", schedules: [] });
  const awaitingImportConfirmationRef = useRef(false);
  const pendingScheduleSelectionRef = useRef(null);
  const pendingAddTaskRef = useRef(null);

  const [message, setMessage] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Thinking...");
  const [keyboardInset, setKeyboardInset] = useState(0);

  const isKeyboardVisible = keyboardInset > 0;
  const inputBottomPadding = isKeyboardVisible
    ? KEYBOARD_OPEN_INPUT_PADDING
    : TAB_BAR_INPUT_PADDING;

  const [themeMode, setThemeMode] = useState("dark");

  const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [messages, setMessages] = useState(() => getInitialMessages());

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

  const refreshSchedules = useCallback(async () => {
    try {
      schedulesRef.current = await loadUserSchedules();
    } catch {
      schedulesRef.current = [];
    }
  }, []);

  const resetConversation = useCallback(() => {
    setMessages(getInitialMessages());
    setMessage("");
    setAttachedFile(null);
    setIsSending(false);
    setLoadingLabel("Thinking...");
    schedulesRef.current = [];
    pendingImportRef.current = { fileName: "", schedules: [] };
    awaitingImportConfirmationRef.current = false;
    pendingScheduleSelectionRef.current = null;
    pendingAddTaskRef.current = null;
    hasInteractedRef.current = false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadThemeMode();
      refreshSchedules();

      return () => {};
    }, [loadThemeMode, refreshSchedules])
  );

  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

  useEffect(() => {
    const themeSubscription = DeviceEventEmitter.addListener(
      THEME_CHANGE_EVENT,
      (nextTheme) => {
        setThemeMode(nextTheme === "light" ? "light" : "dark");
      }
    );

    const scheduleSubscription = DeviceEventEmitter.addListener(
      SCHEDULE_CHANGE_EVENT,
      () => {
        refreshSchedules();
      }
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        resetConversation();
      }
    });

    return () => {
      themeSubscription.remove();
      scheduleSubscription.remove();
      subscription?.unsubscribe();
    };
  }, [refreshSchedules, resetConversation]);

  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const keyboardHideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(
      keyboardShowEvent,
      (event) => {
        hasInteractedRef.current = true;
        setKeyboardInset(getKeyboardInset(event));
        scrollToBottom();
      }
    );

    const keyboardHideListener = Keyboard.addListener(keyboardHideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [scrollToBottom]);

  useEffect(() => {
    return () => {
      cleanupVoiceRecording().catch(() => {});
    };
  }, []);

  const handleVoiceInputPress = useCallback(async () => {
    if (isSending || isTranscribing) {
      return;
    }

    if (!isDeepgramConfigured()) {
      Alert.alert(
        "Deepgram Not Set Up",
        "Add EXPO_PUBLIC_DEEPGRAM_API_KEY to your .env file, then restart Expo."
      );
      return;
    }

    if (!isVoiceRecordingAvailable()) {
      alertExpoAudioNativeModuleError();
      return;
    }

    try {
      if (isRecording) {
        setIsRecording(false);
        setIsTranscribing(true);

        const recordingUri = await stopVoiceRecording();
        const transcript = await transcribeAudioWithDeepgram(recordingUri);

        setMessage((currentMessage) => {
          const current = currentMessage.trim();
          return current ? `${current} ${transcript}` : transcript;
        });
      } else {
        Keyboard.dismiss();
        hasInteractedRef.current = true;
        await startVoiceRecording();
        setIsRecording(true);
      }
    } catch (error) {
      setIsRecording(false);

      if (isExpoAudioNativeModuleError(error)) {
        alertExpoAudioNativeModuleError();
        return;
      }

      Alert.alert(
        "Voice Input Failed",
        error?.message || "Could not use voice input. Please try again."
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [isRecording, isSending, isTranscribing]);

  const handleAttachScheduleFile = useCallback(async () => {
    if (isSending) {
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: FLASHCARD_UPLOAD_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets?.[0];

      if (!file) {
        Alert.alert("Upload Failed", "No file was selected.");
        return;
      }

      setAttachedFile(file);
    } catch (error) {
      Alert.alert(
        "Upload Failed",
        error?.message || "Could not attach that file. Please try again."
      );
    }
  }, [isSending]);

  const processScheduleFileImport = useCallback(
    async (file, userNote = "") => {
      const trimmedNote = userNote.trim();
      const displayText = trimmedNote
        ? `${trimmedNote}\n\nAttached schedule file: ${file.name}`
        : `Attached schedule file: ${file.name}`;

      const userMessage = {
        id: Date.now(),
        sender: "user",
        text: displayText,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);
      setLoadingLabel("Reading schedule file...");
      scrollToBottom();

      try {
        const importResult = await previewSchedulesFromFile(file, {
          userNote: trimmedNote,
        });

        pendingImportRef.current = {
          fileName: importResult.fileName,
          schedules: importResult.schedules,
        };
        awaitingImportConfirmationRef.current = true;

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "ai",
            text: importResult.confirmationMessage,
          },
        ]);

        await refreshSchedules();
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "ai",
            text:
              error?.message ||
              "Sorry, I could not import schedules from that file. Please try again.",
          },
        ]);
      } finally {
        setIsSending(false);
        setLoadingLabel("Thinking...");
        scrollToBottom();
      }
    },
    [refreshSchedules, scrollToBottom]
  );

  const sendMessage = useCallback(
    async (textToSend = message) => {
      const trimmedMessage = textToSend.trim();
      const stagedFile = attachedFile;

      if (isSending) {
        return;
      }

      if (!trimmedMessage && !stagedFile) {
        return;
      }

      if (awaitingImportConfirmationRef.current) {
        if (!trimmedMessage) {
          return;
        }
        const userMessage = {
          id: Date.now(),
          sender: "user",
          text: trimmedMessage,
        };

        setMessages((prev) => [...prev, userMessage]);
        setMessage("");
        setIsSending(true);
        setLoadingLabel("Updating schedule suggestion...");
        scrollToBottom();

        try {
          const draftResult = await handleImportDraftMessage({
            message: trimmedMessage,
            fileName: pendingImportRef.current.fileName,
            schedules: pendingImportRef.current.schedules,
          });

          if (draftResult.status === "confirmed" || draftResult.status === "cancelled") {
            awaitingImportConfirmationRef.current = false;
            pendingImportRef.current = { fileName: "", schedules: [] };
          } else if (draftResult.status === "updated") {
            pendingImportRef.current = {
              fileName: pendingImportRef.current.fileName,
              schedules: draftResult.schedules,
            };
          }

          if (draftResult.status === "confirmed") {
            await refreshSchedules();
            DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);
          }

          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: "ai",
              text: draftResult.reply,
            },
          ]);
        } catch (error) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: "ai",
              text:
                error?.message ||
                "Sorry, something went wrong while updating the imported schedule.",
            },
          ]);
        } finally {
          setIsSending(false);
          scrollToBottom();
        }

        return;
      }

      if (stagedFile) {
        setMessage("");
        setAttachedFile(null);
        await processScheduleFileImport(stagedFile, trimmedMessage);
        return;
      }

      const userMessage = {
        id: Date.now(),
        sender: "user",
        text: trimmedMessage,
      };

      setMessages((prev) => [...prev, userMessage]);
      setMessage("");
      setIsSending(true);

      const isModificationRequest = isScheduleModificationRequest(trimmedMessage);
      const isReminderUpdateRequest = isReminderIntentMessage(trimmedMessage);
      const isWeekScheduleRequest = isNextWeekScheduleRequest(trimmedMessage);
      const isScheduleQuery =
        isWeekScheduleRequest ||
        isTodayScheduleRequest(trimmedMessage) ||
        isTomorrowScheduleRequest(trimmedMessage) ||
        Boolean(getRequestedScheduleDateKey(trimmedMessage));
      const isExplicitAddTask = isAddTaskRequest(trimmedMessage);

      if ((isScheduleQuery || isReminderUpdateRequest) && !isExplicitAddTask) {
        pendingAddTaskRef.current = null;
      }

      const isAddTaskMessage =
        !isReminderUpdateRequest &&
        (isExplicitAddTask ||
          hasIncompleteAddTaskDraft(pendingAddTaskRef.current));
      const requestedDateKey = isModificationRequest
        ? null
        : isWeekScheduleRequest
        ? null
        : isAddTaskMessage
        ? null
        : getRequestedScheduleDateKey(trimmedMessage);

      setLoadingLabel(
        isAddTaskMessage
          ? "Checking conflicts..."
          : isModificationRequest || isReminderUpdateRequest
          ? "Updating your schedule..."
          : isWeekScheduleRequest || requestedDateKey
          ? "Loading your schedule..."
          : "Checking your schedule..."
      );
      scrollToBottom();

      try {
        const liveSchedules = await loadUserSchedules();
        schedulesRef.current = liveSchedules;

        if (pendingScheduleSelectionRef.current) {
          const selectionResult = await tryResolvePendingScheduleSelection(
            trimmedMessage,
            liveSchedules,
            pendingScheduleSelectionRef.current
          );

          if (selectionResult.handled) {
            if (selectionResult.pendingSelection === null) {
              pendingScheduleSelectionRef.current = null;
            } else if (selectionResult.pendingSelection) {
              pendingScheduleSelectionRef.current =
                selectionResult.pendingSelection;
            }

            if (selectionResult.updated) {
              await refreshSchedules();
              DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);
            }

            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                sender: "ai",
                text: selectionResult.reply,
              },
            ]);
            return;
          }

          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: "ai",
              text:
                "Please reply with the number from the list (for example, 1 or 2).",
            },
          ]);
          return;
        }

        if (isModificationRequest || isReminderUpdateRequest) {
          const actionResult = await handleScheduleChatAction(
            trimmedMessage,
            liveSchedules
          );

          if (actionResult.handled) {
            if (actionResult.pendingSelection) {
              pendingScheduleSelectionRef.current = actionResult.pendingSelection;
            } else if (actionResult.updated) {
              pendingScheduleSelectionRef.current = null;
            }

            if (actionResult.updated) {
              await refreshSchedules();
              DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);
            }

            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                sender: "ai",
                text: actionResult.reply,
              },
            ]);
            return;
          }
        }

        if (isAddTaskMessage) {
          const addTaskResult = await handleAddTaskChatAction(
            trimmedMessage,
            pendingAddTaskRef.current
          );

          if (addTaskResult.handled) {
            if (addTaskResult.pendingAdd) {
              pendingAddTaskRef.current = addTaskResult.pendingAdd;
            } else {
              pendingAddTaskRef.current = null;
            }

            if (addTaskResult.updated) {
              await refreshSchedules();
            }

            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                sender: "ai",
                text: addTaskResult.reply,
              },
            ]);
            return;
          }
        }

        const scheduleContext = buildScheduleContextForAI(liveSchedules);

        const replyText = isWeekScheduleRequest
          ? await buildUpcomingWeekScheduleSummary(liveSchedules)
          : requestedDateKey
          ? await buildDateScheduleSummary(liveSchedules, requestedDateKey)
          : await sendChatToGroq(
              [...messages, userMessage]
                .filter((item) => item.sender === "user" || item.sender === "ai")
                .map((item) => ({
                  role: item.sender === "user" ? "user" : "assistant",
                  content: item.text,
                })),
              { scheduleContext }
            );

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "ai",
            text: replyText,
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "ai",
            text:
              error?.message ||
              "Sorry, something went wrong while contacting the AI. Please try again.",
          },
        ]);
      } finally {
        setIsSending(false);
        scrollToBottom();
      }
    },
    [message, messages, isSending, attachedFile, scrollToBottom, refreshSchedules, processScheduleFileImport]
  );
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.background}
        translucent={false}
      />

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

            {isSending && (
              <View style={[styles.messageRow, styles.aiMessageRow]}>
                <View style={styles.smallBotIcon}>
                  <Image
                    source={botImage}
                    style={styles.smallBotImage}
                    resizeMode="contain"
                  />
                </View>

                <View style={[styles.messageBubble, styles.aiBubble]}>
                  <View style={styles.typingRow}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={styles.typingText}>{loadingLabel}</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View
            style={[
              styles.inputArea,
              {
                paddingBottom: inputBottomPadding,
                marginBottom: keyboardInset,
              },
            ]}
          >
            {!isKeyboardVisible && (
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
            )}

            <LinearGradient
              colors={theme.inputGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.chatInputBar}
            >
              {attachedFile && (
                <View style={styles.attachmentPreview}>
                  <Feather name="paperclip" size={16} color={theme.primary} />
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {attachedFile.name}
                  </Text>
                  <TouchableOpacity
                    style={styles.attachmentRemoveButton}
                    activeOpacity={0.75}
                    disabled={isSending}
                    onPress={() => setAttachedFile(null)}
                  >
                    <Feather name="x" size={18} color={theme.mutedText} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.chatInputRow}>
              <TouchableOpacity
                style={styles.plusButton}
                activeOpacity={0.75}
                disabled={isSending}
                onPress={handleAttachScheduleFile}
              >
                <Feather name="plus" size={24} color={theme.iconMuted} />
              </TouchableOpacity>

              <View style={styles.inputDivider} />

              <TextInput
                placeholder={
                  isRecording
                    ? "Listening..."
                    : isTranscribing
                    ? "Transcribing..."
                    : "Ask anything"
                }
                placeholderTextColor={theme.placeholder}
                style={styles.chatInput}
                value={message}
                onChangeText={setMessage}
                editable={!isTranscribing && !isRecording}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage()}
                onFocus={() => {
                  hasInteractedRef.current = true;
                  scrollToBottom();
                }}
              />

              <TouchableOpacity
                style={[
                  styles.micButton,
                  isRecording && styles.micButtonRecording,
                  isTranscribing && styles.micButtonDisabled,
                ]}
                activeOpacity={0.75}
                disabled={isTranscribing || (isSending && !isRecording)}
                onPress={handleVoiceInputPress}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color={theme.primaryLight} />
                ) : (
                  <Feather
                    name={isRecording ? "square" : "mic"}
                    size={isRecording ? 18 : 22}
                    color={isRecording ? "#ffffff" : theme.iconMuted}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (message.trim() || attachedFile) && !isSending && !isTranscribing
                    ? styles.sendButtonActive
                    : styles.sendButtonInactive,
                ]}
                activeOpacity={0.85}
                disabled={
                  isSending ||
                  isTranscribing ||
                  isRecording ||
                  (!message.trim() && !attachedFile)
                }
                onPress={() => sendMessage()}
              >
                <View style={styles.sendIconWrapper}>
                  {isSending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Feather
                      name="send"
                      size={21}
                      color="#ffffff"
                      style={styles.sendIcon}
                    />
                  )}
                </View>
              </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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

    typingRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    typingText: {
      color: theme.mutedText,
      fontSize: 14,
      fontStyle: "italic",
      marginLeft: 8,
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
      flexDirection: "column",
      paddingTop: 8,
      paddingBottom: 8,
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

    attachmentPreview: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      marginBottom: 8,
      marginRight: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor:
        theme.mode === "light" ? "rgba(79,125,243,0.08)" : "rgba(79,125,243,0.14)",
      gap: 8,
    },

    attachmentName: {
      flex: 1,
      color: theme.softText,
      fontSize: 14,
      fontWeight: "600",
    },

    attachmentRemoveButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },

    chatInputRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
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

    micButtonRecording: {
      backgroundColor: "#ef4444",
    },

    micButtonDisabled: {
      opacity: 0.7,
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