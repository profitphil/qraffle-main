import { useRef } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";

import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { broadcastTx, fetchTickInfo } from "@/services/rpc.service";
import { cancelAssetRaffle, getAssetRaffleAnalytics } from "@/services/sc.service";
import { settingsAtom } from "@/store/settings";
import { useTxMonitor } from "@/store/txMonitor";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";

const MIN_CANCEL_TICK_OFFSET = 12;
const WC_MIN_TICK_OFFSET = 18;
const WC_MAX_TICK_OFFSET = 28;
const WC_MAX_ATTEMPTS = 6;

export const useCancelAssetRaffle = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();
  const inFlightRef = useRef(false);

  const handleCancel = async (indexOfAssetRaffle: number): Promise<boolean> => {
    if (inFlightRef.current) {
      console.warn("Asset raffle cancel already in flight; ignoring duplicate invocation");
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
      let initialActiveCount: number | null = null;
      try {
        const analytics = await getAssetRaffleAnalytics();
        initialActiveCount = analytics?.numberOfActiveAssetRaffles ?? null;
      } catch (baselineError) {
        console.warn("Failed to fetch asset raffle cancel baseline", baselineError);
      }

      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "CancelAssetRaffle",
        minTickOffset: isWalletConnect ? WC_MIN_TICK_OFFSET : MIN_CANCEL_TICK_OFFSET,
        maxTickOffset: isWalletConnect ? WC_MAX_TICK_OFFSET : undefined,
        maxAttempts: isWalletConnect ? WC_MAX_ATTEMPTS : undefined,
        execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
          const tx = await cancelAssetRaffle(publicKey, indexOfAssetRaffle, nextTargetTick || 0);
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      const { targetTick, result } = submission;
      if (!result || targetTick <= 0) {
        throw new Error("Asset raffle cancel transaction submission failed");
      }

      toast.info(`Cancel broadcasted (${result.transactionId.slice(0, 10)}...)`);

      const checker = async () => {
        try {
          const analytics = await getAssetRaffleAnalytics();
          return (
            typeof initialActiveCount === "number" &&
            !!analytics &&
            analytics.numberOfActiveAssetRaffles < initialActiveCount
          );
        } catch (checkerError) {
          console.warn("Asset raffle cancel checker failed", checkerError);
          return false;
        }
      };

      return await new Promise<boolean>((resolve) => {
        startMonitoring(
          `cancel-asset-raffle-${publicKey}-${targetTick}-${Date.now()}`,
          {
            checker,
            onSuccess: async () => {
              toast.success("Asset raffle cancelled — bundle returned to your wallet");
              resolve(true);
            },
            onFailure: async () => {
              toast.error("Asset raffle cancel failed");
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
        toast.error("Failed to cancel asset raffle");
      }
      console.error("Error cancelling asset raffle:", error);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };

  return { handleCancel };
};
