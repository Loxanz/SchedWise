import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  deleteLocalSchedule,
  getLocalSchedules,
  isLocalOnlySchedule,
  replaceLocalSchedules,
} from "../_lib/localSchedules";
import { removeSchedulePhoneCalendar } from "../_lib/phoneCalendarSync";
import {
  deleteProfilePicture,
  loadProfilePictureUrl,
  uploadProfilePicture,
} from "../_lib/profilePictureStorage";
import {
  cancelMissedTaskNotification,
  cancelScheduleReminder,
} from "../_lib/scheduleReminders";
import { partitionSchedulesByStatus } from "../_lib/scheduleStatus";
import { deleteUserSchedule, getUserSchedules, supabase } from "../_lib/supabase";
import { useAppTheme } from "../_lib/theme";

const TOP_SAFE_SPACE =
  Platform.OS === "android" ? StatusBar.currentHeight || 24 : 12;

const SCHEDULE_CHANGE_EVENT = "schedwise_schedules_changed";

const DARK_THEME = {
  mode: "dark",
  background: "#081225",
  statusBarStyle: "light-content",
  headerGradient: ["#081225", "#0d2342", "#081225"],
  avatarGradient: ["#4f7df3", "#65a1ff", "#78b7ff"],
  saveGradient: ["#4f7df3", "#5f8fff", "#78b7ff"],
  text: "#ffffff",
  mutedText: "#8ea2c1",
  softText: "#7384a3",
  primary: "#65a1ff",
  success: "#22c55e",
  warning: "#ffcc66",
  danger: "#ff4d5f",
  card: "#0d1529",
  cardSoft: "#121c32",
  cardDeep: "#0a1121",
  border: "#1b2944",
  borderSoft: "#21304c",
  borderMid: "#233350",
  mutedIcon: "#6f819f",
  overlay: "rgba(0,0,0,0.68)",
  switchTrackOff: "#263552",
  switchTrackOn: "#345fa8",
  switchThumbOff: "#8ea2c1",
};

const LIGHT_THEME = {
  mode: "light",
  background: "#f4f7fb",
  statusBarStyle: "dark-content",
  headerGradient: ["#eaf2ff", "#f7fbff", "#f4f7fb"],
  avatarGradient: ["#4f7df3", "#65a1ff", "#78b7ff"],
  saveGradient: ["#4f7df3", "#5f8fff", "#78b7ff"],
  text: "#10203b",
  mutedText: "#60718f",
  softText: "#7b89a3",
  primary: "#3f76e8",
  success: "#16a34a",
  warning: "#d99519",
  danger: "#ff4d5f",
  card: "#ffffff",
  cardSoft: "#eef4ff",
  cardDeep: "#e8eef7",
  border: "#d9e4f2",
  borderSoft: "#ccd8ea",
  borderMid: "#c5d3e8",
  mutedIcon: "#7082a0",
  overlay: "rgba(7,16,34,0.48)",
  switchTrackOff: "#d7e0ec",
  switchTrackOn: "#9fc0ff",
  switchThumbOff: "#ffffff",
};

const PROFILE_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getProfileScheduleDateText = (dateText) => {
  const [yearText, monthText, dayText] = String(dateText || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return "No date";
  }

  return `${PROFILE_MONTH_NAMES[month - 1] || "Date"} ${String(day).padStart(
    2,
    "0"
  )}, ${year}`;
};

const getProfileSubtaskProgressText = (schedule) => {
  const subtasks = Array.isArray(schedule?.subtasks) ? schedule.subtasks : [];

  if (subtasks.length === 0) {
    return "No subtasks added";
  }

  const completedSubtasks = subtasks.filter((subtask) =>
    Boolean(subtask?.completed)
  ).length;

  return `${completedSubtasks}/${subtasks.length} subtasks completed`;
};

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [profileImageUri, setProfileImageUri] = useState(null);
  const [schedules, setSchedules] = useState([]);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false);
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);
  const [taskListModalVisible, setTaskListModalVisible] = useState(false);
  const [taskListType, setTaskListType] = useState("pending");

  const [editName, setEditName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [scheduleReminders, setScheduleReminders] = useState(true);
  const [missedAlerts, setMissedAlerts] = useState(true);

  const { themeMode, setThemeMode: setAppThemeMode } = useAppTheme();

  const isDarkMode = themeMode !== "light";
  const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const loadProfileImage = useCallback(async (currentUser) => {
    if (!currentUser?.id) {
      setProfileImageUri(null);
      return;
    }

    try {
      const remoteImageUrl = await loadProfilePictureUrl(currentUser.id);
      setProfileImageUri(remoteImageUrl || null);
    } catch (error) {
      console.log("Profile image load error:", error?.message);
      setProfileImageUri(null);
    }
  }, []);

  const handleThemeChange = async (value) => {
    const nextTheme = value ? "dark" : "light";

    try {
      await setAppThemeMode(nextTheme);
    } catch {
      Alert.alert("Theme Error", "Unable to save your app theme preference.");
    }
  };

  const loadUser = useCallback(async () => {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !currentUser) {
      setUser(null);
      setProfileImageUri(null);
      setSchedules([]);
      return;
    }

    setUser(currentUser);
    await loadProfileImage(currentUser);
  }, [loadProfileImage]);

  const loadTaskOverview = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setSchedules([]);
        await replaceLocalSchedules([]);
        return;
      }

      const { data, error } = await getUserSchedules();

      if (error) {
        console.log("Profile task overview Supabase error:", error?.message);

        const localSchedules = await getLocalSchedules();
        setSchedules(localSchedules);
        return;
      }

      const remoteSchedules = Array.isArray(data) ? data : [];

      await replaceLocalSchedules(remoteSchedules);
      setSchedules(remoteSchedules);
    } catch (error) {
      console.log("Profile task overview load error:", error?.message);

      try {
        const localSchedules = await getLocalSchedules();
        setSchedules(localSchedules);
      } catch {
        setSchedules([]);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadTaskOverview();
    }, [loadUser, loadTaskOverview])
  );

  useEffect(() => {
    const scheduleSubscription = DeviceEventEmitter.addListener(
      SCHEDULE_CHANGE_EVENT,
      () => {
        loadTaskOverview();
      }
    );

    return () => {
      scheduleSubscription.remove();
    };
  }, [loadTaskOverview]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;

      setUser(currentUser);

      if (currentUser) {
        await loadProfileImage(currentUser);
        await loadTaskOverview();
      } else {
        setProfileImageUri(null);
        setSchedules([]);
        await replaceLocalSchedules([]);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadTaskOverview]);

  const fullName = user?.user_metadata?.full_name || "SchedWise User";
  const email = user?.email || "No email found";

  const initials = useMemo(() => {
    const words = fullName.trim().split(" ").filter(Boolean);

    if (words.length === 0) return "S";
    if (words.length === 1) return words[0].charAt(0).toUpperCase();

    return `${words[0].charAt(0)}${words[words.length - 1].charAt(
      0
    )}`.toUpperCase();
  }, [fullName]);

  const { completed: completedTaskItems, pending: pendingTaskItems, missed: missedTaskItems } =
    useMemo(() => partitionSchedulesByStatus(schedules), [schedules]);

  const completedTasks = completedTaskItems.length;
  const pendingTasks = pendingTaskItems.length;
  const missedTasks = missedTaskItems.length;

  const taskListItems =
    taskListType === "completed"
      ? completedTaskItems
      : taskListType === "missed"
      ? missedTaskItems
      : pendingTaskItems;

  const taskListTitle =
    taskListType === "completed"
      ? "Completed Tasks"
      : taskListType === "missed"
      ? "Missed Tasks"
      : "Pending Tasks";

  const taskListSubtitle =
    taskListType === "completed"
      ? "Schedules that are already completed."
      : taskListType === "missed"
      ? "Schedules that passed their date without being completed."
      : "Schedules that are still pending.";

  const openTaskOverviewList = (type) => {
    setTaskListType(
      type === "completed" ? "completed" : type === "missed" ? "missed" : "pending"
    );
    setTaskListModalVisible(true);
  };

  const handleClearTaskList = useCallback(() => {
    if (taskListItems.length === 0 || taskListType === "pending") {
      return;
    }

    const label = taskListType === "completed" ? "completed" : "missed";
    const itemsToClear = [...taskListItems];
    const idsToClear = itemsToClear.map((item) => String(item.id));

    Alert.alert(
      `Clear ${taskListTitle}?`,
      `This will permanently remove all ${label} tasks (${itemsToClear.length}). This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            // Update UI immediately, then clean up in the background.
            setSchedules((current) =>
              current.filter(
                (schedule) => !idsToClear.includes(String(schedule.id))
              )
            );
            DeviceEventEmitter.emit(SCHEDULE_CHANGE_EVENT);
            setTaskListModalVisible(false);

            (async () => {
              for (const schedule of itemsToClear) {
                const scheduleId = schedule?.id;

                if (!scheduleId) {
                  continue;
                }

                try {
                  await cancelScheduleReminder(scheduleId);
                  await cancelMissedTaskNotification(scheduleId);
                } catch {
                  // Continue clearing even if notification cleanup fails.
                }

                try {
                  await removeSchedulePhoneCalendar(schedule);
                } catch {
                  // Continue clearing even if phone calendar cleanup fails.
                }

                if (!isLocalOnlySchedule(schedule)) {
                  const { error } = await deleteUserSchedule(scheduleId);

                  if (error) {
                    console.log(
                      "Clear task list Supabase delete error:",
                      error?.message
                    );
                  }
                }

                try {
                  await deleteLocalSchedule(scheduleId);
                } catch (error) {
                  console.log(
                    "Clear task list local delete error:",
                    error?.message
                  );
                }
              }
            })();
          },
        },
      ]
    );
  }, [taskListItems, taskListTitle, taskListType]);

  const closeProfileModal = useCallback(() => {
    setSavingProfile(false);
    setProfileModalVisible(false);
  }, []);

  const openProfileSettings = () => {
    setSavingProfile(false);
    setEditName(fullName === "SchedWise User" ? "" : fullName);
    setProfileModalVisible(true);
  };

  const handlePickProfileImage = async () => {
    if (!user?.id) {
      Alert.alert("Account Required", "Please sign in before adding a photo.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo access to choose a profile picture."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.45,
    });

    if (result.canceled) return;

    const selectedAsset = result.assets?.[0];

    if (!selectedAsset?.uri) {
      Alert.alert("Upload Failed", "The selected image could not be saved.");
      return;
    }

    try {
      setUploadingImage(true);

      const uploadedImageUrl = await uploadProfilePicture({
        userId: user.id,
        fileUri: selectedAsset.uri,
      });

      setProfileImageUri(uploadedImageUrl);

      Alert.alert(
        "Profile Picture Updated",
        "Your photo is saved to your account and will appear on any device you sign in with."
      );
    } catch (error) {
      Alert.alert(
        "Upload Failed",
        error?.message || "Something went wrong while saving your photo."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveProfileImage = async () => {
    if (!user?.id) return;

    Alert.alert("Remove Photo", "Remove your current profile picture?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setUploadingImage(true);
            await deleteProfilePicture(user.id);
            setProfileImageUri(null);
          } catch (error) {
            Alert.alert(
              "Remove Failed",
              error?.message || "Unable to remove profile picture."
            );
          } finally {
            setUploadingImage(false);
          }
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (uploadingImage) {
      return;
    }

    const cleanedName = editName.trim();

    if (!cleanedName) {
      Alert.alert("Missing Name", "Please enter your full name.");
      return;
    }

    const savedName = String(user?.user_metadata?.full_name || "").trim();
    const nameUnchanged = Boolean(savedName) && cleanedName === savedName;

    if (nameUnchanged) {
      closeProfileModal();
      return;
    }

    setSavingProfile(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const updatePromise = supabase.auth.updateUser({
        data: {
          full_name: cleanedName,
        },
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "Saving your profile took too long. Check your internet connection and try again."
            )
          );
        }, 15000);
      });

      const { data, error } = await Promise.race([
        updatePromise,
        timeoutPromise,
      ]);

      if (error) {
        throw error;
      }

      if (data?.user) {
        setUser(data.user);
      }

      closeProfileModal();
      Alert.alert(
        "Profile Updated",
        "Your profile information has been updated."
      );
    } catch (error) {
      Alert.alert(
        "Update Failed",
        error?.message || "Something went wrong while saving your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setUser(null);
          setProfileImageUri(null);
          setSchedules([]);
          await replaceLocalSchedules([]);

          const { error } = await supabase.auth.signOut();

          if (error) {
            Alert.alert("Sign Out Failed", error.message);
            return;
          }

          router.replace("/signin");
        },
      },
    ]);
  };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.background}
        translucent={false}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient colors={theme.headerGradient} style={styles.header}>
          <View style={styles.profileRow}>
            <View style={styles.avatarGlow}>
              <LinearGradient
                colors={theme.avatarGradient}
                style={styles.avatar}
              >
                {profileImageUri ? (
                  <Image
                    source={{ uri: profileImageUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </LinearGradient>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileLabel}>Profile</Text>

              <Text style={styles.greeting} numberOfLines={1}>
                {fullName}
              </Text>

              <Text style={styles.emailText} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionTitle}>Tasks Overview</Text>
              <Text style={styles.sectionSubtitle}>
                Tap a card to view your task list.
              </Text>
            </View>
          </View>

          <View style={styles.overviewRow}>
            <TouchableOpacity
              style={styles.overviewCard}
              activeOpacity={0.82}
              onPress={() => openTaskOverviewList("completed")}
            >
              <View style={styles.overviewTopRow}>
                <View style={styles.overviewIconCircle}>
                  <Feather
                    name="check-circle"
                    size={20}
                    color={theme.success}
                  />
                </View>

                <Feather
                  name="chevron-right"
                  size={18}
                  color={theme.mutedIcon}
                />
              </View>

              <Text style={styles.overviewNumber}>{completedTasks}</Text>
              <Text style={styles.overviewLabel}>Completed</Text>
              <Text style={styles.overviewHint}>View completed list</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overviewCard}
              activeOpacity={0.82}
              onPress={() => openTaskOverviewList("pending")}
            >
              <View style={styles.overviewTopRow}>
                <View style={styles.overviewIconCircle}>
                  <Feather name="clock" size={20} color={theme.warning} />
                </View>

                <Feather
                  name="chevron-right"
                  size={18}
                  color={theme.mutedIcon}
                />
              </View>

              <Text style={styles.overviewNumber}>{pendingTasks}</Text>
              <Text style={styles.overviewLabel}>Pending</Text>
              <Text style={styles.overviewHint}>View pending list</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overviewCard}
              activeOpacity={0.82}
              onPress={() => openTaskOverviewList("missed")}
            >
              <View style={styles.overviewTopRow}>
                <View style={styles.overviewIconCircle}>
                  <Feather name="alert-circle" size={20} color={theme.danger} />
                </View>

                <Feather
                  name="chevron-right"
                  size={18}
                  color={theme.mutedIcon}
                />
              </View>

              <Text style={styles.overviewNumber}>{missedTasks}</Text>
              <Text style={styles.overviewLabel}>Missed</Text>
              <Text style={styles.overviewHint}>View missed list</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.accountCard}>
            <Text style={styles.accountTitle}>Account</Text>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.75}
              onPress={openProfileSettings}
            >
              <View style={styles.menuIconBox}>
                <Feather name="user" size={18} color={theme.primary} />
              </View>

              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>Profile Information</Text>
                <Text style={styles.menuSubtitle}>
                  Edit your name and profile picture
                </Text>
              </View>

              <Feather
                name="chevron-right"
                size={20}
                color={theme.mutedIcon}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.75}
              onPress={() => setNotificationModalVisible(true)}
            >
              <View style={styles.menuIconBox}>
                <Feather name="bell" size={18} color={theme.primary} />
              </View>

              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>Notifications</Text>
                <Text style={styles.menuSubtitle}>
                  Manage schedule and deadline reminders
                </Text>
              </View>

              <Feather
                name="chevron-right"
                size={20}
                color={theme.mutedIcon}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.75}
              onPress={() => setPreferencesModalVisible(true)}
            >
              <View style={styles.menuIconBox}>
                <Feather name="settings" size={18} color={theme.primary} />
              </View>

              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>App Preferences</Text>
                <Text style={styles.menuSubtitle}>Customize app theme</Text>
              </View>

              <Feather
                name="chevron-right"
                size={20}
                color={theme.mutedIcon}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.signOutButton}
            activeOpacity={0.85}
            onPress={handleSignOut}
          >
            <Feather name="log-out" size={18} color="#ffffff" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={taskListModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.taskListModalCard]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.taskListHeaderTextBox}>
                <Text style={styles.modalTitle}>{taskListTitle}</Text>
                <Text style={styles.taskListSubtitle}>{taskListSubtitle}</Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setTaskListModalVisible(false)}
                activeOpacity={0.75}
              >
                <Feather name="x" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            {taskListItems.length > 0 && taskListType !== "pending" ? (
              <TouchableOpacity
                style={styles.clearTaskListButton}
                activeOpacity={0.85}
                onPress={handleClearTaskList}
              >
                <Feather name="trash-2" size={16} color="#ffffff" />
                <Text style={styles.clearTaskListButtonText}>
                  {`Clear all ${
                    taskListType === "completed" ? "completed" : "missed"
                  }`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {taskListItems.length > 0 ? (
              <ScrollView
                style={styles.taskListScroll}
                contentContainerStyle={styles.taskListContentContainer}
                showsVerticalScrollIndicator={false}
              >
                {taskListItems.map((schedule, index) => {
                  const isCompleted = Boolean(schedule?.completed);
                  const isMissed = taskListType === "missed";

                  return (
                    <View
                      key={`${String(schedule.id)}-${index}`}
                      style={styles.taskListItem}
                    >
                      <View
                        style={[
                          styles.taskListStatusIcon,
                          isCompleted
                            ? styles.taskListCompletedIcon
                            : isMissed
                            ? styles.taskListMissedIcon
                            : styles.taskListPendingIcon,
                        ]}
                      >
                        <Feather
                          name={
                            isCompleted
                              ? "check"
                              : isMissed
                              ? "alert-circle"
                              : "clock"
                          }
                          size={16}
                          color="#ffffff"
                        />
                      </View>

                      <View style={styles.taskListTextBox}>
                        <View style={styles.taskListTitleRow}>
                          <Text
                            style={styles.taskListItemTitle}
                            numberOfLines={2}
                          >
                            {schedule.title || "Untitled Schedule"}
                          </Text>

                          <View
                            style={[
                              styles.taskListStatusBadge,
                              isCompleted
                                ? styles.taskListCompletedBadge
                                : isMissed
                                ? styles.taskListMissedBadge
                                : styles.taskListPendingBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.taskListStatusText,
                                isCompleted
                                  ? styles.taskListCompletedText
                                  : isMissed
                                  ? styles.taskListMissedText
                                  : styles.taskListPendingText,
                              ]}
                            >
                              {isCompleted
                                ? "Done"
                                : isMissed
                                ? "Missed"
                                : "Pending"}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.taskMetaGroup}>
                          <View style={styles.taskListMetaRow}>
                            <Feather
                              name="calendar"
                              size={13}
                              color={theme.mutedText}
                            />
                            <Text
                              style={styles.taskListMetaText}
                              numberOfLines={1}
                            >
                              {getProfileScheduleDateText(schedule.date)}
                            </Text>
                          </View>

                          <View style={styles.taskListMetaRow}>
                            <Feather
                              name="clock"
                              size={13}
                              color={theme.mutedText}
                            />
                            <Text
                              style={styles.taskListMetaText}
                              numberOfLines={1}
                            >
                              {schedule.timeOnly || "No time"}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={styles.taskListSubtaskText}
                          numberOfLines={2}
                        >
                          {getProfileSubtaskProgressText(schedule)}
                        </Text>

                        {isCompleted && schedule.proofUri ? (
                          <View style={styles.proofPill}>
                            <Feather
                              name="image"
                              size={12}
                              color={theme.success}
                            />
                            <Text
                              style={styles.taskListProofText}
                              numberOfLines={1}
                            >
                              Proof submitted
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.taskListEmptyCard}>
                <View style={styles.taskListEmptyIcon}>
                  <Feather
                    name={
                      taskListType === "completed"
                        ? "check-circle"
                        : taskListType === "missed"
                        ? "alert-circle"
                        : "clock"
                    }
                    size={24}
                    color={theme.primary}
                  />
                </View>

                <Text style={styles.taskListEmptyTitle}>
                  No{" "}
                  {taskListType === "completed"
                    ? "completed"
                    : taskListType === "missed"
                    ? "missed"
                    : "pending"}{" "}
                  tasks
                </Text>

                <Text style={styles.taskListEmptyText}>
                  {taskListType === "completed"
                    ? "Completed schedules will appear here after you submit proof."
                    : taskListType === "missed"
                    ? "Missed schedules appear here after their date passes without completion."
                    : "Pending schedules will appear here when you add new tasks."}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={profileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeProfileModal}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Profile Information</Text>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeProfileModal}
                  activeOpacity={0.75}
                >
                  <Feather name="x" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.profilePhotoSection}>
                <LinearGradient
                  colors={theme.avatarGradient}
                  style={styles.modalAvatar}
                >
                  {profileImageUri ? (
                    <Image
                      source={{ uri: profileImageUri }}
                      style={styles.modalAvatarImage}
                    />
                  ) : (
                    <Text style={styles.modalAvatarText}>{initials}</Text>
                  )}
                </LinearGradient>

                <TouchableOpacity
                  style={styles.photoButton}
                  activeOpacity={0.8}
                  onPress={handlePickProfileImage}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <>
                      <Feather name="image" size={17} color={theme.primary} />
                      <Text style={styles.photoButtonText}>
                        Upload Profile Picture
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {profileImageUri && (
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    activeOpacity={0.8}
                    onPress={handleRemoveProfileImage}
                  >
                    <Feather name="trash-2" size={16} color={theme.danger} />
                    <Text style={styles.removePhotoText}>Remove Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.modalLabel}>FULL NAME</Text>
              <View style={styles.modalInputBox}>
                <Feather
                  name="user"
                  size={18}
                  color={theme.mutedText}
                  style={styles.modalInputIcon}
                />

                <TextInput
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.softText}
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <Text style={[styles.modalLabel, styles.modalSpacing]}>EMAIL</Text>
              <View style={styles.disabledInputBox}>
                <Feather
                  name="mail"
                  size={18}
                  color={theme.mutedText}
                  style={styles.modalInputIcon}
                />
                <Text style={styles.disabledInputText} numberOfLines={1}>
                  {email}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveProfile}
                disabled={savingProfile || uploadingImage}
              >
                <LinearGradient
                  colors={theme.saveGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.saveButton,
                    (savingProfile || uploadingImage) && styles.disabledButton,
                  ]}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather name="save" size={18} color="#ffffff" />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={notificationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setNotificationModalVisible(false)}
                activeOpacity={0.75}
              >
                <Feather name="x" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <SettingSwitch
              styles={styles}
              theme={theme}
              icon="calendar"
              title="Schedule Reminders"
              subtitle="Notify me before scheduled tasks"
              value={scheduleReminders}
              onValueChange={setScheduleReminders}
            />

            <SettingSwitch
              styles={styles}
              theme={theme}
              icon="alert-circle"
              title="Missed Alerts"
              subtitle="Notify me when tasks are missed"
              value={missedAlerts}
              onValueChange={setMissedAlerts}
            />

            <TouchableOpacity
              style={styles.doneButton}
              activeOpacity={0.85}
              onPress={() => {
                setNotificationModalVisible(false);
                Alert.alert(
                  "Notifications Updated",
                  "Your notification preferences have been saved for this session."
                );
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={preferencesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreferencesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>App Preferences</Text>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setPreferencesModalVisible(false)}
                activeOpacity={0.75}
              >
                <Feather name="x" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <SettingSwitch
              styles={styles}
              theme={theme}
              icon={isDarkMode ? "moon" : "sun"}
              title="Light/Dark Mode"
              subtitle={
                isDarkMode
                  ? "Dark mode is currently active"
                  : "Light mode is currently active"
              }
              value={isDarkMode}
              onValueChange={handleThemeChange}
            />

            <TouchableOpacity
              style={styles.doneButton}
              activeOpacity={0.85}
              onPress={() => {
                setPreferencesModalVisible(false);
                Alert.alert(
                  "Preferences Updated",
                  "Your app preferences have been applied."
                );
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingSwitch({
  styles,
  theme,
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIconBox}>
        <Feather name={icon} size={18} color={theme.primary} />
      </View>

      <View style={styles.settingTextBox}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.switchTrackOff, true: theme.switchTrackOn }}
        thumbColor={value ? theme.primary : theme.switchThumbOff}
        ios_backgroundColor={theme.switchTrackOff}
      />
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

    scrollContent: {
      paddingBottom: 102,
    },

    header: {
      paddingTop: TOP_SAFE_SPACE + 14,
      paddingHorizontal: 18,
      paddingBottom: 24,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },

    profileRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    avatarGlow: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: "rgba(101,161,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(101,161,255,0.18)",
    },

    avatar: {
      width: 66,
      height: 66,
      borderRadius: 33,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.22)",
      overflow: "hidden",
    },

    avatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: 33,
    },

    avatarText: {
      color: "#ffffff",
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: 1,
    },

    profileInfo: {
      flex: 1,
      marginLeft: 14,
      minWidth: 0,
    },

    profileLabel: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.5,
      marginBottom: 4,
      textTransform: "uppercase",
    },

    greeting: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "900",
      lineHeight: 27,
    },

    emailText: {
      color: theme.mutedText,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
      lineHeight: 18,
    },

    content: {
      paddingHorizontal: 16,
      paddingTop: 18,
    },

    sectionHeadingRow: {
      marginBottom: 12,
    },

    sectionTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
      lineHeight: 26,
    },

    sectionSubtitle: {
      color: theme.mutedText,
      fontSize: 12.5,
      fontWeight: "700",
      marginTop: 3,
      lineHeight: 18,
    },

    overviewRow: {
      flexDirection: "row",
      gap: 10,
    },

    overviewCard: {
      flex: 1,
      minHeight: 142,
      borderRadius: 22,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: theme.mode === "dark" ? 0.16 : 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },

    overviewTopRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    overviewIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 15,
      backgroundColor: theme.cardSoft,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },

    overviewNumber: {
      width: "100%",
      color: theme.text,
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 34,
      marginTop: 4,
      textAlign: "center",
    },

    overviewLabel: {
      width: "100%",
      color: theme.text,
      fontSize: 12.5,
      fontWeight: "900",
      marginTop: 4,
      lineHeight: 16,
      textAlign: "center",
    },

    overviewHint: {
      width: "100%",
      color: theme.mutedText,
      fontSize: 10.5,
      fontWeight: "800",
      marginTop: 4,
      lineHeight: 14,
      textAlign: "center",
    },

    accountCard: {
      marginTop: 20,
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },

    accountTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
      marginBottom: 12,
      lineHeight: 23,
    },

    menuItem: {
      minHeight: 70,
      backgroundColor: theme.cardSoft,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      marginBottom: 10,
    },

    menuIconBox: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },

    menuTextBox: {
      flex: 1,
      minWidth: 0,
    },

    menuTitle: {
      color: theme.text,
      fontSize: 14.5,
      fontWeight: "900",
      lineHeight: 19,
    },

    menuSubtitle: {
      color: theme.mutedText,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 3,
      lineHeight: 16,
    },

    signOutButton: {
      height: 54,
      borderRadius: 17,
      backgroundColor: theme.danger,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      marginTop: 16,
      shadowColor: theme.danger,
      shadowOpacity: 0.24,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },

    signOutText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "900",
      marginLeft: 8,
      lineHeight: 20,
      textAlign: "center",
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: "center",
      paddingHorizontal: 18,
    },

    modalScrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingVertical: 24,
    },

    modalCard: {
      backgroundColor: theme.card,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOpacity: theme.mode === "dark" ? 0.24 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },

    modalHandle: {
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.borderMid,
      alignSelf: "center",
      marginBottom: 15,
    },

    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },

    modalTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 25,
    },

    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: theme.cardSoft,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      alignItems: "center",
      justifyContent: "center",
    },

    taskListModalCard: {
      maxHeight: "84%",
      paddingBottom: 16,
    },

    taskListHeaderTextBox: {
      flex: 1,
      paddingRight: 12,
    },

    taskListSubtitle: {
      color: theme.mutedText,
      fontSize: 12.5,
      fontWeight: "700",
      lineHeight: 18,
      marginTop: 4,
    },

    clearTaskListButton: {
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.danger,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      paddingHorizontal: 14,
    },

    clearTaskListButtonDisabled: {
      opacity: 0.7,
    },

    clearTaskListButtonText: {
      color: "#ffffff",
      fontSize: 13.5,
      fontWeight: "800",
      marginLeft: 8,
    },

    taskListScroll: {
      maxHeight: 450,
    },

    taskListContentContainer: {
      paddingBottom: 4,
    },

    taskListItem: {
      backgroundColor: theme.cardSoft,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: 19,
      padding: 13,
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 10,
    },

    taskListStatusIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
      marginTop: 2,
    },

    taskListCompletedIcon: {
      backgroundColor: theme.success,
    },

    taskListPendingIcon: {
      backgroundColor: theme.warning,
    },

    taskListMissedIcon: {
      backgroundColor: theme.danger,
    },

    taskListTextBox: {
      flex: 1,
      minWidth: 0,
    },

    taskListTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },

    taskListItemTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 14.5,
      fontWeight: "900",
      lineHeight: 20,
      paddingRight: 8,
    },

    taskListStatusBadge: {
      minHeight: 25,
      borderRadius: 13,
      paddingHorizontal: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },

    taskListCompletedBadge: {
      backgroundColor: `${theme.success}18`,
      borderColor: `${theme.success}55`,
    },

    taskListPendingBadge: {
      backgroundColor: `${theme.warning}18`,
      borderColor: `${theme.warning}55`,
    },

    taskListMissedBadge: {
      backgroundColor: `${theme.danger}18`,
      borderColor: `${theme.danger}55`,
    },

    taskListStatusText: {
      fontSize: 10.5,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 14,
    },

    taskListCompletedText: {
      color: theme.success,
    },

    taskListPendingText: {
      color: theme.warning,
    },

    taskListMissedText: {
      color: theme.danger,
    },

    taskMetaGroup: {
      marginTop: 7,
    },

    taskListMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 5,
    },

    taskListMetaText: {
      flex: 1,
      color: theme.mutedText,
      fontSize: 12.3,
      fontWeight: "700",
      lineHeight: 17,
      marginLeft: 7,
    },

    taskListSubtaskText: {
      color: theme.softText,
      fontSize: 12.2,
      fontWeight: "700",
      lineHeight: 17,
      marginTop: 8,
    },

    proofPill: {
      alignSelf: "flex-start",
      minHeight: 27,
      borderRadius: 14,
      backgroundColor: `${theme.success}14`,
      borderWidth: 1,
      borderColor: `${theme.success}44`,
      paddingHorizontal: 10,
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    taskListProofText: {
      color: theme.success,
      fontSize: 12,
      fontWeight: "900",
      marginLeft: 6,
      lineHeight: 16,
    },

    taskListEmptyCard: {
      backgroundColor: theme.cardSoft,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: 20,
      padding: 20,
      alignItems: "center",
    },

    taskListEmptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 19,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 11,
      borderWidth: 1,
      borderColor: theme.border,
    },

    taskListEmptyTitle: {
      color: theme.text,
      fontSize: 15.5,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 20,
    },

    taskListEmptyText: {
      color: theme.mutedText,
      fontSize: 12.5,
      fontWeight: "700",
      lineHeight: 18,
      textAlign: "center",
      marginTop: 6,
    },

    profilePhotoSection: {
      alignItems: "center",
      marginBottom: 18,
      backgroundColor: theme.cardSoft,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      borderRadius: 20,
      padding: 16,
    },

    modalAvatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.22)",
      overflow: "hidden",
      marginBottom: 12,
    },

    modalAvatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: 44,
    },

    modalAvatarText: {
      color: "#ffffff",
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: 1,
    },

    photoButton: {
      minHeight: 44,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.borderMid,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      paddingHorizontal: 15,
    },

    photoButtonText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "900",
      marginLeft: 7,
      lineHeight: 18,
      textAlign: "center",
    },

    removePhotoButton: {
      marginTop: 9,
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    removePhotoText: {
      color: theme.danger,
      fontSize: 12.5,
      fontWeight: "900",
      marginLeft: 5,
      lineHeight: 17,
    },

    modalLabel: {
      color: theme.mutedText,
      fontSize: 11.5,
      fontWeight: "900",
      letterSpacing: 1,
      marginBottom: 8,
    },

    modalSpacing: {
      marginTop: 13,
    },

    modalInputBox: {
      height: 52,
      borderRadius: 15,
      backgroundColor: theme.cardSoft,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
    },

    modalInputIcon: {
      marginRight: 10,
    },

    modalInput: {
      flex: 1,
      color: theme.text,
      fontSize: 14.5,
      fontWeight: "700",
      paddingVertical: 0,
    },

    disabledInputBox: {
      height: 52,
      borderRadius: 15,
      backgroundColor: theme.cardDeep,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
    },

    disabledInputText: {
      flex: 1,
      color: theme.mutedText,
      fontSize: 13.5,
      fontWeight: "700",
    },

    saveButton: {
      height: 53,
      borderRadius: 16,
      marginTop: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      shadowColor: theme.primary,
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },

    saveButtonText: {
      color: "#ffffff",
      fontSize: 14.5,
      fontWeight: "900",
      marginLeft: 8,
      lineHeight: 19,
      textAlign: "center",
    },

    disabledButton: {
      opacity: 0.7,
    },

    settingRow: {
      minHeight: 72,
      backgroundColor: theme.cardSoft,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },

    settingIconBox: {
      width: 41,
      height: 41,
      borderRadius: 15,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },

    settingTextBox: {
      flex: 1,
      paddingRight: 8,
    },

    settingTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 19,
    },

    settingSubtitle: {
      color: theme.mutedText,
      fontSize: 11.8,
      fontWeight: "700",
      marginTop: 3,
      lineHeight: 16,
    },

    doneButton: {
      height: 51,
      borderRadius: 16,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },

    doneButtonText: {
      color: "#ffffff",
      fontSize: 14.5,
      fontWeight: "900",
      lineHeight: 19,
      textAlign: "center",
    },
  });