import OpenAI from "openai";

export async function callGeminiAPI(prompt, apiKey) {
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Initialize Gemini via OpenAI-compatible SDK
  const client = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
  });

  try {
    const response = await client.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are a helpful project management assistant."
        },
        {
          role: "user",
          content: prompt
        }
      ],
    });

    // Safely extract the message text
    return (
      response?.choices?.[0]?.message?.content?.trim() ||
      "No response from Gemini"
    );
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(error.message || "Failed to call Gemini API");
  }
}

export function buildSummarizePrompt(tasks) {
  const taskList = tasks
    .map(
      (t, i) =>
        `${i + 1}. [${t.status.toUpperCase()}] ${t.title}: ${
          t.description || "No description"
        }`
    )
    .join("\n");

  return `You are a project management assistant. Analyze the following tasks and provide a comprehensive summary.

Tasks:
${taskList}

Please provide:
1. Overall project progress and status
2. Key achievements (completed tasks)
3. Current focus areas (in-progress tasks)
Keep the summary concise but insightful.`;
}

export function buildAskPrompt(tasks, question) {
  const taskList = tasks
    .map(
      (t, i) =>
        `${i + 1}. [${t.status.toUpperCase()}] ${t.title}: ${
          t.description || "No description"
        }`
    )
    .join("\n");

  return `You are a project management assistant. Here are the current project tasks:

${taskList}

User Question: ${question}

Please provide a helpful, accurate answer based on the task data above. Be specific and reference actual tasks when relevant.`;
}
