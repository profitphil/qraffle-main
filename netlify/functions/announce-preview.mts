import { announceEpoch, fetchCurrentEpoch } from "../../src/services/epochAnnouncement";

// HTTP preview / health-check for the epoch announcer. ALWAYS a dry run — it returns
// the Discord embeds it *would* post but never sends anything. Handy for verifying the
// server can reach the RPC and that the winner/dividend content is correct.
//
//   GET /.netlify/functions/announce-preview            → previews latest completed epoch
//   GET /.netlify/functions/announce-preview?epoch=229  → previews a specific epoch
export default async (req: Request): Promise<Response> => {
  let currentEpoch: number;
  try {
    currentEpoch = await fetchCurrentEpoch();
  } catch (error) {
    return Response.json({ ok: false, error: `failed to fetch current epoch: ${String(error)}` }, { status: 502 });
  }

  const epochParam = new URL(req.url).searchParams.get("epoch");
  const targetEpoch = epochParam ? Number(epochParam) : currentEpoch - 1;
  if (!Number.isFinite(targetEpoch) || targetEpoch <= 0) {
    return Response.json({ ok: false, error: `invalid target epoch ${targetEpoch}` }, { status: 400 });
  }

  try {
    const result = await announceEpoch(targetEpoch, { dryRun: true });
    return Response.json({ ok: true, mode: "preview", currentEpoch, ...result });
  } catch (error) {
    return Response.json({ ok: false, mode: "preview", error: String(error) }, { status: 500 });
  }
};
