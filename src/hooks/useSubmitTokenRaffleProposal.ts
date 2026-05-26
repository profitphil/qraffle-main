import { getActiveProposal, getAnalytics, submitProposal } from "@/services/sc.service";
import { useAtom } from "jotai";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { settingsAtom } from "@/store/settings";
import { broadcastTx, fetchTickInfo } from "@/services/rpc.service";
import { useTxMonitor } from "@/store/txMonitor";
import { toast } from "sonner";
import { BalanceChecks } from "@/utils/balanceCheck";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";
import { valueOfAssetName } from "@/utils";

export const useSubmitTokenRaffleProposal = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();
  const normalize = (value: string | null | undefined) => value?.replace(/\0/g, "").trim().toUpperCase() || "";

  const handleSubmitProposal = async (issuer: string, assetName: string, entryAmount: number) => {
    if (!wallet) return false;

    const isWalletConnect = wallet.connectType === "walletconnect";

    const normalizedAssetName = normalize(assetName);
    let encodedAssetName: bigint;

    try {
      encodedAssetName = valueOfAssetName(normalizedAssetName);
    } catch (error) {
      console.error("Invalid asset name for proposal submission:", normalizedAssetName, error);
      toast.error("Invalid asset name. Please choose a valid asset and try again.");
      return false;
    }

    // Check balance before proceeding (proposal submission may require fees)
    const balanceCheck = await BalanceChecks.forVoting(wallet.publicKey);
    if (!balanceCheck.hasEnoughBalance) {
      return false;
    }

    let initialProposalCount: number | null = null;
    try {
      const analytics = await getAnalytics();
      initialProposalCount = analytics.numberOfProposals;
    } catch (error) {
      console.warn("Failed to fetch proposal baseline before submission", error);
    }

    let targetTick = 0;
    let result: Awaited<ReturnType<typeof broadcastTx>>;

    try {
      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "SubmitTokenRaffleProposal",
        minTickOffset: isWalletConnect ? 15 : 8,
        maxTickOffset: isWalletConnect ? 25 : 20,
        maxAttempts: isWalletConnect ? 6 : 4,
        execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
          const tx = await submitProposal(wallet.publicKey, issuer, encodedAssetName, entryAmount, nextTargetTick || 0);
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      targetTick = submission.targetTick;
      result = submission.result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (/WalletConnect (not connected|session expired)/i.test(errorMessage)) {
        toast.error(errorMessage);
      } else if (isRetryableTickError(error)) {
        toast.error("Submission failed due to RPC/tick timing. Please wait a few seconds and try again.");
      } else {
        toast.error("Token raffle proposal submission failed");
      }
      console.error("Error submitting token raffle proposal:", error);
      return false;
    }

    const taskId = `submit-proposal-${wallet.publicKey}-${targetTick}-${Date.now()}`;

    const onSuccess = async () => {
      toast.success("Token raffle proposal submitted successfully");
    };

    const onFailure = async () => {
      toast.error("Token raffle proposal submission failed");
    };

    const expectedTokenName = normalizedAssetName;
    const proposalChecker = async () => {
      try {
        const analytics = await getAnalytics();
        if (!analytics || analytics.numberOfProposals <= 0) {
          return false;
        }

        const latestIndex = analytics.numberOfProposals - 1;
        const fallbackWindowSize = 25;
        const startIndex =
          typeof initialProposalCount === "number"
            ? Math.max(0, Math.min(initialProposalCount, latestIndex))
            : Math.max(0, latestIndex - fallbackWindowSize + 1);

        for (let index = latestIndex; index >= startIndex; index--) {

          const proposal = await getActiveProposal(index);
          if (!proposal) {
            continue;
          }

          if (
            normalize(proposal.proposer) === normalize(wallet.publicKey) &&
            normalize(proposal.tokenIssuer) === normalize(issuer) &&
            normalize(String(proposal.tokenName)) === expectedTokenName &&
            Number(proposal.entryAmount) === entryAmount
          ) {
            return true;
          }
        }

        return false;
      } catch (checkerError) {
        console.warn("Proposal checker failed", checkerError);
        return false;
      }
    };

    startMonitoring(taskId, {
      checker: proposalChecker,
      onSuccess,
      onFailure,
      targetTick,
      txHash: result.transactionId,
      canRecoverFromMoneyFlewFalse: true,
    }, "v2");

    return true;
  };

  return { handleSubmitProposal };
};
