type CorsHeaders = Record<string, string>;

function normalizeOriginValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed === "file://") return "file://";

  try {
    // Accept values like "https://example.com/" or "https://example.com/path"
    // and reduce them to canonical origin form.
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

export function getAllowedOrigins(): string[] {
  const configured = [
    Deno.env.get("FLORALOG_URL"),
    Deno.env.get("SITE_URL"),
    "https://base44-floralog.pages.dev",
    "http://localhost",
    "https://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "capacitor://localhost",
    "ionic://localhost",
    "file://",
    "",
  ].filter((value): value is string => value !== undefined);

  const normalized = configured.map(normalizeOriginValue);
  return Array.from(new Set(normalized));
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;

  const normalizedOrigin = normalizeOriginValue(origin);
  return getAllowedOrigins().some((allowed) => normalizedOrigin === allowed);
}

export function buildOriginDeniedResponse(
  req: Request,
  corsHeaders: CorsHeaders,
  functionName: string,
): Response | null {
  const requestOrigin = req.headers.get("Origin");
  if (isAllowedOrigin(requestOrigin)) {
    return null;
  }

  console.warn(`[${functionName}] Origin not allowed`, { requestOrigin });

  return new Response(
    JSON.stringify({ error: "Origin not allowed", origin: requestOrigin }),
    {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}
