import { Link } from "react-router-dom";
import { Trophy, Clock, ArrowRight, Coins, Calendar, History } from "lucide-react";
import { getTimeToNewEpoch } from "@/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition, FadeInWhenVisible, StaggerChildren } from "@/components/animations";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import NewBadge from "@/components/ui/new-badge";
import { useAtom } from "jotai";
import { tickInfoAtom } from "@/store/rpc";
import { useRaffles } from "@/hooks/useRaffles";
import { getAnalytics } from "@/services/sc.service";
import { useQuery } from "@tanstack/react-query";
import {
  QRAFFLE_BURN_FEE,
  QRAFFLE_FEE,
  QRAFFLE_CHARITY_FEE,
  QRAFFLE_REGISTER_FEE,
  QRAFFLE_SHRAEHOLDER_FEE,
} from "@/utils/constants";

const Raffles: React.FC = () => {
  const [tickInfo] = useAtom(tickInfoAtom);
  const {
    raffles: qraffles,
    isLoading: isQrafflesLoading,
    isError: isQrafflesError,
    refetch: refetchQraffles,
  } = useRaffles(tickInfo.epoch - 5, tickInfo.epoch, false);
  const {
    raffles: tokenRaffles,
    isLoading: isTokenRafflesLoading,
    isError: isTokenRafflesError,
    refetch: refetchTokenRaffles,
  } = useRaffles(
    tickInfo.epoch - 5,
    tickInfo.epoch,
    true,
  );
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalytics(),
  });

  const allLoading = isQrafflesLoading || isTokenRafflesLoading || isAnalyticsLoading;

  const getTypeColor = (type: string) => {
    switch (type) {
      case "standard":
        return "bg-[#47CD89]/10 text-[#47CD89]";
      case "token":
        return "bg-primary/10 text-primary";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const raffleStructuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Active Qubic Raffles",
    description: "Current active raffles on the Qraffle platform",
    numberOfItems: qraffles?.length || 0,
    itemListElement: qraffles?.map((raffle, index) => ({
      "@type": "Offer",
      position: index + 1,
      name: raffle.type === "standard" ? "Standard QUBIC" : "tokenName" in raffle ? raffle.tokenName : "Token",
      description: `${raffle.type === "standard" ? "Standard QUBIC" : "Token"} raffle with ${raffle.entryAmount} entry cost`,
      price: raffle.entryAmount,
      priceCurrency: "QUBIC",
      availability: "https://schema.org/InStock",
      url: `https://qraffle.com/raffle/${"epoch" in raffle ? raffle.epoch : 0}`,
    })),
  };

  const raffles = [...qraffles, ...tokenRaffles];

  // Filter active (current epoch) raffles
  const currentEpochRaffles = raffles?.filter((r) => ("epoch" in r ? r.epoch === tickInfo.epoch : false)) || [];
  const hasLoadError = isQrafflesError || isTokenRafflesError || isAnalyticsError;
  const showLoadError = !allLoading && currentEpochRaffles.length === 0 && hasLoadError;

  const handleRetry = async () => {
    await Promise.allSettled([refetchQraffles(), refetchTokenRaffles(), refetchAnalytics()]);
  };

  return (
    <>
      <SEO
        title="Active Qubic Raffles - Standard QUBIC & Token Raffles | Qraffle"
        description="Browse active Qubic raffles including standard QUBIC raffles with dynamic pricing and community-proposed token raffles. Join epoch-based raffles with DAO governance."
        keywords="active raffles, qubic lottery, standard QUBIC raffles, token raffles, epoch based, dynamic pricing, DAO governance"
        url="/raffles"
        structuredData={raffleStructuredData}
      />
      <PageTransition className="px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <FadeInWhenVisible delay={0.2}>
            <div className="mb-6 text-center">
              <h1 className="text-foreground mb-4 text-4xl font-bold">Qraffle System</h1>
              <p className="text-muted-foreground mx-auto max-w-3xl">
                Participate in our dual raffle system: Standard QUBIC raffles with dynamic pricing and
                community-proposed token raffles. Every raffle burns 5% of entries and distributes 5% as fees to
                support the ecosystem.
              </p>
              <div className="mt-4 flex justify-center">
                <Card className="transform p-4 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="text-primary h-4 w-4" />
                    <span className="text-foreground font-medium">Current Epoch: {tickInfo.epoch}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      Ends in {getTimeToNewEpoch().days} Days {getTimeToNewEpoch().hours} Hours{" "}
                      {getTimeToNewEpoch().minutes} Minutes
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          </FadeInWhenVisible>

          {/* Main Content - Two Column Layout */}
          <FadeInWhenVisible delay={0.4}>
            <div className="flex flex-col gap-4">
              {/* All Active Raffles: Only display current epoch */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-card border-card-border w-full rounded-xl border p-8"
              >
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">All Active Raffles (Current Epoch)</h2>
                </div>

                {/* Content */}
                <div className="space-y-2">
                  {allLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <p className="text-muted-foreground">Loading active raffles...</p>
                    </div>
                  ) : showLoadError ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                        <Trophy className="text-muted-foreground h-8 w-8" />
                      </div>
                      <h3 className="text-foreground mb-2 text-lg font-semibold">Couldn&apos;t load active raffles</h3>
                      <p className="text-muted-foreground mb-4 max-w-sm text-sm">
                        Some network calls failed. Please try again.
                      </p>
                      <Button onClick={handleRetry}>Retry Loading</Button>
                    </div>
                  ) : (
                    <StaggerChildren staggerDelay={0.1} className="grid gap-2">
                      {currentEpochRaffles && currentEpochRaffles.length > 0 ? (
                        currentEpochRaffles.map((raffle, idx) => (
                          <div key={idx} className="group relative">
                            <NewBadge show={raffle.type === "token"} />
                            <Link
                              to={
                                raffle.type === "token" && "tokenRaffleIndex" in raffle
                                  ? `/raffle/${raffle.epoch}/${raffle.tokenRaffleIndex}`
                                  : `/raffle/${"epoch" in raffle ? raffle.epoch : 0}`
                              }
                            >
                              <Card className="overflow-hidden border-gray-700 bg-gray-800 transition-all duration-300 group-hover:scale-105 hover:shadow-xl">
                                <CardContent className="px-3 py-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div
                                        className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                                          raffle.type === "standard"
                                            ? "bg-gradient-to-r from-[#47CD89] to-[#059669]"
                                            : "from-primary to-accent bg-gradient-to-r"
                                        }`}
                                      >
                                        {raffle.type === "standard" ? (
                                          <Coins className="h-3 w-3 text-white" />
                                        ) : (
                                          <Trophy className="text-primary-foreground h-3 w-3" />
                                        )}
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-semibold text-white">
                                          {raffle.type === "standard"
                                            ? "Standard QUBIC"
                                            : "tokenName" in raffle
                                              ? raffle.tokenName
                                              : "Token"}
                                        </h3>
                                        <p className="text-xs text-gray-400">
                                          {raffle.type == "standard"
                                            ? analytics?.currentQuRaffleAmount.toLocaleString()
                                            : Number(raffle.entryAmount).toLocaleString()}{" "}
                                          per entry
                                        </p>
                                        <p className="text-xs text-gray-400">
                                          Entries:{" "}
                                          {raffle.type === "standard"
                                            ? (analytics?.numberOfQuRaffleMembers ?? 0).toLocaleString()
                                            : (raffle.numberOfMembers ?? 0).toLocaleString()}
                                        </p>
                                        {"tokenName" in raffle && raffle.tokenName && (
                                          <p className="text-primary text-xs">{raffle.tokenName}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {raffle.type === "standard" && (
                                        <span className="rounded-full bg-[#47CD89]/10 px-2 py-1 text-xs text-[#47CD89]">
                                          Auto-reload
                                        </span>
                                      )}
                                      <span
                                        className={`rounded-full px-2 py-1 text-xs capitalize ${getTypeColor(raffle.type)}`}
                                      >
                                        {raffle.type === "standard" ? "Standard QUBIC" : "Token Raffle"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="my-2 rounded-lg bg-gradient-to-r from-[#374151]/60 to-[#4B5563]/60 px-2 py-1">
                                    <div className="text-center">
                                      <div className="mb-1 text-xs text-[#9CA3AF]">Prize Pool (80%)</div>
                                      <div className="text-sm font-bold text-[#F3F4F6]">
                                        {raffle.type == "standard"
                                          ? (
                                              ((analytics?.currentQuRaffleAmount || 0) *
                                                (analytics?.numberOfQuRaffleMembers || 0) *
                                                (100 -
                                                  QRAFFLE_BURN_FEE -
                                                  QRAFFLE_REGISTER_FEE -
                                                  QRAFFLE_SHRAEHOLDER_FEE -
                                                  QRAFFLE_CHARITY_FEE -
                                                  QRAFFLE_FEE)) /
                                              100
                                            ).toLocaleString()
                                          : (
                                              ((Number(raffle.entryAmount) || 0) *
                                                (Number(raffle.numberOfMembers) || 0) *
                                                (100 -
                                                  QRAFFLE_BURN_FEE -
                                                  QRAFFLE_REGISTER_FEE -
                                                  QRAFFLE_SHRAEHOLDER_FEE -
                                                  QRAFFLE_CHARITY_FEE -
                                                  QRAFFLE_FEE)) /
                                              100
                                            ).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-1">
                                        <Clock className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-400">
                                          Epoch: {"epoch" in raffle ? raffle.epoch : 0}
                                        </span>
                                      </div>
                                      <ArrowRight className="text-primary h-3 w-3 transition-transform group-hover:translate-x-1" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                            <Trophy className="text-muted-foreground h-8 w-8" />
                          </div>
                          <h3 className="text-foreground mb-2 text-lg font-semibold">No Active Raffles Currently</h3>
                          <p className="text-muted-foreground max-w-sm text-sm">
                            The current epoch does not have any active raffles at this moment. Please check back soon!
                          </p>
                        </div>
                      )}
                    </StaggerChildren>
                  )}
                </div>
              </motion.div>

              <div className="bg-card border-card-border w-full rounded-xl border p-6 shadow-lg">
                <h2 className="text-foreground mb-4 text-xl font-bold">Raffles History</h2>
                <Button asChild className="w-full">
                  <Link to="/winners">
                    <History className="h-4 w-4" />
                    <span>View Raffles History</span>
                  </Link>
                </Button>
              </div>
            </div>
          </FadeInWhenVisible>

          {/* Bottom CTA */}
          <FadeInWhenVisible delay={0.3}>
            <div className="mt-6 text-center">
              <Card className="mx-auto max-w-2xl transform transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <CardTitle>Join the DAO System</CardTitle>
                  <CardDescription>
                    Register to participate in governance, receive revenue share, and submit token raffle proposals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <Button
                      asChild
                      className="from-primary to-accent transform bg-gradient-to-r transition-all duration-300 hover:scale-105"
                    >
                      <Link to="/how-it-works">
                        <span>How It Works</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="transform transition-all duration-300 hover:scale-105">
                      <Link to="/dao">
                        <span>Register in DAO</span>
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </FadeInWhenVisible>
        </div>

      </PageTransition>
    </>
  );
};

export default Raffles;
