import { useQuery } from "@tanstack/react-query";
import { QubicHelper } from "@qubic-lib/qubic-ts-library/dist/qubicHelper";
import { fetchArchiverStatus, fetchTxHistory } from "@/services/rpc.service";
import { SC_INDEX } from "@/services/sc.service";
import { assetNameConvert } from "@/utils";
import type { EndedAssetRaffleRow } from "@/hooks/useEndedAssetRaffles";

export type BundleItem = {
  assetName: string;
  numberOfShares: number;
};

const CREATE_ASSET_RAFFLE_INPUT_TYPE = 9;
const BUNDLE_SLOTS = 4;
const SLOT_SIZE = 48; // issuer(32) + assetName u64(8) + numberOfShares s64(8)

const qHelper = new QubicHelper();
const normalizeIdentity = (id: string) => id.replace(/\s+/g, "");

const getContractId = async (contractIndex: number) => {
  const bytes = new Uint8Array(32);
  bytes[0] = contractIndex;
  return normalizeIdentity(await qHelper.getIdentity(bytes));
};

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

type DecodedCreate = {
  reservePriceQu: number;
  entryTicketQu: number;
  bundleSize: number;
  items: BundleItem[];
};

// createAssetRaffle_input: 4 × (issuer 32B + assetName u64 + numberOfShares s64),
// then bundleSize u32, 4B padding, reservePriceQu u64, entryTicketQu u64 = 216 bytes.
const decodeCreatePayload = (inputHex: string): DecodedCreate | null => {
  const bytes = hexToBytes(inputHex);
  if (bytes.length < 216) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const bundleSize = view.getUint32(192, true);
  const reservePriceQu = Number(view.getBigUint64(200, true));
  const entryTicketQu = Number(view.getBigUint64(208, true));

  const items: BundleItem[] = [];
  for (let i = 0; i < BUNDLE_SLOTS && i < bundleSize; i++) {
    const off = i * SLOT_SIZE;
    const assetNameRaw = view.getBigUint64(off + 32, true);
    if (assetNameRaw === 0n) continue;
    const numberOfShares = Number(view.getBigUint64(off + 40, true));
    items.push({
      assetName: assetNameConvert(assetNameRaw) as string,
      numberOfShares,
    });
  }

  return { reservePriceQu, entryTicketQu, bundleSize, items };
};

const getEpochTickRange = async (epoch: number): Promise<{ startTick: number; endTick: number } | null> => {
  const status = await fetchArchiverStatus();
  const interval = status?.processedTickIntervalsPerEpoch?.find((e) => e.epoch === epoch);
  if (interval?.intervals?.length) {
    const first = interval.intervals[0];
    const last = interval.intervals[interval.intervals.length - 1];
    return { startTick: first.initialProcessedTick, endTick: last.lastProcessedTick };
  }
  return null;
};

/**
 * The QRaffle contract does not retain per-item bundle contents for ended raffles
 * (the ended-raffle view returns zeroed items). But the full bundle is permanently
 * recorded in each raffle's createAssetRaffle transaction. This hook reconstructs
 * the bundle for each ended raffle by scanning its creator's transactions in the
 * raffle's epoch and matching on (reservePriceQu, entryTicketQu, bundleSize).
 */
export const useAssetRaffleBundles = (rows: EndedAssetRaffleRow[]) => {
  // Stable cache key: which raffles (by index) we're resolving.
  const signature = rows
    .map((r) => r.index)
    .sort((a, b) => a - b)
    .join(",");

  const { data, isLoading } = useQuery({
    queryKey: ["assetRaffleBundles", signature],
    queryFn: async () => {
      const bundlesByIndex: Record<number, BundleItem[]> = {};
      if (rows.length === 0) return bundlesByIndex;

      const contractId = await getContractId(SC_INDEX);

      // Group rows by creator+epoch so we scan each creator's history once.
      const groups = new Map<string, EndedAssetRaffleRow[]>();
      for (const row of rows) {
        const key = `${row.creator}|${row.epoch}`;
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(row);
      }

      for (const [key, groupRows] of groups) {
        const [creator, epochStr] = key.split("|");
        const epoch = Number(epochStr);
        try {
          const range = await getEpochTickRange(epoch);
          if (!range) continue;

          const history = await fetchTxHistory(creator, range.startTick, range.endTick);
          const decodedCreates: DecodedCreate[] = [];
          for (const tick of history?.transactions || []) {
            for (const item of tick.transactions || []) {
              const tx = item.transaction;
              if (!tx) continue;
              if (tx.inputType !== CREATE_ASSET_RAFFLE_INPUT_TYPE) continue;
              if (normalizeIdentity(tx.destId) !== contractId) continue;
              const decoded = decodeCreatePayload(tx.inputHex || "");
              if (decoded) decodedCreates.push(decoded);
            }
          }

          // Match each ended raffle to a creation by (reserve, entry, bundleSize).
          // Consume matched creations so identical raffles don't collide.
          const used = new Set<number>();
          for (const row of groupRows) {
            const matchIdx = decodedCreates.findIndex(
              (c, i) =>
                !used.has(i) &&
                c.reservePriceQu === row.reservePriceQu &&
                c.entryTicketQu === row.entryTicketQu &&
                c.bundleSize === row.bundleSize,
            );
            if (matchIdx >= 0) {
              used.add(matchIdx);
              bundlesByIndex[row.index] = decodedCreates[matchIdx].items;
            }
          }
        } catch (err) {
          console.warn(`useAssetRaffleBundles: failed to reconstruct bundles for ${key}`, err);
        }
      }

      return bundlesByIndex;
    },
    enabled: rows.length > 0,
    staleTime: Infinity, // ended epochs are immutable
    gcTime: Infinity,
    retry: 1,
  });

  return { bundlesByIndex: data || {}, isLoading };
};
