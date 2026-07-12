import { useRef } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";

import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { broadcastTx, fetchBalance, fetchTickInfo } from "@/services/rpc.service";
import { buyAssetRaffleTicket, getActiveAssetRaffle } from "@/services/sc.service";
import { settingsAtom } from "@/store/settings";
import { useTxMonitor } from "@/store/txMonitor";
import { BalanceChecks } from "@/utils/balanceCheck";
import { MIN_TX_FEE_BUFFER } from "@/utils/constants";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";

const MIN_BUY_TICK_OFFSET = 12;
const WC_MIN_TICK_OFFSET = 18;
const WC_MAX_TICK_OFFSET = 28;
const WC_MAX_ATTEMPTS = 6;

export const useBuyAssetRaffleTicket = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();
  const inFlightRef = useRef(false);

  const handleBuy = async (
    indexOfAssetRaffle: number,
    numberOfTickets: number,
    entryTicketQu: number,
  ): Promise<boolean> => {
    if (inFlightRef.current) {
      console.warn("Ticket purchase already in flight; ignoring duplicate invocation");
      return false;
    }
    if (!wallet) {
      toast.error("Please connect your wallet");
      return false;
    }

    inFlightRef.current = true;
    const publicKey = wallet.publicKey;
    const isWalletConnect = wallet.connectType === "walletconnect";
    const totalCost = numberOfTickets * entryTicketQu;

    try {
      const balanceCheck = await BalanceChecks.forCustomAmount(
        publicKey,
        totalCost + MIN_TX_FEE_BUFFER,
        "asset raffle tickets (cost + tx fee buffer)",
      );
      if (!balanceCheck.hasEnoughBalance) {
        toast.error(
          `Insufficient QUBIC balance for tickets. Required: ${(totalCost + MIN_TX_FEE_BUFFER).toLocaleString()} QUBIC.`,
        );
        return false;
      }

      let initialTotalTickets: number | null = null;
      let initialQuBalance: number | null = null;
      try {
        const [raffle, balance] = await Promise.all([getActiveAssetRaffle(indexOfAssetRaffle), fetchBalance(publicKey)]);
        initialTotalTickets = raffle?.totalTickets ?? null;
        initialQuBalance = balance?.balance ?? null;
      } catch (baselineError) {
        console.warn("Failed to fetch asset raffle ticket baseline", baselineError);
      }

      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "BuyAssetRaffleTicket",
        minTickOffset: isWalletConnect ? WC_MIN_TICK_OFFSET : MIN_BUY_TICK_OFFSET,
        maxTickOffset: isWalletConnect ? WC_MAX_TICK_OFFSET : undefined,
        maxAttempts: isWalletConnect ? WC_MAX_ATTEMPTS : undefined,
        execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
          const tx = await buyAssetRaffleTicket(
            publicKey,
            indexOfAssetRaffle,
            numberOfTickets,
            totalCost,
            nextTargetTick || 0,
          );
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      const { targetTick, result } = submission;
      if (!result || targetTick <= 0) {
        throw new Error("Asset raffle ticket transaction submission failed");
      }

      toast.info(`Ticket purchase broadcasted (${result.transactionId.slice(0, 10)}...)`);

      const checker = async () => {
        try {
          const [raffle, balance] = await Promise.all([
            getActiveAssetRaffle(indexOfAssetRaffle),
            fetchBalance(publicKey),
          ]);
          const ticketsIncreased =
            typeof initialTotalTickets === "number" && !!raffle && raffle.totalTickets > initialTotalTickets;
          const currentBalance = balance?.balance;
          const spentTicketCost =
            typeof initialQuBalance === "number" &&
            typeof currentBalance === "number" &&
            initialQuBalance - currentBalance >= totalCost;
          return ticketsIncreased || spentTicketCost;
        } catch (checkerError) {
          console.warn("Asset raffle ticket checker failed", checkerError);
          return false;
        }
      };

      return await new Promise<boolean>((resolve) => {
        startMonitoring(
          `buy-asset-raffle-ticket-${publicKey}-${targetTick}-${Date.now()}`,
          {
            checker,
            onSuccess: async () => {
              toast.success(
                `Bought ${numberOfTickets.toLocaleString()} ticket${numberOfTickets === 1 ? "" : "s"} — winner drawn at epoch end`,
              );
              resolve(true);
            },
            onFailure: async () => {
              toast.error("Ticket purchase failed");
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
        toast.error("Failed to buy asset raffle tickets");
      }
      console.error("Error buying asset raffle tickets:", error);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };

  return { handleBuy };
};
