// Cloudflare Pages Function: Catch-All für OTA-Dateien aus R2
// Stellt z.B. /api/ota/latest.json, /api/ota/bundle.zip, ... bereit

export const onRequest: PagesFunction<{ OTA_BUCKET: R2Bucket }> = async (context) => {
  const key = context.params.path?.join("/") || "";
  const object = await context.env.OTA_BUCKET.get(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300",
    },
  });
};
