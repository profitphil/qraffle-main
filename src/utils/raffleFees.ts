import {
  QRAFFLE_BURN_FEE,
  QRAFFLE_REGISTER_FEE,
  QRAFFLE_FEE,
  QRAFFLE_CHARITY_FEE,
  QRAFFLE_SHRAEHOLDER_FEE,
  QRAFFLE_ENTROPY_FEE,
  EPOCH_FEE_UPDATE_START,
  EPOCH_ENTROPY_UPDATE_START,
} from "./constants";

export type RaffleFeeRates = {
  burn: number;
  dao: number;
  shareholder: number;
  charity: number;
  fee: number;
  /** 1% RANDOM entropy reserve, retained by the contract; 0 before epoch 228. */
  entropy: number;
};

/**
 * Single source of truth for the QRaffle Qu-pool distribution percentages,
 * gated by epoch:
 * - From EPOCH_FEE_UPDATE_START: burn 5%, shareholders 8%.
 * - From EPOCH_ENTROPY_UPDATE_START: +1% entropy reserve (winner 80% → 79%).
 * The same split applies to standard, token, and asset (bundle) raffle pools.
 */
export const getRaffleFeeRates = (epoch: number): RaffleFeeRates => {
  const burn = epoch >= EPOCH_FEE_UPDATE_START ? 5 : QRAFFLE_BURN_FEE;
  const shareholder = epoch >= EPOCH_FEE_UPDATE_START ? 8 : QRAFFLE_SHRAEHOLDER_FEE;
  const entropy = epoch >= EPOCH_ENTROPY_UPDATE_START ? QRAFFLE_ENTROPY_FEE : 0;

  return {
    burn,
    dao: QRAFFLE_REGISTER_FEE,
    shareholder,
    charity: QRAFFLE_CHARITY_FEE,
    fee: QRAFFLE_FEE,
    entropy,
  };
};

/** Winner/creator share of a raffle pool for a given epoch (79% from epoch 228, else 80%). */
export const getWinnerPercent = (epoch: number): number => {
  const r = getRaffleFeeRates(epoch);
  return 100 - r.burn - r.dao - r.shareholder - r.charity - r.fee - r.entropy;
};
