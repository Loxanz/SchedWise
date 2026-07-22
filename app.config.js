// Expo CLI loads .env before evaluating this file.
const appJson = require("./app.json");

module.exports = () => ({
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      deepgramApiKey: process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY || "",
    },
  },
});
