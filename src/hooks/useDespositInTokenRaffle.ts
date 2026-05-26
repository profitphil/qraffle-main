import { depositeInTokenRaffle } from "@/services/sc.service";
import { getActiveTokenRaffle } from "@/services/sc.service";
import { useAtom } from "jotai";
import { useRef } from "react";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { settingsAtom } from "@/store/settings";
import { broadcastTx, fetchTickInfo, fetchAssetsOwnership } from "@/services/rpc.service";
import { useTxMonitor } from "@/store/txMonitor";
import { toast } from "sonner";
import { BalanceChecks } from "@/utils/balanceCheck";
import { addParticipation } from "@/utils/participationStorage";
import useTransferShareManagementRights from "@/hooks/useTransferShareManagementRight";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";
import { TOKEN_RAFFLE_DEPOSIT_FEE, TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE } from "@/utils/constants";

const GARTH_ASSET_NAME = "GARTH";
const GARTH_TOKEN_ISSUER = "PHOENIXCLQOBHDZCHJOCKCPZVTKALQBMXYOEDBUHSDCJRMTUCUBPLSUFNBIE";
const normalizeIdentity = (value: string | null | undefined) => value?.replace(/\0/g, "").trim().toUpperCase() || "";
const normalizeAssetName = (value: string | null | undefined) => value?.replace(/\0/g, "").trim().toUpperCase() || "";

const getCanonicalTokenIdentity = (tokenName: string | null | undefined, tokenIssuer: string | null | undefined) => {
  const normalizedTokenName = normalizeAssetName(tokenName);
  const normalizedTokenIssuer =
    normalizedTokenName === GARTH_ASSET_NAME ? GARTH_TOKEN_ISSUER : normalizeIdentity(tokenIssuer);

  return {
    normalizedTokenName,
    normalizedTokenIssuer,
  };
};

const MIN_TOKEN_RAFFLE_DEPOSIT_TICK_OFFSET = 12;
// WalletConnect / mobile wallet flows need more lead-time: the user has to swap
// to a separate app to sign, which can chew through 10+ ticks of headroom.
const WC_MIN_TICK_OFFSET = 18;
const WC_MAX_TICK_OFFSET = 28;
const WC_MAX_ATTEMPTS = 6;

export const useDespositInTokenRaffle = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();
  const { handleTransferShareRights } = useTransferShareManagementRights();
  const inFlightRef = useRef(false);

  const handleDeposit = async (indexOfTokenRaffles: number): Promise<boolean> => {
    if (inFlightRef.current) {
      console.warn("Token raffle deposit already in flight; ignoring duplicate invocation");
      return false;
    }
    if (!wallet) {
      toast.error("Please connect your wallet");
      return false;
    }

    inFlightRef.current = true;
    const publicKey = wallet.publicKey;
    const isWalletConnect = wallet.connectType === "walletconnect";

    try {
      console.log("=== Token Raffle Deposit Started ===");
      console.log("Token raffle index:", indexOfTokenRaffles);
      console.log("Wallet connected:", publicKey);

      const tokenBalanceCheck = await BalanceChecks.forTokenRaffle(publicKey, indexOfTokenRaffles);
      console.log("Token balance check result:", tokenBalanceCheck);

      if (!tokenBalanceCheck.hasEnoughBalance) {
        return false;
      }

      const requiredQubicFeeAmount =
        TOKEN_RAFFLE_DEPOSIT_FEE + (tokenBalanceCheck.needsTransfer ? TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE : 0);

      const quBalanceCheck = await BalanceChecks.forCustomAmount(
        publicKey,
        requiredQubicFeeAmount,
        "token raffle tx fee buffer",
      );
      if (!quBalanceCheck.hasEnoughBalance) {
        toast.error(
          `Insufficient QUBIC balance for token raffle fees. Required: ${requiredQubicFeeAmount.toLocaleString()} QUBIC.`,
        );
        return false;
      }

      if (tokenBalanceCheck.needsTransfer && tokenBalanceCheck.transferAmount) {
        console.log("[TokenJoin][Stage 1/3] Transfer required before deposit");
        toast.info(
          `Transferring ${tokenBalanceCheck.transferAmount} ${tokenBalanceCheck.tokenName} to QRaffle contract...`,
        );

        const transferResult = await handleTransferShareRights({
          assetName: tokenBalanceCheck.tokenName!,
          assetIssuer: tokenBalanceCheck.tokenIssuer!,
          contractIndex: 19,
          amount: tokenBalanceCheck.requiredAmount,
          isFromQX: true,
          onTransferConfirmed: async ({ txHash, targetTick }) => {
            console.log("[TokenJoin][Stage 1/3] Transfer confirmed", { txHash, targetTick });
            toast.info("Stage 1/3: Token transfer confirmed. Submitting raffle deposit...");
          },
        });

        if (!transferResult.success) {
          toast.error("Stage 1/3: Transfer step did not complete; aborting deposit");
          return false;
        }
      } else {
        console.log("[TokenJoin][Stage 1/3] No transfer needed, tokens already at index 19");
        toast.info("Stage 1/3: Token balance ready. Submitting raffle deposit...");
      }

      return await participateInRaffle(
        publicKey,
        indexOfTokenRaffles,
        tokenBalanceCheck.tokenName || "",
        tokenBalanceCheck.tokenIssuer || "",
        tokenBalanceCheck.requiredAmount,
        isWalletConnect,
      );
    } catch (error) {
      if (isRetryableTickError(error)) {
        toast.error("Submission failed due to RPC/tick timing. Please wait a few seconds and try again.");
      } else {
        toast.error("Failed to participate in token raffle");
      }
      console.error("Error in token raffle participation:", error);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };

  const participateInRaffle = async (
    publicKey: string,
    indexOfTokenRaffles: number,
    tokenName: string,
    tokenIssuer: string,
    requiredAmount: number,
    isWalletConnect: boolean,
  ): Promise<boolean> => {
    console.log("=== participateInRaffle called ===");

    const tickInfo = await fetchTickInfo();
    const currentEpoch = tickInfo.epoch;
    console.log("Current epoch (re-fetched at deposit time):", currentEpoch);

    let initialMemberCount: number | null = null;
    let initialBalanceAt19: number | null = null;
    const { normalizedTokenIssuer, normalizedTokenName } = getCanonicalTokenIdentity(tokenName, tokenIssuer);
    try {
      const [activeTokenRaffle, ownedAssets] = await Promise.all([
        getActiveTokenRaffle(indexOfTokenRaffles),
        fetchAssetsOwnership(publicKey),
      ]);
      initialMemberCount = activeTokenRaffle?.numberOfMembers ?? null;

      const baselineAssetAt19 = ownedAssets.find(
        (asset) =>
          normalizeIdentity(asset.issuer) === normalizedTokenIssuer &&
          normalizeAssetName(asset.assetName) === normalizedTokenName &&
          asset.managingContractIndex === 19,
      );
      initialBalanceAt19 = typeof baselineAssetAt19?.amount === "number" ? baselineAssetAt19.amount : 0;
    } catch (memberCheckError) {
      console.warn("Failed to fetch initial token raffle checker baseline", memberCheckError);
    }

    const submission = await submitWithFreshTick({
      tickOffset: settings.tickOffset,
      fetchTickInfo,
      retryContext: "TokenRaffleDeposit",
      minTickOffset: isWalletConnect ? WC_MIN_TICK_OFFSET : MIN_TOKEN_RAFFLE_DEPOSIT_TICK_OFFSET,
      maxTickOffset: isWalletConnect ? WC_MAX_TICK_OFFSET : undefined,
      maxAttempts: isWalletConnect ? WC_MAX_ATTEMPTS : undefined,
      execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
        const depositTx = await depositeInTokenRaffle(publicKey, indexOfTokenRaffles, nextTargetTick || 0);
        const signedDepositTx = await getSignedTx(depositTx);
        await checkpoint();
        return await broadcastTx(signedDepositTx.tx);
      },
    });

    const targetTick = submission.targetTick;
    const depositResult = submission.result;

    if (!depositResult || targetTick <= 0) {
      throw new Error("Token raffle deposit transaction submission failed");
    }

    console.log("[TokenJoin][Stage 2/3] Deposit broadcasted", {
      txHash: depositResult.transactionId,
      targetTick,
    });
    toast.info(`Stage 2/3: Deposit broadcasted (${depositResult.transactionId.slice(0, 10)}...)`);

    const depositTaskId = `deposit-token-raffle-${publicKey}-${targetTick}-${Date.now()}`;

    const depositChecker = async () => {
      try {
        const [activeTokenRaffle, ownedAssets] = await Promise.all([
          getActiveTokenRaffle(indexOfTokenRaffles),
          fetchAssetsOwnership(publicKey),
        ]);

        const membersIncreased =
          initialMemberCount !== null &&
          !!activeTokenRaffle &&
          activeTokenRaffle.numberOfMembers > initialMemberCount;

        const matchingAssetAt19 = ownedAssets.find(
          (asset) =>
            normalizeIdentity(asset.issuer) === normalizedTokenIssuer &&
            normalizeAssetName(asset.assetName) === normalizedTokenName &&
            asset.managingContractIndex === 19,
        );
        const balanceAt19 = typeof matchingAssetAt19?.amount === "number" ? matchingAssetAt19.amount : 0;

        const spentFromIndex19ByDelta =
          typeof initialBalanceAt19 === "number" && initialBalanceAt19 - balanceAt19 >= requiredAmount;

        return membersIncreased || spentFromIndex19ByDelta;
      } catch (checkerError) {
        console.warn("Token raffle deposit checker failed", checkerError);
        return false;
      }
    };

    return await new Promise<boolean>((resolve) => {
      const onDepositSuccess = async () => {
        console.log("[TokenJoin][Stage 3/3] Deposit confirmed");
        addParticipation(publicKey, {
          type: "token",
          epoch: currentEpoch,
          index: indexOfTokenRaffles,
        });
        toast.success("Stage 3/3: Token raffle participation confirmed");
        resolve(true);
      };

      const onDepositFailure = async () => {
        console.log("[TokenJoin][Stage 3/3] Deposit failed");
        toast.error("Stage 3/3: Token raffle participation failed");
        resolve(false);
      };

      startMonitoring(
        depositTaskId,
        {
          checker: depositChecker,
          onSuccess: onDepositSuccess,
          onFailure: onDepositFailure,
          targetTick,
          txHash: depositResult.transactionId,
          canRecoverFromMoneyFlewFalse: true,
          timeoutMs: 45000,
          fastTrack: true,
          participationMetadata: {
            publicKey,
            participation: {
              type: "token",
              epoch: currentEpoch,
              index: indexOfTokenRaffles,
            },
          },
        },
        "v2",
      );
    });
  };

  return { handleDeposit };
};
