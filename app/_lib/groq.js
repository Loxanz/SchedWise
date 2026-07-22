const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

export const GROQ_MODEL =
  process.env.EXPO_PUBLIC_GROQ_MODEL || "llama-3.1-8b-instant";

const SYSTEM_PROMPT =
  "You are SchedWise Assistant, a friendly AI helper inside the SchedWise mobile app. " +
  "You help students manage their schedules, deadlines, study plans, flashcards, and academic tasks. " +
  "You have live access to the user's personal SchedWise schedule data provided in each request. " +
  "Only reference tasks, dates, and times that appear in that data. Never invent schedules. " +
  "If something is not in their schedule data, say it is not in their SchedWise schedule. " +
  "If the user asks for a specific day's schedule and there are no tasks on that date, reply exactly: You have no task scheduled for [date]. " +
  "If the user asks for today's schedule, start with \"Your schedule for today is:\" then list each item on its own line as: time, date, task title. " +
  "Only show pending upcoming tasks from the schedule data. Do not include missed or completed tasks. " +
  "You cannot modify schedules yourself. Never claim you updated, renamed, or saved a schedule. " +
  "Keep answers concise, practical, and encouraging. Use plain text without markdown headings.";

export const isGroqConfigured = () => Boolean(GROQ_API_KEY);

export const callGroqChat = async ({
  messages,
  model = GROQ_MODEL,
  temperature = 0.6,
  maxTokens = 1024,
  signal,
}) => {
  if (!GROQ_API_KEY) {
    throw new Error(
      "Missing Groq API key. Add EXPO_PUBLIC_GROQ_API_KEY to your .env file, then restart Expo with npx expo start -c."
    );
  }

  let response;

  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Could not reach the AI service. Check your internet connection and try again."
    );
  }

  if (!response.ok) {
    let detail = "";

    try {
      const errorBody = await response.json();
      detail = errorBody?.error?.message || "";
    } catch {
    }

    throw new Error(
      detail ||
        `The AI service returned an error (${response.status}). Please try again.`
    );
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("The AI service returned an empty response.");
  }

  return reply;
};

export const sendChatToGroq = async (history, options = {}) => {
  const systemContent = options.scheduleContext
    ? `${SYSTEM_PROMPT}\n\nLive SchedWise schedule data:\n${options.scheduleContext}`
    : SYSTEM_PROMPT;

  return callGroqChat({
    messages: [
      { role: "system", content: systemContent },
      ...history.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
    ],
    model: GROQ_MODEL,
    temperature: 0.6,
    maxTokens: 1024,
    signal: options.signal,
  });
};
