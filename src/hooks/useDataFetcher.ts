import { useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { tickInfoAtom, latestStatsAtom } from "@/store/rpc";
import { balancesAtom } from "@/store/balances";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { fetchBalance, fetchLatestStats, fetchTickInfo } from "@/services/rpc.service";
import { sendDividendBreakdownToDiscord, sendEpochWinnersToDiscord } from "@/services/webhook.service";

const LAST_SENT_EPOCH_STORAGE_KEY = "qraffle:lastEpochWebhookSent";
const ANNOUNCEMENT_WEEKDAY = 3; // Wednesday (0 = Sunday)
const ANNOUNCEMENT_HOUR_UTC = 13;
const ANNOUNCEMENT_MINUTE_UTC = 15;
const ANNOUNCEMENT_WINDOW_MS = 60_000;

const getStoredLastSentEpoch = () => {
  if (typeof window === "undefined") return 0;
  const storedValue = Number(window.localStorage.getItem(LAST_SENT_EPOCH_STORAGE_KEY));
  return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : 0;
};

const getDelayUntilAnnouncementWindow = (): number | null => {
  const now = new Date();
  if (now.getUTCDay() !== ANNOUNCEMENT_WEEKDAY) return null;

  const targetTime = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    ANNOUNCEMENT_HOUR_UTC,
    ANNOUNCEMENT_MINUTE_UTC,
    0,
    0,
  );

  const diff = targetTime - now.getTime();
  if (diff > 0) return diff;

  const elapsedSinceTarget = now.getTime() - targetTime;
  return elapsedSinceTarget <= ANNOUNCEMENT_WINDOW_MS ? 0 : null;
};

const useDataFetcher = () => {
  const [, setBalance] = useAtom(balancesAtom);
  const [tickInfo, setTickInfo] = useAtom(tickInfoAtom);
  const epoch = useRef<number>(tickInfo?.epoch);
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingAnnouncementsRef = useRef(false);
  const lastSentEpochRef = useRef<number>(getStoredLastSentEpoch());
  const hasHydratedStorageRef = useRef<boolean>(typeof window === "undefined");
  const [, setLatestStats] = useAtom(latestStatsAtom);
  const { wallet } = useQubicConnect();

  useEffect(() => {
    let isActive = true;
    let isTickPolling = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const persistLastSentEpoch = (epochValue: number) => {
      lastSentEpochRef.current = epochValue;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_SENT_EPOCH_STORAGE_KEY, String(epochValue));
      }
    };

    const hydrateStorageIfNeeded = () => {
      if (hasHydratedStorageRef.current) return;
      if (typeof window === "undefined") return;
      const storedRawValue = window.localStorage.getItem(LAST_SENT_EPOCH_STORAGE_KEY);
      if (storedRawValue !== null) {
        const storedValue = Number(storedRawValue);
        if (Number.isFinite(storedValue) && storedValue > 0) {
          lastSentEpochRef.current = storedValue;
        }
      }
      hasHydratedStorageRef.current = true;
    };

    const clearAnnouncementTimeout = () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
        announcementTimeoutRef.current = null;
      }
    };

    const announceEpoch = async (epochToAnnounce: number) => {
      const winnersSuccess = await sendEpochWinnersToDiscord(epochToAnnounce);
      const dividendsSuccess = winnersSuccess ? await sendDividendBreakdownToDiscord(epochToAnnounce) : false;

      const success = winnersSuccess && dividendsSuccess;
      if (success) {
        persistLastSentEpoch(epochToAnnounce);
      }

      return success;
    };

    const scheduleAnnouncement = (delayMs: number) => {
      clearAnnouncementTimeout();
      announcementTimeoutRef.current = setTimeout(async () => {
        announcementTimeoutRef.current = null;
        if (!isActive) return;

        try {
          const latestTickInfo = await fetchTickInfo();
          if (typeof latestTickInfo?.epoch === "number" && Number.isFinite(latestTickInfo.epoch)) {
            epoch.current = latestTickInfo.epoch;
            setTickInfo(latestTickInfo);
          }
        } catch (error) {
          if (isActive) {
            console.error("Error refreshing tick info before scheduled webhook announcement:", error);
          }
        }

        await processPendingAnnouncements(epoch.current ?? 0);
      }, delayMs);
    };

    const processPendingAnnouncements = async (latestEpochValue: number) => {
      if (!isActive) return;
      const highestCompletedEpoch = latestEpochValue - 1;
      if (highestCompletedEpoch <= 0) return;
      if (isProcessingAnnouncementsRef.current) return;
      if (lastSentEpochRef.current >= highestCompletedEpoch) return;

      isProcessingAnnouncementsRef.current = true;
      try {
        const delayMs = getDelayUntilAnnouncementWindow();

        if (delayMs === null) {
          clearAnnouncementTimeout();
          return;
        }

        if (delayMs > 0) {
          scheduleAnnouncement(delayMs);
          return;
        }

        const success = await announceEpoch(highestCompletedEpoch);
        if (!success) {
          return;
        }
      } finally {
        isProcessingAnnouncementsRef.current = false;
      }
    };

    const refreshTickInfo = async () => {
      if (isTickPolling) return;
      isTickPolling = true;
      try {
        const data = await fetchTickInfo();
        if (!isActive || !data?.tick) return;

        hydrateStorageIfNeeded();

        setTickInfo(data);
        epoch.current = data?.epoch;

        await processPendingAnnouncements(data.epoch);
      } catch (error) {
        if (isActive) {
          console.error("Error fetching tick info:", error);
        }
      } finally {
        isTickPolling = false;
      }
    };

    const refreshLatestStats = async () => {
      try {
        const data = await fetchLatestStats();
        if (isActive) {
          setLatestStats(data);
        }
      } catch (error) {
        console.error("Error fetching latest stats:", error);
      }
    };

    const refreshBalance = async () => {
      if (!wallet?.publicKey) return;
      try {
        const data = await fetchBalance(wallet.publicKey);
        if (isActive) {
          setBalance([data]);
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    refreshTickInfo();
    refreshLatestStats();
    refreshBalance();

    intervalId = setInterval(() => {
      void refreshTickInfo();
    }, 30000);

    return () => {
      isActive = false;
      clearAnnouncementTimeout();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [wallet?.publicKey, setBalance, setTickInfo, setLatestStats]);
};

export default useDataFetcher;
