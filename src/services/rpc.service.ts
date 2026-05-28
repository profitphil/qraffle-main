import type {
  ArchiverStatus,
  Balance,
  OwnedAssets,
  AssetsOwnership,
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


const RPC_URL = import.meta.env.VITE_RPC_URL;
const QEVENT_URL = import.meta.env.VITE_QEVENT_URL;

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
  const tickRes = await rpc.get("/live/v1/tick-info");
  return tickRes.data.tickInfo;
};

export const fetchBalance = async (publicId: string): Promise<Balance> => {
  const balanceRes = await rpc.get(`/live/v1/balances/${publicId}`);
  return balanceRes.data.balance;
};

export const fetchAssetsBalance = async (publicId: string, assetName: string, contractIdex = 1): Promise<number> => {
  const assetsBalanceRes = await rpc.get(`/v1/assets/${publicId}/owned`);
  if (!assetsBalanceRes.data || !assetsBalanceRes.data.ownedAssets) {
    console.warn("fetchAssetsBalance: Invalid assets balance");
    return 0;
  }
  const assetBalance = assetsBalanceRes.data.ownedAssets.find(
    (asset: OwnedAssets) =>
      asset.data.issuedAsset.name === assetName && asset.data.managingContractIndex === contractIdex,
  );
  if (!assetBalance) {
    return 0;
  }
  return Number(assetBalance.data.numberOfUnits);
};

// all assets ownership contract address, assets name, and amount
export const fetchAssetsOwnership = async (publicId: string): Promise<AssetsOwnership[]> => {
  const assetsBalanceRes = await rpc.get(`/v1/assets/${publicId}/owned`);
  return assetsBalanceRes.data;
};

export const broadcastTx = async (tx: Uint8Array) => {
  const txEncoded = uint8ArrayToBase64(tx);
  const body = { encodedTransaction: txEncoded };
  const broadcastTxRes = await rpc.post(`/v1/broadcast-transaction`, body);
  return broadcastTxRes.data;
};

export const fetchQuerySC = async (query: IQuerySC): Promise<IQuerySCResponse> => {
  const querySCRes = await rpc.post(`/live/v1/querySmartContract`, query);
  return querySCRes.data;
};

export const fetchTxStatus = async (txId: string): Promise<TxStatus> => {
  const txStatus = await rpc.get(`/v1/tx-status/${txId}`);
  return txStatus.data.transactionStatus;
};

export const fetchLatestTick = async (): Promise<number> => {
  const latestTickResult = await rpc.get(`/v1/latestTick`);
  return latestTickResult.data.latestTick;
};

export const fetchLatestStats = async (): Promise<LatestStats> => {
  const latestStats = await rpc.get(`/v1/latest-stats`);
  return latestStats.data;
};

export const fetchArchiverStatus = async (): Promise<ArchiverStatus> => {
  const archiverStatus = await rpc.get(`/v1/status`);
  return archiverStatus.data;
};

export const fetchRichList = async (page: number, pageSize: number): Promise<RichList> => {
  const richList = await rpc.get(
    `/v1/rich-list?page=${page}&pageSize=${pageSize}&no-cache=${Date.now()}`,
  );
  return richList.data;
};

export const fetchTxHistory = async (publicId: string, startTick: number, endTick: number): Promise<TxHistory> => {
  const txHistory = await rpc.get(
    `/v2/identities/${publicId}/transfers?startTick=${startTick}&endTick=${endTick}&no-cache=${Date.now()}`,
  );
  return txHistory.data;
};

export const fetchEpochTicks = async (epoch: number, page: number, pageSize: number): Promise<EpochTicks> => {
  const epochTicks = await rpc.get(
    `/v2/epochs/${epoch}/ticks?page=${page}&pageSize=${pageSize}&no-cache=${Date.now()}`,
  );
  return epochTicks.data;
};

export const fetchApprovedTx = async (tick: number): Promise<TransactionInfo[]> => {
  const approvedTx = await rpc.get(`/v1/ticks/${tick}/approved-transactions`);
  return approvedTx.data.approvedTransactions;
};

export const fetchTickTxs = async (tick: number): Promise<TransactionInfo[]> => {
  const transferTx = await rpc.get(`/v2/ticks/${tick}/transactions`);
  return transferTx.data.transactions;
};

export const fetchTransactionInfo = async (txHash: string): Promise<TransactionInfo> => {
  const transactionInfo = await rpc.get(`/v2/transactions/${txHash}`);
  return transactionInfo.data.transaction;
};

export const fetchTickEvents = async (tick: number): Promise<TickEvents> => {
  const tickEventsResult = await qevent.post(`/v1/events/getTickEvents`, { tick });
  return tickEventsResult.data;
};