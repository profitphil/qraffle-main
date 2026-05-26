import { getAnalytics, getQuRaffleEntryAmountPerUser, submitEntryAmount } from "@/services/sc.service";
import { useAtom } from "jotai";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { settingsAtom } from "@/store/settings";
import { broadcastTx, fetchTickInfo } from "@/services/rpc.service";
import { useTxMonitor } from "@/store/txMonitor";
import { toast } from "sonner";
import { BalanceChecks } from "@/utils/balanceCheck";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";

export const useSubmitEntryAmount = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();

  const handleSubmitEntryAmount = async (amount: number) => {
    if (!wallet) return false;

    // Check balance before proceeding
    const balanceCheck = await BalanceChecks.forCustomAmount(wallet.publicKey, 0, "entry amount submission");
    if (!balanceCheck.hasEnoughBalance) {
      return false;
    }

    let initialSubmissionCount: number | null = null;
    let initialUserEntryAmount: number | null = null;
    try {
      const [analytics, userEntryAmount] = await Promise.all([
        getAnalytics(),
        getQuRaffleEntryAmountPerUser(wallet.publicKey),
      ]);
      initialSubmissionCount = analytics.numberOfEntryAmountSubmitted;
      initialUserEntryAmount = userEntryAmount ? Number(userEntryAmount.entryAmount) : null;
    } catch (error) {
      console.warn("Failed to fetch entry amount baseline before submission", error);
    }

    let targetTick = 0;
    let result: Awaited<ReturnType<typeof broadcastTx>>;
    const isWalletConnect = wallet.connectType === "walletconnect";

    try {
      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "SubmitEntryAmount",
        minTickOffset: isWalletConnect ? 18 : undefined,
        maxTickOffset: isWalletConnect ? 28 : undefined,
        maxAttempts: isWalletConnect ? 6 : undefined,
        execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
          const tx = await submitEntryAmount(wallet.publicKey, amount, nextTargetTick || 0);
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      targetTick = submission.targetTick;
      result = submission.result;
    } catch (error) {
      if (isRetryableTickError(error)) {
        toast.error("Submission failed due to RPC/tick timing. Please wait a few seconds and try again.");
      } else {
        toast.error("Entry amount submission failed");
      }
      console.error("Error submitting entry amount:", error);
      return false;
    }

    const taskId = `submit-entry-${wallet.publicKey}-${targetTick}-${Date.now()}`;

    const onSuccess = async () => {
      toast.success("Entry amount submitted successfully");
    };

    const onFailure = async () => {
      toast.error("Entry amount submission failed");
    };

    const entryAmountChecker = async () => {
      try {
        const [analytics, userEntryAmount] = await Promise.all([
          getAnalytics(),
          getQuRaffleEntryAmountPerUser(wallet.publicKey),
        ]);

        const currentSubmissionCount = analytics.numberOfEntryAmountSubmitted;
        const currentUserEntryAmount = userEntryAmount ? Number(userEntryAmount.entryAmount) : null;

        const hasSubmissionCountIncreased =
          typeof initialSubmissionCount === "number" && currentSubmissionCount > initialSubmissionCount;
        const hasUserEntryAmountChangedToTarget =
          currentUserEntryAmount === amount &&
          (initialUserEntryAmount === null || initialUserEntryAmount !== amount || hasSubmissionCountIncreased);

        return hasSubmissionCountIncreased || hasUserEntryAmountChangedToTarget;
      } catch (checkerError) {
        console.warn("Entry amount checker failed", checkerError);
        return false;
      }
    };

    startMonitoring(taskId, {
      checker: entryAmountChecker,
      onSuccess,
      onFailure,
      targetTick,
      txHash: result.transactionId,
      canRecoverFromMoneyFlewFalse: true,
    }, "v2");

    return true;
  };

  return { handleSubmitEntryAmount };
};
