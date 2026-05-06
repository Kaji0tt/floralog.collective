/**
 * FloraLog Quiz Scheduler Worker
 *
 * Triggers the Supabase quizScheduler edge function for both
 * midday (12–13) and evening (18–19) slots every 5 minutes.
 * The edge function itself handles idempotency via PlantQuizSlotRoll.
 *
 * Environment bindings required:
 *   QUIZ_SCHEDULER_ENDPOINT  – URL of the quizScheduler Supabase edge function
 *   QUIZ_SCHEDULER_SECRET    – shared secret sent as x-quiz-scheduler-secret header
 *   WORKER_TRIGGER_SECRET    – (optional) secret for manual HTTP trigger via X-Worker-Secret header
 */

const SLOT_TYPES = ['midday', 'evening'];

async function triggerQuizScheduler(env) {
  const endpoint = env.QUIZ_SCHEDULER_ENDPOINT;
  const secret = env.QUIZ_SCHEDULER_SECRET;

  if (!endpoint || !secret) {
    console.error('Missing QUIZ_SCHEDULER_ENDPOINT or QUIZ_SCHEDULER_SECRET');
    return { error: 'Missing environment variables' };
  }

  const results = [];

  for (const slotType of SLOT_TYPES) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-quiz-scheduler-secret': secret,
        },
        body: JSON.stringify({ slotType }),
      });

      const data = await response.json().catch(() => ({ raw: response.status }));
      results.push({ slotType, status: response.status, data });

      if (!response.ok) {
        console.error(`quizScheduler failed for ${slotType}:`, response.status, data);
      } else {
        console.log(`quizScheduler OK for ${slotType}:`, data);
      }
    } catch (err) {
      console.error(`quizScheduler fetch error for ${slotType}:`, err.message);
      results.push({ slotType, error: err.message });
    }
  }

  return results;
}

export default {
  // Manual HTTP trigger (for testing / admin use)
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

    const results = await triggerQuizScheduler(env);
    return new Response(JSON.stringify({ triggered: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },

  // Cron trigger – runs every 5 minutes
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(triggerQuizScheduler(env));
  },
};
