import { getStore } from "@netlify/blobs";
import { announceEpoch, fetchCurrentEpoch } from "../../src/services/epochAnnouncement";

// Server-side epoch announcer. Replaces the fragile client-side trigger that only
// fired when a browser tab happened to be open at the announcement minute.
//
// - SCHEDULED invocation (Netlify sends a JSON body with `next_run`): posts the
//   latest completed epoch's winners + dividend split to Discord, once, guarded by
//   a Netlify Blobs "lastAnnouncedEpoch" marker so retries never double-post.
// - HTTP invocation (e.g. curl for testing): ALWAYS a dry-run preview — returns the
//   embeds it *would* post without sending anything to Discord. Optional `?epoch=N`
//   previews a specific epoch. HTTP can never trigger a real post.
//
// Cron runs three times (13:15 / 14:15 / 15:15 UTC Wednesday) to tolerate archiver
// lag after the ~12:00 UTC epoch rollover; Blobs makes the later runs no-ops.
const STORE_NAME = "qraffle-announcements";
const LAST_EPOCH_KEY = "lastAnnouncedEpoch";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });

export default async (req: Request): Promise<Response> => {
  // Netlify scheduled invocations POST a body containing `next_run`; HTTP does not.
  let nextRun: string | undefined;
  try {
    const body = (await req.json()) as { next_run?: string };
    nextRun = body?.next_run;
  } catch {
    nextRun = undefined;
  }
  const isScheduled = Boolean(nextRun);

  let currentEpoch: number;
  try {
    currentEpoch = await fetchCurrentEpoch();
  } catch (error) {
    return json({ ok: false, error: `failed to fetch current epoch: ${String(error)}` }, 502);
  }

  const url = new URL(req.url);
  const epochParam = url.searchParams.get("epoch");
  const targetEpoch = epochParam ? Number(epochParam) : currentEpoch - 1;

  if (!Number.isFinite(targetEpoch) || targetEpoch <= 0) {
    return json({ ok: false, error: `invalid target epoch ${targetEpoch}` }, 400);
  }

  // HTTP → preview only, never posts.
  if (!isScheduled) {
    try {
      const result = await announceEpoch(targetEpoch, { dryRun: true });
      return json({ ok: true, mode: "preview", currentEpoch, ...result });
    } catch (error) {
      return json({ ok: false, mode: "preview", error: String(error) }, 500);
    }
  }

  // Scheduled → idempotent post.
  let store: ReturnType<typeof getStore> | null = null;
  try {
    store = getStore(STORE_NAME);
    const last = Number((await store.get(LAST_EPOCH_KEY)) ?? 0);
    if (Number.isFinite(last) && last >= targetEpoch) {
      return json({ ok: true, mode: "scheduled", skipped: true, reason: "already announced", last, targetEpoch });
    }
  } catch (error) {
    // Blobs unavailable: proceed and post anyway (better to announce than not).
    console.warn("announce-epoch: Blobs read failed, proceeding without dedupe", error);
  }

  try {
    const result = await announceEpoch(targetEpoch, { dryRun: false });
    if (result.posted && store) {
      try {
        await store.set(LAST_EPOCH_KEY, String(targetEpoch));
      } catch (error) {
        console.warn("announce-epoch: Blobs write failed", error);
      }
    }
    return json({ ok: true, mode: "scheduled", currentEpoch, ...result });
  } catch (error) {
    // Don't record the epoch, so the next scheduled run retries.
    return json({ ok: false, mode: "scheduled", targetEpoch, error: String(error) }, 500);
  }
};

export const config = {
  schedule: "15 13,14,15 * * 3",
};
