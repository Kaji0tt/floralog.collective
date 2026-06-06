#!/usr/bin/env node

const endpoint = process.env.BACKFILL_URL || "https://mppxozsltkgjozcastgv.supabase.co/functions/v1/backfillPlantMetadata";
const limit = Number(process.env.BACKFILL_LIMIT || 50);
const startOffset = Number(process.env.BACKFILL_START_OFFSET || 0);
const maxBatches = Number(process.env.BACKFILL_MAX_BATCHES || 500);
const timeoutMs = Number(process.env.BACKFILL_TIMEOUT_MS || 300000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callBatch(offset) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Connection": "close" },
      body: JSON.stringify({
        limit,
        offset,
        fullBackfill: true,
        includeOpenAi: false,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function callBatchWithRetry(offset, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await callBatch(offset);
    } catch (err) {
      lastError = err;
      const delay = 500 * attempt;
      console.log(`RETRY offset=${offset} attempt=${attempt}/${retries} error=${err.message}`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function main() {
  let offset = startOffset;
  let totalUpdated = 0;
  let totalFailed = 0;
  let batches = 0;

  console.log(`START endpoint=${endpoint} limit=${limit} offset=${offset}`);

  while (batches < maxBatches) {
    let data;
    try {
      data = await callBatchWithRetry(offset, 4);
    } catch (err) {
      console.error(`ERROR batch=${batches + 1} offset=${offset} message=${err.message}`);
      process.exitCode = 1;
      break;
    }

    const updated = Number(data.updated || 0);
    const failed = Number(data.failed || 0);
    const nextOffset = data.next_offset === null || data.next_offset === undefined
      ? null
      : Number(data.next_offset);

    batches += 1;
    totalUpdated += updated;
    totalFailed += failed;

    console.log(
      `BATCH ${batches}: offset=${offset} updated=${updated} failed=${failed} next_offset=${nextOffset === null ? "<none>" : nextOffset}`,
    );

    if (nextOffset === null) {
      console.log("DONE no next offset");
      break;
    }

    if (nextOffset <= offset) {
      console.log(`STOP non-increasing offset ${nextOffset}`);
      break;
    }

    offset = nextOffset;

    // Light pacing to reduce burst pressure on dependent services.
    await sleep(150);
  }

  console.log(JSON.stringify({ batches, totalUpdated, totalFailed, finalOffset: offset }));
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
