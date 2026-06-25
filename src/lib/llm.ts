import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("Missing LLM_API_KEY");
  client = new OpenAI({ apiKey });
  return client;
}

export async function completeJson<T>(
  system: string,
  user: string,
  model = process.env.LLM_MODEL ?? "gpt-4o-mini"
): Promise<T> {
  const response = await getClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  return JSON.parse(content) as T;
}

export async function completeText(
  system: string,
  user: string,
  model = process.env.LLM_MODEL ?? "gpt-4o-mini"
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
