import { base64ToUint8Array, uint8ArrayToBase64, createPayload } from "@/utils";
import { QubicHelper } from "@qubic-lib/qubic-ts-library/dist/qubicHelper";

import { createSCTx } from "./tx.service";
import { fetchQuerySC } from "./rpc.service";
import {
  QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE,
  QRAFFLE_MAX_ASSETS_PER_BUNDLE,
  QRAFFLE_REGISTER_AMOUNT,
  TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE,
} from "@/utils/constants";
import { assetNameConvert } from "@/utils/tx.utils";

const qHelper = new QubicHelper();
export const SC_INDEX = 19;

const createDataView = (size = 32) => new DataView(new Uint8Array(size).buffer);

const getResponseValues = (res: any) => {
  if (!res.responseData) return null;
  const responseView = new DataView(base64ToUint8Array(res.responseData).buffer);
  const responseArray = base64ToUint8Array(res.responseData);

  return {
    getUint64: (offset: number) => Number(responseView.getBigUint64(offset, true)),
    // For uint64 fields that pack ASCII (asset names): full 64-bit precision.
    // 7-char names exceed Number.MAX_SAFE_INTEGER and corrupt via getUint64.
    getBigUint64: (offset: number) => responseView.getBigUint64(offset, true),
    getUint32: (offset: number) => responseView.getUint32(offset, true),
    getUint8: (offset: number) => responseView.getUint8(offset),
    getID: (offset: number) => qHelper.getIdentity(responseArray.slice(offset, offset + 32)),
  };
};

// Query functions
export const getRegisters = async (
  offset: number,
  limit: number,
): Promise<{ registers: string[]; returnCode: number }> => {
  const view = createDataView(8);
  view.setUint32(0, offset, true);
  view.setUint32(4, limit, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 1,
    inputSize: 8,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData)
    return {
      registers: [],
      returnCode: 0,
    };

  const resultByteLength = base64ToUint8Array(res.responseData).byteLength;
  const values = getResponseValues(res);

  const returnCode = values?.getUint64(resultByteLength - 8);
  if (returnCode !== 0)
    return {
      registers: [],
      returnCode: returnCode || 0,
    };
  const registers = [];
  for (let i = 0; i < 20; i++) {
    registers.push((await values?.getID(i * 32)) || "");
  }

  return {
    registers: registers,
    returnCode: returnCode || 0,
  };
};

export interface Analytics {
  currentQuRaffleAmount: number;
  totalBurnAmount: number;
  totalCharityAmount: number;
  totalShareholderAmount: number;
  totalRegisterAmount: number;
  totalFeeAmount: number;
  totalWinnerAmount: number;
  lagestWinnerAmount: number;
  numberOfRegisters: number;
  numberOfProposals: number;
  numberOfQuRaffleMembers: number;
  numberOfActiveTokenRaffle: number;
  numberOfEndedTokenRaffle: number;
  numberOfEntryAmountSubmitted: number;
}

export interface TokenRaffle {
  epochWinner: string;
  tokenIssuer: string;
  tokenName: string;
  entryAmount: number;
  numberOfMembers: number;
  winnerIndex: number;
  epoch: number;
}

export interface QuRaffle {
  epochWinner: string;
  receivedAmount: number;
  entryAmount: number;
  numberOfMembers: number;
  winnerIndex: number;
  numberOfDaoMembers?: number;
}

export const getAnalytics = async (): Promise<Analytics> => {
  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 2,
    inputSize: 0,
    requestData: "",
  });

  const values = getResponseValues(res);
  if (!values) return {} as Analytics;

  return {
    currentQuRaffleAmount: values.getUint64(0),
    totalBurnAmount: values.getUint64(8),
    totalCharityAmount: values.getUint64(16),
    totalShareholderAmount: values.getUint64(24),
    totalRegisterAmount: values.getUint64(32),
    totalFeeAmount: values.getUint64(40),
    totalWinnerAmount: values.getUint64(48),
    lagestWinnerAmount: values.getUint64(56),
    numberOfRegisters: values.getUint32(64),
    numberOfProposals: values.getUint32(68),
    numberOfQuRaffleMembers: values.getUint32(72),
    numberOfActiveTokenRaffle: values.getUint32(76),
    numberOfEndedTokenRaffle: values.getUint32(80),
    numberOfEntryAmountSubmitted: values.getUint32(84),
  };
};

export const getActiveProposal = async (indexOfProposal: number) => {
  const view = createDataView(4);
  view.setUint32(0, indexOfProposal, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 3,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    tokenIssuer: await values.getID(0),
    proposer: await values.getID(32),
    tokenName: assetNameConvert(values.getBigUint64(64)),
    entryAmount: values.getUint64(72),
    nYes: values.getUint32(80),
    nNo: values.getUint32(84),
  };
};

export const getEndedTokenRaffle = async (indexOfRaffle: number): Promise<TokenRaffle | null> => {
  const view = createDataView(4);
  view.setUint32(0, indexOfRaffle, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 4,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    epochWinner: await values.getID(0),
    tokenIssuer: await values.getID(32),
    tokenName: assetNameConvert(values.getBigUint64(64)) as string,
    entryAmount: values.getUint64(72),
    numberOfMembers: values.getUint32(80),
    winnerIndex: values.getUint32(84),
    epoch: values.getUint32(88),
  };
};

export const getEndedQuRaffle = async (epoch: number): Promise<QuRaffle | null> => {
  const view = createDataView(4);
  view.setUint32(0, epoch, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 5,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    epochWinner: await values.getID(0),
    receivedAmount: values.getUint64(32),
    entryAmount: values.getUint64(40),
    numberOfMembers: values.getUint32(48),
    winnerIndex: values.getUint32(52),
    numberOfDaoMembers: values.getUint32(56),
  };
};

export const getActiveTokenRaffle = async (indexOfTokenRaffle: number) => {
  const view = createDataView(4);
  view.setUint32(0, indexOfTokenRaffle, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 6,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    tokenIssuer: await values.getID(0),
    tokenName: assetNameConvert(values.getBigUint64(32)) as string,
    entryAmount: values.getUint64(40),
    numberOfMembers: values.getUint32(48),
  };
};

export const getEpochRaffleIndexes = async (epoch: number) => {
  const view = createDataView(4);
  view.setUint32(0, epoch, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 7,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    startIndex: values.getUint32(0),
    endIndex: values.getUint32(4),
  };
};

export const getQuRaffleEntryAmountPerUser = async (user: string) => {
  const view = createDataView(32);
  const id = qHelper.getIdentityBytes(user);
  for (let i = 0; i < 32; i++) {
    view.setUint8(i, id[i]);
  }

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 8,
    inputSize: 32,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    entryAmount: values.getUint64(0),
  };
};

export const getQuRaffleEntryAverageAmount = async () => {
  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 9,
    inputSize: 0,
    requestData: "",
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    entryAverageAmount: values.getUint64(0),
  };
};

// ── Asset (bundle) raffle types ──────────────────────────────────────────────
// Byte offsets below mirror the natural C++ struct layout in QRaffle.h
// (feature/qraffle-asset): ids are 32 bytes, uint64s 8-byte aligned.

export interface AssetRaffle {
  creator: string;
  reservePriceQu: number;
  entryTicketQu: number;
  totalTicketsPaidQu: number;
  numberOfBuyers: number;
  totalTickets: number;
  bundleSize: number;
  epoch: number;
  returnCode: number;
}

export interface AssetRaffleBundleItem {
  assetIssuer: string;
  assetName: string;
  numberOfShares: number;
  returnCode: number;
}

export interface AssetRaffleBuyer {
  buyer: string;
  ticketCount: number;
  returnCode: number;
}

export interface EndedAssetRaffle {
  creator: string;
  epochWinner: string;
  reservePriceQu: number;
  entryTicketQu: number;
  grossPoolQu: number;
  creatorPaidQu: number;
  totalTickets: number;
  numberOfBuyers: number;
  bundleSize: number;
  epoch: number;
  reserveMet: boolean;
  returnCode: number;
}

export interface AssetRaffleAnalytics {
  totalAssetRaffleProposalFees: number;
  totalAssetRaffleCreatorPaid: number;
  totalAssetRaffleRefunded: number;
  numberOfActiveAssetRaffles: number;
  numberOfEndedAssetRaffles: number;
  totalAssetRafflesCreated: number;
  totalAssetRafflesSucceeded: number;
  totalAssetRafflesFailed: number;
  returnCode: number;
}

export interface AssetRaffleBundleItemInput {
  issuer: string;
  assetName: string;
  numberOfShares: number;
}

// ── Asset raffle query functions ─────────────────────────────────────────────

export const getActiveAssetRaffle = async (indexOfAssetRaffle: number): Promise<AssetRaffle | null> => {
  const view = createDataView(4);
  view.setUint32(0, indexOfAssetRaffle, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 10,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    creator: await values.getID(0),
    reservePriceQu: values.getUint64(32),
    entryTicketQu: values.getUint64(40),
    totalTicketsPaidQu: values.getUint64(48),
    numberOfBuyers: values.getUint32(56),
    totalTickets: values.getUint32(60),
    bundleSize: values.getUint32(64),
    epoch: values.getUint32(68),
    returnCode: values.getUint32(72),
  };
};

export const getActiveAssetRaffleBundleItem = async (
  indexOfAssetRaffle: number,
  itemIndex: number,
): Promise<AssetRaffleBundleItem | null> => {
  const view = createDataView(8);
  view.setUint32(0, indexOfAssetRaffle, true);
  view.setUint32(4, itemIndex, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 11,
    inputSize: 8,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    assetIssuer: await values.getID(0),
    assetName: assetNameConvert(values.getBigUint64(32)) as string,
    numberOfShares: values.getUint64(40),
    returnCode: values.getUint32(48),
  };
};

export const getActiveAssetRaffleBuyer = async (
  indexOfAssetRaffle: number,
  buyerIndex: number,
): Promise<AssetRaffleBuyer | null> => {
  const view = createDataView(8);
  view.setUint32(0, indexOfAssetRaffle, true);
  view.setUint32(4, buyerIndex, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 12,
    inputSize: 8,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    buyer: await values.getID(0),
    ticketCount: values.getUint32(32),
    returnCode: values.getUint32(36),
  };
};

export const getEndedAssetRaffle = async (indexOfRaffle: number): Promise<EndedAssetRaffle | null> => {
  const view = createDataView(4);
  view.setUint32(0, indexOfRaffle, true);

  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 13,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    creator: await values.getID(0),
    epochWinner: await values.getID(32),
    reservePriceQu: values.getUint64(64),
    entryTicketQu: values.getUint64(72),
    grossPoolQu: values.getUint64(80),
    creatorPaidQu: values.getUint64(88),
    totalTickets: values.getUint32(96),
    numberOfBuyers: values.getUint32(100),
    bundleSize: values.getUint32(104),
    epoch: values.getUint32(108),
    reserveMet: values.getUint8(112) === 1,
    returnCode: values.getUint32(116),
  };
};

export const getAssetRaffleAnalytics = async (): Promise<AssetRaffleAnalytics | null> => {
  const res = await fetchQuerySC({
    contractIndex: SC_INDEX,
    inputType: 14,
    inputSize: 0,
    requestData: "",
  });

  const values = getResponseValues(res);
  if (!values) return null;

  return {
    totalAssetRaffleProposalFees: values.getUint64(0),
    totalAssetRaffleCreatorPaid: values.getUint64(8),
    totalAssetRaffleRefunded: values.getUint64(16),
    numberOfActiveAssetRaffles: values.getUint32(24),
    numberOfEndedAssetRaffles: values.getUint32(28),
    totalAssetRafflesCreated: values.getUint32(32),
    totalAssetRafflesSucceeded: values.getUint32(36),
    totalAssetRafflesFailed: values.getUint32(40),
    returnCode: values.getUint32(44),
  };
};

// Transaction functions
export const registerInSystem = async (sourceID: string, tick: number, useQXMR: boolean) => {
  const payload = createPayload([{ data: useQXMR === true ? 1 : 0, type: "uint8" }]);
  return await createSCTx(sourceID, SC_INDEX, 1, 1, useQXMR ? 0 : QRAFFLE_REGISTER_AMOUNT, tick, payload);
};

export const logoutInSystem = async (sourceID: string, tick: number) => {
  return await createSCTx(sourceID, SC_INDEX, 2, 0, 0, tick);
};

export const submitEntryAmount = async (sourceID: string, amount: number, tick: number) => {
  const payload = createPayload([{ data: amount, type: "bigint64" }]);
  return await createSCTx(sourceID, SC_INDEX, 3, payload.getPackageSize(), 0, tick, payload);
};

export const submitProposal = async (
  sourceID: string,
  issuer: string,
  assetName: bigint,
  entryAmount: number,
  tick: number,
) => {
  const payload = createPayload([
    { data: issuer, type: "id" },
    { data: assetName, type: "bigint64" },
    { data: entryAmount, type: "bigint64" },
  ]);
  return await createSCTx(sourceID, SC_INDEX, 4, payload.getPackageSize(), 0, tick, payload);
};

export const voteInProposal = async (sourceID: string, indexOfProposal: number, yes: boolean, tick: number) => {
  const payload = createPayload([
    { data: indexOfProposal, type: "uint32" },
    { data: Number(yes), type: "uint8" },
  ]);
  return await createSCTx(sourceID, SC_INDEX, 5, payload.getPackageSize(), 0, tick, payload);
};

export const depositeInQuRaffle = async (sourceID: string, amount: number, tick: number) => {
  return await createSCTx(sourceID, SC_INDEX, 6, 0, amount, tick);
};

export const depositeInTokenRaffle = async (sourceID: string, indexOfTokenRaffles: number, tick: number) => {
  const payload = createPayload([{ data: indexOfTokenRaffles, type: "uint32" }]);
  // Testing with 100 QUBIC fee - smart contract might require it for execution
  return await createSCTx(sourceID, SC_INDEX, 7, payload.getPackageSize(), 100, tick, payload);
};

export const transferShareManagementRightsFromQX = async (
  sourceID: string,
  asset: { issuer: string; assetName: number | bigint },
  numberOfShares: number,
  newManagingContractIndex: number,
  tick: number,
) => {
  const assetIssuer = qHelper.getIdentityBytes(asset.issuer);
  const payload = createPayload([
    ...Array.from(assetIssuer).map((byte) => ({ data: byte, type: "uint8" as const })),
    { data: asset.assetName, type: "bigint64" },
    { data: numberOfShares, type: "bigint64" },
    { data: newManagingContractIndex, type: "uint32" },
  ]);
  const QX_SC_INDEX = 1;
  return await createSCTx(sourceID, QX_SC_INDEX, 9, payload.getPackageSize(), 0, tick, payload);
};

export const transferShareManagementRightsFromQRaffle = async (
  sourceID: string,
  asset: { issuer: string; assetName: number | bigint },
  numberOfShares: number,
  newManagingContractIndex: number,
  tick: number,
) => {
  const assetIssuer = qHelper.getIdentityBytes(asset.issuer);
  const payload = createPayload([
    ...Array.from(assetIssuer).map((byte) => ({ data: byte, type: "uint8" as const })),
    { data: asset.assetName, type: "bigint64" },
    { data: numberOfShares, type: "bigint64" },
    { data: newManagingContractIndex, type: "uint32" },
  ]);
  return await createSCTx(
    sourceID,
    SC_INDEX,
    8,
    payload.getPackageSize(),
    TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE,
    tick,
    payload,
  );
};

// createAssetRaffle_input is a fixed 216-byte struct: 4 bundle slots of
// (issuer id + assetName u64 + numberOfShares s64), bundleSize u32, 4 bytes of
// struct padding, then reservePriceQu u64 and entryTicketQu u64. Unused bundle
// slots are zero-filled; only [0..bundleSize) are read by the contract.
export const createAssetRaffle = async (
  sourceID: string,
  bundleItems: AssetRaffleBundleItemInput[],
  reservePriceQu: number,
  entryTicketQu: number,
  tick: number,
) => {
  const fields: Parameters<typeof createPayload>[0] = [];
  for (let i = 0; i < QRAFFLE_MAX_ASSETS_PER_BUNDLE; i++) {
    const item = bundleItems[i];
    fields.push({ data: item ? item.issuer : new Uint8Array(32), type: "id" });
    fields.push({ data: item ? (assetNameConvert(item.assetName) as bigint) : 0, type: "bigint64" });
    fields.push({ data: item ? item.numberOfShares : 0, type: "bigint64" });
  }
  fields.push({ data: bundleItems.length, type: "uint32" });
  fields.push({ data: 0, type: "uint32" }); // struct padding before the uint64 fields
  fields.push({ data: reservePriceQu, type: "bigint64" });
  fields.push({ data: entryTicketQu, type: "bigint64" });

  const payload = createPayload(fields);
  return await createSCTx(
    sourceID,
    SC_INDEX,
    9,
    payload.getPackageSize(),
    QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE,
    tick,
    payload,
  );
};

export const buyAssetRaffleTicket = async (
  sourceID: string,
  indexOfAssetRaffle: number,
  numberOfTickets: number,
  totalCostQu: number,
  tick: number,
) => {
  const payload = createPayload([
    { data: indexOfAssetRaffle, type: "uint32" },
    { data: numberOfTickets, type: "uint32" },
  ]);
  return await createSCTx(sourceID, SC_INDEX, 10, payload.getPackageSize(), totalCostQu, tick, payload);
};

export const cancelAssetRaffle = async (sourceID: string, indexOfAssetRaffle: number, tick: number) => {
  const payload = createPayload([{ data: indexOfAssetRaffle, type: "uint32" }]);
  return await createSCTx(sourceID, SC_INDEX, 11, payload.getPackageSize(), 0, tick, payload);
};
