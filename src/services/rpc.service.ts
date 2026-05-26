import type {
  ArchiverStatus,
  Balance,
  EpochTicks,
  IQuerySC,
  IQuerySCResponse,
  LatestStats,
  RichList,
  TickEvents,
  TickInfo,
  TransactionInfo,
  TxHistory,
  TxStatus,
} from "@/types";
import { uint8ArrayToBase64 } from "@/utils";
import axios from "axios";

const resolveEnv = () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env as Record<string, string | undefined>;
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env as Record<string, string | undefined>;
  }
  return {} as Record<string, string | undefined>;
};

const env = resolveEnv();

const RPC_URL = env.VITE_RPC_URL || "https://rpc.qubic.org";
const QEVENT_URL = env.VITE_QEVENT_URL || "https://dev01.qubic.org";

const rpc = axios.create({
  baseURL: RPC_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 second timeout
});

const qevent = axios.create({
  baseURL: QEVENT_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchTickInfo = async (): Promise<TickInfo> => {
  try {
    const tickResult = await rpc.get("/v1/tick-info");
    const tick = await tickResult.data;
    if (!tick || !tick.tickInfo) {
      console.warn("getTickInfo: Invalid tick");
      return {} as TickInfo;
    }
    return tick.tickInfo;
  } catch (error) {
    throw error;
  }
};

export const fetchBalance = async (publicId: string): Promise<Balance> => {
  const balanceResult = await rpc.get(`/v1/balances/${publicId}`);
  const balance = await balanceResult.data;
  if (!balance || !balance.balance) {
    console.warn("getBalance: Invalid balance");
    return {} as Balance;
  }
  return balance.balance;
};

interface OwnedAssets {
  data: {
    ownerIdentity: string;
    type: number;
    padding: number;
    managingContractIndex: number;
    issuanceIndex: number;
    numberOfUnits: string;
    issuedAsset: {
      issuerIdentity: string;
      type: number;
      name: string;
      numberOfDecimalPlaces: number;
      unitOfMeasurement: number[];
    };
  };
  info: {
    tick: number;
    universeIndex: number;
  };
}

export const fetchAssetsBalance = async (publicId: string, assetName: string, contractIdex = 1): Promise<number> => {
  const assetsBalanceResult = await rpc.get(`/v1/assets/${publicId}/owned`);
  const assetsBalance = await assetsBalanceResult.data;
  if (!assetsBalance || !assetsBalance.ownedAssets) {
    console.warn("fetchAssetsBalance: Invalid assets balance");
    return 0;
  }
  const assetBalance = assetsBalance.ownedAssets.find(
    (asset: OwnedAssets) =>
      asset.data.issuedAsset.name === assetName && asset.data.managingContractIndex === contractIdex,
  );
  if (!assetBalance) {
    return 0;
  }
  return Number(assetBalance.data.numberOfUnits);
};

interface AssetsOwnership {
  ownerIdentity: string;
  managingContractIndex: number;
  amount: number;
  assetName: string;
  issuer: string;
}

// all assets ownership contract address, assets name, and amount
export const fetchAssetsOwnership = async (publicId: string): Promise<AssetsOwnership[]> => {
  const assetsBalanceResult = await rpc.get(`/v1/assets/${publicId}/owned`);
  const assetsBalance = await assetsBalanceResult.data;
  if (!assetsBalance || !assetsBalance.ownedAssets) {
    console.warn("fetchAssetsBalance: Invalid assets balance");
    return [];
  }
  return assetsBalance.ownedAssets.map((asset: OwnedAssets) => ({
    ownerIdentity: asset.data.ownerIdentity,
    managingContractIndex: asset.data.managingContractIndex,
    amount: Number(asset.data.numberOfUnits),
    assetName: asset.data.issuedAsset.name,
    issuer: asset.data.issuedAsset.issuerIdentity,
  }));
};

export const broadcastTx = async (tx: Uint8Array) => {
  const url = `${RPC_URL}/v1/broadcast-transaction`;
  const txEncoded = uint8ArrayToBase64(tx);
  const body = { encodedTransaction: txEncoded };
  const result = await rpc.post(url, body);
  console.log("txid: ", result.data.transactionId);
  return result.data;
};

export const fetchQuerySC = async (query: IQuerySC): Promise<IQuerySCResponse> => {
  const queryResult = await rpc.post(`${RPC_URL}/v1/querySmartContract`, query);
  return queryResult.data;
};

export const fetchTxStatus = async (txId: string): Promise<TxStatus> => {
  const txStatusResult = await rpc.get(`${RPC_URL}/v1/tx-status/${txId}`);
  let txStatus = {} as { transactionStatus: TxStatus };
  if (txStatusResult.status == 200) {
    txStatus = await txStatusResult.data;
  }
  return txStatus.transactionStatus;
};

export const fetchLatestTick = async (): Promise<number> => {
  const latestTickResult = await rpc.get(`${RPC_URL}/v1/latestTick`);
  return latestTickResult.data.latestTick;
};

export const fetchLatestStats = async (): Promise<LatestStats> => {
  const latestStatsResult = await rpc.get(`${RPC_URL}/v1/latest-stats`);
  if (latestStatsResult.status !== 200) {
    console.warn("fetchLatestStats: Failed to fetch latest stats");
    return {} as LatestStats;
  }
  const latestStats = await latestStatsResult.data;
  if (!latestStats || !latestStats.data) {
    console.warn("fetchLatestStats: Invalid response data");
    return {} as LatestStats;
  }
  return latestStats.data;
};

export const fetchArchiverStatus = async (): Promise<ArchiverStatus> => {
  try {
    const archiverStatusResult = await rpc.get(`${RPC_URL}/v1/status`);
    if (archiverStatusResult.status !== 200) {
      console.warn("fetchArchiverStatus: Failed to fetch archiver status");
      return {} as ArchiverStatus;
    }
    return archiverStatusResult.data;
  } catch (error) {
    throw error;
  }
};

export const fetchRichList = async (page: number, pageSize: number): Promise<RichList> => {
  const richListResult = await rpc.get(
    `${RPC_URL}/v1/rich-list?page=${page}&pageSize=${pageSize}&no-cache=${Date.now()}`,
  );
  const richList = await richListResult.data;
  return richList;
};

export const fetchTxHistory = async (publicId: string, startTick: number, endTick: number): Promise<TxHistory> => {
  const txHistoryResult = await rpc.get(
    `${RPC_URL}/v2/identities/${publicId}/transfers?startTick=${startTick}&endTick=${endTick}&no-cache=${Date.now()}`,
  );
  const txHistory = await txHistoryResult.data;
  return (txHistory.data ?? txHistory) as TxHistory;
};

export const fetchEpochTicks = async (epoch: number, page: number, pageSize: number): Promise<EpochTicks> => {
  const epochTicksResult = await rpc.get(
    `${RPC_URL}/v2/epochs/${epoch}/ticks?page=${page}&pageSize=${pageSize}&no-cache=${Date.now()}`,
  );
  const epochTicks = await epochTicksResult.data;
  return (epochTicks.data ?? epochTicks) as EpochTicks;
};

export const fetchApprovedTx = async (tick: number): Promise<TransactionInfo[]> => {
  const approvedTxResult = await rpc.get(`${RPC_URL}/v1/ticks/${tick}/approved-transactions`);
  const approvedTx = await approvedTxResult.data;
  return approvedTx.approvedTransactions;
};

export const fetchTickTxs = async (tick: number): Promise<TransactionInfo[]> => {
  const transferTxResult = await rpc.get(`${RPC_URL}/v2/ticks/${tick}/transactions`);
  const transferTx = await transferTxResult.data;
  return transferTx.transactions;
};

export const fetchTransactionInfo = async (txHash: string): Promise<TransactionInfo> => {
  const transactionInfoResult = await rpc.get(`${RPC_URL}/v2/transactions/${txHash}`);
  const transactionInfo = await transactionInfoResult.data;
  return transactionInfo.transaction;
};

export const fetchTickEvents = async (tick: number): Promise<TickEvents> => {
  const tickEventsResult = await qevent.post(`/v1/events/getTickEvents`, { tick });
  return tickEventsResult.data;
};
