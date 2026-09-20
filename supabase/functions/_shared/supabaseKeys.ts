function getNamedKey(rawKeys: string | undefined, keyName: string): string | null {
  if (!rawKeys) return null;

  try {
    const parsed = JSON.parse(rawKeys) as Record<string, unknown>;
    const key = parsed?.[keyName];
    return typeof key === "string" && key.trim() ? key.trim() : null;
  } catch {
    return null;
  }
}

export function getSupabasePublishableKey(keyName = "default"): string | null {
  return (
    getNamedKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"), keyName) ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") ||
    null
  );
}
