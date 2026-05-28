import { depositeInQuRaffle, getAnalytics } from "@/services/sc.service";
import { useAtom } from "jotai";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { settingsAtom } from "@/store/settings";
import { broadcastTx, fetchBalance, fetchTickInfo } from "@/services/rpc.service";
import { useTxMonitor } from "@/store/txMonitor";
import { toast } from "sonner";
import { BalanceChecks } from "@/utils/balanceCheck";
import { addParticipation } from "@/utils/participationStorage";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";
import { MIN_TX_FEE_BUFFER } from "@/utils/constants";

const MIN_RAFFLE_DEPOSIT_TICK_OFFSET = 12;

export const useDepositInQuRaffle = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();

  const handleDeposit = async (amount: number) => {
    if (!wallet) return false;
    const isWalletConnect = wallet.connectType === "walletconnect";

    const totalRequiredAmount = amount + MIN_TX_FEE_BUFFER;

    // Check balance before proceeding
    const balanceCheck = await BalanceChecks.forCustomAmount(
      wallet.publicKey,
      totalRequiredAmount,
      "QuRaffle deposit (entry + tx fee buffer)",
    );
    if (!balanceCheck.hasEnoughBalance) {
      return false;
    }

    let initialMemberCount: number | null = null;
    let initialQuBalance: number | null = null;
    try {
      const [analytics, balance] = await Promise.all([getAnalytics(), fetchBalance(wallet.publicKey)]);
      initialMemberCount = analytics.numberOfQuRaffleMembers;
      initialQuBalance = balance?.balance ?? null;
    } catch (error) {
      console.warn("Failed to fetch QuRaffle baseline before deposit", error);
    }

    let targetTick = 0;
    let currentEpoch = 0;
    let result: Awaited<ReturnType<typeof broadcastTx>>;

    try {
      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "QuRaffleDeposit",
        minTickOffset: isWalletConnect ? 18 : MIN_RAFFLE_DEPOSIT_TICK_OFFSET,
        maxTickOffset: isWalletConnect ? 28 : undefined,
        maxAttempts: isWalletConnect ? 6 : undefined,
        execute: async ({ tickInfo, targetTick: nextTargetTick, checkpoint }) => {
          currentEpoch = tickInfo.epoch;
          const tx = await depositeInQuRaffle(wallet.publicKey, amount, nextTargetTick || 0);
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      targetTick = submission.targetTick;
      result = submission.result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (/insufficient funds/i.test(errorMessage)) {
        toast.error(
          `Insufficient QUBIC balance for QuRaffle deposit. Required: ${totalRequiredAmount.toLocaleString()} QUBIC (entry + tx fee buffer).`,
        );
      } else if (isRetryableTickError(error)) {
        toast.error("Deposit failed due to RPC/tick timing. Please wait a few seconds and try again.");
      } else {
        toast.error("Deposit in QuRaffle failed");
      }
      console.error("Error in QuRaffle deposit:", error);
      return false;
    }

    const taskId = `deposit-quraffle-${wallet.publicKey}-${targetTick}-${Date.now()}`;

    const onSuccess = async () => {
      // Save participation info to localStorage
      addParticipation(wallet.publicKey, {
        type: "qu",
        epoch: currentEpoch,
      });
      toast.success("Deposit in QuRaffle successful");
    };

    const onFailure = async () => {
      toast.error("Deposit in QuRaffle failed");
    };

    const depositChecker = async () => {
      try {
        const [analytics, balance] = await Promise.all([getAnalytics(), fetchBalance(wallet.publicKey)]);
        const membersIncreased =
          typeof initialMemberCount === "number" && analytics.numberOfQuRaffleMembers > initialMemberCount;
        const currentBalance = balance?.balance;
        const spentEntryAmount =
          typeof initialQuBalance === "number" &&
          typeof currentBalance === "number" &&
          initialQuBalance - currentBalance >= amount;

        return membersIncreased || spentEntryAmount;
      } catch (checkerError) {
        console.warn("QuRaffle deposit checker failed", checkerError);
        return false;
      }
    };

    startMonitoring(
      taskId,
      {
        checker: depositChecker,
        onSuccess,
        onFailure,
        targetTick,
        txHash: result.transactionId,
        canRecoverFromMoneyFlewFalse: true,
        timeoutMs: 45000,
        fastTrack: true,
        participationMetadata: {
          publicKey: wallet.publicKey,
          participation: {
            type: "qu",
            epoch: currentEpoch,
          },
        },
      },
      "v2",
    );

    return true;
  };

  return { handleDeposit };
};
