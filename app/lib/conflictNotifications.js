import { Alert, Platform, ToastAndroid } from "react-native";

export async function requestScheduleNotificationPermission() {
  return true;
}

export async function sendScheduleConflictNotification({ title, body }) {
  const notificationTitle = title || "Schedule conflict detected";
  const notificationBody = body || "SchedWise found a conflict in your schedule.";

  try {
    if (Platform.OS === "android" && ToastAndroid?.showWithGravity) {
      ToastAndroid.showWithGravity(
        `${notificationTitle}\n${notificationBody}`,
        ToastAndroid.LONG,
        ToastAndroid.TOP
      );
    } else {
      Alert.alert(notificationTitle, notificationBody);
    }

    return true;
  } catch (error) {
    console.log("Schedule conflict notification error:", error?.message);
    return false;
  }
}