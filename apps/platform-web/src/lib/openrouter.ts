type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openai/gpt-4o-mini";

function getApiKey() {
  return import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
}

export async function openRouterJson<T>(params: {
  system: string;
  user: string;
  fallback: T;
}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) return params.fallback;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "EcoLearn",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ] satisfies OpenRouterMessage[],
        temperature: 0.2,
      }),
    });

    if (!response.ok) return params.fallback;

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return params.fallback;

    const parsed = JSON.parse(content) as T;
    return parsed;
  } catch (error) {
    console.error("OpenRouter request failed:", error);
    return params.fallback;
  }
}
