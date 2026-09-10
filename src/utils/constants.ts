export const TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE = 100; // 100 QUBIC
export const QRAFFLE_REGISTER_AMOUNT = 1_000_000_000;
export const QRAFFLE_QXMR_REGISTER_AMOUNT = 250_000_000;
export const QRAFFLE_MAX_QRE_AMOUNT = 1_000_000_000;
export const QRAFFLE_ASSET_NAME = 19505638103142993n;
export const QRAFFLE_LOGOUT_FEE = 50_000_000;
export const QRAFFLE_QXMR_LOGOUT_FEE = 12_500_000;
export const QRAFFLE_TRANSFER_SHARE_FEE = 100;
export const MIN_TX_FEE_BUFFER = 100;
export const TOKEN_RAFFLE_DEPOSIT_FEE = 100;
export const QRAFFLE_BURN_FEE = 5; // percent
export const QRAFFLE_REGISTER_FEE = 5; // percent
export const QRAFFLE_FEE = 1; // percent
export const QRAFFLE_CHARITY_FEE = 1; // percent
export const QRAFFLE_SHRAEHOLDER_FEE = 8; // percent
// Retained by the contract (not paid out) to buy RANDOM SC entropy for winner
// selection. Live from epoch 228 (qubic/core PR #968); winner share drops 80% → 79%.
export const QRAFFLE_ENTROPY_FEE = 1; // percent
// Epoch at which burn/shareholder rates moved to 5%/8%.
export const EPOCH_FEE_UPDATE_START = 210;
// Epoch at which the 1% RANDOM entropy reserve took effect (winner 80% → 79%).
export const EPOCH_ENTROPY_UPDATE_START = 228;
export const QRAFFLE_MAX_EPOCH = 65536;
export const QRAFFLE_MAX_PROPOSAL_EPOCH = 128;
export const QRAFFLE_MAX_MEMBER = 65536;

// Asset (bundle) raffle — mirrors QRaffle.h constants
export const QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE = 500_000; // non-refundable, per creation
export const QRAFFLE_MAX_ASSETS_PER_BUNDLE = 4;
export const QRAFFLE_MAX_ASSET_RAFFLES_PER_CREATOR = 2;
export const QRAFFLE_MAX_ASSET_RAFFLES_PER_EPOCH = 64;
export const QRAFFLE_MAX_TICKETS_PER_BUYER = 100;
export const QRAFFLE_MIN_ASSET_TICKET_AMOUNT = 1_000_000;
export const QRAFFLE_MAX_ASSET_TICKET_AMOUNT = 1_000_000_000_000;

export const DEFAULT_TICK_OFFSET = 25;
