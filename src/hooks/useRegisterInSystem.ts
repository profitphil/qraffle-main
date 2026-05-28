import { getAnalytics, getRegisters, registerInSystem, SC_INDEX } from "@/services/sc.service";
import { useAtom } from "jotai";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { settingsAtom } from "@/store/settings";
import { broadcastTx, fetchTickInfo } from "@/services/rpc.service";
import { useTxMonitor } from "@/store/txMonitor";
import { toast } from "sonner";
import { BalanceChecks } from "@/utils/balanceCheck";
import useTransferShareManagementRights from "@/hooks/useTransferShareManagementRight";
import { QRAFFLE_QXMR_REGISTER_AMOUNT } from "@/utils/constants";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";

const PAGE_SIZE = 20;
const REGISTER_MONITOR_TIMEOUT_MS = 180000;
const REGISTER_CHECK_INTERVAL_MS = 2000;
const REGISTER_DEEP_CHECK_INTERVAL_MS = 8000;

const normalizeIdentity = (value: string | null | undefined) => value?.replace(/\0/g, "").trim().toUpperCase() || "";

const findWalletRegisterPage = async ({
  publicKey,
  totalRegisters,
  preferredPageIndex,
}: {
  publicKey: string;
  totalRegisters: number;
  preferredPageIndex?: number | null;
}) => {
  const normalizedWallet = normalizeIdentity(publicKey);
  const pageCount = Math.ceil(Math.max(0, totalRegisters) / PAGE_SIZE);

  if (pageCount <= 0) {
    return { isRegistered: false, pageIndex: null as number | null };
  }

  const pageOrder: number[] = [];
  if (
    typeof preferredPageIndex === "number" &&
    Number.isInteger(preferredPageIndex) &&
    preferredPageIndex >= 0 &&
    preferredPageIndex < pageCount
  ) {
    pageOrder.push(preferredPageIndex);
  }

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    if (!pageOrder.includes(pageIndex)) {
      pageOrder.push(pageIndex);
    }
  }

  for (const pageIndex of pageOrder) {
    const offset = pageIndex * PAGE_SIZE;
    const limit = Math.min(PAGE_SIZE, totalRegisters - offset);
    if (limit <= 0) {
      continue;
    }

    const page = await getRegisters(offset, limit);
    if (!Array.isArray(page.registers) || page.registers.length === 0) {
      continue;
    }

    const hasWallet = page.registers.some((register) => normalizeIdentity(register) === normalizedWallet);
    if (hasWallet) {
      return { isRegistered: true, pageIndex };
    }
  }

  return { isRegistered: false, pageIndex: null as number | null };
};

export const useRegisterInSystem = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();

  const { handleTransferShareRights, checkTransferShareRights } = useTransferShareManagementRights();

  const submitRegisterTx = async (withQXMR: boolean) => {
    if (!wallet) return;

    const isWalletConnect = wallet.connectType === "walletconnect";

    let baselineRegisterCount: number | null = null;
    let baselineRegisterPageIndex: number | null = null;

    try {
      const baselineAnalytics = await getAnalytics();
      baselineRegisterCount = baselineAnalytics.numberOfRegisters;

      if (baselineRegisterCount > 0) {
        const baselineLookup = await findWalletRegisterPage({
          publicKey: wallet.publicKey,
          totalRegisters: baselineRegisterCount,
        });

        if (baselineLookup.isRegistered) {
          toast.success("You are already registered in system");
          return;
        }

        baselineRegisterPageIndex = baselineLookup.pageIndex;
      }
    } catch (baselineError) {
      console.warn("Failed to perform register baseline membership precheck", baselineError);
    }

    let targetTick = 0;
    let result: Awaited<ReturnType<typeof broadcastTx>>;

    try {
      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "RegisterInSystem",
        minTickOffset: isWalletConnect ? 15 : 8,
        maxTickOffset: isWalletConnect ? 25 : 20,
        maxAttempts: isWalletConnect ? 6 : 4,
        execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
          const tx = await registerInSystem(wallet.publicKey, nextTargetTick || 0, withQXMR);
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      targetTick = submission.targetTick;
      result = submission.result;
    } catch (error) {
      if (isRetryableTickError(error)) {
        toast.error("Registration failed due to RPC/tick timing. Please wait a few seconds and try again.");
      } else {
        toast.error("Register in system failure");
      }
      console.error("Error registering in system:", error);
      return;
    }

    const taskId = `reg-${wallet.publicKey}-${targetTick}-${Date.now()}`;
    let lastCheckerRunAt = 0;
    let lastDeepCheckAt = 0;
    let inFlightChecker: Promise<boolean> | null = null;

    const isWalletRegistered = async (forceDeepCheck = false) => {
      const analytics = await getAnalytics();
      const currentRegisterCount = analytics.numberOfRegisters;

      if (currentRegisterCount <= 0) {
        return false;
      }

      const now = Date.now();
      const hasCountIncreased =
        typeof baselineRegisterCount === "number" && currentRegisterCount > baselineRegisterCount;
      const shouldDeepCheck =
        forceDeepCheck ||
        hasCountIncreased ||
        now - lastDeepCheckAt >= REGISTER_DEEP_CHECK_INTERVAL_MS ||
        currentRegisterCount <= PAGE_SIZE ||
        baselineRegisterPageIndex === null;

      if (!shouldDeepCheck) {
        return false;
      }

      lastDeepCheckAt = now;

      const lookup = await findWalletRegisterPage({
        publicKey: wallet.publicKey,
        totalRegisters: currentRegisterCount,
        preferredPageIndex: baselineRegisterPageIndex,
      });

      baselineRegisterPageIndex = lookup.pageIndex;
      return lookup.isRegistered;
    };

    const onSuccess = async () => {
      toast.success("Register in system successfully");
    };

    const registerChecker = async () => {
      if (inFlightChecker) {
        return inFlightChecker;
      }

      const now = Date.now();
      if (now - lastCheckerRunAt < REGISTER_CHECK_INTERVAL_MS) {
        return false;
      }

      lastCheckerRunAt = now;
      inFlightChecker = (async () => {
        try {
          return await isWalletRegistered(false);
        } catch (checkerError) {
          console.warn("Register checker failed", checkerError);
          return false;
        } finally {
          inFlightChecker = null;
        }
      })();

      return inFlightChecker;
    };

    const onFailure = async () => {
      try {
        const confirmedRegistered = await isWalletRegistered(true);
        if (confirmedRegistered) {
          toast.success("Register in system successfully");
          return;
        }
      } catch (finalCheckError) {
        console.warn("Final register state verification failed", finalCheckError);
      }

      toast.error("Register in system failure");
    };

    startMonitoring(taskId, {
      checker: registerChecker,
      onSuccess,
      onFailure,
      targetTick,
      txHash: result.transactionId,
      canRecoverFromMoneyFlewFalse: true,
      timeoutMs: REGISTER_MONITOR_TIMEOUT_MS,
    }, "v2");
  };

  const handleRegister = async (options?: {
    withQXMR?: boolean;
    qxmrIssuer?: string; // required if withQXMR
    qxmrAssetName?: string; // required if withQXMR (human-readable name string)
  }) => {
    if (!wallet) return;
    const withQXMR = options?.withQXMR === true;

    // Check balance before proceeding (QUBIC needed either for amount or fees)
    const balanceCheck = withQXMR
      ? await BalanceChecks.forTransferShareRights(wallet.publicKey)
      : await BalanceChecks.forRegistration(wallet.publicKey);
    if (!balanceCheck.hasEnoughBalance) {
      return;
    }

    // If using QXMR, transfer share management rights first, then register with flag
    if (withQXMR) {
      if (!options?.qxmrIssuer || !options?.qxmrAssetName) {
        toast.error("Missing QXMR issuer or asset name");
        return;
      }

      const check = await checkTransferShareRights(options.qxmrAssetName, SC_INDEX, QRAFFLE_QXMR_REGISTER_AMOUNT);
      if (!check) {
        await handleTransferShareRights({
          assetIssuer: options.qxmrIssuer,
          assetName: options.qxmrAssetName,
          amount: QRAFFLE_QXMR_REGISTER_AMOUNT,
          contractIndex: SC_INDEX,
          isFromQX: true,
          fallback: async () => {
            await submitRegisterTx(true);
          },
        });
      } else {
        await submitRegisterTx(true);
      }
    } else {
      await submitRegisterTx(false);
    }
  };

  return { handleRegister };
};
