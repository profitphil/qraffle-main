import { getAnalytics, getRegisters, logoutInSystem } from "@/services/sc.service";
import { useAtom } from "jotai";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { settingsAtom } from "@/store/settings";
import { broadcastTx, fetchTickInfo } from "@/services/rpc.service";
import { useTxMonitor } from "@/store/txMonitor";
import { toast } from "sonner";
import { BalanceChecks } from "@/utils/balanceCheck";
import { isRetryableTickError, submitWithFreshTick } from "@/utils/tickRetry";

const PAGE_SIZE = 20;
const LOGOUT_MIN_TICK_OFFSET = 12;
const LOGOUT_MONITOR_TIMEOUT_MS = 300000;
const LOGOUT_CHECK_INTERVAL_MS = 2000;
const LOGOUT_DEEP_CHECK_INTERVAL_MS = 10000;

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

export const useLogoutInSystem = () => {
  const [settings] = useAtom(settingsAtom);
  const { wallet, getSignedTx } = useQubicConnect();
  const { startMonitoring } = useTxMonitor();

  const handleLogout = async () => {
    if (!wallet) return;

    const isWalletConnect = wallet.connectType === "walletconnect";

    // Check balance before proceeding
    const balanceCheck = await BalanceChecks.forLogout(wallet.publicKey);
    if (!balanceCheck.hasEnoughBalance) {
      return;
    }

    let baselineRegisterCount: number | null = null;
    let baselineRegisterPageIndex: number | null = null;

    try {
      const baselineAnalytics = await getAnalytics();
      baselineRegisterCount = baselineAnalytics.numberOfRegisters;

      if (baselineRegisterCount <= 0) {
        toast.success("You are already logged out from system");
        return;
      }

      const baselineLookup = await findWalletRegisterPage({
        publicKey: wallet.publicKey,
        totalRegisters: baselineRegisterCount,
      });

      if (!baselineLookup.isRegistered) {
        toast.success("You are already logged out from system");
        return;
      }

      baselineRegisterPageIndex = baselineLookup.pageIndex;
    } catch (baselineError) {
      console.warn("Failed to perform logout baseline membership precheck", baselineError);
    }

    let targetTick = 0;
    let result: Awaited<ReturnType<typeof broadcastTx>>;

    try {
      const submission = await submitWithFreshTick({
        tickOffset: settings.tickOffset,
        fetchTickInfo,
        retryContext: "LogoutInSystem",
        minTickOffset: isWalletConnect ? 15 : LOGOUT_MIN_TICK_OFFSET,
        maxTickOffset: isWalletConnect ? 25 : 20,
        maxAttempts: isWalletConnect ? 6 : 4,
        execute: async ({ targetTick: nextTargetTick, checkpoint }) => {
          const tx = await logoutInSystem(wallet.publicKey, nextTargetTick || 0);
          const signedTx = await getSignedTx(tx);
          await checkpoint();
          return await broadcastTx(signedTx.tx);
        },
      });

      targetTick = submission.targetTick;
      result = submission.result;
    } catch (error) {
      if (isRetryableTickError(error)) {
        toast.error("Logout failed due to RPC/tick timing. Please wait a few seconds and try again.");
      } else {
        toast.error("Logout from system failure");
      }
      console.error("Error logging out from system:", error);
      return;
    }

    const taskId = `logout-${wallet.publicKey}-${targetTick}-${Date.now()}`;
    let lastCheckerRunAt = 0;
    let lastDeepCheckAt = 0;
    let inFlightChecker: Promise<boolean> | null = null;

    const hasWalletLoggedOut = async (forceDeepCheck = false) => {
      const analytics = await getAnalytics();
      const currentRegisterCount = analytics.numberOfRegisters;

      if (typeof baselineRegisterCount === "number" && currentRegisterCount < baselineRegisterCount) {
        return true;
      }

      if (currentRegisterCount <= 0) {
        return true;
      }

      const now = Date.now();
      const shouldDeepCheck =
        forceDeepCheck ||
        now - lastDeepCheckAt >= LOGOUT_DEEP_CHECK_INTERVAL_MS ||
        currentRegisterCount <= PAGE_SIZE ||
        baselineRegisterPageIndex === null;

      if (!shouldDeepCheck) {
        return false;
      }

      lastDeepCheckAt = now;

      const currentLookup = await findWalletRegisterPage({
        publicKey: wallet.publicKey,
        totalRegisters: currentRegisterCount,
        preferredPageIndex: baselineRegisterPageIndex,
      });

      baselineRegisterPageIndex = currentLookup.pageIndex;
      return !currentLookup.isRegistered;
    };

    const onSuccess = async () => {
      toast.success("Logout from system successfully");
    };

    const logoutChecker = async () => {
      if (inFlightChecker) {
        return inFlightChecker;
      }

      const now = Date.now();
      if (now - lastCheckerRunAt < LOGOUT_CHECK_INTERVAL_MS) {
        return false;
      }

      lastCheckerRunAt = now;
      inFlightChecker = (async () => {
        try {
          return await hasWalletLoggedOut(false);
        } catch (checkerError) {
          console.warn("Logout checker failed", checkerError);
          return false;
        } finally {
          inFlightChecker = null;
        }
      })();

      return inFlightChecker;
    };

    const onFailure = async () => {
      try {
        const confirmedLoggedOut = await hasWalletLoggedOut(true);
        if (confirmedLoggedOut) {
          toast.success("Logout from system successfully");
          return;
        }
      } catch (finalCheckError) {
        console.warn("Final logout state verification failed", finalCheckError);
      }

      toast.error("Logout from system failure");
    };

    startMonitoring(taskId, {
      checker: logoutChecker,
      onSuccess,
      onFailure,
      targetTick,
      txHash: result.transactionId,
      canRecoverFromMoneyFlewFalse: true,
      timeoutMs: LOGOUT_MONITOR_TIMEOUT_MS,
      fastTrack: true,
    }, "v2");
  };

  return { handleLogout };
};
