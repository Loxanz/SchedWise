import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { getCurrentUser, supabase } from "./supabase";

export const PROFILE_PICTURES_BUCKET = "profile-pictures";
export const PROFILE_PICTURE_FILE_NAME = "avatar.jpg";

const LEGACY_PROFILE_IMAGE_PREFIX = "schedwise_profile_image_";

const PROFILE_PICTURES_SETUP_MESSAGE =
  "Profile picture storage is not set up in Supabase yet. Run supabase/profile_pictures_storage.sql in the Supabase SQL Editor, then restart the app.";
const STORAGE_TIMEOUT_MS = 20000;

const isStorageSetupError = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("bucket not found") ||
    message.includes("not found") ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("new row violates")
  );
};

const normalizeStorageError = (error) => {
  if (!error) {
    return null;
  }

  if (isStorageSetupError(error)) {
    return new Error(PROFILE_PICTURES_SETUP_MESSAGE);
  }

  return error;
};

export const getProfilePictureStoragePath = (userId) => {
  return `${userId}/${PROFILE_PICTURE_FILE_NAME}`;
};

const getLegacyProfileImageKey = (userId) => {
  return `${LEGACY_PROFILE_IMAGE_PREFIX}${userId}`;
};

const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
};

const withTimeout = (promise, timeoutMessage) => {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, STORAGE_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
};

const buildProfilePictureUrl = (userId, cacheKey = Date.now()) => {
  const { data } = supabase.storage
    .from(PROFILE_PICTURES_BUCKET)
    .getPublicUrl(getProfilePictureStoragePath(userId));

  if (!data?.publicUrl) {
    return null;
  }

  return `${data.publicUrl}?v=${cacheKey}`;
};

const readArrayBufferFromUri = async (fileUri) => {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return base64ToArrayBuffer(base64);
};

export const profilePictureExists = async (userId) => {
  if (!userId) {
    return false;
  }

  const { data, error } = await withTimeout(
    supabase.storage.from(PROFILE_PICTURES_BUCKET).list(userId, {
      limit: 1,
      search: PROFILE_PICTURE_FILE_NAME,
    }),
    "Profile picture check took too long. Please check your connection and try again."
  );

  if (error) {
    throw normalizeStorageError(error);
  }

  return Array.isArray(data) && data.length > 0;
};

export const uploadProfilePicture = async ({ userId, fileUri, base64 }) => {
  const resolvedUser = userId ? { id: userId } : await getCurrentUser();

  if (!resolvedUser?.id) {
    throw new Error("You must be signed in to upload a profile picture.");
  }

  let fileBuffer;

  if (fileUri) {
    fileBuffer = await readArrayBufferFromUri(fileUri);
  } else if (base64) {
    fileBuffer = base64ToArrayBuffer(base64);
  } else {
    throw new Error("No image data was provided.");
  }

  const storagePath = getProfilePictureStoragePath(resolvedUser.id);
  const { error } = await withTimeout(
    supabase.storage.from(PROFILE_PICTURES_BUCKET).upload(storagePath, fileBuffer, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    }),
    "Profile picture upload took too long. Please check your connection and try again."
  );

  if (error) {
    throw normalizeStorageError(error);
  }

  return buildProfilePictureUrl(resolvedUser.id);
};

export const deleteProfilePicture = async (userId) => {
  const resolvedUser = userId ? { id: userId } : await getCurrentUser();

  if (!resolvedUser?.id) {
    throw new Error("You must be signed in to remove a profile picture.");
  }

  const storagePath = getProfilePictureStoragePath(resolvedUser.id);
  const { error } = await withTimeout(
    supabase.storage.from(PROFILE_PICTURES_BUCKET).remove([storagePath]),
    "Profile picture removal took too long. Please check your connection and try again."
  );

  if (error) {
    throw normalizeStorageError(error);
  }
};

const migrateLegacyProfileImage = async (userId) => {
  const legacyValue = await AsyncStorage.getItem(getLegacyProfileImageKey(userId));

  if (!legacyValue || !legacyValue.startsWith("data:image")) {
    return null;
  }

  const base64 = legacyValue.split(",")[1];

  if (!base64) {
    return null;
  }

  const uploadedUrl = await uploadProfilePicture({
    userId,
    base64,
  });

  await AsyncStorage.removeItem(getLegacyProfileImageKey(userId));

  return uploadedUrl;
};

export const loadProfilePictureUrl = async (userId) => {
  if (!userId) {
    return null;
  }

  try {
    const hasRemoteImage = await profilePictureExists(userId);

    if (hasRemoteImage) {
      return buildProfilePictureUrl(userId);
    }
  } catch (error) {
    console.log("Load profile picture error:", error?.message);

    try {
      return await migrateLegacyProfileImage(userId);
    } catch (migrationError) {
      console.log("Profile picture migration error:", migrationError?.message);
      return null;
    }
  }

  try {
    return await migrateLegacyProfileImage(userId);
  } catch (migrationError) {
    console.log("Profile picture migration error:", migrationError?.message);
    return null;
  }
};
