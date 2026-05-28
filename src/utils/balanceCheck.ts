import { toast } from "sonner";
import { fetchBalance, fetchAssetsOwnership } from "@/services/rpc.service";
import { getActiveTokenRaffle } from "@/services/sc.service";
import { QRAFFLE_REGISTER_AMOUNT, TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE } from "@/utils/constants";

export interface BalanceCheckResult {
  hasEnoughBalance: boolean;
  currentBalance: number;
  requiredAmount: number;
  shortfall: number;
}

export interface TokenBalanceCheckResult extends BalanceCheckResult {
  tokenName?: string;
  tokenIssuer?: string;
  needsApproval?: boolean;
  needsTransfer?: boolean;
  transferAmount?: number;
}

const normalizeIdentity = (value: string | null | undefined) => value?.replace(/\0/g, "").trim().toUpperCase() || "";

const normalizeAssetName = (value: string | null | undefined) => value?.replace(/\0/g, "").trim().toUpperCase() || "";

const GARTH_ASSET_NAME = "GARTH";
const GARTH_TOKEN_ISSUER = "PHOENIXCLQOBHDZCHJOCKCPZVTKALQBMXYOEDBUHSDCJRMTUCUBPLSUFNBIE";

const getCanonicalTokenIdentity = (tokenName: string | null | undefined, tokenIssuer: string | null | undefined) => {
  const normalizedTokenName = normalizeAssetName(tokenName);
  const normalizedTokenIssuer =
    normalizedTokenName === GARTH_ASSET_NAME ? GARTH_TOKEN_ISSUER : normalizeIdentity(tokenIssuer);

  return {
    normalizedTokenName,
    normalizedTokenIssuer,
  };
};

/**
 * Centralized balance checking utility
 * Checks if user has sufficient balance for various operations
 */
export const checkBalance = async (
  publicKey: string,
  requiredAmount: number,
  operationName: string,
): Promise<BalanceCheckResult> => {
  try {
    const balanceData = await fetchBalance(publicKey);
    const currentBalance = balanceData.balance || 0;
    const hasEnoughBalance = currentBalance >= requiredAmount;
    const shortfall = Math.max(0, requiredAmount - currentBalance);

    if (!hasEnoughBalance) {
      toast.error(
        `Insufficient balance for ${operationName}. Required: ${requiredAmount.toLocaleString()} QUBIC, Available: ${currentBalance.toLocaleString()} QUBIC`,
      );
    }

    return {
      hasEnoughBalance,
      currentBalance,
      requiredAmount,
      shortfall,
    };
  } catch (error) {
    console.error("Error checking balance:", error);
    toast.error("Failed to check balance. Please try again.");
    return {
      hasEnoughBalance: false,
      currentBalance: 0,
      requiredAmount,
      shortfall: requiredAmount,
    };
  }
};

/**
 * Predefined balance checks for common operations
 */
export const BalanceChecks = {
  /**
   * Check balance for system registration
   */
  async forRegistration(publicKey: string): Promise<BalanceCheckResult> {
    return checkBalance(publicKey, QRAFFLE_REGISTER_AMOUNT, "system registration");
  },

  /**
   * Check balance for system logout
   */
  async forLogout(publicKey: string): Promise<BalanceCheckResult> {
    return checkBalance(publicKey, 0, "system logout");
  },

  /**
   * Check balance for transfer share management rights
   */
  async forTransferShareRights(publicKey: string): Promise<BalanceCheckResult> {
    return checkBalance(publicKey, TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE, "transfer share management rights");
  },

  /**
   * Check balance for custom amount operations
   */
  async forCustomAmount(publicKey: string, amount: number, operationName: string): Promise<BalanceCheckResult> {
    return checkBalance(publicKey, amount, operationName);
  },

  /**
   * Check balance for voting (no fee required, but ensures wallet is connected)
   */
  async forVoting(publicKey: string): Promise<BalanceCheckResult> {
    return checkBalance(publicKey, 0, "voting");
  },

  /**
   * Check token balance and approval for token raffle participation
   * Uses managingContractIndex 1 (QX) rights/balance only
   */
  async forTokenRaffle(publicKey: string, tokenRaffleIndex: number): Promise<TokenBalanceCheckResult> {
    try {
      // Get token raffle information
      const tokenRaffleInfo = await getActiveTokenRaffle(tokenRaffleIndex);
      if (!tokenRaffleInfo) {
        toast.error("Token raffle not found");
        return {
          hasEnoughBalance: false,
          currentBalance: 0,
          requiredAmount: 0,
          shortfall: 0,
        };
      }

      // Get user's token balance
      const userAssets = await fetchAssetsOwnership(publicKey);
      const requiredAmount = tokenRaffleInfo.entryAmount;
      const { normalizedTokenIssuer, normalizedTokenName } = getCanonicalTokenIdentity(
        tokenRaffleInfo.tokenName,
        tokenRaffleInfo.tokenIssuer,
      );

      console.log("All user assets:", userAssets);
      console.log("Looking for token:", {
        tokenName: tokenRaffleInfo.tokenName,
        tokenIssuer: tokenRaffleInfo.tokenIssuer,
        requiredAmount,
      });

      const matchingTokenAssets = userAssets.filter(
        (asset) =>
          normalizeIdentity(asset.issuer) === normalizedTokenIssuer &&
          normalizeAssetName(asset.assetName) === normalizedTokenName,
      );

      const tokenAssetsAt1 = matchingTokenAssets.filter((asset) => asset.managingContractIndex === 1);
      const tokenAssetsAt19 = matchingTokenAssets.filter((asset) => asset.managingContractIndex === 19);
      const balanceAt1 = tokenAssetsAt1.reduce(
        (sum, asset) => sum + (typeof asset.amount === "number" ? asset.amount : 0),
        0,
      );
      const balanceAt19 = tokenAssetsAt19.reduce(
        (sum, asset) => sum + (typeof asset.amount === "number" ? asset.amount : 0),
        0,
      );
      const totalAvailableBalance = balanceAt1 + balanceAt19;

      console.log("Balance at index 1:", balanceAt1);
      console.log("Balance at index 19:", balanceAt19);
      console.log("All matching tokens across all indices:", matchingTokenAssets);

      const displayTokenName = tokenAssetsAt19[0]?.assetName || tokenAssetsAt1[0]?.assetName || tokenRaffleInfo.tokenName;

      const hasEnoughBalance = totalAvailableBalance >= requiredAmount;
      const shortfall = Math.max(0, requiredAmount - totalAvailableBalance);

      if (!hasEnoughBalance) {
        toast.error(
          `Insufficient ${displayTokenName} balance for token raffle. Required: ${requiredAmount.toLocaleString()}, Available: ${totalAvailableBalance.toLocaleString()}`,
        );
        return {
          hasEnoughBalance: false,
          currentBalance: totalAvailableBalance,
          requiredAmount,
          shortfall,
          tokenName: displayTokenName,
          tokenIssuer: normalizedTokenIssuer,
        };
      }

      const transferAmount = Math.max(0, requiredAmount - balanceAt19);
      const needsTransfer = transferAmount > 0;
      console.log(`Sufficient total token balance: ${totalAvailableBalance}`);
      console.log(`Token balance at managingContractIndex 19: ${balanceAt19}`);
      if (needsTransfer) {
        console.log(`Transfering ${transferAmount} from index 1 rights to index 19`);
      }

      return {
        hasEnoughBalance: true,
        currentBalance: totalAvailableBalance,
        requiredAmount,
        shortfall: 0,
        tokenName: displayTokenName,
        tokenIssuer: normalizedTokenIssuer,
        needsApproval: needsTransfer,
        needsTransfer,
        transferAmount,
      };
    } catch (error) {
      console.error("Error checking token raffle balance:", error);
      toast.error("Failed to check token balance. Please try again.");
      return {
        hasEnoughBalance: false,
        currentBalance: 0,
        requiredAmount: 0,
        shortfall: 0,
      };
    }
  },

  async checkApprove(
    publicKey: string,
    tokenRaffleIndex: number,
    targetContractIndex: number,
  ): Promise<TokenBalanceCheckResult> {
    try {
      // Get token raffle information
      const tokenRaffleInfo = await getActiveTokenRaffle(tokenRaffleIndex);
      if (!tokenRaffleInfo) {
        toast.error("Token raffle not found");
        return {
          hasEnoughBalance: false,
          currentBalance: 0,
          requiredAmount: 0,
          shortfall: 0,
        };
      }

      // Get user's token balance
      const userAssets = await fetchAssetsOwnership(publicKey);
      const { normalizedTokenIssuer, normalizedTokenName } = getCanonicalTokenIdentity(
        tokenRaffleInfo.tokenName,
        tokenRaffleInfo.tokenIssuer,
      );
      const tokenAsset = userAssets.find(
        (asset) =>
          normalizeIdentity(asset.issuer) === normalizedTokenIssuer &&
          normalizeAssetName(asset.assetName) === normalizedTokenName &&
          asset.managingContractIndex === targetContractIndex,
      );

      const currentBalance = tokenAsset?.amount || 0;
      const requiredAmount = tokenRaffleInfo.entryAmount;
      const displayTokenName = tokenAsset?.assetName || tokenRaffleInfo.tokenName;
      const hasEnoughBalance = currentBalance >= requiredAmount;
      const shortfall = Math.max(0, requiredAmount - currentBalance);

      if (!hasEnoughBalance) {
        toast.error(
          `Insufficient ${displayTokenName} balance for token raffle. Required: ${requiredAmount.toLocaleString()}, Available: ${currentBalance.toLocaleString()}`,
        );
      }

      return {
        hasEnoughBalance,
        currentBalance,
        requiredAmount,
        shortfall,
        tokenName: displayTokenName,
        tokenIssuer: normalizedTokenIssuer,
        needsApproval: true, // Token raffles always need share management rights transfer
      };
    } catch (error) {
      console.error("Error checking token raffle balance:", error);
      toast.error("Failed to check token balance. Please try again.");
      return {
        hasEnoughBalance: false,
        currentBalance: 0,
        requiredAmount: 0,
        shortfall: 0,
      };
    }
  },
};
