import { getActiveProposal, voteInProposal } from "@/services/sc.service";
import { useAtom } from "jotai";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { settingsAtom } from "@/store/settings";
import { broadcastTx, fetchTickInfo } from "@/services/rpc.service";
import { useTxMonitor } from "@/store/txMonitor";
import { toast } from "sonner";
import { BalanceChecks } from "@/utils/balanceCheck";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";

export const useVoteInProposal = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();

  const handleVote = async (
    indexOfProposal: number,
    yes: boolean,
    onConfirmed?: () => void,
    baseline?: { nYes: number; nNo: number },
  ) => {
    if (!wallet) return false;

    // Check balance before proceeding (voting doesn't require fees but ensures wallet is connected)
    const balanceCheck = await BalanceChecks.forVoting(wallet.publicKey);
    if (!balanceCheck.hasEnoughBalance) {
      return false;
    }

    let initialYes: number | null =
      typeof baseline?.nYes === "number" && Number.isFinite(baseline.nYes) ? Number(baseline.nYes) : null;
    let initialNo: number | null =
      typeof baseline?.nNo === "number" && Number.isFinite(baseline.nNo) ? Number(baseline.nNo) : null;
    try {
      if (initialYes === null || initialNo === null) {
        const proposal = await getActiveProposal(indexOfProposal);
        if (proposal) {
          initialYes = Number(proposal.nYes);
          initialNo = Number(proposal.nNo);
        }
      }
    } catch (error) {
      console.warn("Failed to fetch proposal baseline before voting", error);
    }

    let targetTick = 0;
    let result: Awaited<ReturnType<typeof broadcastTx>>;
    const isWalletConnect = wallet.connectType === "walletconnect";

    try {
      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "VoteInProposal",
        minTickOffset: isWalletConnect ? 18 : undefined,
        maxTickOffset: isWalletConnect ? 28 : undefined,
        maxAttempts: isWalletConnect ? 6 : undefined,
        execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
          const tx = await voteInProposal(wallet.publicKey, indexOfProposal, yes, nextTargetTick || 0);
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      targetTick = submission.targetTick;
      result = submission.result;
    } catch (error) {
      if (isRetryableTickError(error)) {
        toast.error("Vote failed due to RPC/tick timing. Please wait a few seconds and try again.");
      } else {
        toast.error("Vote submission failed");
      }
      console.error("Error submitting vote:", error);
      return false;
    }

    const taskId = `vote-${wallet.publicKey}-${targetTick}-${Date.now()}`;

    const onSuccess = async () => {
      toast.success(`Vote ${yes ? "YES" : "NO"} submitted successfully`);
      onConfirmed?.();
    };

    const onFailure = async () => {
      toast.error("Vote submission failed");
    };

    const voteChecker = async () => {
      try {
        const proposal = await getActiveProposal(indexOfProposal);
        if (!proposal) {
          return false;
        }

        const nextYes = Number(proposal.nYes);
        const nextNo = Number(proposal.nNo);

        if (initialYes === null || initialNo === null) {
          return false;
        }

        return yes ? nextYes > initialYes : nextNo > initialNo;
      } catch (checkerError) {
        console.warn("Vote checker failed", checkerError);
        return false;
      }
    };

    startMonitoring(taskId, {
      checker: voteChecker,
      onSuccess,
      onFailure,
      targetTick,
      txHash: result.transactionId,
      canRecoverFromMoneyFlewFalse: true,
    }, "v2");

    return true;
  };

  return { handleVote };
};
