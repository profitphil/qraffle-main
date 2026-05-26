import { truncateMiddle } from "@/utils/base.utils";
import {
  QRAFFLE_BURN_FEE,
  QRAFFLE_CHARITY_FEE,
  QRAFFLE_FEE,
  QRAFFLE_REGISTER_FEE,
  QRAFFLE_SHRAEHOLDER_FEE,
} from "@/utils/constants";
import {
  getEndedQuRaffle,
  getEndedTokenRaffle,
  getEpochRaffleIndexes,
  type QuRaffle,
  type TokenRaffle,
} from "./sc.service";

const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1486175897307447428/TCg6hiqTKZnqGZV7k9y5FeEDHS0G5sUWXq-szQawpSF6xafTrLUQOQwnADaIvbZQvchr";
const DISCORD_DIVIDENDS_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1486176089331077130/FuS15TgB06KhZoHTOeUCn-kAKuPTcRpWtf654NGAxoNGAYQBwQWAI0RZdTHFu02LE9dc";
const SHAREHOLDER_COUNT = 676;
const EMBED_DESCRIPTION_MAX_LENGTH = 3500;
const EPOCH_FEE_UPDATE_START = 210;

export type TokenRaffleWithIndex = TokenRaffle & { tokenRaffleIndex: number };

export const sendDividendBreakdownToDiscord = async (epoch: number): Promise<boolean> => {
  try {
    const payload = await collectEpochWinners(epoch);
    if (!payload) {
      console.warn(`sendDividendBreakdownToDiscord: no raffle data for epoch ${epoch}`);
      return false;
    }

    const embeds = buildDividendEmbeds(payload);
    if (!embeds.length) {
      console.warn(`sendDividendBreakdownToDiscord: no dividend embeds generated for epoch ${epoch}`);
      return false;
    }

    const response = await fetch(DISCORD_DIVIDENDS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Qraffle Dividend Bot",
        content: `Epoch (${epoch}) dividend distribution 💸`,
        embeds,
        allowed_mentions: { parse: [] },
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord dividends webhook responded with status ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("sendDividendBreakdownToDiscord: failed", error);
    return false;
  }
};

export type EpochWinnersPayload = {
  epoch: number;
  standardRaffle: (QuRaffle & { epoch: number }) | null;
  tokenRaffles: TokenRaffleWithIndex[];
};

export const collectEpochWinners = async (epoch: number): Promise<EpochWinnersPayload | null> => {
  if (!Number.isFinite(epoch) || epoch <= 0) {
    return null;
  }

  const [standardRaffle, epochIndexes] = await Promise.all([
    getEndedQuRaffle(epoch),
    getEpochRaffleIndexes(epoch),
  ]);

  const tokenRaffles: TokenRaffleWithIndex[] = [];

  if (epochIndexes && typeof epochIndexes.startIndex === "number" && typeof epochIndexes.endIndex === "number") {
    for (let idx = epochIndexes.startIndex; idx <= epochIndexes.endIndex; idx++) {
      try {
        const raffle = await getEndedTokenRaffle(idx);
        if (raffle && raffle.epoch === epoch) {
          tokenRaffles.push({ ...raffle, tokenRaffleIndex: idx });
        }
      } catch (error) {
        console.warn(`collectEpochWinners: failed to fetch token raffle index ${idx}`, error);
      }
    }
  }

  if (!standardRaffle && tokenRaffles.length === 0) {
    return null;
  }

  return {
    epoch,
    standardRaffle: standardRaffle ? { ...standardRaffle, epoch } : null,
    tokenRaffles,
  };
};

const formatNumber = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString();
};

const getFeeRatesForEpoch = (epoch: number) => {
  const burn = epoch >= EPOCH_FEE_UPDATE_START ? 5 : QRAFFLE_BURN_FEE;
  const shareholders = epoch >= EPOCH_FEE_UPDATE_START ? 8 : QRAFFLE_SHRAEHOLDER_FEE;

  return {
    burn,
    dao: QRAFFLE_REGISTER_FEE,
    shareholders,
    charity: QRAFFLE_CHARITY_FEE,
    fee: QRAFFLE_FEE,
  };
};

const calculateDividendBreakdown = (totalEntries: number, epoch: number) => {
  const rates = getFeeRatesForEpoch(epoch);
  const burn = Math.floor((totalEntries * rates.burn) / 100);
  const dao = Math.floor((totalEntries * rates.dao) / 100);
  const shareholders = Math.floor((totalEntries * rates.shareholders) / 100);
  const charity = Math.floor((totalEntries * rates.charity) / 100);
  const fee = Math.floor((totalEntries * rates.fee) / 100);
  const winner = Math.max(0, totalEntries - burn - dao - shareholders - charity - fee);

  return {
    totalEntries,
    burn,
    dao,
    shareholders,
    charity,
    fee,
    winner,
  };
};

const buildDividendEmbedFields = (
  breakdown: ReturnType<typeof calculateDividendBreakdown>,
  epoch: number,
  options?: { daoMembers?: number; includePerMember?: boolean },
) => {
  const rates = getFeeRatesForEpoch(epoch);
  const winnerPercent = 100 - rates.burn - rates.dao - rates.shareholders - rates.charity - rates.fee;
  const daoMembers = Math.max(0, options?.daoMembers ?? 0);
  const daoPerMember = daoMembers > 0 ? Math.floor(breakdown.dao / daoMembers) : 0;
  const shareholderPerMember = SHAREHOLDER_COUNT > 0 ? Math.floor(breakdown.shareholders / SHAREHOLDER_COUNT) : 0;

  return [
    {
      name: "Total Entries",
      value: formatNumber(breakdown.totalEntries),
      inline: true,
    },
    {
      name: `Winner (${winnerPercent}%)`,
      value: formatNumber(breakdown.winner),
      inline: true,
    },
    {
      name: `Burn (${rates.burn}%)`,
      value: formatNumber(breakdown.burn),
      inline: true,
    },
    {
      name: `DAO (${rates.dao}%)`,
      value:
        daoMembers > 0 && options?.includePerMember
          ? `${formatNumber(breakdown.dao)}\n${formatNumber(daoPerMember)} ea`
          : formatNumber(breakdown.dao),
      inline: true,
    },
    {
      name: `Shareholders (${rates.shareholders}%)`,
      value:
        options?.includePerMember
          ? `${formatNumber(breakdown.shareholders)}\n${formatNumber(shareholderPerMember)} ea`
          : formatNumber(breakdown.shareholders),
      inline: true,
    },
    {
      name: `Charity (${rates.charity}%)`,
      value: formatNumber(breakdown.charity),
      inline: true,
    },
    {
      name: `Platform (${rates.fee}%)`,
      value: formatNumber(breakdown.fee),
      inline: true,
    },
  ];
};

const chunkTextBlocks = (blocks: string[], maxLength = EMBED_DESCRIPTION_MAX_LENGTH): string[] => {
  if (!blocks.length) return [];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const block of blocks) {
    if (!block) continue;

    const candidateChunk = currentChunk ? `${currentChunk}\n\n${block}` : block;
    if (candidateChunk.length <= maxLength) {
      currentChunk = candidateChunk;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    if (block.length <= maxLength) {
      currentChunk = block;
      continue;
    }

    for (let i = 0; i < block.length; i += maxLength) {
      chunks.push(block.slice(i, i + maxLength));
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};

const buildEmbeds = (payload: EpochWinnersPayload) => {
  const embeds: Array<Record<string, unknown>> = [];

  if (payload.standardRaffle) {
    const { standardRaffle } = payload;
    embeds.push({
      title: `Epoch ${payload.epoch} – Standard Raffle`,
      color: 0x5e8dee,
      fields: [
        {
          name: "Winner",
          value: `\`${truncateMiddle(standardRaffle.epochWinner, 12)}\``,
          inline: true,
        },
        {
          name: "Entries",
          value: formatNumber(standardRaffle.numberOfMembers),
          inline: true,
        },
        {
          name: "Entry Amount",
          value: formatNumber(standardRaffle.entryAmount),
          inline: true,
        },
        {
          name: "Received",
          value: formatNumber(standardRaffle.receivedAmount),
          inline: true,
        },
        {
          name: "Winner Index",
          value: formatNumber(standardRaffle.winnerIndex),
          inline: true,
        },
        {
          name: "DAO Members",
          value: formatNumber(standardRaffle.numberOfDaoMembers),
          inline: true,
        },
      ],
    });
  }

  if (payload.tokenRaffles.length) {
    const winnerPercent =
      100 -
      getFeeRatesForEpoch(payload.epoch).burn -
      getFeeRatesForEpoch(payload.epoch).dao -
      getFeeRatesForEpoch(payload.epoch).shareholders -
      getFeeRatesForEpoch(payload.epoch).charity -
      getFeeRatesForEpoch(payload.epoch).fee;

    const tokenBlocks = payload.tokenRaffles.map((raffle, index) => {
      const totalEntriesAmount = Number(raffle.entryAmount) * Number(raffle.numberOfMembers || 0);
      const winnerAmount = Math.floor((totalEntriesAmount * winnerPercent) / 100);

      return [
        `#${index + 1} ${raffle.tokenName || "Token"} (Index ${raffle.tokenRaffleIndex})`,
        `Winner: ${raffle.epochWinner}`,
        `Issuer: ${raffle.tokenIssuer}`,
        `Entries: ${formatNumber(raffle.numberOfMembers)} @ ${formatNumber(raffle.entryAmount)}`,
        `Pool: ${formatNumber(totalEntriesAmount)}`,
        `Winner Share (${winnerPercent}%): ${formatNumber(winnerAmount)}`,
        `Winner Index: ${formatNumber(raffle.winnerIndex)}`,
      ].join("\n");
    });

    const chunks = chunkTextBlocks(tokenBlocks);
    for (const [chunkIndex, chunk] of chunks.entries()) {
      embeds.push({
        title: `Epoch ${payload.epoch} – Token Raffles${chunks.length > 1 ? ` (Part ${chunkIndex + 1})` : ""}`,
        color: 0xf0b429,
        description: chunk,
      });
    }
  }

  return embeds;
};

const buildContent = (payload: EpochWinnersPayload) => `Epoch (${payload.epoch}) has ended! 🎉`;

const buildDividendEmbeds = (payload: EpochWinnersPayload) => {
  const embeds: Array<Record<string, unknown>> = [];
  const feeRates = getFeeRatesForEpoch(payload.epoch);
  const winnerPercent = 100 - feeRates.burn - feeRates.dao - feeRates.shareholders - feeRates.charity - feeRates.fee;

  const daoMembers = payload.standardRaffle?.numberOfDaoMembers ?? 0;

  if (payload.standardRaffle) {
    const totalEntries = Number(payload.standardRaffle.entryAmount) * Number(payload.standardRaffle.numberOfMembers || 0);
    const breakdown = calculateDividendBreakdown(totalEntries, payload.epoch);

    embeds.push({
      title: `Epoch ${payload.epoch} – QUBIC Dividend Split`,
      color: 0x34d399,
      fields: buildDividendEmbedFields(breakdown, payload.epoch, { daoMembers, includePerMember: true }),
    });
  }

  if (payload.tokenRaffles.length) {
    const tokenBlocks: string[] = [];
    for (const tokenRaffle of payload.tokenRaffles) {
      const totalEntries = Number(tokenRaffle.entryAmount) * Number(tokenRaffle.numberOfMembers || 0);
      if (!totalEntries) continue;
      const breakdown = calculateDividendBreakdown(totalEntries, payload.epoch);
      const daoPerMember = daoMembers > 0 ? Math.floor(breakdown.dao / daoMembers) : 0;
      const shareholderPerMember = SHAREHOLDER_COUNT > 0 ? Math.floor(breakdown.shareholders / SHAREHOLDER_COUNT) : 0;

      tokenBlocks.push(
        [
          `${tokenRaffle.tokenName || "Token"} (Index ${tokenRaffle.tokenRaffleIndex})`,
          `Total Entries: ${formatNumber(totalEntries)}`,
          `Winner (${winnerPercent}%): ${formatNumber(breakdown.winner)}`,
          `Burn (${feeRates.burn}%): ${formatNumber(breakdown.burn)}`,
          `DAO (${feeRates.dao}%): ${formatNumber(breakdown.dao)}${daoMembers > 0 ? ` (${formatNumber(daoPerMember)} ea)` : ""}`,
          `Shareholders (${feeRates.shareholders}%): ${formatNumber(breakdown.shareholders)} (${formatNumber(shareholderPerMember)} ea)`,
          `Charity (${feeRates.charity}%): ${formatNumber(breakdown.charity)}`,
          `Platform (${feeRates.fee}%): ${formatNumber(breakdown.fee)}`,
        ].join("\n"),
      );
    }

    const chunks = chunkTextBlocks(tokenBlocks);
    for (const [index, chunk] of chunks.entries()) {
      embeds.push({
        title: `Epoch ${payload.epoch} – Token Dividend Splits${chunks.length > 1 ? ` (Part ${index + 1})` : ""}`,
        color: 0xfcd34d,
        description: chunk,
      });
    }
  }

  return embeds;
};

export const sendEpochWinnersToDiscord = async (epoch: number): Promise<boolean> => {
  try {
    const payload = await collectEpochWinners(epoch);
    if (!payload) {
      console.warn(`sendEpochWinnersToDiscord: no winners found for epoch ${epoch}`);
      return false;
    }

    const embeds = buildEmbeds(payload);
    const content = buildContent(payload);

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Qraffle Epoch Bot",
        content,
        embeds,
        allowed_mentions: { parse: [] },
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook responded with status ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("sendEpochWinnersToDiscord: failed", error);
    return false;
  }
};
