export function isInternalScanRequest(req: Request): boolean {
  const secret = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(secret && req.headers.get("x-internal-scan") === secret);
}
