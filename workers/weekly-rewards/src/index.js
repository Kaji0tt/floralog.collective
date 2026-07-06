/**
 * FloraLog Weekly Rewards Worker
 *
 * Triggers the Supabase weeklyRewardsScheduler edge function once a week
 * (Monday 00:05 UTC) to distribute end-of-week bonuses:
 *   - Funken (sparks) to the Top-5 weekly seed leaderboard
 *   - Funken to the player with the most liked scan
 *
 * Environment bindings required (set in Cloudflare Dashboard → Worker → Settings → Variables):
 *   WEEKLY_REWARDS_ENDPOINT  – URL of the weeklyRewardsScheduler Supabase edge function
 *                              e.g. https://mppxozsltkgjozcastgv.supabase.co/functions/v1/weeklyRewardsScheduler
 *   WEEKLY_REWARDS_SECRET    – shared secret sent as x-weekly-rewards-secret header
 *   WORKER_TRIGGER_SECRET    – (optional) secret for manual HTTP trigger via X-Worker-Secret header
 */

async function triggerWeeklyRewards(env, body = {}) {
  const endpoint = env.WEEKLY_REWARDS_ENDPOINT;
  const secret = env.WEEKLY_REWARDS_SECRET;

  if (!endpoint || !secret) {
    console.error('[weekly-rewards] Missing WEEKLY_REWARDS_ENDPOINT or WEEKLY_REWARDS_SECRET');
    return { error: 'Missing environment variables' };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-weekly-rewards-secret': secret,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({ raw: response.status }));

    if (!response.ok) {
      console.error('[weekly-rewards] weeklyRewardsScheduler failed:', response.status, data);
    } else {
      console.log('[weekly-rewards] weeklyRewardsScheduler OK:', data);
    }

    return { status: response.status, data };
  } catch (err) {
    console.error('[weekly-rewards] fetch error:', err.message);
    return { error: err.message };
  }
}

export default {
  // Manual HTTP trigger – useful for back-filling a specific week or testing.
  // POST with optional body: { "weekStart": "2026-06-30T00:00:00.000Z" }
  async fetch(request, env) {
    const workerSecret = env.WORKER_TRIGGER_SECRET;

    if (workerSecret) {
      const provided = request.headers.get('X-Worker-Secret');
      if (provided !== workerSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // no body is fine
    }

    const result = await triggerWeeklyRewards(env, body);
    return new Response(JSON.stringify({ triggered: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },

  // Cron trigger – runs every Monday at 00:05 UTC
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(triggerWeeklyRewards(env));
  },
};
