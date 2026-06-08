import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_REDIRECT_PATH = "auth/callback";

function getGoogleRedirectUrl() {
  return Linking.createURL(GOOGLE_REDIRECT_PATH);
}

function getValueFromUrl(url, key) {
  if (!url || !key) return "";

  try {
    const parsedUrl = new URL(url);

    const queryValue = parsedUrl.searchParams.get(key);

    if (queryValue) {
      return queryValue;
    }

    const hashText = parsedUrl.hash?.startsWith("#")
      ? parsedUrl.hash.slice(1)
      : parsedUrl.hash || "";

    const hashParams = new URLSearchParams(hashText);

    return hashParams.get(key) || "";
  } catch {
    const queryText = String(url).split("?")[1]?.split("#")[0] || "";
    const hashText = String(url).split("#")[1] || "";

    const queryParams = new URLSearchParams(queryText);
    const hashParams = new URLSearchParams(hashText);

    return queryParams.get(key) || hashParams.get(key) || "";
  }
}

export function getGoogleAuthRedirectUrl() {
  return getGoogleRedirectUrl();
}

export async function signInWithGoogle() {
  const redirectTo = getGoogleRedirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error("Supabase did not return a Google sign-in URL.");
  }

  let authResult = null;

  try {
    await WebBrowser.warmUpAsync();

    authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      showInRecents: true,
    });
  } finally {
    await WebBrowser.coolDownAsync();
  }

  if (authResult?.type === "cancel" || authResult?.type === "dismiss") {
    return {
      cancelled: true,
      session: null,
      user: null,
      data: null,
    };
  }

  if (authResult?.type !== "success" || !authResult?.url) {
    throw new Error("Google sign-in was not completed.");
  }

  const returnedUrl = authResult.url;

  const oauthError =
    getValueFromUrl(returnedUrl, "error_description") ||
    getValueFromUrl(returnedUrl, "error");

  if (oauthError) {
    throw new Error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
  }

  const code = getValueFromUrl(returnedUrl, "code");

  if (code) {
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      throw exchangeError;
    }

    if (!sessionData?.session) {
      throw new Error("Google sign-in succeeded, but no session was created.");
    }

    return {
      cancelled: false,
      session: sessionData.session,
      user: sessionData.user,
      data: sessionData,
    };
  }

  const accessToken = getValueFromUrl(returnedUrl, "access_token");
  const refreshToken = getValueFromUrl(returnedUrl, "refresh_token");

  if (accessToken && refreshToken) {
    const { data: sessionData, error: setSessionError } =
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

    if (setSessionError) {
      throw setSessionError;
    }

    if (!sessionData?.session) {
      throw new Error("Google sign-in succeeded, but no session was created.");
    }

    return {
      cancelled: false,
      session: sessionData.session,
      user: sessionData.user,
      data: sessionData,
    };
  }

  throw new Error("Google sign-in did not return an authorization code.");
}