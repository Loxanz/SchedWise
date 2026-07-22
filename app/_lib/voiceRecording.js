import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

let recorderInstance = null;

const NATIVE_REBUILD_MESSAGE =
  "Voice input needs the latest SchedWise development build.\n\n1. Run: npm run build:dev:android\n2. Install the new APK from the EAS link\n3. Fully close the old app, then open the new one\n4. Restart Expo with: npm run start:dev";

const getNativeAudioModule = () => requireOptionalNativeModule("ExpoAudio");

const getSpeechRecordingOptions = () => {
  const commonOptions = {
    extension: ".m4a",
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
    isMeteringEnabled: false,
  };

  if (Platform.OS === "android") {
    return {
      ...commonOptions,
      outputFormat: "mpeg4",
      audioEncoder: "aac",
    };
  }

  if (Platform.OS === "ios") {
    return {
      ...commonOptions,
      outputFormat: "aac ",
      audioQuality: 96,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    };
  }

  return {
    ...commonOptions,
    mimeType: "audio/webm",
    bitsPerSecond: 64000,
  };
};

export const isVoiceRecordingAvailable = () => {
  const nativeModule = getNativeAudioModule();

  return Boolean(
    nativeModule &&
      typeof nativeModule.requestRecordingPermissionsAsync === "function" &&
      typeof nativeModule.AudioRecorder === "function"
  );
};

export const isExpoAudioNativeModuleError = (error) => {
  const message = String(error?.message || error || "");

  return (
    message.includes("ExpoAudio") ||
    message.includes("Cannot find native module") ||
    message.includes("native module")
  );
};

export const alertExpoAudioNativeModuleError = () => {
  const { Alert } = require("react-native");

  Alert.alert("Rebuild Required", NATIVE_REBUILD_MESSAGE);
};

const getNativeRecorder = () => {
  const nativeModule = getNativeAudioModule();

  if (!isVoiceRecordingAvailable()) {
    throw new Error("Cannot find native module 'ExpoAudio'");
  }

  if (!recorderInstance) {
    recorderInstance = new nativeModule.AudioRecorder(getSpeechRecordingOptions());
  }

  return recorderInstance;
};

export const ensureRecordingPermission = async () => {
  const nativeModule = getNativeAudioModule();

  if (!nativeModule) {
    throw new Error("Cannot find native module 'ExpoAudio'");
  }

  const permission = await nativeModule.requestRecordingPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Microphone permission was denied.");
  }

  await nativeModule.setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
};

export const startVoiceRecording = async () => {
  await ensureRecordingPermission();

  const recorder = getNativeRecorder();
  await recorder.prepareToRecordAsync(getSpeechRecordingOptions());
  recorder.record();
};

export const stopVoiceRecording = async () => {
  const recorder = getNativeRecorder();
  await recorder.stop();

  const uri = recorder.uri;

  if (!uri) {
    throw new Error("No recording was saved. Please try again.");
  }

  return uri;
};

export const cleanupVoiceRecording = async () => {
  if (!recorderInstance) {
    return;
  }

  try {
    const status = recorderInstance.getStatus?.();

    if (status?.isRecording) {
      await recorderInstance.stop();
    }
  } catch {
    // Ignore cleanup errors.
  }
};
