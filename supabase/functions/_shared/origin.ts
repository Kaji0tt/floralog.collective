type CorsHeaders = Record<string, string>;

export function getAllowedOrigins(): string[] {
  return [
    Deno.env.get("FLORALOG_URL"),
    Deno.env.get("SITE_URL"),
    "http://localhost",
    "https://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "capacitor://localhost",
    "ionic://localhost",
    "file://",
    "",
  ].filter((value): value is string => value !== undefined);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return getAllowedOrigins().some((allowed) => origin.toLowerCase() === allowed.toLowerCase());
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
