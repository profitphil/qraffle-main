import { useQuery } from "@tanstack/react-query";
import {
  getActiveTokenRaffle,
  getAnalytics,
  getEndedQuRaffle,
  getEndedTokenRaffle,
  getEpochRaffleIndexes,
} from "@/services/sc.service";
import { fetchTickInfo } from "@/services/rpc.service";

export const useRaffle = (epoch: number, tokenRaffleIndex?: number) => {
  const {
    data: raffle,
    isLoading,
    isError,
    error,
    refetch: refetchRaffle,
  } = useQuery({
    queryKey: ["raffle", epoch, tokenRaffleIndex],
    queryFn: async () => {
      const tickInfo = await fetchTickInfo();
      if (!tickInfo) return null;

      const resolveEndedTokenRaffle = async () => {
        if (tokenRaffleIndex === undefined) return null;

        // 1) Try direct ended raffle lookup (works for absolute ended indexes).
        const directEndedTokenRaffle = await getEndedTokenRaffle(tokenRaffleIndex);
        if (directEndedTokenRaffle && directEndedTokenRaffle.epoch === epoch) {
          return { raffle: directEndedTokenRaffle, resolvedIndex: tokenRaffleIndex };
        }

        // 2) If route index came from current-epoch active list, map it to this epoch absolute index.
        const epochIndexes = await getEpochRaffleIndexes(epoch);
        if (
          !epochIndexes ||
          typeof epochIndexes.startIndex !== "number" ||
          typeof epochIndexes.endIndex !== "number"
        ) {
          return null;
        }

        const relativeMax = epochIndexes.endIndex - epochIndexes.startIndex;
        if (tokenRaffleIndex < 0 || tokenRaffleIndex > relativeMax) {
          return null;
        }

        const mappedEndedIndex = epochIndexes.startIndex + tokenRaffleIndex;
        if (mappedEndedIndex === tokenRaffleIndex) {
          return null;
        }

        const mappedEndedTokenRaffle = await getEndedTokenRaffle(mappedEndedIndex);
        if (mappedEndedTokenRaffle && mappedEndedTokenRaffle.epoch === epoch) {
          return { raffle: mappedEndedTokenRaffle, resolvedIndex: mappedEndedIndex };
        }

        return null;
      };

      if (tokenRaffleIndex !== undefined) {
        // Token raffle: fetch by index
        // If epoch is current epoch, fetch active token raffle
        if (epoch === tickInfo.epoch) {
          const tokenRaffle = await getActiveTokenRaffle(tokenRaffleIndex);
          if (tokenRaffle) {
            return { epoch: tickInfo.epoch, ...tokenRaffle, type: "token", tokenRaffleIndex };
          }
          return null;
        } else {
          const resolvedEndedTokenRaffle = await resolveEndedTokenRaffle();
          if (resolvedEndedTokenRaffle) {
            return {
              ...resolvedEndedTokenRaffle.raffle,
              type: "token",
              tokenRaffleIndex: resolvedEndedTokenRaffle.resolvedIndex,
            };
          }
          return null;
        }
      } else {
        // Standard QUBIC raffle: fetch by epoch
        const quRaffle = await getEndedQuRaffle(epoch);
        if (quRaffle) {
          return { ...quRaffle, type: "standard", epoch };
        }

        if (epoch === tickInfo.epoch) {
          try {
            const analytics = await getAnalytics();
            const entryAmount = analytics?.currentQuRaffleAmount;
            const numberOfMembers = analytics?.numberOfQuRaffleMembers;

            if (
              typeof entryAmount === "number" &&
              Number.isFinite(entryAmount) &&
              typeof numberOfMembers === "number" &&
              Number.isFinite(numberOfMembers)
            ) {
              return {
                epoch,
                epochWinner: "",
                receivedAmount: 0,
                entryAmount,
                numberOfMembers,
                winnerIndex: 0,
                numberOfDaoMembers: 0,
                type: "standard",
              };
            }
          } catch (error) {
            console.warn("useRaffle: failed to load analytics fallback for current standard raffle", error);
          }
        }

        return null;
      }
    },
    enabled: epoch > 0,
  });

  return {
    raffle,
    isLoading,
    isError,
    error,
    refetch: refetchRaffle,
  };
};
