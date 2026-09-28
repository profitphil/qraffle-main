// Isomorphic epoch-announcement core used by the server-side Netlify scheduled
// function (netlify/functions/announce-epoch). Kept framework-agnostic so it can
// also run in the browser if the client ever needs to announce again.
//
// MUST stay dependency-light so esbuild can bundle it for the function: only web
// standards (fetch/atob/btoa/DataView), the QubicHelper package, and the relative
// raffleFees module. No `@/` alias, no axios, no import.meta.
// NOTE: explicit ".js" so the import resolves when Netlify ships this package
// externally in the function's node_modules (Node ESM requires the extension).
import { QubicHelper } from "@qubic-lib/qubic-ts-library/dist/qubicHelper.js";
import { getRaffleFeeRates } from "../utils/raffleFees";

const RPC_URL = "https://rpc.qubic.org";
const SC_INDEX = 19;
const SHAREHOLDER_COUNT = 676;
const EMBED_DESCRIPTION_MAX_LENGTH = 3500;

// Discord webhook URLs (updated 2026-09-27).
export const DISCORD_WINNERS_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1553913460012621855/XAocSp3DD60M2L-J_TTcyqlhl7wO4T4pvV_LLYgLXCeq0bVXZ2CdfHCSo8O8GRWDOEbx";
export const DISCORD_DIVIDENDS_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1553913047574388838/dEa_AQgm_IPtbGQ-8DdYHjNmdrXgd9x9sIBxNFbpgZ9MlQleAIcIzf2-_obM1HGd48RV";

const qHelper = new QubicHelper();

export type QuRaffle = {
  epochWinner: string;
  receivedAmount: number;
  entryAmount: number;
  numberOfMembers: number;
  winnerIndex: number;
  numberOfDaoMembers: number;
};

export type TokenRaffleWithIndex = {
  epochWinner: string;
  tokenIssuer: string;
  tokenName: string;
  entryAmount: number;
  numberOfMembers: number;
  winnerIndex: number;
  epoch: number;
  tokenRaffleIndex: number;
};

export type EpochWinnersPayload = {
  epoch: number;
  standardRaffle: (QuRaffle & { epoch: number }) | null;
  tokenRaffles: TokenRaffleWithIndex[];
};

// ── base64 / byte helpers (browser + Node 18+) ────────────────────────────────
const bytesToB64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
const b64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};
const u32ToRequestB64 = (n: number): string => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, n, true);
  return bytesToB64(bytes);
};

// uint64 (little-endian ASCII) → asset-name string; stops at first null byte.
const assetNameFromBig = (raw: bigint): string => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, raw, true);
  let out = "";
  for (const b of bytes) {
    if (b === 0) break;
    out += String.fromCharCode(b);
  }
  return out;
};

// ── smart-contract reads (mirror sc.service.ts offsets) ───────────────────────
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The public RPC intermittently returns 500/429; retry transient failures so a
// single hiccup doesn't abort an announcement (matters for the weekly scheduled run).
const fetchWithRetry = async (url: string, init?: RequestInit, attempts = 4): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`HTTP ${res.status}`);
      } else {
        return res; // non-retryable (4xx) — hand back for the caller to handle
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) await sleep(600 * (attempt + 1));
  }
  throw lastError instanceof Error ? lastError : new Error(`fetch failed: ${url}`);
};

const querySC = async (inputType: number, requestData = "", inputSize = 0): Promise<Uint8Array | null> => {
  const res = await fetchWithRetry(`${RPC_URL}/live/v1/querySmartContract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractIndex: SC_INDEX, inputType, inputSize, requestData }),
  });
  if (!res.ok) throw new Error(`querySmartContract inputType ${inputType} → HTTP ${res.status}`);
  const json = (await res.json()) as { responseData?: string };
  if (!json.responseData) return null;
  return b64ToBytes(json.responseData);
};

const getId = (bytes: Uint8Array, offset: number): Promise<string> =>
  qHelper.getIdentity(bytes.slice(offset, offset + 32));

export const fetchCurrentEpoch = async (): Promise<number> => {
  const res = await fetchWithRetry(`${RPC_URL}/live/v1/tick-info`);
  if (!res.ok) throw new Error(`tick-info → HTTP ${res.status}`);
  const json = (await res.json()) as { tickInfo?: { epoch?: number } };
  const epoch = json.tickInfo?.epoch;
  if (typeof epoch !== "number") throw new Error("tick-info returned no epoch");
  return epoch;
};

const getEndedQuRaffle = async (epoch: number): Promise<QuRaffle | null> => {
  const bytes = await querySC(5, u32ToRequestB64(epoch), 4);
  if (!bytes || bytes.length < 60) return null;
  const dv = new DataView(bytes.buffer);
  return {
    epochWinner: await getId(bytes, 0),
    receivedAmount: Number(dv.getBigUint64(32, true)),
    entryAmount: Number(dv.getBigUint64(40, true)),
    numberOfMembers: dv.getUint32(48, true),
    winnerIndex: dv.getUint32(52, true),
    numberOfDaoMembers: dv.getUint32(56, true),
  };
};

const getEpochRaffleIndexes = async (epoch: number): Promise<{ startIndex: number; endIndex: number } | null> => {
  const bytes = await querySC(7, u32ToRequestB64(epoch), 4);
  if (!bytes || bytes.length < 8) return null;
  const dv = new DataView(bytes.buffer);
  return { startIndex: dv.getUint32(0, true), endIndex: dv.getUint32(4, true) };
};

const getEndedTokenRaffle = async (index: number): Promise<(TokenRaffleWithIndex & { epoch: number }) | null> => {
  const bytes = await querySC(4, u32ToRequestB64(index), 4);
  if (!bytes || bytes.length < 92) return null;
  const dv = new DataView(bytes.buffer);
  return {
    epochWinner: await getId(bytes, 0),
    tokenIssuer: await getId(bytes, 32),
    tokenName: assetNameFromBig(dv.getBigUint64(64, true)),
    entryAmount: Number(dv.getBigUint64(72, true)),
    numberOfMembers: dv.getUint32(80, true),
    winnerIndex: dv.getUint32(84, true),
    epoch: dv.getUint32(88, true),
    tokenRaffleIndex: index,
  };
};

export const collectEpochWinners = async (epoch: number): Promise<EpochWinnersPayload | null> => {
  if (!Number.isFinite(epoch) || epoch <= 0) return null;

  const [standardRaffle, epochIndexes] = await Promise.all([getEndedQuRaffle(epoch), getEpochRaffleIndexes(epoch)]);

  const tokenRaffles: TokenRaffleWithIndex[] = [];
  if (epochIndexes && Number.isFinite(epochIndexes.startIndex) && Number.isFinite(epochIndexes.endIndex)) {
    for (let idx = epochIndexes.startIndex; idx <= epochIndexes.endIndex; idx++) {
      try {
        const raffle = await getEndedTokenRaffle(idx);
        if (raffle && raffle.epoch === epoch) tokenRaffles.push(raffle);
      } catch (error) {
        console.warn(`collectEpochWinners: failed token raffle index ${idx}`, error);
      }
    }
  }

  if (!standardRaffle && tokenRaffles.length === 0) return null;

  return {
    epoch,
    standardRaffle: standardRaffle ? { ...standardRaffle, epoch } : null,
    tokenRaffles,
  };
};

// ── formatting + embeds (mirror webhook.service.ts output) ────────────────────
const formatNumber = (value: number | undefined) =>
  typeof value !== "number" || Number.isNaN(value) ? "0" : value.toLocaleString();

const truncateMiddle = (str: string, charsToRemove: number) => {
  const start = Math.floor((str.length - charsToRemove) / 2);
  return str.slice(0, start) + "..." + str.slice(start + charsToRemove);
};

const winnerPercentFor = (epoch: number) => {
  const r = getRaffleFeeRates(epoch);
  return 100 - r.burn - r.dao - r.shareholder - r.charity - r.fee - r.entropy;
};

const calculateDividendBreakdown = (totalEntries: number, epoch: number) => {
  const rates = getRaffleFeeRates(epoch);
  const burn = Math.floor((totalEntries * rates.burn) / 100);
  const dao = Math.floor((totalEntries * rates.dao) / 100);
  const shareholders = Math.floor((totalEntries * rates.shareholder) / 100);
  const charity = Math.floor((totalEntries * rates.charity) / 100);
  const fee = Math.floor((totalEntries * rates.fee) / 100);
  const entropy = Math.floor((totalEntries * rates.entropy) / 100);
  const winner = Math.max(0, totalEntries - burn - dao - shareholders - charity - fee - entropy);
  return { totalEntries, burn, dao, shareholders, charity, fee, entropy, winner };
};

const chunkTextBlocks = (blocks: string[], maxLength = EMBED_DESCRIPTION_MAX_LENGTH): string[] => {
  if (!blocks.length) return [];
  const chunks: string[] = [];
  let current = "";
  for (const block of blocks) {
    if (!block) continue;
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) {
      chunks.push(current);
      current = "";
    }
    if (block.length <= maxLength) {
      current = block;
      continue;
    }
    for (let i = 0; i < block.length; i += maxLength) chunks.push(block.slice(i, i + maxLength));
  }
  if (current) chunks.push(current);
  return chunks;
};

export const buildWinnersEmbeds = (payload: EpochWinnersPayload): Array<Record<string, unknown>> => {
  const embeds: Array<Record<string, unknown>> = [];

  if (payload.standardRaffle) {
    const r = payload.standardRaffle;
    embeds.push({
      title: `Epoch ${payload.epoch} – Standard Raffle`,
      color: 0x5e8dee,
      fields: [
        { name: "Winner", value: `\`${truncateMiddle(r.epochWinner, 12)}\``, inline: true },
        { name: "Entries", value: formatNumber(r.numberOfMembers), inline: true },
        { name: "Entry Amount", value: formatNumber(r.entryAmount), inline: true },
        { name: "Received", value: formatNumber(r.receivedAmount), inline: true },
        { name: "Winner Index", value: formatNumber(r.winnerIndex), inline: true },
        { name: "DAO Members", value: formatNumber(r.numberOfDaoMembers), inline: true },
      ],
    });
  }

  if (payload.tokenRaffles.length) {
    const winnerPercent = winnerPercentFor(payload.epoch);
    const tokenBlocks = payload.tokenRaffles.map((raffle, index) => {
      const pool = Number(raffle.entryAmount) * Number(raffle.numberOfMembers || 0);
      const winnerAmount = Math.floor((pool * winnerPercent) / 100);
      return [
        `#${index + 1} ${raffle.tokenName || "Token"} (Index ${raffle.tokenRaffleIndex})`,
        `Winner: ${raffle.epochWinner}`,
        `Issuer: ${raffle.tokenIssuer}`,
        `Entries: ${formatNumber(raffle.numberOfMembers)} @ ${formatNumber(raffle.entryAmount)}`,
        `Pool: ${formatNumber(pool)}`,
        `Winner Share (${winnerPercent}%): ${formatNumber(winnerAmount)}`,
        `Winner Index: ${formatNumber(raffle.winnerIndex)}`,
      ].join("\n");
    });
    const chunks = chunkTextBlocks(tokenBlocks);
    for (const [i, chunk] of chunks.entries()) {
      embeds.push({
        title: `Epoch ${payload.epoch} – Token Raffles${chunks.length > 1 ? ` (Part ${i + 1})` : ""}`,
        color: 0xf0b429,
        description: chunk,
      });
    }
  }

  return embeds;
};

export const buildDividendEmbeds = (payload: EpochWinnersPayload): Array<Record<string, unknown>> => {
  const embeds: Array<Record<string, unknown>> = [];
  const rates = getRaffleFeeRates(payload.epoch);
  const winnerPercent = winnerPercentFor(payload.epoch);
  const daoMembers = payload.standardRaffle?.numberOfDaoMembers ?? 0;

  if (payload.standardRaffle) {
    const totalEntries = Number(payload.standardRaffle.entryAmount) * Number(payload.standardRaffle.numberOfMembers || 0);
    const b = calculateDividendBreakdown(totalEntries, payload.epoch);
    const daoPerMember = daoMembers > 0 ? Math.floor(b.dao / daoMembers) : 0;
    const shareholderPerMember = SHAREHOLDER_COUNT > 0 ? Math.floor(b.shareholders / SHAREHOLDER_COUNT) : 0;
    embeds.push({
      title: `Epoch ${payload.epoch} – QUBIC Dividend Split`,
      color: 0x34d399,
      fields: [
        { name: "Total Entries", value: formatNumber(b.totalEntries), inline: true },
        { name: `Winner (${winnerPercent}%)`, value: formatNumber(b.winner), inline: true },
        { name: `Burn (${rates.burn}%)`, value: formatNumber(b.burn), inline: true },
        {
          name: `DAO (${rates.dao}%)`,
          value: daoMembers > 0 ? `${formatNumber(b.dao)}\n${formatNumber(daoPerMember)} ea` : formatNumber(b.dao),
          inline: true,
        },
        {
          name: `Shareholders (${rates.shareholder}%)`,
          value: `${formatNumber(b.shareholders)}\n${formatNumber(shareholderPerMember)} ea`,
          inline: true,
        },
        { name: `Charity (${rates.charity}%)`, value: formatNumber(b.charity), inline: true },
        { name: `Platform (${rates.fee}%)`, value: formatNumber(b.fee), inline: true },
        ...(rates.entropy > 0 ? [{ name: `Entropy (${rates.entropy}%)`, value: formatNumber(b.entropy), inline: true }] : []),
      ],
    });
  }

  if (payload.tokenRaffles.length) {
    const tokenBlocks: string[] = [];
    for (const raffle of payload.tokenRaffles) {
      const totalEntries = Number(raffle.entryAmount) * Number(raffle.numberOfMembers || 0);
      if (!totalEntries) continue;
      const b = calculateDividendBreakdown(totalEntries, payload.epoch);
      const daoPerMember = daoMembers > 0 ? Math.floor(b.dao / daoMembers) : 0;
      const shareholderPerMember = SHAREHOLDER_COUNT > 0 ? Math.floor(b.shareholders / SHAREHOLDER_COUNT) : 0;
      tokenBlocks.push(
        [
          `${raffle.tokenName || "Token"} (Index ${raffle.tokenRaffleIndex})`,
          `Total Entries: ${formatNumber(totalEntries)}`,
          `Winner (${winnerPercent}%): ${formatNumber(b.winner)}`,
          `Burn (${rates.burn}%): ${formatNumber(b.burn)}`,
          `DAO (${rates.dao}%): ${formatNumber(b.dao)}${daoMembers > 0 ? ` (${formatNumber(daoPerMember)} ea)` : ""}`,
          `Shareholders (${rates.shareholder}%): ${formatNumber(b.shareholders)} (${formatNumber(shareholderPerMember)} ea)`,
          `Charity (${rates.charity}%): ${formatNumber(b.charity)}`,
          `Platform (${rates.fee}%): ${formatNumber(b.fee)}`,
          ...(rates.entropy > 0 ? [`Entropy (${rates.entropy}%): ${formatNumber(b.entropy)}`] : []),
        ].join("\n"),
      );
    }
    const chunks = chunkTextBlocks(tokenBlocks);
    for (const [i, chunk] of chunks.entries()) {
      embeds.push({
        title: `Epoch ${payload.epoch} – Token Dividend Splits${chunks.length > 1 ? ` (Part ${i + 1})` : ""}`,
        color: 0xfcd34d,
        description: chunk,
      });
    }
  }

  return embeds;
};

const postToDiscord = async (url: string, body: Record<string, unknown>): Promise<void> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Discord webhook responded with status ${res.status}`);
};

export type AnnounceResult = {
  epoch: number;
  posted: boolean;
  dryRun: boolean;
  reason?: string;
  winnersEmbeds?: Array<Record<string, unknown>>;
  dividendEmbeds?: Array<Record<string, unknown>>;
};

/**
 * Collect an epoch's results and either preview (dryRun) or post them to Discord.
 * Posts winners + dividend split as two messages, matching the historical format.
 */
export const announceEpoch = async (epoch: number, options?: { dryRun?: boolean }): Promise<AnnounceResult> => {
  const dryRun = options?.dryRun ?? false;
  const payload = await collectEpochWinners(epoch);
  if (!payload) return { epoch, posted: false, dryRun, reason: "no raffle data for epoch" };

  const winnersEmbeds = buildWinnersEmbeds(payload);
  const dividendEmbeds = buildDividendEmbeds(payload);

  if (dryRun) return { epoch, posted: false, dryRun: true, winnersEmbeds, dividendEmbeds };

  await postToDiscord(DISCORD_WINNERS_WEBHOOK_URL, {
    username: "Qraffle Epoch Bot",
    content: `Epoch (${epoch}) has ended! 🎉`,
    embeds: winnersEmbeds,
    allowed_mentions: { parse: [] },
  });
  await postToDiscord(DISCORD_DIVIDENDS_WEBHOOK_URL, {
    username: "Qraffle Dividend Bot",
    content: `Epoch (${epoch}) dividend distribution 💸`,
    embeds: dividendEmbeds,
    allowed_mentions: { parse: [] },
  });

  return { epoch, posted: true, dryRun: false };
};
