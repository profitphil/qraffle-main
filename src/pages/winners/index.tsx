import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
import { Trophy, Crown, ChevronDown } from "lucide-react";
import { PageTransition, FadeInWhenVisible, StaggerChildren, StaggerItem } from "@/components/animations";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tickInfoAtom } from "@/store/rpc";
import { useRaffles } from "@/hooks/useRaffles";
import { truncateMiddle } from "@/utils/base.utils";
import { cn } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/services/sc.service";
import { fetchArchiverStatus, fetchEpochTicks, fetchTxHistory } from "@/services/rpc.service";
import { QubicHelper } from "@qubic-lib/qubic-ts-library/dist/qubicHelper";
import {
  QRAFFLE_BURN_FEE,
  QRAFFLE_CHARITY_FEE,
  QRAFFLE_FEE,
  QRAFFLE_REGISTER_FEE,
  QRAFFLE_SHRAEHOLDER_FEE,
} from "@/utils/constants";

type WinnerRow = {
  key: string;
  epoch: number;
  type: "standard" | "token";
  tokenLabel: string;
  winner: string;
  entryAmount: number;
  numberOfMembers: number;
  totalPool: number;
  href: string;
};

type EpochTotals = {
  totalEntries: number;
  burn: number;
  daoDividends: number;
  shareholderDividends: number;
  charity: number;
  fee: number;
  winner: number;
};

const EARLIEST_EPOCH = 192;
const RECENT_EPOCH_COUNT = 5;
const SHAREHOLDERS_COUNT = 676;

const DAO_REGISTERS_OVERRIDE_BY_EPOCH: Record<number, number> = {
  194: 49,
  195: 51,
  196: 55,
  197: 56,
  198: 59,
  199: 70,
  200: 71,
  201: 72,
  202: 72,
};

const EPOCH_FEE_UPDATE_START = 210;

const getFeeRatesForEpoch = (epoch: number) => {
  const burn = epoch >= EPOCH_FEE_UPDATE_START ? 5 : QRAFFLE_BURN_FEE;
  const shareholder = epoch >= EPOCH_FEE_UPDATE_START ? 8 : QRAFFLE_SHRAEHOLDER_FEE;

  return {
    burn,
    dao: QRAFFLE_REGISTER_FEE,
    shareholder,
    charity: QRAFFLE_CHARITY_FEE,
    fee: QRAFFLE_FEE,
  };
};

const calcBreakdown = (totalEntries: number, epoch: number): EpochTotals => {
  const rates = getFeeRatesForEpoch(epoch);
  const burn = Math.floor((totalEntries * rates.burn) / 100);
  const daoDividends = Math.floor((totalEntries * rates.dao) / 100);
  const shareholderDividends = Math.floor((totalEntries * rates.shareholder) / 100);
  const charity = Math.floor((totalEntries * rates.charity) / 100);
  const fee = Math.floor((totalEntries * rates.fee) / 100);
  const winner = Math.max(0, totalEntries - burn - daoDividends - shareholderDividends - charity - fee);

  return {
    totalEntries,
    burn,
    daoDividends,
    shareholderDividends,
    charity,
    fee,
    winner,
  };
};

const qHelper = new QubicHelper();
const normalizeIdentity = (id: string) => id.replace(/\s+/g, "");
const getContractId = async (contractIndex: number) => {
  const destinationPublicKey = new Uint8Array(32);
  destinationPublicKey.fill(0);
  destinationPublicKey[0] = contractIndex;
  return normalizeIdentity(await qHelper.getIdentity(destinationPublicKey));
};

const getEpochTickRangeFromArchiverStatus = async (
  epoch: number,
): Promise<{ startTick: number; endTick: number } | null> => {
  const status = await fetchArchiverStatus();
  const interval = status?.processedTickIntervalsPerEpoch?.find((e) => e.epoch === epoch);
  if (interval?.intervals?.length) {
    const startTick = Math.min(...interval.intervals.map((i) => i.initialProcessedTick));
    const endTick = Math.max(...interval.intervals.map((i) => i.lastProcessedTick));
    if (Number.isFinite(startTick) && Number.isFinite(endTick)) return { startTick, endTick };
  }

  const endTick = status?.lastProcessedTicksPerEpoch?.[String(epoch)];
  if (typeof endTick !== "number") return null;

  const prevEndTick = status?.lastProcessedTicksPerEpoch?.[String(epoch - 1)];
  if (typeof prevEndTick !== "number") return null;

  return { startTick: prevEndTick + 1, endTick };
};

const getEpochTickRange = async (epoch: number): Promise<{ startTick: number; endTick: number } | null> => {
  const fromStatus = await getEpochTickRangeFromArchiverStatus(epoch);
  if (fromStatus) return fromStatus;

  // Fallback for environments where archiver status is missing some fields.
  const first = await fetchEpochTicks(epoch, 1, 1);
  if (!first?.ticks?.length) return null;
  const totalPages = first.pagination?.totalPages || 1;
  const last = await fetchEpochTicks(epoch, totalPages, 1);
  if (!last?.ticks?.length) return null;
  return { startTick: first.ticks[0].tickNumber, endTick: last.ticks[0].tickNumber };
};

const countRegisterDeltaForTickRange = async (contractId: string, startTick: number, endTick: number) => {
  const history = await fetchTxHistory(contractId, startTick, endTick);
  const ticks = history?.transactions || [];
  let delta = 0;
  for (const t of ticks) {
    for (const item of t.transactions || []) {
      const tx = item.transaction;
      if (!tx) continue;
      if (normalizeIdentity(tx.destId) !== contractId) continue;
      if (tx.inputType === 1) delta += 1;
      else if (tx.inputType === 2) delta -= 1;
    }
  }
  return delta;
};

const countRegisterDeltaForEpoch = async (contractId: string, epoch: number) => {
  const range = await getEpochTickRange(epoch);
  if (!range) return 0;
  return await countRegisterDeltaForTickRange(contractId, range.startTick, range.endTick);
};

const buildRows = (raffles: any[], maxEpoch: number): WinnerRow[] =>
  raffles
    .filter((r) => ("epoch" in r ? r.epoch <= maxEpoch : false))
    .map((raffle: any) => {
      const epoch = raffle.epoch as number;
      const type = raffle.type as "standard" | "token";
      const tokenLabel = type === "standard" ? "QUBIC" : (raffle.tokenName as string);
      const winner = raffle.epochWinner as string;
      const numberOfMembers = raffle.numberOfMembers as number;
      const entryAmount = raffle.entryAmount as number;
      const totalPool = Math.floor(entryAmount * numberOfMembers);

      const href =
        type === "token" && typeof raffle.tokenRaffleIndex === "number"
          ? `/raffle/${epoch}/${raffle.tokenRaffleIndex}`
          : `/raffle/${epoch}`;

      const key = `${type}-${epoch}-${type === "token" ? raffle.tokenRaffleIndex : "qu"}`;

      return {
        key,
        epoch,
        type,
        tokenLabel,
        winner,
        entryAmount,
        numberOfMembers,
        totalPool,
        href,
      };
    })
    .sort((a, b) => b.epoch - a.epoch);

const buildDaoMembersFromSC = (raffles: any[]): Record<number, number> =>
  raffles.reduce(
    (acc, raffle: any) => {
      if (raffle.epoch && typeof raffle.numberOfDaoMembers === "number") {
        acc[raffle.epoch] = raffle.numberOfDaoMembers;
      }
      return acc;
    },
    {} as Record<number, number>,
  );

const resolveEpochDaoRegisters = (
  epoch: number,
  fromSC: Record<number, number>,
  fromTx?: Record<number, number>,
): number | undefined => {
  const override = DAO_REGISTERS_OVERRIDE_BY_EPOCH[epoch];
  if (typeof override === "number") return override;
  const sc = fromSC[epoch];
  if (typeof sc === "number") return sc;
  return fromTx?.[epoch];
};

type EpochCardProps = {
  epoch: number;
  epochRows: WinnerRow[];
  epochDaoRegisters: number | undefined;
  daoRegisters: number;
  shareholdersCount: number;
};

const EpochCard: React.FC<EpochCardProps> = ({
  epoch,
  epochRows,
  epochDaoRegisters,
  daoRegisters,
  shareholdersCount,
}) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((v) => !v);

  const feeRates = getFeeRatesForEpoch(epoch);
  const winnerPercent = 100 - feeRates.burn - feeRates.dao - feeRates.shareholder - feeRates.charity - feeRates.fee;

  const totalsByCurrency = epochRows.reduce(
    (acc, row) => {
      acc[row.tokenLabel] = (acc[row.tokenLabel] || 0) + row.totalPool;
      return acc;
    },
    {} as Record<string, number>,
  );

  const currencyKeys = Object.keys(totalsByCurrency).sort((a, b) => {
    if (a === "QUBIC") return -1;
    if (b === "QUBIC") return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="overflow-hidden rounded-xl border">
      <div
        className="bg-muted/40 hover:bg-muted/60 flex cursor-pointer flex-col gap-3 px-4 py-4 transition-colors select-none sm:flex-row sm:items-center sm:justify-between"
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn("text-muted-foreground h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
          />
          <div>
            <div className="text-foreground text-sm font-semibold">Epoch {epoch}</div>
            <div className="text-muted-foreground text-xs">Raffles: {epochRows.length}</div>
            <div className="text-muted-foreground text-xs">
              DAO Members: {typeof epochDaoRegisters === "number" ? epochDaoRegisters.toLocaleString() : "—"}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="w-full max-w-full overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 gap-2 text-[11px] leading-tight sm:text-xs">
                <div className="flex min-h-8 items-center justify-center rounded-md bg-muted px-2 py-1 text-center text-foreground">
                  <div className="font-semibold">Currency</div>
                </div>
                <div className="flex min-h-8 items-center justify-center rounded-md bg-yellow-50 px-2 py-1 text-center text-yellow-700">
                  <div className="font-semibold">Winner ({winnerPercent}%)</div>
                </div>
                <div className="flex min-h-8 items-center justify-center rounded-md bg-red-50 px-2 py-1 text-center text-red-700">
                  <div className="font-semibold">Burn ({feeRates.burn}%)</div>
                </div>
                <div className="flex min-h-8 items-center justify-center rounded-md bg-blue-50 px-2 py-1 text-center text-blue-700">
                  <div className="font-semibold">DAO ({feeRates.dao}%)</div>
                </div>
                <div className="flex min-h-8 items-center justify-center rounded-md bg-green-50 px-2 py-1 text-center text-green-700">
                  <div className="font-semibold">Shareholders ({feeRates.shareholder}%)</div>
                </div>
                <div className="flex min-h-8 items-center justify-center rounded-md bg-purple-50 px-2 py-1 text-center text-purple-700">
                  <div className="font-semibold">Charity ({feeRates.charity}%)</div>
                </div>
                <div className="flex min-h-8 items-center justify-center rounded-md bg-gray-50 px-2 py-1 text-center text-gray-700">
                  <div className="font-semibold">Fee ({feeRates.fee}%)</div>
                </div>
              </div>

              <div className="mt-2 grid gap-2">
                {currencyKeys.map((currency) => {
                  const totals = calcBreakdown(totalsByCurrency[currency] || 0, epoch);
                  const daoDivisor = typeof epochDaoRegisters === "number" ? epochDaoRegisters : daoRegisters;
                  const daoPerMember = daoDivisor > 0 ? Math.floor(Number(totals.daoDividends) / daoDivisor) : 0;
                  const shareholderPerMember = Math.floor(Number(totals.shareholderDividends) / shareholdersCount);

                  return (
                    <div key={currency} className="grid grid-cols-7 gap-2 text-[11px] leading-tight sm:text-xs">
                      <div className="flex min-h-10 flex-col items-center justify-center rounded-md bg-muted px-2 py-1.5 text-center text-foreground">
                        <div className="font-semibold">{currency}</div>
                        <div className="text-muted-foreground">{totals.totalEntries.toLocaleString()}</div>
                      </div>
                      <div className="flex min-h-10 items-center justify-center rounded-md bg-yellow-50 px-2 py-1.5 text-center text-yellow-700">
                        <div className="font-semibold">{totals.winner.toLocaleString()}</div>
                      </div>
                      <div className="flex min-h-10 items-center justify-center rounded-md bg-red-50 px-2 py-1.5 text-center text-red-700">
                        <div className="font-semibold">{totals.burn.toLocaleString()}</div>
                      </div>
                      <div className="flex min-h-10 flex-col items-center justify-center rounded-md bg-blue-50 px-2 py-1.5 text-center text-blue-700">
                        <div className="font-semibold">{totals.daoDividends.toLocaleString()}</div>
                        <div className="text-[10px] text-blue-700/80 sm:text-[11px]">
                          {Math.floor(daoPerMember).toLocaleString()} ea
                        </div>
                      </div>
                      <div className="flex min-h-10 flex-col items-center justify-center rounded-md bg-green-50 px-2 py-1.5 text-center text-green-700">
                        <div className="font-semibold">{totals.shareholderDividends.toLocaleString()}</div>
                        <div className="text-[10px] text-green-700/80 sm:text-[11px]">
                          {Math.floor(shareholderPerMember).toLocaleString()} ea
                        </div>
                      </div>
                      <div className="flex min-h-10 items-center justify-center rounded-md bg-purple-50 px-2 py-1.5 text-center text-purple-700">
                        <div className="font-semibold">{totals.charity.toLocaleString()}</div>
                      </div>
                      <div className="flex min-h-10 items-center justify-center rounded-md bg-gray-50 px-2 py-1.5 text-center text-gray-700">
                        <div className="font-semibold">{totals.fee.toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
      <div className="divide-y">
        <div className="px-4 py-2">
          <div className="grid grid-cols-[1fr_72px_96px_96px] gap-3 text-xs tabular-nums">
            <div />
            <div className="text-muted-foreground flex items-center justify-center text-center">Entries</div>
            <div className="text-muted-foreground flex items-center justify-center text-center">Entry</div>
            <div className="text-muted-foreground flex items-center justify-center text-center">Pool</div>
          </div>
        </div>
        {epochRows.map((row) => (
          <Link key={row.key} to={row.href} className="block">
            <div className="hover:bg-muted/30 grid grid-cols-[1fr_72px_96px_96px] items-center gap-3 px-4 py-4 transition-colors">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500">
                  <Crown className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-foreground truncate text-sm font-semibold">
                    {row.tokenLabel} {row.type === "standard" ? "Raffle" : "Token Raffle"}
                  </div>
                  <div className="text-muted-foreground truncate font-mono text-xs">
                    Winner: {truncateMiddle(row.winner, 32)}
                  </div>
                </div>
              </div>

              <div className="text-foreground flex items-center justify-center text-center text-xs font-semibold tabular-nums">
                {row.numberOfMembers.toLocaleString()}
              </div>
              <div className="text-foreground flex items-center justify-center text-center text-xs font-semibold tabular-nums">
                {row.entryAmount.toLocaleString()}
              </div>
              <div className="text-foreground flex items-center justify-center text-center text-xs font-semibold tabular-nums">
                {row.totalPool.toLocaleString()}
              </div>
            </div>
          </Link>
        ))}
      </div>
      )}
    </div>
  );
};

const Winners: React.FC = () => {
  const [tickInfo] = useAtom(tickInfoAtom);

  const { data: analytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalytics(),
  });

  const daoRegisters = analytics?.numberOfRegisters || 0;

  const endEpoch = Math.max(0, tickInfo.epoch - 1);
  // Only load the most recent N completed epochs by default so the page load
  // stays constant as the total number of epochs grows over time.
  const recentStartEpoch =
    endEpoch >= EARLIEST_EPOCH
      ? Math.max(EARLIEST_EPOCH, endEpoch - (RECENT_EPOCH_COUNT - 1))
      : Math.max(1, endEpoch);

  const { raffles: qraffles, isLoading: isQrafflesLoading } = useRaffles(recentStartEpoch, endEpoch, false);
  const { raffles: tokenRaffles, isLoading: isTokenRafflesLoading } = useRaffles(recentStartEpoch, endEpoch, true);

  const allLoading = isQrafflesLoading || isTokenRafflesLoading;

  const rows = buildRows([...qraffles, ...tokenRaffles], endEpoch);

  const rowsByEpoch = rows.reduce(
    (acc, row) => {
      (acc[row.epoch] ||= []).push(row);
      return acc;
    },
    {} as Record<number, WinnerRow[]>,
  );

  const epochs = Object.keys(rowsByEpoch)
    .map((k) => Number(k))
    .sort((a, b) => b - a);

  // Extract numberOfDaoMembers from QuRaffle data (provided by smart contract)
  const daoMembersByEpochFromSC = buildDaoMembersFromSC(qraffles);

  // Ended epochs are immutable: their tick ranges never change, so their
  // register deltas are fetched once and cached indefinitely. This avoids
  // re-scanning past-epoch transactions on every tick update.
  const { data: endedEpochDeltas } = useQuery({
    queryKey: ["endedEpochRegisterDeltas", recentStartEpoch, endEpoch],
    queryFn: async () => {
      const contractId = await getContractId(19);
      const deltas = await Promise.all(
        Array.from({ length: endEpoch - recentStartEpoch + 1 }, (_, i) => recentStartEpoch + i).map(async (epoch) => {
          const delta = await countRegisterDeltaForEpoch(contractId, epoch);
          return [epoch, delta] as const;
        }),
      );

      const deltaByEpoch: Record<number, number> = {};
      for (const [epoch, delta] of deltas) deltaByEpoch[epoch] = delta;
      return deltaByEpoch;
    },
    enabled: endEpoch >= recentStartEpoch && recentStartEpoch > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Only the current epoch's tick range grows over time, so this is the only
  // transaction scan that needs to refresh periodically.
  const { data: currentEpochDelta } = useQuery({
    queryKey: ["currentEpochRegisterDelta", tickInfo.epoch],
    queryFn: async () => {
      const contractId = await getContractId(19);
      return await countRegisterDeltaForTickRange(contractId, tickInfo.initialTick, tickInfo.tick);
    },
    enabled: tickInfo.epoch > 0 && tickInfo.initialTick > 0 && tickInfo.tick > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const daoRegistersByEpoch = useMemo<Record<number, number> | null | undefined>(() => {
    if (!endedEpochDeltas) return undefined;

    const hasAnyDelta = Object.values(endedEpochDeltas).some((d) => d !== 0);
    if (!hasAnyDelta) return null;

    let current = Math.max(0, daoRegisters - (currentEpochDelta ?? 0));
    const map: Record<number, number> = {};
    for (let epoch = endEpoch; epoch >= recentStartEpoch; epoch--) {
      map[epoch] = current;
      current = Math.max(0, current - (endedEpochDeltas[epoch] || 0));
    }
    return map;
  }, [endedEpochDeltas, currentEpochDelta, daoRegisters, endEpoch, recentStartEpoch]);

  // --- User's Choice: a single, on-demand epoch shown below the recent list ---
  const [choiceEpoch, setChoiceEpoch] = useState<number | null>(null);
  const [choiceInput, setChoiceInput] = useState("");

  const availableEpochs: number[] = [];
  if (endEpoch >= EARLIEST_EPOCH) {
    for (let e = endEpoch; e >= EARLIEST_EPOCH; e--) availableEpochs.push(e);
  }

  const choiceActive = choiceEpoch !== null && choiceEpoch >= EARLIEST_EPOCH && choiceEpoch <= endEpoch;
  // Pass an empty range (start > end) when inactive so the query stays disabled.
  const choiceStart = choiceActive ? (choiceEpoch as number) : 1;
  const choiceEnd = choiceActive ? (choiceEpoch as number) : 0;

  const { raffles: choiceQu, isLoading: choiceQuLoading } = useRaffles(choiceStart, choiceEnd, false);
  const { raffles: choiceToken, isLoading: choiceTokenLoading } = useRaffles(choiceStart, choiceEnd, true);

  const choiceLoading = choiceActive && (choiceQuLoading || choiceTokenLoading);
  const choiceRows = choiceActive
    ? buildRows([...choiceQu, ...choiceToken], endEpoch).filter((r) => r.epoch === choiceEpoch)
    : [];
  const choiceDaoFromSC = buildDaoMembersFromSC(choiceQu);
  const choiceDaoRegisters =
    choiceActive && choiceEpoch !== null ? resolveEpochDaoRegisters(choiceEpoch, choiceDaoFromSC) : undefined;

  const choiceOutOfRange = choiceEpoch !== null && !choiceActive;

  const commitChoiceInput = () => {
    const n = parseInt(choiceInput, 10);
    if (Number.isFinite(n)) setChoiceEpoch(n);
  };

  const winnersStructuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Qraffle Raffles History",
    description: "Raffle history for completed epochs on the Qraffle platform",
    numberOfItems: rows.length,
  };

  return (
    <>
      <SEO
        title="Raffles History - Past Epoch Winners & Breakdown | Qraffle"
        description="Browse completed epochs including standard QUBIC raffle winners, token raffle winners, and per-epoch breakdown totals."
        keywords="raffles history, raffle winners, past winners, qubic, token raffles, qraffle"
        url="/winners"
        structuredData={winnersStructuredData}
      />

      <PageTransition className="overflow-x-hidden px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <FadeInWhenVisible delay={0.2}>
            <div className="mb-6 text-center">
              <h1 className="text-foreground mb-4 text-4xl font-bold">Raffles History</h1>
              <p className="text-muted-foreground mx-auto max-w-3xl">
                Showing the latest {RECENT_EPOCH_COUNT} completed epochs ({recentStartEpoch} - {endEpoch}). Use the
                selector below to view any other epoch.
              </p>
            </div>
          </FadeInWhenVisible>

          <FadeInWhenVisible delay={0.3}>
            <Card className="bg-card border-card-border w-full rounded-xl border p-2 sm:p-6">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  <span>Completed Epochs</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <p className="text-muted-foreground">Loading winners...</p>
                  </div>
                ) : epochs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                      <Crown className="text-muted-foreground h-8 w-8" />
                    </div>
                    <h3 className="text-foreground mb-2 text-lg font-semibold">No winners found</h3>
                    <p className="text-muted-foreground max-w-sm text-sm">
                      Completed raffles for the selected epoch range will appear here.
                    </p>
                  </div>
                ) : (
                  <StaggerChildren staggerDelay={0.08} useInView={false} className="grid gap-4">
                    {epochs.map((epoch) => (
                      <StaggerItem key={epoch}>
                        <EpochCard
                          epoch={epoch}
                          epochRows={rowsByEpoch[epoch] || []}
                          epochDaoRegisters={resolveEpochDaoRegisters(epoch, daoMembersByEpochFromSC, daoRegistersByEpoch || undefined)}
                          daoRegisters={daoRegisters}
                          shareholdersCount={SHAREHOLDERS_COUNT}
                        />
                      </StaggerItem>
                    ))}
                  </StaggerChildren>
                )}
              </CardContent>
            </Card>
          </FadeInWhenVisible>

          <FadeInWhenVisible delay={0.4}>
            <Card className="bg-card border-card-border mt-6 w-full rounded-xl border p-2 sm:p-6">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  <span>User's Choice</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-muted-foreground text-xs">Select epoch</label>
                    <Select
                      value={choiceActive && choiceEpoch !== null ? String(choiceEpoch) : undefined}
                      onValueChange={(v) => {
                        const n = Number(v);
                        setChoiceEpoch(n);
                        setChoiceInput(String(n));
                      }}
                      disabled={availableEpochs.length === 0}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Choose epoch" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {availableEpochs.map((e) => (
                          <SelectItem key={e} value={String(e)}>
                            Epoch {e}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-muted-foreground text-xs">Or enter epoch</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={EARLIEST_EPOCH}
                        max={endEpoch}
                        placeholder={`${EARLIEST_EPOCH} - ${endEpoch}`}
                        value={choiceInput}
                        onChange={(e) => setChoiceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitChoiceInput();
                        }}
                        className="w-32"
                      />
                      <Button type="button" onClick={commitChoiceInput} disabled={choiceInput.trim() === ""}>
                        View
                      </Button>
                    </div>
                  </div>
                </div>

                {choiceOutOfRange ? (
                  <p className="text-destructive text-sm">
                    Epoch {choiceEpoch} is out of range. Choose between {EARLIEST_EPOCH} and {endEpoch}.
                  </p>
                ) : !choiceActive ? (
                  <p className="text-muted-foreground text-sm">Select or enter an epoch to view its history.</p>
                ) : choiceLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <p className="text-muted-foreground">Loading epoch {choiceEpoch}...</p>
                  </div>
                ) : choiceRows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No completed raffles found for epoch {choiceEpoch}.</p>
                ) : (
                  <EpochCard
                    epoch={choiceEpoch as number}
                    epochRows={choiceRows}
                    epochDaoRegisters={choiceDaoRegisters}
                    daoRegisters={daoRegisters}
                    shareholdersCount={SHAREHOLDERS_COUNT}
                  />
                )}
              </CardContent>
            </Card>
          </FadeInWhenVisible>
        </div>
      </PageTransition>
    </>
  );
};

export default Winners;
