import { useEffect } from "react";
import { useAtom } from "jotai";
import { tickInfoAtom, latestStatsAtom } from "@/store/rpc";
import { balancesAtom } from "@/store/balances";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { fetchBalance, fetchLatestStats, fetchTickInfo } from "@/services/rpc.service";

// NOTE: Discord epoch winner + dividend announcements are handled SERVER-SIDE by the
// scheduled function at netlify/functions/announce-epoch. The old client-side trigger
// (which only fired if a browser tab was open at 13:15 UTC Wednesday) was removed so
// announcements no longer depend on someone having the site open.

const useDataFetcher = () => {
  const [, setBalance] = useAtom(balancesAtom);
  const [, setTickInfo] = useAtom(tickInfoAtom);
  const [, setLatestStats] = useAtom(latestStatsAtom);
  const { wallet } = useQubicConnect();

  useEffect(() => {
    let isActive = true;
    let isTickPolling = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const refreshTickInfo = async () => {
      if (isTickPolling) return;
      isTickPolling = true;
      try {
        const data = await fetchTickInfo();
        if (!isActive || !data?.tick) return;
        setTickInfo(data);
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
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [wallet?.publicKey, setBalance, setTickInfo, setLatestStats]);
};

export default useDataFetcher;
