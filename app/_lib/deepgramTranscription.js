import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";

const DEEPGRAM_MODELS = ["nova-3", "nova-2"];

const sanitizeApiKey = (value) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[\r\n\t\s]/g, "");

  const hexMatch = cleaned.match(/[a-fA-F0-9]{20,}/);
  return hexMatch ? hexMatch[0] : cleaned;
};

const getDeepgramApiKey = () => {
  const candidates = [
    process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY,
    Constants.expoConfig?.extra?.deepgramApiKey,
  ];

  for (const candidate of candidates) {
    const key = sanitizeApiKey(candidate);
    if (key) {
      return key;
    }
  }

  return "";
};

export const isDeepgramConfigured = () => Boolean(getDeepgramApiKey());

const buildListenUrl = (model) =>
  `https://api.deepgram.com/v1/listen?model=${model}&smart_format=true&language=en`;

const base64ToUint8Array = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const readAudioBytes = async (audioUri) => {
  const normalizedUri = String(audioUri || "").trim();

  if (!normalizedUri) {
    throw new Error("No voice recording was found. Please try recording again.");
  }

  try {
    const base64Audio = await FileSystem.readAsStringAsync(normalizedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64Audio) {
      throw new Error("The voice recording file was empty. Please try again.");
    }

    return base64ToUint8Array(base64Audio);
  } catch {
    const audioResponse = await fetch(normalizedUri);
    const audioBlob = await audioResponse.blob();
    const buffer = await audioBlob.arrayBuffer();

    return new Uint8Array(buffer);
  }
};

const extractTranscript = (responseBody) => {
  const transcript =
    responseBody?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  return String(transcript || "").trim();
};

const buildAuthErrorMessage = (responseBody, apiKey) => {
  const errorCode = responseBody?.err_code || "INVALID_AUTH";
  const keyLength = apiKey.length;

  if (errorCode === "INSUFFICIENT_PERMISSIONS") {
    return (
      "Your Deepgram API key does not have speech-to-text access. " +
      "In console.deepgram.com, open API Keys, create a key with the listen scope, " +
      "update EXPO_PUBLIC_DEEPGRAM_API_KEY in .env, then run npm run start:dev."
    );
  }

  return (
    `Deepgram rejected the API key (${errorCode}, length ${keyLength}). ` +
    "Create a new key with listen access in console.deepgram.com, paste it into .env, " +
    "then fully restart Expo with npm run start:dev."
  );
};

const requestTranscription = async (audioBytes, apiKey, model) => {
  const response = await fetch(buildListenUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "audio/m4a",
    },
    body: audioBytes,
  });

  let responseBody = null;

  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  return { response, responseBody };
};

export const transcribeAudioWithDeepgram = async (audioUri) => {
  const apiKey = getDeepgramApiKey();

  if (!apiKey) {
    throw new Error(
      "Missing Deepgram API key. Add EXPO_PUBLIC_DEEPGRAM_API_KEY to your .env file, then restart Expo."
    );
  }

  const audioBytes = await readAudioBytes(audioUri);

  if (!audioBytes?.length) {
    throw new Error("The voice recording file was empty. Please try again.");
  }

  let lastFailure = null;

  for (const model of DEEPGRAM_MODELS) {
    const { response, responseBody } = await requestTranscription(
      audioBytes,
      apiKey,
      model
    );

    if (response.ok) {
      const transcript = extractTranscript(responseBody);

      if (!transcript) {
        throw new Error("Deepgram did not detect speech in that recording.");
      }

      return transcript;
    }

    lastFailure = { response, responseBody };

    if (response.status === 401) {
      const errorCode = responseBody?.err_code || "INVALID_AUTH";

      if (errorCode === "INVALID_AUTH") {
        throw new Error(buildAuthErrorMessage(responseBody, apiKey));
      }
    }

    if (response.status !== 402 && response.status !== 403) {
      break;
    }
  }

  const { response, responseBody } = lastFailure || {};

  if (response?.status === 401) {
    throw new Error(buildAuthErrorMessage(responseBody, apiKey));
  }

  const message =
    responseBody?.err_msg ||
    responseBody?.message ||
    `Deepgram transcription failed (${response?.status || "unknown"}).`;
  throw new Error(message);
};
