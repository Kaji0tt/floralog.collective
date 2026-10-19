/**
 * FloraLog Community Events Worker
 *
 * Triggers the Supabase communityEventScheduler edge function every hour (minute 2).
 * The edge function is idempotent: it sends the start / progress / goal / result
 * pushes for Community Events exactly once and finalizes ended events
 * (Funken + Faces + reward notification for every participant).
 *
 * Environment bindings required (Cloudflare Dashboard → Worker → Settings → Variables):
 *   COMMUNITY_EVENT_ENDPOINT – URL of the communityEventScheduler edge function
 *                              e.g. https://mppxozsltkgjozcastgv.supabase.co/functions/v1/communityEventScheduler
 *   COMMUNITY_EVENT_SECRET   – shared secret sent as x-community-event-secret header
 *                              (must equal COMMUNITY_EVENT_SCHEDULER_SECRET in Supabase)
 *   WORKER_TRIGGER_SECRET    – (optional) secret for manual HTTP trigger via X-Worker-Secret header
 */

async function triggerCommunityEvents(env, body = {}) {
  const endpoint = env.COMMUNITY_EVENT_ENDPOINT;
  const secret = env.COMMUNITY_EVENT_SECRET;

  if (!endpoint || !secret) {
    console.error('[community-events] Missing COMMUNITY_EVENT_ENDPOINT or COMMUNITY_EVENT_SECRET');
    return { error: 'Missing environment variables' };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-community-event-secret': secret,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({ raw: response.status }));

    if (!response.ok) {
      console.error('[community-events] communityEventScheduler failed:', response.status, data);
    } else {
      console.log('[community-events] communityEventScheduler OK:', JSON.stringify(data));
    }

    return { status: response.status, data };
  } catch (err) {
    console.error('[community-events] fetch error:', err.message);
    return { error: err.message };
  }
}

export default {
  // Manual HTTP trigger – POST with optional body { "force": true } to ignore the push time window.
  async fetch(request, env) {
    const workerSecret = env.WORKER_TRIGGER_SECRET;
    if (!workerSecret || request.headers.get('X-Worker-Secret') !== workerSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // no body is fine
    }

    const result = await triggerCommunityEvents(env, body);
    return new Response(JSON.stringify({ triggered: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(triggerCommunityEvents(env));
  },
};
