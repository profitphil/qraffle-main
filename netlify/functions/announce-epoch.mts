import { getStore } from "@netlify/blobs";
import { announceEpoch, fetchCurrentEpoch } from "../../src/services/epochAnnouncement";

// Server-side epoch announcer (scheduled). Replaces the old client-side trigger that
// only fired when a browser tab happened to be open at the announcement minute.
//
// Posts the latest completed epoch's winners + dividend split to Discord, once,
// guarded by a Netlify Blobs "lastAnnouncedEpoch" marker so the retry run never
// double-posts. Runs twice (13:15 / 14:15 UTC Wednesday) to tolerate archiver lag
// after the ~12:00 UTC epoch rollover; Blobs makes the second run a no-op.
//
// For a dry-run preview (no posting) use the separate `announce-preview` HTTP
// function — Netlify blocks HTTP invocation of scheduled functions.
const STORE_NAME = "qraffle-announcements";
const LAST_EPOCH_KEY = "lastAnnouncedEpoch";

export default async (): Promise<Response> => {
  const currentEpoch = await fetchCurrentEpoch();
  const targetEpoch = currentEpoch - 1;
  if (targetEpoch <= 0) {
    return Response.json({ ok: false, reason: "no completed epoch yet", currentEpoch });
  }

  // Idempotency guard.
  let store: ReturnType<typeof getStore> | null = null;
  try {
    store = getStore(STORE_NAME);
    const last = Number((await store.get(LAST_EPOCH_KEY)) ?? 0);
    if (Number.isFinite(last) && last >= targetEpoch) {
      return Response.json({ ok: true, skipped: true, reason: "already announced", last, targetEpoch });
    }
  } catch (error) {
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
    return Response.json({ ok: true, currentEpoch, ...result });
  } catch (error) {
    // Don't record the epoch, so the next scheduled run retries.
    console.error("announce-epoch: announcement failed", error);
    return Response.json({ ok: false, targetEpoch, error: String(error) }, { status: 500 });
  }
};

export const config = {
  schedule: "15 13,14 * * 3",
};
