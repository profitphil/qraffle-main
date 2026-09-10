import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
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
import { Trophy, Crown, ChevronDown, Package, XCircle, Sparkles } from "lucide-react";
import { tickInfoAtom } from "@/store/rpc";
import { useRaffles } from "@/hooks/useRaffles";
import { useEndedAssetRaffles, type EndedAssetRaffleRow } from "@/hooks/useEndedAssetRaffles";
import { useAssetRaffleBundles } from "@/hooks/useAssetRaffleBundles";
import { truncateMiddle } from "@/utils/base.utils";
import { cn } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/services/sc.service";
import { fetchArchiverStatus, fetchEpochTicks, fetchTxHistory } from "@/services/rpc.service";
import { QubicHelper } from "@qubic-lib/qubic-ts-library/dist/qubicHelper";
import { QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE } from "@/utils/constants";
import { getRaffleFeeRates } from "@/utils/raffleFees";

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
  entropy: number;
  winner: number;
};

const EARLIEST_EPOCH = 192;
const RECENT_EPOCH_COUNT = 1;
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

const calcBreakdown = (totalEntries: number, epoch: number): EpochTotals => {
  const rates = getRaffleFeeRates(epoch);
  const burn = Math.floor((totalEntries * rates.burn) / 100);
  const daoDividends = Math.floor((totalEntries * rates.dao) / 100);
  const shareholderDividends = Math.floor((totalEntries * rates.shareholder) / 100);
  const charity = Math.floor((totalEntries * rates.charity) / 100);
  const fee = Math.floor((totalEntries * rates.fee) / 100);
  const entropy = Math.floor((totalEntries * rates.entropy) / 100);
  const winner = Math.max(0, totalEntries - burn - daoDividends - shareholderDividends - charity - fee - entropy);

  return {
    totalEntries,
    burn,
    daoDividends,
    shareholderDividends,
    charity,
    fee,
    entropy,
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

const buildAssetRowsByEpoch = (assetRaffles: EndedAssetRaffleRow[]): Record<number, EndedAssetRaffleRow[]> =>
  assetRaffles.reduce(
    (acc, raffle) => {
      (acc[raffle.epoch] ||= []).push(raffle);
      return acc;
    },
    {} as Record<number, EndedAssetRaffleRow[]>,
  );

const AssetRaffleStat: React.FC<{ label: string; value: number; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="flex flex-col items-center rounded-lg bg-white/60 px-3 py-2 dark:bg-white/5">
    <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">{label}</span>
    <span
      className={cn(
        "text-sm font-bold tabular-nums",
        accent ? "text-fuchsia-600 dark:text-fuchsia-300" : "text-foreground",
      )}
    >
      {value.toLocaleString()}
    </span>
  </div>
);

const AssetRaffleFeature: React.FC<{ rows: EndedAssetRaffleRow[] }> = ({ rows }) => {
  const { bundlesByIndex } = useAssetRaffleBundles(rows);

  if (rows.length === 0) return null;

  // Winners (reserve met) always sort above failed/refunded raffles.
  const sortedRows = [...rows].sort((a, b) => Number(b.reserveMet) - Number(a.reserveMet));

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fuchsia-500" />
        <span className="text-foreground text-sm font-bold tracking-wide">Featured Asset Bundle Raffles</span>
      </div>

      {sortedRows.map((row) => (
        <div
          key={`asset-${row.index}`}
          className={cn(
            "overflow-hidden rounded-xl border p-4 shadow-sm",
            row.reserveMet
              ? "border-fuchsia-300/60 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-pink-500/5 dark:border-fuchsia-500/30"
              : "border-border bg-muted/30",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  row.reserveMet
                    ? "bg-gradient-to-br from-purple-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30"
                    : "bg-muted",
                )}
              >
                {row.reserveMet ? (
                  <Package className="h-6 w-6 text-white" />
                ) : (
                  <XCircle className="text-muted-foreground h-6 w-6" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-base font-bold">
                    Bundle of {row.bundleSize} {row.bundleSize === 1 ? "asset" : "assets"}
                  </span>
                  {row.reserveMet && (
                    <span className="rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                      Winner
                    </span>
                  )}
                </div>
                {row.reserveMet ? (
                  <div className="text-muted-foreground truncate font-mono text-xs sm:text-sm">
                    🏆 {truncateMiddle(row.winner, 40)}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs sm:text-sm">Reserve not met — buyers refunded</div>
                )}
                {bundlesByIndex[row.index] && bundlesByIndex[row.index].length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {bundlesByIndex[row.index].map((item, i) => (
                      <span
                        key={`${row.index}-${item.assetName}-${i}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          row.reserveMet
                            ? "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-200"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.assetName}
                        <span className="opacity-70">×{item.numberOfShares.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:w-auto sm:shrink-0">
              <AssetRaffleStat label="Tickets" value={row.totalTickets} />
              <AssetRaffleStat label="Buyers" value={row.numberOfBuyers} />
              <AssetRaffleStat label="Pool (QU)" value={row.grossPoolQu} accent={row.reserveMet} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

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
  assetRows?: EndedAssetRaffleRow[];
  epochDaoRegisters: number | undefined;
  daoRegisters: number;
  shareholdersCount: number;
};

const EpochCard: React.FC<EpochCardProps> = ({
  epoch,
  epochRows,
  assetRows = [],
  epochDaoRegisters,
  daoRegisters,
  shareholdersCount,
}) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((v) => !v);

  const feeRates = getRaffleFeeRates(epoch);
  const winnerPercent =
    100 - feeRates.burn - feeRates.dao - feeRates.shareholder - feeRates.charity - feeRates.fee - feeRates.entropy;

  const totalsByCurrency = epochRows.reduce(
    (acc, row) => {
      acc[row.tokenLabel] = (acc[row.tokenLabel] || 0) + row.totalPool;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Asset bundle raffles pay out in QUBIC. We fold only their DIVIDEND portions into
  // the QUBIC row's Shareholders and DAO cells so members' dividend totals are correct,
  // without touching the QUBIC raffle's own Winner/Burn/pool numbers (the ~79-80% creator
  // payout is deliberately NOT shown as a "winner" — the bundle winner received assets,
  // not Qu). Dividend sources per raffle: 8% of grossPoolQu to shareholders + 5% to DAO
  // (succeeded only), plus a 500K creation fee split 50/50 shareholders/DAO (all ended).
  const succeededAssetGross = assetRows.reduce((sum, r) => (r.reserveMet ? sum + r.grossPoolQu : sum), 0);
  const assetCreationFees = assetRows.length * QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE;
  const assetShareholderFromFees = assetRows.reduce(
    (sum) => sum + Math.floor(QRAFFLE_ASSET_RAFFLE_PROPOSAL_FEE / 2),
    0,
  );
  const assetDaoFromFees = assetCreationFees - assetShareholderFromFees;
  const assetPoolSplit = calcBreakdown(succeededAssetGross, epoch);
  const assetShareholderTotal = assetPoolSplit.shareholderDividends + assetShareholderFromFees;
  const assetDaoTotal = assetPoolSplit.daoDividends + assetDaoFromFees;

  const currencyKeys = Object.keys(totalsByCurrency).sort((a, b) => {
    if (a === "QUBIC") return -1;
    if (b === "QUBIC") return 1;
    return a.localeCompare(b);
  });

  const daoDivisor = typeof epochDaoRegisters === "number" ? epochDaoRegisters : daoRegisters;

  // Build one breakdown row. `extra*` inject non-pool dividends (asset creation fees)
  // that don't follow the standard percentage split.
  const makeBreakdownEntry = (
    currency: string,
    poolTotal: number,
    extraShareholder = 0,
    extraDao = 0,
    extraTotal = 0,
  ) => {
    const base = calcBreakdown(poolTotal, epoch);
    const totals = {
      ...base,
      totalEntries: base.totalEntries + extraTotal,
      daoDividends: base.daoDividends + extraDao,
      shareholderDividends: base.shareholderDividends + extraShareholder,
    };
    const daoPerMember = daoDivisor > 0 ? Math.floor(Number(totals.daoDividends) / daoDivisor) : 0;
    const shareholderPerMember = Math.floor(Number(totals.shareholderDividends) / shareholdersCount);

    // Columns are ordered by percentage, highest first (stable order breaks ties).
    const cells = [
      {
        pct: winnerPercent,
        label: `Winner (${winnerPercent}%)`,
        value: totals.winner,
        sub: undefined as string | undefined,
        cls: "bg-yellow-50 text-yellow-700",
      },
      {
        pct: feeRates.shareholder,
        label: `Shareholders (${feeRates.shareholder}%)`,
        value: totals.shareholderDividends,
        sub: `${shareholderPerMember.toLocaleString()} ea`,
        cls: "bg-green-50 text-green-700",
      },
      { pct: feeRates.burn, label: `Burn (${feeRates.burn}%)`, value: totals.burn, sub: undefined, cls: "bg-red-50 text-red-700" },
      {
        pct: feeRates.dao,
        label: `DAO (${feeRates.dao}%)`,
        value: totals.daoDividends,
        sub: `${daoPerMember.toLocaleString()} ea`,
        cls: "bg-blue-50 text-blue-700",
      },
      { pct: feeRates.charity, label: `Charity (${feeRates.charity}%)`, value: totals.charity, sub: undefined, cls: "bg-purple-50 text-purple-700" },
      { pct: feeRates.fee, label: `Fee (${feeRates.fee}%)`, value: totals.fee, sub: undefined, cls: "bg-gray-50 text-gray-700" },
      ...(feeRates.entropy > 0
        ? [
            {
              pct: feeRates.entropy,
              label: `Entropy (${feeRates.entropy}%)`,
              value: totals.entropy,
              sub: undefined as string | undefined,
              cls: "bg-cyan-50 text-cyan-700",
            },
          ]
        : []),
    ].sort((a, b) => b.pct - a.pct);

    return { currency, totals, cells };
  };

  // Ensure a QUBIC row exists to carry asset-raffle dividends even in the rare case an
  // epoch had asset raffles but no standard Qu raffle.
  if (assetRows.length > 0 && !currencyKeys.includes("QUBIC")) {
    currencyKeys.unshift("QUBIC");
  }

  const currencyBreakdowns = currencyKeys.map((currency) => {
    const foldAssets = currency === "QUBIC" && assetRows.length > 0;
    return makeBreakdownEntry(
      currency,
      totalsByCurrency[currency] || 0,
      foldAssets ? assetShareholderTotal : 0,
      foldAssets ? assetDaoTotal : 0,
    );
  });

  // Breakdown gains an Entropy column from epoch 228, so column count varies (7 or 8).
  const breakdownColumnCount = (currencyBreakdowns[0]?.cells.length ?? 6) + 1;
  const breakdownGridStyle = { gridTemplateColumns: `repeat(${breakdownColumnCount}, minmax(0, 1fr))` };
  const breakdownMinWidthStyle = { minWidth: `${breakdownColumnCount * 104}px` };

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
          <div className="hidden w-full max-w-full overflow-x-auto sm:block">
            <div style={breakdownMinWidthStyle}>
              <div className="grid gap-2 text-xs leading-tight" style={breakdownGridStyle}>
                <div className="flex min-h-8 items-center justify-center rounded-md bg-muted px-2 py-1 text-center text-foreground">
                  <div className="font-semibold">Currency</div>
                </div>
                {currencyBreakdowns[0]?.cells.map((cell) => (
                  <div
                    key={cell.label}
                    className={cn("flex min-h-8 items-center justify-center rounded-md px-2 py-1 text-center", cell.cls)}
                  >
                    <div className="font-semibold">{cell.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-2 grid gap-2">
                {currencyBreakdowns.map(({ currency, totals, cells }) => (
                  <div key={currency} className="grid gap-2 text-xs leading-tight" style={breakdownGridStyle}>
                    <div className="flex min-h-10 flex-col items-center justify-center rounded-md bg-muted px-2 py-1.5 text-center text-foreground">
                      <div className="font-semibold">{currency}</div>
                      <div className="text-muted-foreground">{totals.totalEntries.toLocaleString()}</div>
                    </div>
                    {cells.map((cell) => (
                      <div
                        key={cell.label}
                        className={cn(
                          "flex min-h-10 flex-col items-center justify-center rounded-md px-2 py-1.5 text-center",
                          cell.cls,
                        )}
                      >
                        <div className="font-semibold">{cell.value.toLocaleString()}</div>
                        {cell.sub && <div className="text-[11px] opacity-80">{cell.sub}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {currencyBreakdowns.map(({ currency, totals, cells }) => (
              <div key={currency} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between rounded-md bg-muted px-3 py-2">
                  <span className="text-foreground text-xs font-semibold">{currency}</span>
                  <span className="text-muted-foreground text-xs">{totals.totalEntries.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {cells.map((cell) => (
                    <div key={cell.label} className={cn("rounded-md px-2.5 py-2", cell.cls)}>
                      <div className="text-[10px] font-medium opacity-80">{cell.label}</div>
                      <div className="text-xs font-semibold">
                        {cell.value.toLocaleString()}
                        {cell.sub && (
                          <span className="ml-1 text-[10px] font-normal whitespace-nowrap opacity-80">({cell.sub})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {assetRows.length > 0 && (
        <div className="border-t">
          <AssetRaffleFeature rows={assetRows} />
        </div>
      )}

      {expanded && (
      <div>
        <div className="divide-y">
        <div className="hidden px-4 py-2 sm:block">
          <div className="grid grid-cols-[1fr_72px_96px_96px] gap-3 text-xs tabular-nums">
            <div />
            <div className="text-muted-foreground flex items-center justify-center text-center">Entries</div>
            <div className="text-muted-foreground flex items-center justify-center text-center">Entry</div>
            <div className="text-muted-foreground flex items-center justify-center text-center">Pool</div>
          </div>
        </div>
        {epochRows.map((row) => (
          <Link key={row.key} to={row.href} className="block">
            <div className="hover:bg-muted/30 flex flex-col gap-3 px-4 py-4 transition-colors sm:grid sm:grid-cols-[1fr_72px_96px_96px] sm:items-center">
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

              <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-md px-3 py-2 text-center sm:hidden">
                <div>
                  <div className="text-muted-foreground text-[10px]">Entries</div>
                  <div className="text-foreground text-xs font-semibold tabular-nums">
                    {row.numberOfMembers.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">Entry</div>
                  <div className="text-foreground text-xs font-semibold tabular-nums">
                    {row.entryAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">Pool</div>
                  <div className="text-foreground text-xs font-semibold tabular-nums">
                    {row.totalPool.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="text-foreground hidden items-center justify-center text-center text-xs font-semibold tabular-nums sm:flex">
                {row.numberOfMembers.toLocaleString()}
              </div>
              <div className="text-foreground hidden items-center justify-center text-center text-xs font-semibold tabular-nums sm:flex">
                {row.entryAmount.toLocaleString()}
              </div>
              <div className="text-foreground hidden items-center justify-center text-center text-xs font-semibold tabular-nums sm:flex">
                {row.totalPool.toLocaleString()}
              </div>
            </div>
          </Link>
        ))}
        </div>
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
  const { assetRaffles, isLoading: isAssetRafflesLoading } = useEndedAssetRaffles(recentStartEpoch, endEpoch);

  const allLoading = isQrafflesLoading || isTokenRafflesLoading || isAssetRafflesLoading;

  const rows = buildRows([...qraffles, ...tokenRaffles], endEpoch);

  const rowsByEpoch = rows.reduce(
    (acc, row) => {
      (acc[row.epoch] ||= []).push(row);
      return acc;
    },
    {} as Record<number, WinnerRow[]>,
  );

  const assetRowsByEpoch = buildAssetRowsByEpoch(assetRaffles);

  const epochs = Array.from(
    new Set([...Object.keys(rowsByEpoch), ...Object.keys(assetRowsByEpoch)].map((k) => Number(k))),
  ).sort((a, b) => b - a);

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
  const { assetRaffles: choiceAsset, isLoading: choiceAssetLoading } = useEndedAssetRaffles(choiceStart, choiceEnd);

  const choiceLoading = choiceActive && (choiceQuLoading || choiceTokenLoading || choiceAssetLoading);
  const choiceRows = choiceActive
    ? buildRows([...choiceQu, ...choiceToken], endEpoch).filter((r) => r.epoch === choiceEpoch)
    : [];
  const choiceAssetRows = choiceActive ? choiceAsset.filter((r) => r.epoch === choiceEpoch) : [];
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
                Showing the latest completed epoch ({endEpoch}). Use the selector below to view any other epoch.
              </p>
            </div>
          </FadeInWhenVisible>

          <FadeInWhenVisible delay={0.3}>
            <Card className="bg-card border-card-border w-full rounded-xl border p-2 sm:p-6">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  <span>Latest Completed Epoch</span>
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
                  <StaggerChildren staggerDelay={0.08} useInView={false} className="grid grid-cols-1 gap-4">
                    {epochs.map((epoch) => (
                      <StaggerItem key={epoch} className="min-w-0">
                        <EpochCard
                          epoch={epoch}
                          epochRows={rowsByEpoch[epoch] || []}
                          assetRows={assetRowsByEpoch[epoch] || []}
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
                ) : choiceRows.length === 0 && choiceAssetRows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No completed raffles found for epoch {choiceEpoch}.</p>
                ) : (
                  <EpochCard
                    epoch={choiceEpoch as number}
                    epochRows={choiceRows}
                    assetRows={choiceAssetRows}
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
