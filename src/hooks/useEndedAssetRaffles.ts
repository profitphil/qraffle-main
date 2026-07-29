import { useQuery } from "@tanstack/react-query";
import { getAssetRaffleAnalytics, getEndedAssetRaffle } from "@/services/sc.service";

export type EndedAssetRaffleRow = {
  index: number;
  epoch: number;
  creator: string;
  winner: string;
  reserveMet: boolean;
  bundleSize: number;
  totalTickets: number;
  numberOfBuyers: number;
  entryTicketQu: number;
  reservePriceQu: number;
  grossPoolQu: number;
  creatorPaidQu: number;
};

// The QRaffle contract keeps ended asset raffles in a single global array,
// indexed 0..numberOfEndedAssetRaffles-1 (there is no per-epoch index view like
// token raffles have). Raffles are appended in the order they end, so epochs are
// non-decreasing with index. We therefore walk from the newest index downward
// and stop once we drop below the requested window.
export const useEndedAssetRaffles = (minEpoch: number, maxEpoch: number) => {
  const {
    data: assetRaffles,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["endedAssetRaffles", minEpoch, maxEpoch],
    queryFn: async () => {
      const analytics = await getAssetRaffleAnalytics();
      const total = Math.max(0, Number(analytics?.numberOfEndedAssetRaffles ?? 0));
      const results: EndedAssetRaffleRow[] = [];

      for (let index = total - 1; index >= 0; index--) {
        let raffle;
        try {
          raffle = await getEndedAssetRaffle(index);
        } catch (err) {
          console.warn(`useEndedAssetRaffles: failed to load ended asset raffle index ${index}`, err);
          continue;
        }
        if (!raffle) continue;
        if (raffle.epoch > maxEpoch) continue;
        if (raffle.epoch < minEpoch) break; // older than the window; nothing earlier can match

        results.push({
          index,
          epoch: raffle.epoch,
          creator: raffle.creator,
          winner: raffle.epochWinner,
          reserveMet: raffle.reserveMet,
          bundleSize: raffle.bundleSize,
          totalTickets: raffle.totalTickets,
          numberOfBuyers: raffle.numberOfBuyers,
          entryTicketQu: raffle.entryTicketQu,
          reservePriceQu: raffle.reservePriceQu,
          grossPoolQu: raffle.grossPoolQu,
          creatorPaidQu: raffle.creatorPaidQu,
        });
      }

      return results;
    },
    enabled: Number.isFinite(minEpoch) && Number.isFinite(maxEpoch) && minEpoch <= maxEpoch && maxEpoch > 0,
    retry: 2,
  });

  return {
    assetRaffles: assetRaffles || [],
    isLoading,
    isError,
    error,
    refetch,
  };
};
