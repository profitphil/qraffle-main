import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Trophy, Clock, Gift, CheckCircle, Coins, AlertCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition, FadeInWhenVisible, StaggerChildren, StaggerItem } from "@/components/animations";
import { motion } from "framer-motion";
import { useRaffle } from "@/hooks/useRaffle";
import { useAtom } from "jotai";
import { tickInfoAtom } from "@/store/rpc";
import { useDepositInQuRaffle } from "@/hooks/useDepositInQuRaffle";
import { useDespositInTokenRaffle } from "@/hooks/useDespositInTokenRaffle";
import { useQubicConnect } from "@/components/connect/QubicConnectContext";
import { getAnalytics } from "@/services/sc.service";
import { useQuery } from "@tanstack/react-query";
import { useRaffleParticipants } from "@/hooks/useRaffleParticipants";
import { getRaffleFeeRates } from "@/utils/raffleFees";
import { useTxMonitor } from "@/store/txMonitor";
import { hasParticipated } from "@/utils/participationStorage";

const RaffleDetailPage: React.FC = () => {
  const { id, tokenRaffleIndex } = useParams<{ id: string; tokenRaffleIndex?: string }>();
  const [isParticipating, setIsParticipating] = useState(false);
  const [participationKey, setParticipationKey] = useState(0); // Force re-render when participation changes
  const [sessionParticipated, setSessionParticipated] = useState(false);
  const [optimisticMemberBoost, setOptimisticMemberBoost] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  const joinStartMembersRef = useRef<number | null>(null);
  const [tickInfo] = useAtom(tickInfoAtom);
  const { result, isMonitoring } = useTxMonitor();

  const { handleDeposit: handleDepositQu } = useDepositInQuRaffle();
  const { handleDeposit: handleDepositToken } = useDespositInTokenRaffle();
  const { wallet } = useQubicConnect();

  // Parse epoch from id parameter
  const epoch = id ? parseInt(id) : 0;
  const tokenIndex = tokenRaffleIndex ? parseInt(tokenRaffleIndex) : undefined;

  // Fetch raffle data using the new hook
  const { raffle, isLoading, isError, refetch: refetchRaffle } = useRaffle(epoch, tokenIndex);

  const isCurrentEpoch = epoch === tickInfo.epoch;

  // Check if user has already participated in this raffle (only for current epoch)
  // Use participationKey to force re-check when localStorage changes
  const hasAlreadyParticipated = React.useMemo(() => {
    if (!isCurrentEpoch || !wallet || !raffle) return false;

    // Reference participationKey to force re-evaluation when it changes
    void participationKey;

    const persistedParticipation = raffle.type === "standard"
      ? hasParticipated(wallet.publicKey, epoch, "qu")
      : hasParticipated(wallet.publicKey, epoch, "token", tokenIndex);

    return persistedParticipation || sessionParticipated;
  }, [isCurrentEpoch, wallet?.publicKey, epoch, tokenIndex, raffle?.type, participationKey, sessionParticipated]);

  // Update participation check when transaction completes
  useEffect(() => {
    if (result === undefined) return;

    // Refresh participation state immediately for button/label updates
    setParticipationKey((prev) => prev + 1);

    if (result === true && joinStartMembersRef.current !== null) {
      setSessionParticipated(true);
    }

    if (result === false && joinStartMembersRef.current !== null) {
      setSessionParticipated(false);
    }
  }, [result]);

  // Also update when wallet or epoch changes
  useEffect(() => {
    if (wallet?.publicKey || epoch || tokenIndex !== undefined) {
      setParticipationKey((prev) => prev + 1);
      setSessionParticipated(false);
      joinStartMembersRef.current = null;
      setOptimisticMemberBoost(0);
      setShowParticipants(false);
    }
  }, [wallet?.publicKey, epoch, tokenIndex]);

  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalytics(),
  });

  const {
    participants: queriedParticipants,
    totalParticipants: queriedParticipantCount,
    totalEntries: queriedEntryCount,
    isLoading: isParticipantsLoading,
    error: participantsError,
  } = useRaffleParticipants({
    epoch,
    isTokenRaffle: raffle?.type === "token",
    tokenRaffleIndex: raffle?.type === "token" ? tokenIndex : undefined,
    enabled: showParticipants && !!raffle && (raffle.type === "standard" || typeof tokenIndex === "number"),
  });

  useEffect(() => {
    if (result !== undefined) {
      if (result === false) {
        setSessionParticipated(false);
        joinStartMembersRef.current = null;
        setOptimisticMemberBoost(0);
      }

      if (result === true && joinStartMembersRef.current !== null) {
        setSessionParticipated(true);
        setOptimisticMemberBoost(1);
      }

      const refreshDelays = [0, 1200, 3000, 6000];
      const timers = refreshDelays.map((delay) =>
        setTimeout(() => {
          refetchAnalytics();
          refetchRaffle();
        }, delay),
      );
      return () => timers.forEach((timer) => clearTimeout(timer));
    }
  }, [result, refetchAnalytics, refetchRaffle]);

  // Auto-refetch raffle data every 10 seconds for current epoch raffles
  useEffect(() => {
    if (!isCurrentEpoch) return;
    if (isParticipating) return;
    if (isMonitoring) return;
    
    const interval = setInterval(() => {
      refetchRaffle();
      refetchAnalytics();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [isCurrentEpoch, isParticipating, isMonitoring, refetchRaffle, refetchAnalytics]);

  if (isLoading) {
    return (
      <div className="px-4 py-16 text-center">
        <div className="border-primary-foreground/30 border-t-primary-foreground mx-auto h-8 w-8 animate-spin rounded-full border-2" />
        <p className="text-muted-foreground mt-4">Loading raffle data...</p>
      </div>
    );
  }

  if (isError || !raffle) {
    return (
      <div className="px-4 py-16 text-center">
        <h1 className="text-foreground mb-4 text-2xl font-bold">Raffle Not Found</h1>
        <p className="text-muted-foreground mb-4">
          {tokenIndex ? `Token raffle ${tokenIndex} in epoch ${epoch} not found` : `Epoch ${epoch} raffle not found`}
        </p>
        <Link to="/raffles" className="text-primary hover:text-primary/80">
          ← Back to Raffles
        </Link>
      </div>
    );
  }

  const feeRates = getRaffleFeeRates(raffle.epoch);
  const rewardPercent =
    100 - feeRates.burn - feeRates.dao - feeRates.shareholder - feeRates.charity - feeRates.fee - feeRates.entropy;

  let entryAmount = 0;
  let tokenName = "QUBIC";
  let members = 0;

  if (raffle.type == "standard") {
    tokenName = "QUBIC";
    if (isCurrentEpoch) {
      entryAmount = analytics?.currentQuRaffleAmount || 0;
      members = analytics?.numberOfQuRaffleMembers || 0;
    } else {
      entryAmount = raffle.entryAmount || 0;
      members = raffle.numberOfMembers || 0;
    }
  } else {
    tokenName = "tokenName" in raffle ? raffle.tokenName.toUpperCase() : "TOKEN";
    entryAmount = raffle.entryAmount || 0;
    members = raffle.numberOfMembers || 0;
    console.log("Token raffle data:", {
      tokenName,
      entryAmount,
      members,
      raffleData: raffle
    });
  }
  const totalPool = Math.floor(entryAmount * members);
  console.log("Total pool calculation:", { entryAmount, members, totalPool });

  const displayMembers =
    optimisticMemberBoost > 0 && joinStartMembersRef.current !== null
      ? Math.max(members, joinStartMembersRef.current + optimisticMemberBoost)
      : members;
  const displayTotalPool = Math.floor(entryAmount * displayMembers);
  const burn = Math.floor((displayTotalPool * feeRates.burn) / 100);
  const daoDividends = Math.floor((displayTotalPool * feeRates.dao) / 100);
  const shareholderDividends = Math.floor((displayTotalPool * feeRates.shareholder) / 100);
  const charity = Math.floor((displayTotalPool * feeRates.charity) / 100);
  const fee = Math.floor((displayTotalPool * feeRates.fee) / 100);
  const entropy = Math.floor((displayTotalPool * feeRates.entropy) / 100);
  const prizePool = Math.max(
    0,
    displayTotalPool - burn - daoDividends - shareholderDividends - charity - fee - entropy,
  );

  const handleParticipate = async () => {
    if (!wallet) {
      // Handle wallet not connected
      return;
    }

    setIsParticipating(true);
    setSessionParticipated(false);
    joinStartMembersRef.current = members;
    setOptimisticMemberBoost(0);

    try {
      if (raffle.type === "standard") {
        // For standard QUBIC raffles, use the entry amount
        await handleDepositQu(
          isCurrentEpoch && raffle.type === "standard"
            ? analytics?.currentQuRaffleAmount || 0
            : raffle.entryAmount || 0,
        );
      } else {
        // For token raffles, the hook handles:
        // 1) check index 19 balance
        // 2) transfer shortfall from index 1 -> 19 only if needed
        // 3) deposit into raffle
        if (tokenIndex !== undefined) {
          await handleDepositToken(tokenIndex);
        }
      }
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setIsParticipating(false);
    }
  };

  return (
    <PageTransition className="mx-auto w-6xl">
      <div className="w-full">
        {/* Back Button */}
        <FadeInWhenVisible delay={0.1}>
          <Button asChild variant="ghost" className="mb-4 transform transition-all duration-300 hover:scale-105">
            <Link to="/raffles">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Raffles</span>
            </Link>
          </Button>
        </FadeInWhenVisible>

        {/* Main Content */}
        <FadeInWhenVisible delay={0.3}>
          <Card className="overflow-hidden shadow-xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 text-slate-100">
              <div className="mb-3 flex items-center space-x-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100/20">
                  {raffle.type === "standard" ? (
                    <Coins className="h-8 w-8 text-slate-100" />
                  ) : (
                    <Trophy className="h-8 w-8 text-slate-100" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">
                    {raffle.type === "standard" ? "Standard QUBIC Raffle" : tokenName + " Raffle"}
                  </h1>
                  <p className="text-slate-200/80">
                    Entry: {entryAmount.toLocaleString()} {raffle.type === "standard" ? "QUBIC" : tokenName}
                  </p>
                  <p className="text-sm text-slate-200/90">
                    {raffle.type === "standard"
                      ? "Standard QUBIC Raffle • Dynamic Pricing"
                      : "Token Raffle • Community Proposed"}
                  </p>
                  <p className="text-sm text-slate-200/90">Token: {tokenName}</p>
                </div>
              </div>

              {/* Prize Fund Display - Prominent like in the image */}
              <div className="mb-4 text-center">
                <div className="mb-1 text-sm font-medium text-slate-200/80">Entry Fund</div>
                <div className="mb-3 text-3xl font-bold text-slate-100">
                  {Math.floor(displayTotalPool).toLocaleString()} {tokenName}
                </div>

                {/* Epoch Info */}
                <div className="mb-3">
                  <div className="text-sm text-slate-200/80">
                    Epoch {raffle.epoch} • {isCurrentEpoch ? "Active" : "Completed"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {raffle.type === "standard" && (
                  <div className="inline-flex items-center space-x-2 rounded-full bg-[#47CD89]/20 px-3 py-1">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Auto-reload enabled</span>
                  </div>
                )}
                <div className="inline-flex items-center space-x-2 rounded-full bg-slate-100/20 px-3 py-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Epoch {raffle.epoch}</span>
                </div>
                <div className="inline-flex items-center space-x-2 rounded-full bg-slate-100/20 px-3 py-1">
                  <Gift className="h-4 w-4" />
                  <span className="text-sm">{rewardPercent}% Prize Pool</span>
                </div>
                {!isCurrentEpoch && (
                  <div className="inline-flex items-center space-x-2 rounded-full bg-green-500/20 px-3 py-1">
                    <Trophy className="h-4 w-4" />
                    <span className="text-sm">Completed</span>
                  </div>
                )}
              </div>
            </div>

            <CardContent className="p-6">
              <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
                {/* Left Column - Raffle Information */}
                <div className="space-y-3">
                  {/* Prize Pool - Modern redesign with dark blue-grey background */}
                  <motion.div
                    className="relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-slate-700 p-8 shadow-2xl"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    whileHover={{
                      scale: 1.02,
                      transition: { duration: 0.3 },
                    }}
                  >
                    {/* Modern geometric background pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <motion.div
                        className="absolute top-6 right-6 h-20 w-20 rounded-full bg-blue-400"
                        animate={{
                          scale: [1, 1.1, 1],
                          opacity: [0.2, 0.4, 0.2],
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.div
                        className="absolute bottom-6 left-6 h-16 w-16 rounded-full bg-cyan-400"
                        animate={{
                          scale: [1.1, 1, 1.1],
                          opacity: [0.3, 0.1, 0.3],
                        }}
                        transition={{
                          duration: 3.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.div
                        className="absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-sky-400"
                        animate={{
                          scale: [0.8, 1.2, 0.8],
                          opacity: [0.1, 0.3, 0.1],
                        }}
                        transition={{
                          duration: 5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </div>

                    {/* Modern content layout */}
                    <motion.div
                      className="relative z-10"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                    >
                      {/* Header with icon and title */}
                      <motion.div className="mb-6 flex items-center justify-between" whileHover={{ scale: 1.02 }}>
                        <div className="flex items-center space-x-3">
                          <motion.div
                            className="rounded-xl bg-blue-400/20 p-2"
                            animate={{ rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Gift className="h-6 w-6 text-blue-400" />
                          </motion.div>
                          <div>
                            <h3 className="text-lg font-bold tracking-wide text-slate-100">PRIZE POOL</h3>
                            <div className="mt-1 h-0.5 w-8 rounded-full bg-blue-400"></div>
                          </div>
                        </div>
                        <motion.div
                          className="h-3 w-3 rounded-full bg-blue-400"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.6, 1, 0.6],
                          }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </motion.div>

                      {/* Prize amount - more prominent */}
                      <motion.div className="mb-6 text-center" whileHover={{ scale: 1.05 }}>
                        <motion.p
                          className="text-5xl leading-none font-black tracking-tight text-slate-100"
                          animate={{
                            textShadow: [
                              "0 0 0px rgba(148, 163, 184, 0)",
                              "0 0 30px rgba(148, 163, 184, 0.4)",
                              "0 0 0px rgba(148, 163, 184, 0)",
                            ],
                          }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        >
                          {Math.floor(0.01 * displayTotalPool * rewardPercent).toLocaleString()}
                        </motion.p>
                        <motion.div
                          className="mx-auto mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400"
                          animate={{
                            scaleX: [0.8, 1, 0.8],
                            opacity: [0.6, 1, 0.6],
                          }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </motion.div>

                      {/* Description with modern styling */}
                      <motion.div
                        className="text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7, duration: 0.5 }}
                      >
                        <p className="text-sm font-medium tracking-wide text-slate-300 uppercase">
                          Total rewards to be distributed
                        </p>
                        <motion.div
                          className="mt-3 flex justify-center space-x-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1, duration: 0.5 }}
                        >
                          {[1, 2, 3].map((i) => (
                            <motion.div
                              key={i}
                              className="h-1 w-1 rounded-full bg-blue-400"
                              animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.4, 1, 0.4],
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: "easeInOut",
                              }}
                            />
                          ))}
                        </motion.div>
                      </motion.div>
                    </motion.div>

                    {/* Modern shimmer effect */}
                    <motion.div
                      className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </motion.div>

                  {/* Progress - Enhanced with better visual hierarchy */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-sm font-semibold">Participants</span>
                      <span className="text-primary text-base font-bold">{displayMembers}</span>
                    </div>
                    <div className="h-4 w-full rounded-full bg-gray-700">
                      <div className="h-4 w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
                    </div>
                    <div className="text-center">
                      <span className="text-muted-foreground text-xs">
                        {!isCurrentEpoch ? "Raffle Completed" : "Raffle Active"}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowParticipants((prev) => !prev)}
                    >
                      <>
                        <Users className="h-4 w-4" />
                        <span>{showParticipants ? "Hide Participants" : "Show Participants"}</span>
                      </>
                    </Button>
                    {showParticipants && (
                      <div className="border-border bg-muted/20 mt-2 max-h-56 overflow-y-auto rounded-md border p-2">
                        {isParticipantsLoading ? (
                          <p className="text-muted-foreground py-2 text-center text-xs">Loading participants...</p>
                        ) : participantsError ? (
                          <p className="text-destructive py-2 text-center text-xs">
                            Failed to load participants for this raffle.
                          </p>
                        ) : queriedParticipants.length === 0 ? (
                          <p className="text-muted-foreground py-2 text-center text-xs">
                            No participants found for this raffle.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                              <span>{queriedParticipantCount} wallets</span>
                              <span>{queriedEntryCount.toLocaleString()} total entries</span>
                            </div>
                            <div className="space-y-1">
                              {queriedParticipants.map((participant, index) => {
                                const percentage =
                                  queriedEntryCount > 0 ? ((participant.entryCount / queriedEntryCount) * 100).toFixed(2) : "0.00";
                                return (
                                  <div
                                    key={participant.wallet}
                                    className="bg-background/40 flex items-center justify-between rounded px-2 py-1 text-[11px]"
                                  >
                                    <span className="text-muted-foreground w-5">{index + 1}</span>
                                    <span className="text-foreground flex-1 truncate font-mono">
                                      {participant.wallet}
                                    </span>
                                    <span className="text-primary ml-2 font-semibold">{participant.entryCount}</span>
                                    <span className="text-muted-foreground ml-2 w-12 text-right">{percentage}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Participation or Results */}
                <div className="space-y-3">
                  {!isCurrentEpoch ? (
                    /* Completed Raffle - Show Results */
                    <div className="text-center">
                      <h3 className="text-foreground mb-1 text-xl font-bold">Raffle Results</h3>
                      <p className="text-muted-foreground text-sm">This raffle has been completed</p>

                      <div className="mt-4 rounded-lg bg-green-500/10 p-4">
                        <div className="mb-2 flex items-center justify-center space-x-2">
                          <Trophy className="h-5 w-5 text-green-500" />
                          <span className="font-semibold text-green-500">Winner</span>
                        </div>
                        <div className="text-foreground font-mono text-sm">
                          {"epochWinner" in raffle ? raffle.epochWinner.slice(0, 8) : "N/A"}...
                          {"epochWinner" in raffle ? raffle.epochWinner.slice(-8) : "N/A"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Active Raffle - Show Participation */
                    <>
                      <div className="text-center">
                        <h3 className="text-foreground mb-1 text-xl font-bold">Participate in Raffle</h3>
                        <p className="text-muted-foreground text-sm">Pay entry amount to join this raffle</p>
                      </div>

                      {/* Important Notice */}
                      <div className="from-warning/10 to-warning/5 border-warning/30 mx-auto max-w-sm rounded-xl border bg-gradient-to-r p-3">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="text-warning mt-0.5 h-4 w-4 flex-shrink-0" />
                          <div className="text-xs">
                            <p className="text-warning font-semibold">Important: 1 Wallet = 1 Entry</p>
                            <p className="text-muted-foreground mt-1">
                              Each wallet can only participate once per raffle. Multiple entries from the same wallet are not allowed.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Entry Fee Display */}
                      <div className="from-primary/5 to-accent/5 border-primary/20 mx-auto max-w-sm space-y-1 rounded-xl border bg-gradient-to-r p-4">
                        <h4 className="text-foreground mb-3 text-center text-sm font-semibold">Entry</h4>
                        <div className="text-center">
                          <div className="text-primary text-3xl font-bold">
                            {entryAmount.toLocaleString()} {tokenName}
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">One-time payment to participate</p>
                        </div>
                        <div className="mt-3 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Prize Pool:</span>
                            <span className="text-foreground font-medium">{rewardPercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fees:</span>
                            <span className="text-foreground font-medium">{100 - rewardPercent}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Participate Button */}
                      <div className="space-y-2">
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="mx-auto w-full max-w-xs"
                        >
                          <Button
                            onClick={handleParticipate}
                            disabled={isParticipating || isMonitoring || !wallet || hasAlreadyParticipated}
                            className="from-primary to-accent hover:from-primary/90 hover:to-accent/90 h-12 w-full bg-gradient-to-r text-base font-semibold shadow-lg disabled:opacity-50"
                            size="lg"
                          >
                            {isParticipating || isMonitoring ? (
                              <div className="flex items-center space-x-2">
                                <div className="border-primary-foreground/30 border-t-primary-foreground h-5 w-5 animate-spin rounded-full border-2" />
                                <span>{isMonitoring ? "Monitoring..." : "Processing..."}</span>
                              </div>
                            ) : !wallet ? (
                              <span>Connect Wallet to Participate</span>
                            ) : hasAlreadyParticipated ? (
                              <span>Already Participated</span>
                            ) : (
                              <span>
                                Pay {entryAmount.toLocaleString()} {tokenName} to Participate
                              </span>
                            )}
                          </Button>
                        </motion.div>

                        <div className="space-y-1 text-center">
                          <p className="text-muted-foreground text-xs">
                            {!wallet
                              ? "Connect your wallet to participate"
                              : hasAlreadyParticipated
                                ? "You have already participated in this raffle (1 wallet = 1 entry)"
                                : "Ready to participate in the raffle"}
                          </p>
                          <div className="text-muted-foreground flex justify-center space-x-3 text-xs">
                            <span>• Secure</span>
                            <span>• Instant</span>
                            <span>• Transparent</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Distribution Breakdown */}
              <div className="border-border mt-6 border-t pt-6">
                <FadeInWhenVisible delay={0.5}>
                  <h3 className="text-foreground mb-4 font-semibold">Distribution Breakdown</h3>
                </FadeInWhenVisible>
                <StaggerChildren staggerDelay={0.1} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <StaggerItem>
                    <div className="transform rounded-lg bg-[#47CD89]/10 p-4 transition-all duration-300 hover:scale-105">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Prize Pool:</span>
                        <span className="font-medium text-[#47CD89]">{prizePool.toLocaleString()} {tokenName}</span>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">{rewardPercent}%</div>
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="bg-error-40/10 transform rounded-lg p-4 transition-all duration-300 hover:scale-105">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Burned:</span>
                        <span className="text-error-40 font-medium">{burn.toLocaleString()} {tokenName}</span>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">{feeRates.burn}%</div>
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="bg-primary/10 transform rounded-lg p-4 transition-all duration-300 hover:scale-105">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">DAO Members:</span>
                        <span className="text-primary font-medium">{daoDividends.toLocaleString()} {tokenName}</span>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">{feeRates.dao}%</div>
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="transform rounded-lg bg-[#47CD89]/10 p-4 transition-all duration-300 hover:scale-105">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Shareholders:</span>
                        <span className="font-medium text-[#47CD89]">{shareholderDividends.toLocaleString()} {tokenName}</span>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">{feeRates.shareholder}%</div>
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="bg-muted transform rounded-lg p-4 transition-all duration-300 hover:scale-105">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Dev Fees:</span>
                        <span className="text-muted-foreground font-medium">{fee.toLocaleString()} {tokenName}</span>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">{feeRates.fee}%</div>
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="transform rounded-lg bg-[#8B5CF6]/10 p-4 transition-all duration-300 hover:scale-105">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Qubic Charity Fund:</span>
                        <span className="font-medium text-[#8B5CF6]">{charity.toLocaleString()} {tokenName}</span>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">{feeRates.charity}%</div>
                    </div>
                  </StaggerItem>
                  {feeRates.entropy > 0 && (
                    <StaggerItem>
                      <div className="transform rounded-lg bg-[#06B6D4]/10 p-4 transition-all duration-300 hover:scale-105">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-sm">Entropy Reserve:</span>
                          <span className="font-medium text-[#06B6D4]">{entropy.toLocaleString()} {tokenName}</span>
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          {feeRates.entropy}% — buys RANDOM SC entropy
                        </div>
                      </div>
                    </StaggerItem>
                  )}
                </StaggerChildren>
                <div className="bg-primary/5 mt-4 rounded-lg p-4">
                  <p className="text-muted-foreground text-sm">
                    <strong>Total Fees: {100 - rewardPercent}%</strong> • Prize Pool: {rewardPercent}% •
                    {raffle.type === "standard"
                      ? " Standard QUBIC Raffle with dynamic entry amounts"
                      : " Token Raffle from community proposal"}
                  </p>
                  <div className="text-muted-foreground mt-2 text-xs">
                    <div>
                      Epoch: {raffle.epoch} • Participants: {displayMembers}
                    </div>
                    {!isCurrentEpoch && (
                      <div>
                        Status: Completed • Winner: {"epochWinner" in raffle ? raffle.epochWinner.slice(0, 8) : "N/A"}
                        ...{"epochWinner" in raffle ? raffle.epochWinner.slice(-8) : "N/A"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeInWhenVisible>
      </div>
    </PageTransition>
  );
};

export default RaffleDetailPage;
