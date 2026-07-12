import { useQuery } from "@tanstack/react-query";

import {
  getActiveAssetRaffle,
  getActiveAssetRaffleBundleItem,
  getAssetRaffleAnalytics,
  type AssetRaffle,
  type AssetRaffleBundleItem,
} from "@/services/sc.service";

export interface ActiveAssetRaffle extends AssetRaffle {
  index: number;
  bundleItems: AssetRaffleBundleItem[];
}

export const useAssetRaffles = () => {
  const query = useQuery({
    queryKey: ["activeAssetRaffles"],
    queryFn: async () => {
      const analytics = await getAssetRaffleAnalytics();
      const count = analytics?.numberOfActiveAssetRaffles ?? 0;

      const raffles = await Promise.all(
        Array.from({ length: count }, async (_, index) => {
          const raffle = await getActiveAssetRaffle(index);
          if (!raffle || raffle.returnCode !== 0) return null;

          const items = await Promise.all(
            Array.from({ length: raffle.bundleSize }, (_, itemIndex) =>
              getActiveAssetRaffleBundleItem(index, itemIndex),
            ),
          );

          return {
            ...raffle,
            index,
            bundleItems: items.filter((item): item is AssetRaffleBundleItem => !!item && item.returnCode === 0),
          } satisfies ActiveAssetRaffle;
        }),
      );

      return {
        analytics,
        raffles: raffles.filter((raffle): raffle is ActiveAssetRaffle => raffle !== null),
      };
    },
    refetchInterval: 30_000,
  });

  return {
    assetRaffles: query.data?.raffles ?? [],
    assetRaffleAnalytics: query.data?.analytics ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
};
