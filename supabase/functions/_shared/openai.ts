export function getOpenAiKey(): string | null {
  return Deno.env.get("OPENAI_API_KEY") || null;
}

export function getOpenAiModel(): string {
  // Default model set to gpt-5-nano as requested by the user
  return Deno.env.get("OPENAI_MODEL") || "gpt-5-nano";
}
