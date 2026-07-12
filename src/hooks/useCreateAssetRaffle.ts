import { useRef } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";

import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import useTransferShareManagementRights from "@/hooks/useTransferShareManagementRight";
import { broadcastTx, fetchAssetsBalance, fetchTickInfo } from "@/services/rpc.service";
import {
  createAssetRaffle,
  getAssetRaffleAnalytics,
  SC_INDEX,
  type AssetRaffleBundleItemInput,
} from "@/services/sc.service";
import { settingsAtom } from "@/store/settings";
import { useTxMonitor } from "@/store/txMonitor";
import { BalanceChecks } from "@/utils/balanceCheck";
import {
  MIN_TX_FEE_BUFFER,
  QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE,
  TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE,
} from "@/utils/constants";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";

const MIN_CREATE_TICK_OFFSET = 12;
const WC_MIN_TICK_OFFSET = 18;
const WC_MAX_TICK_OFFSET = 28;
const WC_MAX_ATTEMPTS = 6;

export const useCreateAssetRaffle = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();
  const { handleTransferShareRights } = useTransferShareManagementRights();
  const inFlightRef = useRef(false);

  const handleCreate = async (
    bundleItems: AssetRaffleBundleItemInput[],
    reservePriceQu: number,
    entryTicketQu: number,
  ): Promise<boolean> => {
    if (inFlightRef.current) {
      console.warn("Asset raffle creation already in flight; ignoring duplicate invocation");
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
      // Worst case every bundle item needs a share-management-rights transfer first.
      const requiredQu =
        QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE +
        MIN_TX_FEE_BUFFER +
        bundleItems.length * TRANSFER_SHARE_MANAGEMENT_RIGHTS_FEE;
      const quBalanceCheck = await BalanceChecks.forCustomAmount(
        publicKey,
        requiredQu,
        "asset raffle creation (proposal fee + tx buffers)",
      );
      if (!quBalanceCheck.hasEnoughBalance) {
        toast.error(
          `Insufficient QUBIC balance for asset raffle creation. Required: ${requiredQu.toLocaleString()} QUBIC.`,
        );
        return false;
      }

      // Stage 1: make sure every bundle item's shares are managed by QRaffle so
      // the contract can escrow them at creation time.
      for (let i = 0; i < bundleItems.length; i++) {
        const item = bundleItems[i];
        const balanceAtQRaffle = await fetchAssetsBalance(publicKey, item.assetName, SC_INDEX);
        if (balanceAtQRaffle >= item.numberOfShares) continue;

        toast.info(
          `Stage 1: transferring ${item.numberOfShares.toLocaleString()} ${item.assetName} shares to QRaffle management (${i + 1}/${bundleItems.length})...`,
        );
        const transferResult = await handleTransferShareRights({
          assetName: item.assetName,
          assetIssuer: item.issuer,
          contractIndex: SC_INDEX,
          amount: item.numberOfShares,
          isFromQX: true,
        });
        if (!transferResult.success) {
          toast.error(`Stage 1: share transfer for ${item.assetName} did not complete; aborting creation`);
          return false;
        }
      }

      // Baseline for the confirmation checker.
      let initialCreatedCount: number | null = null;
      try {
        const analytics = await getAssetRaffleAnalytics();
        initialCreatedCount = analytics?.totalAssetRafflesCreated ?? null;
      } catch (baselineError) {
        console.warn("Failed to fetch asset raffle analytics baseline", baselineError);
      }

      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "CreateAssetRaffle",
        minTickOffset: isWalletConnect ? WC_MIN_TICK_OFFSET : MIN_CREATE_TICK_OFFSET,
        maxTickOffset: isWalletConnect ? WC_MAX_TICK_OFFSET : undefined,
        maxAttempts: isWalletConnect ? WC_MAX_ATTEMPTS : undefined,
        execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
          const tx = await createAssetRaffle(publicKey, bundleItems, reservePriceQu, entryTicketQu, nextTargetTick || 0);
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      const { targetTick, result } = submission;
      if (!result || targetTick <= 0) {
        throw new Error("Asset raffle creation transaction submission failed");
      }

      toast.info(`Stage 2: creation broadcasted (${result.transactionId.slice(0, 10)}...)`);

      const checker = async () => {
        try {
          const analytics = await getAssetRaffleAnalytics();
          return (
            typeof initialCreatedCount === "number" &&
            !!analytics &&
            analytics.totalAssetRafflesCreated > initialCreatedCount
          );
        } catch (checkerError) {
          console.warn("Asset raffle creation checker failed", checkerError);
          return false;
        }
      };

      return await new Promise<boolean>((resolve) => {
        startMonitoring(
          `create-asset-raffle-${publicKey}-${targetTick}-${Date.now()}`,
          {
            checker,
            onSuccess: async () => {
              toast.success("Asset raffle created — bundle escrowed until epoch end");
              resolve(true);
            },
            onFailure: async () => {
              toast.error("Asset raffle creation failed");
              resolve(false);
            },
            targetTick,
            txHash: result.transactionId,
            canRecoverFromMoneyFlewFalse: true,
            timeoutMs: 45000,
            fastTrack: true,
          },
          "v2",
        );
      });
    } catch (error) {
      if (isRetryableTickError(error)) {
        toast.error("Submission failed due to RPC/tick timing. Please wait a few seconds and try again.");
      } else {
        toast.error("Failed to create asset raffle");
      }
      console.error("Error creating asset raffle:", error);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };

  return { handleCreate };
};
