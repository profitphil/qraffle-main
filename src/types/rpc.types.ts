export interface TickInfo {
  tick: number;
  duration: number;
  epoch: number;
  initialTick: number;
};

export interface Balance {
  id: string;
  balance: number;
  validForTick: number;
  latestIncomingTransferTick: number;
  latestOutgoingTransferTick: number;
  incomingAmount: number;
  outgoingAmount: number;
  numberOfIncomingTransfers: number;
  numberOfOutgoingTransfers: number;
};
export interface OwnedAssets {
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

export interface AssetsOwnership {
  ownerIdentity: string;
  managingContractIndex: number;
  amount: number;
  assetName: string;
  issuer: string;
}
export interface IQuerySC {
  contractIndex: number;
  inputType: number;
  inputSize: number;
  requestData: string;
}

export interface IQuerySCResponse {
  responseData: string;
}

export interface TxStatus {
  txId: string;
  moneyFlew: boolean;
}

export interface LatestStats {
  timestamp: string;
  circulatingSupply: string;
  activeAddresses: number;
  price: number;
  marketCap: string;
  epoch: number;
  currentTick: number;
  ticksInCurrentEpoch: number;
  emptyTicksInCurrentEpoch: number;
  epochTickQuality: number;
  burnedQus: string;
}

export interface ArchiverStatus {
  lastProcessedTick: {
    tickNumber: number;
    epoch: number;
  };
  lastProcessedTicksPerEpoch: { [key: string]: number };
  skippedTicks: { startTick: number; endTick: number }[];
  processedTickIntervalsPerEpoch: {
    epoch: number;
    intervals: { initialProcessedTick: number; lastProcessedTick: number }[];
  }[];
  emptyTicksPerEpoch: { [key: string]: number };
}

export interface RichList {
  pagination: {
    totalRecords: number;
    currentPage: number;
    totalPages: number;
  };
  epoch: number;
  richList: {
    entities: { identity: string; balance: string }[];
  };
}
export interface TxHistory {
  transactions: {
    tickNumber: number;
    identity: string;
    transactions: {
      transaction: Transaction;
      timestamp: string;
      moneyFlew: boolean;
    }[];
  }[];
}

export interface EpochTicks {
  pagination: {
    totalRecords: number;
    currentPage: number;
    totalPages: number;
    pageSize: number;
    nextPage: number;
    previousPage: number;
  };
  ticks: { tickNumber: number; isEmpty: boolean }[];
}

export interface IBurnNBoostedStats {
  burnedAmount: number;
  averageBurnedPercent: number;
  boostedAmount: number;
  averageBoostedPercent: number;
  rewardedAmount: number;
  averageRewardedPercent: number;
}

export interface ApprovedTx {
  approvedTransactions: TransactionInfo[];
}

export interface TransactionInfo {
  transaction: Transaction;
  timestamp: string;
  moneyFlew: boolean;
}

export interface Transaction {
  sourceId: string;
  destId: string;
  amount: string;
  tickNumber: number;
  inputType: number;
  inputSize: number;
  inputHex: string;
  signatureHex: string;
  txId: string;
}
